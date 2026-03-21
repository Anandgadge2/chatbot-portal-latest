import mongoose from 'mongoose';
import Company from '../models/Company';
import CompanyWhatsAppConfig from '../models/CompanyWhatsAppConfig';
import Department from '../models/Department';
import User from '../models/User';
import { sendEmail, getNotificationEmailContent, getNotificationWhatsAppMessage } from './emailService';
import { sendWhatsAppMessage, sendWhatsAppMedia } from './whatsappService';
import { logger } from '../config/logger';
import { UserRole } from '../config/constants';

/**
 * Notification Service
 * Handles email and WhatsApp notifications for grievances and appointments
 */

interface NotificationData {
  type: 'grievance' | 'appointment';
  action: 'created' | 'assigned' | 'resolved' | 'confirmation';
  grievanceId?: string;
  appointmentId?: string;
  recipientName?: string;
  citizenName: string;
  citizenPhone: string;
  citizenWhatsApp?: string;
  citizenEmail?: string;
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

  const formatFn = (d: Date) => {
    try {
      const formatter = new Intl.DateTimeFormat('en-IN', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
        timeZone: 'Asia/Kolkata'
      });
      const parts = formatter.formatToParts(d);
      const p: Record<string, string> = {};
      parts.forEach(part => { p[part.type] = part.value; });
      return `${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute}:${p.second} ${p.dayPeriod || p.ampm || ''}`.trim().replace(/\s+/g, ' ');
    } catch (e) {
      return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    }
  };

  const createdAt = data.createdAt || new Date();
  const formattedDate = formatFn(new Date(createdAt));

  const resolvedAt = data.resolvedAt || (data.action === 'resolved' ? new Date() : null);
  let formattedResolvedDate = '';
  let resolutionTimeText = data.resolutionTimeText || '';

  if (resolvedAt) {
    formattedResolvedDate = formatFn(new Date(resolvedAt));
    if (!resolutionTimeText) {
      resolutionTimeText = computeResolutionTime(data.createdAt, resolvedAt);
    }
  }

  // Format Appointment Date if present
  let formattedAppointmentDate = '';
  if (data.appointmentDate) {
    try {
      const d = data.appointmentDate instanceof Date ? data.appointmentDate : new Date(data.appointmentDate);
      if (!isNaN(d.getTime())) {
        formattedAppointmentDate = d.toLocaleDateString('en-IN', {
          day: '2-digit', month: 'long', year: 'numeric',
          timeZone: 'Asia/Kolkata'
        });
      }
    } catch (e) {
      formattedAppointmentDate = String(data.appointmentDate);
    }
  }

  return {
    ...data,
    companyName: company?.name || 'Portal Admin',
    recipientName: data.recipientName || data.citizenName || 'Citizen',
    departmentName: department
      ? department.name
      : (data.departmentName || (data.type === 'appointment' ? 'Collector Office' : 'General')),
    subDepartmentName: subDept ? subDept.name : (data.subDepartmentName || 'N/A'),
    assignedByName,
    resolvedByName,
    formattedDate,
    formattedResolvedDate,
    formattedAppointmentDate,
    appointmentDate: formattedAppointmentDate || data.appointmentDate, // Fallback for templates using old field
    resolutionTimeText,
    forest_range: (data as any).forest_range || '',
    forest_beat: (data as any).forest_beat || '',
    forest_compartment: (data as any).forest_compartment || '',
    remarks: data.remarks || '' // Ensure it's at least an empty string for replacePlaceholders
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

/**
 * Checks if a notification type (email or whatsapp) is enabled for a specific role in a company.
 * Defaults to true if settings are missing.
 */
function canNotify(company: any, user: any, type: 'email' | 'whatsapp'): boolean {
  // 1. Individual User Setting (Highest Priority Override)
  if (user?.notificationSettings && typeof (user.notificationSettings as any)[type] === 'boolean') {
    return (user.notificationSettings as any)[type];
  }

  // 2. Role Based Setting (from the Populated customRoleId if available)
  const populatedRole = user?.customRoleId;
  if (
    populatedRole && 
    typeof populatedRole === 'object' && 
    populatedRole.notificationSettings && 
    typeof populatedRole.notificationSettings[type] === 'boolean'
  ) {
    return populatedRole.notificationSettings[type];
  }

  // 3. Company Default / Legacy Role Map
  const role = user?.role;
  if (!role) return true; 
  if (!company?.notificationSettings?.roles) return true;

  const rolesMap = company.notificationSettings.roles;
  let roleSettings;

  if (typeof rolesMap.get === 'function') {
    roleSettings = rolesMap.get(role);
  } else {
    roleSettings = rolesMap[role];
  }

  if (!roleSettings) return true;
  return roleSettings[type] !== false;
}

function normalizePhone(phone?: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length >= 11) return digits;
  return null;
}

