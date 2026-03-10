import express, { Request, Response } from 'express';
import User from '../models/User';
import Appointment from '../models/Appointment';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { requireDatabaseConnection } from '../middleware/dbConnection';
import { logUserAction } from '../utils/auditLogger';
import { AuditAction, Permission, UserRole, AppointmentStatus } from '../config/constants';

const router = express.Router();

// All routes require database connection and authentication
router.use(requireDatabaseConnection);
router.use(authenticate);

// @route   GET /api/appointments
// @desc    Get all appointments (scoped by role)
// @access  Private
router.get('/', requirePermission(Permission.READ_APPOINTMENT), async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, status, companyId, departmentId, assignedTo, date } = req.query;
    const currentUser = req.user!;

    const query: any = {};

    // Scope based on user role
    if (currentUser.role === UserRole.SUPER_ADMIN) {
      // SuperAdmin can see all appointments, but can filter by companyId if provided
      if (companyId) query.companyId = companyId;
    } else {
      // All other roles are scoped by their company
      query.companyId = currentUser.companyId;

      if (currentUser.departmentId) {
        // Dynamic check: Users without status change permission (like basic Operators) only see their own items
        const canManage = req.checkPermission(Permission.STATUS_CHANGE_APPOINTMENT);
        if (!canManage) {
          query.assignedTo = currentUser._id;
        } else {
          query.departmentId = currentUser.departmentId;
        }
      }
    }

    // Apply filters
    if (status) query.status = status;
    // Note: departmentId filter removed - appointments are CEO-only (no department)
    // For Company Admin, show all appointments including CEO appointments (null departmentId)
    // MongoDB query will return appointments with null/undefined departmentId automatically
    if (assignedTo) query.assignedTo = assignedTo;
    if (date) {
      const startDate = new Date(date as string);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      query.appointmentDate = { $gte: startDate, $lt: endDate };
    }

    // List appointments

    const appointments = await Appointment.find(query)
      .populate('companyId', 'name companyId')
      .populate('departmentId', 'name departmentId')
      .populate('assignedTo', 'firstName lastName email')
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .sort({ createdAt: -1, appointmentDate: 1, appointmentTime: 1 }); // Newest first

    const total = await Appointment.countDocuments(query);

    res.json({
      success: true,
      data: {
        appointments,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch appointments',
      error: error.message
    });
  }
});

// @route   POST /api/appointments
// @desc    Create new appointment (usually from WhatsApp webhook)
// @access  Public (for WhatsApp integration)
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      companyId,
      departmentId,
      citizenName,
      citizenPhone,
      citizenWhatsApp,
      citizenEmail,
      purpose,
      appointmentDate,
      appointmentTime,
      duration,
      location
    } = req.body;

    // Validation
    if (!companyId || !citizenName || !citizenPhone || !purpose || !appointmentDate || !appointmentTime) {
      res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
      return;
    }

    const appointment = await Appointment.create({
      companyId,
      departmentId,
      citizenName,
      citizenPhone,
      citizenWhatsApp: citizenWhatsApp || citizenPhone,
      citizenEmail,
      purpose,
      appointmentDate: new Date(appointmentDate),
      appointmentTime,
      duration: duration || 30,
      location,
      status: AppointmentStatus.SCHEDULED
    });
    
    // ✅ AUTO-ASSIGNMENT (Designated Officer / Dept Admin)
    const { getHierarchicalDepartmentAdmins, notifyDepartmentAdminOnCreation, notifyCitizenOnCreation } = await import('../services/notificationService');
    const potentialAdmins = await getHierarchicalDepartmentAdmins(appointment.departmentId);
    
    if (potentialAdmins && potentialAdmins.length > 0) {
      const targetAdmin = potentialAdmins[0];
      appointment.assignedTo = targetAdmin._id;
      // We keep status as SCHEDULED but assign it to someone for review/management
      await appointment.save();
      console.log(`🎯 Auto-assigned portal appointment ${appointment.appointmentId} to admin: ${targetAdmin.email}`);
    }

    // ✅ Notify Admins and Citizen about the new appointment creation
    const notificationPayload = {
      type: 'appointment' as const,
      action: 'created' as const,
      appointmentId: appointment.appointmentId,
      citizenName: appointment.citizenName,
      citizenPhone: appointment.citizenPhone,
      citizenWhatsApp: appointment.citizenWhatsApp,
      citizenEmail: appointment.citizenEmail,
      companyId: appointment.companyId,
      departmentId: appointment.departmentId,
      purpose: appointment.purpose,
      appointmentDate: appointment.appointmentDate,
      appointmentTime: appointment.appointmentTime,
      createdAt: appointment.createdAt,
      timeline: appointment.timeline
    };

    await notifyDepartmentAdminOnCreation(notificationPayload).catch(err => console.error('❌ Admin Appointment Notification failed:', err));
    await notifyCitizenOnCreation(notificationPayload).catch(err => console.error('❌ Citizen Appointment Confirmation failed:', err));

    res.status(201).json({
      success: true,
      message: 'Appointment booked successfully',
      data: { appointment }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to create appointment',
      error: error.message
    });
  }
});

