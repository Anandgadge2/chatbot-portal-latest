import { Request, Response, NextFunction } from 'express';
import { UserRole, Permission, ROLE_PERMISSIONS } from '../config/constants';
import Role from '../models/Role';

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

/**
 * Mapping of legacy Permission enum to new Module/Action structure used in the Role model.
 */
const PERMISSION_MAPPING: Record<string, { module: string; action: string }> = {
  [Permission.READ_GRIEVANCE]: { module: 'grievances', action: 'view' },
  [Permission.CREATE_GRIEVANCE]: { module: 'grievances', action: 'create' },
  [Permission.UPDATE_GRIEVANCE]: { module: 'grievances', action: 'update' },
  [Permission.DELETE_GRIEVANCE]: { module: 'grievances', action: 'delete' },
  [Permission.ASSIGN_GRIEVANCE]: { module: 'grievances', action: 'assign' },
  [Permission.STATUS_CHANGE_GRIEVANCE]: { module: 'grievances', action: 'status_change' },
  
  [Permission.READ_APPOINTMENT]: { module: 'appointments', action: 'view' },
  [Permission.CREATE_APPOINTMENT]: { module: 'appointments', action: 'create' },
  [Permission.UPDATE_APPOINTMENT]: { module: 'appointments', action: 'update' },
  [Permission.DELETE_APPOINTMENT]: { module: 'appointments', action: 'delete' },
  [Permission.STATUS_CHANGE_APPOINTMENT]: { module: 'appointments', action: 'status_change' },
  
  [Permission.CREATE_USER]: { module: 'users', action: 'create' },
  [Permission.READ_USER]: { module: 'users', action: 'view' },
  [Permission.UPDATE_USER]: { module: 'users', action: 'update' },
  [Permission.DELETE_USER]: { module: 'users', action: 'delete' },
  
  [Permission.CREATE_DEPARTMENT]: { module: 'departments', action: 'create' },
  [Permission.READ_DEPARTMENT]: { module: 'departments', action: 'view' },
  [Permission.UPDATE_DEPARTMENT]: { module: 'departments', action: 'update' },
  [Permission.DELETE_DEPARTMENT]: { module: 'departments', action: 'delete' },
  
  [Permission.VIEW_ANALYTICS]: { module: 'analytics', action: 'view' },
  [Permission.EXPORT_DATA]: { module: 'analytics', action: 'export' },
  
  [Permission.CONFIGURE_CHATBOT]: { module: 'flow_builder', action: 'view' },
  [Permission.MANAGE_SETTINGS]: { module: 'settings', action: 'update' },
  [Permission.VIEW_AUDIT_LOGS]: { module: 'settings', action: 'view_audit' }
};

export const requirePermission = (...permissions: Permission[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
      return;
    }

    // 1. SuperAdmin has all permissions bypass
    if (req.user.role === UserRole.SUPER_ADMIN) {
      next();
      return;
    }

    // 2. Check Custom Role (MongoDB) if assigned
    if (req.user.customRoleId) {
      try {
        const role = await Role.findById(req.user.customRoleId);
        if (role) {
          // Check if any of the required permissions are granted in the custom role
          const hasCustomPermission = permissions.some(p => {
            const mapped = PERMISSION_MAPPING[p];
            if (!mapped) return false;

            const modulePermissions = role.permissions.find(perm => perm.module === mapped.module);
            if (!modulePermissions) return false;

            // Grant access if action matches OR if 'manage'/'all' action is present
            return modulePermissions.actions.includes(mapped.action) || 
                   modulePermissions.actions.includes('manage') ||
                   modulePermissions.actions.includes('all');
          });

          if (hasCustomPermission) {
            next();
            return;
          }
        }
      } catch (err) {
        console.error('Error fetching custom role:', err);
        // Fallback to static role if error fetching custom role
      }
    }

    // 3. Fallback to Static Role Permissions (for default system roles)
    const rolePermissions = ROLE_PERMISSIONS[req.user.role] || [];

    // Check if user has at least one of the required permissions (OR logic)
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
