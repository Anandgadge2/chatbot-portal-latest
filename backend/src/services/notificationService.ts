import mongoose from 'mongoose';
import Company from '../models/Company';
import CompanyWhatsAppConfig from '../models/CompanyWhatsAppConfig';
import Department from '../models/Department';
import User from '../models/User';
import { sendEmail, getNotificationEmailContent, getNotificationWhatsAppMessage } from './emailService';
import { sendWhatsAppMessage } from './whatsappService';
import { logger } from '../config/logger';
import { UserRole } from '../config/constants';

/**
 * Notification Service
 * Handles email and WhatsApp notifications for grievances and appointments
 */

interface NotificationData {
  type: 'grievance' | 'appointment';
  action: 'created' | 'assigned' | 'resolved';
  grievanceId?: string;
  appointmentId?: string;
  recipientName?: string;
  citizenName: string;
  citizenPhone: string;
  citizenWhatsApp?: string;
  departmentId?: any;
  parentDepartmentId?: any;
  subDepartmentId?: any;
  departmentName?: string;
  subDepartmentName?: string;
  evidenceUrls?: string[];
  companyId: any;
  description?: string;
  purpose?: string;
  category?: string;
  location?: string;
  remarks?: string;
  assignedTo?: any;
  assignedByName?: string;
  resolvedBy?: any;
  resolvedAt?: Date | string;
  createdAt?: Date | string;
  assignedAt?: Date | string;
  appointmentDate?: Date | string;
  appointmentTime?: string;
  resolutionTimeText?: string;
  timeline?: Array<{
    action: string;
    details?: any;
    performedBy?: any;
    timestamp: Date | string;
  }>;
}

/* ------------------------------------------------------------------ */
/* Shared Utility Helpers                                              */
/* ------------------------------------------------------------------ */

/**
 * Compute a human-readable resolution time string from two dates.
 * Returns '' if either date is missing.
 */
