import express, { Request, Response } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { requireDatabaseConnection } from '../middleware/dbConnection';
import { logUserAction } from '../utils/auditLogger';
import { AuditAction, Permission, UserRole } from '../config/constants';
import Company from '../models/Company';
import Department from '../models/Department';
import User from '../models/User';
import Role from '../models/Role';
import bcrypt from 'bcryptjs';

const router = express.Router();
const normalizeRoleName = (value: string): string => value.trim().toLowerCase().replace(/[_\s-]+/g, ' ');

const getImportedRoleLevel = (rawRole: string, hasSubDepartment = false): number => {
  const normalized = normalizeRoleName(String(rawRole || ''));
  if (normalized.includes('sub') && normalized.includes('admin')) return 3;
  if (normalized.includes('dept') && normalized.includes('admin')) return 2;
  if (normalized.includes('department admin')) return 2;
  if (normalized.includes('operator')) return 4;
  if (normalized.includes('admin')) return hasSubDepartment ? 3 : 2;
  return 4;
};

const getCellValue = (row: Record<string, any>, keys: string[]): string => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
};

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel (.xlsx, .xls) and CSV files are allowed.'));
    }
  }
});

// All routes require database connection and authentication
router.use(requireDatabaseConnection);
router.use(authenticate);

// @route   POST /api/import/companies
// @desc    Import companies from Excel (SuperAdmin only)
// @access  Private/SuperAdmin
router.post(
  '/drilldown-hierarchy',
  requirePermission(Permission.IMPORT_DATA),
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const currentUser = req.user!;

      if (currentUser.isSuperAdmin && !req.body.companyId) {
        res.status(400).json({
          success: false,
          message: 'companyId is required for SuperAdmin imports'
        });
        return;
      }

      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
        return;
      }

      const companyId = currentUser.isSuperAdmin
        ? req.body.companyId
        : currentUser.companyId?.toString();

      if (!companyId) {
        res.status(400).json({
          success: false,
          message: 'Unable to resolve company for import'
        });
        return;
      }

      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      // 🚀 Optimization: Pre-fetch all departments and users to avoid redundant database calls in the loop
      const [allDepartments, allUsers, companyRoles] = await Promise.all([
        Department.find({ companyId }),
        User.find({ companyId }).select('+password'),
        Role.find({ companyId }).select('_id level')
      ]);

      const roleIdByLevel = new Map(companyRoles.map(role => [role.level, role._id]));

      const deptCache = new Map<string, any>();
      allDepartments.forEach(d => {
        const key = d.parentDepartmentId 
          ? `sub:${d.parentDepartmentId}:${d.name.toLowerCase()}` 
          : `main:${d.name.toLowerCase()}`;
        deptCache.set(key, d);
      });

      // 🚀 Optimization: Pre-hash default password to avoid expensive bcrypt calls in the loop
      const defaultPasswordHash = await bcrypt.hash('111111', 10);

      const userCache = new Map<string, any>();
      allUsers.forEach(u => {
        if (u.email) userCache.set(`email:${u.email.toLowerCase()}`, u);
        if (u.phone) userCache.set(`phone:${u.phone}`, u);
      });


      const results = {
        total: data.length,
        success: 0,
        failed: 0,
        errors: [] as Array<{ row: number; error: string }>
      };

      const splitOfficerName = (fullName: string) => {
        const normalized = String(fullName || '').trim().replace(/\s+/g, ' ');
        if (!normalized) return { firstName: '', lastName: '-' };
        const parts = normalized.split(' ');
        if (parts.length === 1) return { firstName: parts[0], lastName: '-' };
        return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
      };

      const newUsersToCreate: any[] = [];
      const userUpdateOps: any[] = [];

      // Step 1: Process Departments sequentially (cached) to resolve hierarchy
      // and prepare User data for bulk processing
      for (let i = 0; i < data.length; i++) {
        const row = data[i] as Record<string, any>;

        try {
          const mainDepartmentName = getCellValue(row, [
            'Department Name', 'Main Department', 'mainDepartment', 'Department'
          ]);
          const subDepartmentName = getCellValue(row, [
            'Sub- Department Name', 'Sub Department Name', 'Sub Department', 'subDepartment'
          ]);
          const departmentDescription = getCellValue(row, [
            'Department Description', 'description'
          ]);
          const officerName = getCellValue(row, ['Officer Name']);
          const designation = getCellValue(row, ['Designation']);
          const email = getCellValue(row, ['Email ID', 'Email', 'email']);
          const phone = getCellValue(row, ['Whatsapp Number', 'WhatsApp Number', 'Admin WhatsApp', 'Phone']);
          const rowRole = getCellValue(row, ['Role ( Department Admin / Sub-Department Admin)', 'Role', 'User Role']);

          if (!mainDepartmentName) throw new Error('Department Name is required');
          if (!officerName) throw new Error('Officer Name is required');
          if (!email && !phone) throw new Error('Either Email ID or Whatsapp Number is required');

          // Process Main Department
          const mainKey = `main:${mainDepartmentName.toLowerCase()}`;
          let mainDepartment = deptCache.get(mainKey);

          if (!mainDepartment) {
            mainDepartment = await Department.create({
              companyId,
              name: mainDepartmentName,
              description: departmentDescription || undefined,
              isActive: true
            });
            deptCache.set(mainKey, mainDepartment);
          } else {
            let changed = false;
            if (departmentDescription && !mainDepartment.description) {
              mainDepartment.description = departmentDescription;
              changed = true;
            }
            if (!subDepartmentName) {
              mainDepartment.contactPerson = officerName;
              mainDepartment.contactEmail = email || mainDepartment.contactEmail;
              mainDepartment.contactPhone = phone || mainDepartment.contactPhone;
              changed = true;
            }
            if (changed) {
              await mainDepartment.save();
              deptCache.set(mainKey, mainDepartment);
            }
          }

          let targetDepartment = mainDepartment;

          // Process Sub Department
          if (subDepartmentName) {
            const subKey = `sub:${mainDepartment._id}:${subDepartmentName.toLowerCase()}`;
            let subDepartment = deptCache.get(subKey);

            if (!subDepartment) {
              subDepartment = await Department.create({
                companyId,
                parentDepartmentId: mainDepartment._id,
                name: subDepartmentName,
                description: departmentDescription || undefined,
                contactPerson: officerName,
                contactEmail: email || undefined,
                contactPhone: phone || undefined,
                isActive: true
              });
              deptCache.set(subKey, subDepartment);
            } else {
              let changed = false;
              if (departmentDescription && !subDepartment.description) {
                subDepartment.description = departmentDescription;
                changed = true;
              }
              subDepartment.contactPerson = officerName;
              subDepartment.contactEmail = email || subDepartment.contactEmail;
              subDepartment.contactPhone = phone || subDepartment.contactPhone;
              changed = true;
              
              if (changed) {
                await subDepartment.save();
                deptCache.set(subKey, subDepartment);
              }
            }
            targetDepartment = subDepartment;
          }

          // Prepare User Data
          const { firstName, lastName } = splitOfficerName(officerName);
          const roleLevel = getImportedRoleLevel(rowRole, Boolean(subDepartmentName));
          const customRoleId = roleIdByLevel.get(roleLevel);
          if (!customRoleId) throw new Error(`No role configured at level ${roleLevel} for this company`);

          let existingUser = null;
          if (email) existingUser = userCache.get(`email:${email.toLowerCase()}`);
          if (!existingUser && phone) existingUser = userCache.get(`phone:${phone}`);

          if (!existingUser) {
            newUsersToCreate.push({
              firstName,
              lastName,
              email: email ? email.toLowerCase() : undefined,
              phone,
              designation: designation || undefined,
              customRoleId,
              companyId,
              departmentId: targetDepartment._id,
              isSuperAdmin: false
            });
          } else {
            const changes: any = {};
            if (firstName && existingUser.firstName !== firstName) changes.firstName = firstName;
            if (lastName && existingUser.lastName !== lastName) changes.lastName = lastName;
            if (phone && existingUser.phone !== phone) changes.phone = phone;
            if (designation && existingUser.designation !== designation) changes.designation = designation;
            if (String(existingUser.customRoleId) !== String(customRoleId)) changes.customRoleId = customRoleId;
            if (String(existingUser.departmentId) !== String(targetDepartment._id)) changes.departmentId = targetDepartment._id;
            changes.isSuperAdmin = false;
            
            if (Object.keys(changes).length > 0) {
              changes.updatedAt = new Date();
              userUpdateOps.push({
                updateOne: {
                  filter: { _id: existingUser._id },
                  update: { $set: changes }
                }
              });
            } else {
              results.success++; // No changes needed, still counts as success
            }
          }
        } catch (error: any) {
          results.failed++;
          results.errors.push({ row: i + 2, error: error.message });
        }
      }

      // Step 2: Bulk Create Users
      if (newUsersToCreate.length > 0) {
        try {
          const { getNextUserIdBatch } = await import('../utils/idGenerator');
          let currentIdNum = await getNextUserIdBatch(newUsersToCreate.length, companyId as any);
          
          const now = new Date();
          const userDocs = newUsersToCreate.map(u => ({
            ...u,
            userId: `USER${String(currentIdNum++).padStart(6, '0')}`,
            password: defaultPasswordHash,
            isActive: true,
            createdAt: now,
            updatedAt: now
          }));

          await User.insertMany(userDocs, { ordered: false });
          results.success += userDocs.length;
        } catch (error: any) {
          results.failed += newUsersToCreate.length;
          results.errors.push({ row: 0, error: `Bulk create failed: ${error.message}` });
        }
      }

      // Step 3: Bulk Update Users
      if (userUpdateOps.length > 0) {
        try {
          await User.bulkWrite(userUpdateOps, { ordered: false });
          results.success += userUpdateOps.length;
        } catch (error: any) {
          results.failed += userUpdateOps.length;
          results.errors.push({ row: 0, error: `Bulk update failed: ${error.message}` });
        }
      }

      await logUserAction(
        req,
        AuditAction.IMPORT,
        'DrilldownHierarchy',
        'bulk',
        { total: results.total, success: results.success, failed: results.failed, companyId }
      );

      res.json({
        success: true,
        message: `Import completed: ${results.success} succeeded, ${results.failed} failed`,
        data: results
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to import hierarchy data',
        error: error.message
      });
    }
  }
);

