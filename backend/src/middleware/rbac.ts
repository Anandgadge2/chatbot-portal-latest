import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../config/constants';
import { permissionAllows } from '../utils/accessControl';

const LEGACY_PERMISSIONS: Record<string, { module: string; action: string }> = {
  READ_GRIEVANCE: { module: 'GRIEVANCE', action: 'view' },
  CREATE_GRIEVANCE: { module: 'GRIEVANCE', action: 'create' },
  UPDATE_GRIEVANCE: { module: 'GRIEVANCE', action: 'update' },
  DELETE_GRIEVANCE: { module: 'GRIEVANCE', action: 'delete' },
  ASSIGN_GRIEVANCE: { module: 'GRIEVANCE', action: 'assign' },
  STATUS_CHANGE_GRIEVANCE: { module: 'GRIEVANCE', action: 'status_change' },
  REVERT_GRIEVANCE: { module: 'GRIEVANCE', action: 'revert' },
  READ_APPOINTMENT: { module: 'APPOINTMENT', action: 'view' },
  CREATE_APPOINTMENT: { module: 'APPOINTMENT', action: 'create' },
  UPDATE_APPOINTMENT: { module: 'APPOINTMENT', action: 'update' },
  DELETE_APPOINTMENT: { module: 'APPOINTMENT', action: 'delete' },
  STATUS_CHANGE_APPOINTMENT: { module: 'APPOINTMENT', action: 'status_change' },
  CREATE_USER: { module: 'USER_MANAGEMENT', action: 'create' },
  READ_USER: { module: 'USER_MANAGEMENT', action: 'view' },
  UPDATE_USER: { module: 'USER_MANAGEMENT', action: 'update' },
  DELETE_USER: { module: 'USER_MANAGEMENT', action: 'delete' },
  CREATE_DEPARTMENT: { module: 'DEPARTMENTS', action: 'create' },
  READ_DEPARTMENT: { module: 'DEPARTMENTS', action: 'view' },
  UPDATE_DEPARTMENT: { module: 'DEPARTMENTS', action: 'update' },
  DELETE_DEPARTMENT: { module: 'DEPARTMENTS', action: 'delete' },
  VIEW_ANALYTICS: { module: 'ANALYTICS', action: 'view' },
  EXPORT_DATA: { module: 'ANALYTICS', action: 'export' },
  CONFIGURE_CHATBOT: { module: 'FLOW_BUILDER', action: 'view' },
  MANAGE_SETTINGS: { module: 'SETTINGS', action: 'update' },
  VIEW_AUDIT_LOGS: { module: 'SETTINGS', action: 'view_audit' },
  EXPORT_ALL_DATA: { module: 'ANALYTICS', action: 'export' },
  IMPORT_DATA: { module: 'SETTINGS', action: 'update' }
};

const normalizePermissionArgs = (module: string, action?: string) => {
  if (action && !LEGACY_PERMISSIONS[module]) {
    return [{ module, action }];
  }

  const rawArgs = [module, action].filter((value): value is string => Boolean(value));
  return rawArgs
    .map((value) => LEGACY_PERMISSIONS[value] || (value.includes(':') ? {
      module: value.split(':')[0],
      action: value.split(':')[1]
    } : null))
    .filter((value): value is { module: string; action: string } => Boolean(value));
};

export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    if (!roles.includes(req.user.role || '')) {
      res.status(403).json({ success: false, message: 'Access denied.' });
      return;
    }

    next();
  };
};

export const requirePermission = (module: string, action?: string) => {
  const requiredChecks = normalizePermissionArgs(module, action);

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !req.auth) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    if (req.auth.isSuperAdmin) {
      req.checkPermission = () => true;
      next();
      return;
    }

    req.checkPermission = (permission: string) => {
      const legacyCheck = LEGACY_PERMISSIONS[permission] || (permission.includes(':') ? {
        module: permission.split(':')[0],
        action: permission.split(':')[1]
      } : null);

      if (!legacyCheck) {
        return false;
      }

      return permissionAllows(req.auth!.filteredPermissions, legacyCheck.module, legacyCheck.action);
    };

    const isAllowed = requiredChecks.some((check) => (
      permissionAllows(req.auth!.filteredPermissions, check.module, check.action)
    ));

    if (isAllowed) {
      next();
      return;
    }

    if (requiredChecks.length === 1 && action && !LEGACY_PERMISSIONS[module]) {
      res.status(403).json({
        success: false,
        message: `Insufficient permissions for ${module}:${action}`
      });
      return;
    }

    res.status(403).json({
      success: false,
      message: 'Access denied. You do not have the required permissions for this action.'
    });
  };
};

declare global {
  namespace Express {
    interface Request {
      checkPermission: (permission: string) => boolean;
      resolvedRole?: any;
    }
  }
}

export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.auth?.isSuperAdmin) {
    return res.status(403).json({ success: false, message: 'SuperAdmin access required.' });
  }
  next();
};

export const requireCompanyAccess = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || !req.auth) return res.status(401).json({ success: false, message: 'Auth required.' });
  if (req.auth.isSuperAdmin) return next();

  const companyId = req.params.companyId || req.body.companyId;
  if (req.auth.companyId !== companyId) {
    return res.status(403).json({ success: false, message: 'Access denied to this company.' });
  }
  next();
};

export const requireDepartmentAccess = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || !req.auth) return res.status(401).json({ success: false, message: 'Auth required.' });
  if (req.auth.isSuperAdmin) return next();
  if (!req.auth.departmentId && req.auth.companyId) return next();

  const departmentId = req.params.departmentId || req.body.departmentId || req.query.departmentId;
  if (req.auth.departmentId !== departmentId?.toString()) {
    return res.status(403).json({ success: false, message: 'Access denied to this department.' });
  }
  next();
};

export const requirePlatformOrLegacySuperAdmin = (req: Request) => (
  req.auth?.isSuperAdmin || req.user?.role?.toUpperCase() === UserRole.SUPER_ADMIN
);
