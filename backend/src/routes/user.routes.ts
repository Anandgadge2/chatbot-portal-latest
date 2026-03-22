import express, { Request, Response } from 'express';
import User from '../models/User';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { requireDatabaseConnection } from '../middleware/dbConnection';
import { logUserAction } from '../utils/auditLogger';
import { AuditAction, Permission, UserRole } from '../config/constants';
import Role from '../models/Role';
import { canAssignRole } from '../utils/accessControl';

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

    // Scope based on user role
    if (currentUser.isSuperAdmin) {
      // SuperAdmin can see all users, optionally filter by company/dept
      if (companyId) query.companyId = companyId;
      if (departmentId) {
        if (typeof departmentId === 'string' && departmentId.includes(',')) {
          query.departmentId = { $in: departmentId.split(',') };
        } else {
          query.departmentId = departmentId;
        }
      }
    } else {
      // All other users are scoped by their company
      query.companyId = currentUser.companyId;
      
      // If the current user is restricted to a department, scope them.
      // Otherwise (like a Company Admin), they can see all users in company or filter by dept.
      if (currentUser.departmentId) {
        query.departmentId = currentUser.departmentId;
      } else if (departmentId) {
        if (typeof departmentId === 'string' && departmentId.includes(',')) {
          query.departmentId = { $in: departmentId.split(',') };
        } else {
          query.departmentId = departmentId;
        }
      }
    }

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { userId: { $regex: search, $options: 'i' } }
      ];
    }

    if (role) {
      query.customRoleId = role;
    }

    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'inactive') {
      query.isActive = false;
    }

    const users = await User.find(query)
      .populate('companyId', 'name companyId')
      .populate('departmentId', 'name departmentId')
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
    console.log('Current user:', { id: currentUser._id, role: currentUser.role, companyId: currentUser.companyId });
    
    // Access is determined by CREATE_USER permission (already checked in middleware)
    // Permission-based RBAC is now the single source of truth.
    
    const { firstName, lastName, email, password, phone, departmentId, subDepartmentId, customRoleId, designation, isSuperAdmin } = req.body;
    let companyId = req.body.companyId;

    // Validation
    if (!firstName || !lastName || !email || !password || (!isSuperAdmin && !customRoleId)) {
      console.log('❌ Validation failed: Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
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
      if (isSuperAdmin) {
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
    
    // Determine the target company for the new user
    let finalCompanyId = companyId;
    if (departmentId && !finalCompanyId) {
      const Department = (await import('../models/Department')).default;
      const department = await Department.findById(departmentId);
      if (department) {
        finalCompanyId = department.companyId.toString();
        console.log('✅ Auto-set companyId from department:', finalCompanyId);
      }
    }

    // Company ID remains mandatory for all roles except SuperAdmin
    if (!finalCompanyId && !isSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Company ID is required'
      });
    }
    
    console.log('✅ Scope validation passed');

    if (customRoleId) {
      const targetRole = await Role.findById(customRoleId).select('level companyId');
      if (!targetRole) {
        return res.status(404).json({ success: false, message: 'Assigned role not found' });
      }
      if (!currentUser.isSuperAdmin && targetRole.companyId?.toString() !== finalCompanyId?.toString()) {
        return res.status(400).json({ success: false, message: 'Assigned role does not belong to this company' });
      }
      const allowedToAssignRole = await canAssignRole(currentUser, targetRole.level);
      if (!allowedToAssignRole) {
        return res.status(403).json({ success: false, message: 'You can only assign roles strictly below your own level' });
      }
    }
    
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
    
    console.log('Creating user with data:', { firstName, lastName, email, customRoleId, isSuperAdmin, companyId: finalCompanyId, departmentId, subDepartmentId });
    
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
        isSuperAdmin: Boolean(isSuperAdmin),
        designation,
        customRoleId: customRoleId || undefined,
        companyId: finalCompanyId || undefined,
        departmentId: departmentId || undefined,
        subDepartmentId: subDepartmentId || undefined,
        isActive: true,
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
      const isDeptAdmin = false;
      
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
          isSuperAdmin: user.isSuperAdmin,
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
      if (currentUser.departmentId && user.departmentId?._id.toString() !== currentUser.departmentId?.toString()) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
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

    // Prevent users from editing their own role and department
    if (existingUser._id.toString() === currentUser._id.toString()) {
      if (req.body.isSuperAdmin !== undefined && req.body.isSuperAdmin !== existingUser.isSuperAdmin) {
        res.status(403).json({
          success: false,
          message: 'You cannot change your own superadmin status'
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
      if (currentUser.departmentId && existingUser.departmentId?.toString() !== currentUser.departmentId?.toString()) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
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
         const isCreatedBySuperAdmin = !targetCreatorId || (await User.findById(targetCreatorId))?.isSuperAdmin === true;

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
    if (req.body.isSuperAdmin === true && !currentUser.isSuperAdmin) {
      return res.status(403).json({ success: false, message: 'You cannot assign SuperAdmin role' });
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
      const roleName = customRole ? customRole.name : '';
      
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
      if (currentUser.departmentId && existingUser.departmentId?.toString() !== currentUser.departmentId?.toString()) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
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
         const isCreatedBySuperAdmin = !targetCreatorId || (await User.findById(targetCreatorId))?.isSuperAdmin === true;

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
         const isCreatedBySuperAdmin = !targetCreatorId || (await User.findById(targetCreatorId))?.isSuperAdmin === true;

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
