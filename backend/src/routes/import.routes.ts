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
import bcrypt from 'bcryptjs';

const router = express.Router();

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

      if (currentUser.role === UserRole.SUPER_ADMIN && !req.body.companyId) {
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

      const companyId = currentUser.role === UserRole.SUPER_ADMIN
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


      const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      const mapRole = (rawRole: string, hasSubDepartment: boolean) => {
        const normalized = String(rawRole || '').toLowerCase();
        if (normalized.includes('sub') && normalized.includes('admin')) {
          return 'SUB_DEPARTMENT_ADMIN';
        }
        if (normalized.includes('dept') && normalized.includes('admin')) {
          return 'DEPARTMENT_ADMIN';
        }
        if (normalized.includes('admin')) {
          return hasSubDepartment ? 'SUB_DEPARTMENT_ADMIN' : 'DEPARTMENT_ADMIN';
        }
        return 'DEPARTMENT_ADMIN';
      };

      for (let i = 0; i < data.length; i++) {
        const row = data[i] as Record<string, any>;

        try {
          const mainDepartmentName = getCellValue(row, [
            'Department Name',
            'Main Department',
            'mainDepartment',
            'Department'
          ]);
          const subDepartmentName = getCellValue(row, [
            'Sub- Department Name',
            'Sub Department Name',
            'Sub Department',
            'subDepartment'
          ]);
          const departmentDescription = getCellValue(row, [
            'Department Description',
            'description'
          ]);
          const officerName = getCellValue(row, ['Officer Name']);
          const designation = getCellValue(row, ['Designation']);
          const email = getCellValue(row, ['Email ID', 'Email', 'email']);
          const phone = getCellValue(row, ['Whatsapp Number', 'WhatsApp Number', 'Admin WhatsApp', 'Phone']);
          const rowRole = getCellValue(row, ['Role ( Department Admin / Sub-Department Admin)', 'Role', 'User Role']);

          if (!mainDepartmentName) {
            throw new Error('Department Name is required');
          }

          if (!officerName) {
            throw new Error('Officer Name is required');
          }

          if (!email && !phone) {
            throw new Error('Either Email ID or Whatsapp Number is required');
          }

          const mainNameRegex = new RegExp(`^${escapeRegExp(mainDepartmentName)}$`, 'i');

          let mainDepartment = await Department.findOne({
            companyId,
            parentDepartmentId: null,
            name: mainNameRegex
          });

          if (!mainDepartment) {
            mainDepartment = await Department.create({
              companyId,
              name: mainDepartmentName,
              description: departmentDescription || undefined,
              isActive: true
            });
          } else {
            if (departmentDescription && !mainDepartment.description) {
              mainDepartment.description = departmentDescription;
            }
            if (!subDepartmentName) {
              mainDepartment.contactPerson = officerName;
              mainDepartment.contactEmail = email || mainDepartment.contactEmail;
              mainDepartment.contactPhone = phone || mainDepartment.contactPhone;
            }
            await mainDepartment.save();
          }

          let targetDepartment = mainDepartment;

          if (subDepartmentName) {
            const subNameRegex = new RegExp(`^${escapeRegExp(subDepartmentName)}$`, 'i');
            let subDepartment = await Department.findOne({
              companyId,
              parentDepartmentId: mainDepartment._id,
              name: subNameRegex
            });

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
            } else {
              if (departmentDescription && !subDepartment.description) {
                subDepartment.description = departmentDescription;
              }
              subDepartment.contactPerson = officerName;
              subDepartment.contactEmail = email || subDepartment.contactEmail;
              subDepartment.contactPhone = phone || subDepartment.contactPhone;
              await subDepartment.save();
            }

            targetDepartment = subDepartment;
          } else if (!mainDepartment.contactPerson || !mainDepartment.contactEmail || !mainDepartment.contactPhone) {
            mainDepartment.contactPerson = officerName;
            mainDepartment.contactEmail = email || mainDepartment.contactEmail;
            mainDepartment.contactPhone = phone || mainDepartment.contactPhone;
            await mainDepartment.save();
          }

          const { firstName, lastName } = splitOfficerName(officerName);
          const role = mapRole(rowRole, Boolean(subDepartmentName));

          const userQuery: any = { companyId };
          if (email) {
            userQuery.email = email.toLowerCase();
          } else {
            userQuery.phone = phone;
          }

          const existingUser = await User.findOne(userQuery).select('+password');

          if (!existingUser) {
            await User.create({
              firstName,
              lastName,
              email: email ? email.toLowerCase() : undefined,
              phone,
              designation: designation || undefined,
              role,
              companyId,
              departmentId: targetDepartment._id,
              password: 'TempAdmin123!',
              rawPassword: 'TempAdmin123!',
              isActive: true
            });
          } else {
            existingUser.firstName = firstName || existingUser.firstName;
            existingUser.lastName = lastName || existingUser.lastName;
            existingUser.phone = phone || existingUser.phone;
            existingUser.designation = designation || existingUser.designation;
            existingUser.role = role;
            existingUser.departmentId = targetDepartment._id;
            if (email) {
              existingUser.email = email.toLowerCase();
            }
            await existingUser.save();
          }

          results.success++;
        } catch (error: any) {
          results.failed++;
          results.errors.push({
            row: i + 2,
            error: error.message
          });
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

      if (currentUser.role !== UserRole.SUPER_ADMIN) {
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

      const results = {
        total: data.length,
        success: 0,
        failed: 0,
        errors: [] as Array<{ row: number; error: string }>
      };

      for (let i = 0; i < data.length; i++) {
        const row = data[i] as any;
        try {
          let companyId = row.companyId;

          // Non-SuperAdmin can only import for their company
          if (currentUser.role !== UserRole.SUPER_ADMIN) {
            companyId = currentUser.companyId?.toString();
          }

          if (!companyId) {
            throw new Error('Company ID is required');
          }

          await Department.create({
            companyId,
            name: row.name || row.departmentName,
            description: row.description,
            contactPerson: row.contactPerson,
            contactEmail: row.contactEmail,
            contactPhone: row.contactPhone
          });

          results.success++;
        } catch (error: any) {
          results.failed++;
          results.errors.push({
            row: i + 2,
            error: error.message
          });
        }
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

      const results = {
        total: data.length,
        success: 0,
        failed: 0,
        errors: [] as Array<{ row: number; error: string }>
      };

      for (let i = 0; i < data.length; i++) {
        const row = data[i] as any;
        try {
          let companyId = row.companyId;
          let departmentId = row.departmentId;

          // Scope validation
          if (currentUser.departmentId) {
             // Department-level user: strictly bound to their department
             companyId = currentUser.companyId?.toString();
             departmentId = currentUser.departmentId?.toString();
          } else {
             // Company-level user or SuperAdmin
             if (currentUser.role !== UserRole.SUPER_ADMIN) {
               companyId = currentUser.companyId?.toString();
             }
             // They can specify departmentId in the row if they are company-level
             if (row.departmentId) {
               departmentId = row.departmentId;
             }
          }

          const hashedPassword = await bcrypt.hash(row.password || 'TempPassword123!', 10);

          await User.create({
            firstName: row.firstName || row.first_name,
            lastName: row.lastName || row.last_name,
            email: row.email,
            password: hashedPassword,
            phone: row.phone,
            designation: row.designation,
            role: row.role,
            companyId,
            departmentId,
            isActive: row.isActive !== false
          });

          results.success++;
        } catch (error: any) {
          results.failed++;
          results.errors.push({
            row: i + 2,
            error: error.message
          });
        }
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
            password: 'TempPassword123!',
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
