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

    if (!roles.includes(req.user.role)) {
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

    // 1. SuperAdmin & CompanyAdmin bypass
    // These roles have full access within their scope and don't need restriction by dynamic roles.
    const userRole = req.user.role?.toUpperCase();
    if (userRole === UserRole.SUPER_ADMIN || userRole === UserRole.COMPANY_ADMIN) {
      next();
      return;
    }

    // 2. Dynamic Permission Check (MongoDB Roles)
    // We prioritize the customRoleId assigned to the user
    let roleToFind = req.user.customRoleId;

    // If no customRoleId, attempt to find a system-defined role for this user's role string
    // This provides backward compatibility for users who haven't been assigned a dynamic role yet.
    if (!roleToFind && req.user.role && req.user.companyId) {
      try {
        const systemRole = await Role.findOne({ 
          companyId: req.user.companyId, 
          key: req.user.role.toUpperCase() 
        });
        if (systemRole) roleToFind = systemRole._id;
      } catch (e) {
        console.warn('Fallback role lookup failed:', e);
      }
    }

    if (roleToFind) {
      try {
        const role = await Role.findById(roleToFind);
        if (role) {
          const hasPermission = permissions.some(p => {
            // Resolve legacy string to {module, action}
            const mapped = LEGACY_PERMISSIONS[p] || (p.includes(':') ? { module: p.split(':')[0], action: p.split(':')[1] } : null);
            if (!mapped) return false;

            const modPerm = role.permissions.find(perm => perm.module === mapped.module);
            if (!modPerm) return false;

            return modPerm.actions.includes(mapped.action) || 
                   modPerm.actions.includes('manage') || 
                   modPerm.actions.includes('all');
          });

          if (hasPermission) {
            next();
            return;
          }
        }
      } catch (err) {
        console.error('RBAC Error:', err);
      }
    }

    // 3. Legacy Static Fallback (Hardcoded)
    // If no dynamic role match and no custom role found, check against standard role definitions.
    // This handles cases where roles haven't been seeded yet.
    const isDepartmentAdmin = userRole === UserRole.DEPARTMENT_ADMIN;
    const isOperator = userRole === UserRole.OPERATOR;
    const isAnalyst = userRole === UserRole.ANALYTICS_VIEWER;

    const hasStaticPermission = permissions.some(p => {
      if (isDepartmentAdmin) {
        return [
          'READ_GRIEVANCE', 'READ_APPOINTMENT', 'VIEW_ANALYTICS', 
          'UPDATE_GRIEVANCE', 'ASSIGN_GRIEVANCE', 'STATUS_CHANGE_GRIEVANCE',
          'READ_USER', 'READ_DEPARTMENT', 'CREATE_USER', 'UPDATE_USER'
        ].includes(p);
      }
      if (isOperator) {
        return ['READ_GRIEVANCE', 'READ_APPOINTMENT', 'STATUS_CHANGE_GRIEVANCE'].includes(p);
      }
      if (isAnalyst) {
        return ['VIEW_ANALYTICS', 'EXPORT_DATA'].includes(p);
      }
      return false;
    });

    if (hasStaticPermission) {
      next();
      return;
    }

    // If no custom role match, and it's not a legacy match, deny by default.
    res.status(403).json({
      success: false,
      message: 'Access denied. Dynamic role permissions not found for this action.'
    });
  };
};

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
  if (req.user.role === UserRole.SUPER_ADMIN || req.user.role === UserRole.COMPANY_ADMIN) return next();

  const departmentId = req.params.departmentId || req.body.departmentId;
  if (req.user.departmentId?.toString() !== departmentId) {
    return res.status(403).json({ success: false, message: 'Access denied to this department.' });
  }
  next();
};
