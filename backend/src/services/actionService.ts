import Department from '../models/Department';
import mongoose from 'mongoose';
import Grievance from '../models/Grievance';
import Appointment from '../models/Appointment';
import Lead from '../models/Lead';
import User from '../models/User';
import { 
  notifyDepartmentAdminOnCreation, 
  notifyUserOnAssignment, 
  notifyCitizenOnCreation,
  notifyCitizenOnGrievanceStatusChange, 
  notifyCitizenOnAppointmentStatusChange,
  getHierarchicalDepartmentAdmins,
  getLocalizedDepartmentName
} from './notificationService';
import { findOptimalAdmin } from '../utils/userUtils';
import { GrievanceStatus, AppointmentStatus, UserRole } from '../config/constants';
import { updateSession } from './sessionService';
import { logger } from '../config/logger';
import CitizenProfile from '../models/CitizenProfile';
import { enforceDailyLimitOrThrow } from './grievanceRateLimitService';
import { sanitizeGrievanceDetailsForStorage } from '../utils/sanitize';
import {
  triggerAdminTemplate,
  triggerGrievanceNotifications,
  formatTemplateDate
} from './grievanceTemplateTriggerService';

interface CreateActionOptions {
  sendCitizenConfirmation?: boolean;
}

/**
 * Action Service
 * 
 * Handles business logic for specialized chatbot actions like creating grievances,
 * appointments, and leads. Keeps DynamicFlowEngine lean.
 */
export class ActionService {
  private static resolveCitizenName(sessionData: Record<string, any>, citizenProfile?: any): string {
    const nameCandidates = [
      sessionData?.citizenName,
      sessionData?.citizen_name,
      sessionData?.name,
      sessionData?.fullName,
      sessionData?.full_name,
      sessionData?.applicantName,
      sessionData?.applicant_name,
      sessionData?.complainantName,
      sessionData?.complainant_name,
      sessionData?.userName,
      sessionData?.user_name,
      sessionData?.fullData?.citizenName,
      sessionData?.fullData?.citizen_name,
      sessionData?.fullData?.name,
      sessionData?.fullData?.fullName,
      citizenProfile?.name,
    ];

    for (const candidate of nameCandidates) {
      if (typeof candidate !== 'string') continue;
      const trimmed = candidate.trim();
      if (trimmed) return trimmed;
    }

    return 'WhatsApp User';
  }

  private static resolveGrievanceDescription(sessionData: Record<string, any>): string {
    const descriptionCandidates = [
      sessionData?.description,
      sessionData?.grievance_description,
      sessionData?.grievanceDetails,
      sessionData?.issueDescription,
      sessionData?.details,
      sessionData?.message,
      sessionData?.complaint,
      sessionData?.['ବର୍ଣ୍ଣନା'],
    ];

    for (const candidate of descriptionCandidates) {
      if (typeof candidate !== 'string') continue;
      const trimmed = candidate.trim();
      if (trimmed) return trimmed;
    }

    return '';
  }

  private static toObjectId(value: any): mongoose.Types.ObjectId | undefined {
    if (!value) return undefined;
    if (value instanceof mongoose.Types.ObjectId) return value;
    const valueStr = String(value).trim();
    if (!mongoose.Types.ObjectId.isValid(valueStr)) return undefined;
    return new mongoose.Types.ObjectId(valueStr);
  }

  private static parseAppointmentDate(sessionData: any): Date {
    const candidates = [
      sessionData?.appointmentDate,
      sessionData?.selectedDate,
      sessionData?.date,
    ];

    for (const candidate of candidates) {
      if (!candidate) continue;
      const parsed = new Date(candidate);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }

    throw new Error('Appointment date is missing or invalid in chatbot session data');
  }