function computeResolutionTime(createdAt: Date | string | undefined, resolvedAt: Date | string | undefined): string {
  if (!createdAt || !resolvedAt) return '';
  const start = new Date(createdAt);
  const end = new Date(resolvedAt);
  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return '';
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} and ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
  if (diffHours > 0) return `${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  return `${Math.max(1, diffMinutes)} minute${diffMinutes !== 1 ? 's' : ''}`;
}

/**
 * Fetches all necessary names (company, department, etc.) to populate placeholder data.
 * Ensures resolutionTimeText is computed if not provided.
 */
async function populateNotificationData(data: NotificationData): Promise<Record<string, any>> {
  const company = await Company.findById(data.companyId).select('name');

  // Handle populated Mongoose objects — extract _id before calling findById
  const deptId = data.departmentId
    ? (typeof data.departmentId === 'object' && data.departmentId._id ? data.departmentId._id : data.departmentId)
    : null;
  const subDeptId = data.subDepartmentId
    ? (typeof data.subDepartmentId === 'object' && data.subDepartmentId._id ? data.subDepartmentId._id : data.subDepartmentId)
    : null;

  const department = deptId ? await Department.findById(deptId).select('name') : null;
  const subDept = subDeptId ? await Department.findById(subDeptId).select('name') : null;

  let assignedByName = data.assignedByName || 'Administrator';
  if (!data.assignedByName && data.assignedTo) {
    try {
      const aUser = await User.findById(data.assignedTo._id || data.assignedTo).select('firstName lastName');
      if (aUser) assignedByName = aUser.getFullName();
    } catch (e) {}
  }

  let resolvedByName = 'Assigned Officer';
  if (data.resolvedBy) {
    try {
      const rUser = await User.findById(
        typeof data.resolvedBy === 'object' && data.resolvedBy !== null
          ? (data.resolvedBy._id || data.resolvedBy)
          : data.resolvedBy
      ).select('firstName lastName');
      if (rUser) resolvedByName = rUser.getFullName();
    } catch (e) {}
  }

  const createdAt = data.createdAt || new Date();
  const formattedDate = new Date(createdAt).toLocaleString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });

  const resolvedAt = data.resolvedAt || (data.action === 'resolved' ? new Date() : null);
  let formattedResolvedDate = '';
  let resolutionTimeText = data.resolutionTimeText || '';

  if (resolvedAt) {
    formattedResolvedDate = new Date(resolvedAt).toLocaleString('en-IN', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
    if (!resolutionTimeText) {
      resolutionTimeText = computeResolutionTime(data.createdAt, resolvedAt);
    }
  }

  return {
    ...data,
    companyName: company?.name || 'Portal Admin',
    recipientName: data.citizenName || 'Citizen',
    departmentName: department
      ? department.name
      : (data.departmentName || (data.type === 'appointment' ? 'CEO Office' : 'General')),
    subDepartmentName: subDept ? subDept.name : (data.subDepartmentName || 'N/A'),
    assignedByName,
    resolvedByName,
    formattedDate,
    formattedResolvedDate,
    resolutionTimeText
  };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Load company and attach WhatsApp config from CompanyWhatsAppConfig so notifications can be sent */
async function getCompanyWithWhatsAppConfig(companyId: any): Promise<any | null> {
  if (!companyId) return null;

  let id = companyId;
  if (typeof companyId === 'object' && companyId !== null) {
    id = companyId._id || id;
  }

  const finalId = id?.toString ? id.toString() : id;

  if (!finalId || typeof finalId !== 'string' || finalId.length > 30 || finalId.includes('{')) {
    logger.error('❌ Invalid companyId passed to getCompanyWithWhatsAppConfig:', {
      type: typeof companyId,
      value: typeof companyId === 'object' ? 'Object' : companyId
    });
    return null;
  }

  try {
    let company: any = null;

    if (mongoose.Types.ObjectId.isValid(finalId) && finalId.length === 24) {
      company = await Company.findById(finalId);
    }

    if (!company) {
      company = await Company.findOne({ companyId: finalId });
    }

    if (!company) return null;

    const config = await CompanyWhatsAppConfig.findOne({
      companyId: company._id,
      isActive: true
    });

    if (config) {
      (company as any).whatsappConfig = {
        phoneNumberId: config.phoneNumberId,
        accessToken: config.accessToken
      };
    }
    return company;
  } catch (error) {
    logger.error('❌ Error in getCompanyWithWhatsAppConfig:', error);
    return null;
  }
}

function isWhatsAppEnabled(company: any): boolean {
  return Boolean(
    company?.whatsappConfig &&
    company.whatsappConfig.phoneNumberId &&
    company.whatsappConfig.accessToken
  );
}

function normalizePhone(phone?: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length >= 11) return digits;
  return null;
}

async function safeSendWhatsApp(
  company: any,
  rawPhone: string | undefined,
  message: string
): Promise<{ success: boolean; error?: string }> {
  if (!rawPhone) {
    logger.warn('⚠️ No phone number provided for WhatsApp notification');
    return { success: false, error: 'No phone number provided' };
  }

  if (!isWhatsAppEnabled(company)) {
    logger.warn('⚠️ WhatsApp config invalid or missing for company', {
      company: company?.name,
      hasConfig: !!company?.whatsappConfig,
      hasPhoneId: !!company?.whatsappConfig?.phoneNumberId,
      hasToken: !!company?.whatsappConfig?.accessToken
    });
    return { success: false, error: 'WhatsApp not configured' };
  }

  const phone = normalizePhone(rawPhone);
  if (!phone) {
    logger.warn('⚠️ Invalid WhatsApp phone number format:', rawPhone);
    return { success: false, error: 'Invalid phone number format' };
  }

  try {
    const result = await sendWhatsAppMessage(company, phone, message);
    if (result.success) {
      logger.info('✅ WhatsApp sent successfully', { to: phone, messageId: result.messageId });
      return { success: true };
    } else {
      logger.error('❌ WhatsApp send failed', { to: phone, error: result.error });
      return { success: false, error: result.error };
    }
  } catch (error: any) {
    logger.error('❌ WhatsApp send exception', {
      to: phone,
      error: error?.response?.data || error?.message || error
    });
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

/* ------------------------------------------------------------------ */
/* Department Admin Lookup                                             */
/* ------------------------------------------------------------------ */

/**
 * 🏢 HIERARCHICAL LOOKUP: Returns ALL department admins in the chain.
 * For a sub-department, we notify:
 *   1. The sub-department's own admin (if exists)
 *   2. The parent department's admin (if exists)
 */
async function getHierarchicalDepartmentAdmins(departmentId: any): Promise<any[]> {
  const admins: any[] = [];
  if (!departmentId) return admins;

  try {
    let currentDeptId = departmentId;
    const processedDeptIds = new Set<string>();

    while (currentDeptId) {
      const currentIdStr = currentDeptId.toString();
      if (processedDeptIds.has(currentIdStr)) break;
      processedDeptIds.add(currentIdStr);

      const dept = await Department.findById(currentDeptId);
      if (!dept) break;

      const admin = await User.findOne({
        departmentId: currentDeptId,
        role: UserRole.DEPARTMENT_ADMIN,
        isActive: true
      });

      if (admin) {
        const alreadyAdded = admins.some(a => a._id.toString() === admin._id.toString());
        if (!alreadyAdded) admins.push(admin);
      }

      currentDeptId = dept.parentDepartmentId;
      if (currentDeptId) {
        logger.info(`🔍 Traversing up hierarchy: ${dept.name} -> Checking parent admin.`);
      }
    }

    return admins;
  } catch (error) {
    logger.error('Error getting hierarchical department admins:', error);
    return admins;
  }
}

/* ------------------------------------------------------------------ */
/* Creation Notification                                               */
/* ------------------------------------------------------------------ */

export async function notifyDepartmentAdminOnCreation(
  data: NotificationData
): Promise<void> {
  try {
    const company = await getCompanyWithWhatsAppConfig(data.companyId);
    if (!company) return;

    const adminsToNotify: any[] = [];

    if (data.departmentId) {
      const deptAdmins = await getHierarchicalDepartmentAdmins(data.departmentId);
      deptAdmins.forEach(admin => adminsToNotify.push({ user: admin, type: 'DEPT_ADMIN' }));
    }

    const companyAdmins = await User.find({
      companyId: data.companyId,
      role: UserRole.COMPANY_ADMIN,
      isActive: true
    });

    companyAdmins.forEach(admin => {
      if (!adminsToNotify.find(a => a.user._id.toString() === admin._id.toString())) {
        adminsToNotify.push({ user: admin, type: 'COMPANY_ADMIN' });
      }
    });

    if (adminsToNotify.length === 0) {
      logger.warn(`⚠️ No admins found to notify for company ${company.name} (${data.grievanceId || data.appointmentId})`);
      return;
    }

    for (const { user, type } of adminsToNotify) {
      const notificationData: NotificationData = {
        ...data,
        recipientName: user.getFullName()
      };

      // 📧 Email
      if (user.email) {
        try {
          const email = await getNotificationEmailContent(data.companyId, data.type, 'created', notificationData);
          const result = await sendEmail(user.email, email.subject, email.html, email.text, { companyId: data.companyId });
          if (result.success) {
            logger.info(`✅ Email sent to ${type} ${user.getFullName()} (${user.email})`);
          }
        } catch (error) {
          logger.error(`❌ Error sending email to ${user.email}:`, error);
        }
      }

      // 📱 WhatsApp — use DB template first, then fallback
      const fullData = await populateNotificationData(notificationData);
      let message = await getNotificationWhatsAppMessage(data.companyId, data.type, 'created', fullData);
      if (!message) {
        const typeLabel = data.type === 'grievance' ? 'GRIEVANCE' : 'APPOINTMENT';
        const categoryText = fullData.category ? `\n📂 *Category:* ${fullData.category}\n` : '';
        const deptLine = fullData.subDepartmentName && fullData.subDepartmentName !== 'N/A'
          ? `🏢 *Department:* ${fullData.departmentName}\n🏢 *Sub-Dept:* ${fullData.subDepartmentName}`
          : `🏢 *Department:* ${fullData.departmentName}`;

        message =
          `*${fullData.companyName}*\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `📋 *NEW ${typeLabel} RECEIVED*\n\n` +
          `Respected ${fullData.recipientName},\n\n` +
          `Grievance/Appointment Details:\n` +
          `🎫 *Reference ID:* ${fullData.grievanceId || fullData.appointmentId}\n` +
          `👤 *Citizen Name:* ${fullData.citizenName}\n` +
          `📞 *Contact Number:* ${fullData.citizenPhone}\n` +
          `${deptLine}\n` +
          `📝 *Description:*\n${fullData.description || fullData.purpose || ''}${categoryText}` +
          `\n📅 *Received On:* ${fullData.formattedDate}\n\n` +
          `*Action Required:*\n` +
          `Please review this ${data.type} promptly. Resolution should be provided as per SLA.\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `*${fullData.companyName}*\n` +
          `Digital Grievance Redressal System\n` +
          `This is an automated notification.`;
      }
      await safeSendWhatsApp(company, user.phone, message);
    }

  } catch (error) {
    logger.error('❌ notifyDepartmentAdminOnCreation failed:', error);
  }
}

/* ------------------------------------------------------------------ */
/* Assignment Notification                                             */
/* ------------------------------------------------------------------ */

export async function notifyUserOnAssignment(
  data: NotificationData
): Promise<void> {
  try {
    const company = await getCompanyWithWhatsAppConfig(data.companyId);
    if (!company) return;

    const user = await User.findById(data.assignedTo);
    if (!user) return;

    const fullData = await populateNotificationData({
      ...data,
      recipientName: user.getFullName()
    });

    // 📧 Email
    if (user.email) {
      try {
        const email = await getNotificationEmailContent(data.companyId, data.type, 'assigned', fullData);
        await sendEmail(user.email, email.subject, email.html, email.text, { companyId: data.companyId });
      } catch (e) {}
    }

    // 📱 WhatsApp — use DB template first, then fallback
    let message = await getNotificationWhatsAppMessage(data.companyId, data.type, 'assigned', fullData);
    if (!message) {
      const typeLabel = data.type === 'grievance' ? 'GRIEVANCE' : 'APPOINTMENT';
      const deptLine = fullData.subDepartmentName && fullData.subDepartmentName !== 'N/A'
        ? `🏢 *Department:* ${fullData.departmentName}\n🏢 *Sub-Dept:* ${fullData.subDepartmentName}`
        : `🏢 *Department:* ${fullData.departmentName}`;

      message =
        `*${fullData.companyName}*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 *${typeLabel} ASSIGNED TO YOU*\n\n` +
        `Respected ${fullData.recipientName},\n\n` +
        `Details:\n` +
        `🎫 *Reference ID:* ${fullData.grievanceId || fullData.appointmentId}\n` +
        `👤 *Citizen:* ${fullData.citizenName}\n` +
        `${deptLine}\n` +
        `📝 *Description:*\n${fullData.description || fullData.purpose || ''}\n\n` +
        `👨‍💼 *Assigned By:* ${fullData.assignedByName}\n` +
        `📅 *Assigned On:* ${fullData.formattedDate}\n\n` +
        `Please investigate and take required action.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `*${fullData.companyName}*\n` +
        `Digital Grievance Redressal System`;
    }
    await safeSendWhatsApp(company, user.phone, message);

  } catch (error) {
    logger.error('❌ notifyUserOnAssignment failed:', error);
  }
}

