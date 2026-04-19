import express, { Request, Response } from 'express';
import User from '../models/User';
import Grievance from '../models/Grievance';
import Department from '../models/Department';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { requireDatabaseConnection } from '../middleware/dbConnection';
import { logUserAction } from '../utils/auditLogger';
import { findOptimalAdmin } from '../utils/userUtils';
import { buildNameSearchQuery, escapeRegExp } from '../utils/searchUtils';
import { AuditAction, Permission, UserRole, GrievanceStatus } from '../config/constants';
import { logger } from '../config/logger';
import { enforceWhatsAppGrievanceCompliance } from '../middleware/whatsappGrievanceCompliance';
import CitizenProfile from '../models/CitizenProfile';
import { 
  triggerAdminTemplate,
  triggerAdminAssignmentNotification,
  formatTemplateDate
} from '../services/grievanceTemplateTriggerService';
import { sanitizeGrievanceDetails } from '../utils/sanitize';

const router = express.Router();

// All routes require database connection and authentication
router.use(requireDatabaseConnection);
router.use(authenticate);

// @route   GET /api/grievances
// @desc    Get all grievances (scoped by role)
// @access  Private
router.get('/', requirePermission(Permission.READ_GRIEVANCE), async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, status, companyId, departmentId, assignedTo, priority, search } = req.query;
    const currentUser = req.user!;

    const query: any = {};
    const targetCompanyId = (currentUser.isSuperAdmin && companyId) ? companyId : currentUser.companyId;

    // ... (rest of the query logic matches the existing one)
    if (targetCompanyId) {
      query.companyId = targetCompanyId;
      if (currentUser.isSuperAdmin) {
        if (departmentId) query.departmentId = departmentId;
        if (status) query.status = status;
      } else if (currentUser.departmentId || (currentUser.departmentIds && currentUser.departmentIds.length > 0)) {
        const canAssign = req.checkPermission(Permission.ASSIGN_GRIEVANCE);
        if (!canAssign) {
          query.assignedTo = currentUser._id;
        } else {
          // Hierarchical scoping: include all sub-departments
          const { getDepartmentHierarchyIds } = await import('../utils/departmentUtils');
          const rootDeptIds = currentUser.departmentIds && currentUser.departmentIds.length > 0 
            ? currentUser.departmentIds.map(id => id.toString())
            : currentUser.departmentId ? [currentUser.departmentId.toString()] : [];
          const deptIds = await getDepartmentHierarchyIds(rootDeptIds);
          query.$or = [
            { departmentId: { $in: deptIds } },
            { subDepartmentId: { $in: deptIds } }
          ];
        }

      } else if (!currentUser.departmentId && status === GrievanceStatus.REVERTED) {
          query.status = GrievanceStatus.REVERTED;
          query.departmentId = null;
      }
    } else if (!currentUser.isSuperAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    if (status && !query.status) query.status = status;
    if (departmentId) {
      const { getDepartmentHierarchyIds } = await import('../utils/departmentUtils');
      const deptIds = await getDepartmentHierarchyIds(departmentId as string);
      const deptFilter = [
        { departmentId: { $in: deptIds } },
        { subDepartmentId: { $in: deptIds } }
      ];
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: deptFilter }];
        delete query.$or;
      } else {
        query.$or = deptFilter;
      }
    }
    if (assignedTo) {
      if (assignedTo === 'NONE') query.assignedTo = null;
      else if (assignedTo === 'ANY') query.assignedTo = { $ne: null };
      else query.assignedTo = assignedTo;
    }
    if (priority) query.priority = priority;

    // 🔍 SEARCH LOGIC
    if (search) {
      const escapedSearch = escapeRegExp(search as string);
      const searchCriteria: any[] = [
        { grievanceId: { $regex: escapedSearch, $options: 'i' } },
        { citizenPhone: { $regex: escapedSearch, $options: 'i' } },
        { citizenWhatsApp: { $regex: escapedSearch, $options: 'i' } },
        { description: { $regex: escapedSearch, $options: 'i' } },
        { category: { $regex: escapedSearch, $options: 'i' } },
        ...buildNameSearchQuery(search as string, 'citizenName', 'citizenName')
      ];

      // Relational Search: Department Name
      const matchingDepts = await Department.find({
        companyId: targetCompanyId || { $exists: true },
        name: { $regex: escapedSearch, $options: 'i' }
      }).select('_id');
      if (matchingDepts.length > 0) {
        const deptIds = matchingDepts.map(d => d._id);
        searchCriteria.push({ departmentId: { $in: deptIds } });
        searchCriteria.push({ subDepartmentId: { $in: deptIds } });
      }

      // Relational Search: Assigned Officer Name
      const matchingUsers = await User.find({
        companyId: targetCompanyId || { $exists: true },
        $or: buildNameSearchQuery(search as string, 'firstName', 'lastName')
      }).select('_id');
      if (matchingUsers.length > 0) {
        searchCriteria.push({ assignedTo: { $in: matchingUsers.map(u => u._id) } });
      }

      if (query.$or) {
          const existingOr = query.$or;
          delete query.$or;
          query.$and = (query.$and || []).concat([{ $or: existingOr }, { $or: searchCriteria }]);
      } else if (query.$and) {
          query.$and.push({ $or: searchCriteria });
      } else {
          query.$or = searchCriteria;
      }
    }

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
router.post('/', enforceWhatsAppGrievanceCompliance, async (req: Request, res: Response) => {
  try {
    const {
      companyId,
      departmentId,
      subDepartmentId,
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

    const safeDescription = sanitizeGrievanceDetails(description);
    const grievance = await Grievance.create({
      companyId,
      departmentId,
      subDepartmentId,
      citizenName,
      citizenPhone,
      phone_number: citizenPhone,
      citizenWhatsApp: citizenWhatsApp || citizenPhone,
      description: safeDescription,
      message: safeDescription,
      category,
      priority: priority || 'MEDIUM',
      location,
      media: media || [],
      status: GrievanceStatus.PENDING,
      admin_consent: false
    });

    await CitizenProfile.updateOne(
      { companyId, phone_number: citizenPhone },
      {
        $set: {
          lastGrievanceDate: new Date(),
          phoneNumber: citizenPhone,
          name: citizenName
        }
      },
      { upsert: true }
    );

    // ✅ AUTO-ASSIGNMENT (Designated Officer / Dept Admin)
    const { getHierarchicalDepartmentAdmins, notifyUserOnAssignment, notifyDepartmentAdminOnCreation, notifyCitizenOnCreation } = await import('../services/notificationService');
    const targetDeptId = (grievance as any).subDepartmentId || departmentId;
    
    let targetAdmin = null;

    // 1. First priority: Check if the department has a designated head/contact person
    if (targetDeptId) {
      const dept = await Department.findById(targetDeptId).select('contactUserId');
      if (dept && dept.contactUserId) {
        targetAdmin = await User.findById(dept.contactUserId).populate('customRoleId');
      }
    }

    // 2. Second priority: Hierarchical lookup if no designated head was found
    if (!targetAdmin) {
      const potentialAdmins = await getHierarchicalDepartmentAdmins(targetDeptId);
      targetAdmin = findOptimalAdmin(potentialAdmins);
    }
    
    if (targetAdmin) {
      grievance.assignedTo = targetAdmin._id;
      grievance.status = GrievanceStatus.ASSIGNED;
      await grievance.save();
      
      console.log(`🎯 Auto-assigned portal grievance ${grievance.grievanceId} to admin: ${targetAdmin.email}`);
    }

    Promise.allSettled([
      targetAdmin?.phone
        ? triggerAdminTemplate({
            event: 'grievance_received_admin_v1',
            companyId,
            language: grievance.language,
            recipientPhones: [targetAdmin.phone],
            citizenPhone: grievance.citizenPhone,
            data: {
              admin_name: targetAdmin.getFullName(),
              grievance_id: grievance.grievanceId,
              citizen_name: grievance.citizenName,
              department_name: grievance.category || 'General',
              office_name: (grievance as any).subDepartmentId ? (await Department.findById((grievance as any).subDepartmentId))?.name || 'N/A' : 'N/A',
              description: safeDescription,
              received_on: formatTemplateDate()
            }
          })
        : triggerAdminTemplate({
            event: 'grievance_pending_admin_v1',
            companyId,
            language: grievance.language,
            citizenPhone: grievance.citizenPhone,
            data: {
              admin_name: 'Administrator',
              grievance_id: grievance.grievanceId,
              citizen_name: grievance.citizenName,
              department_name: grievance.category || 'General',
              office_name: 'N/A',
              description: safeDescription,
              submitted_on: formatTemplateDate()
            }
          }),
    ]);




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
      // 📢 Send confirmation to citizen
      notifyCitizenOnCreation({
        ...notificationPayload,
        description: grievance.description || description || 'N/A',
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

router.post('/consent/citizen', async (req: Request, res: Response) => {
  try {
    const { companyId, phone_number, consent, source } = req.body;
    if (!companyId || !phone_number || typeof consent !== 'boolean') {
      return res.status(400).json({ success: false, message: 'companyId, phone_number and consent(boolean) are required.' });
    }
    if (source !== 'whatsapp_button') {
      return res.status(400).json({ success: false, message: 'Citizen consent must be captured using whatsapp_button source.' });
    }

    const profile = await CitizenProfile.findOneAndUpdate(
      { companyId, phone_number },
      {
        $set: {
          citizen_consent: consent,
          consentGiven: consent,
          citizen_consent_timestamp: new Date(),
          consentTimestamp: new Date(),
          consent_source: 'whatsapp_button',
          opt_out: false,
          isSubscribed: true,
          phoneNumber: phone_number
        }
      },
      { upsert: true, new: true }
    );

    return res.json({ success: true, data: profile });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/consent/admin', async (req: Request, res: Response) => {
  try {
    const { companyId, phone_number, consent } = req.body;
    if (!companyId || !phone_number || typeof consent !== 'boolean') {
      return res.status(400).json({ success: false, message: 'companyId, phone_number and consent(boolean) are required.' });
    }

    const profile = await CitizenProfile.findOneAndUpdate(
      { companyId, phone_number },
      {
        $set: {
          admin_consent: consent,
          admin_consent_timestamp: new Date()
        }
      },
      { upsert: true, new: true }
    );

    return res.json({ success: true, data: profile });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
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

    if (!currentUser.isSuperAdmin) {
      const grievanceCompanyId = (grievance.companyId as any)?._id?.toString() || grievance.companyId?.toString();
      if (grievanceCompanyId !== currentUser.companyId?.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied to this company' });
      }

      // Enforce department scope only if the user is assigned to a department
      // Company Admins (who have no departmentId) can revert any grievance in their company
      // 🏢 Multi-Department & Hierarchical Scoping
      if (currentUser.departmentId || (currentUser.departmentIds && currentUser.departmentIds.length > 0)) {
        const userDepts: string[] = [];
        if (currentUser.departmentId) userDepts.push(currentUser.departmentId.toString());
        if (currentUser.departmentIds && Array.isArray(currentUser.departmentIds)) {
          currentUser.departmentIds.forEach(id => userDepts.push(id.toString()));
        }

        const { getDepartmentHierarchyIds } = await import('../utils/departmentUtils');
        const authorizedDeptIds = await getDepartmentHierarchyIds(userDepts);

        const grievanceDeptId = (grievance.departmentId as any)?._id?.toString() || grievance.departmentId?.toString();
        const grievanceSubDeptId = (grievance.subDepartmentId as any)?._id?.toString() || grievance.subDepartmentId?.toString();
        
        const hasAccess = (grievanceDeptId && authorizedDeptIds.includes(grievanceDeptId)) || 
                          (grievanceSubDeptId && authorizedDeptIds.includes(grievanceSubDeptId));

        if (!hasAccess) {
          return res.status(403).json({ success: false, message: 'Access denied: You can only revert grievances within your authorized department scope' });
        }
      }
    }

    const previousDepartmentId = grievance.departmentId;
    const previousSubDepartmentId = grievance.subDepartmentId;
    const previousAssignedTo = grievance.assignedTo;
    const oldStatus = grievance.status;
    const previousDepartmentName = (grievance.departmentId as any)?.name || grievance.category || 'General';
    const previousSubDepartmentName = (grievance.subDepartmentId as any)?.name || 'N/A';

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

    await triggerAdminTemplate({
      event: 'grievance_reverted_company_v1',
      companyId: grievance.companyId,
      language: grievance.language,
      citizenPhone: grievance.citizenPhone,
      data: {
        admin_name: 'Company Admin',
        grievance_id: grievance.grievanceId,
        citizen_name: grievance.citizenName,
        department_name: previousDepartmentName,
        office_name: previousSubDepartmentName,
        reverted_by: currentUser.getFullName(),
        remarks: remarks.trim(),
        reverted_on: formatTemplateDate()
      }
    }).catch((err) => logger.error('Failed to trigger grievance_reverted_company_v1 template', err));

    const { notifyCompanyAdminsOnRevert } = await import('../services/notificationService');
    await notifyCompanyAdminsOnRevert({
      type: 'grievance',
      action: 'reverted_admin',
      grievanceId: grievance.grievanceId,
      citizenName: grievance.citizenName,
      citizenPhone: grievance.citizenPhone,
      citizenWhatsApp: grievance.citizenWhatsApp,
      language: grievance.language,
      departmentId: previousDepartmentId as any,
      subDepartmentId: previousSubDepartmentId as any,
      companyId: grievance.companyId,
      remarks: remarks.trim(),
      timeline: grievance.timeline
    }).catch(err => logger.error('❌ Failed to notify company admins on revert:', err));

    await logUserAction(req, AuditAction.UPDATE, 'Grievance', grievance._id.toString(), {
      action: 'revert_to_company_admin',
      grievanceId: grievance.grievanceId,
      remarks: remarks.trim(),
      suggestedDepartmentId: suggestedDepartmentId || null
    });

    return res.json({ success: true, message: 'Grievance reverted to company admin successfully', data: { grievance } });
  } catch (error: any) {
    logger.error(`❌ Failed to send email:`, { 
      error: error.message, 
      stack: error.stack,
      code: error.code,
      command: error.command,
      address: error.address,
      port: error.port,
      details: error 
    });
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
    if (!currentUser.isSuperAdmin) {
      // Always enforce company scope first
      const grievanceCompanyId = (grievance.companyId as any)?._id?.toString() || grievance.companyId?.toString();
      if (grievanceCompanyId && currentUser.companyId && grievanceCompanyId !== currentUser.companyId.toString()) {
        res.status(403).json({ success: false, message: 'Access denied - cross-company access prohibited' });
        return;
      }

      if (currentUser.departmentId || (currentUser.departmentIds && currentUser.departmentIds.length > 0)) {
        // Dynamic check: Users without assignment permission (like basic Operators) only see their own items
        const canAssign = req.checkPermission(Permission.ASSIGN_GRIEVANCE);
        if (!canAssign) {
          const assignedToId = (grievance.assignedTo as any)?._id?.toString() || grievance.assignedTo?.toString();
          if (assignedToId !== currentUser._id.toString()) {
            res.status(403).json({ success: false, message: 'Access denied - not assigned to you' });
            return;
          }
        } else {
          // 🏢 Multi-Department & Hierarchical Scoping
          const userDepts: string[] = [];
          if (currentUser.departmentId) userDepts.push(currentUser.departmentId.toString());
          if (currentUser.departmentIds && Array.isArray(currentUser.departmentIds)) {
            currentUser.departmentIds.forEach(id => userDepts.push(id.toString()));
          }

          const { getDepartmentHierarchyIds } = await import('../utils/departmentUtils');
          const authorizedDeptIds = await getDepartmentHierarchyIds(userDepts);

          const grievanceDeptId = (grievance.departmentId as any)?._id?.toString() || grievance.departmentId?.toString();
          const grievanceSubDeptId = (grievance.subDepartmentId as any)?._id?.toString() || grievance.subDepartmentId?.toString();
          
          const hasAccess = (grievanceDeptId && authorizedDeptIds.includes(grievanceDeptId)) || 
                            (grievanceSubDeptId && authorizedDeptIds.includes(grievanceSubDeptId));

          if (!hasAccess) {
            res.status(403).json({ success: false, message: 'Access denied - grievance not in your authorized department scope' });
            return;
          }
        }
      }
    }

    res.json({
      success: true,
      data: { grievance }
    });
  } catch (err: any) {
    logger.error('❌ testEmailConfiguration failed:', {
      message: err.message,
      code: err.code,
      command: err.command,
      stack: err.stack
    });
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
      details: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || '465',
        user: process.env.SMTP_USER,
        error: err,
        code: err.code,
        command: err.command
      }
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
    if (!currentUser.isSuperAdmin) {
      if (grievance.companyId?.toString() !== currentUser.companyId?.toString()) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }

      if (currentUser.departmentId || (currentUser.departmentIds && currentUser.departmentIds.length > 0)) {
        // Dynamic check for restricted users
        const canManage = req.checkPermission(Permission.ASSIGN_GRIEVANCE);
        if (!canManage) {
          if (grievance.assignedTo?.toString() !== currentUser._id.toString()) {
            res.status(403).json({ success: false, message: 'Access denied - not assigned to you' });
            return;
          }
        } else {
          // 🏢 Multi-Department & Hierarchical Scoping
          const userDepts: string[] = [];
          if (currentUser.departmentId) userDepts.push(currentUser.departmentId.toString());
          if (currentUser.departmentIds && Array.isArray(currentUser.departmentIds)) {
            currentUser.departmentIds.forEach(id => userDepts.push(id.toString()));
          }

          const { getDepartmentHierarchyIds } = await import('../utils/departmentUtils');
          const authorizedDeptIds = await getDepartmentHierarchyIds(userDepts);

          const grievanceDeptId = grievance.departmentId?.toString();
          const grievanceSubDeptId = grievance.subDepartmentId?.toString();
          
          const hasAccess = (grievanceDeptId && authorizedDeptIds.includes(grievanceDeptId)) || 
                            (grievanceSubDeptId && authorizedDeptIds.includes(grievanceSubDeptId));

          if (!hasAccess) {
            res.status(403).json({ success: false, message: 'Access denied - grievance not in your authorized department scope' });
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
      const {
        notifyHierarchyOnStatusChange,
        notifyCitizenOnGrievanceStatusChange,
        notifyCitizenOnResolution
      } = await import('../services/notificationService');

      const payload = {
        type: 'grievance' as const,
        action: 'status_change' as any,
        grievanceId: grievance.grievanceId,
        citizenName: grievance.citizenName,
        citizenPhone: grievance.citizenPhone,
        citizenWhatsApp: grievance.citizenWhatsApp,
        language: grievance.language,
        departmentId: grievance.departmentId,
        subDepartmentId: grievance.subDepartmentId,
        companyId: grievance.companyId,
        assignedTo: grievance.assignedTo,
        resolvedAt: grievance.resolvedAt,
        createdAt: grievance.createdAt,
        assignedAt: grievance.assignedAt,
        timeline: grievance.timeline,
        remarks: remarks || ''
      };

      await notifyHierarchyOnStatusChange(payload, oldStatus, status).catch(e => console.error('Admin notification failed:', e));

      if (status === GrievanceStatus.RESOLVED) {
        await notifyCitizenOnResolution(payload).catch(e => console.error('Citizen resolution notification failed:', e));
      } else {
        await notifyCitizenOnGrievanceStatusChange({
          companyId: grievance.companyId,
          grievanceId: grievance.grievanceId,
          citizenName: grievance.citizenName,
          citizenPhone: grievance.citizenPhone,
          citizenWhatsApp: grievance.citizenWhatsApp,
          language: grievance.language,
          description: grievance.description,
          departmentId: grievance.departmentId,
          subDepartmentId: grievance.subDepartmentId,
          newStatus: status,
          remarks: remarks || '',
          createdAt: grievance.createdAt,
          timeline: grievance.timeline
        }).catch(e => console.error('Citizen status notification failed:', e));
      }
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
    const { assignedTo, departmentId, note, description } = req.body;

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
    if (!currentUser.isSuperAdmin) {
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

    const transferNote = String(note || description || '').trim();
    const oldAssignedTo = grievance.assignedTo;
    const oldDepartmentId = grievance.departmentId;
    const oldSubDepartmentId = grievance.subDepartmentId;
    const [oldDepartmentDoc, oldSubDepartmentDoc] = await Promise.all([
      oldDepartmentId ? Department.findById(oldDepartmentId).select('_id name') : Promise.resolve(null),
      oldSubDepartmentId ? Department.findById(oldSubDepartmentId).select('_id name') : Promise.resolve(null)
    ]);
    let currentDepartmentName = oldDepartmentDoc?.name || grievance.category || 'General';
    let currentOfficeName = oldSubDepartmentDoc?.name || oldDepartmentDoc?.name || 'N/A';
    const originalDepartmentName = oldDepartmentDoc?.name || grievance.category || 'General';
    const originalOfficeName = oldSubDepartmentDoc?.name || oldDepartmentDoc?.name || 'N/A';

    // Update assignment details
    grievance.assignedTo = assignedUser._id;
    grievance.assignedAt = new Date();
    grievance.status = GrievanceStatus.ASSIGNED;

    // Auto-update department/sub-department based on assigned user's mapped department
    if (assignedUser.departmentId) {
      const targetDept = await Department.findById(assignedUser.departmentId).select('_id name parentDepartmentId');
      if (targetDept) {
        const parentDepartment = targetDept.parentDepartmentId
          ? await Department.findById(targetDept.parentDepartmentId).select('_id name')
          : null;
        const nextDepartmentId = parentDepartment?._id || targetDept._id;
        const nextSubDepartmentId = targetDept.parentDepartmentId ? targetDept._id : undefined;
        const toDepartmentName = parentDepartment?.name || targetDept.name || 'Department';
        const toSubDepartmentName = targetDept.parentDepartmentId ? targetDept.name : '';

        const departmentChanged =
          !oldDepartmentId ||
          oldDepartmentId.toString() !== nextDepartmentId.toString() ||
          oldSubDepartmentId?.toString() !== nextSubDepartmentId?.toString();
        if (departmentChanged) {
          grievance.departmentId = nextDepartmentId as any;
          grievance.subDepartmentId = nextSubDepartmentId as any;
          currentDepartmentName = toDepartmentName || currentDepartmentName;
          currentOfficeName = toSubDepartmentName || toDepartmentName || currentOfficeName;

          // Add department transfer event to timeline
          grievance.timeline.push({
            action: 'DEPARTMENT_TRANSFER',
            details: {
              grievanceId: grievance.grievanceId,
              fromDepartmentId: oldDepartmentId || null,
              fromSubDepartmentId: oldSubDepartmentId || null,
              toDepartmentId: nextDepartmentId,
              toSubDepartmentId: nextSubDepartmentId || null,
              toDepartmentName,
              toSubDepartmentName: toSubDepartmentName || null,
              toUserName: assignedUser.getFullName(),
              note: transferNote || null,
              reason: transferNote || 'Auto-updated during reassignment'
            },
            performedBy: req.user!._id,
            timestamp: new Date()
          });
        }
      } else {
        currentOfficeName = currentDepartmentName;
      }
    }

    // Add to status history
    const statusRemarks = transferNote
      ? `Assigned to user. Note: ${transferNote}`
      : departmentId
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
        grievanceId: grievance.grievanceId,
        fromUserId: oldAssignedTo,
        toUserId: assignedUser._id,
        toUserName: assignedUser.getFullName(),
        note: transferNote || null
      },
      performedBy: req.user!._id,
      timestamp: new Date()
    });

    await grievance.save();

    const isReassignment = Boolean(
      oldAssignedTo ||
      grievance.timeline?.some((entry: any) => entry.action === 'REVERTED_TO_COMPANY_ADMIN')
    );

      if (assignedUser.phone) {
        await triggerAdminTemplate({
          event: isReassignment ? 'grievance_reassigned_admin_v1' : 'grievance_assigned_admin_v1',
          companyId: grievance.companyId,
          language: grievance.language,
          recipientPhones: [assignedUser.phone],
          citizenPhone: grievance.citizenPhone,
          data: {
            admin_name: assignedUser.getFullName(),
            grievance_id: grievance.grievanceId,
            citizen_name: grievance.citizenName,
            department_name: currentDepartmentName,
            office_name: currentOfficeName,
            description: grievance.description,
            assigned_by: req.user!.getFullName(),
            reassigned_by: req.user!.getFullName(),
            assigned_on: formatTemplateDate(grievance.assignedAt || new Date()),
            reassigned_on: formatTemplateDate(grievance.assignedAt || new Date()),
            remarks: transferNote || 'Assigned for resolution.',
            original_department: originalDepartmentName,
            original_office: originalOfficeName
          }
        }).catch((err) => logger.error('Failed to trigger grievance assignment admin template', err));
      }

    // Notify assigned user
    const { notifyUserOnAssignment } = await import('../services/notificationService');
    await notifyUserOnAssignment({
      type: 'grievance',
      action: 'assigned',
      grievanceId: grievance.grievanceId,
      citizenName: grievance.citizenName,
      citizenPhone: grievance.citizenPhone,
      citizenWhatsApp: grievance.citizenWhatsApp,
      departmentId: grievance.departmentId,
      subDepartmentId: grievance.subDepartmentId,
      companyId: grievance.companyId,
      description: grievance.description,
      category: grievance.category,
      assignedTo: assignedUser._id,
      assignedByName: req.user!.getFullName(),
      assignedAt: grievance.assignedAt,
      createdAt: grievance.createdAt,
      language: grievance.language,
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
      language: grievance.language,
      description: grievance.description,
      departmentId: grievance.departmentId,
      subDepartmentId: grievance.subDepartmentId,
      departmentName: dept ? dept.name : undefined,
      newStatus: GrievanceStatus.ASSIGNED,
      remarks: `Your grievance has been assigned to ${assignedUser.getFullName()} for resolution.`,
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
    if (!currentUser.isSuperAdmin) {
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

    // Removed hardcoded Super Admin check to allow permission-based deletion

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
  
  // Removed hardcoded Super Admin check to allow permission-based deletion
  try {
    const grievance = await Grievance.findById(req.params.id);

    if (!grievance) {
      res.status(404).json({
        success: false,
        message: 'Grievance not found'
      });
      return;
    }

    // ✅ Multi-Tenant Scoping Check
    if (!currentUser.isSuperAdmin) {
      if (grievance.companyId?.toString() !== currentUser.companyId?.toString()) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }

      if (currentUser.departmentId || (currentUser.departmentIds && currentUser.departmentIds.length > 0)) {
        // 🏢 Multi-Department & Hierarchical Scoping
        const userDepts: string[] = [];
        if (currentUser.departmentId) userDepts.push(currentUser.departmentId.toString());
        if (currentUser.departmentIds && Array.isArray(currentUser.departmentIds)) {
          currentUser.departmentIds.forEach(id => userDepts.push(id.toString()));
        }

        const { getDepartmentHierarchyIds } = await import('../utils/departmentUtils');
        const authorizedDeptIds = await getDepartmentHierarchyIds(userDepts);

        const grievanceDeptId = grievance.departmentId?.toString();
        const grievanceSubDeptId = grievance.subDepartmentId?.toString();
        
        const hasAccess = (grievanceDeptId && authorizedDeptIds.includes(grievanceDeptId)) || 
                          (grievanceSubDeptId && authorizedDeptIds.includes(grievanceSubDeptId));

        if (!hasAccess) {
          res.status(403).json({ success: false, message: 'Access denied - grievance not in your authorized department scope' });
          return;
        }
      }
    }

    await Grievance.findByIdAndDelete(req.params.id);

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
