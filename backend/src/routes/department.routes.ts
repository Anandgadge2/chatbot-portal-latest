import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import Department from '../models/Department';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { requireDatabaseConnection } from '../middleware/dbConnection';
import { buildNameSearchQuery, escapeRegExp } from '../utils/searchUtils';
import { logUserAction } from '../utils/auditLogger';
import Role from '../models/Role';
import User from '../models/User';
import { AuditAction, Permission, UserRole } from '../config/constants';

const router = express.Router();

// All routes require database connection and authentication
router.use(requireDatabaseConnection);
router.use(authenticate);

// @route   GET /api/departments
// @desc    Get all departments (scoped by user role)
// @access  Private
router.get('/', requirePermission(Permission.READ_DEPARTMENT), async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, search, companyId, listAll, type, status, mainDeptId, subDeptId } = req.query;
    const user = req.user!;
    const targetCompanyId = (user.role === UserRole.SUPER_ADMIN && companyId) ? companyId : user.companyId;

    const query: any = {};

    // 1. Core Scoping (Status, Type, Search, Hierarchical)
    if (status === 'active') query.isActive = true;
    else if (status === 'inactive') query.isActive = false;

    if (type === 'main') query.parentDepartmentId = null;
    else if (type === 'sub') query.parentDepartmentId = { $ne: null };

    if (subDeptId) {
      query._id = subDeptId;
    } else if (mainDeptId) {
      // Show the main department and all its children
      query.$or = [
        { _id: mainDeptId },
        { parentDepartmentId: mainDeptId }
      ];
    }

    // 🔍 SEARCH LOGIC
    if (search) {
      const escapedSearch = escapeRegExp(search as string);
      const searchCriteria: any[] = [
        { name: { $regex: escapedSearch, $options: 'i' } },
        { departmentId: { $regex: escapedSearch, $options: 'i' } },
        { contactEmail: { $regex: escapedSearch, $options: 'i' } },
        { contactPhone: { $regex: escapedSearch, $options: 'i' } },
        ...buildNameSearchQuery(search as string, 'contactPerson', 'contactPerson')
      ];

      // ✨ Logical Search: Any Matching User's Department
      // We look for users whose names match, and find their departments (primary or multiple)
      const matchingUsers = await User.find({
        companyId: targetCompanyId || { $exists: true },
        $or: buildNameSearchQuery(search as string, 'firstName', 'lastName')
      }).select('departmentId departmentIds');
      
      const deptIdsFromUsers = new Set<string>();
      matchingUsers.forEach(u => {
        if (u.departmentId) deptIdsFromUsers.add(u.departmentId.toString());
        if (u.departmentIds && Array.isArray(u.departmentIds)) {
          u.departmentIds.forEach(id => deptIdsFromUsers.add(id.toString()));
        }
      });
      
      const deptIdsArr = Array.from(deptIdsFromUsers);

      if (deptIdsArr.length > 0) {
        searchCriteria.push({ _id: { $in: deptIdsArr } });
      }
      
      if (query.$or) {
        // If we already have an $or (from mainDeptId), wrap both in an $and
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

    // 2. Role-based Scoping
    if (user.role === UserRole.SUPER_ADMIN) {
      if (companyId) query.companyId = companyId;
    } else {
      query.companyId = user.companyId;

      // Support multiple department scoping for Dept Admins
      const userDepts = [];
      if (user.departmentId) userDepts.push(user.departmentId.toString());
      if (user.departmentIds && Array.isArray(user.departmentIds)) {
        user.departmentIds.forEach(id => userDepts.push(id.toString()));
      }
      
      const uniqueUserDepts = [...new Set(userDepts)];

      if (uniqueUserDepts.length > 0) {
        const userLevel = user.level !== undefined ? user.level : 4;
        const wantsAllDepts = listAll === "true";
        if (userLevel > 1 && !wantsAllDepts) {
          if (userLevel === 2) {
            // Include these depts and all their children
            const subDeptIds = await Department.find({ 
              parentDepartmentId: { $in: uniqueUserDepts }
            }).distinct('_id');
            query._id = { $in: [...uniqueUserDepts, ...subDeptIds] };
          } else {
            // Strictly just these depts
            query._id = { $in: uniqueUserDepts };
          }
        }
      }
    }

    let departmentQuery = Department.find(query)
      .populate('companyId', 'name companyId')
      .populate('parentDepartmentId', 'name')
      .populate('contactUserId', 'firstName lastName email phone');

    if (listAll !== 'true') {
      departmentQuery = departmentQuery
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit));
    }

    const departments = await departmentQuery.sort({ createdAt: -1 });

    // Dynamically identify department heads/admins based on their permissions
    // We look for users who have management permissions for these departments
    const deptIds = departments.map(d => d._id);

    const adminRoles = await Role.find({
      $and: [
        {
          $or: [
            { companyId: targetCompanyId },
            { companyId: null },
            { isSystem: true }
          ]
        },
        {
          $or: [
            { 
              'permissions.module': 'DEPARTMENTS', 
              'permissions.actions': { $in: ['update', 'all', 'manage', 'assign'] } 
            },
            { level: { $lte: 3 } }, // Platform(0), Company(1), Dept(2), SubDept(3)
            { name: { $regex: /admin|head|manager|supervisor|administrator|coordinator/i } }
          ]
        }
      ]
    }).select('_id name');
    const adminRoleIds = adminRoles.map(r => r._id);
    const adminRoleNames = adminRoles.map(r => r.name);

    // 2. Find users with those roles in the relevant departments
    // We expand the entry to include common string variations for broader match
    const adminRoleStrings = [
      ...adminRoleNames, 
      'DEPARTMENT_ADMIN', 'SUB_DEPARTMENT_ADMIN', 
      'DEPARTMENT ADMIN', 'SUB DEPARTMENT ADMIN',
      'DEPARTMENT ADMINISTRATOR', 'SUB DEPARTMENT ADMINISTRATOR',
      'Department Administrator', 'Sub Department Administrator',
      'ADMINISTRATOR', 'Administrator', 'Company Administrator', 'COMPANY ADMINISTRATOR',
      'Company Admin', 'COMPANY ADMIN', 'MANAGER', 'Manager'
    ];

    const admins = await User.find({
      companyId: targetCompanyId || { $exists: true }, // Ensure company match
      $and: [
        {
          $or: [
            { departmentId: { $in: deptIds } },
            { departmentIds: { $in: deptIds } }
          ]
        },
        {
          $or: [
            { customRoleId: { $in: adminRoleIds } },
            { role: { $in: adminRoleStrings } }
          ]
        }
      ]
    }).select('firstName lastName email phone departmentId departmentIds');

    // Use direct department IDs only (including multiple assignments)
    const userCounts = await User.aggregate([
      { 
        $match: { 
          companyId: targetCompanyId ? new mongoose.Types.ObjectId(targetCompanyId.toString()) : { $exists: true }
        } 
      },
      {
        $project: {
          allDepts: {
            $setUnion: [
              { $cond: [{ $gt: ["$departmentId", null] }, ["$departmentId"], []] },
              { $cond: [{ $isArray: "$departmentIds" }, "$departmentIds", []] }
            ]
          }
        }
      },
      { $unwind: "$allDepts" },
      { $group: { _id: "$allDepts", count: { $sum: 1 } } }
    ]);

    const departmentsWithHead = departments.map(d => {
      const deptObj: any = (d as any).toObject();
      const admin = admins.find(a => 
        (a.departmentId && a.departmentId.toString() === d._id.toString()) ||
        (a.departmentIds && Array.isArray(a.departmentIds) && a.departmentIds.some(id => id.toString() === d._id.toString()))
      );
      
      // Only count direct users (per user request: "if no user then why showing the count")
      const countInfo = userCounts.find(c => c._id?.toString() === d._id.toString());
      deptObj.userCount = countInfo ? countInfo.count : 0;
      
      // If an admin is found, set head info
      if (admin) {
        const fullName = `${admin.firstName} ${admin.lastName}`;
        deptObj.head = fullName;
        deptObj.headName = fullName; // legacy
        deptObj.headEmail = admin.email;
        deptObj.headPhone = admin.phone;
        // Also update contactPerson/Email for broader compatibility
        deptObj.contactPerson = fullName;
        deptObj.contactEmail = admin.email;
        deptObj.contactPhone = admin.phone;
      } else if (d.contactUserId) {
        const contactUser: any = d.contactUserId;
        const fullName = contactUser.firstName ? `${contactUser.firstName} ${contactUser.lastName || ''}`.trim() : 'Unknown User';
        deptObj.head = fullName;
        deptObj.headName = fullName; // legacy
        deptObj.headEmail = contactUser.email;
        deptObj.headPhone = contactUser.phone;
        deptObj.contactPerson = fullName;
        deptObj.contactEmail = contactUser.email;
        deptObj.contactPhone = contactUser.phone;
      }
      
      return deptObj;
    }) as any[];

    const total = await Department.countDocuments(query);

    res.json({
      success: true,
      data: {
        departments: departmentsWithHead,
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
      message: 'Failed to fetch departments',
      error: error.message
    });
  }
});