/* ------------------------------------------------------------------ */
/* Resolution Notification                                             */
/* ------------------------------------------------------------------ */

export async function notifyCitizenOnResolution(
  data: NotificationData
): Promise<void> {
  try {
    const company = await getCompanyWithWhatsAppConfig(data.companyId);
    if (!company) return;

    // populateNotificationData handles department lookup, resolvedBy lookup,
    // date formatting, and resolution time computation — no duplicates here.
    const fullData = await populateNotificationData(data);

    // 📧 Email for appointments if citizen email is available
    if (data.type === 'appointment' && (data as any).citizenEmail) {
      try {
        const emailPayload = {
          ...fullData,
          appointmentDate: (data as any).appointmentDate,
          appointmentTime: (data as any).appointmentTime
        };
        const email = await getNotificationEmailContent(data.companyId, 'appointment', 'resolved', emailPayload);
        const result = await sendEmail((data as any).citizenEmail, email.subject, email.html, email.text, { companyId: data.companyId });
        if (result.success) {
          logger.info(`✅ Email sent to citizen ${data.citizenName} (${(data as any).citizenEmail})`);
        }
      } catch (error) {
        logger.error(`❌ Error sending email to citizen:`, error);
      }
    }

    // 📱 WhatsApp — use DB template first, then fallback
    let message = await getNotificationWhatsAppMessage(data.companyId, data.type, 'resolved', fullData);
    if (!message) {
      const typeLabel = data.type === 'grievance' ? 'GRIEVANCE' : 'APPOINTMENT';
      const deptLine = fullData.subDepartmentName && fullData.subDepartmentName !== 'N/A'
        ? `🏢 *Department:* ${fullData.departmentName}\n🏢 *Sub-Dept:* ${fullData.subDepartmentName}`
        : `🏢 *Department:* ${fullData.departmentName}`;
      const remarksText = data.remarks ? `\n\n*Officer's Resolution Remarks:*\n${data.remarks}\n` : '';
      const resolutionTimeLine = fullData.resolutionTimeText ? `\n⏱️ *Resolution Time:* ${fullData.resolutionTimeText}` : '';

      message =
        `*${fullData.companyName}*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `✅ *YOUR ${typeLabel} HAS BEEN RESOLVED*\n\n` +
        `Respected ${fullData.citizenName},\n\n` +
        `This is to inform you that your ${data.type} has been successfully resolved. We appreciate your patience.\n\n` +
        `*Resolution Details:*\n` +
        `🎫 *Reference ID:* ${fullData.grievanceId || fullData.appointmentId}\n` +
        `${deptLine}\n` +
        `📊 *Status:* RESOLVED\n` +
        `👨‍💼 *Resolved By:* ${fullData.resolvedByName}\n` +
        `📅 *Resolved On:* ${fullData.formattedResolvedDate}${resolutionTimeLine}${remarksText}\n\n` +
        `Thank you for using our digital portal.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `*${fullData.companyName}*\n` +
        `Digital Grievance Redressal System\n` +
        `This is an automated notification.`;
    }
    await safeSendWhatsApp(company, data.citizenWhatsApp || data.citizenPhone, message);

  } catch (error) {
    logger.error('❌ notifyCitizenOnResolution failed:', error);
  }
}

