import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import User from '../models/User';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { requireDatabaseConnection } from '../middleware/dbConnection';
import { buildNameSearchQuery } from '../utils/searchUtils';
import { logUserAction } from '../utils/auditLogger';
import { AuditAction, Permission, UserRole } from '../config/constants';

const router = express.Router();

// All routes require database connection and authentication
router.use(requireDatabaseConnection);
router.use(authenticate);

// @route   GET /api/users
// @desc    Get all users (scoped by role)
// @access  Private
router.get('/', requirePermission(Permission.READ_USER), async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, search, role, companyId, departmentId, status } = req.query;
    const currentUser = req.user!;

    const query: any = {};

    // Determine target companyId for scoping
    const targetCompanyId = (currentUser.isSuperAdmin && companyId) ? companyId : currentUser.companyId;

    // Strict multi-tenant scoping
    if (targetCompanyId) {
      query.companyId = targetCompanyId;
      
      // If restricted to a department (for non-Super Admins), scope them.
      // Support multiple department scoping for the current user
      const userDepts = [];
      if (currentUser.departmentId) userDepts.push(currentUser.departmentId.toString());
      if (currentUser.departmentIds && Array.isArray(currentUser.departmentIds)) {
        currentUser.departmentIds.forEach(id => userDepts.push(id.toString()));
      }
      const uniqueUserDepts = [...new Set(userDepts)];

      if (uniqueUserDepts.length > 0 && !currentUser.isSuperAdmin && currentUser.level !== 1) {
        // Hierarchical scoping: include all sub-departments
        const { getDepartmentHierarchyIds } = await import('../utils/departmentUtils');
        const deptIds = await getDepartmentHierarchyIds(uniqueUserDepts);
        
        // Multi-tenant Visibility Rule:
        // Users see: 1. Their department chain, 2. GLOBAL personnel (Admins with no dept)
        query.$or = [
          { departmentIds: { $in: [...deptIds, null] } },
          { departmentIds: { $exists: false } }
        ];
      } else if (departmentId) {
        // Even Company Admins or Super Admins in drilldown can filter by department
        const filterDeptIds = typeof departmentId === 'string' && departmentId.includes(',') 
          ? departmentId.split(',') 
          : [departmentId];
          
        query.departmentIds = { $in: filterDeptIds };
      }
    } else if (!currentUser.isSuperAdmin) {
      // Safety check: Non-SuperAdmins MUST have a companyId
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: User missing company assignment'
      });
    } else if (departmentId) {
       // Global Super Admin (no companyId) filtering by department
       const filterDeptIds = typeof departmentId === 'string' && departmentId.includes(',') 
         ? departmentId.split(',') 
         : [departmentId];
         
       query.departmentIds = { $in: filterDeptIds };
    }
    // If Super Admin and NO targetCompanyId, query remains empty (sees everything)

    // 🔍 SEARCH LOGIC
    if (search) {
      // 1. Basic field search (everything visible on screen)
      const searchCriteria: any[] = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { userId: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { designations: { $regex: search, $options: 'i' } },
        ...buildNameSearchQuery(search as string, 'firstName', 'lastName')
      ];

      // 2. Department Name Search (Relational)
      const Department = (await import('../models/Department')).default;
      const matchingDepts = await Department.find({
        companyId: targetCompanyId || { $exists: true },
        $or: [
          { name: { $regex: search as string, $options: 'i' } },
          { nameHi: { $regex: search as string, $options: 'i' } },
          { nameOr: { $regex: search as string, $options: 'i' } },
          { nameMr: { $regex: search as string, $options: 'i' } },
          { departmentIds: { $regex: search as string, $options: 'i' } }
        ]
      }).select('_id');
      
      if (matchingDepts.length > 0) {
        const deptIdsArr = matchingDepts.map(d => d._id);
        searchCriteria.push({ 
          departmentIds: { $in: deptIdsArr }
        });
      }

      // 3. Custom Role Name Search (Relational)
      const Role = (await import('../models/Role')).default;
      const matchingRoles = await Role.find({
        companyId: targetCompanyId || { $exists: true },
        name: { $regex: search as string, $options: 'i' }
      }).select('_id');

      if (matchingRoles.length > 0) {
        const roleIdsArr = matchingRoles.map(r => r._id);
        searchCriteria.push({ customRoleId: { $in: roleIdsArr } });
      }

      // Merge with existing filters (like role or companyId)
      if (query.$or) {
        const existingOr = query.$or;
        delete query.$or;
        query.$and = [
          { $or: existingOr },
          { $or: searchCriteria }
        ];
      } else {
        query.$or = searchCriteria;
      }
    }

    if (role) {
      // Role filter now always uses customRoleId (all users must have one)
      query.customRoleId = role;
    }

    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'inactive') {
      query.isActive = false;
    }

    const users = await User.find(query)
      .populate('companyId', 'name companyId')
      .populate('departmentIds', 'name departmentId') // Populate multiple departments
      .populate('customRoleId', 'name')
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: {
        users,
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
      message: 'Failed to fetch users',
      error: error.message
    });
  }
});

