import express, { Request, Response } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { requireDatabaseConnection } from '../middleware/dbConnection';
import { Permission, UserRole, GrievanceStatus, AppointmentStatus } from '../config/constants';
import Grievance from '../models/Grievance';
import Appointment from '../models/Appointment';
import Company from '../models/Company';
import { logUserAction } from '../utils/auditLogger';
import { AuditAction } from '../config/constants';
import { sendWhatsAppMessage } from '../services/whatsappService';
import { cloudinary } from '../config/cloudinary';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
});

const uploadBufferToCloudinary = async (
  file: Express.Multer.File,
  companyId: string,
): Promise<string | null> => {
  return new Promise((resolve) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `status_documents/${companyId}`,
        resource_type: 'auto',
      },
      (error: any, result: any) => {
        if (error) {
          console.error('❌ Cloudinary status document upload failed:', error);
          resolve(null);
          return;
        }
        resolve(result?.secure_url || null);
      },
    );
    uploadStream.end(file.buffer);
  });
};

// All routes require database connection and authentication
router.use(requireDatabaseConnection);
router.use(authenticate);

// Status update messages for WhatsApp
const getStatusMessage = (type: 'grievance' | 'appointment', id: string, status: string, remarks?: string) => {
  const emoji = {
    PENDING: '⏳',
    ASSIGNED: '👤',
    RESOLVED: '✅',
    SCHEDULED: '📅',
    COMPLETED: '🎉',
    CANCELLED: '❌'
  }[status] || '📋';

  const typeName = type === 'grievance' ? 'Grievance' : 'Appointment';
  
  let message = `${emoji} *${typeName} Status Update*\n\n`;
  message += `ID: *${id}*\n`;
  message += `Status: *${status.replace('_', ' ')}*\n`;
  
  if (remarks) {
    message += `\nRemarks: ${remarks}\n`;
  }
  
  message += `\nThank you for your patience. We are committed to serving you better.`;
  
  return message;
};

