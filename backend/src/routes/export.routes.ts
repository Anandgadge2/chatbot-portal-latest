import express, { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { requireDatabaseConnection } from '../middleware/dbConnection';
import { logUserAction } from '../utils/auditLogger';
import { AuditAction, Permission, UserRole } from '../config/constants';
import Company from '../models/Company';
import Department from '../models/Department';
import User from '../models/User';
import Grievance from '../models/Grievance';
import Appointment from '../models/Appointment';

const router = express.Router();

// All routes require database connection and authentication
router.use(requireDatabaseConnection);
router.use(authenticate);

// @route   GET /api/export/companies
// @desc    Export companies to Excel (SuperAdmin only)
// @access  Private/SuperAdmin
router.get('/companies', requirePermission(Permission.EXPORT_ALL_DATA), async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = req.user!;

    if (currentUser.role !== UserRole.SUPER_ADMIN) {
      res.status(403).json({
        success: false,
        message: 'Only SuperAdmin can export companies'
      });
    }

    const companies = await Company.find({}).select('-whatsappConfig');

    const data = companies.map(company => ({
      companyId: company.companyId,
      name: company.name,
      companyType: company.companyType,
      contactEmail: company.contactEmail,
      contactPhone: company.contactPhone,
      address: company.address,
      enabledModules: company.enabledModules.join(','),
      primaryColor: company.theme.primaryColor,
      secondaryColor: company.theme.secondaryColor,
      isActive: company.isActive,
      isSuspended: company.isSuspended,
      createdAt: company.createdAt
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Companies');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    await logUserAction(req, AuditAction.EXPORT, 'Company', 'bulk', { count: companies.length });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=companies-export.xlsx');
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to export companies',
      error: error.message
    });
  }
});

// @route   GET /api/export/departments
// @desc    Export departments to Excel
// @access  Private
router.get('/departments', requirePermission(Permission.EXPORT_DATA), async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;
    const { companyId } = req.query;

    const query: any = {};

    if (currentUser.role === UserRole.SUPER_ADMIN) {
      if (companyId) query.companyId = companyId;
    } else {
      query.companyId = currentUser.companyId;
    }

    const departments = await Department.find(query).populate('companyId', 'name companyId');

    const data = departments.map(dept => ({
      departmentId: dept.departmentId,
      companyId: (dept.companyId as any)?._id,
      companyName: (dept.companyId as any)?.name,
      name: dept.name,
      description: dept.description,
      contactPerson: dept.contactPerson,
      contactEmail: dept.contactEmail,
      contactPhone: dept.contactPhone,
      isActive: dept.isActive,
      createdAt: dept.createdAt
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Departments');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    await logUserAction(req, AuditAction.EXPORT, 'Department', 'bulk', { count: departments.length });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=departments-export.xlsx');
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to export departments',
      error: error.message
    });
  }
});

// @route   GET /api/export/users
// @desc    Export users to Excel
// @access  Private
router.get('/users', requirePermission(Permission.EXPORT_DATA), async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = req.user!;
    const { companyId, departmentId } = req.query;

    const query: any = {};

    if (currentUser.role === UserRole.SUPER_ADMIN) {
      if (companyId) query.companyId = companyId;
      if (departmentId) query.departmentId = departmentId;
    } else if (currentUser.role === UserRole.COMPANY_ADMIN) {
      query.companyId = currentUser.companyId;
      if (departmentId) query.departmentId = departmentId;
    } else if (currentUser.role === UserRole.DEPARTMENT_ADMIN) {
      query.departmentId = currentUser.departmentId;
    } else {
      res.status(403).json({
        success: false,
        message: 'Access denied'
      });
      return;
    }

    const users = await User.find(query)
      .populate('companyId', 'name companyId')
      .populate('departmentId', 'name departmentId')
      .select('-password');

    const data = users.map(user => ({
      userId: user.userId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      companyId: (user.companyId as any)?._id,
      companyName: (user.companyId as any)?.name,
      departmentId: (user.departmentId as any)?._id,
      departmentName: (user.departmentId as any)?.name,
      isActive: user.isActive,
      createdAt: user.createdAt
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    await logUserAction(req, AuditAction.EXPORT, 'User', 'bulk', { count: users.length });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=users-export.xlsx');
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to export users',
      error: error.message
    });
  }
});