// @route   POST /api/users
// @desc    Create new user
// @access  Private
router.post('/', requirePermission(Permission.CREATE_USER), async (req: Request, res: Response) => {
  try {
    console.log('📝 User creation request received');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    const currentUser = req.user!;
    console.log('Current user:', { id: currentUser._id, isSuperAdmin: currentUser.isSuperAdmin, level: currentUser.level, companyId: currentUser.companyId });
    
    // Access is determined by CREATE_USER permission (already checked in middleware)
    // Permission-based RBAC is now the single source of truth.
    
    const { firstName, lastName, email, password, phone, role, departmentId, departmentIds, customRoleId, designation, designations } = req.body;
    let companyId = req.body.companyId;

    // Validation
    if (!firstName || !lastName || !password || !customRoleId) {
      console.log('❌ Validation failed: Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields (Name, Password, and Role ID)'
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Validate and normalize phone number if provided
    let normalizedPhone = phone;
    if (phone && phone.trim()) {
      const { validatePhoneNumber, normalizePhoneNumber } = await import('../utils/phoneUtils');
      const phoneTrimmed = phone.trim();
      if (!validatePhoneNumber(phoneTrimmed)) {
        return res.status(400).json({
          success: false,
          message: 'Phone number must be exactly 10 digits'
        });
      }
      normalizedPhone = normalizePhoneNumber(phoneTrimmed);
    } else {
      // If phone is empty or not provided, set to undefined
      normalizedPhone = undefined;
    }
    console.log('✅ Basic validation passed');

    // Scope validation and role-specific requirements
    // Scope validation
    if (!currentUser.isSuperAdmin) {
      // Non-SuperAdmins can only create users in their own company
      if (companyId && companyId !== currentUser.companyId?.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only create users for your own company'
        });
      }

      // If restricted by department
      if (currentUser.departmentId && departmentId !== currentUser.departmentId?.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only create users for your own department'
        });
      }

      // Prohibit creating SuperAdmins
      if (role === UserRole.SUPER_ADMIN) {
        return res.status(403).json({
          success: false,
          message: 'You cannot create SuperAdmin users'
        });
      }
      
      // Auto-set companyId if not provided
      if (!companyId && currentUser.companyId) {
        companyId = currentUser.companyId.toString();
      }
    }

    // ─── Hierarchical Creation Rights (Dynamic) ──────────────────────────────────
    if (!currentUser.isSuperAdmin) {
      // 1. Operator Check: Operators cannot create any users
      if (currentUser.level === 4) {
        return res.status(403).json({
          success: false,
          message: 'Operators are not authorized to create personnel'
        });
      }

      // 2. Fetch the target role details
      let targetRoleName = role || '';
      if (customRoleId) {
        const Role = (await import('../models/Role')).default;
        const cRole = await Role.findById(customRoleId);
        if (cRole) targetRoleName = cRole.name;
      }
      
      const targetRoleLower = targetRoleName.toLowerCase();
      const creatorLevel = currentUser.level || 5;

      // 3. Level-Based Enforcement
      // Rules:
      // - Company Admin: Can create anything except SuperAdmin
      // - Dept Admin: Can create Dept Admin, Sub-Dept Admin, Operator
      // - Sub-Dept Admin: Can create Sub-Dept Admin, Operator

      if (creatorLevel === 3) {
        // 🔒 Sub-Dept Admin (Level 3) can ONLY create Operators (Level 4)
        const allowedTargets = ['operator'];
        if (!allowedTargets.some(t => targetRoleLower.includes(t))) {
          return res.status(403).json({
            success: false,
            message: 'Sub-Department Administrators can only create Operator level personnel'
          });
        }
      } else if (creatorLevel === 2) {
        // 🛡️ Dept Admin (Level 2) can create Sub-Dept Admin (Level 3) or Operator (Level 4)
        const allowedTargets = ['sub-department admin', 'sub department admin', 'operator'];
        if (!allowedTargets.some(t => targetRoleLower.includes(t))) {
          return res.status(403).json({
            success: false,
            message: 'Department Administrators can only assign Sub-Department Admin or Operator roles'
          });
        }
      }
      // Company Admin (default if not dept/sub-dept) can create anything within the company
    }

    console.log('✅ Hierarchy validation passed');
    
    // Determine the target company for the new user
    let finalCompanyId = companyId;
    if (departmentId && !finalCompanyId) {
      const Department = (await import('../models/Department')).default;
      const department = await Department.findById(departmentIds?.[0] || departmentId);
      if (department) {
        finalCompanyId = department.companyId.toString();
        console.log('✅ Auto-set companyId from department:', finalCompanyId);
      }
    }

    // Company ID remains mandatory for all roles except SuperAdmin
    if (!finalCompanyId && !currentUser.isSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Company ID is required'
      });
    }
    
    console.log('✅ Scope validation passed');
    
    // Check if email already exists in the same company
    // Allow same email/phone across different companies, but not within the same company
    // For SUPER_ADMIN (companyId = null), keep email/phone globally unique
    if (email) {
      const emailQuery: any = { 
        email: email.toLowerCase().trim()
      };
      
      // For SUPER_ADMIN, check globally; for others, check within company
      if (finalCompanyId) {
        emailQuery.companyId = finalCompanyId;
      } else {
        // SUPER_ADMIN: check globally (companyId is null or undefined)
        emailQuery.$or = [
          { companyId: null },
          { companyId: { $exists: false } }
        ];
      }
      
      const existingUser = await User.findOne(emailQuery);
      if (existingUser) {
        console.log('❌ User with email already exists:', email);
        const message = finalCompanyId 
          ? 'User with this email already exists in this company'
          : 'User with this email already exists';
        return res.status(400).json({
          success: false,
          message
        });
      }
    }
    console.log('✅ Email is unique');

    // Check if phone already exists in the same company
    if (normalizedPhone) {
      const phoneQuery: any = { 
        phone: normalizedPhone
      };
      
      // For SUPER_ADMIN, check globally; for others, check within company
      if (finalCompanyId) {
        phoneQuery.companyId = finalCompanyId;
      } else {
        // SUPER_ADMIN: check globally (companyId is null or undefined)
        phoneQuery.$or = [
          { companyId: null },
          { companyId: { $exists: false } }
        ];
      }
      
      const existingPhoneUser = await User.findOne(phoneQuery);
      if (existingPhoneUser) {
        console.log('❌ User with phone already exists:', normalizedPhone);
        const message = finalCompanyId 
          ? 'User with this phone number already exists in this company'
          : 'User with this phone number already exists';
        return res.status(400).json({
          success: false,
          message
        });
      }
    }
    console.log('✅ Phone is unique');
    
    console.log('Creating user with data:', { firstName, lastName, email, role, companyId: finalCompanyId, departmentId, departmentIds });
    
    // Database connection is already checked by middleware

    // Create user in database
    let user;
    try {
      user = await User.create({
        firstName,
        lastName,
        email: email.toLowerCase().trim(),
        password,
        phone: normalizedPhone,
        designations: (Array.isArray(designations) && designations.length > 0) ? designations : (designation ? [designation] : undefined),
        customRoleId: customRoleId,
        companyId: finalCompanyId || undefined,
        departmentIds: (Array.isArray(departmentIds) && departmentIds.length > 0) ? departmentIds : (departmentId ? [departmentId] : undefined),
        isActive: true,
        rawPassword: password,
        createdBy: currentUser._id // Track who created this user for hierarchical rights
      });
      console.log('✅ User created successfully in database:', user.userId);
      console.log('✅ User ID:', user._id);
      console.log('✅ User companyId:', user.companyId);
      console.log('✅ User departmentId:', user.departmentId);
    } catch (dbError: any) {
      console.error('❌ Database save error:', dbError);
      console.error('Error name:', dbError.name);
      console.error('Error code:', dbError.code);
      console.error('Error message:', dbError.message);
      
      // Handle duplicate key error
      if (dbError.code === 11000) {
        const field = Object.keys(dbError.keyPattern || {})[0];
        return res.status(400).json({
          success: false,
          message: `User with this ${field} already exists`,
          error: dbError.message
        });
      }
      
      return res.status(500).json({
        success: false,
        message: 'Failed to save user to database',
        error: dbError.message
      });
    }

    // Verify user was saved
    const savedUser = await User.findById(user._id);
    if (!savedUser) {
      console.error('❌ User was not saved to database');
      return res.status(500).json({
        success: false,
        message: 'User creation failed - user not found in database'
      });
    }
    console.log('✅ Verified user exists in database:', savedUser.userId);

    // Audit logging - don't let this fail the request
    try {
      await logUserAction(
        req,
        AuditAction.CREATE,
        'User',
        user._id.toString(),
        { userName: user.getFullName(), email: user.email }
      );
      console.log('✅ Audit log created');
    } catch (auditError: any) {
      console.error('⚠️ Audit logging failed (non-critical):', auditError.message);
    }

    // Automatically update department contact info if user has department management permissions OR is a Department Admin
    if (departmentId) {
      const { normalizePhoneNumber } = await import('../utils/phoneUtils');
      const finalPhone = normalizePhoneNumber(phone || '');
      
      // Update if explicit permission or if role implies it
      const isDeptAdmin = role && role.toLowerCase().includes('admin');
      
      if (req.checkPermission(Permission.UPDATE_DEPARTMENT) || isDeptAdmin) {
        try {
          const Department = (await import('../models/Department')).default;
          await Department.findByIdAndUpdate(departmentId, {
            contactPerson: `${firstName} ${lastName}`,
            contactEmail: email.toLowerCase().trim(),
            contactPhone: finalPhone
          });
          console.log(`✅ Updated department ${departmentId} contact info with admin details`);
        } catch (deptUpdateError: any) {
          console.error('⚠️ Failed to update department contact info (non-critical):', deptUpdateError.message);
        }
      }
    }

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        user: {
          id: user._id,
          userId: user.userId,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          customRoleId: user.customRoleId,
          isActive: user.isActive
        }
      }
    });
  } catch (error: any) {
    console.error('❌ User creation error:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    return res.status(500).json({
      success: false,
      message: 'Failed to create user',
      error: error.message
    });
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private
router.get('/:id', requirePermission(Permission.READ_USER), async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;
    const user = await User.findById(req.params.id)
      .populate('companyId', 'name companyId')
      .populate('departmentId', 'name departmentId')
      .populate('departmentIds', 'name departmentId')
      .populate('customRoleId', 'name')
      .select('-password');

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    // Check access
    if (!currentUser.isSuperAdmin) {
      if (user.companyId?._id.toString() !== currentUser.companyId?.toString()) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }

      // 🏢 Multi-Department & Hierarchical Scoping
      const userDepts: string[] = [];
      if (currentUser.departmentId) userDepts.push(currentUser.departmentId.toString());
      if (currentUser.departmentIds && Array.isArray(currentUser.departmentIds)) {
        currentUser.departmentIds.forEach(id => userDepts.push(id.toString()));
      }

      if (userDepts.length > 0) {
        const { getDepartmentHierarchyIds } = await import('../utils/departmentUtils');
        const authorizedDeptIds = await getDepartmentHierarchyIds(userDepts);

        const targetDeptId = (user.departmentId?._id ? user.departmentId._id.toString() : user.departmentId?.toString()) || "";
        const targetDeptIds = (user.departmentIds || []).map((d: any) => (d._id || d).toString());

        const hasAccess = authorizedDeptIds.includes(targetDeptId) || 
                          targetDeptIds.some(id => authorizedDeptIds.includes(id));

        if (!hasAccess) {
          res.status(403).json({ success: false, message: 'Access denied: User belongs to a different department scope' });
          return;
        }
      }
    }

    res.json({
      success: true,
      data: { user }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
      error: error.message
    });
  }
});

