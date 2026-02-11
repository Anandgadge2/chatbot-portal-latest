import express, { Request, Response } from 'express';
import User from '../models/User';
import Grievance from '../models/Grievance';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { requireDatabaseConnection } from '../middleware/dbConnection';
import { logUserAction } from '../utils/auditLogger';
import { AuditAction, Permission, UserRole, GrievanceStatus } from '../config/constants';

const router = express.Router();

// All routes require database connection and authentication
router.use(requireDatabaseConnection);
router.use(authenticate);

// @route   GET /api/grievances
// @desc    Get all grievances (scoped by role)
// @access  Private
router.get('/', requirePermission(Permission.READ_GRIEVANCE), async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, status, companyId, departmentId, assignedTo, priority } = req.query;
    const currentUser = req.user!;

    const query: any = {};

    // Scope based on user role
    if (currentUser.role === UserRole.SUPER_ADMIN) {
      // SuperAdmin can see all grievances, but can filter by companyId if provided
      if (companyId) query.companyId = companyId;
    } else if (currentUser.role === UserRole.COMPANY_ADMIN) {
      // CompanyAdmin can see all grievances in their company
      query.companyId = currentUser.companyId;
    } else if (currentUser.role === UserRole.DEPARTMENT_ADMIN) {
      // DepartmentAdmin can see grievances in their department
      query.departmentId = currentUser.departmentId;
    } else if (currentUser.role === UserRole.OPERATOR) {
      // Operator can only see assigned grievances
      query.assignedTo = currentUser._id;
    }

    // Apply filters
    if (status) query.status = status;
    if (departmentId) query.departmentId = departmentId;
    if (assignedTo) query.assignedTo = assignedTo;
    if (priority) query.priority = priority;

    const grievances = await Grievance.find(query)
      .populate('companyId', 'name companyId')
      .populate('departmentId', 'name departmentId')
      .populate('assignedTo', 'firstName lastName email')
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .sort({ createdAt: -1 });

    const total = await Grievance.countDocuments(query);

    res.json({
      success: true,
      data: {
        grievances,
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
      message: 'Failed to fetch grievances',
      error: error.message
    });
  }
});

// @route   POST /api/grievances
// @desc    Create new grievance (usually from WhatsApp webhook)
// @access  Private
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      companyId,
      departmentId,
      citizenName,
      citizenPhone,
      citizenWhatsApp,
      description,
      category,
      priority,
      location,
      media
    } = req.body;

    // Validation
    if (!companyId || !citizenName || !citizenPhone || !description) {
      res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
      return;
    }

    const grievance = await Grievance.create({
      companyId,
      departmentId,
      citizenName,
      citizenPhone,
      citizenWhatsApp: citizenWhatsApp || citizenPhone,
      description,
      category,
      priority: priority || 'MEDIUM',
      location,
      media: media || [],
      status: GrievanceStatus.PENDING
    });

    res.status(201).json({
      success: true,
      message: 'Grievance registered successfully',
      data: { grievance }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to create grievance',
      error: error.message
    });
  }
});

// @route   GET /api/grievances/:id
// @desc    Get grievance by ID
// @access  Private
router.get('/:id', requirePermission(Permission.READ_GRIEVANCE), async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;
    const grievance = await Grievance.findById(req.params.id)
      .populate('companyId', 'name companyId')
      .populate('departmentId', 'name departmentId')
      .populate('assignedTo', 'firstName lastName email')
      .populate('statusHistory.changedBy', 'firstName lastName')
      .populate('timeline.performedBy', 'firstName lastName role');

    if (!grievance) {
      res.status(404).json({
        success: false,
        message: 'Grievance not found'
      });
      return;
    }

    // Check access
    if (currentUser.role !== UserRole.SUPER_ADMIN) {
      if (currentUser.role === UserRole.COMPANY_ADMIN && grievance.companyId._id.toString() !== currentUser.companyId?.toString()) {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        });
        return;
      }
      if (currentUser.role === UserRole.DEPARTMENT_ADMIN && grievance.departmentId?._id.toString() !== currentUser.departmentId?.toString()) {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        });
        return;
      }
      if (currentUser.role === UserRole.OPERATOR && grievance.assignedTo?._id.toString() !== currentUser._id.toString()) {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        });
        return;
      }
    }

    res.json({
      success: true,
      data: { grievance }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch grievance',
      error: error.message
    });
  }
});

