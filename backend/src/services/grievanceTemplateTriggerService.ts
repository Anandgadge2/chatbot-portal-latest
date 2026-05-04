import mongoose from 'mongoose';
import moment from 'moment-timezone';
import User from '../models/User';
import Company from '../models/Company';
import CompanyWhatsAppConfig from '../models/CompanyWhatsAppConfig';
import CitizenProfile from '../models/CitizenProfile';
import Role from '../models/Role';
import WhatsAppTemplate from '../models/WhatsAppTemplate';
import { sendWhatsAppTemplate, sendMediaSequentially } from './whatsappService';
import { sendGrievanceToAdmin, sendTemplateAndAttachments, WhatsAppAttachment } from './whatsapp/grievanceNotificationFlow.service';
import { buildCitizenMessage, getCitizenStatusLabel } from './citizenMessageBuilder';
import { sanitizeGrievanceDetailsForTemplate, sanitizeNote, sanitizeRemarks, sanitizeText } from '../utils/sanitize';
import { normalizeLanguage } from './templateValidationService';
import { normalizePhoneNumber } from '../utils/phoneUtils';
import { formatTemplateDateTime } from '../utils/templateDateTime';
import { NotificationContextService } from './notificationContextService';
import { TemplateResolverService } from './templateResolverService';
import { logger } from '../config/logger';
import { logWhatsAppEvent } from '../utils/whatsappLogUtils';
import Grievance from '../models/Grievance';
import { notifyCompanyAdmins, notifyDepartmentAdmins } from './inAppNotificationService';

export function formatTemplateDate(date: Date = new Date()): string {
  return formatTemplateDateTime(date, 'en-IN');
}

async function recordCitizenWhatsAppOutcome(options: {
  companyId: any;
  grievanceId: string;
  citizenPhone: string;
  templateName: string;
  status: string;
  outcome: 'SKIPPED' | 'FAILED';
  reason: string;
  details?: Record<string, any>;
}): Promise<void> {
  try {
    const grievance = await Grievance.findOne({
      companyId: options.companyId,
      grievanceId: options.grievanceId
    }).select('_id grievanceId companyId departmentId subDepartmentId timeline').lean();

    if (!grievance) {
      logger.warn(`⚠️ Could not record WhatsApp outcome. Grievance ${options.grievanceId} not found.`);
      return;
    }

    const action =
      options.outcome === 'SKIPPED'
        ? 'WHATSAPP_NOTIFICATION_SKIPPED'
        : 'WHATSAPP_NOTIFICATION_FAILED';

    const details = {
      channel: 'WHATSAPP',
      target: 'CITIZEN',
      templateName: options.templateName,
      citizenPhone: options.citizenPhone,
      grievanceStatus: options.status,
      outcome: options.outcome,
      reason: options.reason,
      remarks: `Citizen WhatsApp ${options.outcome.toLowerCase()}: ${options.reason}`,
      ...options.details
    };

    await Grievance.updateOne(
      { _id: grievance._id },
      {
        $push: {
          timeline: {
            action,
            details,
            timestamp: new Date()
          }
        }
      }
    );

    const notificationPayload = {
      companyId: grievance.companyId,
      eventType: 'WHATSAPP_DELIVERY_ISSUE' as const,
      title: `WhatsApp update ${options.outcome.toLowerCase()} for ${grievance.grievanceId}`,
      message: `Citizen WhatsApp status template was ${options.outcome.toLowerCase()} for grievance ${grievance.grievanceId}. Reason: ${options.reason}`,
      grievanceId: grievance.grievanceId,
      grievanceObjectId: grievance._id,
      meta: details
    };

    const targetDepartmentId = grievance.subDepartmentId || grievance.departmentId;

    if (targetDepartmentId) {
      await notifyDepartmentAdmins({
        ...notificationPayload,
        departmentId: targetDepartmentId
      });
    } else {
      await notifyCompanyAdmins(notificationPayload);
    }

    logWhatsAppEvent('citizen_whatsapp_outcome_recorded', {
      companyId: String(options.companyId),
      grievanceId: options.grievanceId,
      citizenPhone: options.citizenPhone,
      templateName: options.templateName,
      outcome: options.outcome,
      reason: options.reason
    });
  } catch (error: any) {
    logger.error(`❌ Failed to record citizen WhatsApp outcome for grievance ${options.grievanceId}: ${error.message}`);
  }
}

