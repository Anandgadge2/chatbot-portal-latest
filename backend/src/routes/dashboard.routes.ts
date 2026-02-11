import express, { Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { requireDatabaseConnection } from '../middleware/dbConnection';
import { 
  requireSuperAdminDashboard, 
  requireCompanyAdminDashboard, 
  requireDepartmentAdminDashboard,
  canAccessAnyDashboard 
} from '../middleware/dashboardAccess';
import Company from '../models/Company';
import User from '../models/User';
import Department from '../models/Department';

const router = express.Router();

// All routes require database connection
router.use(requireDatabaseConnection);

// SuperAdmin Dashboard - Only SuperAdmin can access
router.get('/superadmin', authenticate, requireSuperAdminDashboard, async (req: Request, res: Response) => {
  try {
    const stats = {
      companies: await Company.countDocuments({}),
      users: await User.countDocuments({}),
      departments: await Department.countDocuments({}),
      activeCompanies: await Company.countDocuments({ isActive: true }),
      activeUsers: await User.countDocuments({ isActive: true })
    };

    return res.json({
      success: true,
      data: {
        dashboard: 'superadmin',
        stats,
        user: {
          id: req.user?._id,
          userId: req.user?.userId,
          firstName: req.user?.firstName,
          lastName: req.user?.lastName,
          email: req.user?.email,
          role: req.user?.role
        }
      }
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Failed to load SuperAdmin dashboard',
      error: error.message
    });
  }
});

// Company Admin Dashboard - SuperAdmin and CompanyAdmin can access
router.get('/company-admin', authenticate, requireCompanyAdminDashboard, async (req: Request, res: Response) => {
  try {
    let companyFilter = {};
    if (req.user?.role !== 'SUPER_ADMIN') {
      companyFilter = { companyId: req.user?.companyId };
    }

    const stats = {
      users: await User.countDocuments({ ...companyFilter }),
      departments: await Department.countDocuments({ ...companyFilter }),
      activeUsers: await User.countDocuments({ ...companyFilter, isActive: true })
    };

    // Get company info if not SuperAdmin
    let company = null;
    if (req.user?.role !== 'SUPER_ADMIN' && req.user?.companyId) {
      company = await Company.findById(req.user.companyId);
    }

    return res.json({
      success: true,
      data: {
        dashboard: 'company-admin',
        stats,
        company,
        user: {
          id: req.user?._id,
          userId: req.user?.userId,
          firstName: req.user?.firstName,
          lastName: req.user?.lastName,
          email: req.user?.email,
          role: req.user?.role,
          companyId: req.user?.companyId
        }
      }
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Failed to load CompanyAdmin dashboard',
      error: error.message
    });
  }
});

// Department Admin Dashboard - SuperAdmin, CompanyAdmin, and DepartmentAdmin can access
router.get('/department-admin', authenticate, requireDepartmentAdminDashboard, async (req: Request, res: Response) => {
  try {
    let filter = {};
    if (req.user?.role === 'DEPARTMENT_ADMIN') {
      filter = { departmentId: req.user?.departmentId };
    } else if (req.user?.role === 'COMPANY_ADMIN') {
      filter = { companyId: req.user?.companyId };
    }

    const stats = {
      users: await User.countDocuments({ ...filter }),
      activeUsers: await User.countDocuments({ ...filter, isActive: true })
    };

    // Get department info if Department Admin
    let department = null;
    if (req.user?.role === 'DEPARTMENT_ADMIN' && req.user?.departmentId) {
      department = await Department.findById(req.user.departmentId);
    }

    return res.json({
      success: true,
      data: {
        dashboard: 'department-admin',
        stats,
        department,
        user: {
          id: req.user?._id,
          userId: req.user?.userId,
          firstName: req.user?.firstName,
          lastName: req.user?.lastName,
          email: req.user?.email,
          role: req.user?.role,
          companyId: req.user?.companyId,
          departmentId: req.user?.departmentId
        }
      }
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Failed to load DepartmentAdmin dashboard',
      error: error.message
    });
  }
});

// Universal Dashboard Access - SuperAdmin can access any dashboard without auth
router.get('/any/:dashboardType', canAccessAnyDashboard, async (req: Request, res: Response) => {
  try {
    const { dashboardType } = req.params;
    
    // Validate dashboard type
    const validDashboards = ['superadmin', 'company-admin', 'department-admin'];
    if (!validDashboards.includes(dashboardType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid dashboard type'
      });
    }

    // Get comprehensive stats for SuperAdmin
    const stats = {
      companies: await Company.countDocuments({}),
      users: await User.countDocuments({}),
      departments: await Department.countDocuments({}),
      activeCompanies: await Company.countDocuments({ isActive: true }),
      activeUsers: await User.countDocuments({ isActive: true })
    };

    return res.json({
      success: true,
      data: {
        dashboard: dashboardType,
        stats,
        user: {
          id: req.user?._id,
          userId: req.user?.userId,
          firstName: req.user?.firstName,
          lastName: req.user?.lastName,
          email: req.user?.email,
          role: req.user?.role
        },
        accessLevel: req.user?.role === 'SUPER_ADMIN' ? 'full' : 'limited'
      }
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Failed to load dashboard',
      error: error.message
    });
  }
});

export default router;
