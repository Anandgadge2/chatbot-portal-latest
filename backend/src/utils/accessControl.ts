import mongoose from 'mongoose';
import Company from '../models/Company';
import Role, { IPermission } from '../models/Role';
import { IUser } from '../models/User';

export type AccessScope = 'platform' | 'company' | 'department' | 'subdepartment' | 'assigned';

export type ResolvedAccess = {
  isSuperAdmin: boolean;
  roleId?: string;
  roleName?: string;
  level: number;
  scope: AccessScope;
  filteredPermissions: IPermission[];
  permissionsVersion: number;
};

const SUPERADMIN_PERMISSIONS: IPermission[] = [{ module: '*', actions: ['*'] }];

const DEFAULT_PERMISSIONS_VERSION = 1;

function hasWildcardPermission(permissions: IPermission[] = [], module: string, action: string) {
  return permissions.some((permission) => {
    const moduleMatches = permission.module === '*' || permission.module === module;
    const actionMatches = permission.actions.includes('*') || permission.actions.includes(action);

    return moduleMatches && actionMatches;
  });
}

export function hasPermission(permissions: IPermission[] = [], module: string, action: string) {
  return hasWildcardPermission(permissions, module, action);
}

export function getScopeFromLevel(level: number): AccessScope {
  if (level <= 0) return 'platform';
  if (level === 1 || level >= 5) return 'company';
  if (level === 2) return 'department';
  if (level === 3) return 'subdepartment';
  return 'assigned';
}

export function scopeToUser<T extends Record<string, any>>(user: Partial<ResolvedAccess & IUser>, query: T = {} as T) {
  const scopedQuery = { ...query } as Record<string, any>;

  if (user.isSuperAdmin || user.level === 0) {
    return scopedQuery as T;
  }

  if (user.companyId) {
    scopedQuery.companyId = new mongoose.Types.ObjectId(user.companyId.toString());
  }

  if (user.level === 2 && user.departmentId) {
    scopedQuery.departmentId = new mongoose.Types.ObjectId(user.departmentId.toString());
  }

  if (user.level === 3 && (user as any).subDepartmentId) {
    scopedQuery.subDepartmentId = new mongoose.Types.ObjectId((user as any).subDepartmentId.toString());
  }

  if (user.level === 4) {
    scopedQuery.assignedTo = new mongoose.Types.ObjectId(user._id!.toString());
  }

  return scopedQuery as T;
}

export async function resolveUserAccess(user: Pick<IUser, '_id' | 'companyId' | 'departmentId' | 'customRoleId'> & Partial<IUser>): Promise<ResolvedAccess> {
  // 👑 PRIORITY: If user is explicitly flagged as SuperAdmin, return platform scope immediately
  if (user.isSuperAdmin || !user.companyId) {
    return {
      isSuperAdmin: true,
      roleId: '0',
      roleName: 'Platform Administrator',
      level: 0,
      scope: 'platform',
      filteredPermissions: SUPERADMIN_PERMISSIONS,
      permissionsVersion: DEFAULT_PERMISSIONS_VERSION,
    };
  }

  const company = await Company.findById(user.companyId)
    .select('permissionsVersion enabledModules')
    .lean();

  const permissionsVersion = typeof company?.permissionsVersion === 'number'
    ? company.permissionsVersion
    : DEFAULT_PERMISSIONS_VERSION;

  let roleId: string | undefined;
  let roleName: string | undefined = 'Department Administrator'; // Default if level is 2
  let level = (user.departmentId || (user.departmentIds && user.departmentIds.length > 0)) ? 2 : 1;

  if (level === 1) roleName = 'Company Administrator';

  let filteredPermissions: IPermission[] = [];

  if (user.customRoleId) {
    const role = await Role.findById(user.customRoleId)
      .select('_id name level permissions')
      .lean();

    if (!role) {
      const error = new Error('Assigned role no longer exists');
      (error as Error & { code?: string }).code = 'ASSIGNED_ROLE_MISSING';
      throw error;
    }

    roleId = role._id.toString();
    roleName = role.name;
    level = typeof role.level === 'number' ? role.level : Math.max(level, 5);
    
    // Check if the custom role itself is a system-level role (level 0)
    if (level === 0) {
      return {
        isSuperAdmin: true,
        roleId,
        roleName,
        level: 0,
        scope: 'platform',
        filteredPermissions: SUPERADMIN_PERMISSIONS,
        permissionsVersion,
      };
    }

    filteredPermissions = Array.isArray(role.permissions) ? role.permissions : [];

    return {
      isSuperAdmin: false,
      roleId,
      roleName,
      level,
      scope: getScopeFromLevel(level),
      filteredPermissions,
      permissionsVersion,
    };
  }

  return {
    isSuperAdmin: false,
    roleId,
    roleName,
    level,
    scope: getScopeFromLevel(level),
    filteredPermissions,
    permissionsVersion,
  };
}