router.post(
  '/companies',
  requirePermission(Permission.IMPORT_DATA),
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const currentUser = req.user!;

      if (!currentUser.isSuperAdmin) {
        res.status(403).json({
          success: false,
          message: 'Only SuperAdmin can import companies'
        });
        return;
      }

      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
        return;
      }

      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);


      const results = {
        total: data.length,
        success: 0,
        failed: 0,
        errors: [] as Array<{ row: number; error: string }>
      };

      for (let i = 0; i < data.length; i++) {
        const row = data[i] as any;
        try {
          await Company.create({
            name: row.name || row.companyName,
            companyType: row.companyType,
            contactEmail: row.contactEmail || row.email,
            contactPhone: row.contactPhone || row.phone,
            address: row.address,
            enabledModules: row.enabledModules ? row.enabledModules.split(',') : [],
            theme: {
              primaryColor: row.primaryColor || '#0f4c81',
              secondaryColor: row.secondaryColor || '#1a73e8'
            },
            isActive: row.isActive !== false,
            isSuspended: row.isSuspended === true
          });

          results.success++;
        } catch (error: any) {
          results.failed++;
          results.errors.push({
            row: i + 2, // +2 because Excel rows start at 1 and we have header
            error: error.message
          });
        }
      }

      await logUserAction(
        req,
        AuditAction.IMPORT,
        'Company',
        'bulk',
        { total: results.total, success: results.success, failed: results.failed }
      );

      res.json({
        success: true,
        message: `Import completed: ${results.success} succeeded, ${results.failed} failed`,
        data: results
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to import companies',
        error: error.message
      });
    }
  }
);

