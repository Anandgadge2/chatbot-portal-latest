import User from '../models/User';
import Company from '../models/Company';
import CompanyWhatsAppConfig from '../models/CompanyWhatsAppConfig';
import CitizenProfile from '../models/CitizenProfile';
import { sendWhatsAppTemplate } from './whatsappService';
import { buildCitizenMessage } from './citizenMessageBuilder';
import { sanitizeGrievanceDetails, sanitizeNote, sanitizeRemarks, sanitizeText } from '../utils/sanitize';
import { normalizeLanguage } from './templateValidationService';
import { UserRole } from '../config/constants';
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
  const admins = await User.find({
    companyId,
    isActive: true,
    role: { $in: [UserRole.COMPANY_ADMIN, 'DEPARTMENT_ADMIN', 'SUB_DEPARTMENT_ADMIN'] }
  }).select('phone').lean();

  return Array.from(new Set(admins.map((admin: any) => admin.phone).filter(Boolean)));
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
  values: string[];
}) {
  const company = await getCompanyWithConfig(options.companyId);
  const recipients = await getAdminRecipients(options.companyId);
  const language = normalizeLanguage(options.language);
  const safeValues = options.values.map((value) => sanitizeText(value, 100));

  await Promise.allSettled(
    recipients.map((to) => sendWhatsAppTemplate(company, to, options.event, safeValues, language))
  );
}

export async function triggerCitizenTemplate(options: {
  template: 'grievance_submitted_citizen_v1' | 'grievance_status_citizen_v1';
  companyId: any;
  citizenPhone: string;
  language?: string;
  values: string[];
}) {
  const normalizedPhone = normalizePhoneNumber(options.citizenPhone);
  const citizenProfile = await CitizenProfile.findOne({
    companyId: options.companyId,
    phone_number: normalizedPhone
  }).select('notification_consent notificationConsent').lean();

  const hasNotificationConsent = Boolean(
    citizenProfile?.notification_consent ?? citizenProfile?.notificationConsent
  );

  if (!hasNotificationConsent) {
    return;
  }

  const company = await getCompanyWithConfig(options.companyId);
  const language = normalizeLanguage(options.language);
  const safeValues = options.values.map((value) => sanitizeText(value, 100));
  await sendWhatsAppTemplate(company, normalizedPhone, options.template, safeValues, language);
}

export async function triggerCitizenSubmissionTemplate(options: {
  companyId: any;
  citizenPhone: string;
  citizenName: string;
  grievanceId: string;
  departmentName: string;
  subDepartmentName?: string;
  grievanceDetails: string;
  language?: string;
}) {
  await triggerCitizenTemplate({
    template: 'grievance_submitted_citizen_v1',
    companyId: options.companyId,
    citizenPhone: options.citizenPhone,
    language: options.language,
    values: [
      sanitizeText(options.citizenName, 60),
      sanitizeText(options.grievanceId, 30),
      sanitizeText(options.departmentName, 60),
      sanitizeText(options.subDepartmentName || 'N/A', 60),
      sanitizeGrievanceDetails(options.grievanceDetails)
    ]
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

  await triggerCitizenTemplate({
    template: 'grievance_status_citizen_v1',
    companyId: options.companyId,
    citizenPhone: options.citizenPhone,
    language: options.language,
    values: [
      sanitizeText(options.citizenName, 60),
      sanitizeText(options.grievanceId, 30),
      sanitizeText(options.departmentName, 60),
      sanitizeText(options.subDepartmentName || 'N/A', 60),
      sanitizeText(options.status, 30),
      sanitizeNote(extraMessage)
    ]
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
  const isAssigned = options.status !== 'PENDING' && (options.assignedAdmins || []).length > 0;
  const safeDescription = sanitizeGrievanceDetails(options.description || 'N/A');

  const notifications = [];

  if (isAssigned) {
    // 1. Send 'received' template to specifically assigned admins
    const recipientPhones = (options.assignedAdmins || [])
      .map(a => a.phone)
      .filter(Boolean);

    if (recipientPhones.length > 0) {
      const company = await getCompanyWithConfig(options.companyId);
      const language = normalizeLanguage(options.language);
      const values = [
        sanitizeText(options.citizenName, 60),
        sanitizeText(options.grievanceId, 30),
        sanitizeText(options.category, 60),
        sanitizeText(options.subDepartmentName || 'N/A', 60),
        safeDescription
      ];

      notifications.push(
        ...recipientPhones.map(to => 
          sendWhatsAppTemplate(company, to, 'grievance_received_admin_v1', values, language)
        )
      );
    }
  } else {
    // 2. Send 'pending' template to company admins if not properly assigned
    let companyAdminPhones = options.companyAdmins 
      ? options.companyAdmins.map(a => a.phone).filter(Boolean)
      : [];

    // Fallback: If no companyAdmins passed, fetch them manually
    if (companyAdminPhones.length === 0) {
      companyAdminPhones = await getAdminRecipients(options.companyId);
    }

    if (companyAdminPhones.length > 0) {
      const company = await getCompanyWithConfig(options.companyId);
      const language = normalizeLanguage(options.language);
      const values = [
        sanitizeText(options.citizenName, 60),
        sanitizeText(options.grievanceId, 30),
        sanitizeText(options.category, 60),
        sanitizeText(options.subDepartmentName || 'N/A', 60),
        safeDescription
      ];

      notifications.push(
        ...companyAdminPhones.map(to => 
          sendWhatsAppTemplate(company, to, 'grievance_pending_admin_v1', values, language)
        )
      );
    }
  }

  await Promise.allSettled(notifications);
}
