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
import { ForestService } from './forestService';
import CitizenProfile from '../models/CitizenProfile';
import { enforceDailyLimitOrThrow } from './grievanceRateLimitService';
import { sanitizeGrievanceDetails } from '../utils/sanitize';
import {
  triggerAdminTemplate,
  triggerCitizenSubmissionTemplate,
  triggerGrievanceNotifications
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
      // If the user has reached this step in the flow, they have likely already passed the consent nodes.
      const hasConsent = session?.data?.citizenConsent === true || session?.data?.hasConsent === true;
      
      if (!hasConsent && !session?.data?.flowId) {
        throw new Error('Citizen consent is required before grievance creation');
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
        throw new Error('Department selection is compulsory. Please select a department to proceed.');
      }

      // Collect media from session.data.media[] (array) AND any plain-string attachment fields.
      // The grievance flow may save the upload to session.data.attachmentUrl (string) because
      // the input step's saveToField is 'attachmentUrl', not 'media'.
      const validMediaTypes = ['image', 'document', 'video'];
      const mediaFromArray: any[] = (session.data.media || []).filter(
        (m: any) => m && m.url && validMediaTypes.includes(m.type)
      );

      // Detect uploaded files stored as plain strings in common field names
      const extraAttachmentFields = ['attachmentUrl', 'attachment', 'fileUrl', 'documentUrl', 'mediaUrl'];
      const extraMedia: any[] = [];
      const existingUrls = new Set(mediaFromArray.map(m => m.url));

      for (const field of extraAttachmentFields) {
        const val = session.data[field];
        if (val && typeof val === 'string' && val.startsWith('http')) {
          if (!existingUrls.has(val)) {
            // Guess type: if URL contains 'image' or ends with image extension → image, else document
            const isImg = /\.(jpe?g|png|gif|webp|bmp)(\?|$)/i.test(val) || val.includes('/image/') || val.toLowerCase().includes('image');
            extraMedia.push({ url: val, type: isImg ? 'image' : 'document', uploadedAt: new Date(), isCloudinary: val.includes('cloudinary') });
            existingUrls.add(val);
          }
        }
      }

      const sanitizedMedia = [...mediaFromArray, ...extraMedia];
      const safeDescription = sanitizeGrievanceDetails(session.data.description || '');
      
      const grievanceData = {
        companyId: company._id,
        departmentId: departmentId || undefined,
        subDepartmentId: subDepartmentId || undefined,
        citizenName: session.data.citizenName,
        citizenPhone: userPhone,
        phone_number: userPhone,
        citizenWhatsApp: userPhone,
        description: safeDescription,
        message: safeDescription,
        category: session.data.category,
        media: sanitizedMedia,
        location: (session.data.latitude && session.data.longitude || session.data.locationAddress) ? {
          type: 'Point',
          coordinates: (session.data.latitude && session.data.longitude) 
            ? [Number(session.data.longitude), Number(session.data.latitude)] 
            : [0, 0], // Placeholder if only address is provided
          address: session.data.locationAddress || ''
        } : undefined,
        status: GrievanceStatus.PENDING,
        admin_consent: false,
        priority: (session.data.category?.toLowerCase().includes('fire') || 
                   session.data.category?.toLowerCase().includes('wildlife') || 
                   session.data.category?.toLowerCase().includes('animal')) ? 'HIGH' : 'MEDIUM',
        language: session.language || 'en'
      };
      
      // 🌲 Forest-Specific Logic: Auto-Lookup Area and Officer
      let forestArea = null;
      const hasCoords = session.data.latitude && session.data.longitude && 
                       Number(session.data.latitude) !== 0 && Number(session.data.longitude) !== 0;

      if (hasCoords) {
        forestArea = await ForestService.findAreaByLocation(
          Number(session.data.longitude),
          Number(session.data.latitude),
          company._id
        );
        if (forestArea) {
          (grievanceData as any).forestAreaId = forestArea.areaId;
          // Store area details for placeholders/notifications
          session.data.forest_range = forestArea.metadata.range || 'Unknown Range';
          session.data.forest_beat = forestArea.metadata.beat || 'Unknown Beat';
          session.data.forest_compartment = forestArea.name || forestArea.areaId;
        } else {
          console.warn(`📍 ActionService: Location [${session.data.latitude}, ${session.data.longitude}] is outside forest boundaries.`);
          session.data.forest_range = 'Outside Area';
          session.data.forest_beat = 'Unmapped';
          session.data.forest_compartment = 'N/A';
        }
      } else {
        // Fallback for no location
        session.data.forest_range = 'N/A';
        session.data.forest_beat = 'N/A';
        session.data.forest_compartment = 'Not Shared';
      }

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
            name: session.data.citizenName || '',
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
      
      // Update session with results for placeholders
      session.data.grievanceId = grievance.grievanceId;
      session.data.id = grievance.grievanceId;
      session.data.status = 'PENDING';
      session.data.date = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
      session.data.time = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
      
      const dept = departmentId ? await Department.findById(departmentId) : null;
      const subDept = subDepartmentId ? await Department.findById(subDepartmentId) : null;
      
      const lang = (session.language || 'en') as 'en' | 'hi' | 'or' | 'mr';
      
      // Set explicit fields for placeholder resolution in success/confirm steps
      session.data.department = dept ? getLocalizedDepartmentName(dept, lang) : (session.data.category || 'General');
      session.data.subDepartment = subDept ? getLocalizedDepartmentName(subDept, lang) : '';
      session.data.subDepartmentName = subDept ? getLocalizedDepartmentName(subDept, lang) : '';
      
      // Keep departmentName the parent-only name for display
      session.data.departmentName = dept ? getLocalizedDepartmentName(dept, lang) : (session.data.category || 'General');      
      session.data.subdepartmentName = subDept ? getLocalizedDepartmentName(subDept, lang) : '';
      
      // Odia & Hindi translated keys for session placeholders to match user request
      session.data['ଗ୍ରିଭନ୍ସଆଇଡି'] = grievance.grievanceId;
      session.data['ବିଭାଗନାମ'] = session.data.departmentName;
      session.data['ଉପବିଭାଗନାମ'] = session.data.subDepartmentName;
      session.data['ବର୍ଣ୍ଣନା'] = session.data.description;
      // Build evidence URL string for success notification
      const evidenceUrls = (session.data.media || []).map((m: any) => m.url).filter(Boolean);
      session.data.evidenceUrl = evidenceUrls.length > 0 ? evidenceUrls.join(', ') : '';
      
      await updateSession(session);

      // ✅ AUTO-ASSIGNMENT (Designated Officer / Dept Admin)
      let autoAssigned = false;
      let assignedAdmins: any[] = [];

      // 🌲 Forest-Specific Assignment & Multi-Notification
      if (forestArea) {
        const forestOfficers = await ForestService.findOfficersByArea(forestArea.areaId, company._id);
        if (forestOfficers && forestOfficers.length > 0) {
          // Point the grievance to the first officer primarily (for display), 
          // but we will notify ALL of them.
          const primaryOfficer = forestOfficers[0];
          grievance.assignedTo = primaryOfficer._id;
          grievance.status = GrievanceStatus.ASSIGNED;
          await grievance.save();
          autoAssigned = true;
          assignedAdmins = forestOfficers;
          session.data.assignedToName = forestOfficers.map(o => o.getFullName()).join(', ');
          
          // Store all target officers for the notification loop below
          (grievance as any)._allTargetOfficers = forestOfficers;
        }
      }

      // Fallback to Department Admin assignment
      if (!autoAssigned) {
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
          }
        }
      }

      await updateSession(session);
      
      // ✅ PREPARE NOTIFICATIONS
      logger.info(`🔍 [ActionService] Creating Grievance ${grievance.grievanceId}. Session Desc: "${session.data.description || ''}", Flow Prop: "${session.data.grievance_description || ''}"`);
      const notificationData = {
        grievanceId: grievance.grievanceId,
        citizenName: session.data.citizenName,
        citizenPhone: userPhone,
        citizenWhatsApp: userPhone,
        language: session.language || 'en',
        departmentId: departmentId as any,
        subDepartmentId: subDepartmentId,
        companyId: company._id,
        description: safeDescription || session.data.grievance_description || 'N/A',
        category: session.data.category,
        departmentName: dept ? dept.name : session.data.category,
        subDepartmentName: subDept ? subDept.name : undefined,
        evidenceUrls: (session.data.media || []).map((m: any) => m.url).filter(Boolean),
        createdAt: grievance.createdAt,
        timeline: grievance.timeline,
        forest_range: session.data.forest_range,
        forest_beat: session.data.forest_beat,
        type: 'grievance' as const,
        action: 'confirmation' as const,
        citizenEmail: session.data.citizenEmail
      };

      // ✅ EXECUTE NOTIFICATIONS IN PARALLEL
      const createdAt = grievance.createdAt || new Date();
      const formattedDate = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }).format(new Date(createdAt));

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

      // Email notifications for admins are preserved in the legacy notification service.
      notifications.push(notifyDepartmentAdminOnCreation({
        ...notificationData,
        type: 'grievance',
        action: 'created',
      }));

      notifications.push(
        triggerGrievanceNotifications({
          companyId: company._id,
          grievanceId: grievance.grievanceId,
          citizenName: session.data.citizenName || '',
          citizenPhone: userPhone,
          category: session.data.category || 'General',
          subDepartmentName: session.data.subDepartmentName || 'N/A',
          description: safeDescription,
          status: grievance.status,
          language: session.language || 'en',
          assignedAdmins
        })
      );

      if (sendCitizenConfirmation) {
        notifications.push(
          triggerCitizenSubmissionTemplate({
            companyId: company._id,
            citizenPhone: userPhone,
            citizenName: session.data.citizenName || 'Citizen',
            grievanceId: grievance.grievanceId,
            departmentName: session.data.departmentName || session.data.category || 'General',
            subDepartmentName: session.data.subDepartmentName || 'N/A',
            grievanceDetails: safeDescription || session.data.grievance_description || 'N/A',
            language: session.language || 'en'
          })
        );
      }

      const notificationResults = await Promise.allSettled(notifications);
      const failedNotifications = notificationResults.filter(
        (result) => result.status === 'rejected'
      ) as PromiseRejectedResult[];

      if (failedNotifications.length > 0) {
        logger.error(
          `⚠️ createGrievance completed but ${failedNotifications.length} notification task(s) failed.`,
          failedNotifications.map((item) => item.reason)
        );
      }
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
      
      // ✅ AUTO-ASSIGNMENT for Appointment
      if (appointment.departmentId) {
        const potentialAdmins = await getHierarchicalDepartmentAdmins(appointment.departmentId);
        const targetAdmin = findOptimalAdmin(potentialAdmins);
        
        if (targetAdmin) {
          appointment.assignedTo = targetAdmin._id;
          await appointment.save();
        }
      }

      // ✅ PREPARE NOTIFICATIONS
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
      const formattedDate = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }).format(new Date(createdAt));

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
      
      // Notify citizen only when flow does not already show a success/confirmation node.
      // This prevents duplicate success messages in WhatsApp chats.
      if (sendCitizenConfirmation) {
        await notifyCitizenOnCreation(notificationData);
      }

      // 2. Admin Creation Notification — Hierarchy Only
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