// @route   GET /api/export/grievances
// @desc    Export grievances to Excel
// @access  Private
router.get('/grievances', requirePermission(Permission.EXPORT_DATA), async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;
    const { companyId, departmentId, status } = req.query;

    const query: any = {};

    if (currentUser.role === UserRole.SUPER_ADMIN) {
      if (companyId) query.companyId = companyId;
      if (departmentId) query.departmentId = departmentId;
    } else if (currentUser.role === UserRole.COMPANY_ADMIN) {
      query.companyId = currentUser.companyId;
      if (departmentId) query.departmentId = departmentId;
    } else if (currentUser.role === UserRole.DEPARTMENT_ADMIN) {
      query.departmentId = currentUser.departmentId;
    } else if (currentUser.role === UserRole.OPERATOR) {
      query.assignedTo = currentUser._id;
    }

    if (status) query.status = status;

    const grievances = await Grievance.find(query)
      .populate('companyId', 'name companyId')
      .populate('departmentId', 'name departmentId')
      .populate('assignedTo', 'firstName lastName email');

    const data = grievances.map(g => ({
      grievanceId: g.grievanceId,
      companyName: (g.companyId as any)?.name,
      departmentName: (g.departmentId as any)?.name,
      citizenName: g.citizenName,
      citizenPhone: g.citizenPhone,
      citizenWhatsApp: g.citizenWhatsApp,
      description: g.description,
      category: g.category,
      status: g.status,
      assignedTo: g.assignedTo ? `${(g.assignedTo as any).firstName} ${(g.assignedTo as any).lastName}` : '',
      assignedAt: g.assignedAt,
      resolvedAt: g.resolvedAt,
      closedAt: g.closedAt,
      createdAt: g.createdAt
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Grievances');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    await logUserAction(req, AuditAction.EXPORT, 'Grievance', 'bulk', { count: grievances.length });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=grievances-export.xlsx');
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to export grievances',
      error: error.message
    });
  }
});

// @route   GET /api/export/appointments
// @desc    Export appointments to Excel
// @access  Private
router.get('/appointments', requirePermission(Permission.EXPORT_DATA), async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;
    const { companyId, departmentId, status } = req.query;

    const query: any = {};

    if (currentUser.role === UserRole.SUPER_ADMIN) {
      if (companyId) query.companyId = companyId;
      if (departmentId) query.departmentId = departmentId;
    } else if (currentUser.role === UserRole.COMPANY_ADMIN) {
      query.companyId = currentUser.companyId;
      if (departmentId) query.departmentId = departmentId;
    } else if (currentUser.role === UserRole.DEPARTMENT_ADMIN) {
      query.departmentId = currentUser.departmentId;
    } else if (currentUser.role === UserRole.OPERATOR) {
      query.assignedTo = currentUser._id;
    }

    if (status) query.status = status;

    const appointments = await Appointment.find(query)
      .populate('companyId', 'name companyId')
      .populate('departmentId', 'name departmentId')
      .populate('assignedTo', 'firstName lastName email');

    const data = appointments.map(a => ({
      appointmentId: a.appointmentId,
      companyName: (a.companyId as any)?.name,
      departmentName: (a.departmentId as any)?.name,
      citizenName: a.citizenName,
      citizenPhone: a.citizenPhone,
      citizenEmail: a.citizenEmail,
      purpose: a.purpose,
      appointmentDate: a.appointmentDate,
      appointmentTime: a.appointmentTime,
      duration: a.duration,
      status: a.status,
      assignedTo: a.assignedTo ? `${(a.assignedTo as any).firstName} ${(a.assignedTo as any).lastName}` : '',
      location: a.location,
      notes: a.notes,
      createdAt: a.createdAt
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Appointments');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    await logUserAction(req, AuditAction.EXPORT, 'Appointment', 'bulk', { count: appointments.length });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=appointments-export.xlsx');
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to export appointments',
      error: error.message
    });
  }
});

export default router;
