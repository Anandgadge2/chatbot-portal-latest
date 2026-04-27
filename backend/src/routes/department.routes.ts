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

const normalizeDisplayOrder = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return NaN;
  }

  return Math.floor(parsed);
};

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
    const targetCompanyId = (user.isSuperAdmin && companyId) ? companyId : user.companyId;

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
      const matchingUsers = await User.find({
        companyId: targetCompanyId || { $exists: true },
        $or: [
          ...buildNameSearchQuery(search as string, 'firstName', 'lastName'),
          { email: { $regex: escapedSearch, $options: 'i' } },
          { phone: { $regex: escapedSearch, $options: 'i' } }
        ]
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

      const userIdsArr = matchingUsers.map(u => u._id);
      if (userIdsArr.length > 0) {
        searchCriteria.push({ contactUserId: { $in: userIdsArr } });
      }
      
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

    // 2. Role-based Scoping
    if (user.isSuperAdmin) {
      if (companyId) query.companyId = companyId;
    } else {
      query.companyId = user.companyId;

      const userDepts = [];
      if (user.departmentId) userDepts.push(user.departmentId.toString());
      if (user.departmentIds && Array.isArray(user.departmentIds)) {
        user.departmentIds.forEach(id => userDepts.push(id.toString()));
      }
      const uniqueUserDepts = [...new Set(userDepts)];
      const wantsAllDepts = listAll === "true";

      if (user.scope === 'department' && !wantsAllDepts) {
        if (uniqueUserDepts.length > 0) {
          const subDeptIds = await Department.find({ 
            parentDepartmentId: { $in: uniqueUserDepts }
          }).distinct('_id');
          query._id = { $in: [...uniqueUserDepts, ...subDeptIds] };
        }
      } else if (user.scope === 'subdepartment' && !wantsAllDepts) {
        if (uniqueUserDepts.length > 0) {
          query._id = { $in: uniqueUserDepts };
        }
      } else if (user.scope === 'assigned' && !wantsAllDepts) {
        if (uniqueUserDepts.length > 0) {
          query._id = { $in: uniqueUserDepts };
        }
      }
    }

    // 3. Sorting
    const sortField = (req.query.sortBy as string) || 'displayOrder';
    const sortOrder = (req.query.sortOrder as string) === 'desc' ? -1 : 1;
    
    let sortObj: any = {};
    if (sortField === 'name') {
      sortObj = { name: sortOrder };
    } else if (sortField === 'status') {
      sortObj = { isActive: sortOrder };
    } else if (sortField === 'createdAt') {
      sortObj = { createdAt: sortOrder };
    } else {
      sortObj = { displayOrder: 1, createdAt: -1 };
    }

    // Parallelize core fetching
    const [departments, total] = await Promise.all([
      Department.find(query)
        .populate('companyId', 'name companyId')
        .populate('parentDepartmentId', 'name')
        .populate('contactUserId', 'firstName lastName email phone')
        .sort(sortObj)
        .limit(listAll === 'true' ? 1000 : Number(limit))
        .skip(listAll === 'true' ? 0 : (Number(page) - 1) * Number(limit)),
      Department.countDocuments(query)
    ]);

    const deptIds = departments.map(d => d._id);

    // Parallelize administrative data fetching
    const [adminRoles, userCounts, admins] = await Promise.all([
      // 1. Fetch relevant admin roles
      Role.find({
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
              { level: { $lte: 3 } },
              { name: { $regex: /admin|head|manager|supervisor|administrator|coordinator/i } }
            ]
          }
        ]
      }).select('_id name'),

      // 2. Optimized User Counts: Only for visible departments
      User.aggregate([
        { 
          $match: { 
            $or: [
              { departmentId: { $in: deptIds } },
              { departmentIds: { $in: deptIds } }
            ]
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
        { $match: { allDepts: { $in: deptIds } } },
        { $group: { _id: "$allDepts", count: { $sum: 1 } } }
      ]),

      // 3. Fetch admins only for these departments
      User.find({
        $and: [
          {
            $or: [
              { departmentId: { $in: deptIds } },
              { departmentIds: { $in: deptIds } }
            ]
          },
          {
            $or: [
              { customRoleId: { $exists: true } },
              { role: { $exists: true } }
            ]
          }
        ]
      }).select('firstName lastName email phone departmentId departmentIds customRoleId role')
    ]);

    const adminRoleIds = adminRoles.map(r => r._id.toString());
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

    const filteredAdmins = admins.filter(a => 
      (a.customRoleId && adminRoleIds.includes(a.customRoleId.toString())) ||
      (a.role && adminRoleStrings.includes(a.role))
    );

    const departmentsWithHead = departments.map(d => {
      const deptObj: any = (d as any).toObject();
      const admin = filteredAdmins.find(a => 
        (a.departmentId && a.departmentId.toString() === d._id.toString()) ||
        (a.departmentIds && Array.isArray(a.departmentIds) && a.departmentIds.some(id => id.toString() === d._id.toString()))
      );
      
      const countInfo = userCounts.find(c => c._id?.toString() === d._id.toString());
      deptObj.userCount = countInfo ? countInfo.count : 0;
      
      if (admin) {
        const fullName = `${admin.firstName} ${admin.lastName}`;
        deptObj.head = fullName;
        deptObj.headName = fullName;
        deptObj.headEmail = admin.email;
        deptObj.headPhone = admin.phone;
        deptObj.contactPerson = fullName;
        deptObj.contactEmail = admin.email;
        deptObj.contactPhone = admin.phone;
      } else if (d.contactUserId) {
        const contactUser: any = d.contactUserId;
        const fullName = contactUser.firstName ? `${contactUser.firstName} ${contactUser.lastName || ''}`.trim() : 'Unknown User';
        deptObj.head = fullName;
        deptObj.headName = fullName;
        deptObj.headEmail = contactUser.email;
        deptObj.headPhone = contactUser.phone;
        deptObj.contactPerson = fullName;
        deptObj.contactEmail = contactUser.email;
        deptObj.contactPhone = contactUser.phone;
      }
      
      return deptObj;
    });

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
      contactUserId,
      displayOrder
    } = req.body;

    // Validation
    if (!companyId || !name) {
      res.status(400).json({
        success: false,
        message: 'Company ID and name are required'
      });
      return;
    }

    const isSubDepartmentRequest = !!parentDepartmentId;
    const normalizedDisplayOrder = isSubDepartmentRequest
      ? undefined
      : normalizeDisplayOrder(displayOrder);
    if (Number.isNaN(normalizedDisplayOrder)) {
      return res.status(400).json({
        success: false,
        message: 'displayOrder must be a non-negative number'
      });
    }

    // Validate and normalize contact phone if provided
    let normalizedContactPhone = contactPhone;
    if (contactPhone) {
      const { validateTelephone, normalizeTelephone } = await import('../utils/phoneUtils');
      if (!validateTelephone(contactPhone)) {
        return res.status(400).json({
          success: false,
          message: 'Contact phone must be 6–15 digits'
        });
      }
      normalizedContactPhone = normalizeTelephone(contactPhone);
    }

    // 🛡️ ROLE-BASED ACCESS CONTROL
    const userLevel = user.level !== undefined ? user.level : 4;
    
    if (userLevel >= 3) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to create departments'
      });
    }

    if (userLevel === 2 && !parentDepartmentId) {
      return res.status(403).json({
        success: false,
        message: 'Department Administrators can only create sub-departments'
      });
    }

    if (!user.isSuperAdmin && companyId !== user.companyId?.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only create departments for your own company'
      });
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
      contactUserId: contactUserId || null,
      ...(normalizedDisplayOrder !== undefined ? { displayOrder: normalizedDisplayOrder } : {})
    });

    await logUserAction(
      req,
      AuditAction.CREATE,
      'Department',
      department._id.toString(),
      { departmentName: department.name }
    );

    if (contactUserId) {
       const UserModel = (await import('../models/User')).default;
       const userDoc = await UserModel.findById(contactUserId);
       if (userDoc) {
          const deptId = department._id;
          let updated = false;
          
          if (!userDoc.departmentId) {
             userDoc.departmentId = deptId;
             updated = true;
          }
          if (!userDoc.departmentIds) userDoc.departmentIds = [];
          if (!userDoc.departmentIds.some(id => id.toString() === deptId.toString())) {
             userDoc.departmentIds.push(deptId);
             updated = true;
          }
          
          if (updated) {
             await userDoc.save();
          }
       }
    }

    res.status(201).json({
      success: true,
      message: 'Department created successfully',
      data: { department }
    });
  } catch (error: any) {
    console.error('Create department error:', error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || 'field';
      return res.status(400).json({
        success: false,
        message: `Department with this ${field} already exists in this company`
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
router.get('/:id', requirePermission(Permission.READ_DEPARTMENT), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const department = await Department.findById(req.params.id)
      .populate('companyId', 'name companyId')
      .populate('contactUserId', 'firstName lastName email phone');

    if (!department) {
      res.status(404).json({ success: false, message: 'Department not found' });
      return;
    }

    if (!user.isSuperAdmin && department.companyId._id.toString() !== user.companyId?.toString()) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const RoleModel = (await import('../models/Role')).default;
    const adminRoles = await RoleModel.find({
      $and: [
        { $or: [{ companyId: department.companyId._id }, { companyId: null }, { isSystem: true }] },
        { $or: [{ 'permissions.module': 'DEPARTMENTS', 'permissions.actions': { $in: ['update', 'all', 'manage', 'assign'] } }, { level: { $lte: 3 } }, { name: { $regex: /admin|head|manager|supervisor|administrator|coordinator/i } }] }
      ]
    }).select('_id name');
    const adminRoleIds = adminRoles.map(r => r._id);
    const adminRoleNames = adminRoles.map(r => r.name);

    const adminRoleStrings = [
      ...adminRoleNames, 
      'DEPARTMENT_ADMIN', 'SUB_DEPARTMENT_ADMIN', 'DEPARTMENT ADMIN', 'SUB DEPARTMENT ADMIN',
      'DEPARTMENT ADMINISTRATOR', 'SUB DEPARTMENT ADMINISTRATOR', 'Department Administrator', 'Sub Department Administrator',
      'ADMINISTRATOR', 'Administrator', 'Company Administrator', 'COMPANY ADMINISTRATOR',
      'Company Admin', 'COMPANY ADMIN', 'MANAGER', 'Manager'
    ];

    const UserModel = (await import('../models/User')).default;
    const admin = await UserModel.findOne({
      companyId: department.companyId._id,
      $and: [
        { $or: [{ departmentId: department._id }, { departmentIds: department._id }] },
        { $or: [{ customRoleId: { $in: adminRoleIds } }, { role: { $in: adminRoleStrings } }] }
      ]
    }).select('firstName lastName email phone');

    const deptObj: any = department.toObject();
    if (admin) {
      const fullName = `${admin.firstName} ${admin.lastName}`;
      deptObj.head = fullName;
      deptObj.headEmail = admin.email;
      deptObj.headPhone = admin.phone;
      deptObj.contactPerson = fullName;
      deptObj.contactEmail = admin.email;
      deptObj.contactPhone = admin.phone;
    }

    res.json({ success: true, data: { department: deptObj } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch department', error: error.message });
  }
});

// @route   PUT /api/departments/:id
router.put('/:id', requirePermission(Permission.UPDATE_DEPARTMENT), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const existingDepartment = await Department.findById(req.params.id);

    if (!existingDepartment) {
      res.status(404).json({ success: false, message: 'Department not found' });
      return;
    }

    const userLevel = user.level !== undefined ? user.level : 4;
    
    if (!user.isSuperAdmin && existingDepartment.companyId.toString() !== user.companyId?.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (userLevel > 1) {
      const userDepts = [
        ...(user.departmentId ? [user.departmentId.toString()] : []),
        ...(user.departmentIds?.map(id => id.toString()) || [])
      ];

      if (userLevel === 2) {
        const isSelf = userDepts.includes(existingDepartment._id.toString());
        const isChild = userDepts.includes(existingDepartment.parentDepartmentId?.toString() || "");
        if (!isSelf && !isChild) {
          return res.status(403).json({ success: false, message: 'Permission denied' });
        }
      } else if (userLevel === 3) {
        if (!userDepts.includes(existingDepartment._id.toString())) {
          return res.status(403).json({ success: false, message: 'Permission denied' });
        }
      } else {
        return res.status(403).json({ success: false, message: 'Permission denied' });
      }
    }

    const updateData = { ...req.body };
    if (updateData.contactUserId === "") updateData.contactUserId = null;
    if (updateData.parentDepartmentId === "") updateData.parentDepartmentId = null;

    if (Object.prototype.hasOwnProperty.call(updateData, 'displayOrder')) {
      updateData.displayOrder = normalizeDisplayOrder(updateData.displayOrder);
    }

    const department = await Department.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });

    await logUserAction(req, AuditAction.UPDATE, 'Department', department!._id.toString(), { updates: req.body });

    res.json({ success: true, message: 'Department updated successfully', data: { department } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update department', error: error.message });
  }
});

// @route   DELETE /api/departments/:id
router.delete('/:id', requirePermission(Permission.DELETE_DEPARTMENT), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const existingDepartment = await Department.findById(req.params.id);

    if (!existingDepartment) {
      res.status(404).json({ success: false, message: 'Department not found' });
      return;
    }

    if (!user.isSuperAdmin && existingDepartment.companyId.toString() !== user.companyId?.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const department = await Department.findByIdAndDelete(req.params.id);
    await logUserAction(req, AuditAction.DELETE, 'Department', department!._id.toString());

    res.json({ success: true, message: 'Department deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to delete department', error: error.message });
  }
});

export default router;