// @route   POST /api/import/departments
// @desc    Import departments from Excel
// @access  Private
router.post(
  '/departments',
  requirePermission(Permission.IMPORT_DATA),
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const currentUser = req.user!;

      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
        return;
      }

      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      // 🚀 Optimization: Pre-fetch all departments for this company
      const companyId = currentUser.isSuperAdmin ? null : currentUser.companyId?.toString();
      const existingDepts = await Department.find(companyId ? { companyId } : {});
      const deptCache = new Map<string, any>();
      existingDepts.forEach(d => {
        deptCache.set(`${d.companyId}:${d.name.toLowerCase()}`, d);
      });


      const results = {
        total: data.length,
        success: 0,
        failed: 0,
        errors: [] as Array<{ row: number; error: string }>
      };

      const deptOps: any[] = [];
      const newDepts: any[] = [];
      
      for (let i = 0; i < data.length; i++) {
        const row = data[i] as any;
        try {
          let targetCompanyId = row.companyId;

          if (!currentUser.isSuperAdmin) {
            targetCompanyId = currentUser.companyId?.toString();
          }

          if (!targetCompanyId) throw new Error('Company ID is required');

          const deptName = row.name || row.departmentName || '';
          const deptKey = `${targetCompanyId}:${deptName.toLowerCase()}`;
          const existingDept = deptCache.get(deptKey);

          if (existingDept) {
            const changes: any = {};
            if (row.description) changes.description = row.description;
            if (row.contactPerson) changes.contactPerson = row.contactPerson;
            if (row.contactEmail) changes.contactEmail = row.contactEmail;
            if (row.contactPhone) changes.contactPhone = row.contactPhone;
            
            if (Object.keys(changes).length > 0) {
              changes.updatedAt = new Date();
              deptOps.push({
                updateOne: {
                  filter: { _id: existingDept._id },
                  update: { $set: changes }
                }
              });
            } else {
              results.success++;
            }
          } else {
            newDepts.push({
              companyId: targetCompanyId,
              name: deptName,
              description: row.description,
              contactPerson: row.contactPerson,
              contactEmail: row.contactEmail,
              contactPhone: row.contactPhone,
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date()
            });
          }
        } catch (error: any) {
          results.failed++;
          results.errors.push({ row: i + 2, error: error.message });
        }
      }

      if (newDepts.length > 0) {
        await Department.insertMany(newDepts, { ordered: false });
        results.success += newDepts.length;
      }
      if (deptOps.length > 0) {
        await Department.bulkWrite(deptOps, { ordered: false });
        results.success += deptOps.length;
      }

      await logUserAction(
        req,
        AuditAction.IMPORT,
        'Department',
        'bulk',
        { total: results.total, success: results.success, failed: results.failed }
      );

      res.json({
        success: true,
        message: `Import completed: ${results.success} succeeded, ${results.failed} failed`,
        data: results
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to import departments',
        error: error.message
      });
    }
  }
);

