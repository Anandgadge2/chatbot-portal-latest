import { Request, Response, NextFunction } from 'express';
import { hasPermission } from '../utils/accessControl';

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

const resolvePermissionChecks = (moduleOrPermission: string, action?: string): Array<{ module: string; action: string }> => {
  if (action) {
    return [{ module: moduleOrPermission, action }];
  }

  return moduleOrPermission
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      if (LEGACY_PERMISSIONS[entry]) {
        return LEGACY_PERMISSIONS[entry];
      }

      if (entry.includes(':')) {
        const [module, actionName] = entry.split(':');
        return { module, action: actionName };
      }

      return { module: entry, action: 'view' };
    });
};

export const requireRole = () => {
  return (_req: Request, res: Response): void => {
    res.status(403).json({ success: false, message: 'Role-name based access is no longer supported.' });
  };
};

export const requirePermission = (moduleOrPermission: string, action?: string, ...legacyPermissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const permissionChecks = [moduleOrPermission, ...legacyPermissions]
      .flatMap((entry, index) => resolvePermissionChecks(entry, index === 0 ? action : undefined));

    const currentUser = req.user;
    const access = req.access || {
      isSuperAdmin: currentUser.isSuperAdmin,
      filteredPermissions: currentUser.filteredPermissions || [],
      level: currentUser.level || 0,
      scope: currentUser.scope || 'company'
    };

    if (access.isSuperAdmin) {
      req.checkPermission = () => true;
      next();
      return;
    }

    req.checkPermission = (permission: string): boolean => {
      const checks = resolvePermissionChecks(permission);
      return checks.some((check) => hasPermission(access.filteredPermissions, check.module, check.action));
    };

    if (permissionChecks.some((check) => hasPermission(access.filteredPermissions, check.module, check.action))) {
      next();
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
  if (!req.user?.isSuperAdmin) {
    return res.status(403).json({ success: false, message: 'SuperAdmin access required.' });
  }
  next();
};

export const requireCompanyAccess = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Auth required.' });
  if (req.user.isSuperAdmin) return next();

  const companyId = req.params.companyId || req.body.companyId;
  if (req.user.companyId?.toString() !== companyId) {
    return res.status(403).json({ success: false, message: 'Access denied to this company.' });
  }
  next();
};

export const requireDepartmentAccess = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Auth required.' });
  if (req.user.isSuperAdmin) return next();

  const departmentId = req.params.departmentId || req.body.departmentId || req.query.departmentId;

  if (!req.user.departmentId && req.user.companyId) {
    return next();
  }

  if (req.user.departmentId?.toString() !== departmentId?.toString()) {
    return res.status(403).json({ success: false, message: 'Access denied to this department.' });
  }
  next();
};
