import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../config/constants';
import Role from '../models/Role';

/**
 * Mapping of legacy Permission identifiers to new Module/Action structure.
 * This allows routes to remain unchanged while the backend logic became dynamic.
 */
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

export const requirePermission = (...permissions: string[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    // Attach a helper function to the request to check permissions dynamically
    const user = req.user as any;
    
    // 1. SuperAdmin bypass
    if (user.role?.toUpperCase() === UserRole.SUPER_ADMIN) {
      req.checkPermission = () => true;
      next();
      return;
    }

    // 2. Dynamic Permission Check
    // We'll cache the role metadata on the request to avoid multiple lookups in the same request
    if (!req.resolvedRole) {
      let roleToFind = user.customRoleId;
      
      if (!roleToFind && user.role && user.companyId) {
        try {
          const systemRole = await Role.findOne({ 
            companyId: user.companyId, 
            $or: [
              { key: user.role.toUpperCase() },
              { name: { $regex: new RegExp(`^${user.role.replace(/_/g, ' ')}$`, 'i') } }
            ]
          });
          if (systemRole) roleToFind = systemRole._id;
        } catch (e) {
          console.warn('Fallback role lookup failed:', e);
        }
      }

      if (roleToFind) {
        req.resolvedRole = await Role.findById(roleToFind);
      }
    }

    const checkPerm = (p: string): boolean => {
      if (!req.resolvedRole) return false;
      
      const mapped = LEGACY_PERMISSIONS[p] || (p.includes(':') ? { module: p.split(':')[0], action: p.split(':')[1] } : null);
      if (!mapped) return false;

      const modPerm = req.resolvedRole.permissions.find((perm: any) => perm.module === mapped.module);
      if (!modPerm) return false;

      return modPerm.actions.includes(mapped.action) || 
             modPerm.actions.includes('manage') || 
             modPerm.actions.includes('all');
    };

    req.checkPermission = checkPerm;

    const authorized = permissions.some(p => checkPerm(p));

    if (authorized) {
      next();
      return;
    }

    res.status(403).json({
      success: false,
      message: 'Access denied. You do not have the required permissions for this action.'
    });
  };
};

// Add checkPermission to Request interface
declare global {
  namespace Express {
    interface Request {
      checkPermission: (permission: string) => boolean;
      resolvedRole?: any;
    }
  }
}

export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  const userRole = req.user?.role?.toUpperCase();
  if (userRole !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ success: false, message: 'SuperAdmin access required.' });
  }
  next();
};

export const requireCompanyAccess = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Auth required.' });
  if (req.user.role === UserRole.SUPER_ADMIN) return next();

  const companyId = req.params.companyId || req.body.companyId;
  if (req.user.companyId?.toString() !== companyId) {
    return res.status(403).json({ success: false, message: 'Access denied to this company.' });
  }
  next();
};

export const requireDepartmentAccess = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Auth required.' });
  
  // SuperAdmin bypass
  if (req.user.role?.toUpperCase() === UserRole.SUPER_ADMIN) return next();

  // If the user has no department assigned, we assume they are at the Company level
  // and have access to all departments in their company.
  if (!req.user.departmentId && req.user.companyId) {
    return next();
  }

  // Otherwise, restrict to their assigned department
  const departmentId = req.params.departmentId || req.body.departmentId || req.query.departmentId;
  if (req.user.departmentId?.toString() !== departmentId?.toString()) {
    return res.status(403).json({ success: false, message: 'Access denied to this department.' });
  }
  next();
};
