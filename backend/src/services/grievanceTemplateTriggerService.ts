import User from '../models/User';
import Company from '../models/Company';
import CompanyWhatsAppConfig from '../models/CompanyWhatsAppConfig';
import CitizenProfile from '../models/CitizenProfile';
import Role from '../models/Role';
import { sendWhatsAppTemplate, sendMediaSequentially } from './whatsappService';
import { sendGrievanceToAdmin, sendTemplateAndAttachments, WhatsAppAttachment } from './whatsapp/grievanceNotificationFlow.service';
import { buildCitizenMessage } from './citizenMessageBuilder';
import { sanitizeGrievanceDetailsForTemplate, sanitizeNote, sanitizeRemarks, sanitizeText } from '../utils/sanitize';
import { normalizeLanguage } from './templateValidationService';
import { normalizePhoneNumber } from '../utils/phoneUtils';
import { formatTemplateDateTime } from '../utils/templateDateTime';

export function formatTemplateDate(date: Date = new Date()): string {
  return formatTemplateDateTime(date, 'en-IN');
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
    'notificationSettings.whatsapp': { $ne: false }, // Only notify if not explicitly disabled
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
      name: (typeof admin.getFullName === 'function' ? admin.getFullName() : `${admin.firstName || ''} ${admin.lastName || ''}`.trim()) || 'Administrator'
    });
  }

  return Array.from(unique.keys());
}

export async function triggerAdminTemplate(options: {
  event:
    | 'grievance_received_admin_v1'
    | 'grievance_pending_admin_v1'
    | 'grievance_assigned_admin_v1'
    | 'grievance_reassigned_admin_v1'
    | 'grievance_reverted_company_v1'
    | 'grievance_reminder_admin_v1';
  companyId: any;
  language?: string;
  values?: string[];
  data?: Record<string, string>;
  recipientPhones?: string[];
  citizenPhone?: string;
}) {
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
  const safeValues = options.values?.map((value) => sanitizeText(value, 100)) || [];
  const safeData = options.data
    ? Object.fromEntries(
        Object.entries(options.data).map(([key, value]) => {
          const rawValue = String(value || '');
          return [key, sanitizeTemplateDataValue(key, rawValue)];
        })
      )
    : undefined;

  if (recipients.length === 0) return;

  const results = await Promise.allSettled(
    recipients.map((to) =>
      sendWhatsAppTemplate(company, to, options.event, safeData || safeValues, language, undefined, undefined, {
        recipientType: 'ADMIN',
        citizenPhone: options.citizenPhone
      })
    )
  );

  const failures = results.filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
    .filter((result: PromiseFulfilledResult<any>) => !result.value?.success);
  if (failures.length > 0) {
    console.error(
      `⚠️ triggerAdminTemplate: ${failures.length}/${recipients.length} sends failed for ${options.event}`,
      failures.map((item) => item.value?.error).filter(Boolean)
    );
  }
}