function sanitizeTemplateDataValue(key: string, value: string): string {
  const normalizedKey = key.toLowerCase();
  if (normalizedKey.includes('description') || normalizedKey.includes('grievance_details') || normalizedKey.includes('grievance_summary')) {
    return sanitizeGrievanceDetailsForTemplate(value, 1000);
  }

  if (normalizedKey.includes('url')) {
    return String(value || '').trim().substring(0, 255);
  }

  return sanitizeText(value, 100);
}

async function getCompanyWithConfig(companyId: any): Promise<any> {
  const [company, cfg] = await Promise.all([
    Company.findById(companyId).lean(),
    CompanyWhatsAppConfig.findOne({ companyId, isActive: true }).lean()
  ]);

  if (!company || !cfg) {
    throw new Error('Company WhatsApp config not found for template trigger');
  }

  return {
    ...company,
    _id: companyId,
    whatsappConfig: {
      phoneNumberId: cfg.phoneNumberId,
      accessToken: cfg.accessToken,
      businessAccountId: cfg.businessAccountId,
      rateLimits: cfg.rateLimits
    }
  };
}

export async function getAdminRecipients(companyId: any): Promise<string[]> {
  const companyAdminRoleIds = await Role.find({
    companyId,
    $or: [
      { key: { $in: ['COMPANY_ADMIN', 'COMPANY_HEAD'] } },
      { name: { $regex: /collector|head|commissioner/i } }
    ]
  }).distinct('_id');

  const admins = await User.find({
    companyId,
    isActive: true,
    'notificationSettings.whatsapp': { $ne: false }, 
    $or: [
      { isSuperAdmin: true },
      { level: 1 },
      { customRoleId: { $in: companyAdminRoleIds } }
    ]
  }).select('phone firstName lastName').lean();

  const unique = new Map<string, { phone: string; name: string }>();
  for (const admin of admins as any[]) {
    const phone = normalizePhoneNumber(admin.phone);
    if (!phone) continue;
    unique.set(phone, {
      phone,
      name: `${admin.firstName || ''} ${admin.lastName || ''}`.trim() || 'Administrator'
    });
  }

  return Array.from(unique.keys());
}

/**
 * NEW: Unified event-based trigger for the PugArch Connect Portal.
 * Handles multitenancy via dynamic template resolution.
 */
