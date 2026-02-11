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
  citizenName: string;
  citizenPhone: string;
  citizenWhatsApp?: string;
  departmentId?: any;
  companyId: any;
  description?: string;
  purpose?: string;
  category?: string;
  priority?: string;
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
  timeline?: Array<{
    action: string;
    details?: any;
    performedBy?: any;
    timestamp: Date | string;
  }>;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Load company and attach WhatsApp config from CompanyWhatsAppConfig so notifications can be sent */
async function getCompanyWithWhatsAppConfig(companyId: any): Promise<any | null> {
  if (!companyId) return null;

  // If companyId is already a full object with an _id, extract the ID
  let id = companyId;
  if (typeof companyId === 'object' && companyId !== null) {
    id = companyId._id || id;
  }

  // Ensure we have a string/ObjectId that Mongoose can handle
  const finalId = id?.toString ? id.toString() : id;
  
  // If the string is surprisingly long, it's likely a stringified object representation
  // which will cause a CastError. Try to avoid calling findById if it looks invalid.
  if (!finalId || typeof finalId !== 'string' || finalId.length > 30 || finalId.includes('{')) {
    logger.error('❌ Invalid companyId passed to getCompanyWithWhatsAppConfig:', { 
      type: typeof companyId,
      value: typeof companyId === 'object' ? 'Object' : companyId 
    });
    return null;
  }

  try {
    const company = await Company.findById(finalId);
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
  // Check company config first
  const hasCompanyConfig = Boolean(
    company?.whatsappConfig &&
    company.whatsappConfig.phoneNumberId &&
    company.whatsappConfig.accessToken
  );
  
  // No env fallback: WhatsApp config must be present in DB and attached to company
  return hasCompanyConfig;
}

function normalizePhone(phone?: string): string | null {
  if (!phone) return null;

  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');

  // India default handling
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
      logger.error('❌ WhatsApp send failed', {
        to: phone,
        error: result.error
      });
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

async function getDepartmentAdmin(departmentId: any): Promise<any | null> {
  try {
    return await User.findOne({
      departmentId,
      role: UserRole.DEPARTMENT_ADMIN,
      isActive: true
    });
  } catch (error) {
    logger.error('Error getting department admin:', error);
    return null;
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

    // For CEO appointments, departmentId is null - notify Company Admin instead
    if (data.type === 'appointment' && !data.departmentId) {
      // Find Company Admin for CEO appointments
      const companyAdmins = await User.find({
        companyId: data.companyId,
        role: UserRole.COMPANY_ADMIN,
        isActive: true
      });

      if (companyAdmins.length === 0) {
        logger.warn('⚠️ No Company Admin found to notify about CEO appointment');
        return;
      }

      // Notify all Company Admins
      for (const admin of companyAdmins) {
        const createdAt = data.createdAt || new Date();
        const formattedDate = new Date(createdAt).toLocaleString('en-IN', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });

        const ceoWaData = {
          companyName: company.name,
          recipientName: admin.getFullName(),
          appointmentId: data.appointmentId,
          citizenName: data.citizenName,
          citizenPhone: data.citizenPhone,
          departmentName: 'CEO - Zilla Parishad Amravati',
          purpose: data.purpose,
          createdAt: data.createdAt,
          appointmentDate: data.appointmentDate,
          appointmentTime: data.appointmentTime,
          formattedDate
        };
        let ceoMessage = await getNotificationWhatsAppMessage(data.companyId, 'appointment', 'created', ceoWaData);
        if (!ceoMessage) {
          ceoMessage =
            `*${company.name}*\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `📋 *NEW APPOINTMENT REQUEST RECEIVED*\n\n` +
            `Respected ${admin.getFullName()},\n\n` +
            `A new appointment request has been received for the CEO.\n\n` +
            `*Appointment Details:*\n` +
            `🎫 *Reference ID:* ${data.appointmentId}\n` +
            `👤 *Citizen Name:* ${data.citizenName}\n` +
            `📞 *Contact Number:* ${data.citizenPhone}\n` +
            `🏢 *Department:* CEO - Zilla Parishad Amravati\n` +
            `📝 *Purpose:* ${data.purpose}\n` +
            `📅 *Requested Date:* ${data.appointmentDate ? new Date(data.appointmentDate).toLocaleDateString('en-IN') : 'N/A'}\n` +
            `⏰ *Requested Time:* ${data.appointmentTime || 'N/A'}\n` +
            `📅 *Received On:* ${formattedDate}\n\n` +
            `*Action Required:*\n` +
            `Please review this appointment request and schedule it from the dashboard.\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `*${company.name}*\n` +
            `Digital Appointment System\n` +
            `This is an automated notification.`;
        }
        await safeSendWhatsApp(company, admin.phone, ceoMessage);

        if (admin.email) {
          try {
            const emailData = {
              companyName: company.name,
              recipientName: admin.getFullName(),
              appointmentId: data.appointmentId,
              citizenName: data.citizenName,
              citizenPhone: data.citizenPhone,
              departmentName: 'CEO - Zilla Parishad Amravati',
              purpose: data.purpose,
              location: data.location,
              createdAt: data.createdAt,
              appointmentDate: data.appointmentDate,
              appointmentTime: data.appointmentTime
            };
            const email = await getNotificationEmailContent(data.companyId, 'appointment', 'created', emailData);
            const result = await sendEmail(admin.email, email.subject, email.html, email.text, { companyId: data.companyId });
            if (result.success) {
              logger.info(`✅ Email sent to Company Admin ${admin.getFullName()} (${admin.email})`);
            }
          } catch (error) {
            logger.error(`❌ Error sending email to ${admin.email}:`, error);
          }
        }
      }
      return; // Exit early for CEO appointments
    }

    // For grievances or department appointments, use existing logic
    const department = await Department.findById(data.departmentId);
    if (!department) return;

    const admin = await getDepartmentAdmin(data.departmentId);
    if (!admin) return;

    const createdAt = data.createdAt || new Date();
    const formattedDate = new Date(createdAt).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const notificationData = {
      companyName: company.name,
      recipientName: admin.getFullName(),
      grievanceId: data.grievanceId,
      appointmentId: data.appointmentId,
      citizenName: data.citizenName,
      citizenPhone: data.citizenPhone,
      departmentName: department.name,
      category: data.category,
      priority: data.priority,
      description: data.description,
      purpose: data.purpose,
      location: data.location,
      createdAt: data.createdAt,
      timeline: data.timeline,
      appointmentDate: data.appointmentDate,
      appointmentTime: data.appointmentTime,
      formattedDate
    };

    // Email
    if (admin.email) {
      try {
        const email = await getNotificationEmailContent(data.companyId, data.type, 'created', notificationData);
        const result = await sendEmail(admin.email, email.subject, email.html, email.text, { companyId: data.companyId });
        if (result.success) {
          logger.info(`✅ Email sent to department admin ${admin.getFullName()} (${admin.email})`);
        } else {
          logger.error(`❌ Failed to send email to ${admin.email}:`, result.error);
        }
      } catch (error) {
        logger.error(`❌ Error sending email to ${admin.email}:`, error);
      }
    } else {
      logger.warn(`⚠️ Department admin ${admin.getFullName()} has no email address`);
    }

    let message = await getNotificationWhatsAppMessage(data.companyId, data.type, 'created', notificationData);
    if (!message) {
      const categoryText = data.category ? `\n📂 *Category:* ${data.category}\n` : '';
      const locationText = data.location ? `\n📍 *Location:* ${data.location}\n` : '';
      message =
        `*${company.name}*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📋 *NEW ${data.type === 'grievance' ? 'GRIEVANCE' : 'APPOINTMENT'} RECEIVED*\n\n` +
        `Respected ${admin.getFullName()},\n\n` +
        `This is to inform you that a new ${data.type === 'grievance' ? 'grievance' : 'appointment'} has been received through our digital portal and has been assigned to your department for immediate attention and necessary action.\n\n` +
        `*Grievance/Appointment Details:*\n` +
        `🎫 *Reference ID:* ${data.grievanceId || data.appointmentId}\n` +
        `👤 *Citizen Name:* ${data.citizenName}\n` +
        `📞 *Contact Number:* ${data.citizenPhone}\n` +
        `🏢 *Department:* ${department.name}${categoryText}${locationText}` +
        `📝 *Description:*\n${data.description || data.purpose}\n\n` +
        `📅 *Received On:* ${formattedDate}\n\n` +
        `*Action Required:*\n` +
        `Please review this ${data.type === 'grievance' ? 'grievance' : 'appointment'} at your earliest convenience and take appropriate action. Kindly ensure timely resolution as per the service level agreement (SLA) guidelines.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `*${company.name}*\n` +
        `Digital Grievance Redressal System\n` +
        `This is an automated notification.`;
    }
    await safeSendWhatsApp(company, admin.phone, message);

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

    const department = await Department.findById(data.departmentId);
    const departmentName = department?.name || 'Unknown';

    const assignedByName = data.assignedByName || 'Administrator';
    const assignedAt = data.assignedAt || new Date();
    const formattedDate = new Date(assignedAt).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const emailData = {
      companyName: company.name,
      recipientName: user.getFullName(),
      grievanceId: data.grievanceId,
      appointmentId: data.appointmentId,
      citizenName: data.citizenName,
      citizenPhone: data.citizenPhone,
      departmentName,
      priority: data.priority,
      description: data.description || data.purpose,
      purpose: data.purpose,
      assignedByName: assignedByName,
      assignedAt: data.assignedAt,
      createdAt: data.createdAt,
      timeline: data.timeline,
      appointmentDate: data.appointmentDate,
      appointmentTime: data.appointmentTime
    };

    if (user.email) {
      try {
        const email = await getNotificationEmailContent(data.companyId, data.type, 'assigned', emailData);
        const result = await sendEmail(user.email, email.subject, email.html, email.text, { companyId: data.companyId });
        if (result.success) {
          logger.info(`✅ Email sent to assigned user ${user.getFullName()} (${user.email})`);
        } else {
          logger.error(`❌ Failed to send email to ${user.email}:`, result.error);
        }
      } catch (error) {
        logger.error(`❌ Error sending email to ${user.email}:`, error);
      }
    } else {
      logger.warn(`⚠️ Assigned user ${user.getFullName()} has no email address`);
    }

    const waData = { ...emailData, assignedByName, assignedAt: data.assignedAt, formattedDate };
    let message = await getNotificationWhatsAppMessage(data.companyId, data.type, 'assigned', waData);
    if (!message) {
      message =
        `*${company.name}*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `👤 *${data.type === 'grievance' ? 'GRIEVANCE' : 'APPOINTMENT'} ASSIGNED TO YOU*\n\n` +
        `Respected ${user.getFullName()},\n\n` +
        `This is to inform you that a ${data.type === 'grievance' ? 'grievance' : 'appointment'} has been assigned to you for resolution. You are requested to review the details and take necessary action at the earliest.\n\n` +
        `*Assignment Details:*\n` +
        `🎫 *Reference ID:* ${data.grievanceId || data.appointmentId}\n` +
        `👤 *Citizen Name:* ${data.citizenName}\n` +
        `📞 *Contact Number:* ${data.citizenPhone}\n` +
        `🏢 *Department:* ${departmentName}\n` +
        `📝 *Description:*\n${data.description || data.purpose}\n\n` +
        `👨‍💼 *Assigned By:* ${assignedByName}\n` +
        `📅 *Assigned On:* ${formattedDate}\n\n` +
        `*Your Action Required:*\n` +
        `Please contact the citizen, investigate the matter, and provide a resolution. Kindly update the status and add remarks as you progress with the resolution process.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `*${company.name}*\n` +
        `Digital Grievance Redressal System\n` +
        `This is an automated notification.`;
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

    const department = await Department.findById(data.departmentId);
    const departmentName = department?.name || 'Unknown Department';

    // Fetch resolvedBy user details if available
    let resolvedByName = 'Assigned Officer';
    if (data.resolvedBy) {
      try {
        const resolvedByUser = typeof data.resolvedBy === 'object' && data.resolvedBy !== null
          ? await User.findById(data.resolvedBy._id || data.resolvedBy)
          : await User.findById(data.resolvedBy);
        if (resolvedByUser) {
          resolvedByName = resolvedByUser.getFullName();
        }
      } catch (error) {
        logger.warn('Could not fetch resolvedBy user details');
      }
    }

    const resolvedAt = data.resolvedAt || new Date();
    const formattedResolvedDate = new Date(resolvedAt).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const createdAt = data.createdAt;
    let resolutionTimeText = '';
    if (createdAt && resolvedAt) {
      const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
      const resolved = typeof resolvedAt === 'string' ? new Date(resolvedAt) : resolvedAt;
      const diffMs = resolved.getTime() - created.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      if (diffDays > 0) {
        resolutionTimeText = `${diffDays} day${diffDays > 1 ? 's' : ''} and ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
      } else if (diffHours > 0) {
        resolutionTimeText = `${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
      } else {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        resolutionTimeText = `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
      }
    }

    // Email for appointments if citizen email is available
    if (data.type === 'appointment' && (data as any).citizenEmail) {
      try {
        const emailData = {
          companyName: company.name,
          recipientName: data.citizenName,
          appointmentId: data.appointmentId,
          citizenName: data.citizenName,
          citizenPhone: data.citizenPhone,
          departmentName: departmentName,
          remarks: data.remarks,
          resolvedBy: data.resolvedBy,
          resolvedAt: data.resolvedAt,
          createdAt: data.createdAt,
          assignedAt: data.assignedAt,
          timeline: data.timeline,
          appointmentDate: (data as any).appointmentDate,
          appointmentTime: (data as any).appointmentTime
        };
        const email = await getNotificationEmailContent(data.companyId, 'appointment', 'resolved', emailData);
        const result = await sendEmail((data as any).citizenEmail, email.subject, email.html, email.text, { companyId: data.companyId });
        if (result.success) {
          logger.info(`✅ Email sent to citizen ${data.citizenName} (${(data as any).citizenEmail})`);
        }
      } catch (error) {
        logger.error(`❌ Error sending email to citizen:`, error);
      }
    }

    const resolvedWaData = {
      companyName: company.name,
      recipientName: data.citizenName,
      grievanceId: data.grievanceId,
      appointmentId: data.appointmentId,
      citizenName: data.citizenName,
      citizenPhone: data.citizenPhone,
      departmentName,
      remarks: data.remarks,
      resolvedByName,
      resolvedAt: data.resolvedAt,
      createdAt: data.createdAt,
      assignedAt: data.assignedAt,
      formattedResolvedDate,
      resolutionTimeText,
      timeline: data.timeline
    };
    let message = await getNotificationWhatsAppMessage(data.companyId, data.type, 'resolved', resolvedWaData);
    if (!message) {
      const remarksText = data.remarks ? `\n\n*Officer's Resolution Remarks:*\n${data.remarks}\n` : '';
      const resolutionTimeTextFormatted = resolutionTimeText ? `\n⏱️ *Resolution Time:* ${resolutionTimeText}\n` : '';
      message =
        `*${company.name}*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `✅ *YOUR ${data.type === 'grievance' ? 'GRIEVANCE' : 'APPOINTMENT'} HAS BEEN RESOLVED*\n\n` +
        `Respected ${data.citizenName},\n\n` +
        `This is to inform you that your ${data.type === 'grievance' ? 'grievance' : 'appointment'} has been successfully resolved by our department. We appreciate your patience and cooperation.\n\n` +
        `*Resolution Details:*\n` +
        `🎫 *Reference ID:* ${data.grievanceId || data.appointmentId}\n` +
        `🏢 *Department:* ${departmentName}\n` +
        `📊 *Status:* RESOLVED\n` +
        `👨‍💼 *Resolved By:* ${resolvedByName}\n` +
        `📅 *Resolved On:* ${formattedResolvedDate}${resolutionTimeTextFormatted}${remarksText}` +
        `\n*Timeline Summary:*\n` +
        `${data.createdAt ? `📝 Created: ${new Date(data.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}\n` : ''}` +
        `${data.assignedAt ? `👤 Assigned: ${new Date(data.assignedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}\n` : ''}` +
        `✅ Resolved: ${formattedResolvedDate}\n\n` +
        `Thank you for using our digital portal. We hope this resolves your concern satisfactorily. If you have any further queries, please feel free to contact us.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `*${company.name}*\n` +
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
  departmentName?: string;
  newStatus: string;
  remarks?: string;
}): Promise<void> {
  try {
    const company = await getCompanyWithWhatsAppConfig(data.companyId);
    if (!company) return;

    const departmentName = data.departmentName || 'Department';
    const remarksText = data.remarks ? `\n\n📝 *Remarks:*\n${data.remarks}` : '';
    const statusLabel = data.newStatus === 'ASSIGNED' ? 'Assigned' : data.newStatus === 'REJECTED' ? 'Rejected' : data.newStatus === 'PENDING' ? 'Pending' : data.newStatus;

    const message =
      `*${company.name}*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📋 *GRIEVANCE STATUS UPDATE*\n\n` +
      `Respected ${data.citizenName},\n\n` +
      `Your grievance status has been updated.\n\n` +
      `*Details:*\n` +
      `🎫 *Ref No:* \`${data.grievanceId}\`\n` +
      `🏢 *Department:* ${departmentName}\n` +
      `📊 *New Status:* ${statusLabel}${remarksText}\n\n` +
      `You will receive further updates via WhatsApp.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `*${company.name}*\n` +
      `Digital Grievance Redressal System`;

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

    const department = await Department.findById(data.departmentId);
    const departmentName = department?.name || 'Unknown Department';

    // Fetch resolvedBy user details if available
    let resolvedByName = 'Assigned Officer';
    if (data.resolvedBy) {
      try {
        const resolvedByUser = typeof data.resolvedBy === 'object' && data.resolvedBy !== null
          ? await User.findById(data.resolvedBy._id || data.resolvedBy)
          : await User.findById(data.resolvedBy);
        if (resolvedByUser) {
          resolvedByName = resolvedByUser.getFullName();
        }
      } catch (error) {
        logger.warn('Could not fetch resolvedBy user details');
      }
    }

    const users = await User.find({
      $or: [
        { role: UserRole.COMPANY_ADMIN, companyId: data.companyId },
        { role: UserRole.DEPARTMENT_ADMIN, departmentId: data.departmentId },
        { _id: data.assignedTo }
      ],
      isActive: true
    });

    const resolvedAt = data.resolvedAt || new Date();
    const formattedResolvedDate = new Date(resolvedAt).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const createdAt = data.createdAt;
    let resolutionTimeText = '';
    if (createdAt && resolvedAt) {
      const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
      const resolved = typeof resolvedAt === 'string' ? new Date(resolvedAt) : resolvedAt;
      const diffMs = resolved.getTime() - created.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      if (diffDays > 0) {
        resolutionTimeText = `${diffDays} day${diffDays > 1 ? 's' : ''} and ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
      } else if (diffHours > 0) {
        resolutionTimeText = `${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
      } else {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        resolutionTimeText = `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
      }
    }

    const hierarchyWaData = {
      companyName: company.name,
      grievanceId: data.grievanceId,
      appointmentId: data.appointmentId,
      citizenName: data.citizenName,
      citizenPhone: data.citizenPhone,
      departmentName,
      oldStatus,
      newStatus,
      resolvedByName,
      resolvedAt: data.resolvedAt,
      createdAt: data.createdAt,
      assignedAt: data.assignedAt,
      remarks: data.remarks,
      formattedResolvedDate,
      resolutionTimeText,
      timeline: data.timeline
    };
    let hierarchyMessage = await getNotificationWhatsAppMessage(data.companyId, data.type, 'resolved', hierarchyWaData);
    if (!hierarchyMessage) {
      const remarksText = data.remarks ? `\n\n*Officer's Remarks:*\n${data.remarks}\n` : '';
      const resolutionTimeTextFormatted = resolutionTimeText ? `\n⏱️ *Resolution Time:* ${resolutionTimeText}\n` : '';
      hierarchyMessage =
        `*${company.name}*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📊 *STATUS UPDATE - ${data.type === 'grievance' ? 'GRIEVANCE' : 'APPOINTMENT'} RESOLVED*\n\n` +
        `Respected Sir/Madam,\n\n` +
        `This is to inform you that the following ${data.type === 'grievance' ? 'grievance' : 'appointment'} has been successfully resolved by the assigned officer.\n\n` +
        `*${data.type === 'grievance' ? 'Grievance' : 'Appointment'} Details:*\n` +
        `🎫 *Reference ID:* ${data.grievanceId || data.appointmentId}\n` +
        `👤 *Citizen Name:* ${data.citizenName}\n` +
        `📞 *Contact Number:* ${data.citizenPhone}\n` +
        `🏢 *Department:* ${departmentName}\n` +
        `📊 *Status Change:* ${oldStatus} → ${newStatus}\n` +
        `👨‍💼 *Resolved By:* ${resolvedByName}\n` +
        `📅 *Resolved On:* ${formattedResolvedDate}${resolutionTimeTextFormatted}${remarksText}` +
        `\n*Processing Timeline:*\n` +
        `${data.createdAt ? `📝 Created: ${new Date(data.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}\n` : ''}` +
        `${data.assignedAt ? `👤 Assigned: ${new Date(data.assignedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}\n` : ''}` +
        `✅ Resolved: ${formattedResolvedDate}\n\n` +
        `The citizen has been notified of the resolution. This notification is for your information and records.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `*${company.name}*\n` +
        `Digital Grievance Redressal System\n` +
        `This is an automated notification.`;
    }

    for (const user of users) {
      await safeSendWhatsApp(company, user.phone, hierarchyMessage);

      if (user.email) {
        try {
          const emailData = {
            companyName: company.name,
            recipientName: user.getFullName(),
            grievanceId: data.grievanceId || data.appointmentId,
            citizenName: data.citizenName,
            citizenPhone: data.citizenPhone,
            departmentName: departmentName,
            remarks: data.remarks,
            resolvedBy: data.resolvedBy,
            resolvedAt: data.resolvedAt,
            createdAt: data.createdAt,
            assignedAt: data.assignedAt,
            timeline: data.timeline,
            appointmentDate: (data as any).appointmentDate,
            appointmentTime: (data as any).appointmentTime
          };
          const email = await getNotificationEmailContent(data.companyId, data.type, 'resolved', emailData);

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
    const { getTranslation } = await import('./chatbotEngine');
    
    // Format date and time
    const appointmentDate = new Date(data.appointmentDate);
    const dateDisplay = appointmentDate.toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const formatTime12Hr = (time: string) => {
      const [hours, minutes] = time.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${String(minutes || 0).padStart(2, '0')} ${period}`;
    };
    const timeDisplay = formatTime12Hr(data.appointmentTime);

    let message = '';
    const remarksText = data.remarks ? `\n\n📝 *Remarks:*\n${data.remarks}` : '';

    // Different messages based on status
    if (data.newStatus === AppointmentStatus.SCHEDULED) {
      // Appointment has been scheduled by admin
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
      // Appointment has been confirmed by admin
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
      // Appointment has been cancelled
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
      // Appointment completed
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

    if (message) {
      const result = await safeSendWhatsApp(company, data.citizenWhatsApp || data.citizenPhone, message);
      if (result.success) {
        logger.info(`✅ Appointment status notification sent to ${data.citizenName} (${data.citizenPhone})`);
      } else {
        logger.error(`❌ Failed to send appointment status notification to ${data.citizenName} (${data.citizenPhone}): ${result.error}`);
      }
    } else {
      logger.warn(`⚠️ No notification message generated for status change: ${data.oldStatus} → ${data.newStatus}`);
    }

  } catch (error) {
    logger.error('❌ notifyCitizenOnAppointmentStatusChange failed:', error);
  }
}