export async function triggerCitizenTemplate(options: {
  template: 'grievance_status_citizen_v1';
  companyId: any;
  citizenPhone: string;
  language?: string;
  values?: string[];
  data?: Record<string, string>;
  requireNotificationConsent?: boolean;
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
  }).select('notification_consent notificationConsent').lean();

  const hasNotificationConsent = Boolean(
    citizenProfile?.notification_consent ?? citizenProfile?.notificationConsent
  );

  if (options.requireNotificationConsent && !hasNotificationConsent) {
    return {
      success: false,
      error: 'Citizen notification consent missing.'
    };
  }

  const company = await getCompanyWithConfig(options.companyId);
  const language = normalizeLanguage(options.language);
  const safeValues = options.values?.map((value) => sanitizeText(value, 100)) || [];
  const safeData = options.data
    ? Object.fromEntries(
        Object.entries(options.data).map(([key, value]) => {
          const rawValue = String(value || '');
          return [key, sanitizeTemplateDataValue(key, rawValue)];
        })
      )
    : undefined;
  return sendWhatsAppTemplate(company, normalizedPhone, options.template, safeData || safeValues, language, undefined, undefined, {
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
}) {
  const extraMessage = buildCitizenMessage({
    status: options.status,
    resolvedByName: options.resolvedByName,
    formattedResolvedDate: options.formattedResolvedDate,
    remarks: sanitizeRemarks(options.remarks || '')
  });

  // Use the unified grievance_status_citizen_v1 template for all status changes
  const citizenTemplateResult = await triggerCitizenTemplate({
    template: 'grievance_status_citizen_v1',
    companyId: options.companyId,
    citizenPhone: options.citizenPhone,
    language: options.language,
    data: {
      citizen_name: sanitizeText(options.citizenName, 60),
      grievance_id: sanitizeText(options.grievanceId, 30),
      department_name: sanitizeText(options.departmentName, 60),
      sub_department_name: sanitizeText(options.subDepartmentName || 'N/A', 60),
      grievance_summary: sanitizeGrievanceDetailsForTemplate(options.grievanceSummary || options.remarks || 'N/A', 400),
      status: sanitizeText(options.status, 30),
      dynamic_message: sanitizeNote(extraMessage),
      remarks: sanitizeNote(extraMessage),
      updated_on: sanitizeText(options.formattedResolvedDate || new Date().toISOString(), 60)
    },
    requireNotificationConsent: true
  });

  // ✅ 2. Send Media Templates Sequentially (Template first, then media templates)
  if (citizenTemplateResult?.success && options.media && options.media.length > 0) {
    await sendMediaSequentially(
      await getCompanyWithConfig(options.companyId),
      options.citizenPhone,
      options.media,
      options.citizenName
    );
  }
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
}) {
  const safeDescription = sanitizeGrievanceDetailsForTemplate(options.description || 'N/A');
  const company = await getCompanyWithConfig(options.companyId);
  const formattedDate = formatTemplateDate();
  const attachments: WhatsAppAttachment[] = (options.media || []).map((file) => ({
    url: file.url,
    type: file.type,
    caption: file.caption,
    filename: file.filename
  }));
  const notifications: Promise<void>[] = [];

  const adminRecipients = Array.from(
    new Map(
      (options.assignedAdmins || [])
        .map((admin: any) => {
          const normalizedPhone = normalizePhoneNumber(admin?.phone);
          if (!normalizedPhone) return null;
          if (normalizedPhone === normalizePhoneNumber(options.citizenPhone)) return null;
          const resolvedName =
            (typeof admin?.getFullName === 'function' ? admin.getFullName() : `${admin?.firstName || ''} ${admin?.lastName || ''}`.trim()) ||
            admin?.name ||
            'Administrator';
          return [normalizedPhone, { phone: normalizedPhone, name: resolvedName }];
        })
        .filter(Boolean) as Array<[string, { phone: string; name: string }]>
    ).values()
  );

  if (adminRecipients.length > 0) {
    notifications.push(
      ...adminRecipients.map(async (recipient: { phone: string; name: string }) =>
        sendGrievanceToAdmin(
          recipient.phone,
          {
            adminName: recipient.name,
            referenceId: sanitizeText(options.grievanceId, 30),
            citizenName: sanitizeText(options.citizenName, 60),
            department: sanitizeText(options.category, 60),
            office: sanitizeText(options.subDepartmentName || 'N/A', 60),
            description: safeDescription,
            createdAt: formattedDate
          },
          attachments,
          company
        )
      )
    );
  } else {
    const fallbackAdminPhones = await getAdminRecipients(options.companyId);
    if (fallbackAdminPhones.length > 0) {
      notifications.push(
        ...fallbackAdminPhones.map(async (recipientPhone) =>
          sendTemplateAndAttachments({
            recipientPhone,
            recipientName: 'Administrator',
            templateName: 'grievance_pending_admin_v1',
            bodyParameters: [
              { type: 'text', text: 'Administrator' },
              { type: 'text', text: sanitizeText(options.grievanceId, 30) },
              { type: 'text', text: sanitizeText(options.citizenName, 60) },
              { type: 'text', text: sanitizeText(options.category, 60) },
              { type: 'text', text: sanitizeText(options.subDepartmentName || 'N/A', 60) },
              { type: 'text', text: safeDescription },
              { type: 'text', text: formattedDate }
            ],
            attachments,
            company,
            grievanceId: options.grievanceId
          })
        )
      );
    }
  }

  const settled = await Promise.allSettled(notifications);
  const failed = settled.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (failed.length > 0) {
    console.error(
      `⚠️ triggerGrievanceNotifications: ${failed.length}/${notifications.length} sends failed for grievance ${options.grievanceId}`,
      failed.map((item) => item.reason).filter(Boolean)
    );
  }
}

export async function triggerAdminAssignmentNotification(options: {
  event: 'grievance_assigned_admin_v1' | 'grievance_reassigned_admin_v1' | 'grievance_reverted_company_v1';
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
  originalDepartmentName?: string;
  originalOfficeName?: string;
  media?: Array<{ url: string; type: 'image' | 'video' | 'document'; caption?: string; filename?: string }>;
}) {
  const company = await getCompanyWithConfig(options.companyId);
  const language = normalizeLanguage(options.language);
  const safeDescription = sanitizeGrievanceDetailsForTemplate(options.description || 'N/A');
  const safeRemarks = sanitizeRemarks(options.remarks || options.description || 'N/A');
  const dateStr = formatTemplateDate();

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
        // Assigned / Reassigned / Reverted specific fields
        assigned_by: sanitizeText(options.assignedByName || 'Admin', 60),
        assigned_on: dateStr,
        reassigned_by: sanitizeText(options.reassignedByName || options.assignedByName || 'Admin', 60),
        reassigned_on: dateStr,
        reverted_by: sanitizeText(options.revertedByName || 'Admin', 60),
        reverted_on: dateStr,
        remarks: safeRemarks,
        submitted_on: dateStr,
        original_department: sanitizeText(options.originalDepartmentName || 'N/A', 60),
        original_office: sanitizeText(options.originalOfficeName || 'N/A', 60)
      }, language, undefined, undefined, {
        recipientType: 'ADMIN'
      });

      // ✅ Send Media Templates (Image/Video/Document) instead of raw media
      if (options.media && options.media.length > 0) {
        await sendMediaSequentially(company, to, options.media, recipientName);
      }
    })
  );
}