// @route   POST /api/import/users
// @desc    Import users from Excel
// @access  Private
router.post(
  '/users',
  requirePermission(Permission.IMPORT_DATA),
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const currentUser = req.user!;

      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
        return;
      }

      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      // 🚀 Optimization: Pre-fetch all users and departments for faster lookups
      const searchCompanyId = currentUser.isSuperAdmin ? null : currentUser.companyId?.toString();
      const [existingUsers, allDepts, existingRoles] = await Promise.all([
        User.find(searchCompanyId ? { companyId: searchCompanyId } : {}),
        Department.find(searchCompanyId ? { companyId: searchCompanyId } : {}),
        Role.find(searchCompanyId ? { companyId: searchCompanyId } : {}).select('_id companyId name level')
      ]);

      const userCache = new Map<string, any>();
      existingUsers.forEach(u => {
        if (u.email) userCache.set(`${u.companyId}:email:${u.email.toLowerCase()}`, u);
        if (u.phone) userCache.set(`${u.companyId}:phone:${u.phone}`, u);
      });

      const deptCache = new Map<string, any>();
      allDepts.forEach(d => {
        deptCache.set(`${d.companyId}:${d.name.toLowerCase()}`, d);
      });

      const passwordHashCache = new Map<string, string>();
      const roleCache = new Map(existingRoles.map(role => [`${role.companyId?.toString()}:${normalizeRoleName(role.name)}`, role]));

      const results = {
        total: data.length,
        success: 0,
        failed: 0,
        errors: [] as Array<{ row: number; error: string }>
      };

      const newUsersToCreate: any[] = [];
      const userUpdateOps: any[] = [];

      for (let i = 0; i < data.length; i++) {
        const row = data[i] as any;
        try {
          let companyId = row.companyId;
          let departmentId = row.departmentId;

          if (currentUser.departmentId) {
             companyId = currentUser.companyId?.toString();
             departmentId = currentUser.departmentId?.toString();
          } else if (!currentUser.isSuperAdmin) {
             companyId = currentUser.companyId?.toString();
          }

          if (!companyId) throw new Error('Company ID is required');

          if (!departmentId && (row.department || row.departmentName)) {
            const deptName = row.department || row.departmentName;
            const dept = deptCache.get(`${companyId}:${deptName.toLowerCase()}`);
            if (dept) departmentId = dept._id;
          }

          let existingUser = null;
          if (row.email) existingUser = userCache.get(`${companyId}:email:${row.email.toLowerCase()}`);
          if (!existingUser && row.phone) existingUser = userCache.get(`${companyId}:phone:${row.phone}`);

          const rawPassword = row.password || '111111';
          const normalizedRoleName = row.role ? normalizeRoleName(String(row.role)) : '';
          const matchingRole = normalizedRoleName ? roleCache.get(`${companyId}:${normalizedRoleName}`) : null;
          let hashedPassword = passwordHashCache.get(rawPassword);
          if (!hashedPassword) {
            hashedPassword = await bcrypt.hash(rawPassword, 10);
            passwordHashCache.set(rawPassword, hashedPassword);
          }

          if (existingUser) {
            const changes: any = {};
            if (row.firstName || row.first_name) changes.firstName = row.firstName || row.first_name;
            if (row.lastName || row.last_name) changes.lastName = row.lastName || row.last_name;
            if (row.designation) changes.designation = row.designation;
            if (matchingRole && String(existingUser.customRoleId) !== String(matchingRole._id)) changes.customRoleId = matchingRole._id;
            if (departmentId && String(existingUser.departmentId) !== String(departmentId)) changes.departmentId = departmentId;
            changes.password = hashedPassword;
            changes.isSuperAdmin = false;
            changes.updatedAt = new Date();

            userUpdateOps.push({
              updateOne: {
                filter: { _id: existingUser._id },
                update: { $set: changes }
              }
            });
          } else {
            newUsersToCreate.push({
              firstName: row.firstName || row.first_name,
              lastName: row.lastName || row.last_name,
              email: row.email ? row.email.toLowerCase() : undefined,
              phone: row.phone,
              designation: row.designation,
              customRoleId: matchingRole?._id,
              companyId,
              departmentId,
              password: hashedPassword,
              isSuperAdmin: false,
              isActive: row.isActive !== false
            });
          }
        } catch (error: any) {
          results.failed++;
          results.errors.push({ row: i + 2, error: error.message });
        }
      }

      if (newUsersToCreate.length > 0) {
        const { getNextUserIdBatch } = await import('../utils/idGenerator');
        let currentIdNum = await getNextUserIdBatch(newUsersToCreate.length, searchCompanyId as any);
        const now = new Date();
        const docs = newUsersToCreate.map(u => ({
          ...u,
          userId: `USER${String(currentIdNum++).padStart(6, '0')}`,
          createdAt: now,
          updatedAt: now
        }));
        await User.insertMany(docs, { ordered: false });
        results.success += docs.length;
      }

      if (userUpdateOps.length > 0) {
        await User.bulkWrite(userUpdateOps, { ordered: false });
        results.success += userUpdateOps.length;
      }

      await logUserAction(
        req,
        AuditAction.IMPORT,
        'User',
        'bulk',
        { total: results.total, success: results.success, failed: results.failed }
      );

      res.json({
        success: true,
        message: `Import completed: ${results.success} succeeded, ${results.failed} failed`,
        data: results
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to import users',
        error: error.message
      });
    }
  }
);