/**
 * Shared helper to send multiple media URLs to a recipient
 */
async function sendMediaIfAvailable(company: any, to: string, urls?: string[], caption?: string) {
  if (!urls || urls.length === 0) return;
  
  const normalizedTo = normalizePhone(to);
  if (!normalizedTo) return;

  for (const url of urls) {
    try {
      // Basic type detection based on extension
      const ext = url.split('.').pop()?.toLowerCase() || '';
      const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(ext);
      const isVideo = ['mp4', 'mov', 'avi'].includes(ext);
      const isAudio = ['mp3', 'wav', 'ogg', 'm4a'].includes(ext);
      
      let type: 'image' | 'document' | 'video' | 'audio' = 'document';
      if (isImage) type = 'image';
      else if (isVideo) type = 'video';
      else if (isAudio) type = 'audio';

      await sendWhatsAppMedia(company, normalizedTo, url, type, caption || 'Attachment');
    } catch (err) {
      logger.error('❌ Error sending media attachment:', err);
    }
  }
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
/**
 * Robustly find admins for a department or its parents up the hierarchy.
 * Useful for auto-assignment and escalation.
 */
export async function getHierarchicalDepartmentAdmins(departmentId: any): Promise<any[]> {
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

      // 🔍 1. Find Roles with Department Management Permissions
      const Role = (await import('../models/Role')).default;
      const adminRoles = await Role.find({
        companyId: dept.companyId,
        permissions: {
          $elemMatch: {
            module: { $regex: /^departments$/i },
            actions: { $in: ['update', 'all', 'manage', 'UPDATE', 'ALL', 'MANAGE'] }
          }
        }
      }).select('_id name');
      
      const adminRoleIds = adminRoles.map(r => r._id);
      const adminRoleNames = adminRoles.map(r => r.name);

      // Standardize role names for fallback (Sub Department Admin -> SUB_DEPARTMENT_ADMIN)
      const adminRoleNamesRegex = adminRoleNames.map(name => {
        const pattern = name.trim().replace(/[ _]/g, '[ _]');
        return new RegExp(`^${pattern}$`, 'i');
      });

      // 🔍 2. Build Query for Admins at this level
      const adminQuery: any = {
        departmentId: new mongoose.Types.ObjectId(currentIdStr),
        isActive: true,
        $or: [
          { customRoleId: { $in: adminRoleIds } },
          { role: { $in: adminRoleNamesRegex } },
          { role: { $in: adminRoleNames } },
          // 🛡️ HARDCODED FALLBACKS for standard nomenclature
          { role: { $regex: /^(SUB_)?DEPARTMENT_ADMIN|COMPANY_ADMIN$/i } },
          { role: 'SUB_DEPARTMENT_ADMIN' },
          { role: 'DEPARTMENT_ADMIN' }
        ]
      };

      const levelAdmins = await User.find(adminQuery).populate('customRoleId');
      
      if (levelAdmins.length === 0) {
        logger.info(`ℹ️ No admins found directly in ${dept.name} (${currentIdStr}). Checking parent...`);
      } else {
        logger.info(`✅ Found ${levelAdmins.length} potential admins in ${dept.name}`);
      }

      // 🔍 3. Sort Admins: Prioritize "Head", "Chief", "HOD", "Dist" in designation/role
      levelAdmins.sort((a, b) => {
        const headTerms = /head|chief|hod|manager|collector|dist|registrar/i;
        const isAHead = headTerms.test(a.designation || '') || headTerms.test(a.role || '');
        const isBHead = headTerms.test(b.designation || '') || headTerms.test(b.role || '');
        
        if (isAHead && !isBHead) return -1;
        if (!isAHead && isBHead) return 1;
        return 0;
      });

      for (const admin of levelAdmins) {
        if (!admins.find(a => a._id.toString() === admin._id.toString())) {
          admins.push(admin);
        }
      }

      // Move up the hierarchy
      currentDeptId = dept.parentDepartmentId;
    }

    if (admins.length === 0) {
      logger.warn(`⚠️ Hierarchical admin lookup total FAILURE for department ID: ${departmentId}`);
    } else {
      logger.info(`🎯 Hierarchical admin lookup successful: Found ${admins.length} total across chain.`);
    }

    return admins;
  } catch (error) {
    logger.error('❌ Error in getHierarchicalDepartmentAdmins:', error);
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

    const targetChainId = data.subDepartmentId || data.departmentId;
    if (targetChainId) {
      const deptAdmins = await getHierarchicalDepartmentAdmins(targetChainId);
      deptAdmins.forEach(admin => adminsToNotify.push({ user: admin, type: 'DEPT_ADMIN' }));
    }

    // 1. Identify roles that represent "Company Admins".
    // Keep the permission-based lookup, but do not rely on it exclusively because
    // many deployments use custom role names without SETTINGS/manage action mapping.
    const Role = (await import('../models/Role')).default;
    const companyAdminRoles = await Role.find({
      companyId: data.companyId,
      $or: [
        {
          permissions: {
            $elemMatch: {
              module: { $regex: /^settings$/i },
              actions: { $in: ['update', 'all', 'manage', 'UPDATE', 'ALL', 'MANAGE'] }
            }
          }
        },
        { key: { $in: ['COMPANY_ADMIN', 'ADMIN', 'COMPANY_HEAD'] } },
        { name: { $regex: /company\s*admin|admin|head|manager|supervisor/i } }
      ]
    }).select('_id name');
    const companyAdminRoleIds = companyAdminRoles.map(r => r._id);
    const companyAdminRoleNames = companyAdminRoles.map(r => r.name);

    const fallbackAdminRoleNames = [
      'Admin',
      'COMPANY_ADMIN',
      'COMPANY_HEAD',
      'HEAD',
      'MANAGER',
      'SUPERVISOR'
    ];

    // 2. Find company admins using both permission-mapped roles and role-name fallbacks.
    // Do NOT force departmentId:null; in many setups the company admin may be attached
    // to a default department but should still receive company-level notifications.
    const companyAdmins = await User.find({
      companyId: data.companyId,
      $or: [
        ...(companyAdminRoleIds.length > 0 ? [{ customRoleId: { $in: companyAdminRoleIds } }] : []),
        ...(companyAdminRoleNames.length > 0 ? [{ role: { $in: companyAdminRoleNames } }] : []),
        { role: { $in: fallbackAdminRoleNames } },
        { role: { $regex: /admin|head|manager|supervisor/i } }
      ],
      isActive: true
    }).populate('customRoleId');

    companyAdmins.forEach(admin => {
      if (!adminsToNotify.find(a => a.user._id.toString() === admin._id.toString())) {
        adminsToNotify.push({ user: admin, type: 'COMPANY_ADMIN' });
      }
    });

    if (adminsToNotify.length === 0) {
      logger.warn(`⚠️ No admins found to notify for company ${company.name} (${data.grievanceId || data.appointmentId})`);
      return;
    }

    // ✅ CONCURRENT NOTIFICATIONS
    // Run all admin notifications in parallel to prevent Vercel 30s timeout
    await Promise.allSettled(adminsToNotify.map(async ({ user, type }) => {
      try {
        const notificationData: NotificationData = {
          ...data,
          recipientName: user.getFullName()
        };

        const notificationTasks: Promise<any>[] = [];

        // 📧 Email
        const emailAddress = user.email;
        if (emailAddress && canNotify(company, user, 'email')) {
          const emailTask = (async () => {
            const email = await getNotificationEmailContent(data.companyId, data.type, 'created', notificationData, true);
            if (email) {
              const result = await sendEmail(emailAddress, email.subject, email.html, email.text, { companyId: data.companyId });
              if (result.success) {
                logger.info(`✅ Email sent to ${type} ${user.getFullName()} (${emailAddress})`);
              }
            }
          })();
          notificationTasks.push(emailTask);
        }

        // 📱 WhatsApp
        if (canNotify(company, user, 'whatsapp')) {
          const whatsappTask = (async () => {
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
                `Details:\n` +
                `🎫 *Reference ID:* ${fullData.grievanceId || fullData.appointmentId}\n` +
                `👤 *Citizen Name:* ${fullData.citizenName}\n` +
                `📞 *Contact Number:* ${fullData.citizenPhone}\n` +
                `${deptLine}\n` +
                `📝 *Description:*\n${fullData.description || fullData.purpose || ''}${categoryText}` +
                `\n📅 *Received On:* ${fullData.formattedDate}\n\n` +
                `*Action Required:*\n` +
                `Please review this ${data.type} promptly. Resolution should be provided as per SLA.\n\n` +
                `🔗 *Access Dashboard:* https://chatbot-portal-latest-frontend.vercel.app/\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `*${fullData.companyName}*\n` +
                `Digital Grievance Redressal System\n` +
                `This is an automated notification.`;
            }
            await safeSendWhatsApp(company, user.phone, message);
            // Send attachments if any
            if (data.evidenceUrls && data.evidenceUrls.length > 0) {
              await sendMediaIfAvailable(company, user.phone, data.evidenceUrls, `Evidence for ${fullData.grievanceId || fullData.appointmentId}`);
            }
          })();
          notificationTasks.push(whatsappTask);
        }

        await Promise.allSettled(notificationTasks);
      } catch (err) {
        logger.error(`❌ Error in admin notification block for ${user?.email}:`, err);
      }
    }));

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
    if (user.email && canNotify(company, user, 'email')) {
      try {
        const email = await getNotificationEmailContent(data.companyId, data.type, 'assigned', fullData, true);
        if (email) {
          await sendEmail(user.email, email.subject, email.html, email.text, { companyId: data.companyId });
        }
      } catch (e) {}
    }

    // 📱 WhatsApp — use DB template first, then fallback
    if (canNotify(company, user, 'whatsapp')) {
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
          `🔗 *Access Dashboard:* https://chatbot-portal-latest-frontend.vercel.app/\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `*${fullData.companyName}*\n` +
          `Digital Grievance Redressal System`;
      }
      await safeSendWhatsApp(company, user.phone, message);
      if (data.evidenceUrls && data.evidenceUrls.length > 0) {
        await sendMediaIfAvailable(company, user.phone, data.evidenceUrls, `Files for Assignment: ${fullData.grievanceId || fullData.appointmentId}`);
      }
    }

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
        if (email) {
          const result = await sendEmail((data as any).citizenEmail, email.subject, email.html, email.text, { companyId: data.companyId });
          if (result.success) {
            logger.info(`✅ Email sent to citizen ${data.citizenName} (${(data as any).citizenEmail})`);
          }
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
      const evidenceText = data.evidenceUrls && data.evidenceUrls.length > 0
        ? `\n\n📎 *Support Documents (tap to open):*\n${data.evidenceUrls.map((u, i) => `📄 Download Document ${i + 1}: ${u}`).join('\n')}\n`
        : '';
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
        `📅 *Resolved On:* ${fullData.formattedResolvedDate}${resolutionTimeLine}${remarksText}${evidenceText}\n\n` +
        `Thank you for using our digital portal.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `*${fullData.companyName}*\n` +
        `Digital Grievance Redressal System\n` +
        `This is an automated notification.`;
    }
    await safeSendWhatsApp(company, data.citizenWhatsApp || data.citizenPhone, message);
    if (data.evidenceUrls && data.evidenceUrls.length > 0) {
      await sendMediaIfAvailable(company, data.citizenWhatsApp || data.citizenPhone, data.evidenceUrls, 'Resolution Support Documents');
    }

  } catch (error) {
    logger.error('❌ notifyCitizenOnResolution failed:', error);
  }
}

/* ------------------------------------------------------------------ */
/* Citizen Confirmation Notification                                   */
/* ------------------------------------------------------------------ */

export async function notifyCitizenOnCreation(
  data: NotificationData
): Promise<void> {
  try {
    const company = await getCompanyWithWhatsAppConfig(data.companyId);
    if (!company) return;

    const fullData = await populateNotificationData(data);

    // 📧 Email
    if (data.citizenEmail) {
      try {
        const email = await getNotificationEmailContent(data.companyId, data.type, 'confirmation', fullData, false);
        if (email) {
          await sendEmail(data.citizenEmail, email.subject, email.html, email.text, { companyId: data.companyId });
          logger.info(`✅ Confirmation email sent to citizen: ${data.citizenEmail}`);
        }
      } catch (e) {
        logger.error('❌ Error sending confirmation email to citizen:', e);
      }
    }

    // 📱 WhatsApp
    const actionKey = data.action || 'confirmation';
    let message = await getNotificationWhatsAppMessage(data.companyId, data.type, actionKey, fullData);
    if (!message) {
      const typeLabel = data.type === 'grievance' ? 'GRIEVANCE' : 'APPOINTMENT';
      const idLabel = data.type === 'grievance' ? 'Grievance ID' : 'Appointment ID';
      const refId = data.grievanceId || data.appointmentId;
      
      message =
        `*${fullData.companyName}*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `✅ *${typeLabel} SUBMITTED*\n\n` +
        `Respected ${fullData.citizenName},\n\n` +
        `Thank you for reaching out. Your ${data.type} has been successfully registered.\n\n` +
        `*Details:*\n` +
        `🎫 *${idLabel}:* ${refId}\n` +
        `🏢 *Department:* ${fullData.departmentName}\n` +
        `📅 *Submitted On:* ${fullData.formattedDate}\n\n` +
        `Please keep your Reference ID *${refId}* for future tracking.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `*${fullData.companyName}*\n` +
        `Digital Portal`;
    }
    await safeSendWhatsApp(company, data.citizenWhatsApp || data.citizenPhone, message);
    if (data.evidenceUrls && data.evidenceUrls.length > 0) {
      await sendMediaIfAvailable(company, data.citizenWhatsApp || data.citizenPhone, data.evidenceUrls, 'Submission Evidence');
    }

  } catch (error) {
    logger.error('❌ notifyCitizenOnCreation failed:', error);
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
  citizenEmail?: string;
  departmentId?: any;
  subDepartmentId?: any;
  departmentName?: string;
  subDepartmentName?: string;
  newStatus: string;
  remarks?: string;
  evidenceUrls?: string[];
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
    const evidenceText = data.evidenceUrls && data.evidenceUrls.length > 0
      ? `\n\n📎 *Support Documents (tap to open):*\n${data.evidenceUrls.map((u, i) => `📄 Download Document ${i + 1}: ${u}`).join('\n')}`
      : '';
    const statusLabel =
      data.newStatus === 'ASSIGNED' ? 'Assigned' :
      data.newStatus === 'REJECTED' ? 'Rejected' :
      data.newStatus === 'PENDING'  ? 'Pending'  : data.newStatus;

    // Try DB template for status_update key first (custom key for grievance status changes)
    const templateData: Record<string, any> = {
      companyName: company.name,
      citizenName: data.citizenName,
      recipientName: data.citizenName, // Ensure compatibility with admin templates
      citizenPhone: data.citizenPhone,
      grievanceId: data.grievanceId,
      departmentName,
      subDepartmentName: subDepartmentName || 'N/A',
      newStatus: statusLabel,
      remarks: data.remarks || '',
    };

    let message: string | null = null;

    // For citizens, we want to avoid using admin-facing templates like 'grievance_created' or 'grievance_assigned'
    // which often say "New grievance received" or "Assigned to you".
    const statusKey = data.newStatus === 'PENDING' ? 'grievance_confirmation' : `grievance_status_${data.newStatus.toLowerCase()}`;
    const fallbackStatusKey = 'grievance_status_update';
    
    try {
      const { default: CompanyWhatsAppTemplate } = await import('../models/CompanyWhatsAppTemplate');
      const { replacePlaceholders } = await import('./emailService');
      const cid = mongoose.Types.ObjectId.isValid(String(data.companyId))
        ? new mongoose.Types.ObjectId(String(data.companyId))
        : data.companyId;

      // Try specific key first
      let tmpl = await CompanyWhatsAppTemplate.findOne({
        companyId: cid,
        templateKey: statusKey as any,
        isActive: true
      });

      // Try fallback key
      if (!tmpl) {
        tmpl = await CompanyWhatsAppTemplate.findOne({
          companyId: cid,
          templateKey: fallbackStatusKey as any,
          isActive: true
        });
      }

      if (tmpl && tmpl.message && tmpl.message.trim()) {
        message = replacePlaceholders(tmpl.message.trim(), templateData);
        if (evidenceText) {
          message += `${evidenceText}`;
        }
      }
    } catch (e) { /* fallback */ }

    if (!message) {
      // Hardcoded fallback
      const isNew = data.newStatus === 'PENDING' || data.remarks === 'Automatic confirmation on registration';
      const title = isNew ? 'GRIEVANCE REGISTERED' : 'GRIEVANCE STATUS UPDATE';
      const intro = isNew ? 'Your grievance has been successfully registered.' : 'Your grievance status has been updated.';

      const subDeptLine = subDepartmentName && subDepartmentName !== 'N/A'
        ? `\n🏢 *Sub-Dept:* ${subDepartmentName}` : '';
      message =
        `*${company.name}*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📋 *${title}*\n\n` +
        `Respected ${data.citizenName},\n\n` +
        `${intro}\n\n` +
        `*Details:*\n` +
        `🎫 *Ref No:* \`${data.grievanceId}\`\n` +
        `🏢 *Department:* ${departmentName}${subDeptLine}\n` +
        `📊 *Status:* ${statusLabel}${remarksText}${evidenceText}\n\n` +
        `You will receive further updates via WhatsApp.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `*${company.name}*\n` +
        `Digital Grievance Redressal System`;
    }

    const result = await safeSendWhatsApp(company, data.citizenWhatsApp || data.citizenPhone, message);
    if (result.success) {
      logger.info(`✅ Grievance status notification sent to ${data.citizenName} (${data.citizenPhone})`);
      if (data.evidenceUrls && data.evidenceUrls.length > 0) {
        await sendMediaIfAvailable(company, data.citizenWhatsApp || data.citizenPhone, data.evidenceUrls, `Status update: ${statusLabel}`);
      }
    } else {
      logger.error(`❌ Failed to send grievance status notification: ${result.error}`);
    }

    // 📧 Email
    if (data.citizenEmail && canNotify(company, data, 'email')) {
      try {
        const emailData = {
          ...templateData,
          companyName: company.name,
          recipientName: data.citizenName,
          action: data.newStatus.toLowerCase()
        };

        let email = await getNotificationEmailContent(data.companyId, 'grievance', statusKey, emailData, false);
        if (!email && fallbackStatusKey) {
          email = await getNotificationEmailContent(data.companyId, 'grievance', fallbackStatusKey, emailData, false);
        }

        if (email) {
          await sendEmail(data.citizenEmail, email.subject, email.html, email.text, { companyId: data.companyId });
          logger.info(`✅ Grievance status email sent to citizen: ${data.citizenEmail}`);
        }
      } catch (err) {
        logger.error(`❌ Error sending grievance status email to citizen:`, err);
      }
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

    // 1. Identify roles that represent "Company Admins"
    const Role = (await import('../models/Role')).default;
    const companyAdminRoles = await Role.find({
      companyId: data.companyId,
      'permissions.module': 'SETTINGS',
      'permissions.actions': { $in: ['update', 'all', 'manage'] }
    }).select('_id name');
    const companyAdminRoleIds = companyAdminRoles.map(r => r._id);
    const companyAdminRoleNames = companyAdminRoles.map(r => r.name);

    // 2. Find ALL relevant admins interested in the status change
    const users = await User.find({
      $or: [
        // Company admins (do not force departmentId:null; many deployments attach admin users to a default department)
        {
          companyId: data.companyId,
          $or: [
            ...(companyAdminRoleIds.length > 0 ? [{ customRoleId: { $in: companyAdminRoleIds } }] : []),
            ...(companyAdminRoleNames.length > 0 ? [{ role: { $in: companyAdminRoleNames } }] : []),
            { role: { $in: ['Admin', 'COMPANY_ADMIN', 'COMPANY_HEAD', 'HEAD', 'MANAGER', 'SUPERVISOR'] } },
            { role: { $regex: /admin|head|manager|supervisor/i } }
          ]
        },
        // Department hierarchy admins
        { _id: { $in: adminIds } },
        // Specifically assigned user
        { _id: data.assignedTo }
      ],
      isActive: true
    }).populate('customRoleId');

    // Dynamically choose status key based on newStatus
    // e.g., 'confirmed' -> 'appointment_confirmed' or 'grievance_confirmed'
    const statusAction = newStatus.toLowerCase();
    
    // 📱 WhatsApp — use DB template first (try status-specific, then fallback to 'resolved')
    let hierarchyMessage = await getNotificationWhatsAppMessage(data.companyId, data.type, statusAction as any, fullData);
    if (!hierarchyMessage && (newStatus === 'RESOLVED' || newStatus === 'COMPLETED')) {
      hierarchyMessage = await getNotificationWhatsAppMessage(data.companyId, data.type, 'resolved', fullData);
    }
    
    if (!hierarchyMessage) {
      const typeLabel = data.type === 'grievance' ? 'GRIEVANCE' : 'APPOINTMENT';
      const deptLine = fullData.subDepartmentName && fullData.subDepartmentName !== 'N/A'
        ? `🏢 *Department:* ${fullData.departmentName}\n🏢 *Sub-Dept:* ${fullData.subDepartmentName}`
        : `🏢 *Department:* ${fullData.departmentName}`;
      const remarksText = data.remarks ? `\n\n*Officer's Remarks:*\n${data.remarks}` : '';
      const resolutionTimeLine = fullData.resolutionTimeText ? `\n⏱️ *Resolution Time:* ${fullData.resolutionTimeText}` : '';
      const evidenceText = data.evidenceUrls && data.evidenceUrls.length > 0
        ? `\n\n📎 *Support Documents (tap to open):*\n${data.evidenceUrls.map((u: string, i: number) => `📄 Download Document ${i + 1}: ${u}`).join('\n')}`
        : '';

      hierarchyMessage =
        `*${fullData.companyName}*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📊 *STATUS UPDATE - ${typeLabel} ${newStatus}*\n\n` +
        `Sir/Madam,\n\n` +
        `The following ${data.type} status has been updated.\n\n` +
        `🎫 *ID:* ${fullData.grievanceId || fullData.appointmentId}\n` +
        `👤 *Citizen:* ${fullData.citizenName}\n` +
        `${deptLine}\n` +
        `📊 *Status Change:* ${oldStatus} → ${newStatus}\n` +
        `👨‍💼 *Updated By:* ${fullData.resolvedByName || 'Administrator'}\n` +
        `📅 *Updated On:* ${fullData.formattedResolvedDate || fullData.formattedDate}${resolutionTimeLine}${remarksText}${evidenceText}\n\n` +
        `🔗 *Access Dashboard:* https://chatbot-portal-latest-frontend.vercel.app/\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Digital System`;
    }

    // ✅ CONCURRENT NOTIFICATIONS
    await Promise.allSettled(users.map(async (user) => {
      try {
        const tasks: Promise<any>[] = [];

        // 📱 WhatsApp
        if (canNotify(company, user, 'whatsapp')) {
          tasks.push(safeSendWhatsApp(company, user.phone, hierarchyMessage));
          if (data.evidenceUrls && data.evidenceUrls.length > 0) {
            tasks.push(sendMediaIfAvailable(company, user.phone, data.evidenceUrls, `Hierarchy Update: ${fullData.grievanceId || fullData.appointmentId}`));
          }
        }

        // 📧 Email
        const emailAddress = user.email;
        if (emailAddress && canNotify(company, user, 'email')) {
          const emailTask = (async () => {
            const emailPayload = {
              ...fullData,
              recipientName: user.getFullName(),
              appointmentDate: (data as any).appointmentDate,
              appointmentTime: (data as any).appointmentTime,
              newStatus,
              oldStatus
            };
            
            let email = await getNotificationEmailContent(data.companyId, data.type, statusAction as any, emailPayload, true);
            if (!email && (newStatus === 'RESOLVED' || newStatus === 'COMPLETED')) {
               email = await getNotificationEmailContent(data.companyId, data.type, 'resolved', emailPayload, true);
            }

            if (email) {
              const result = await sendEmail(emailAddress, email.subject, email.html, email.text, { companyId: data.companyId });
              if (result.success) {
                logger.info(`✅ Email sent to hierarchy user: ${emailAddress}`);
              }
            }
          })();
          tasks.push(emailTask);
        }

        await Promise.allSettled(tasks);
      } catch (err) {
        logger.error(`❌ Error notifying hierarchy user ${user.email}:`, err);
      }
    }));

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
  citizenEmail?: string;
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
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      timeZone: 'Asia/Kolkata'
    });

    const formatTime12Hr = (time: string) => {
      const [hours, minutes] = time.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${String(minutes || 0).padStart(2, '0')} ${period}`;
    };
    const timeDisplay = formatTime12Hr(data.appointmentTime);
    const remarksText = data.remarks ? `\n📝 *Remarks:*\n${data.remarks}` : '';

    // For citizens, try specific confirmation/update keys first to avoid admin templates
    const statusKey =
      data.newStatus === AppointmentStatus.REQUESTED  ? 'appointment_confirmation' :
      data.newStatus === AppointmentStatus.SCHEDULED  ? 'appointment_scheduled_update' :
      data.newStatus === AppointmentStatus.CONFIRMED  ? 'appointment_confirmed_update' :
      data.newStatus === AppointmentStatus.CANCELLED  ? 'appointment_cancelled_update' :
      data.newStatus === AppointmentStatus.COMPLETED  ? 'appointment_completed_update' : null;

    const fallbackStatusKey = 'appointment_status_update';

    const templateData: Record<string, any> = {
      companyName: company.name,
      citizenName: data.citizenName,
      recipientName: data.citizenName, // For compatibility
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
        let tmpl = await CompanyWhatsAppTemplate.findOne({
          companyId: cid,
          templateKey: statusKey as any,
          isActive: true
        });

        if (!tmpl && fallbackStatusKey) {
          tmpl = await CompanyWhatsAppTemplate.findOne({
            companyId: cid,
            templateKey: fallbackStatusKey as any,
            isActive: true
          });
        }

        if (tmpl && tmpl.message && tmpl.message.trim()) {
          message = replacePlaceholders(tmpl.message.trim(), templateData);
        }
      } catch (e) { /* fallback */ }
    }

    if (!message) {
      // Hardcoded fallback — keeps same content as before but is only used when no DB template exists
      if (data.newStatus === AppointmentStatus.REQUESTED) {
        message =
          `*${company.name}*\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `📋 *APPOINTMENT REQUEST RECEIVED*\n\n` +
          `Respected ${data.citizenName},\n\n` +
          `Your appointment request has been successfully received.\n\n` +
          `*Details:*\n` +
          `🎫 *Ref No:* \`${data.appointmentId}\`\n` +
          `📅 *Preferred Date:* ${dateDisplay}\n` +
          `⏰ *Preferred Time:* ${timeDisplay}\n` +
          `🎯 *Purpose:* ${data.purpose || 'Meeting with CEO'}\n\n` +
          `Our team will review your request and confirm soon.\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `*${company.name}*\n` +
          `Digital Appointment System`;

      } else if (data.newStatus === AppointmentStatus.SCHEDULED) {
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
          `Respected ${data.citizenName},\n` +
          `Your appointment has been confirmed\n\n` +
          `*Appointment Details:*\n` +
          `🎫 *Ref No:* \`${data.appointmentId}\`\n` +
          `👤 *Name:* ${data.citizenName}\n` +
          `📅 *Date:* ${dateDisplay}\n` +
          `⏰ *Time:* ${timeDisplay}\n` +
          `🎯 *Purpose:* ${data.purpose || 'Meeting with collector'}\n` +
          `📊 *Status:* CONFIRMED${remarksText}\n` +
          `Please arrive 15 minutes early with valid ID.\n` +
          `Thank you for using our services.\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `*${company.name}*\n` +
          `Digital Appointment System`;

      } else if (data.newStatus === AppointmentStatus.CANCELLED) {
        message =
          `*${company.name}*\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `❌ *APPOINTMENT CANCELLED*\n\n` +
          `Respected ${data.citizenName},\n` +
          `We regret to inform you that your appointment request has been cancelled.\n` +
          `*Appointment Details:*\n` +
          `🎫 *Ref No:* \`${data.appointmentId}\`\n` +
          `📅 *Date:* ${dateDisplay}\n` +
          `⏰ *Time:* ${timeDisplay}\n` +
          `🎯 *Purpose:* ${data.purpose || 'Meeting with CEO'}${remarksText}\n` +
          `We apologize for any inconvenience caused.\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `*${company.name}*\n` +
          `Digital Appointment System`;

      } else if (data.newStatus === AppointmentStatus.COMPLETED) {
        message =
          `*${company.name}*\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `✅ *APPOINTMENT COMPLETED*\n\n` +
          `Respected ${data.citizenName},\n\n` +
          `Your appointment has been marked as completed.\n` +
          `*Appointment Details:*\n` +
          `🎫 *Ref No:* \`${data.appointmentId}\`\n` +
          `📅 *Date:* ${dateDisplay}\n` +
          `⏰ *Time:* ${timeDisplay}${remarksText}\n` +
          `Thank you for visiting us. We hope your concern was addressed satisfactorily.` +
          `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
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

    // 📧 Email
    if (data.citizenEmail && canNotify(company, data, 'email')) {
      try {
        const emailData = {
          ...templateData,
          action: data.newStatus.toLowerCase()
        };

        let email = await getNotificationEmailContent(data.companyId, 'appointment', statusKey as any, emailData, false);
        if (!email && fallbackStatusKey) {
          email = await getNotificationEmailContent(data.companyId, 'appointment', fallbackStatusKey as any, emailData, false);
        }

        if (email) {
          await sendEmail(data.citizenEmail, email.subject, email.html, email.text, { companyId: data.companyId });
          logger.info(`✅ Appointment status email sent to citizen: ${data.citizenEmail}`);
        }
      } catch (err) {
        logger.error(`❌ Error sending appointment status email to citizen:`, err);
      }
    }
  } catch (error) {
    logger.error('❌ notifyCitizenOnAppointmentStatusChange failed:', error);
  }
}


