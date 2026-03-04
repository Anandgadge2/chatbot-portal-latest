import mongoose from 'mongoose';
import Grievance from '../models/Grievance';
import Appointment from '../models/Appointment';
import Lead from '../models/Lead';
import User from '../models/User';
import Department from '../models/Department';
import { findDepartmentByCategory } from './departmentMapper';
import { notifyDepartmentAdminOnCreation, notifyUserOnAssignment } from './notificationService';
import { GrievanceStatus, AppointmentStatus, UserRole } from '../config/constants';
import { updateSession } from './sessionService';

/**
 * Action Service
 * 
 * Handles business logic for specialized chatbot actions like creating grievances,
 * appointments, and leads. Keeps DynamicFlowEngine lean.
 */
export class ActionService {
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

      // Sanitize media
      const validMediaTypes = ['image', 'document', 'video'];
      const sanitizedMedia = (session.data.media || []).filter(
        (m: any) => m && m.url && validMediaTypes.includes(m.type)
      );
      
      const grievanceData = {
        companyId: company._id,
        departmentId: departmentId || undefined,
        subDepartmentId: (session.data.subDepartmentId ? new mongoose.Types.ObjectId(session.data.subDepartmentId) : undefined),
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
      session.data.date = new Date(grievance.createdAt).toLocaleDateString('en-IN');
      
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
        const notifyTargetId = session.data.subDepartmentId || departmentId;
        
        await notifyDepartmentAdminOnCreation({
          type: 'grievance',
          action: 'created',
          grievanceId: grievance.grievanceId,
          citizenName: session.data.citizenName,
          citizenPhone: userPhone,
          citizenWhatsApp: userPhone,
          departmentId: notifyTargetId as any,
          companyId: company._id,
          description: session.data.description,
          category: session.data.category,
          departmentName: dept ? dept.name : session.data.category,
          subDepartmentName: subDept ? subDept.name : undefined,
          evidenceUrls: (session.data.media || []).map((m: any) => m.url).filter(Boolean),
          createdAt: grievance.createdAt,
          timeline: grievance.timeline
        });

        // Auto-assign to admin
        const targetAdmin = await User.findOne({
          departmentId: notifyTargetId,
          role: UserRole.DEPARTMENT_ADMIN,
          isActive: true
        });

        if (targetAdmin) {
          grievance.assignedTo = targetAdmin._id;
          await grievance.save();
          await notifyUserOnAssignment({
            type: 'grievance',
            action: 'assigned',
            grievanceId: grievance.grievanceId,
            citizenName: session.data.citizenName,
            citizenPhone: userPhone,
            citizenWhatsApp: userPhone,
            departmentId: notifyTargetId as any,
            companyId: company._id,
            assignedTo: targetAdmin._id,
            assignedByName: 'System (Auto-assign)',
            assignedAt: new Date(),
            description: session.data.description,
            category: session.data.category,
            createdAt: grievance.createdAt,
            timeline: grievance.timeline
          });
        }
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
      const appointmentDate = new Date(session.data.appointmentDate);
      const appointmentData = {
        companyId: company._id,
        departmentId: null,
        citizenName: session.data.citizenName,
        citizenPhone: userPhone,
        citizenWhatsApp: userPhone,
        purpose: session.data.purpose,
        appointmentDate,
        appointmentTime: session.data.appointmentTime,
        status: AppointmentStatus.SCHEDULED
      };
      
      const appointment = new Appointment(appointmentData);
      await appointment.save();
      
      session.data.appointmentId = appointment.appointmentId;
      session.data.id = appointment.appointmentId;
      session.data.status = 'Scheduled';
      await updateSession(session);
      
      await notifyDepartmentAdminOnCreation({
        type: 'appointment',
        action: 'created',
        appointmentId: appointment.appointmentId,
        citizenName: session.data.citizenName,
        citizenPhone: userPhone,
        citizenWhatsApp: userPhone,
        departmentId: undefined,
        companyId: company._id,
        purpose: session.data.purpose,
        appointmentDate: appointment.appointmentDate,
        appointmentTime: appointment.appointmentTime,
        createdAt: appointment.createdAt,
        timeline: appointment.timeline
      });
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