  /**
   * Create grievance from session data
   */
  static async createGrievance(
    session: any,
    company: any,
    userPhone: string,
    options: CreateActionOptions = {},
  ): Promise<void> {
    try {
      const sendCitizenConfirmation = options.sendCitizenConfirmation !== false;
      const citizenProfile = await CitizenProfile.findOne({
        companyId: company._id,
        phone_number: userPhone
      });

      if (citizenProfile?.opt_out) {
        throw new Error('Citizen has opted out from WhatsApp communication');
      }

      // Check for citizen consent. 
      const hasConsent = session?.data?.citizenConsent === true || session?.data?.hasConsent === true;
      
      if (!hasConsent && !session?.data?.flowId) {
        throw new Error('Citizen consent is required before grievance creation');
      }

      const citizenName = ActionService.resolveCitizenName(session.data, citizenProfile);
      if (!session.data.citizenName || !String(session.data.citizenName).trim()) {
        session.data.citizenName = citizenName;
        logger.warn(
          `⚠️ Missing citizenName in grievance session. Applied fallback "${citizenName}". Phone: ${userPhone}, Flow: ${session?.data?.flowId || 'unknown'}`
        );
      }

      await enforceDailyLimitOrThrow({
        companyId: company._id,
        phone_number: userPhone,
        company,
        language: session.language || 'en'
      });

      // ✅ STRICT SELECTION: Prioritize IDs provided by the chatbot flow
      let departmentId = ActionService.toObjectId(session.data.departmentId);
      const subDepartmentId = ActionService.toObjectId(session.data.subDepartmentId);

      // If departmentId is missing, check if we can derive it from subDepartmentId
      if (!departmentId && subDepartmentId) {
        const subDept = await Department.findById(subDepartmentId).select('parentDepartmentId').lean();
        if (subDept?.parentDepartmentId) {
          departmentId = ActionService.toObjectId(subDept.parentDepartmentId) || undefined;
        }
      }

      if (!departmentId && !subDepartmentId) {
        throw new Error('Department selection is mandatory. Please select a department to proceed.');
      }

      const validMediaTypes = ['image', 'document', 'video'];
      const mediaFromArray: any[] = (session.data.media || []).filter(
        (m: any) => m && m.url && validMediaTypes.includes(m.type)
      );

      const extraAttachmentFields = ['attachmentUrl', 'attachment', 'fileUrl', 'documentUrl', 'mediaUrl'];
      const extraMedia: any[] = [];
      const existingUrls = new Set(mediaFromArray.map(m => m.url));

      for (const field of extraAttachmentFields) {
        const val = session.data[field];
        if (val && typeof val === 'string' && val.startsWith('http')) {
          if (!existingUrls.has(val)) {
            const isImg = /\.(jpe?g|png|gif|webp|bmp)(\?|$)/i.test(val) || val.includes('/image/') || val.toLowerCase().includes('image');
            extraMedia.push({ url: val, type: isImg ? 'image' : 'document', uploadedAt: new Date(), isGCS: val.includes('storage.googleapis.com') });
            existingUrls.add(val);
          }
        }
      }

      const sanitizedMedia = [...mediaFromArray, ...extraMedia];
      const resolvedDescription = ActionService.resolveGrievanceDescription(session.data);
      const hasExplicitDescription = resolvedDescription.length > 0;
      const fallbackDescription = `Citizen reported a grievance via WhatsApp (${new Date().toISOString()})`;
      const finalDescription = hasExplicitDescription ? resolvedDescription : fallbackDescription;
      const storedDescription = sanitizeGrievanceDetailsForStorage(finalDescription);

      if (!hasExplicitDescription) {
        logger.warn(
          `⚠️ Missing grievance description in session. Applied fallback text to avoid validation failure. Phone: ${userPhone}, Flow: ${session?.data?.flowId || 'unknown'}`
        );
      }

      if (!session.data.description || !String(session.data.description).trim()) {
        session.data.description = finalDescription;
      }
      const parsedLatitude = Number(session.data.latitude);
      const parsedLongitude = Number(session.data.longitude);
      const hasValidCoordinates =
        Number.isFinite(parsedLatitude) &&
        Number.isFinite(parsedLongitude) &&
        Math.abs(parsedLatitude) <= 90 &&
        Math.abs(parsedLongitude) <= 180;
      
      const grievanceData = {
        companyId: company._id,
        departmentId: departmentId || undefined,
        subDepartmentId: subDepartmentId || undefined,
        citizenName,
        citizenPhone: userPhone,
        phone_number: userPhone,
        citizenWhatsApp: userPhone,
        description: storedDescription,
        message: storedDescription,
        category: session.data.category,
        media: sanitizedMedia,
        location: (hasValidCoordinates || session.data.locationAddress) ? {
          type: 'Point',
          ...(hasValidCoordinates
            ? { coordinates: [parsedLongitude, parsedLatitude] as [number, number] }
            : {}),
          address: session.data.locationAddress || ''
        } : undefined,
        status: GrievanceStatus.PENDING,
        admin_consent: false,
        priority: 'MEDIUM',
        language: session.language || 'en'
      };
      
      const grievance = new Grievance(grievanceData);
      
      try {
        await grievance.save();
      } catch (saveErr: any) {
        if (saveErr.name === 'ValidationError') {
          console.error('❌ ActionService: Grievance validation failed:');
          Object.keys(saveErr.errors).forEach(field => {
            console.error(`   Field "${field}": ${saveErr.errors[field].message}`);
          });
        }
        throw saveErr;
      }

      await CitizenProfile.updateOne(
        { companyId: company._id, phone_number: userPhone },
        {
          $set: {
            lastGrievanceDate: new Date(),
            phoneNumber: userPhone,
            name: citizenName,
            citizen_consent: true,
            consentGiven: true,
            citizen_consent_timestamp: new Date(),
            consentTimestamp: new Date(),
            consent_source: 'whatsapp_button',
            notification_consent: session.data.notificationConsent === true,
            notificationConsent: session.data.notificationConsent === true,
            notification_consent_timestamp: new Date(),
            opt_out: false,
            isSubscribed: true
          }
        },
        { upsert: true }
      );
      
      session.data.grievanceId = grievance.grievanceId;
      session.data.id = grievance.grievanceId;
      session.data.status = 'PENDING';
      session.data.date = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
      session.data.time = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
      
      const dept = departmentId ? await Department.findById(departmentId) : null;
      const subDept = subDepartmentId ? await Department.findById(subDepartmentId) : null;
      
      const lang = (session.language || 'en') as 'en' | 'hi' | 'or' | 'mr';
      
      session.data.department = dept ? getLocalizedDepartmentName(dept, lang) : (session.data.category || 'Collector & DM');
      session.data.subDepartment = subDept ? getLocalizedDepartmentName(subDept, lang) : '';
      session.data.subDepartmentName = subDept ? getLocalizedDepartmentName(subDept, lang) : '';
      
      session.data.departmentName = dept ? getLocalizedDepartmentName(dept, lang) : (session.data.category || 'Collector & DM');      
      session.data.subdepartmentName = subDept ? getLocalizedDepartmentName(subDept, lang) : '';
      
      session.data['ଗ୍ରିଭନ୍ସଆଇଡି'] = grievance.grievanceId;
      session.data['ବିଭାଗନାମ'] = session.data.departmentName;
      session.data['ଉପବିଭାଗନାମ'] = session.data.subDepartmentName;
      session.data['ବର୍ଣ୍ଣନା'] = session.data.description;
      const evidenceUrls = sanitizedMedia.map((media: any) => media.url).filter(Boolean);
      session.data.evidenceUrl = evidenceUrls.length > 0 ? evidenceUrls.join(', ') : '';
      
      await updateSession(session);

      // ✅ AUTO-ASSIGNMENT (Designated Officer / Dept Admin)
      let autoAssigned = false;
      let assignedAdmins: any[] = [];

      const targetDeptId = subDepartmentId || departmentId;
      if (targetDeptId) {
        const potentialAdmins = await getHierarchicalDepartmentAdmins(targetDeptId);
        const targetAdmin = findOptimalAdmin(potentialAdmins);
        
        if (targetAdmin) {
          grievance.assignedTo = targetAdmin._id;
          grievance.status = GrievanceStatus.ASSIGNED;
          await grievance.save();
          autoAssigned = true;
          assignedAdmins = [targetAdmin];
          session.data.assignedToName = targetAdmin.getFullName();
          logger.info(`✅ Grievance ${grievance.grievanceId} auto-assigned to ${targetAdmin.getFullName()}`);
        }
      }

      await updateSession(session);
      
      // ✅ IN-APP NOTIFICATION (InAppNotificationService)
      try {
        // 1. Notify Company/Dept admins about the NEW grievance (Hierarchy: Sub-Dept -> Dept -> Company)
        const { notifyDepartmentAdmins, notifyUser } = await import('./inAppNotificationService');
        if (targetDeptId) {
          await notifyDepartmentAdmins({
            companyId: company._id,
            departmentId: targetDeptId,
            eventType: 'GRIEVANCE_RECEIVED',
            title: 'New Grievance Received',
            message: `Grievance ${grievance.grievanceId} received from ${citizenName}.`,
            grievanceId: grievance.grievanceId,
            grievanceObjectId: grievance._id,
            meta: { 
              category: session.data.category,
              department: session.data.departmentName,
              subDepartment: session.data.subDepartmentName
            }
          });
        }

        // 2. If auto-assigned, notify the specific assignee
        if (autoAssigned && assignedAdmins.length > 0) {
          const targetAdmin = assignedAdmins[0];
          await notifyUser({
            userId: targetAdmin._id,
            companyId: company._id,
            eventType: 'GRIEVANCE_ASSIGNED',
            title: 'Grievance Assigned (Auto)',
            message: `Grievance ${grievance.grievanceId} has been auto-assigned to you.`,
            grievanceId: grievance.grievanceId,
            grievanceObjectId: grievance._id
          });
        }
      } catch (inAppErr) {
        logger.error('⚠️ In-App Notification trigger failed in ActionService:', inAppErr);
      }

      // ✅ PREPARE EXTERNAL NOTIFICATIONS (WhatsApp/Email)
      logger.info(`🔍 [ActionService] Creating Grievance ${grievance.grievanceId}. Session Desc: "${session.data.description || ''}", Flow Prop: "${session.data.grievance_description || ''}"`);
      const notificationData = {
        grievanceId: grievance.grievanceId,
        citizenName,
        citizenPhone: userPhone,
        citizenWhatsApp: userPhone,
        language: session.language || 'en',
        departmentId: departmentId as any,
        subDepartmentId: subDepartmentId,
        companyId: company._id,
        description: storedDescription || session.data.grievance_description || 'N/A',
        category: session.data.category,
        departmentName: dept ? dept.name : session.data.category,
        subDepartmentName: subDept ? subDept.name : undefined,
        evidenceUrls: sanitizedMedia.map((media: any) => media.url).filter(Boolean),
        createdAt: grievance.createdAt,
        timeline: grievance.timeline,
        type: 'grievance' as const,
        action: 'confirmation' as const,
        citizenEmail: session.data.citizenEmail,
        grievance
      };

      const createdAt = grievance.createdAt || new Date();
      const formattedDate = formatTemplateDate(new Date(createdAt));

      session.data.formattedDate = formattedDate;
      session.data.fullData = session.data.fullData || {};
      session.data.fullData.formattedDate = formattedDate;
      session.data.date = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
      session.data.time = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
      session.data['Submitted On'] = formattedDate;
      session.data.submittedOn = formattedDate;
      await updateSession(session);

      const notifications = [];

      const { notifyDepartmentAdminOnCreation } = await import('./notificationService');

      notifications.push(notifyDepartmentAdminOnCreation({
        ...notificationData,
        type: 'grievance',
        action: 'created',
      }));

      notifications.push(
        triggerGrievanceNotifications({
          companyId: company._id,
          grievanceId: grievance.grievanceId,
          citizenName,
          citizenPhone: userPhone,
          // Use real live department name (main dept) as 'department' in the template
          category: dept?.name || session.data.category || 'General',
          // Use real live sub-department name as 'office' in the template
          subDepartmentName: subDept?.name || 'N/A',
          description: storedDescription,
          status: grievance.status,
          language: session.language || 'en',
          assignedAdmins,
          media: sanitizedMedia,
          buttonParam: 'https://sahaj.pugarch.in/'
        })
      );

      Promise.allSettled(notifications)
        .then((notificationResults) => {
          const failedNotifications = notificationResults.filter(
            (result) => result.status === 'rejected'
          ) as PromiseRejectedResult[];

          if (failedNotifications.length > 0) {
            logger.error(
              `⚠️ createGrievance completed but ${failedNotifications.length} notification task(s) failed.`,
              failedNotifications.map((item) => item.reason)
            );
          }
        })
        .catch((error) => {
          logger.error('⚠️ createGrievance background notification error:', error);
        });
    } catch (error) {
      logger.error('❌ Error in createGrievance action:', error);
      throw error;
    }
  }

