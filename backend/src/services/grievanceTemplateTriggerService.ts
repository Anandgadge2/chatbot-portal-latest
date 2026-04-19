import User from '../models/User';
import Company from '../models/Company';
import CompanyWhatsAppConfig from '../models/CompanyWhatsAppConfig';
import CitizenProfile from '../models/CitizenProfile';
import Role from '../models/Role';
import { sendWhatsAppTemplate } from './whatsappService';
import { buildCitizenMessage } from './citizenMessageBuilder';
import { sanitizeGrievanceDetails, sanitizeNote, sanitizeRemarks, sanitizeText } from '../utils/sanitize';
import { normalizeLanguage } from './templateValidationService';
import { normalizePhoneNumber } from '../utils/phoneUtils';

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

async function getAdminRecipients(companyId: any): Promise<string[]> {
  const companyAdminRoleIds = await Role.find({
    companyId,
    $or: [
      { key: { $in: ['COMPANY_ADMIN', 'ADMIN', 'COMPANY_HEAD', 'SUPER_ADMIN'] } },
      { level: { $lte: 1 } },
      { name: { $regex: /company\s*admin|administrator|head|collector|commissioner|director|supervisor|manager/i } }
    ]
  }).distinct('_id');

  const admins = await User.find({
    companyId,
    isActive: true,
    $or: [
      { isSuperAdmin: true },
      { level: { $lte: 1 } },
      { customRoleId: { $in: companyAdminRoleIds } }
    ]
  }).select('phone').lean();

  return Array.from(
    new Set(
      admins
        .map((admin: any) => normalizePhoneNumber(admin.phone))
        .filter(Boolean)
    )
  );
}