// @route   GET /api/import/template/:type
// @desc    Download import template
// @access  Private
router.get('/template/:type', requirePermission(Permission.IMPORT_DATA), async (req: Request, res: Response): Promise<void> => {
  try {
    const { type } = req.params;

    let template: any[] = [];

    switch (type) {
      case 'companies':
        template = [
          {
            name: 'Example Company',
            companyType: 'GOV_GRIEVANCE',
            contactEmail: 'contact@example.com',
            contactPhone: '+1234567890',
            address: '123 Main St',
            enabledModules: 'GRIEVANCE,APPOINTMENT',
            primaryColor: '#0f4c81',
            secondaryColor: '#1a73e8'
          }
        ];
        break;
      case 'departments':
        template = [
          {
            companyId: 'COMPANY_ID_HERE',
            name: 'Example Department',
            description: 'Department description',
            contactPerson: 'John Doe',
            contactEmail: 'dept@example.com',
            contactPhone: '+1234567890'
          }
        ];
        break;
      case 'users':
        template = [
          {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com',
            password: '111111',
            phone: '+1234567890',
            designation: 'Officer',
            role: 'Staff',
            companyId: 'COMPANY_ID_HERE',
            departmentId: 'DEPARTMENT_ID_HERE'
          }
        ];
        break;
      case 'drilldown-hierarchy':
        template = [
          {
            'Sr.No': 1,
            'Department Name': 'Revenue & Disaster Management',
            'Sub- Department Name': '',
            'Officer Name': 'Sri Sabyasachi Panda',
            'Designation': 'Sub- Collector, Jharsuguda',
            'Whatsapp Number': '919876543210',
            'Email ID': 'sabyasachi.panda@example.com',
            'Role ( Department Admin / Sub-Department Admin)': 'Deptt Admin',
            'Department Description': 'Department level leadership entry'
          },
          {
            'Sr.No': 2,
            'Department Name': 'Revenue & Disaster Management',
            'Sub- Department Name': 'Tahasili Office, Jharsuguda',
            'Officer Name': 'Sri Sadakar Kumbhar',
            'Designation': 'Tahasildar',
            'Whatsapp Number': '919123456789',
            'Email ID': 'sadakar.kumbhar@example.com',
            'Role ( Department Admin / Sub-Department Admin)': 'Sub-Deptt Admin',
            'Department Description': 'Sub-department level leadership entry'
          }
        ];
        break;
      default:
        res.status(400).json({
          success: false,
          message: 'Invalid template type'
        });
        return;
    }

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(template);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${type}-template.xlsx`);
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate template',
      error: error.message
    });
  }
});

export default router;
