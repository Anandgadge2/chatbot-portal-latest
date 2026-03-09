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

      for (let i = 0; i < data.length; i++) {
        const row = data[i] as Record<string, any>;

        try {
          const mainDepartmentName = getCellValue(row, ['Main Department', 'mainDepartment', 'Department']);
          const subDepartmentName = getCellValue(row, ['Sub Department', 'subDepartment']);
          const departmentDescription = getCellValue(row, ['Department Description', 'description']);

          if (!mainDepartmentName) {
            throw new Error('Main Department is required');
          }

          let mainDepartment = await Department.findOne({
            companyId,
            parentDepartmentId: null,
            name: new RegExp(`^${mainDepartmentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
          });

          if (!mainDepartment) {
            mainDepartment = await Department.create({
              companyId,
              name: mainDepartmentName,
              description: departmentDescription || undefined,
              isActive: true
            });
          } else if (departmentDescription && !mainDepartment.description) {
            mainDepartment.description = departmentDescription;
            await mainDepartment.save();
          }

          let targetDepartment = mainDepartment;

          if (subDepartmentName) {
            let subDepartment = await Department.findOne({
              companyId,
              parentDepartmentId: mainDepartment._id,
              name: new RegExp(`^${subDepartmentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
            });

            if (!subDepartment) {
              subDepartment = await Department.create({
                companyId,
                parentDepartmentId: mainDepartment._id,
                name: subDepartmentName,
                description: departmentDescription || undefined,
                isActive: true
              });
            } else if (departmentDescription && !subDepartment.description) {
              subDepartment.description = departmentDescription;
              await subDepartment.save();
            }

            targetDepartment = subDepartment;
          }

          const upsertUser = async (params: {
            firstName: string;
            lastName: string;
            email: string;
            phone: string;
            designation: string;
            role: string;
            defaultPassword: string;
          }) => {
            const { firstName, lastName, email, phone, designation, role, defaultPassword } = params;

            if (!firstName || (!email && !phone)) {
              return;
            }

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
                lastName: lastName || '-',
                email: email || undefined,
                phone,
                designation: designation || undefined,
                role,
                companyId,
                departmentId: targetDepartment._id,
                password: defaultPassword,
                rawPassword: defaultPassword,
                isActive: true
              });
              return;
            }

            existingUser.firstName = firstName || existingUser.firstName;
            existingUser.lastName = lastName || existingUser.lastName;
            existingUser.phone = phone || existingUser.phone;
            existingUser.designation = designation || existingUser.designation;
            existingUser.role = role || existingUser.role;
            existingUser.departmentId = targetDepartment._id;
            if (email) {
              existingUser.email = email.toLowerCase();
            }
            await existingUser.save();
          };

          await upsertUser({
            firstName: getCellValue(row, ['Admin First Name', 'adminFirstName']),
            lastName: getCellValue(row, ['Admin Last Name', 'adminLastName']),
            email: getCellValue(row, ['Admin Email', 'adminEmail']),
            phone: getCellValue(row, ['Admin WhatsApp', 'Admin Phone', 'adminPhone']),
            designation: getCellValue(row, ['Admin Designation', 'adminDesignation']),
            role: 'DEPARTMENT_ADMIN',
            defaultPassword: 'TempAdmin123!'
          });

          await upsertUser({
            firstName: getCellValue(row, ['User First Name', 'userFirstName']),
            lastName: getCellValue(row, ['User Last Name', 'userLastName']),
            email: getCellValue(row, ['User Email', 'userEmail']),
            phone: getCellValue(row, ['User WhatsApp', 'User Phone', 'userPhone']),
            designation: getCellValue(row, ['User Designation', 'userDesignation']),
            role: getCellValue(row, ['User Role', 'userRole']) || 'STAFF',
            defaultPassword: 'TempUser123!'
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
            'Main Department': 'Finance',
            'Sub Department': 'Accounts Receivable',
            'Department Description': 'Handles all receivable accounting and ledger verification',
            'Admin First Name': 'John',
            'Admin Last Name': 'Doe',
            'Admin Email': 'john.doe@example.com',
            'Admin WhatsApp': '919876543210',
            'Admin Designation': 'Finance Manager',
            'User First Name': 'Amit',
            'User Last Name': 'Shah',
            'User Email': 'amit.shah@example.com',
            'User WhatsApp': '919000001111',
            'User Designation': 'Executive',
            'User Role': 'STAFF'
          },
          {
            'Sr.No': 2,
            'Main Department': 'Operations',
            'Sub Department': 'Field Unit',
            'Department Description': 'On-ground execution and regional support',
            'Admin First Name': 'Jane',
            'Admin Last Name': 'Smith',
            'Admin Email': 'jane.smith@example.com',
            'Admin WhatsApp': '919123456789',
            'Admin Designation': 'Operations Head',
            'User First Name': 'Ravi',
            'User Last Name': 'Kumar',
            'User Email': 'ravi.kumar@example.com',
            'User WhatsApp': '919222334455',
            'User Designation': 'Field Officer',
            'User Role': 'STAFF'
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