export async function triggerGrievanceEvent(options: {
  eventKey: string;
  companyId: any;
  grievance: any;
  recipientPhones?: string[];
  citizenPhone?: string;
  language?: string;
  admin?: any;
  remarks?: string;
  previousDept?: string;
  newDept?: string;
  media?: any[];
}) {
  try {
    const company = await getCompanyWithConfig(options.companyId);
    const language = normalizeLanguage(options.language);

    // 1. Build context
    const context = await NotificationContextService.buildGrievanceContext(options.grievance, {
      admin: options.admin,
      remarks: options.remarks,
      companyName: company.name,
      language,
      previousDept: options.previousDept,
      newDept: options.newDept
    });

    // 2. Resolve template
    const { templateName, values } = await TemplateResolverService.resolveTemplate(
      options.companyId.toString(),
      options.eventKey.toUpperCase(),
      context,
      options.eventKey.toLowerCase() // Use key as fallback name
    );

    // 3. Determine recipients
    const finalPhones = options.recipientPhones?.length 
      ? options.recipientPhones 
      : await getAdminRecipients(options.companyId);

    // 4. Send notifications
    logWhatsAppEvent('grievance_event_trigger', {
      companyId: options.companyId?.toString?.() || String(options.companyId),
      companyName: company?.name,
      eventKey: options.eventKey,
      grievanceId: options.grievance?.grievanceId || options.grievance?._id?.toString?.(),
      citizenPhone: options.citizenPhone || options.grievance?.citizenPhone,
      recipientPhones: finalPhones,
      templateName,
      language,
      mediaCount: options.media?.length || 0
    });

    const results = await Promise.allSettled(
      finalPhones.map(async (to) => {
        return sendWhatsAppTemplate(company, to, templateName, values, language, undefined, undefined, {
          recipientType: 'ADMIN',
          citizenPhone: options.citizenPhone || options.grievance?.citizenPhone
        });
      })
    );

    // 5. Send Media if any
    if (options.media && options.media.length > 0) {
      await Promise.all(finalPhones.map(to => sendMediaSequentially(company, to, options.media!, 'Administrator')));
    }

    logWhatsAppEvent('grievance_event_complete', {
      companyId: options.companyId?.toString?.() || String(options.companyId),
      companyName: company?.name,
      eventKey: options.eventKey,
      grievanceId: options.grievance?.grievanceId || options.grievance?._id?.toString?.(),
      results: results.map((result) =>
        result.status === 'fulfilled'
          ? { status: 'fulfilled', value: result.value }
          : { status: 'rejected', reason: result.reason?.message || String(result.reason) }
      )
    });

    return results;
  } catch (error: any) {
    logger.error(`triggerGrievanceEvent failed: ${error.message}`);
    throw error;
  }
}

/**
 * Legacy support for hardcoded triggers, refactored to use the new system internally where possible.
 */
export async function triggerAdminTemplate(options: {
  event: string;
  companyId: any;
  language?: string;
  values?: string[];
  data?: Record<string, string>;
  recipientPhones?: string[];
  citizenPhone?: string;
  grievance?: any;
}) {
  // If grievance is provided, we prefer the new event system
  if (options.grievance) {
    return triggerGrievanceEvent({
      eventKey: options.event,
      companyId: options.companyId,
      grievance: options.grievance,
      recipientPhones: options.recipientPhones,
      citizenPhone: options.citizenPhone,
      language: options.language,
      remarks: options.data?.remarks
    });
  }

  // Fallback to legacy behavior
  const company = await getCompanyWithConfig(options.companyId);
  const recipients = Array.from(
    new Set(
      (options.recipientPhones?.length ? options.recipientPhones : await getAdminRecipients(options.companyId))
        .map((phone) => normalizePhoneNumber(phone))
        .filter((phone) => !options.citizenPhone || phone !== normalizePhoneNumber(options.citizenPhone))
        .filter(Boolean)
    )
  );
  const language = normalizeLanguage(options.language);
  const safePayload = options.data || options.values || [];

  if (recipients.length === 0) return;

  return Promise.allSettled(
    recipients.map((to) => {
      return sendWhatsAppTemplate(company, to, options.event, safePayload, language, undefined, undefined, {
        recipientType: 'ADMIN',
        citizenPhone: options.citizenPhone
      });
    })
  );
}

