import mongoose from 'mongoose';
import Company from '../models/Company';
import CompanyWhatsAppConfig from '../models/CompanyWhatsAppConfig';
import Department from '../models/Department';
import User from '../models/User';
import { sendEmail, getNotificationEmailContent, getNotificationWhatsAppMessage } from './emailService';
import { sendWhatsAppMessage, sendWhatsAppMedia } from './whatsappService';
import { normalizePhoneNumber } from '../utils/phoneUtils';
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
  const company = await findCompanyByIdOrCustomId(data.companyId);

  // Handle populated Mongoose objects — extract _id before calling findById
  const deptId = data.departmentId
    ? (typeof data.departmentId === 'object' && data.departmentId._id ? data.departmentId._id : data.departmentId)
    : null;
  const subDeptId = data.subDepartmentId
    ? (typeof data.subDepartmentId === 'object' && data.subDepartmentId._id ? data.subDepartmentId._id : data.subDepartmentId)
    : null;

  const department = deptId ? await findDepartmentByIdOrCustomId(deptId) : null;
  const subDept = subDeptId ? await findDepartmentByIdOrCustomId(subDeptId) : null;

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
      if (!config.phoneNumberId || !config.accessToken) {
        logger.warn(`⚠️ WhatsApp configuration exists but is incomplete for company ${company.name}`, {
          hasPhoneId: !!config.phoneNumberId,
          hasToken: !!config.accessToken
        });
      }
      (company as any).whatsappConfig = {
        phoneNumberId: config.phoneNumberId,
        accessToken: config.accessToken
      };
      logger.info(`✅ Attached WhatsApp config to company ${company.name}`);
    } else {
      logger.info(`ℹ️ No active WhatsApp config found for company ${company.name}`);
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

/** Robustly find a department by either Mongo _id or custom departmentId string */
async function findDepartmentByIdOrCustomId(id: any): Promise<any | null> {
  if (!id) return null;
  const idStr = id.toString();
  
  // Try ObjectId first if valid
  if (mongoose.Types.ObjectId.isValid(idStr) && idStr.length === 24) {
    const dept = await Department.findById(idStr);
    if (dept) return dept;
  }
  
  // Fallback to custom departmentId string
  return await Department.findOne({ departmentId: idStr });
}

/** Robustly find a company by either Mongo _id or custom companyId string */
async function findCompanyByIdOrCustomId(id: any): Promise<any | null> {
  if (!id) return null;
  const idStr = id.toString();
  
  if (mongoose.Types.ObjectId.isValid(idStr) && idStr.length === 24) {
    const company = await Company.findById(idStr);
    if (company) return company;
  }
  
  return await Company.findOne({ companyId: idStr });
}

/**
 * Checks if a notification type (email or whatsapp) is enabled for a specific role in a company.
 * Defaults to true if settings are missing.
 */
function canNotify(company: any, user: any, type: 'email' | 'whatsapp', action?: string): boolean {
  // 1. Individual User Setting (Highest Priority Override)
  if (user?.notificationSettings) {
    const settings = user.notificationSettings;
    
    // Check granular first if action is provided
    if (action && settings.actions && settings.actions[action]) {
      if (typeof settings.actions[action][type] === 'boolean') {
        return settings.actions[action][type];
      }
    }
    
    // Fallback to global user override
    if (typeof settings[type] === 'boolean') {
      return settings[type];
    }
  }

  // 2. Role Based Setting (from the Populated customRoleId if available)
  const populatedRole = user?.customRoleId;
  if (populatedRole && typeof populatedRole === 'object' && populatedRole.notificationSettings) {
    const rSettings = populatedRole.notificationSettings;

    // Check granular first if action is provided
    if (action && rSettings.actions && rSettings.actions[action]) {
      if (typeof rSettings.actions[action][type] === 'boolean') {
        return rSettings.actions[action][type];
      }
    }

    // Fallback to role global override
    if (typeof rSettings[type] === 'boolean') {
      return rSettings[type];
    }
  }

  // 3. Company Default / Legacy Role Map
  const role = user?.role;
  if (!role) return true; 
  if (!company?.notificationSettings?.roles) return true;

  const rolesMap = company.notificationSettings.roles;
  const roleRaw = String(role || '').trim();
  const roleUpperSnake = roleRaw.replace(/[\s-]+/g, '_').toUpperCase();
  const roleLowerSnake = roleRaw.replace(/[\s-]+/g, '_').toLowerCase();
  const roleCandidates = Array.from(new Set([
    role,
    roleRaw,
    roleRaw.toLowerCase(),
    roleRaw.toUpperCase(),
    roleUpperSnake,
    roleLowerSnake
  ])).filter(Boolean);

  let roleSettings: any;

  if (typeof rolesMap.get === 'function') {
    for (const candidate of roleCandidates) {
      roleSettings = rolesMap.get(candidate as any);
      if (roleSettings) break;
    }
    if (!roleSettings && typeof rolesMap.keys === 'function') {
      for (const key of rolesMap.keys()) {
        const keyNorm = String(key).replace(/[\s-]+/g, '_').toLowerCase();
        if (roleCandidates.some(c => String(c).replace(/[\s-]+/g, '_').toLowerCase() === keyNorm)) {
          roleSettings = rolesMap.get(key as any);
          if (roleSettings) break;
        }
      }
    }
  } else {
    for (const candidate of roleCandidates) {
      roleSettings = rolesMap[candidate as any];
      if (roleSettings) break;
    }
    if (!roleSettings && rolesMap && typeof rolesMap === 'object') {
      for (const [key, value] of Object.entries(rolesMap)) {
        const keyNorm = String(key).replace(/[\s-]+/g, '_').toLowerCase();
        if (roleCandidates.some(c => String(c).replace(/[\s-]+/g, '_').toLowerCase() === keyNorm)) {
          roleSettings = value;
          break;
        }
      }
    }
  }

  if (!roleSettings) return true;

  // Check granular role settings from company record
  if (action && roleSettings.actions && roleSettings.actions[action]) {
    if (typeof roleSettings.actions[action][type] === 'boolean') {
      return roleSettings.actions[action][type];
    }
  }

  return roleSettings[type] !== false;
}

function normalizePhone(phone?: string): string | null {
  if (!phone) return null;
  return normalizePhoneNumber(phone);
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
      logger.info(`✅ [WhatsApp] Sent successfully to ${phone} (${company.name})`, { messageId: result.messageId });
      return { success: true };
    } else {
      logger.error(`❌ [WhatsApp] Send failed to ${phone} (${company.name})`, { error: result.error });
      return { success: false, error: result.error };
    }
  } catch (error: any) {
    logger.error(`❌ [WhatsApp] Send exception for ${phone} (${company.name})`, {
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
 *   1. The sub-department's own admin
 *   2. The parent department's admin
 *   3. All relevant roles across the chain (HOD, Chief, etc.)
 */
export async function getHierarchicalDepartmentAdmins(departmentId: any): Promise<any[]> {
  const admins: any[] = [];
  if (!departmentId) return admins;

  try {
    let currentDeptId = departmentId;
    const processedDeptIds = new Set<string>();

    while (currentDeptId) {
      const dept = await findDepartmentByIdOrCustomId(currentDeptId);
      if (!dept) break;

      const currentIdStr = dept._id.toString();
      if (processedDeptIds.has(currentIdStr)) break;
      processedDeptIds.add(currentIdStr);

      const isSubDept = !!dept.parentDepartmentId;

      // 🔍 1. Identify roles that represent "Admins" for this specific department level.
      const adminQuery: any = {
        companyId: dept.companyId,
        isActive: true,
        $and: [
          {
            $or: [
              { departmentId: new mongoose.Types.ObjectId(currentIdStr) },
              { departmentId: currentIdStr },
              { departmentIds: { $in: [new mongoose.Types.ObjectId(currentIdStr), currentIdStr] } }
            ]
          }
        ]
      };

      // 🔍 2. Build Query for Roles at this level
      // If it's a sub-dept, we specifically want SUB_DEPARTMENT_ADMIN or similar.
      // If it's a parent dept, we want DEPARTMENT_ADMIN or similar.
      // 🏷️ GLOBAL ROLE FIX: Include companyId: null to support system-wide standard roles
      const levelAdminRoles = await (await import('../models/Role')).default.find({
        $or: [
          { companyId: dept.companyId },
          { companyId: null }
        ],
        $and: [
          {
            $or: [
              { key: isSubDept ? 'SUB_DEPARTMENT_ADMIN' : 'DEPARTMENT_ADMIN' },
              { name: { $regex: isSubDept ? /sub[- _]?department[- _]?admin|sub[- _]?admin/i : /department[- _]?admin|dept[- _]?admin/i } },
              { 
                permissions: { 
                  $elemMatch: { 
                    module: { $regex: /grievance|appointment/i },
                    actions: { $in: ['all', 'manage', 'assign', 'status_change'] }
                  }
                } 
              }
            ]
          }
        ]
      }).select('_id name');
      
      const adminRoleIds = levelAdminRoles.map(r => r._id);
      logger.info(`🔍 [Hierarchy] Level: ${dept.name} (${isSubDept ? 'Sub-Dept' : 'Dept'}). Found ${levelAdminRoles.length} matching admin roles.`);

      // Add role filters to user query
      adminQuery.$or = [
        { customRoleId: { $in: adminRoleIds } },
        { role: isSubDept ? /SUB[- _]?DEPARTMENT[- _]?ADMIN/i : /DEPARTMENT[- _]?ADMIN/i }
      ];

      const levelAdmins = await User.find(adminQuery).populate('customRoleId');
      
      if (levelAdmins.length === 0) {
        logger.warn(`⚠️ [Hierarchy] No matching admins found at level: ${dept.name}. Check if users have the correct Department ID and Role.`);
      } else {
        logger.info(`👥 [Hierarchy] Found ${levelAdmins.length} potential admins at ${dept.name} level.`);
      }
      
      levelAdmins.forEach(admin => {
        if (!admins.find(a => a._id.toString() === admin._id.toString())) {
          logger.info(`✅ [Hierarchy] Adding admin recipient: ${admin.getFullName()} (${admin.email || admin.phone})`);
          admins.push(admin);
        }
      });

      // Move up the hierarchy
      currentDeptId = dept.parentDepartmentId;
      if (currentDeptId) {
        logger.info(`🪜 [Hierarchy] Moving up to parent department: ${currentDeptId}`);
      }
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

    // 1. Find Company Admins for top-level supervision
    // 🏷️ GLOBAL ROLE FIX: Find global admin roles first
    const globalAdminRoleIds = await (await import('../models/Role')).default.find({
      companyId: null,
      key: { $in: ['COMPANY_ADMIN', 'ADMIN', 'COMPANY_HEAD', 'SUPER_ADMIN'] }
    }).distinct('_id');

    const companyAdmins = await User.find({
      companyId,
      $or: [
        { role: { $in: ['COMPANY_ADMIN', 'COMPANY_HEAD', 'SUPER_ADMIN', 'Collector', 'DM'] } },
        { role: { $regex: /^company[- _]?(admin|administrator|head)|collector|dm$/i } },
        { designation: { $regex: /collector|dm|magistrate|tahasildar/i } }, // Robust identification for gov roles
        { 
          customRoleId: { 
            $in: [
              ...globalAdminRoleIds,
              ...(await (await import('../models/Role')).default.find({ 
                companyId, 
                key: { $in: ['COMPANY_ADMIN', 'ADMIN', 'COMPANY_HEAD', 'SUPER_ADMIN'] } 
              }).distinct('_id'))
            ]
          } 
        }
      ],
      isActive: true
    }).populate('customRoleId');

    logger.info(`👨‍💼 [Company Admins] Found ${companyAdmins.length} users with high-level roles for company: ${company.name}`);

    companyAdmins.forEach(admin => {
      if (!adminsToNotify.find(a => a.user._id.toString() === admin._id.toString())) {
        logger.info(`✅ [Company Admin] Adding ${admin.getFullName()} (${admin.role}) to notification list.`);
        adminsToNotify.push({ user: admin, type: 'COMPANY_ADMIN' });
      }
    });

    if (adminsToNotify.length === 0) {
      logger.warn(`⚠️ [Broadcasting] No admins found to notify for company ${company.name} (${data.grievanceId || data.appointmentId})`);
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
        if (emailAddress && canNotify(company, user, 'email', `${data.type}_created`)) {
          const emailTask = (async () => {
            const email = await getNotificationEmailContent(companyId, data.type, 'created', notificationData, true);
            if (email) {
              const result = await sendEmail(emailAddress, email.subject, email.html, email.text, { companyId });
              if (result.success) {
                logger.info(`✅ Email sent to ${type} ${user.getFullName()} (${emailAddress})`);
              }
            } else {
              logger.warn(`⚠️ No email content found for admin ${emailAddress} (Action: created)`);
            }
          })();
          notificationTasks.push(emailTask);
        } else {
          logger.info(`ℹ️ Skipping email for admin ${user.email}: emailExists=${!!emailAddress}, canNotify=${canNotify(company, user, 'email', `${data.type}_created`)}`);
        }

        // 📱 WhatsApp
        if (canNotify(company, user, 'whatsapp', `${data.type}_created`)) {
          const whatsappTask = (async () => {
            const fullData = await populateNotificationData(notificationData);
            // 🏷️ ALIGNMENT FIX: Use 'created_admin' to match DEFAULT_WA_MESSAGES
            let message = await getNotificationWhatsAppMessage(companyId, data.type, 'created_admin', fullData);
            
            if (!message) {
              logger.warn(`⚠️ No WhatsApp content found for ${user.email} (Action: created_admin)`);
              return;
            }
            logger.info(`📢 Dispatching WhatsApp to admin: ${user.phone} (${user.getFullName()})`);
            const res = await safeSendWhatsApp(company, user.phone, message, {
              title: 'Access Dashboard',
              url: 'https://chatbot-portal-latest-frontend.vercel.app/'
            });
            if (res.success) {
              logger.info(`✅ WhatsApp sent to admin: ${user.phone}`);
            }
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

    const user = await User.findById(data.assignedTo).populate('customRoleId');
    if (!user) return;

    const fullData = await populateNotificationData({
      ...data,
      recipientName: user.getFullName()
    });

    // 📧 Email
    if (user.email && canNotify(company, user, 'email', `${data.type}_assigned`)) {
      try {
        const email = await getNotificationEmailContent(data.companyId, data.type, 'assigned', fullData, true);
        if (email) {
          await sendEmail(user.email, email.subject, email.html, email.text, { companyId: data.companyId });
        }
      } catch (e) {}
    }

    // 📱 WhatsApp — use DB template first, then fallback
    if (canNotify(company, user, 'whatsapp', `${data.type}_assigned`)) {
      let message = await getNotificationWhatsAppMessage(data.companyId, data.type, 'assigned_admin', fullData);
      
      if (!message) {
        logger.error(`❌ Still no message found for ${data.type}_assigned_admin even with defaults.`);
        return;
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
      logger.error(`❌ Still no message found for ${data.type}_resolved even with defaults.`);
      return;
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
    const phoneToNotify = data.citizenWhatsApp || data.citizenPhone;

    if (phoneToNotify && canNotify(company, null, 'whatsapp', `${data.type}_${actionKey}`)) {
      logger.info(`📢 [Citizen Notify] Preparing WhatsApp confirmation for citizen: ${data.citizenName} (${phoneToNotify}) (Action: ${actionKey})`);
      
      // Check if there's a custom template in the database first
      let message = await getNotificationWhatsAppMessage(data.companyId, data.type, actionKey, fullData);

      if (!message) {
        logger.error(`❌ Still no WhatsApp message found for citizen ${data.type}_${actionKey} even with defaults.`);
        return;
      }

      await safeSendWhatsApp(company, phoneToNotify, message);
    } else {
      logger.info(`ℹ️ Skipping citizen WhatsApp: phone=${phoneToNotify}, action=${actionKey}, canNotify=${canNotify(company, null, 'whatsapp', `${data.type}_${actionKey}`)}`);
    }

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
    const statusLower = data.newStatus.toLowerCase();
    const statusKey = `status_${statusLower}`;
    
    // Fallback order: 
    // 1. grievance_status_resolved (if status is resolved)
    // 2. grievance_resolved (standard key)
    // 3. grievance_status_update (catch-all)
    const attemptActions = [statusKey, statusLower, 'status_update'];
    
    let message = null;
    for (const act of attemptActions) {
      message = await getNotificationWhatsAppMessage(data.companyId, 'grievance', act, fullData);
      if (message) break;
    }

    if (!message) {
      logger.error(`❌ Still no message found for grievance status update even with defaults.`);
      return;
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
          email = await getNotificationEmailContent(data.companyId, 'grievance', 'status_update', emailData, false);
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

    // Find ALL relevant admins in the hierarchy
    const hierarchyDeptId = data.subDepartmentId || data.departmentId;
    const hierarchyAdmins = await getHierarchicalDepartmentAdmins(hierarchyDeptId);
    
    // Find Company Admins (top level)
    const companyAdmins = await User.find({
      companyId,
      $or: [
        { role: { $in: ['COMPANY_ADMIN', 'COMPANY_HEAD', 'SUPER_ADMIN', 'Collector'] } },
        { role: { $regex: /^company[- _]?(admin|administrator|head)|collector$/i } },
        { 
          customRoleId: { 
            $in: await (await import('../models/Role')).default.find({ 
              companyId, 
              key: { $in: ['COMPANY_ADMIN', 'ADMIN', 'COMPANY_HEAD', 'SUPER_ADMIN'] } 
            }).distinct('_id') 
          } 
        }
      ],
      isActive: true
    }).populate('customRoleId');

    // Combine recipients (Hierarchy + Company Admins + Explicit Assignee)
    const potentialRecipients = [...hierarchyAdmins, ...companyAdmins];
    if (data.assignedTo) {
      const assignee = await User.findById(data.assignedTo).populate('customRoleId');
      if (assignee) potentialRecipients.push(assignee);
    }

    // Deduplicate recipients
    const uniqueRecipients = new Map<string, any>();
    potentialRecipients.forEach(u => {
      if (u && u._id) uniqueRecipients.set(u._id.toString(), u);
    });

    const users = Array.from(uniqueRecipients.values());

    logger.info(`🔍 Found ${users.length} unique hierarchy recipients for ${data.type} status change to ${newStatus}`);

    const statusAction = newStatus.toLowerCase();
    const statusControlKey =
      statusAction === 'resolved' || statusAction === 'completed' || statusAction === 'cancelled'
        ? `${data.type}_resolved`
        : `${data.type}_assigned`;
    
    // Determine if we should use CTA button
    const ctaButton = {
      title: 'Access Dashboard',
      url: 'https://chatbot-portal-latest-frontend.vercel.app/'
    };

    // ✅ CONCURRENT NOTIFICATIONS
    // Filter out the citizen from hierarchy notifications, but DON'T drop admins with no phone.
    // Admins without a phone will still receive EMAIL notifications.
    const citizenPhoneNormalized = data.citizenWhatsApp?.replace(/\D/g, '') || data.citizenPhone?.replace(/\D/g, '');
    
    await Promise.allSettled(users.map(async (user) => {
      try {
        // Personalize data for each admin recipient
        const userFullData: Record<string, any> = {
          ...fullData,
          recipientName: user.getFullName()
        };

        // 📱 WhatsApp — Get message for this specific user to ensure correct personalization
        // Try admin-specific key first, then fallback to general key
        let hierarchyMessage = await getNotificationWhatsAppMessage(companyId, data.type, `${statusAction}_admin`, userFullData);
        
        if (!hierarchyMessage) {
          hierarchyMessage = await getNotificationWhatsAppMessage(companyId, data.type, statusAction as any, userFullData);
        }
        
        if (!hierarchyMessage && (newStatus === 'RESOLVED' || newStatus === 'COMPLETED')) {
          // Additional fallback for legacy resolved keys
          hierarchyMessage = await getNotificationWhatsAppMessage(companyId, data.type, 'resolved', userFullData);
        }

        if (!hierarchyMessage) {
          logger.error(`❌ Still no message found for hierarchy status update even with defaults.`);
          return; // Skip this user
        }

        const tasks: Promise<any>[] = [];

        // 📱 WhatsApp — only if user has a phone AND it doesn't match the citizen's phone
        const userPhoneNormalized = user.phone?.replace(/\D/g, '');
        const isCitizenPhone = userPhoneNormalized && userPhoneNormalized === citizenPhoneNormalized;

        if (!userPhoneNormalized || !user.phone) {
          logger.warn(`⚠️ Hierarchy admin ${user.email} (${user.getFullName()}) has NO phone number — skipping WhatsApp, will try email.`);
        } else if (isCitizenPhone) {
          logger.warn(`⚠️ Skipping WhatsApp for ${user.email} — phone matches citizen's phone (avoiding duplicate).`);
        } else if (canNotify(company, user, 'whatsapp', statusControlKey)) {
          tasks.push(safeSendWhatsApp(company, user.phone as string, hierarchyMessage, ctaButton));
          if (data.evidenceUrls && data.evidenceUrls.length > 0) {
            tasks.push(sendMediaIfAvailable(company, user.phone as string, data.evidenceUrls, `Hierarchy Update: ${userFullData.grievanceId || userFullData.appointmentId}`));
          }
        }

        // 📧 Email — always attempt, regardless of phone availability
        const emailAddress = user.email;
        if (emailAddress && canNotify(company, user, 'email', statusControlKey)) {
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
    const statusLower = data.newStatus.toLowerCase();
    const statusKey = `status_${statusLower}`;
    
    // Fallback order: 
    // 1. appointment_status_confirmed (if status is confirmed)
    // 2. appointment_confirmed (standard key)
    // 3. appointment_confirmed_update (alternate match)
    // 4. appointment_status_update (catch-all)
    const attemptActions = [statusKey, statusLower, `${statusLower}_update`, 'status_update'];
    
    let message = null;
    for (const act of attemptActions) {
      message = await getNotificationWhatsAppMessage(data.companyId, 'appointment', act, fullData);
      if (message) break;
    }

    if (!message) {
      logger.error(`❌ Still no message found for appointment status update even with defaults.`);
      return;
    }

    await safeSendWhatsApp(company, data.citizenWhatsApp || data.citizenPhone, message);

    // 📧 Email
    if (data.citizenEmail) {
      try {
        const emailData = {
          ...fullData,
          action: statusLower
        };

        let email = await getNotificationEmailContent(data.companyId, 'appointment', statusKey, emailData, false);
        if (!email) {
          email = await getNotificationEmailContent(data.companyId, 'appointment', 'status_update', emailData, false);
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