// @route   PUT /api/grievances/:id/status
// @desc    Update grievance status
// @access  Private
router.put('/:id/status', requirePermission(Permission.STATUS_CHANGE_GRIEVANCE, Permission.UPDATE_GRIEVANCE), async (req: Request, res: Response) => {
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

    const grievance = await Grievance.findById(req.params.id);

    if (!grievance) {
      res.status(404).json({
        success: false,
        message: 'Grievance not found'
      });
      return;
    }

    const oldStatus = grievance.status;
    
    // Update status
    grievance.status = status;
    grievance.statusHistory.push({
      status,
      changedBy: currentUser._id,
      changedAt: new Date(),
      remarks
    });

    // Update timestamps based on status
    if (status === GrievanceStatus.RESOLVED) {
      grievance.resolvedAt = new Date();
    }

    // Add to timeline
    if (!grievance.timeline) grievance.timeline = [];
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

    // Notify citizen if status changed to RESOLVED
    if (oldStatus !== GrievanceStatus.RESOLVED && status === GrievanceStatus.RESOLVED) {
      const { notifyCitizenOnResolution, notifyHierarchyOnStatusChange } = await import('../services/notificationService');

      const resolutionPayload = {
        type: 'grievance' as const,
        action: 'resolved' as const,
        grievanceId: grievance.grievanceId,
        citizenName: grievance.citizenName,
        citizenPhone: grievance.citizenPhone,
        citizenWhatsApp: grievance.citizenWhatsApp,
        departmentId: grievance.departmentId,
        companyId: grievance.companyId,
        assignedTo: grievance.assignedTo,
        resolvedBy: currentUser._id,
        resolvedAt: grievance.resolvedAt,
        createdAt: grievance.createdAt,
        assignedAt: grievance.assignedAt,
        timeline: grievance.timeline,
        remarks
      };

      await notifyCitizenOnResolution(resolutionPayload);

      await notifyHierarchyOnStatusChange(resolutionPayload, oldStatus, status);
    }

    await logUserAction(
      req,
      AuditAction.STATUS_CHANGE,
      'Grievance',
      grievance._id.toString(),
      { oldStatus: grievance.status, newStatus: status, remarks }
    );

    res.json({
      success: true,
      message: 'Grievance status updated successfully',
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

// @route   PUT /api/grievances/:id/assign
// @desc    Assign grievance to user
// @access  Private
router.put('/:id/assign', requirePermission(Permission.ASSIGN_GRIEVANCE), async (req: Request, res: Response) => {
  try {
    const { assignedTo, departmentId } = req.body;

    if (!assignedTo) {
      res.status(400).json({
        success: false,
        message: 'Assigned user ID is required'
      });
      return;
    }

    const grievance = await Grievance.findById(req.params.id)
      .populate('companyId')
      .populate('departmentId');

    if (!grievance) {
      res.status(404).json({
        success: false,
        message: 'Grievance not found'
      });
      return;
    }

    const assignedUser = await User.findById(assignedTo);
    if (!assignedUser) {
      res.status(404).json({
        success: false,
        message: 'Assigned user not found'
      });
      return;
    }

    const oldAssignedTo = grievance.assignedTo;
    const oldDepartmentId = grievance.departmentId?._id;

    // Update assignment details
    grievance.assignedTo = assignedUser._id;
    grievance.assignedAt = new Date();
    grievance.status = GrievanceStatus.ASSIGNED;

    // Auto-update department based on assigned user's department
    if (assignedUser.departmentId && (!oldDepartmentId || oldDepartmentId.toString() !== assignedUser.departmentId.toString())) {
      grievance.departmentId = assignedUser.departmentId as any;
      
      // Add department transfer event to timeline
      grievance.timeline.push({
        action: 'DEPARTMENT_TRANSFER',
        details: {
          fromDepartmentId: oldDepartmentId,
          toDepartmentId: assignedUser.departmentId,
          reason: 'Auto-updated during reassignment'
        },
        performedBy: req.user!._id,
        timestamp: new Date()
      });
    }

    // Add to status history
    const statusRemarks = departmentId 
      ? `Assigned to user and transferred to new department`
      : `Assigned to user`;
    
    grievance.statusHistory.push({
      status: GrievanceStatus.ASSIGNED,
      changedBy: req.user!._id,
      changedAt: new Date(),
      remarks: statusRemarks
    });

    // Add assignment event to timeline
    grievance.timeline.push({
      action: 'ASSIGNED',
      details: {
        fromUserId: oldAssignedTo,
        toUserId: assignedUser._id,
        toUserName: assignedUser.getFullName()
      },
      performedBy: req.user!._id,
      timestamp: new Date()
    });

    await grievance.save();

    // Notify assigned user
    const { notifyUserOnAssignment } = await import('../services/notificationService');
    await notifyUserOnAssignment({
      type: 'grievance',
      action: 'assigned',
      grievanceId: grievance.grievanceId,
      citizenName: grievance.citizenName,
      citizenPhone: grievance.citizenPhone,
      departmentId: grievance.departmentId,
      companyId: grievance.companyId,
      description: grievance.description,
      category: grievance.category,
    assignedTo: assignedUser._id,
      assignedByName: req.user!.getFullName(),
      assignedAt: grievance.assignedAt,
      createdAt: grievance.createdAt,
      timeline: grievance.timeline
    });

    await logUserAction(
      req,
      AuditAction.ASSIGN,
      'Grievance',
      grievance._id.toString(),
      { assignedTo, departmentId }
    );

    res.json({
      success: true,
      message: 'Grievance assigned successfully',
      data: { grievance }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to assign grievance',
      error: error.message
    });
  }
});

// @route   PUT /api/grievances/:id
// @desc    Update grievance details (Operators cannot use this - use /status endpoint instead)
// @access  Private (CompanyAdmin, DepartmentAdmin only - Operators restricted)
router.put('/:id', requirePermission(Permission.UPDATE_GRIEVANCE), async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;

    // Operators can only update status/comments via /status endpoint, not full updates
    if (currentUser.role === UserRole.OPERATOR) {
      return res.status(403).json({
        success: false,
        message: 'Operators can only update status and remarks. Please use the status update endpoint.'
      });
    }

    // Check department/company access
    const grievance = await Grievance.findById(req.params.id);
    if (!grievance) {
      return res.status(404).json({
        success: false,
        message: 'Grievance not found'
      });
    }

    // Permission checks for department/company scope
    if (currentUser.role === UserRole.DEPARTMENT_ADMIN) {
      if (grievance.departmentId?.toString() !== currentUser.departmentId?.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only update grievances in your department'
        });
      }
    } else if (currentUser.role === UserRole.COMPANY_ADMIN) {
      if (grievance.companyId.toString() !== currentUser.companyId?.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only update grievances in your company'
        });
      }
    }

    // Update grievance
    const updatedGrievance = await Grievance.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    await logUserAction(
      req,
      AuditAction.UPDATE,
      'Grievance',
      updatedGrievance!._id.toString(),
      { updates: req.body }
    );

    res.json({
      success: true,
      message: 'Grievance updated successfully',
      data: { grievance: updatedGrievance }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to update grievance',
      error: error.message
    });
  }
});

