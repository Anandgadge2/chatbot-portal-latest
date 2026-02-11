import { Request, Response, NextFunction } from 'express';
import { UserRole, Permission, ROLE_PERMISSIONS } from '../config/constants';

export const requireRole = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
      return;
    }

    next();
  };
};

export const requirePermission = (...permissions: Permission[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
      return;
    }

    // SuperAdmin has all permissions
    if (req.user.role === UserRole.SUPER_ADMIN) {
      next();
      return;
    }

    // Get role permissions
    const rolePermissions = ROLE_PERMISSIONS[req.user.role] || [];

    // Check if user has at least one of the required permissions (OR logic)
    // This allows routes to accept either STATUS_CHANGE or UPDATE permissions
    const hasPermission = permissions.some(permission => 
      rolePermissions.includes(permission)
    );

    if (!hasPermission) {
      res.status(403).json({
        success: false,
        message: 'Access denied. Required permissions not found.'
      });
      return;
    }

    next();
  };
};

export const requireSuperAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
    return;
  }

  if (req.user.role !== UserRole.SUPER_ADMIN) {
    res.status(403).json({
      success: false,
      message: 'Access denied. SuperAdmin access required.'
    });
    return;
  }

  next();
};

export const requireCompanyAccess = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
    return;
  }

  // SuperAdmin has access to all companies
  if (req.user.role === UserRole.SUPER_ADMIN) {
    next();
    return;
  }

  // Get companyId from params or body
  const companyId = req.params.companyId || req.body.companyId;

  if (!companyId) {
    res.status(400).json({
      success: false,
      message: 'Company ID is required.'
    });
    return;
  }

  // Check if user belongs to the company
  if (req.user.companyId?.toString() !== companyId) {
    res.status(403).json({
      success: false,
      message: 'Access denied. You do not have access to this company.'
    });
    return;
  }

  next();
};

export const requireDepartmentAccess = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
    return;
  }

  // SuperAdmin and CompanyAdmin have access to all departments in their scope
  if (req.user.role === UserRole.SUPER_ADMIN || req.user.role === UserRole.COMPANY_ADMIN) {
    next();
    return;
  }

  // Get departmentId from params or body
  const departmentId = req.params.departmentId || req.body.departmentId;

  if (!departmentId) {
    res.status(400).json({
      success: false,
      message: 'Department ID is required.'
    });
    return;
  }

  // Check if user belongs to the department
  if (req.user.departmentId?.toString() !== departmentId) {
    res.status(403).json({
      success: false,
      message: 'Access denied. You do not have access to this department.'
    });
    return;
  }

  next();
};