// @route   PUT /api/users/:id
// @desc    Update user
// @access  Private
router.put('/:id', requirePermission(Permission.UPDATE_USER), async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;
    const existingUser = await User.findById(req.params.id);

    if (!existingUser) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    // Check for fine-grained update permission
    if (!req.checkPermission(Permission.UPDATE_USER)) {
      res.status(403).json({ success: false, message: 'You do not have permission to update users' });
      return;
    }

    // Prevent self-deactivation
    if (existingUser._id.toString() === currentUser._id.toString() && req.body.isActive === false) {
      res.status(403).json({
        success: false,
        message: 'You cannot deactivate yourself'
      });
      return;
    }

    // Prevent users from editing their own scope
    if (existingUser._id.toString() === currentUser._id.toString()) {
      if (req.body.customRoleId && req.body.customRoleId !== existingUser.customRoleId?.toString()) {
        res.status(403).json({
          success: false,
          message: 'You cannot change your own role'
        });
        return;
      }
      if (req.body.departmentId && req.body.departmentId !== existingUser.departmentId?.toString()) {
        res.status(403).json({
          success: false,
          message: 'You cannot change your own department'
        });
        return;
      }
    }

    // Clean up empty strings for ID fields
    if (req.body.companyId === '') {
      req.body.companyId = null;
    }
    if (req.body.departmentId === '') {
      req.body.departmentId = null;
    }
    if (req.body.customRoleId === '') {
      req.body.customRoleId = null;
    }

    // Check access based on company/department scope
    if (!currentUser.isSuperAdmin) {
      if (existingUser.companyId?.toString() !== currentUser.companyId?.toString()) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }
      // 🏢 Multi-Department & Hierarchical Scoping
      const userDepts: string[] = [];
      if (currentUser.departmentId) userDepts.push(currentUser.departmentId.toString());
      if (currentUser.departmentIds && Array.isArray(currentUser.departmentIds)) {
        currentUser.departmentIds.forEach(id => userDepts.push(id.toString()));
      }

      if (userDepts.length > 0) {
        const { getDepartmentHierarchyIds } = await import('../utils/departmentUtils');
        const authorizedDeptIds = await getDepartmentHierarchyIds(userDepts);

        const targetDeptId = existingUser.departmentId?.toString() || "";
        const targetDeptIds = (existingUser.departmentIds || []).map((id: any) => id.toString());

        const hasAccess = authorizedDeptIds.includes(targetDeptId) || 
                          targetDeptIds.some(id => authorizedDeptIds.includes(id));

        if (!hasAccess) {
          res.status(403).json({ success: false, message: 'Access denied: Management scope restricted to authorized departments' });
          return;
        }
      }
    }

    // Hierarchical Rights Enforcement (Dynamic)
    if (!currentUser.isSuperAdmin) {
      // 1. Level Check: Department users cannot edit Company-level users
      if (currentUser.departmentId && !existingUser.departmentId) {
        res.status(403).json({
          success: false,
          message: 'Department users cannot edit Company-level administrators'
        });
        return;
      }

      // 2. Creator Check: If both are at the same level (both Company or same Department)
      // and the target is not the current user themselves, only allow if current user created the target
      // This prevents horizontal privilege escalation between admins of the same level.
      const isSameLevel = (!!currentUser.departmentId === !!existingUser.departmentId);
      const isSelf = existingUser._id.toString() === currentUser._id.toString();

      if (isSameLevel && !isSelf) {
         const targetCreatorId = existingUser.createdBy?.toString();
         const targetCreator = targetCreatorId ? await User.findById(targetCreatorId) : null;
         const isCreatedBySuperAdmin = !targetCreatorId || targetCreator?.isSuperAdmin;

         // Primary admins (created by SuperAdmin) can only be edited by SuperAdmin
         if (isCreatedBySuperAdmin) {
           res.status(403).json({
             success: false,
             message: 'This is a primary account. Only SuperAdmin can modify it.'
           });
           return;
         }

         // Otherwise, verify creator chain
         if (targetCreatorId !== currentUser._id.toString()) {
            res.status(403).json({
              success: false,
              message: 'You can only edit accounts that you created.'
            });
            return;
         }
      }
    }

    // Role-based restrictions for role changes
    if (req.body.customRoleId) {
      if (!currentUser.isSuperAdmin) {
        const Role = (await import('../models/Role')).default;
        const targetRole = await Role.findById(req.body.customRoleId);
        
        if (targetRole) {
          const targetRoleLower = targetRole.name.toLowerCase();
          const creatorLevel = currentUser.level || 5;

          if (targetRole.key === 'SUPER_ADMIN') {
            return res.status(403).json({ success: false, message: 'You cannot assign SuperAdmin role' });
          }

          if (creatorLevel === 3) {
            // 🔒 Sub-Dept Admin (Level 3) can ONLY assign Operators (Level 4)
            const allowedTargets = ['operator'];
            if (!allowedTargets.some(t => targetRoleLower.includes(t))) {
              return res.status(403).json({
                success: false,
                message: 'Sub-Department Administrators can only assign Operator roles'
              });
            }
          } else if (creatorLevel === 2) {
            // 🛡️ Dept Admin (Level 2) can assign Sub-Dept Admin (Level 3) or Operator (Level 4)
            const allowedTargets = ['sub-department admin', 'sub department admin', 'operator'];
            if (!allowedTargets.some(t => targetRoleLower.includes(t))) {
              return res.status(403).json({
                success: false,
                message: 'Department Administrators can only assign Sub-Department Admin or Operator roles'
              });
            }
          }
        }
      }
    }

    // Don't allow password update through this route
    delete req.body.password;

    // Check if email/phone is being updated and validate uniqueness within the same company
    // For SUPER_ADMIN (companyId = null), keep email/phone globally unique
    if (req.body.email && req.body.email !== existingUser.email) {
      const normalizedEmail = req.body.email.toLowerCase().trim();
      const emailQuery: any = {
        email: normalizedEmail,
        _id: { $ne: existingUser._id } // Exclude current user
      };
      
      // For SUPER_ADMIN, check globally; for others, check within company
      if (existingUser.companyId) {
        emailQuery.companyId = existingUser.companyId;
      } else {
        // SUPER_ADMIN: check globally (companyId is null or undefined)
        emailQuery.$or = [
          { companyId: null },
          { companyId: { $exists: false } }
        ];
      }
      
      const conflictingUser = await User.findOne(emailQuery);
      
      if (conflictingUser) {
        const message = existingUser.companyId 
          ? 'User with this email already exists in this company'
          : 'User with this email already exists';
        return res.status(400).json({
          success: false,
          message
        });
      }
    }

    // Check if phone is being updated and validate uniqueness within the same company
    if (req.body.phone && req.body.phone !== existingUser.phone) {
      // Normalize phone number
      let normalizedPhone = req.body.phone;
      if (normalizedPhone && normalizedPhone.trim()) {
        const { validatePhoneNumber, normalizePhoneNumber } = await import('../utils/phoneUtils');
        const phoneTrimmed = normalizedPhone.trim();
        if (!validatePhoneNumber(phoneTrimmed)) {
          return res.status(400).json({
            success: false,
            message: 'Phone number must be exactly 10 digits'
          });
        }
        normalizedPhone = normalizePhoneNumber(phoneTrimmed);
      }

      const phoneQuery: any = {
        phone: normalizedPhone,
        _id: { $ne: existingUser._id } // Exclude current user
      };
      
      // For SUPER_ADMIN, check globally; for others, check within company
      if (existingUser.companyId) {
        phoneQuery.companyId = existingUser.companyId;
      } else {
        // SUPER_ADMIN: check globally (companyId is null or undefined)
        phoneQuery.$or = [
          { companyId: null },
          { companyId: { $exists: false } }
        ];
      }

      const conflictingUser = await User.findOne(phoneQuery);
      
      if (conflictingUser) {
        const message = existingUser.companyId 
          ? 'User with this phone number already exists in this company'
          : 'User with this phone number already exists';
        return res.status(400).json({
          success: false,
          message
        });
      }
      
      // Update the phone in req.body with normalized version
      req.body.phone = normalizedPhone;
    }

    let user = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).select('-password')
     .populate('companyId', 'name companyId')
     .populate('departmentId', 'name departmentId')
     .populate('departmentIds', 'name departmentId')
     .populate('customRoleId', 'name');

    await logUserAction(
      req,
      AuditAction.UPDATE,
      'User',
      user!._id.toString(),
      { updates: req.body }
    );

    // Automatically update department contact info if the user has department management permissions OR is a Department Admin
    if (user && user.departmentId) {
      const Role = (await import('../models/Role')).default;
      const customRole = user.customRoleId ? await Role.findById(user.customRoleId) : null;
      const roleName = customRole ? customRole.name : (user.designation || '');
      
      const managementRole = customRole ? await Role.findOne({
        _id: user.customRoleId,
        'permissions.module': 'DEPARTMENTS',
        'permissions.actions': { $in: ['update', 'all', 'manage'] }
      }) : null;

      const isDeptAdmin = roleName.toLowerCase().includes('admin');

      if (managementRole || isDeptAdmin || req.checkPermission(Permission.UPDATE_DEPARTMENT)) {
        try {
          const Department = (await import('../models/Department')).default;
          await Department.findByIdAndUpdate(user.departmentId, {
            contactPerson: `${user.firstName} ${user.lastName}`,
            contactEmail: user.email,
            contactPhone: user.phone
          });
          console.log(`✅ Updated department ${user.departmentId} contact info with admin details`);
        } catch (deptUpdateError: any) {
          console.error('⚠️ Failed to update department contact info (non-critical):', deptUpdateError.message);
        }
      }
    }

    res.json({
      success: true,
      message: 'User updated successfully',
      data: { user }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: error.message
    });
  }
});