  /**
   * Create appointment from session data
   */
  static async createAppointment(
    session: any,
    company: any,
    userPhone: string,
    options: CreateActionOptions = {},
  ): Promise<void> {
    try {
      const sendCitizenConfirmation = options.sendCitizenConfirmation !== false;
      const appointmentDate = ActionService.parseAppointmentDate(session.data);
      const appointmentTime = session.data.appointmentTime || "TBD";
      const appointmentData = {
        companyId: company._id,
        departmentId: ActionService.toObjectId(session.data.departmentId),
        subDepartmentId: ActionService.toObjectId(session.data.subDepartmentId),
        citizenName: session.data.citizenName,
        citizenPhone: userPhone,
        citizenWhatsApp: userPhone,
        citizenEmail: session.data.citizenEmail,
        purpose: session.data.purpose,
        appointmentDate,
        appointmentTime: appointmentTime,
        location: (session.data.latitude && session.data.longitude) 
          ? `Lat: ${session.data.latitude}, Long: ${session.data.longitude}${session.data.locationAddress ? `, Address: ${session.data.locationAddress}` : ''}`
          : undefined,
        status: AppointmentStatus.REQUESTED
      };
      
      const appointment = new Appointment(appointmentData);
      await appointment.save();
      
      session.data.appointmentId = appointment.appointmentId;
      session.data.id = appointment.appointmentId;
      session.data.status = 'REQUESTED';
      session.data.date = appointmentDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
      session.data.appointmentTime = appointmentTime;
      session.data.time = appointmentTime;
      await updateSession(session);
      
      if (appointment.departmentId) {
        const potentialAdmins = await getHierarchicalDepartmentAdmins(appointment.departmentId);
        const targetAdmin = findOptimalAdmin(potentialAdmins);
        
        if (targetAdmin) {
          appointment.assignedTo = targetAdmin._id;
          await appointment.save();
        }
      }

      const notificationData = {
        type: 'appointment' as const,
        appointmentId: appointment.appointmentId,
        citizenName: session.data.citizenName,
        citizenPhone: userPhone,
        citizenWhatsApp: userPhone,
        citizenEmail: session.data.citizenEmail,
        departmentId: appointment.departmentId as any,
        companyId: company._id,
        purpose: session.data.purpose,
        appointmentDate: appointment.appointmentDate,
        appointmentTime: appointment.appointmentTime,
        createdAt: appointment.createdAt,
        timeline: appointment.timeline,
        action: 'confirmation' as const
      };

      const createdAt = appointment.createdAt || new Date();
      const formattedDate = formatTemplateDate(new Date(createdAt));

      session.data.formattedDate = formattedDate;
      session.data.fullData = session.data.fullData || {};
      session.data.fullData.formattedDate = formattedDate;
      session.data.date = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
      session.data.time = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
      session.data['Submitted On'] = formattedDate;
      session.data.submittedOn = formattedDate;
      await updateSession(session);

      const notifications = [];

      const { notifyCitizenOnCreation, notifyDepartmentAdminOnCreation } = await import('./notificationService');
      
      if (sendCitizenConfirmation) {
        await notifyCitizenOnCreation(notificationData);
      }

      notifications.push(notifyDepartmentAdminOnCreation({
        ...notificationData,
        type: 'appointment',
        action: 'created',
      }));

      await Promise.allSettled(notifications);

    } catch (err: any) {
      console.error('❌ ActionService: Error creating appointment:', err);
      throw err;
    }
  }

  /**
   * Create lead from session data
   */
  static async createLead(session: any, company: any, userPhone: string): Promise<void> {
    try {
      const leadData = {
        companyId: company._id,
        name: session.data.citizenName || 'WhatsApp User',
        contactInfo: userPhone,
        projectType: session.data.projectType || 'General Inquiry',
        projectDescription: session.data.description || 'Lead captured from WhatsApp chatbot interaction.',
        budgetRange: session.data.budget || 'Not specified',
        timeline: session.data.timeline || 'Not specified',
        source: 'whatsapp',
        status: 'NEW',
        metadata: {
            from: userPhone,
            sessionData: session.data
        }
      };
      
      const lead = new Lead(leadData);
      await lead.save();
      
      session.data.leadId = lead.leadId;
      session.data.id = lead.leadId;
      await updateSession(session);
    } catch (err: any) {
      console.error('❌ ActionService: Error creating lead:', err);
      throw err;
    }
  }
}
