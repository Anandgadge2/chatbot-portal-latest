import express, { Request, Response } from 'express';
import User from '../models/User';
import Grievance from '../models/Grievance';
import Department from '../models/Department';
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
    } else {
      // All other users are scoped by their company
      query.companyId = currentUser.companyId;

      if (currentUser.departmentId) {
        // Dynamic check: If they don't have assignment permission, they can only see their own assigned grievances
        const canAssign = req.checkPermission(Permission.ASSIGN_GRIEVANCE);
        
        if (!canAssign) {
          query.assignedTo = currentUser._id;
        } else {
          // Dept-level management: sees where their dept is parent OR sub-dept
          query.$or = [
            { departmentId: currentUser.departmentId },
            { subDepartmentId: currentUser.departmentId }
          ];
        }
      } else if (status === GrievanceStatus.REVERTED) {
          // For Company Admin (who has no departmentId), 
          // they should see REVERTED grievances that have no departmentId (reverted to them)
          query.status = GrievanceStatus.REVERTED;
          query.departmentId = null;
      }
    }

    // Apply filters
    if (status && !query.status) query.status = status;
    if (departmentId) query.departmentId = departmentId;
    if (assignedTo) query.assignedTo = assignedTo;
    if (priority) query.priority = priority;

    const grievances = await Grievance.find(query)
      .populate('companyId', 'name companyId')
      .populate('departmentId', 'name departmentId')
      .populate('subDepartmentId', 'name departmentId')
      .populate('assignedTo', 'firstName lastName email designation')
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

    // ✅ AUTO-ASSIGNMENT (Designated Officer / Dept Admin)
    const { getHierarchicalDepartmentAdmins, notifyUserOnAssignment, notifyDepartmentAdminOnCreation, notifyCitizenOnCreation } = await import('../services/notificationService');
    const targetDeptId = (grievance as any).subDepartmentId || departmentId;
    const potentialAdmins = await getHierarchicalDepartmentAdmins(targetDeptId);
    
    if (potentialAdmins && potentialAdmins.length > 0) {
      const targetAdmin = potentialAdmins[0];
      grievance.assignedTo = targetAdmin._id;
      grievance.status = GrievanceStatus.ASSIGNED;
      await grievance.save();
      
      console.log(`🎯 Auto-assigned portal grievance ${grievance.grievanceId} to admin: ${targetAdmin.email}`);

      await notifyUserOnAssignment({
        type: 'grievance' as const,
        action: 'assigned' as const,
        grievanceId: grievance.grievanceId,
        citizenName: grievance.citizenName,
        citizenPhone: grievance.citizenPhone,
        citizenWhatsApp: grievance.citizenWhatsApp,
        departmentId: departmentId as any,
        subDepartmentId: (grievance as any).subDepartmentId,
        companyId: companyId as any,
        assignedTo: targetAdmin._id,
        assignedByName: 'System (Auto-assign)',
        assignedAt: new Date(),
        description: grievance.description,
        category: grievance.category,
        createdAt: grievance.createdAt,
        timeline: grievance.timeline
      }).catch(err => console.error('❌ Assignment Notification failed:', err));
    }

    // ✅ Notify Admins and Citizen about the new grievance creation
    const notificationPayload = {
      type: 'grievance' as const,
      action: 'created' as const,
      grievanceId: grievance.grievanceId,
      citizenName: grievance.citizenName,
      citizenPhone: grievance.citizenPhone,
      citizenWhatsApp: grievance.citizenWhatsApp,
      citizenEmail: (req.body as any).citizenEmail,
      departmentId: departmentId as any,
      subDepartmentId: (grievance as any).subDepartmentId,
      companyId: companyId as any,
      description: grievance.description,
      category: grievance.category,
      departmentName: 'Portal Submission',
      createdAt: grievance.createdAt,
      timeline: grievance.timeline
    };

    // ✅ EXECUTE NOTIFICATIONS IN PARALLEL
    Promise.allSettled([
      notifyDepartmentAdminOnCreation(notificationPayload).catch(err => console.error('❌ Admin Notification failed:', err)),
      notifyCitizenOnCreation({
        ...notificationPayload,
        action: 'confirmation'
      }).catch(err => console.error('❌ Citizen Confirmation failed:', err))
    ]);

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