export async function triggerCitizenTemplate(options: {
  template: string;
  companyId: any;
  citizenPhone: string;
  language?: string;
  values?: string[];
  data?: Record<string, string>;
  requireNotificationConsent?: boolean;
  mediaUrl?: string;
}) {
  const normalizedPhone = normalizePhoneNumber(options.citizenPhone);
  const rawPhone = String(options.citizenPhone || '').trim();
  const citizenProfile = await CitizenProfile.findOne({
    companyId: options.companyId,
    $or: [
      { phone_number: normalizedPhone },
      { phone_number: rawPhone },
      { phoneNumber: normalizedPhone },
      { phoneNumber: rawPhone }
    ]
  }).select('notification_consent notificationConsent opt_out isSubscribed').lean();

  const hasNotificationConsent = Boolean(
    citizenProfile?.notification_consent ?? citizenProfile?.notificationConsent
  );
  const isOptedOut = Boolean(citizenProfile?.opt_out || citizenProfile?.isSubscribed === false);

  if (isOptedOut) {
    logWhatsAppEvent('citizen_template_skipped_unsubscribed', {
      companyId: options.companyId?.toString?.() || String(options.companyId),
      templateName: options.template,
      recipientPhone: normalizedPhone
    });

    return {
      success: false,
      skipped: true,
      skipReason: 'recipient_unsubscribed',
      error: 'Recipient has unsubscribed from WhatsApp notifications.'
    };
  }

  if (options.requireNotificationConsent && !hasNotificationConsent) {
    return {
      success: false,
      skipped: true,
      skipReason: 'notification_consent_missing',
      error: 'Citizen notification consent missing.'
    };
  }

  const company = await getCompanyWithConfig(options.companyId);
  const language = normalizeLanguage(options.language);
  const safePayload = options.data || options.values || [];

  return sendWhatsAppTemplate(company, normalizedPhone, options.template, safePayload, language, options.mediaUrl, undefined, {
    recipientType: 'CITIZEN'
  });
}

export async function triggerCitizenStatusTemplate(options: {
  companyId: any;
  citizenPhone: string;
  citizenName: string;
  grievanceId: string;
  departmentName: string;
  subDepartmentName?: string;
  grievanceSummary?: string;
  status: string;
  resolvedByName?: string;
  formattedResolvedDate?: string;
  remarks?: string;
  language?: string;
  media?: Array<{ url: string; type: 'image' | 'video' | 'document'; caption?: string; filename?: string }>;
  grievance?: any;
}) {
  const status = options.status.toUpperCase();
  const language = normalizeLanguage(options.language);
  
  // 1. Map to specific Meta-approved templates (Locked to these 3 as per requirement)
  let templateName = '';
  if (status === 'IN_PROGRESS') {
    templateName = `grievance_status_inprogress_citizen_v2`;
  } else if (status === 'RESOLVED') {
    templateName = `grievance_status_resolved_citizen_v2`;
  } else if (status === 'REJECTED') {
    templateName = `grievance_status_rejected_citizen_v2`;
  } else {
    logger.warn(`⚠️ No dedicated template for status: ${status}`);
    return;
  }

  // 2. Prepare the precise 8-variable array (Matches Meta Template Variable Order)
  const timezone = 'Asia/Kolkata';
  const actionDate = moment().tz(timezone).format('DD MMMM YYYY [at] hh:mm:ss a');
  
  const values = [
    options.citizenName || 'Citizen',                  // {{1}}
    options.grievanceId,                               // {{2}}
    options.departmentName || 'General',               // {{3}}
    options.subDepartmentName || 'N/A',                // {{4}}
    (options.grievanceSummary || '').substring(0, 400), // {{5}}
    options.resolvedByName || 'Administrator',         // {{6}}
    actionDate,                                        // {{7}}
    (options.remarks || 'Status updated.').substring(0, 200) // {{8}}
  ];

  logger.info(`🚀 Sending status template: ${templateName} to ${options.citizenPhone}`);

  // 3. Send the Text Status Template
  const citizenTemplateResult = await triggerCitizenTemplate({
    template: templateName,
    companyId: options.companyId,
    citizenPhone: options.citizenPhone,
    language,
    values
  });

  if (citizenTemplateResult?.skipped) {
    logger.info(`ℹ️ Citizen status template skipped for ${options.grievanceId}: ${citizenTemplateResult.skipReason}`);
    await recordCitizenWhatsAppOutcome({
      companyId: options.companyId,
      grievanceId: options.grievanceId,
      citizenPhone: options.citizenPhone,
      templateName,
      status,
      outcome: 'SKIPPED',
      reason: citizenTemplateResult.error || citizenTemplateResult.skipReason || 'Citizen WhatsApp notification skipped.'
    });
    return citizenTemplateResult;
  }

  if (!citizenTemplateResult?.success) {
    await recordCitizenWhatsAppOutcome({
      companyId: options.companyId,
      grievanceId: options.grievanceId,
      citizenPhone: options.citizenPhone,
      templateName,
      status,
      outcome: 'FAILED',
      reason: citizenTemplateResult?.error || 'Citizen WhatsApp notification failed.'
    });
    return citizenTemplateResult;
  }

  // 4. Handle Proof/Evidence (Identify type and use specialized media templates via sequential sender)
  if (options.media && options.media.length > 0) {
    logger.info(`📦 [Notification] Sending ${options.media.length} proof attachments for grievance ${options.grievanceId} to citizen ${options.citizenPhone}`);
    
    const company = await getCompanyWithConfig(options.companyId);
    await sendMediaSequentially(
      company,
      options.citizenPhone,
      options.media,
      options.citizenName || 'Citizen'
    ).then((results: Array<{ success: boolean }>) => {
      const successCount = results.filter((r) => r.success).length;
      logger.info(`✅ [Notification] Proof media send complete for ${options.grievanceId}: ${successCount}/${options.media!.length} delivered.`);
    }).catch((err: any) => {
      logger.error(`❌ [Notification] Proof media delivery failed for ${options.grievanceId}: ${err.message}`);
    });
  } else {
    logger.info(`ℹ️ [Notification] No proof media found to send for grievance ${options.grievanceId}`);
  }
  return citizenTemplateResult;
}

