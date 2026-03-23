import { Request, Response, NextFunction } from 'express';
import { hasPermission as hasResolvedPermission } from '../utils/accessControl';

const LEGACY_PERMISSIONS: Record<string, { module: string; action: string }> = {
  'READ_GRIEVANCE': { module: 'GRIEVANCE', action: 'view' },
  'CREATE_GRIEVANCE': { module: 'GRIEVANCE', action: 'create' },
  'UPDATE_GRIEVANCE': { module: 'GRIEVANCE', action: 'update' },
  'DELETE_GRIEVANCE': { module: 'GRIEVANCE', action: 'delete' },
  'ASSIGN_GRIEVANCE': { module: 'GRIEVANCE', action: 'assign' },
  'STATUS_CHANGE_GRIEVANCE': { module: 'GRIEVANCE', action: 'status_change' },
  'REVERT_GRIEVANCE': { module: 'GRIEVANCE', action: 'revert' },
  'READ_APPOINTMENT': { module: 'APPOINTMENT', action: 'view' },
  'CREATE_APPOINTMENT': { module: 'APPOINTMENT', action: 'create' },
  'UPDATE_APPOINTMENT': { module: 'APPOINTMENT', action: 'update' },
  'DELETE_APPOINTMENT': { module: 'APPOINTMENT', action: 'delete' },
  'STATUS_CHANGE_APPOINTMENT': { module: 'APPOINTMENT', action: 'status_change' },
  'CREATE_USER': { module: 'USER_MANAGEMENT', action: 'create' },
  'READ_USER': { module: 'USER_MANAGEMENT', action: 'view' },
  'UPDATE_USER': { module: 'USER_MANAGEMENT', action: 'update' },
  'DELETE_USER': { module: 'USER_MANAGEMENT', action: 'delete' },
  'CREATE_DEPARTMENT': { module: 'DEPARTMENTS', action: 'create' },
  'READ_DEPARTMENT': { module: 'DEPARTMENTS', action: 'view' },
  'UPDATE_DEPARTMENT': { module: 'DEPARTMENTS', action: 'update' },
  'DELETE_DEPARTMENT': { module: 'DEPARTMENTS', action: 'delete' },
  'VIEW_ANALYTICS': { module: 'ANALYTICS', action: 'view' },
  'EXPORT_DATA': { module: 'ANALYTICS', action: 'export' },
  'CONFIGURE_CHATBOT': { module: 'FLOW_BUILDER', action: 'view' },
  'MANAGE_SETTINGS': { module: 'SETTINGS', action: 'update' },
  'VIEW_AUDIT_LOGS': { module: 'SETTINGS', action: 'view_audit' },
  'EXPORT_ALL_DATA': { module: 'ANALYTICS', action: 'export' },
  'IMPORT_DATA': { module: 'SETTINGS', action: 'update' }
};

const resolvePermission = (permission: string) => {
  if (LEGACY_PERMISSIONS[permission]) {
    return LEGACY_PERMISSIONS[permission];
  }

  if (permission.includes(':')) {
    const [module, action] = permission.split(':');
    return { module, action };
  }

  return null;
};

export const requireRole = (...levels: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    if (req.user.isSuperAdmin) {
      next();
      return;
    }

    if (!levels.includes(String(req.user.level))) {
      res.status(403).json({ success: false, message: 'Access denied.' });
      return;
    }

    next();
  };
};

export const requirePermission = (...permissions: string[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const checkPerm = (permission: string): boolean => {
      if (req.user?.isSuperAdmin) {
        return true;
      }

      const mapped = resolvePermission(permission);
      if (!mapped) {
        return false;
      }

      return hasResolvedPermission(req.user?.filteredPermissions || [], mapped.module, mapped.action);
    };

    req.checkPermission = checkPerm;

    if (permissions.some((permission) => checkPerm(permission))) {
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
  if (req.user.isSuperAdmin || req.user.level === 1) return next();

  const departmentId = req.params.departmentId || req.body.departmentId || req.query.departmentId;
  if (req.user.departmentId?.toString() !== departmentId?.toString()) {
    return res.status(403).json({ success: false, message: 'Access denied to this department.' });
  }
  next();
};