// @route   PUT /api/grievances/:id/revert
// @desc    Revert a wrongly assigned grievance back to company admin for reassignment
// @access  Department/Sub-department admins and operators
router.put('/:id/revert', requirePermission(Permission.REVERT_GRIEVANCE), async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;
    const { remarks, suggestedDepartmentId, suggestedSubDepartmentId, suggestedAssigneeId } = req.body;

    if (!remarks || !remarks.trim()) {
      return res.status(400).json({ success: false, message: 'Remarks are required for reverting a grievance' });
    }

    const grievance = await Grievance.findById(req.params.id)
      .populate('companyId')
      .populate('departmentId')
      .populate('subDepartmentId');

    if (!grievance) {
      return res.status(404).json({ success: false, message: 'Grievance not found' });
    }

    if (currentUser.role !== UserRole.SUPER_ADMIN) {
      const grievanceCompanyId = (grievance.companyId as any)?._id?.toString() || grievance.companyId?.toString();
      if (grievanceCompanyId !== currentUser.companyId?.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied to this company' });
      }

      // Enforce department scope only if the user is assigned to a department
      // Company Admins (who have no departmentId) can revert any grievance in their company
      if (currentUser.departmentId) {
        const grievanceDeptId = (grievance.departmentId as any)?._id?.toString() || grievance.departmentId?.toString();
        const grievanceSubDeptId = (grievance.subDepartmentId as any)?._id?.toString() || grievance.subDepartmentId?.toString();
        const adminDeptId = currentUser.departmentId?.toString();
        
        if (grievanceDeptId !== adminDeptId && grievanceSubDeptId !== adminDeptId) {
          return res.status(403).json({ success: false, message: 'You can only revert grievances from your department scope' });
        }
      }
    }

    const previousDepartmentId = grievance.departmentId;
    const previousSubDepartmentId = grievance.subDepartmentId;
    const previousAssignedTo = grievance.assignedTo;
    const oldStatus = grievance.status;

    grievance.status = GrievanceStatus.REVERTED;
    grievance.departmentId = undefined;
    grievance.subDepartmentId = undefined;
    grievance.assignedTo = undefined;
    grievance.assignedAt = undefined;

    grievance.statusHistory.push({
      status: GrievanceStatus.REVERTED,
      changedBy: currentUser._id,
      changedAt: new Date(),
      remarks: remarks.trim()
    } as any);

    grievance.timeline.push({
      action: 'REVERTED_TO_COMPANY_ADMIN',
      details: {
        remarks: remarks.trim(),
        previousDepartmentId,
        previousSubDepartmentId,
        previousAssignedTo,
        suggestedDepartmentId: suggestedDepartmentId || null,
        suggestedSubDepartmentId: suggestedSubDepartmentId || null,
        suggestedAssigneeId: suggestedAssigneeId || null,
        fromStatus: oldStatus
      },
      performedBy: currentUser._id,
      timestamp: new Date()
    });

    await grievance.save();

    await logUserAction(req, AuditAction.UPDATE, 'Grievance', grievance._id.toString(), {
      action: 'revert_to_company_admin',
      grievanceId: grievance.grievanceId,
      remarks: remarks.trim(),
      suggestedDepartmentId: suggestedDepartmentId || null
    });

    return res.json({ success: true, message: 'Grievance reverted to company admin successfully', data: { grievance } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to revert grievance', error: error.message });
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
      .populate('subDepartmentId', 'name departmentId')
      .populate('assignedTo', 'firstName lastName email designation')
      .populate('statusHistory.changedBy', 'firstName lastName')
      .populate('timeline.performedBy', 'firstName lastName role')
      .populate('media.uploadedBy', 'firstName lastName role');

    if (!grievance) {
      res.status(404).json({
        success: false,
        message: 'Grievance not found'
      });
      return;
    }

    // Check access - enforce company isolation for all non-superadmin roles
    if (currentUser.role !== UserRole.SUPER_ADMIN) {
      // Always enforce company scope first
      const grievanceCompanyId = (grievance.companyId as any)?._id?.toString() || grievance.companyId?.toString();
      if (grievanceCompanyId && currentUser.companyId && grievanceCompanyId !== currentUser.companyId.toString()) {
        res.status(403).json({ success: false, message: 'Access denied - cross-company access prohibited' });
        return;
      }

      if (currentUser.departmentId) {
        // Dynamic check: Users without assignment permission (like basic Operators) only see their own items
        const canAssign = req.checkPermission(Permission.ASSIGN_GRIEVANCE);
        if (!canAssign) {
          const assignedToId = (grievance.assignedTo as any)?._id?.toString() || grievance.assignedTo?.toString();
          if (assignedToId !== currentUser._id.toString()) {
            res.status(403).json({ success: false, message: 'Access denied - not assigned to you' });
            return;
          }
        } else {
          // Dept-level scoping
          const grievanceDeptId = (grievance.departmentId as any)?._id?.toString() || grievance.departmentId?.toString();
          const grievanceSubDeptId = (grievance.subDepartmentId as any)?._id?.toString() || grievance.subDepartmentId?.toString();
          const adminDeptId = currentUser.departmentId?.toString();
          const hasAccess = grievanceDeptId === adminDeptId || grievanceSubDeptId === adminDeptId;
          if (!hasAccess) {
            res.status(403).json({ success: false, message: 'Access denied - grievance not in your department' });
            return;
          }
        }
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

    // Restricted Update: If user lacks full update rights, they can only change status/remarks
    if (!req.checkPermission(Permission.UPDATE_GRIEVANCE)) {
      const allowedFields = ['status', 'remarks'];
      const providedFields = Object.keys(req.body);
      const invalidFields = providedFields.filter(field => !allowedFields.includes(field));
      
      if (invalidFields.length > 0) {
        return res.status(403).json({
          success: false,
          message: `Your role only allows updating status and remarks.`
        });
      }
    }

    const grievance = await Grievance.findById(req.params.id);
    if (!grievance) {
      res.status(404).json({ success: false, message: 'Grievance not found' });
      return;
    }

    // ✅ Multi-Tenant Scoping Check
    if (currentUser.role !== UserRole.SUPER_ADMIN) {
      if (grievance.companyId?.toString() !== currentUser.companyId?.toString()) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }

      if (currentUser.departmentId) {
        // Dynamic check for restricted users
        const canManage = req.checkPermission(Permission.ASSIGN_GRIEVANCE);
        if (!canManage) {
          if (grievance.assignedTo?.toString() !== currentUser._id.toString()) {
            res.status(403).json({ success: false, message: 'Access denied - not assigned to you' });
            return;
          }
        } else {
          const grievanceDeptId = grievance.departmentId?.toString();
          const grievanceSubDeptId = grievance.subDepartmentId?.toString();
          const adminDeptId = currentUser.departmentId?.toString();
          if (grievanceDeptId !== adminDeptId && grievanceSubDeptId !== adminDeptId) {
            res.status(403).json({ success: false, message: 'Access denied - grievance not in your department' });
            return;
          }
        }
      }
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

    if (oldStatus !== status) {
      // Hierarchy notifications are still useful here if this route is called directly,
      // but to prevent double messaging when using the unified status update,
      // we check if it's already handled. However, removing it for citizens is the main goal.
      // We'll keep hierarchy update for now but remove citizen update.
      const { notifyHierarchyOnStatusChange } = await import('../services/notificationService');
      
      const payload = {
        type: 'grievance' as const,
        action: 'status_change' as any,
        grievanceId: grievance.grievanceId,
        citizenName: grievance.citizenName,
        citizenPhone: grievance.citizenPhone,
        departmentId: grievance.departmentId,
        companyId: grievance.companyId,
        assignedTo: grievance.assignedTo,
        resolvedAt: grievance.resolvedAt,
        createdAt: grievance.createdAt,
        assignedAt: grievance.assignedAt,
        timeline: grievance.timeline,
        remarks: remarks || ''
      };

      await notifyHierarchyOnStatusChange(payload, oldStatus, status).catch(e => console.error('Admin notification failed:', e));
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

    const grievance = await Grievance.findById(req.params.id);
    if (!grievance) {
      res.status(404).json({ success: false, message: 'Grievance not found' });
      return;
    }

    // ✅ Multi-Tenant Scoping Check
    const currentUser = req.user!;
    if (currentUser.role !== UserRole.SUPER_ADMIN) {
      if (grievance.companyId?.toString() !== currentUser.companyId?.toString()) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }

      if (currentUser.departmentId) {
        const grievanceDeptId = grievance.departmentId?.toString();
        const grievanceSubDeptId = grievance.subDepartmentId?.toString();
        const adminDeptId = currentUser.departmentId?.toString();
        if (grievanceDeptId !== adminDeptId && grievanceSubDeptId !== adminDeptId) {
          res.status(403).json({ success: false, message: 'Access denied - grievance not in your department' });
          return;
        }
      }
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
      
      // Fetch department name for the timeline
      const targetDept = await Department.findById(assignedUser.departmentId);
      
      // Add department transfer event to timeline
      grievance.timeline.push({
        action: 'DEPARTMENT_TRANSFER',
        details: {
          fromDepartmentId: oldDepartmentId,
          toDepartmentId: assignedUser.departmentId,
          toDepartmentName: targetDept?.name || 'Department',
          toUserName: assignedUser.getFullName(),
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
      subDepartmentId: grievance.subDepartmentId,
      companyId: grievance.companyId,
      description: grievance.description,
      category: grievance.category,
      assignedTo: assignedUser._id,
      assignedByName: req.user!.getFullName(),
      assignedAt: grievance.assignedAt,
      createdAt: grievance.createdAt,
      timeline: grievance.timeline
    });

    // Notify citizen about assignment/status change
    const { notifyCitizenOnGrievanceStatusChange } = await import('../services/notificationService');
    const dept = grievance.departmentId ? await Department.findById(grievance.departmentId) : null;
    await notifyCitizenOnGrievanceStatusChange({
      companyId: grievance.companyId,
      grievanceId: grievance.grievanceId,
      citizenName: grievance.citizenName,
      citizenPhone: grievance.citizenPhone,
      citizenWhatsApp: grievance.citizenWhatsApp,
      departmentId: grievance.departmentId,
      subDepartmentId: grievance.subDepartmentId,
      departmentName: dept ? dept.name : undefined,
      newStatus: GrievanceStatus.ASSIGNED,
      remarks: `Your grievance has been assigned to ${assignedUser.getFullName()} for resolution.`
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

    // Users without full update permission must use the /status endpoint instead
    if (!req.checkPermission(Permission.UPDATE_GRIEVANCE)) {
      return res.status(403).json({
        success: false,
        message: 'Your role only allows updating status and remarks.'
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

    // ✅ Multi-Tenant Scoping Check
    if (currentUser.role !== UserRole.SUPER_ADMIN) {
      if (grievance.companyId?.toString() !== currentUser.companyId?.toString()) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }

      if (currentUser.departmentId) {
        const grievanceDeptId = grievance.departmentId?.toString();
        const grievanceSubDeptId = grievance.subDepartmentId?.toString();
        const adminDeptId = currentUser.departmentId?.toString();
        if (grievanceDeptId !== adminDeptId && grievanceSubDeptId !== adminDeptId) {
          res.status(403).json({ success: false, message: 'Access denied - grievance not in your department' });
          return;
        }
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