export async function triggerAdminTemplate(options: {
  event:
    | 'grievance_received_admin_v1'
    | 'grievance_pending_admin_v1'
    | 'grievance_assigned_admin_v1'
    | 'grievance_reassigned_admin_v1'
    | 'grievance_reverted_company_v1';
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
        (options.recipientPhones?.length
          ? options.recipientPhones
          : await getAdminRecipients(options.companyId))
          .map((phone) => normalizePhoneNumber(phone))
          .filter((phone) => !options.citizenPhone || phone !== normalizePhoneNumber(options.citizenPhone))
          .filter(Boolean)
      )
    );
  const language = normalizeLanguage(options.language);
  const safeValues = options.values?.map((value) => sanitizeText(value, 100)) || [];
  const safeData = options.data
    ? Object.fromEntries(
        Object.entries(options.data).map(([key, value]) => [key, sanitizeText(String(value || ''), 100)])
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
  template: 'grievance_submitted_citizen_v1' | 'grievance_status_citizen_v1';
  companyId: any;
  citizenPhone: string;
  language?: string;
  values?: string[];
  data?: Record<string, string>;
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

  if (options.template === 'grievance_status_citizen_v1' && !hasNotificationConsent) {
    return;
  }

  const company = await getCompanyWithConfig(options.companyId);
  const language = normalizeLanguage(options.language);
  const safeValues = options.values?.map((value) => sanitizeText(value, 100)) || [];
  const safeData = options.data
    ? Object.fromEntries(
        Object.entries(options.data).map(([key, value]) => [key, sanitizeText(String(value || ''), 100)])
      )
    : undefined;
  await sendWhatsAppTemplate(company, normalizedPhone, options.template, safeData || safeValues, language, undefined, undefined, {
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
  status: string;
  resolvedByName?: string;
  formattedResolvedDate?: string;
  remarks?: string;
  language?: string;
}) {
  const extraMessage = buildCitizenMessage({
    status: options.status,
    resolvedByName: options.resolvedByName,
    formattedResolvedDate: options.formattedResolvedDate,
    remarks: sanitizeRemarks(options.remarks || '')
  });

  // Use the unified grievance_status_citizen_v1 template for all status changes
  await triggerCitizenTemplate({
    template: 'grievance_status_citizen_v1',
    companyId: options.companyId,
    citizenPhone: options.citizenPhone,
    language: options.language,
    data: {
      citizen_name: sanitizeText(options.citizenName, 60),
      grievance_id: sanitizeText(options.grievanceId, 30),
      department_name: sanitizeText(options.departmentName, 60),
      office_name: sanitizeText(options.subDepartmentName || 'N/A', 60),
      status: sanitizeText(options.status, 30),
      remarks: sanitizeNote(extraMessage)
    }
  });
}

/**
 * Higher-level helper to decide which admin template to shoot based on assignment status.
 * Used in ActionService after grievance creation.
 */
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
}) {
  const isAssigned = (options.status !== 'PENDING' && options.status !== 'UNASSIGNED') && (options.assignedAdmins || []).length > 0;
  const safeDescription = sanitizeGrievanceDetails(options.description || 'N/A');
  const company = await getCompanyWithConfig(options.companyId);
  const language = normalizeLanguage(options.language);
  const notifications = [];

  if (isAssigned) {
    // 1. Send 'received' template to specifically assigned admins
      const assignedRecipientPhones = Array.from(new Set((options.assignedAdmins || [])
        .map(a => a.phone)
        .filter(Boolean)
        .map((phone) => normalizePhoneNumber(phone))
        .filter((phone) => phone !== normalizePhoneNumber(options.citizenPhone))
        .filter(Boolean)));

      if (assignedRecipientPhones.length > 0) {
        notifications.push(
          ...assignedRecipientPhones.map(to => 
            sendWhatsAppTemplate(company, to, 'grievance_received_admin_v1', {
              admin_name: 'Administrator', // Generic if name not available
              grievance_id: sanitizeText(options.grievanceId, 30),
              citizen_name: sanitizeText(options.citizenName, 60),
              department_name: sanitizeText(options.category, 60),
              office_name: sanitizeText(options.subDepartmentName || 'N/A', 60),
              description: safeDescription,
              received_on: new Date().toLocaleDateString('en-IN')
            }, language, undefined, undefined, {
              recipientType: 'ADMIN',
              citizenPhone: options.citizenPhone
            })
          )
        );
      } else {
      // Defensive fallback: grievance is assigned but target admin users have no valid phones.
      // Send the pending template to company admins so the grievance is still visible.
        const fallbackPhones = await getAdminRecipients(options.companyId);
        notifications.push(
          ...fallbackPhones.map((to) =>
            sendWhatsAppTemplate(company, to, 'grievance_pending_admin_v1', {
              admin_name: 'Administrator',
              grievance_id: sanitizeText(options.grievanceId, 30),
              citizen_name: sanitizeText(options.citizenName, 60),
              department_name: sanitizeText(options.category, 60),
              office_name: sanitizeText(options.subDepartmentName || 'N/A', 60),
              description: safeDescription,
              submitted_on: new Date().toLocaleDateString('en-IN')
            }, language, undefined, undefined, {
              recipientType: 'ADMIN',
              citizenPhone: options.citizenPhone
            })
          )
        );
      }
  } else {
    // 2. Send 'pending' template only to selected department admins (no company-wide fallback).
    const departmentAdminPhones = Array.from(new Set((options.assignedAdmins || [])
      .map(a => a.phone)
      .filter(Boolean)
      .map((phone) => normalizePhoneNumber(phone))
      .filter((phone) => phone !== normalizePhoneNumber(options.citizenPhone))
      .filter(Boolean)));

      if (departmentAdminPhones.length > 0) {
        notifications.push(
          ...departmentAdminPhones.map(to => 
            sendWhatsAppTemplate(company, to, 'grievance_pending_admin_v1', {
              admin_name: 'Administrator',
              grievance_id: sanitizeText(options.grievanceId, 30),
              citizen_name: sanitizeText(options.citizenName, 60),
              department_name: sanitizeText(options.category, 60),
              office_name: sanitizeText(options.subDepartmentName || 'N/A', 60),
              description: safeDescription,
              submitted_on: new Date().toLocaleDateString('en-IN')
            }, language, undefined, undefined, {
              recipientType: 'ADMIN',
              citizenPhone: options.citizenPhone
            })
          )
        );
      }
  }

  const settled = await Promise.allSettled(notifications);
  const failed = settled
    .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
    .filter((result: PromiseFulfilledResult<any>) => !result.value?.success);
  if (failed.length > 0) {
    console.error(
      `⚠️ triggerGrievanceNotifications: ${failed.length}/${notifications.length} sends failed for grievance ${options.grievanceId}`,
      failed.map((item) => item.value?.error).filter(Boolean)
    );
  }
}

/**
 * Trigger specific admin notifications for status/assignment changes
 */
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
}) {
  const company = await getCompanyWithConfig(options.companyId);
  const language = normalizeLanguage(options.language);
  const safeDescription = sanitizeGrievanceDetails(options.description || 'N/A');
  
  await Promise.allSettled(
    options.recipientPhones.map(to => 
      sendWhatsAppTemplate(company, to, options.event, {
        grievance_id: sanitizeText(options.grievanceId, 30),
        citizen_name: sanitizeText(options.citizenName, 60),
        citizen_phone: '',
        department_name: sanitizeText(options.category, 60),
        description: safeDescription,
        remarks: safeDescription
      }, language, undefined, undefined, {
        recipientType: 'ADMIN'
      })
    )
  );
}