// @route   POST /api/departments
// @desc    Create new department
// @access  Private (CompanyAdmin, SuperAdmin)
router.post('/', requirePermission(Permission.CREATE_DEPARTMENT), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { 
      companyId, 
      name, 
      nameHi, 
      nameOr, 
      nameMr, 
      description, 
      descriptionHi, 
      descriptionOr, 
      descriptionMr, 
      contactPerson, 
      contactEmail, 
      contactPhone,
      parentDepartmentId,
      contactUserId 
    } = req.body;

    // Validation
    if (!companyId || !name) {
      res.status(400).json({
        success: false,
        message: 'Company ID and name are required'
      });
      return;
    }

    // Validate and normalize contact phone if provided (telephone: landline or mobile)
    let normalizedContactPhone = contactPhone;
    if (contactPhone) {
      const { validateTelephone, normalizeTelephone } = await import('../utils/phoneUtils');
      if (!validateTelephone(contactPhone)) {
        return res.status(400).json({
          success: false,
          message: 'Contact phone must be 6–15 digits (e.g. 0721-2662926 or 9356150561)'
        });
      }
      normalizedContactPhone = normalizeTelephone(contactPhone);
    }

    // Non-SuperAdmin users can only create departments for their own company
    if (user.role !== UserRole.SUPER_ADMIN && companyId !== user.companyId?.toString()) {
      res.status(403).json({
        success: false,
        message: 'You can only create departments for your own company'
      });
      return;
    }

    const department = await Department.create({
      companyId,
      name,
      nameHi: nameHi || undefined,
      nameOr: nameOr || undefined,
      nameMr: nameMr || undefined,
      description,
      descriptionHi: descriptionHi || undefined,
      descriptionOr: descriptionOr || undefined,
      descriptionMr: descriptionMr || undefined,
      contactPerson,
      contactEmail,
      contactPhone: normalizedContactPhone,
      parentDepartmentId: parentDepartmentId || null,
      contactUserId: contactUserId || null
    });

    await logUserAction(
      req,
      AuditAction.CREATE,
      'Department',
      department._id.toString(),
      { departmentName: department.name }
    );

    res.status(201).json({
      success: true,
      message: 'Department created successfully',
      data: { department }
    });
  } catch (error: any) {
    console.error('Create department error:', error);
    
    // Handle duplicate key errors (e.g. name unique within company)
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || 'field';
      return res.status(400).json({
        success: false,
        message: `Department with this ${field} already exists in this company`,
        error: error.message
      });
    }

    // Handle validation or casting errors
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid data provided',
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create department',
      error: error.message
    });
  }
});