export async function triggerGrievanceNotifications(options: {
  companyId: any;
  grievanceId: string;
  citizenName: string;
  citizenPhone: string;
  category: string;
  description?: string;
  status: string;
  subDepartmentName?: string;
  language?: string;
  assignedAdmins?: any[];
  companyAdmins?: any[];
  media?: Array<{ url: string; type: 'image' | 'video' | 'document'; caption?: string; filename?: string }>;
  grievance?: any;
}) {
  if (options.grievance) {
    return triggerGrievanceEvent({
      eventKey: 'GRIEVANCE_CREATED',
      companyId: options.companyId,
      grievance: options.grievance,
      citizenPhone: options.citizenPhone,
      language: options.language,
      media: options.media
    });
  }

  // Legacy fallback omitted for brevity or integrated above
  const safeDescription = sanitizeGrievanceDetailsForTemplate(options.description || 'N/A');
  const company = await getCompanyWithConfig(options.companyId);
  const formattedDate = formatTemplateDate();
  const attachments: WhatsAppAttachment[] = (options.media || []).map((file) => ({
    url: file.url,
    type: file.type,
    caption: file.caption,
    filename: file.filename
  }));
  
  const adminRecipients = (options.assignedAdmins || []).map(a => normalizePhoneNumber(a.phone)).filter(Boolean);
  
  if (adminRecipients.length > 0) {
    await Promise.allSettled(adminRecipients.map(to => sendGrievanceToAdmin(to!, {
      adminName: 'Administrator',
      referenceId: options.grievanceId,
      citizenName: options.citizenName,
      department: options.category,
      office: options.subDepartmentName || 'N/A',
      description: safeDescription,
      createdAt: formattedDate
    }, attachments, company)));
  }
}