// @route   GET /api/appointments/:id
// @desc    Get appointment by ID
// @access  Private
router.get('/:id', requirePermission(Permission.READ_APPOINTMENT), async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;
    const appointment = await Appointment.findById(req.params.id)
      .populate('companyId', 'name companyId')
      .populate('departmentId', 'name departmentId')
      .populate('assignedTo', 'firstName lastName email')
      .populate('statusHistory.changedBy', 'firstName lastName')
      .populate('timeline.performedBy', 'firstName lastName role');

    if (!appointment) {
      res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
      return;
    }

    // Check access
    if (currentUser.role !== UserRole.SUPER_ADMIN) {
      const apptCompanyId = appointment.companyId?._id?.toString() || appointment.companyId?.toString();
      if (apptCompanyId && apptCompanyId !== currentUser.companyId?.toString()) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }
      
      if (currentUser.departmentId) {
        // Dynamic check: Users without status change permission only see their own items
        const canManage = req.checkPermission(Permission.STATUS_CHANGE_APPOINTMENT);
        if (!canManage) {
          if (appointment.assignedTo?._id?.toString() !== currentUser._id.toString()) {
            res.status(403).json({ success: false, message: 'Access denied' });
            return;
          }
        } else {
          // Dept-level scoping
          if (appointment.departmentId?._id?.toString() !== currentUser.departmentId?.toString()) {
            res.status(403).json({ success: false, message: 'Access denied' });
            return;
          }
        }
      }
    }

    res.json({
      success: true,
      data: { appointment }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch appointment',
      error: error.message
    });
  }
});

// @route   PUT /api/appointments/:id/status
// @desc    Update appointment status (Operators can use this for status/comments only)
// @access  Private
router.put('/:id/status', requirePermission(Permission.STATUS_CHANGE_APPOINTMENT, Permission.UPDATE_APPOINTMENT), async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;
    const { status, remarks } = req.body;

    if (!status) {
      res.status(400).json({
        success: false,
        message: 'Status is required'
      });
      return;
    }

    // Operators (by common key) can only update status and remarks
    // Restricted Update: If user has 'change status' but NOT full 'update' permission, limit fields
    // Replaces old 'OPERATOR' check
    if (!req.checkPermission(Permission.UPDATE_APPOINTMENT)) {
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

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      res.status(404).json({ success: false, message: 'Appointment not found' });
      return;
    }

    // ✅ Multi-Tenant Scoping Check
    if (currentUser.role !== UserRole.SUPER_ADMIN) {
      if (appointment.companyId.toString() !== currentUser.companyId?.toString()) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }

      if (currentUser.departmentId) {
        // Dynamic check: restricted to assigned items if lacks high-level management rights
        const canManage = req.checkPermission(Permission.STATUS_CHANGE_APPOINTMENT);
        if (!canManage) {
          if (appointment.assignedTo?.toString() !== currentUser._id.toString()) {
            res.status(403).json({ success: false, message: 'Access denied' });
            return;
          }
        } else {
          if (appointment.departmentId?.toString() !== currentUser.departmentId?.toString()) {
            res.status(403).json({ success: false, message: 'Access denied' });
            return;
          }
        }
      }
    }

    const oldStatus = appointment.status;
    
    // Update status
    appointment.status = status;
    appointment.statusHistory.push({
      status,
      changedBy: currentUser._id,
      changedAt: new Date(),
      remarks
    });

    // Update timestamps based on status
    if (status === AppointmentStatus.COMPLETED) {
      appointment.completedAt = new Date();
    } else if (status === AppointmentStatus.CANCELLED) {
      appointment.cancelledAt = new Date();
      if (remarks) {
        appointment.cancellationReason = remarks;
      }
    }

    // Add to timeline
    if (!appointment.timeline) appointment.timeline = [];
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
    
    // RE-POPULATE AFTER SAVE to get the latest data including timeline
    const updatedAppointment = await Appointment.findById(appointment._id)
      .populate('companyId', 'name companyId')
      .populate('departmentId', 'name departmentId')
      .populate('assignedTo', 'firstName lastName email')
      .populate('statusHistory.changedBy', 'firstName lastName');

    // Notify citizen on status change (if status changed)
    if (oldStatus !== status) {
      const { notifyCitizenOnAppointmentStatusChange, notifyHierarchyOnStatusChange } = await import('../services/notificationService');
      
      const notificationPayload = {
        type: 'appointment' as const,
        action: 'resolved' as any, // generic action, used for status lookups
        appointmentId: appointment.appointmentId,
        citizenName: appointment.citizenName,
        citizenPhone: appointment.citizenPhone,
        citizenWhatsApp: appointment.citizenWhatsApp,
        citizenEmail: appointment.citizenEmail,
        companyId: appointment.companyId,
        departmentId: appointment.departmentId,
        purpose: appointment.purpose,
        appointmentDate: appointment.appointmentDate,
        appointmentTime: appointment.appointmentTime,
        remarks: remarks || '',
        createdAt: appointment.createdAt,
        timeline: appointment.timeline
      };

      try {
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

        // ✅ Also notify Admins/Hierarchy about the status change
        await notifyHierarchyOnStatusChange(notificationPayload, oldStatus, status);

      } catch (notifError) {
        console.error('Failed to send notification:', notifError);
        // Don't fail the request if notification fails
      }
    }

    await logUserAction(
      req,
      AuditAction.STATUS_CHANGE,
      'Appointment',
      appointment._id.toString(),
      { oldStatus, newStatus: status, remarks }
    );

    res.json({
      success: true,
      message: 'Appointment status updated successfully. Citizen has been notified via WhatsApp.',
      data: { appointment: updatedAppointment }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to update appointment status',
      error: error.message
    });
  }
});