// @route   GET /api/departments/:id
// @desc    Get department by ID
// @access  Private
router.get('/:id', requirePermission(Permission.READ_DEPARTMENT), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const department = await Department.findById(req.params.id)
      .populate('companyId', 'name companyId')
      .populate('contactUserId', 'firstName lastName email phone');

    if (!department) {
      res.status(404).json({
        success: false,
        message: 'Department not found'
      });
      return;
    }

    // Check access
    if (user.role !== UserRole.SUPER_ADMIN && department.companyId._id.toString() !== user.companyId?.toString()) {
      res.status(403).json({
        success: false,
        message: 'Access denied'
      });
      return;
    }

    // Dynamically identify department head based on permissions
    const Role = (await import('../models/Role')).default;
    const adminRoles = await Role.find({
      $and: [
        {
          $or: [
            { companyId: department.companyId._id },
            { companyId: null },
            { isSystem: true }
          ]
        },
        {
          $or: [
            { 
              'permissions.module': 'DEPARTMENTS', 
              'permissions.actions': { $in: ['update', 'all', 'manage', 'assign'] } 
            },
            { level: { $lte: 3 } },
            { name: { $regex: /admin|head|manager|supervisor|administrator|coordinator/i } }
          ]
        }
      ]
    }).select('_id name');
    const adminRoleIds = adminRoles.map(r => r._id);
    const adminRoleNames = adminRoles.map(r => r.name);

    const adminRoleStrings = [
      ...adminRoleNames, 
      'DEPARTMENT_ADMIN', 'SUB_DEPARTMENT_ADMIN', 
      'DEPARTMENT ADMIN', 'SUB DEPARTMENT ADMIN',
      'DEPARTMENT ADMINISTRATOR', 'SUB DEPARTMENT ADMINISTRATOR',
      'Department Administrator', 'Sub Department Administrator',
      'ADMINISTRATOR', 'Administrator', 'Company Administrator', 'COMPANY ADMINISTRATOR',
      'Company Admin', 'COMPANY ADMIN', 'MANAGER', 'Manager'
    ];

    const User = (await import('../models/User')).default;
    const admin = await User.findOne({
      companyId: department.companyId._id,
      $and: [
        {
          $or: [
            { departmentId: department._id },
            { departmentIds: department._id }
          ]
        },
        {
          $or: [
            { customRoleId: { $in: adminRoleIds } },
            { role: { $in: adminRoleStrings } }
          ]
        }
      ]
    }).select('firstName lastName email phone');

    const deptObj: any = department.toObject();
    if (admin) {
      const fullName = `${admin.firstName} ${admin.lastName}`;
      deptObj.head = fullName;
      deptObj.headName = fullName; // legacy
      deptObj.headEmail = admin.email;
      deptObj.headPhone = admin.phone;
      // Also update contactPerson/Email for broader compatibility
      deptObj.contactPerson = fullName;
      deptObj.contactEmail = admin.email;
      deptObj.contactPhone = admin.phone;
    } else if (department.contactUserId) {
      const contactUser: any = department.contactUserId;
      const fullName = contactUser.firstName ? `${contactUser.firstName} ${contactUser.lastName || ''}`.trim() : 'Unknown User';
      deptObj.head = fullName;
      deptObj.headName = fullName; // legacy
      deptObj.headEmail = contactUser.email;
      deptObj.headPhone = contactUser.phone;
      deptObj.contactPerson = fullName;
      deptObj.contactEmail = contactUser.email;
      deptObj.contactPhone = contactUser.phone;
    }

    res.json({
      success: true,
      data: { department: deptObj }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch department',
      error: error.message
    });
  }
});