/* ------------------------------------------------------------------ */
/* Grievance status change notification (ASSIGNED, REJECTED, PENDING)  */
/* ------------------------------------------------------------------ */

export async function notifyCitizenOnGrievanceStatusChange(data: {
  companyId: any;
  grievanceId: string;
  citizenName: string;
  citizenPhone: string;
  citizenWhatsApp?: string;
  departmentId?: any;
  subDepartmentId?: any;
  departmentName?: string;
  subDepartmentName?: string;
  newStatus: string;
  remarks?: string;
  createdAt?: Date | string;
}): Promise<void> {
  try {
    const company = await getCompanyWithWhatsAppConfig(data.companyId);
    if (!company) return;

    // Look up department/sub-department names if IDs are provided
    let departmentName = data.departmentName || 'Department';
    let subDepartmentName = data.subDepartmentName || '';

    if (data.departmentId) {
      try {
        const deptId = typeof data.departmentId === 'object' && data.departmentId._id
          ? data.departmentId._id : data.departmentId;
        const dept = await Department.findById(deptId).select('name');
        if (dept) departmentName = dept.name;
      } catch (e) {}
    }
    if (data.subDepartmentId) {
      try {
        const sdId = typeof data.subDepartmentId === 'object' && data.subDepartmentId._id
          ? data.subDepartmentId._id : data.subDepartmentId;
        const sdept = await Department.findById(sdId).select('name');
        if (sdept) subDepartmentName = sdept.name;
      } catch (e) {}
    }

    const remarksText = data.remarks ? `\n\n📝 *Remarks:*\n${data.remarks}` : '';
    const statusLabel =
      data.newStatus === 'ASSIGNED' ? 'Assigned' :
      data.newStatus === 'REJECTED' ? 'Rejected' :
      data.newStatus === 'PENDING'  ? 'Pending'  : data.newStatus;

    // Try DB template for status_update key first (custom key for grievance status changes)
    const templateData: Record<string, any> = {
      companyName: company.name,
      citizenName: data.citizenName,
      citizenPhone: data.citizenPhone,
      grievanceId: data.grievanceId,
      departmentName,
      subDepartmentName: subDepartmentName || 'N/A',
      newStatus: statusLabel,
      remarks: data.remarks || '',
    };

    let message: string | null = null;

    // Check for a custom DB template keyed 'grievance_status_update'
    try {
      const { default: CompanyWhatsAppTemplate } = await import('../models/CompanyWhatsAppTemplate');
      const { replacePlaceholders } = await import('./emailService');
      const cid = mongoose.Types.ObjectId.isValid(String(data.companyId))
        ? new mongoose.Types.ObjectId(String(data.companyId))
        : data.companyId;
      const tmpl = await CompanyWhatsAppTemplate.findOne({
        companyId: cid,
        templateKey: 'grievance_status_update',
        isActive: true
      });
      if (tmpl && tmpl.message && tmpl.message.trim()) {
        message = replacePlaceholders(tmpl.message.trim(), templateData);
      }
    } catch (e) { /* fallback */ }

    if (!message) {
      // Hardcoded fallback
      const subDeptLine = subDepartmentName && subDepartmentName !== 'N/A'
        ? `\n🏢 *Sub-Dept:* ${subDepartmentName}` : '';
      message =
        `*${company.name}*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📋 *GRIEVANCE STATUS UPDATE*\n\n` +
        `Respected ${data.citizenName},\n\n` +
        `Your grievance status has been updated.\n\n` +
        `*Details:*\n` +
        `🎫 *Ref No:* \`${data.grievanceId}\`\n` +
        `🏢 *Department:* ${departmentName}${subDeptLine}\n` +
        `📊 *New Status:* ${statusLabel}${remarksText}\n\n` +
        `You will receive further updates via WhatsApp.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `*${company.name}*\n` +
        `Digital Grievance Redressal System`;
    }

    const result = await safeSendWhatsApp(company, data.citizenWhatsApp || data.citizenPhone, message);
    if (result.success) {
      logger.info(`✅ Grievance status notification sent to ${data.citizenName} (${data.citizenPhone})`);
    } else {
      logger.error(`❌ Failed to send grievance status notification: ${result.error}`);
    }
  } catch (error) {
    logger.error('❌ notifyCitizenOnGrievanceStatusChange failed:', error);
  }
}

/* ------------------------------------------------------------------ */
/* Hierarchy Notification                                              */
/* ------------------------------------------------------------------ */

export async function notifyHierarchyOnStatusChange(
  data: NotificationData,
  oldStatus: string,
  newStatus: string
): Promise<void> {
  try {
    const company = await getCompanyWithWhatsAppConfig(data.companyId);
    if (!company) return;

    // All name lookups, date formatting, and resolution time done centrally
    const fullData = await populateNotificationData(data);

    // Find ALL relevant admins interested in the status change
    const admins = await getHierarchicalDepartmentAdmins(data.departmentId);
    const adminIds = admins.map(a => a._id.toString());

    const users = await User.find({
      $or: [
        { role: UserRole.COMPANY_ADMIN, companyId: data.companyId },
        { _id: { $in: adminIds } },
        { _id: data.assignedTo }
      ],
      isActive: true
    });

    // 📱 WhatsApp — use DB template first, then fallback
    let hierarchyMessage = await getNotificationWhatsAppMessage(data.companyId, data.type, 'resolved', fullData);
    if (!hierarchyMessage) {
      const typeLabel = data.type === 'grievance' ? 'GRIEVANCE' : 'APPOINTMENT';
      const deptLine = fullData.subDepartmentName && fullData.subDepartmentName !== 'N/A'
        ? `🏢 *Department:* ${fullData.departmentName}\n🏢 *Sub-Dept:* ${fullData.subDepartmentName}`
        : `🏢 *Department:* ${fullData.departmentName}`;
      const remarksText = data.remarks ? `\n\n*Officer's Remarks:*\n${data.remarks}\n` : '';
      const resolutionTimeLine = fullData.resolutionTimeText ? `\n⏱️ *Resolution Time:* ${fullData.resolutionTimeText}` : '';

      hierarchyMessage =
        `*${fullData.companyName}*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📊 *STATUS UPDATE - ${typeLabel} RESOLVED*\n\n` +
        `Sir/Madam,\n\n` +
        `The following ${data.type} has been resolved by the assigned officer.\n\n` +
        `🎫 *ID:* ${fullData.grievanceId || fullData.appointmentId}\n` +
        `👤 *Citizen:* ${fullData.citizenName}\n` +
        `${deptLine}\n` +
        `📊 *Status Change:* ${oldStatus} → ${newStatus}\n` +
        `👨‍💼 *Resolved By:* ${fullData.resolvedByName}\n` +
        `📅 *Resolved On:* ${fullData.formattedResolvedDate}${resolutionTimeLine}${remarksText}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Digital Grievance Redressal System`;
    }

    for (const user of users) {
      await safeSendWhatsApp(company, user.phone, hierarchyMessage);

      if (user.email) {
        try {
          const emailPayload = {
            ...fullData,
            recipientName: user.getFullName(),
            appointmentDate: (data as any).appointmentDate,
            appointmentTime: (data as any).appointmentTime
          };
          const email = await getNotificationEmailContent(data.companyId, data.type, 'resolved', emailPayload);
          const result = await sendEmail(user.email, email.subject, email.html, email.text, { companyId: data.companyId });
          if (result.success) {
            logger.info(`✅ Email sent to ${user.getFullName()} (${user.email})`);
          } else {
            logger.error(`❌ Failed to send email to ${user.email}:`, result.error);
          }
        } catch (error) {
          logger.error(`❌ Error sending email to ${user.email}:`, error);
        }
      }
    }

  } catch (error) {
    logger.error('❌ notifyHierarchyOnStatusChange failed:', error);
  }
}