// @route   PUT /api/status/grievance/:id
// @desc    Update grievance status and notify citizen via WhatsApp
// @access  DepartmentAdmin, Operator, CompanyAdmin
router.put('/grievance/:id', requirePermission(Permission.STATUS_CHANGE_GRIEVANCE, Permission.UPDATE_GRIEVANCE), upload.array('documents', 5), async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;
    const { status, remarks } = req.body;
    const uploadedFiles = (req.files as Express.Multer.File[]) || [];

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    // Validate status
    const validStatuses = Object.values(GrievanceStatus);
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    // Restricted Update: If user has 'change status' but NOT full 'update' permission, limit fields
    // This replaces the old hardcoded 'OPERATOR' check.
    if (!req.checkPermission(Permission.UPDATE_GRIEVANCE)) {
      const allowedFields = ['status', 'remarks'];
      const providedFields = Object.keys(req.body);
      const invalidFields = providedFields.filter(field => !allowedFields.includes(field));
      
      if (invalidFields.length > 0) {
        return res.status(403).json({ 
          success: false, 
          message: 'Your role only allows updating status and remarks.' 
        });
      }
    }

    const grievance = await Grievance.findById(req.params.id)
      .populate('companyId')
      .populate('departmentId')
      .populate('subDepartmentId');

    if (!grievance) {
      return res.status(404).json({
        success: false,
        message: 'Grievance not found'
      });
    }

    // Prevent updates to resolved/rejected grievances (frozen) - except for super admin
    const oldStatus = grievance.status;
    if ((oldStatus === GrievanceStatus.RESOLVED || oldStatus === GrievanceStatus.REJECTED) && currentUser.role !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({
        success: false,
        message: 'Cannot update a resolved or rejected grievance. Grievance is frozen.'
      });
    }

    // Permission checks
    // Permission checks
    if (currentUser.role !== UserRole.SUPER_ADMIN) {
      if (grievance.companyId._id.toString() !== currentUser.companyId?.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied to this company' });
      }

      if (currentUser.departmentId) {
        const grievanceDepartmentId = (grievance.departmentId as any)?._id?.toString() || grievance.departmentId?.toString();
        const grievanceSubDepartmentId = (grievance.subDepartmentId as any)?._id?.toString() || grievance.subDepartmentId?.toString();
        const currentUserDepartmentId = currentUser.departmentId?.toString();

        if (
          grievanceDepartmentId !== currentUserDepartmentId &&
          grievanceSubDepartmentId !== currentUserDepartmentId
        ) {
          return res.status(403).json({ success: false, message: 'Access denied to this department' });
        }
      }
    }

    // oldStatus is already declared above for freeze check
    grievance.status = status;

    const uploadedDocumentUrls: string[] = [];
    if (status === GrievanceStatus.RESOLVED && uploadedFiles.length > 0) {
      if (!Array.isArray(grievance.media)) {
        grievance.media = [] as any;
      }
      for (const file of uploadedFiles) {
        const cloudUrl = await uploadBufferToCloudinary(
          file,
          String(grievance.companyId._id || grievance.companyId),
        );
        if (cloudUrl) {
          uploadedDocumentUrls.push(cloudUrl);
          grievance.media.push({
            url: cloudUrl,
            type: file.mimetype.startsWith('image/') ? 'image' : 'document',
            uploadedAt: new Date(),
            uploadedBy: currentUser._id
          } as any);
        }
      }
    }

    // Add to status history
    if (!grievance.statusHistory) {
      grievance.statusHistory = [];
    }
    grievance.statusHistory.push({
      status,
      remarks,
      changedBy: currentUser._id,
      changedAt: new Date()
    });

    // Update timestamps based on status
    if (status === GrievanceStatus.RESOLVED && !grievance.resolvedAt) {
      grievance.resolvedAt = new Date();
    }

    // Add to timeline
    if (!grievance.timeline) {
      grievance.timeline = [];
    }
    grievance.timeline.push({
      action: 'STATUS_UPDATED',
      details: {
        fromStatus: oldStatus,
        toStatus: status,
        remarks
      },
      performedBy: currentUser._id,
      timestamp: new Date()
    });

    await grievance.save();

    // Notify citizen and hierarchy if status changed to RESOLVED
    if (oldStatus !== GrievanceStatus.RESOLVED && status === GrievanceStatus.RESOLVED) {
      const { notifyCitizenOnResolution, notifyHierarchyOnStatusChange } = await import('../services/notificationService');
      
      await notifyCitizenOnResolution({
        type: 'grievance',
        action: 'resolved',
        grievanceId: grievance.grievanceId,
        citizenName: grievance.citizenName,
        citizenPhone: grievance.citizenPhone,
        citizenWhatsApp: grievance.citizenWhatsApp,
        departmentId: grievance.departmentId,
        subDepartmentId: grievance.subDepartmentId,
        companyId: grievance.companyId,
        remarks: remarks,
        evidenceUrls: uploadedDocumentUrls,
        resolvedBy: currentUser._id,
        resolvedAt: grievance.resolvedAt,
        createdAt: grievance.createdAt,
        assignedAt: grievance.assignedAt,
        timeline: grievance.timeline
      });

      // Notify hierarchy about status change for ALL updates
      await notifyHierarchyOnStatusChange({
        type: 'grievance',
        action: (status === GrievanceStatus.RESOLVED ? 'resolved' : 'status_update') as any,
        grievanceId: grievance.grievanceId,
        citizenName: grievance.citizenName,
        citizenPhone: grievance.citizenPhone,
        departmentId: grievance.departmentId,
        subDepartmentId: grievance.subDepartmentId,
        companyId: grievance.companyId,
        assignedTo: grievance.assignedTo,
        remarks: remarks,
        evidenceUrls: uploadedDocumentUrls,
        resolvedBy: currentUser._id,
        resolvedAt: grievance.resolvedAt,
        createdAt: grievance.createdAt,
        assignedAt: grievance.assignedAt,
        timeline: grievance.timeline,
        resolvedByName: currentUser.getFullName()
      }, oldStatus, status);
    } 
    
    if (oldStatus !== status && [GrievanceStatus.ASSIGNED, GrievanceStatus.REJECTED, GrievanceStatus.PENDING, GrievanceStatus.REVERTED].includes(status as any)) {
      // Notify citizen for ASSIGNED, REJECTED, PENDING (RESOLVED uses notifyCitizenOnResolution above)
      const { notifyCitizenOnGrievanceStatusChange } = await import('../services/notificationService');
      const departmentName = (grievance.departmentId as any)?.name || 'Department';
      await notifyCitizenOnGrievanceStatusChange({
        companyId: grievance.companyId,
        grievanceId: grievance.grievanceId,
        citizenName: grievance.citizenName,
        citizenPhone: grievance.citizenPhone,
        citizenWhatsApp: grievance.citizenWhatsApp,
        departmentId: grievance.departmentId,
        subDepartmentId: grievance.subDepartmentId,
        departmentName,
        newStatus: status,
        remarks: remarks || undefined,
        evidenceUrls: uploadedDocumentUrls,
      });
    }

    await logUserAction(
      req,
      AuditAction.UPDATE,
      'Grievance',
      grievance._id.toString(),
      {
        action: 'status_change',
        oldStatus,
        newStatus: status,
        remarks,
        uploadedDocumentUrls,
        grievanceId: grievance.grievanceId
      }
    );

    res.json({
      success: true,
      message: 'Grievance status updated successfully. Citizen has been notified via WhatsApp.',
      data: { grievance }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to update grievance status',
      error: error.message
    });
  }
});