// @route   PUT /api/departments/:id
// @desc    Update department
// @access  Private
router.put('/:id', requirePermission(Permission.UPDATE_DEPARTMENT), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const existingDepartment = await Department.findById(req.params.id);

    if (!existingDepartment) {
      res.status(404).json({
        success: false,
        message: 'Department not found'
      });
      return;
    }

    // Check access
    if (user.role !== UserRole.SUPER_ADMIN && existingDepartment.companyId.toString() !== user.companyId?.toString()) {
      res.status(403).json({
        success: false,
        message: 'Access denied'
      });
      return;
    }

    // Normalize phone number if provided in update
    const updateData: any = { ...req.body };

    // 🛡️ SANITIZATION: Handle empty strings for ObjectId fields to prevent CastErrors
    if (updateData.contactUserId === "") {
      updateData.contactUserId = null;
    }
    if (updateData.parentDepartmentId === "") {
      updateData.parentDepartmentId = null;
    }
    if (updateData.companyId === "") {
      delete updateData.companyId; // Don't allow clearing companyId
    }
    
    if (updateData.contactPhone) {
      const { validateTelephone, normalizeTelephone } = await import('../utils/phoneUtils');
      if (!validateTelephone(updateData.contactPhone)) {
        return res.status(400).json({
          success: false,
          message: 'Contact phone must be 6–15 digits (e.g. 0721-2662926 or 9356150561)'
        });
      }
      updateData.contactPhone = normalizeTelephone(updateData.contactPhone);
    }

    const department = await Department.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    await logUserAction(
      req,
      AuditAction.UPDATE,
      'Department',
      department._id.toString(),
      { updates: req.body }
    );

    res.json({
      success: true,
      message: 'Department updated successfully',
      data: { department }
    });
  } catch (error: any) {
    console.error('Update department error:', error);
    
    // Handle duplicate key errors (e.g. name unique within company)
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || 'field';
      return res.status(400).json({
        success: false,
        message: `Department with this ${field} already exists in this company`,
        error: error.message
      });
    }

    // Handle validation or casting errors
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid data provided',
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update department',
      error: error.message
    });
  }
});

// @route   DELETE /api/departments/:id
// @desc    Soft delete department
// @access  Private
router.delete('/:id', requirePermission(Permission.DELETE_DEPARTMENT), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const existingDepartment = await Department.findById(req.params.id);

    if (!existingDepartment) {
      res.status(404).json({
        success: false,
        message: 'Department not found'
      });
      return;
    }

    // Check access
    if (user.role !== UserRole.SUPER_ADMIN && existingDepartment.companyId.toString() !== user.companyId?.toString()) {
      res.status(403).json({
        success: false,
        message: 'Access denied'
      });
      return;
    }

    const department = await Department.findByIdAndDelete(req.params.id);

    await logUserAction(
      req,
      AuditAction.DELETE,
      'Department',
      department!._id.toString()
    );

    res.json({
      success: true,
      message: 'Department deleted successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete department',
      error: error.message
    });
  }
});

export default router;
