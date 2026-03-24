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
  action: 'created' | 'assigned' | 'resolved' | 'confirmation' | 'status_change' | 'status_update' | string;
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
  resolvedByName?: string;
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

  // Format Appointment Time as AM/PM
  let formattedAppointmentTime = '';
  if (data.appointmentTime) {
    try {
      // Expecting HH:mm format
      const parts = String(data.appointmentTime).split(':');
      if (parts.length >= 2) {
        let hour = parseInt(parts[0], 10);
        const minute = parts[1].substring(0, 2); // Get first 2 digits for minutes
        const ampm = hour >= 12 ? 'PM' : 'AM';
        hour = hour % 12;
        hour = hour ? hour : 12; // the hour '0' should be '12'
        formattedAppointmentTime = `${hour.toString().padStart(2, '0')}:${minute} ${ampm}`;
      } else {
        formattedAppointmentTime = String(data.appointmentTime);
      }
    } catch (e) {
      formattedAppointmentTime = String(data.appointmentTime);
    }
  }

  return {
    ...data,
    companyName: company?.name || 'Portal Admin',
    recipientName: data.recipientName || data.citizenName || 'Citizen',
    departmentName: department
      ? department.name
      : (data.departmentName || (data.type === 'appointment' ? 'Collector Office' : 'General')),
    subDepartmentName: subDept ? subDept.name : (data.subDepartmentName || ''),
    assignedByName,
    resolvedByName,
    formattedDate,
    formattedResolvedDate,
    formattedAppointmentDate,
    formattedAppointmentTime,
    appointmentDate: formattedAppointmentDate || data.appointmentDate, // Fallback for templates using old field
    appointmentTime: formattedAppointmentTime || data.appointmentTime, // Fallback for templates using old field
    resolutionTimeText,
    'Submitted On': formattedDate,
    submittedOn: formattedDate,
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

function normalizeId(value: any): any {
  if (!value) return value;
  if (typeof value === 'object' && value !== null) {
    return value._id || value.id || value;
  }
  return value;
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
  message: string,
  ctaButton?: { title: string; url: string }
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
    let result;
    if (ctaButton) {
      const { sendWhatsAppCTA } = await import('./whatsappService');
      result = await sendWhatsAppCTA(company, phone, message, ctaButton.title, ctaButton.url);
    } else {
      result = await sendWhatsAppMessage(company, phone, message);
    }

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

      // 🔍 1. Identify roles that represent "Admins" for this department level.
      // We look for roles that either have direct management rights on DEPARTMENTS,
      // or management rights on GRIEVANCE/APPOINTMENT modules.
      const Role = (await import('../models/Role')).default;
      const adminRoles = await Role.find({
        companyId: dept.companyId,
        $or: [
          {
            permissions: {
              $elemMatch: {
                module: { $regex: /^(departments|grievance|appointment)$/i },
                actions: { $in: ['update', 'all', 'manage', 'UPDATE', 'ALL', 'MANAGE', 'status_change', 'assign'] }
              }
            }
          },
          { name: { $regex: /admin|head|manager|supervisor|collector|officer/i } }
        ]
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
          { role: { $regex: /^(SUB_)?DEPARTMENT_ADMIN|COMPANY_ADMIN|ADMIN|HEAD|MANAGER|SUPERVISOR$/i } },
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
    const companyId = normalizeId(data.companyId);
    const company = await getCompanyWithWhatsAppConfig(companyId);
    if (!company) return;

    const adminsToNotify: any[] = [];

    const targetChainId = normalizeId(data.subDepartmentId || data.departmentId);
    if (targetChainId) {
      const deptAdmins = await getHierarchicalDepartmentAdmins(targetChainId);
      deptAdmins.forEach(admin => adminsToNotify.push({ user: admin, type: 'DEPT_ADMIN' }));
    }

    // 1. Identify roles that represent "Company Admins".
    // We broaden this to include roles with SETTINGS/manage permissions,
    // roles with general GRIEVANCE management permissions, or roles explicitly named Admin.
    const Role = (await import('../models/Role')).default;
    const companyAdminRoles = await Role.find({
      companyId,
      $or: [
        {
          permissions: {
            $elemMatch: {
              module: { $regex: /^(settings|grievance|appointment)$/i },
              actions: { $in: ['update', 'all', 'manage', 'UPDATE', 'ALL', 'MANAGE', 'status_change', 'assign'] }
            }
          }
        },
        { key: { $in: ['COMPANY_ADMIN', 'ADMIN', 'COMPANY_HEAD', 'SUPER_ADMIN'] } },
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
      companyId,
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
            const email = await getNotificationEmailContent(companyId, data.type, 'created', notificationData, true);
            if (email) {
              const result = await sendEmail(emailAddress, email.subject, email.html, email.text, { companyId });
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
            let message = await getNotificationWhatsAppMessage(companyId, data.type, 'created', fullData);
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
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `Digital System`;
            }
            await safeSendWhatsApp(company, user.phone, message, {
              title: 'Access Dashboard',
              url: 'https://chatbot-portal-latest-frontend.vercel.app/'
            });
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
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `Digital System`;
      }
      await safeSendWhatsApp(company, user.phone, message, {
        title: 'Access Dashboard',
        url: 'https://chatbot-portal-latest-frontend.vercel.app/'
      });
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
        `📅 *Submitted On:* ${fullData.formattedDate}\n` +
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
    const typeLabel = data.type === 'grievance' ? 'GRIEVANCE' : 'APPOINTMENT';
    const idLabel = data.type === 'grievance' ? 'Grievance ID' : 'Appointment ID';
    const refId = data.grievanceId || data.appointmentId;

    // Check if there's a custom template in the database first
    let message = await getNotificationWhatsAppMessage(data.companyId, data.type, actionKey, fullData);

    if (!message) {
      // ✅ Fallback to Premium Jharsuguda Style
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

    // Use centralized data population (includes formattedDate for "Submitted On")
    const fullData = await populateNotificationData({ ...data, type: 'grievance', action: 'confirmation' });
    
    // Check for custom template in DB: grievance_status_{status}
    const statusKey = `grievance_status_${data.newStatus.toLowerCase()}`;
    const fallbackKey = 'grievance_status_update';
    
    let message = await getNotificationWhatsAppMessage(data.companyId, 'grievance', statusKey, fullData);
    
    if (!message) {
      // Try fallback key
      message = await getNotificationWhatsAppMessage(data.companyId, 'grievance', fallbackKey, fullData);
    }

    if (!message) {
      // Premium Fallback with "Submitted On"
      const statusLabel = data.newStatus.charAt(0) + data.newStatus.slice(1).toLowerCase();
      const title = data.newStatus === 'RESOLVED' ? '✅ GRIEVANCE RESOLVED' : '🔄 GRIEVANCE STATUS UPDATE';
      const intro = data.newStatus === 'RESOLVED' 
        ? 'Great news! Your grievance has been successfully resolved.'
        : `We would like to inform you that the status of your grievance has been updated to *${statusLabel}*.`;

      const subDeptLine = fullData.subDepartmentName && fullData.subDepartmentName !== 'N/A' ? ` / ${fullData.subDepartmentName}` : '';
      const remarksText = data.remarks ? `\n\n📝 *Remarks:* ${data.remarks}` : '';

      message =
        `*${company.name}*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📋 *${title}*\n\n` +
        `Respected ${data.citizenName},\n\n` +
        `${intro}\n\n` +
        `*Details:*\n` +
        `🎫 *Ref No:* \`${data.grievanceId}\`\n` +
        `🏢 *Department:* ${fullData.departmentName}${subDeptLine}\n` +
        `📅 *Submitted On:* ${fullData.formattedDate}\n` +
        `📊 *Status:* ${statusLabel}${remarksText}\n\n` +
        `You will receive further updates via WhatsApp.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `*${company.name}*`;
    }

    await safeSendWhatsApp(company, data.citizenWhatsApp || data.citizenPhone, message);

    if (data.evidenceUrls && data.evidenceUrls.length > 0) {
      await sendMediaIfAvailable(company, data.citizenWhatsApp || data.citizenPhone, data.evidenceUrls, 'Status Update Evidence');
    }

    // 📧 Email
    if (data.citizenEmail) {
      try {
        const emailData = {
          ...fullData,
          action: data.newStatus.toLowerCase()
        };

        let email = await getNotificationEmailContent(data.companyId, 'grievance', statusKey, emailData, false);
        if (!email) {
          email = await getNotificationEmailContent(data.companyId, 'grievance', fallbackKey, emailData, false);
        }

        if (email) {
          await sendEmail(data.citizenEmail, email.subject, email.html, email.text, { companyId: data.companyId });
        }
      } catch (err) {
        logger.error(`❌ Error sending status email to citizen:`, err);
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
    const companyId = normalizeId(data.companyId);
    const company = await getCompanyWithWhatsAppConfig(companyId);
    if (!company) return;

    // All name lookups, date formatting, and resolution time done centrally
    const fullData = await populateNotificationData(data);

    // Find ALL relevant admins interested in the status change
    const hierarchyDepartmentId = normalizeId(data.subDepartmentId || data.departmentId);
    const admins = await getHierarchicalDepartmentAdmins(hierarchyDepartmentId);
    const adminIds = admins.map(a => a._id.toString());

    // 1. Identify roles that represent "Company Admins"
    // We broaden this to include roles with SETTINGS, GRIEVANCE, or APPOINTMENT manage permissions,
    // or roles explicitly named Admin.
    const Role = (await import('../models/Role')).default;
    const companyAdminRoles = await Role.find({
      companyId,
      $or: [
        {
          permissions: {
            $elemMatch: {
              module: { $regex: /^(settings|grievance|appointment)$/i },
              actions: { $in: ['update', 'all', 'manage', 'UPDATE', 'ALL', 'MANAGE', 'status_change', 'assign'] }
            }
          }
        },
        { key: { $in: ['COMPANY_ADMIN', 'ADMIN', 'COMPANY_HEAD', 'SUPER_ADMIN'] } },
        { name: { $regex: /company\s*admin|admin|head|manager|supervisor/i } }
      ]
    }).select('_id name');
    const companyAdminRoleIds = companyAdminRoles.map(r => r._id);
    const companyAdminRoleNames = companyAdminRoles.map(r => r.name);

    // 2. Find ALL relevant admins interested in the status change
    const users = await User.find({
      $or: [
        // Company admins (do not force departmentId:null; many deployments attach admin users to a default department)
        {
          companyId,
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
    
    // Determine if we should use CTA button
    const ctaButton = {
      title: 'Access Dashboard',
      url: 'https://chatbot-portal-latest-frontend.vercel.app/'
    };

    // ✅ CONCURRENT NOTIFICATIONS
    // Filter out the citizen from hierarchy notifications
    const citizenPhoneNormalized = data.citizenWhatsApp?.replace(/\D/g, '') || data.citizenPhone?.replace(/\D/g, '');
    
    await Promise.allSettled(users.filter(u => {
      const userPhoneNormalized = u.phone?.replace(/\D/g, '');
      return userPhoneNormalized !== citizenPhoneNormalized;
    }).map(async (user) => {
      try {
        // Personalize data for each admin recipient
        const userFullData: Record<string, any> = {
          ...fullData,
          recipientName: user.getFullName()
        };

        // 📱 WhatsApp — Get message for this specific user to ensure correct personalization
        let hierarchyMessage = await getNotificationWhatsAppMessage(companyId, data.type, statusAction as any, userFullData);
        if (!hierarchyMessage && (newStatus === 'RESOLVED' || newStatus === 'COMPLETED')) {
          hierarchyMessage = await getNotificationWhatsAppMessage(companyId, data.type, 'resolved', userFullData);
        }

        if (!hierarchyMessage) {
          const typeLabel = data.type === 'grievance' ? 'GRIEVANCE' : 'APPOINTMENT';
          // Only show sub-dept if it's meaningful
          const hasSubDept = userFullData.subDepartmentName && 
                            userFullData.subDepartmentName !== 'N/A' && 
                            userFullData.subDepartmentName !== '' && 
                            userFullData.subDepartmentName !== 'null';

          const deptLine = hasSubDept
            ? `🏢 *Department:* ${userFullData.departmentName}\n🏢 *Sub-Dept:* ${userFullData.subDepartmentName}`
            : `🏢 *Department:* ${userFullData.departmentName}`;
          
          const remarksText = data.remarks ? `\n\n*Officer's Remarks:*\n${data.remarks}` : '';
          const resolutionTimeLine = userFullData.resolutionTimeText ? `\n⏱️ *Resolution Time:* ${userFullData.resolutionTimeText}` : '';
          const evidenceText = data.evidenceUrls && data.evidenceUrls.length > 0
            ? `\n\n📎 *Support Documents (tap to open):*\n${data.evidenceUrls.map((u: string, i: number) => `📄 Download Document ${i + 1}: ${u}`).join('\n')}`
            : '';

          hierarchyMessage =
            `*${userFullData.companyName}*\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `📊 *STATUS UPDATE - ${typeLabel} ${newStatus}*\n\n` +
            `Sir/Madam,\n\n` +
            `The following ${data.type} status has been updated.\n\n` +
            `🎫 *ID:* ${userFullData.grievanceId || userFullData.appointmentId}\n` +
            `👤 *Citizen:* ${userFullData.citizenName}\n` +
            `${deptLine}\n` +
            `📊 *Status Change:* ${oldStatus} → ${newStatus}\n` +
            `👨‍💼 *Updated By:* ${userFullData.resolvedByName || 'Administrator'}\n` +
            `📅 *Updated On:* ${userFullData.formattedResolvedDate || userFullData.formattedDate}${resolutionTimeLine}${remarksText}${evidenceText}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `Digital System`;
        }

        const tasks: Promise<any>[] = [];

        // 📱 WhatsApp
        if (canNotify(company, user, 'whatsapp')) {
          tasks.push(safeSendWhatsApp(company, user.phone, hierarchyMessage, ctaButton));
          if (data.evidenceUrls && data.evidenceUrls.length > 0) {
            tasks.push(sendMediaIfAvailable(company, user.phone, data.evidenceUrls, `Hierarchy Update: ${userFullData.grievanceId || userFullData.appointmentId}`));
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
            
            let email = await getNotificationEmailContent(companyId, data.type, statusAction as any, emailPayload, true);
            if (!email && (newStatus === 'RESOLVED' || newStatus === 'COMPLETED')) {
               email = await getNotificationEmailContent(companyId, data.type, 'resolved', emailPayload, true);
            }

            if (email) {
              const result = await sendEmail(emailAddress, email.subject, email.html, email.text, { companyId });
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
    if (!company) return;

    // Use centralized data population (includes formattedDate for "Submitted On")
    const fullData = await populateNotificationData({ ...data, type: 'appointment', action: 'confirmation' });
    
    // Check for custom template in DB: appointment_status_{status}
    const statusKey = `appointment_status_${data.newStatus.toLowerCase()}`;
    const fallbackKey = 'appointment_status_update';
    
    let message = await getNotificationWhatsAppMessage(data.companyId, 'appointment', statusKey, fullData);
    
    if (!message) {
      // Try fallback key
      message = await getNotificationWhatsAppMessage(data.companyId, 'appointment', fallbackKey, fullData);
    }

    if (!message) {
      // Fallback
      const statusLabel = data.newStatus.charAt(0) + data.newStatus.slice(1).toLowerCase();
      const title = data.newStatus === 'CONFIRMED' ? '✅ APPOINTMENT CONFIRMED' : '📅 APPOINTMENT STATUS UPDATE';
      const intro = data.newStatus === 'CONFIRMED'
        ? 'Your appointment request has been reviewed and confirmed. Please find the updated schedule below.'
        : `Your appointment request status has been updated to *${statusLabel}*.`;

      const dateStr = fullData.formattedAppointmentDate || 'TBD';
      const timeStr = fullData.formattedAppointmentTime || data.appointmentTime || 'TBD';
      const remarksText = data.remarks ? `\n📝 *Remarks:* ${data.remarks}` : '';

      message =
        `*${company.name}*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📋 *${title}*\n\n` +
        `Respected ${data.citizenName},\n\n` +
        `${intro}\n\n` +
        `*Scheduled Slot:*\n` +
        `📅 *Date:* ${dateStr}\n` +
        `🕒 *Time:* ${timeStr}\n\n` +
        `*Details:*\n` +
        `🎫 *Ref No:* \`${data.appointmentId}\`\n` +
        `📅 *Submitted On:* ${fullData.formattedDate}\n` +
        `📊 *Status:* ${statusLabel}${remarksText}\n\n` +
        `You will receive further updates here.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `*${company.name}*`;
    }

    await safeSendWhatsApp(company, data.citizenWhatsApp || data.citizenPhone, message);

    // 📧 Email
    if (data.citizenEmail) {
      try {
        const emailData = {
          ...fullData,
          action: data.newStatus.toLowerCase()
        };

        let email = await getNotificationEmailContent(data.companyId, 'appointment', statusKey, emailData, false);
        if (!email) {
          email = await getNotificationEmailContent(data.companyId, 'appointment', fallbackKey, emailData, false);
        }

        if (email) {
          await sendEmail(data.citizenEmail, email.subject, email.html, email.text, { companyId: data.companyId });
        }
      } catch (err) {
        logger.error(`❌ Error sending status email to citizen:`, err);
      }
    }
  } catch (error) {
    logger.error('❌ notifyCitizenOnAppointmentStatusChange failed:', error);
  }
}