// @route   PUT /api/status/appointment/:id
// @desc    Update appointment status and notify citizen via WhatsApp
// @access  DepartmentAdmin, Operator, CompanyAdmin
router.put('/appointment/:id', requirePermission(Permission.STATUS_CHANGE_APPOINTMENT, Permission.UPDATE_APPOINTMENT), async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;
    const { status, remarks, appointmentDate, appointmentTime, description } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    const validStatuses = Object.values(AppointmentStatus);
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    const appointment = await Appointment.findById(req.params.id)
      .populate('companyId')
      .populate('departmentId');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Permission checks
    // Permission checks
    if (currentUser.role !== UserRole.SUPER_ADMIN) {
      if (appointment.companyId._id.toString() !== currentUser.companyId?.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied to this company' });
      }

      if (currentUser.departmentId) {
        if (appointment.departmentId?._id.toString() !== currentUser.departmentId?.toString()) {
          return res.status(403).json({ success: false, message: 'Access denied to this department' });
        }
      }
    }

    const oldStatus = appointment.status;
    appointment.status = status;

    if (status === AppointmentStatus.CONFIRMED) {
      if (!appointmentDate || !appointmentTime) {
        return res.status(400).json({ success: false, message: 'Appointment date and time are required when confirming appointment' });
      }
      appointment.appointmentDate = new Date(appointmentDate);
      appointment.appointmentTime = appointmentTime;
      if (description) {
        appointment.notes = description;
      }
    }

    // Add to status history
    if (!appointment.statusHistory) {
      appointment.statusHistory = [];
    }
    appointment.statusHistory.push({
      status,
      remarks,
      changedBy: currentUser._id,
      changedAt: new Date()
    });

    // Update timestamps
    if (status === AppointmentStatus.COMPLETED && !appointment.completedAt) {
      appointment.completedAt = new Date();
    } else if (status === AppointmentStatus.CANCELLED && !appointment.cancelledAt) {
      appointment.cancelledAt = new Date();
    }

    // Add to timeline
    if (!appointment.timeline) {
      appointment.timeline = [];
    }
    appointment.timeline.push({
      action: 'STATUS_UPDATED',
      details: {
        fromStatus: oldStatus,
        toStatus: status,
        remarks
      },
      performedBy: currentUser._id,
      timestamp: new Date()
    });

    await appointment.save();

    // Notify citizen based on status change
    const { notifyCitizenOnAppointmentStatusChange } = await import('../services/notificationService');
    
    if (oldStatus !== status) {
      await notifyCitizenOnAppointmentStatusChange({
        appointmentId: appointment.appointmentId,
        citizenName: appointment.citizenName,
        citizenPhone: appointment.citizenPhone,
        citizenWhatsApp: appointment.citizenWhatsApp,
        companyId: appointment.companyId,
        oldStatus,
        newStatus: status,
        remarks: remarks || '',
        appointmentDate: appointment.appointmentDate,
        appointmentTime: appointment.appointmentTime,
        purpose: appointment.purpose
      });

      // ✅ Hierarchical Admin Notification: For ALL status changes
      const { notifyHierarchyOnStatusChange } = await import('../services/notificationService');
      await notifyHierarchyOnStatusChange({
        type: 'appointment',
        action: (status === AppointmentStatus.COMPLETED || status === AppointmentStatus.CANCELLED) ? 'resolved' : 'status_update', 
        appointmentId: appointment.appointmentId,
        citizenName: appointment.citizenName,
        citizenPhone: appointment.citizenPhone,
        departmentId: appointment.departmentId,
        companyId: appointment.companyId,
        remarks: remarks || '',
        resolvedBy: currentUser._id,
        resolvedAt: new Date(),
        createdAt: appointment.createdAt,
        appointmentDate: appointment.appointmentDate,
        appointmentTime: appointment.appointmentTime,
        timeline: appointment.timeline
      }, oldStatus, status);
    }

    await logUserAction(
      req,
      AuditAction.UPDATE,
      'Appointment',
      appointment._id.toString(),
      {
        action: 'status_change',
        oldStatus,
        newStatus: status,
        remarks,
        appointmentId: appointment.appointmentId
      }
    );

    res.json({
      success: true,
      message: 'Appointment status updated successfully. Citizen has been notified via WhatsApp.',
      data: { appointment }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to update appointment status',
      error: error.message
    });
  }
});

export default router;