// @route   DELETE /api/users/:id
// @desc    Soft delete user
// @access  Private
router.delete('/:id', requirePermission(Permission.DELETE_USER), async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;
    const existingUser = await User.findById(req.params.id);

    if (!existingUser) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    // Prevent self-deletion
    if (existingUser._id.toString() === currentUser._id.toString()) {
      res.status(403).json({
        success: false,
        message: 'You cannot delete yourself'
      });
      return;
    }

    // Check access based on company/department scope
    if (!currentUser.isSuperAdmin) {
      if (existingUser.companyId?.toString() !== currentUser.companyId?.toString()) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }
      // 🏢 Multi-Department & Hierarchical Scoping
      const userDepts: string[] = [];
      if (currentUser.departmentId) userDepts.push(currentUser.departmentId.toString());
      if (currentUser.departmentIds && Array.isArray(currentUser.departmentIds)) {
        currentUser.departmentIds.forEach(id => userDepts.push(id.toString()));
      }

      if (userDepts.length > 0) {
        const { getDepartmentHierarchyIds } = await import('../utils/departmentUtils');
        const authorizedDeptIds = await getDepartmentHierarchyIds(userDepts);

        const targetDeptId = existingUser.departmentId?.toString() || "";
        const targetDeptIds = (existingUser.departmentIds || []).map((id: any) => id.toString());

        const hasAccess = authorizedDeptIds.includes(targetDeptId) || 
                          targetDeptIds.some(id => authorizedDeptIds.includes(id));

        if (!hasAccess) {
          res.status(403).json({ success: false, message: 'Access denied: Management scope restricted to authorized departments' });
          return;
        }
      }
    }

    // 1. Permission Check
    if (!req.checkPermission(Permission.DELETE_USER)) {
      res.status(403).json({ success: false, message: 'You do not have permission to delete users' });
      return;
    }

    // 2. Hierarchical Rights Enforcement (Dynamic)
    if (!currentUser.isSuperAdmin) {
      // 2.1 Level Check: Department users cannot delete Company-level users
      if (currentUser.departmentId && !existingUser.departmentId) {
        res.status(403).json({
          success: false,
          message: 'Department users cannot delete Company-level administrators'
        });
        return;
      }

      // 2.2 Creator Check
      const isSameLevel = (!!currentUser.departmentId === !!existingUser.departmentId);
      const isSelf = existingUser._id.toString() === currentUser._id.toString();

      if (isSameLevel && !isSelf) {
         const targetCreatorId = existingUser.createdBy?.toString();
         const targetCreator = targetCreatorId ? await User.findById(targetCreatorId) : null;
         const isCreatedBySuperAdmin = !targetCreatorId || targetCreator?.isSuperAdmin;

         if (isCreatedBySuperAdmin) {
           res.status(403).json({
             success: false,
             message: 'This is a primary account. Only SuperAdmin can modify it.'
           });
           return;
         }

         if (targetCreatorId !== currentUser._id.toString()) {
            res.status(403).json({
              success: false,
              message: 'You can only delete accounts that you created.'
            });
            return;
         }
      }
      // 2.3 Sub-Dept Admin Check: Cannot delete any users
      if (currentUser.level !== undefined && currentUser.level >= 3) {
        return res.status(403).json({
          success: false,
          message: 'Sub-Department Administrators are not authorized to delete personnel'
        });
      }
    }

    const user = await User.findByIdAndDelete(req.params.id);

    await logUserAction(
      req,
      AuditAction.DELETE,
      'User',
      user!._id.toString()
    );

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error.message
    });
  }
});