// @route   DELETE /api/grievances/bulk
// @desc    Bulk soft delete grievances (Super Admin only)
// @access  Private (Super Admin only)
router.delete('/bulk', requirePermission(Permission.DELETE_GRIEVANCE), async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    const currentUser = req.user!;

    // Only Super Admin can delete
    if (currentUser.role !== UserRole.SUPER_ADMIN) {
      res.status(403).json({
        success: false,
        message: 'Only Super Admin can delete grievances'
      });
      return;
    }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Please provide an array of grievance IDs to delete'
      });
      return;
    }

    const result = await Grievance.deleteMany(
      { _id: { $in: ids } }
    );

    // Log each deletion
    for (const id of ids) {
      await logUserAction(
        req,
        AuditAction.DELETE,
        'Grievance',
        id
      );
    }

    res.json({
      success: true,
      message: `${result.deletedCount} grievance(s) deleted successfully`,
      data: { deletedCount: result.deletedCount }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete grievances',
      error: error.message
    });
  }
});

// @route   DELETE /api/grievances/:id
// @desc    Soft delete grievance (Super Admin only)
// @access  Private (Super Admin only)
router.delete('/:id', requirePermission(Permission.DELETE_GRIEVANCE), async (req: Request, res: Response) => {
  const currentUser = req.user!;
  
  // Only Super Admin can delete
  if (currentUser.role !== UserRole.SUPER_ADMIN) {
    res.status(403).json({
      success: false,
      message: 'Only Super Admin can delete grievances'
    });
    return;
  }
  try {
    const grievance = await Grievance.findByIdAndDelete(req.params.id);

    if (!grievance) {
      res.status(404).json({
        success: false,
        message: 'Grievance not found'
      });
      return;
    }

    await logUserAction(
      req,
      AuditAction.DELETE,
      'Grievance',
      grievance._id.toString()
    );

    res.json({
      success: true,
      message: 'Grievance deleted successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete grievance',
      error: error.message
    });
  }
});

export default router;