/* ------------------------------------------------------------------ */
/* Appointment Status Change Notification                             */
/* ------------------------------------------------------------------ */

export async function notifyCitizenOnAppointmentStatusChange(data: {
  appointmentId: string;
  citizenName: string;
  citizenPhone: string;
  citizenWhatsApp?: string;
  companyId: any;
  oldStatus: string;
  newStatus: string;
  remarks?: string;
  appointmentDate: Date;
  appointmentTime: string;
  purpose?: string;
}): Promise<void> {
  try {
    const company = await getCompanyWithWhatsAppConfig(data.companyId);
    if (!company) {
      logger.warn('Company not found for appointment status notification');
      return;
    }

    const { AppointmentStatus } = await import('../config/constants');

    const appointmentDate = new Date(data.appointmentDate);
    const dateDisplay = appointmentDate.toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const formatTime12Hr = (time: string) => {
      const [hours, minutes] = time.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${String(minutes || 0).padStart(2, '0')} ${period}`;
    };
    const timeDisplay = formatTime12Hr(data.appointmentTime);
    const remarksText = data.remarks ? `\n\n📝 *Remarks:*\n${data.remarks}` : '';

    // Try DB template for this status event
    const statusKey =
      data.newStatus === AppointmentStatus.SCHEDULED  ? 'appointment_scheduled'  :
      data.newStatus === AppointmentStatus.CONFIRMED  ? 'appointment_confirmed'  :
      data.newStatus === AppointmentStatus.CANCELLED  ? 'appointment_cancelled'  :
      data.newStatus === AppointmentStatus.COMPLETED  ? 'appointment_completed'  : null;

    const templateData: Record<string, any> = {
      companyName: company.name,
      citizenName: data.citizenName,
      citizenPhone: data.citizenPhone,
      appointmentId: data.appointmentId,
      appointmentDate: dateDisplay,
      appointmentTime: timeDisplay,
      purpose: data.purpose || 'Meeting with CEO',
      newStatus: data.newStatus,
      remarks: data.remarks || '',
    };

    let message: string | null = null;

    if (statusKey) {
      try {
        const { default: CompanyWhatsAppTemplate } = await import('../models/CompanyWhatsAppTemplate');
        const { replacePlaceholders } = await import('./emailService');
        const cid = mongoose.Types.ObjectId.isValid(String(data.companyId))
          ? new mongoose.Types.ObjectId(String(data.companyId))
          : data.companyId;
        const tmpl = await CompanyWhatsAppTemplate.findOne({
          companyId: cid,
          templateKey: statusKey,
          isActive: true
        });
        if (tmpl && tmpl.message && tmpl.message.trim()) {
          message = replacePlaceholders(tmpl.message.trim(), templateData);
        }
      } catch (e) { /* fallback */ }
    }

    if (!message) {
      // Hardcoded fallback — keeps same content as before but is only used when no DB template exists
      if (data.newStatus === AppointmentStatus.SCHEDULED) {
        message =
          `*${company.name}*\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `📅 *APPOINTMENT SCHEDULED*\n\n` +
          `Respected ${data.citizenName},\n\n` +
          `Your appointment request has been scheduled.\n\n` +
          `*Appointment Details:*\n` +
          `🎫 *Ref No:* \`${data.appointmentId}\`\n` +
          `👤 *Name:* ${data.citizenName}\n` +
          `📅 *Date:* ${dateDisplay}\n` +
          `⏰ *Time:* ${timeDisplay}\n` +
          `🎯 *Purpose:* ${data.purpose || 'Meeting with CEO'}\n` +
          `📊 *Status:* SCHEDULED${remarksText}\n\n` +
          `Please wait for confirmation.\n\n` +
          `Thank you for using our services.\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `*${company.name}*\n` +
          `Digital Appointment System`;

      } else if (data.newStatus === AppointmentStatus.CONFIRMED) {
        message =
          `*${company.name}*\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `✅ *APPOINTMENT CONFIRMED*\n\n` +
          `Respected ${data.citizenName},\n\n` +
          `Your appointment has been confirmed and is ready.\n\n` +
          `*Appointment Details:*\n` +
          `🎫 *Ref No:* \`${data.appointmentId}\`\n` +
          `👤 *Name:* ${data.citizenName}\n` +
          `📅 *Date:* ${dateDisplay}\n` +
          `⏰ *Time:* ${timeDisplay}\n` +
          `🎯 *Purpose:* ${data.purpose || 'Meeting with CEO'}\n` +
          `📊 *Status:* CONFIRMED${remarksText}\n\n` +
          `Please arrive 15 minutes early with valid ID.\n\n` +
          `Thank you for using our services.\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `*${company.name}*\n` +
          `Digital Appointment System`;

      } else if (data.newStatus === AppointmentStatus.CANCELLED) {
        message =
          `*${company.name}*\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `❌ *APPOINTMENT CANCELLED*\n\n` +
          `Respected ${data.citizenName},\n\n` +
          `We regret to inform you that your appointment request has been cancelled.\n\n` +
          `*Appointment Details:*\n` +
          `🎫 *Ref No:* \`${data.appointmentId}\`\n` +
          `📅 *Date:* ${dateDisplay}\n` +
          `⏰ *Time:* ${timeDisplay}\n` +
          `🎯 *Purpose:* ${data.purpose || 'Meeting with CEO'}${remarksText}\n\n` +
          `If you have any questions or would like to reschedule, please contact us.\n\n` +
          `We apologize for any inconvenience caused.\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `*${company.name}*\n` +
          `Digital Appointment System`;

      } else if (data.newStatus === AppointmentStatus.COMPLETED) {
        message =
          `*${company.name}*\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `✅ *APPOINTMENT COMPLETED*\n\n` +
          `Respected ${data.citizenName},\n\n` +
          `Your appointment has been marked as completed.\n\n` +
          `*Appointment Details:*\n` +
          `🎫 *Ref No:* \`${data.appointmentId}\`\n` +
          `📅 *Date:* ${dateDisplay}\n` +
          `⏰ *Time:* ${timeDisplay}${remarksText}\n\n` +
          `Thank you for visiting us. We hope your concern was addressed satisfactorily.\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `*${company.name}*\n` +
          `Digital Appointment System`;
      }
    }

    if (message) {
      const result = await safeSendWhatsApp(company, data.citizenWhatsApp || data.citizenPhone, message);
      if (result.success) {
        logger.info(`✅ Appointment status notification sent to ${data.citizenName}`);
      } else {
        logger.error(`❌ Failed to send appointment status notification: ${result.error}`);
      }
    } else {
      logger.warn(`⚠️ No notification message generated for status: ${data.oldStatus} → ${data.newStatus}`);
    }

  } catch (error) {
    logger.error('❌ notifyCitizenOnAppointmentStatusChange failed:', error);
  }
}
