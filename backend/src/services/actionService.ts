import mongoose from 'mongoose';
import Grievance from '../models/Grievance';
import Appointment from '../models/Appointment';
import Lead from '../models/Lead';
import User from '../models/User';
import Department from '../models/Department';
import { findDepartmentByCategory } from './departmentMapper';
import { 
  notifyDepartmentAdminOnCreation, 
  notifyUserOnAssignment, 
  notifyCitizenOnCreation,
  notifyCitizenOnGrievanceStatusChange, 
  notifyCitizenOnAppointmentStatusChange,
  getHierarchicalDepartmentAdmins
} from './notificationService';
import { GrievanceStatus, AppointmentStatus, UserRole } from '../config/constants';
import { updateSession } from './sessionService';

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
  static async createGrievance(session: any, company: any, userPhone: string): Promise<void> {
    try {
      let departmentId: mongoose.Types.ObjectId | null = null;
      
      if (session.data.departmentId) {
        try {
          departmentId = typeof session.data.departmentId === 'string'
            ? new mongoose.Types.ObjectId(session.data.departmentId)
            : session.data.departmentId;
        } catch {
          departmentId = await findDepartmentByCategory(company._id, session.data.category);
        }
      }
      
      if (!departmentId && session.data.category) {
        departmentId = await findDepartmentByCategory(company._id, session.data.category);
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
      
      const grievanceData = {
        companyId: company._id,
        departmentId: departmentId || undefined,
        subDepartmentId: ActionService.toObjectId(session.data.subDepartmentId),
        citizenName: session.data.citizenName,
        citizenPhone: userPhone,
        citizenWhatsApp: userPhone,
        description: session.data.description,
        category: session.data.category,
        media: sanitizedMedia,
        status: GrievanceStatus.PENDING,
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
      
      // Update session with results for placeholders
      session.data.grievanceId = grievance.grievanceId;
      session.data.id = grievance.grievanceId;
      session.data.status = 'PENDING';
      session.data.date = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
      session.data.time = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
      
      const dept = departmentId ? await Department.findById(departmentId) : null;
      const subDept = session.data.subDepartmentId ? await Department.findById(session.data.subDepartmentId) : null;
      // Set explicit fields for placeholder resolution in success/confirm steps
      session.data.department = dept ? dept.name : (session.data.category || 'General');
      session.data.subDepartment = subDept ? subDept.name : '';
      session.data.subDepartmentName = subDept ? subDept.name : '';
      // Keep departmentName the parent-only name for display
      session.data.departmentName = dept ? dept.name : (session.data.category || 'General');
      
      // Build evidence URL string for success notification
      const evidenceUrls = (session.data.media || []).map((m: any) => m.url).filter(Boolean);
      session.data.evidenceUrl = evidenceUrls.length > 0 ? evidenceUrls.join(', ') : '';
      
      await updateSession(session);
      
      if (departmentId) {
        // ✅ Notify Admins about creation
        try {
          await notifyDepartmentAdminOnCreation({
            type: 'grievance',
            action: 'created',
            grievanceId: grievance.grievanceId,
            citizenName: session.data.citizenName,
            citizenPhone: userPhone,
            citizenWhatsApp: userPhone,
            departmentId: departmentId as any,
            subDepartmentId: session.data.subDepartmentId,
            companyId: company._id,
            description: session.data.description,
            category: session.data.category,
            departmentName: dept ? dept.name : session.data.category,
            subDepartmentName: subDept ? subDept.name : undefined,
            evidenceUrls: (session.data.media || []).map((m: any) => m.url).filter(Boolean),
            createdAt: grievance.createdAt,
            timeline: grievance.timeline
          });
        } catch (notifyErr) {
          console.error('⚠️ ActionService: notifyDepartmentAdminOnCreation failed for grievance:', notifyErr);
        }

        // ✅ AUTO-ASSIGNMENT (Designated Officer / Dept Admin)
        const targetDeptId = session.data.subDepartmentId || departmentId;
        const potentialAdmins = await getHierarchicalDepartmentAdmins(targetDeptId);
        
        if (potentialAdmins && potentialAdmins.length > 0) {
          const targetAdmin = potentialAdmins[0]; // Pick the primary/level-specific admin
          
          grievance.assignedTo = targetAdmin._id;
          grievance.status = GrievanceStatus.ASSIGNED;
          await grievance.save();
          
          console.log(`🎯 Auto-assigned grievance ${grievance.grievanceId} to admin: ${targetAdmin.email}`);

          try {
            await notifyUserOnAssignment({
              type: 'grievance',
              action: 'assigned',
              grievanceId: grievance.grievanceId,
              citizenName: session.data.citizenName,
              citizenPhone: userPhone,
              citizenWhatsApp: userPhone,
              departmentId: departmentId as any,
              subDepartmentId: session.data.subDepartmentId,
              companyId: company._id,
              assignedTo: targetAdmin._id,
              assignedByName: 'System (Auto-assign)',
              assignedAt: new Date(),
              description: session.data.description,
              category: session.data.category,
              createdAt: grievance.createdAt,
              timeline: grievance.timeline
            });
          } catch (assignNotifyErr) {
            console.error('⚠️ ActionService: notifyUserOnAssignment failed for grievance:', assignNotifyErr);
          }
        }

      }

      // ✅ Notify citizen about registration (Immediate Success Message)
      // NOTE: this should happen even when department auto-mapping fails.
      try {
        await notifyCitizenOnCreation({
          type: 'grievance',
          action: 'created',
          grievanceId: grievance.grievanceId,
          citizenName: session.data.citizenName,
          citizenPhone: userPhone,
          citizenWhatsApp: userPhone,
          departmentId: departmentId as any,
          subDepartmentId: session.data.subDepartmentId,
          companyId: company._id,
          description: session.data.description,
          category: session.data.category,
          departmentName: dept ? dept.name : session.data.category,
          subDepartmentName: subDept ? subDept.name : undefined,
          createdAt: grievance.createdAt,
          timeline: grievance.timeline
        });
      } catch (citizenNotifyErr) {
        console.error('⚠️ ActionService: notifyCitizenOnCreation failed for grievance:', citizenNotifyErr);
      }
    } catch (err: any) {
      console.error('❌ ActionService: Error creating grievance:', err);
      throw err;
    }
  }

  /**
   * Create appointment from session data
   */
  static async createAppointment(session: any, company: any, userPhone: string): Promise<void> {
    try {
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
        if (potentialAdmins && potentialAdmins.length > 0) {
          const targetAdmin = potentialAdmins[0];
          appointment.assignedTo = targetAdmin._id;
          // Keep status as REQUESTED or change to SCHEDULED/CONFIRMED if needed
          // Typically stays REQUESTED for initial review but assigned to someone.
          await appointment.save();
          console.log(`🎯 Auto-assigned appointment ${appointment.appointmentId} to admin: ${targetAdmin.email}`);
        }
      }

      try {
        await notifyDepartmentAdminOnCreation({
          type: 'appointment',
          action: 'created',
          appointmentId: appointment.appointmentId,
          citizenName: session.data.citizenName,
          citizenPhone: userPhone,
          citizenWhatsApp: userPhone,
          departmentId: appointment.departmentId as any,
          companyId: company._id,
          purpose: session.data.purpose,
          appointmentDate: appointment.appointmentDate,
          appointmentTime: appointment.appointmentTime,
          createdAt: appointment.createdAt,
          timeline: appointment.timeline
        });
      } catch (notifyErr) {
        console.error('⚠️ ActionService: notifyDepartmentAdminOnCreation failed for appointment:', notifyErr);
      }

      // ✅ Notify citizen about appointment request (Immediate Confirmation)
      try {
        await notifyCitizenOnCreation({
          type: 'appointment',
          action: 'created',
          appointmentId: appointment.appointmentId,
          citizenName: session.data.citizenName,
          citizenPhone: userPhone,
          citizenWhatsApp: userPhone,
          companyId: company._id,
          departmentId: appointment.departmentId as any,
          purpose: appointment.purpose,
          appointmentDate: appointment.appointmentDate,
          appointmentTime: appointment.appointmentTime,
          createdAt: appointment.createdAt,
          timeline: appointment.timeline
        });
      } catch (citizenNotifyErr) {
        console.error('⚠️ ActionService: notifyCitizenOnCreation failed for appointment:', citizenNotifyErr);
      }
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