// @route   PUT /api/appointments/:id
// @desc    Update appointment details
// @access  Private
router.put('/:id', requirePermission(Permission.UPDATE_APPOINTMENT), async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;

    // Check for fine-grained update permission
    // Users with only status_change rights must use the /status route
    if (!req.checkPermission(Permission.UPDATE_APPOINTMENT)) {
      return res.status(403).json({
        success: false,
        message: 'Your role only allows updating status and remarks.'
      });
    }

    // Check department/company access
    const appointment = await Appointment.findOne({ 
      _id: req.params.id
    });
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // ✅ Multi-Tenant Scoping Check
    if (currentUser.role !== UserRole.SUPER_ADMIN) {
      if (appointment.companyId.toString() !== currentUser.companyId?.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied - cross-company access prohibited' });
      }

      if (currentUser.departmentId && appointment.departmentId?.toString() !== currentUser.departmentId?.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    // Update appointment
    const updatedAppointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedAppointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    await logUserAction(
      req,
      AuditAction.UPDATE,
      'Appointment',
      updatedAppointment._id.toString(),
      { updates: req.body }
    );

    res.json({
      success: true,
      message: 'Appointment updated successfully',
      data: { appointment: updatedAppointment }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to update appointment',
      error: error.message
    });
  }
});

// @route   DELETE /api/appointments/bulk
// @desc    Bulk soft delete appointments (Super Admin only)
// @access  Private (Super Admin only)
router.delete('/bulk', requirePermission(Permission.DELETE_APPOINTMENT), async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    const currentUser = req.user!;

    // Only Super Admin can delete
    if (currentUser.role !== UserRole.SUPER_ADMIN) {
      res.status(403).json({
        success: false,
        message: 'Only Super Admin can delete appointments'
      });
      return;
    }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Please provide an array of appointment IDs to delete'
      });
      return;
    }

    const result = await Appointment.deleteMany(
      { _id: { $in: ids } }
    );

    // Log each deletion
    for (const id of ids) {
      await logUserAction(
        req,
        AuditAction.DELETE,
        'Appointment',
        id
      );
    }

    res.json({
      success: true,
      message: `${result.deletedCount} appointment(s) deleted successfully`,
      data: { deletedCount: result.deletedCount }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete appointments',
      error: error.message
    });
  }
});

// @route   DELETE /api/appointments/:id
// @desc    Soft delete appointment (Super Admin only)
// @access  Private (Super Admin only)
router.delete('/:id', requirePermission(Permission.DELETE_APPOINTMENT), async (req: Request, res: Response) => {
  const currentUser = req.user!;
  
  // Only Super Admin can delete
  if (currentUser.role !== UserRole.SUPER_ADMIN) {
    res.status(403).json({
      success: false,
      message: 'Only Super Admin can delete appointments'
    });
    return;
  }
  try {
    const appointment = await Appointment.findByIdAndDelete(req.params.id);

    if (!appointment) {
      res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
      return;
    }

    await logUserAction(
      req,
      AuditAction.DELETE,
      'Appointment',
      appointment._id.toString()
    );

    res.json({
      success: true,
      message: 'Appointment deleted successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete appointment',
      error: error.message
    });
  }
});

export default router;
