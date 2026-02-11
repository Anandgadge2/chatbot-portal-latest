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
          if (currentUser.role === UserRole.COMPANY_ADMIN) {
            companyId = currentUser.companyId?.toString();
            if (row.departmentId) {
              departmentId = row.departmentId;
            }
          } else if (currentUser.role === UserRole.DEPARTMENT_ADMIN) {
            companyId = currentUser.companyId?.toString();
            departmentId = currentUser.departmentId?.toString();
          }

          const hashedPassword = await bcrypt.hash(row.password || 'TempPassword123!', 10);

          await User.create({
            firstName: row.firstName || row.first_name,
            lastName: row.lastName || row.last_name,
            email: row.email,
            password: hashedPassword,
            phone: row.phone,
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
            role: 'OPERATOR',
            companyId: 'COMPANY_ID_HERE',
            departmentId: 'DEPARTMENT_ID_HERE'
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