// @route   PUT /api/users/:id/activate
// @desc    Activate/deactivate user
// @access  Private
router.put('/:id/activate', requirePermission(Permission.UPDATE_USER), async (req: Request, res: Response) => {
  try {
    const { isActive } = req.body;
    const currentUser = req.user!;
    const existingUser = await User.findById(req.params.id);

    if (!existingUser) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    // Prevent self-deactivation
    if (existingUser._id.toString() === currentUser._id.toString() && isActive === false) {
      res.status(403).json({
        success: false,
        message: 'You cannot deactivate yourself'
      });
      return;
    }

    // 1. Hierarchical Rights: Check if the user can activate/deactivate the target user
    if (!currentUser.isSuperAdmin) {
      // 1.1 Level Check: Department users cannot manage Company-level users
      if (currentUser.departmentId && !existingUser.departmentId) {
        res.status(403).json({
          success: false,
          message: 'Department users cannot manage Company-level administrators'
        });
        return;
      }

      // 1.2 Creator Check
      const isSameLevel = (!!currentUser.departmentId === !!existingUser.departmentId);
      const isSelf = existingUser._id.toString() === currentUser._id.toString();

      if (isSameLevel && !isSelf) {
         const targetCreatorId = existingUser.createdBy?.toString();
         const targetCreator = targetCreatorId ? await User.findById(targetCreatorId) : null;
         const isCreatedBySuperAdmin = !targetCreatorId || targetCreator?.isSuperAdmin;

         if (isCreatedBySuperAdmin) {
           res.status(403).json({
             success: false,
             message: 'This is a primary account. Only SuperAdmin can modify it.'
           });
           return;
         }

         if (targetCreatorId !== currentUser._id.toString()) {
            res.status(403).json({
              success: false,
              message: 'You can only manage accounts that you created.'
            });
            return;
         }
      }
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true }
    ).select('-password');

    await logUserAction(
      req,
      AuditAction.UPDATE,
      'User',
      user!._id.toString(),
      { action: isActive ? 'activated' : 'deactivated' }
    );

    res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: { user }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to update user status',
      error: error.message
    });
  }
});

export default router;
