import express, { Request, Response } from 'express';
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
import { getTranslation } from '../services/chatbotEngine';

const router = express.Router();

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
router.put('/grievance/:id', requirePermission(Permission.STATUS_CHANGE_GRIEVANCE, Permission.UPDATE_GRIEVANCE), async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;
    const { status, remarks } = req.body;

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

    // Operators can only update status and remarks - validate request body
    if (currentUser.role === UserRole.OPERATOR) {
      const allowedFields = ['status', 'remarks'];
      const providedFields = Object.keys(req.body);
      const invalidFields = providedFields.filter(field => !allowedFields.includes(field));
      
      if (invalidFields.length > 0) {
        return res.status(403).json({
          success: false,
          message: `Operators can only update status and remarks. Invalid fields: ${invalidFields.join(', ')}`
        });
      }
    }

    const grievance = await Grievance.findById(req.params.id)
      .populate('companyId')
      .populate('departmentId');

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
    if (currentUser.role === UserRole.DEPARTMENT_ADMIN || currentUser.role === UserRole.OPERATOR) {
      if (grievance.departmentId?._id.toString() !== currentUser.departmentId?.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only update grievances in your department'
        });
      }
    } else if (currentUser.role === UserRole.COMPANY_ADMIN) {
      if (grievance.companyId._id.toString() !== currentUser.companyId?.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only update grievances in your company'
        });
      }
    }

    // oldStatus is already declared above for freeze check
    grievance.status = status;

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
        companyId: grievance.companyId,
        remarks: remarks,
        resolvedBy: currentUser._id,
        resolvedAt: grievance.resolvedAt,
        createdAt: grievance.createdAt,
        assignedAt: grievance.assignedAt,
        timeline: grievance.timeline
      });

      // Notify hierarchy about status change
      await notifyHierarchyOnStatusChange({
        type: 'grievance',
        action: 'resolved',
        grievanceId: grievance.grievanceId,
        citizenName: grievance.citizenName,
        citizenPhone: grievance.citizenPhone,
        departmentId: grievance.departmentId,
        companyId: grievance.companyId,
        assignedTo: grievance.assignedTo,
        remarks: remarks,
        resolvedBy: currentUser._id,
        resolvedAt: grievance.resolvedAt,
        createdAt: grievance.createdAt,
        assignedAt: grievance.assignedAt,
        timeline: grievance.timeline
      }, oldStatus, status);
    } else if (oldStatus !== status && [GrievanceStatus.ASSIGNED, GrievanceStatus.REJECTED, GrievanceStatus.PENDING].includes(status)) {
      // Notify citizen for ASSIGNED, REJECTED, PENDING (RESOLVED uses notifyCitizenOnResolution above)
      const { notifyCitizenOnGrievanceStatusChange } = await import('../services/notificationService');
      const departmentName = (grievance.departmentId as any)?.name || 'Department';
      await notifyCitizenOnGrievanceStatusChange({
        companyId: grievance.companyId,
        grievanceId: grievance.grievanceId,
        citizenName: grievance.citizenName,
        citizenPhone: grievance.citizenPhone,
        citizenWhatsApp: grievance.citizenWhatsApp,
        departmentName,
        newStatus: status,
        remarks: remarks || undefined
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
    const { status, remarks } = req.body;

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
    if (currentUser.role === UserRole.DEPARTMENT_ADMIN || currentUser.role === UserRole.OPERATOR) {
      if (appointment.departmentId?._id.toString() !== currentUser.departmentId?.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only update appointments in your department'
        });
      }
    } else if (currentUser.role === UserRole.COMPANY_ADMIN) {
      if (appointment.companyId._id.toString() !== currentUser.companyId?.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only update appointments in your company'
        });
      }
    }

    const oldStatus = appointment.status;
    appointment.status = status;

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