export async function triggerAdminAssignmentNotification(options: {
  event: 'grievance_assigned_admin_v2' | 'grievance_reassigned_admin_v2' | 'grievance_reverted_company_v2';
  companyId: any;
  grievanceId: string;
  citizenName: string;
  category: string;
  subDepartmentName?: string;
  description?: string;
  recipientPhones: string[];
  language?: string;
  assignedByName?: string;
  reassignedByName?: string;
  revertedByName?: string;
  remarks?: string;
  submittedOn?: Date | string;
  reassignedOn?: Date | string;
  originalDepartmentName?: string;
  originalOfficeName?: string;
  media?: Array<{ url: string; type: 'image' | 'video' | 'document'; caption?: string; filename?: string }>;
  grievance?: any;
}) {
  const eventKey = options.event.toUpperCase();
  
  if (options.grievance) {
    return triggerGrievanceEvent({
      eventKey,
      companyId: options.companyId,
      grievance: options.grievance,
      recipientPhones: options.recipientPhones,
      language: options.language,
      remarks: options.remarks,
      previousDept: options.originalDepartmentName,
      newDept: options.category,
      media: options.media
    });
  }

  const company = await getCompanyWithConfig(options.companyId);
  const language = normalizeLanguage(options.language);
  const safeDescription = sanitizeGrievanceDetailsForTemplate(options.description || 'N/A');
  const safeRemarks = sanitizeRemarks(options.remarks || options.description || 'N/A');
  const dateStr = formatTemplateDate();
  const submittedOnDate = options.submittedOn ? new Date(options.submittedOn) : new Date();
  const reassignedOnDate = options.reassignedOn ? new Date(options.reassignedOn) : new Date();
  const submittedOnStr = formatTemplateDate(submittedOnDate);
  const reassignedOnStr = formatTemplateDate(reassignedOnDate);

  const recipientProfiles = await User.find({
    companyId: options.companyId,
    phone: { $in: options.recipientPhones }
  }).select('phone firstName lastName').lean();
  const nameByPhone = new Map<string, string>();
  for (const profile of recipientProfiles as any[]) {
    const normalized = normalizePhoneNumber(profile.phone);
    if (!normalized) continue;
    const fullName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
    if (fullName) nameByPhone.set(normalized, fullName);
  }

  await Promise.allSettled(
    options.recipientPhones.map(async (to) => {
      const normalizedTo = normalizePhoneNumber(to);
      const recipientName = (normalizedTo && nameByPhone.get(normalizedTo)) || 'Administrator';

      await sendWhatsAppTemplate(company, to, options.event, {
        admin_name: sanitizeText(recipientName, 60),
        grievance_id: sanitizeText(options.grievanceId, 30),
        citizen_name: sanitizeText(options.citizenName, 60),
        department_name: sanitizeText(options.category, 60),
        office_name: sanitizeText(options.subDepartmentName || 'N/A', 60),
        description: safeDescription,
        assigned_by: sanitizeText(options.assignedByName || 'Admin', 60),
        assigned_on: dateStr,
        reassigned_by: sanitizeText(options.reassignedByName || options.assignedByName || 'Admin', 60),
        reassigned_on: reassignedOnStr,
        reverted_by: sanitizeText(options.revertedByName || 'Admin', 60),
        reverted_on: dateStr,
        remarks: safeRemarks,
        submitted_on: submittedOnStr,
        original_department: sanitizeText(options.originalDepartmentName || 'N/A', 60),
        original_office: sanitizeText(options.originalOfficeName || 'N/A', 60)
      }, language, undefined, undefined, {
        recipientType: 'ADMIN'
      });

      if (options.media && options.media.length > 0) {
        logger.info(`📦 [Assignment] Sending ${options.media.length} attachments for grievance ${options.grievanceId} to admin ${to}`);
        await sendMediaSequentially(company, to, options.media, recipientName)
          .then((results: Array<{ success: boolean }>) => {
            const successCount = results.filter((r) => r.success).length;
            logger.info(`✅ [Assignment] Attachments delivery complete for admin ${to}: ${successCount}/${options.media!.length} delivered.`);
          })
          .catch((err: any) => logger.error(`❌ [Assignment] Attachments delivery failed for admin ${to}: ${err.message}`));
      } else {
        logger.info(`ℹ️ [Assignment] No media attachments to send for admin ${to}`);
      }
    })
  );
}
