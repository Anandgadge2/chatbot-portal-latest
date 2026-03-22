import { Request } from 'express';
import mongoose from 'mongoose';
import Company from '../models/Company';
import Role, { IPermission, IRole } from '../models/Role';
import User, { IUser } from '../models/User';

export interface AuthPermission {
  module: string;
  actions: string[];
}

export interface AuthContext {
  userId: string;
  isSuperAdmin: boolean;
  companyId: string | null;
  departmentId: string | null;
  subDepartmentId: string | null;
  roleId: string | null;
  level: number;
  scope: 'platform' | 'company';
  filteredPermissions: AuthPermission[];
}

export interface ResolvedAccessContext {
  user: IUser;
  role: IRole | null;
  company: Awaited<ReturnType<typeof Company.findById>> | null;
  filteredPermissions: AuthPermission[];
}


export const isPlatformSuperAdminUser = (user: Pick<IUser, 'isSuperAdmin' | 'role'> | null | undefined): boolean => (
  Boolean(user?.isSuperAdmin) || String(user?.role || '').toUpperCase() === 'SUPER_ADMIN'
);

const normalizePermission = (permission: IPermission | AuthPermission): AuthPermission => ({
  module: permission.module,
  actions: Array.from(new Set(permission.actions || []))
});

export const filterPermissionsByModules = (
  permissions: Array<IPermission | AuthPermission>,
  enabledModules: string[] = []
): AuthPermission[] => {
  const enabled = new Set(enabledModules);

  return permissions
    .filter((permission) => !permission.module || enabled.has(permission.module))
    .map(normalizePermission);
};

export const permissionAllows = (
  permissions: AuthPermission[],
  module: string,
  action: string
): boolean => {
  const permission = permissions.find((entry) => entry.module === module);
  if (!permission) {
    return false;
  }

  return permission.actions.includes(action);
};

export const creatorPermissionsContain = (
  creatorPermissions: AuthPermission[],
  requestedPermissions: Array<IPermission | AuthPermission>
): boolean => {
  return requestedPermissions.every((requested) => {
    const creatorPermission = creatorPermissions.find((entry) => entry.module === requested.module);
    if (!creatorPermission) {
      return false;
    }

    return requested.actions.every((action) => creatorPermission.actions.includes(action));
  });
};

export const canAssignRole = async (
  assignerUser: IUser,
  targetRoleLevel: number
): Promise<boolean> => {
  if (isPlatformSuperAdminUser(assignerUser)) {
    return true;
  }

  if (!assignerUser.customRoleId) {
    return false;
  }

  const assignerRole = await Role.findById(assignerUser.customRoleId).select('level');
  if (!assignerRole) {
    return false;
  }

  return assignerRole.level < targetRoleLevel;
};

export const scopeToUser = (req: Request): Record<string, unknown> => {
  const auth = req.auth;

  if (!auth || auth.isSuperAdmin) {
    return {};
  }

  if (auth.level === 1) {
    return { companyId: auth.companyId };
  }

  if (auth.level === 2) {
    return {
      companyId: auth.companyId,
      departmentId: auth.departmentId
    };
  }

  if (auth.level === 3) {
    return {
      companyId: auth.companyId,
      departmentId: auth.departmentId,
      subDepartmentId: auth.subDepartmentId
    };
  }

  if (auth.level === 4) {
    return {
      companyId: auth.companyId,
      assignedTo: auth.userId
    };
  }

  return {
    companyId: auth.companyId
  };
};

export const buildAuthContext = (
  user: IUser,
  role: IRole | null,
  filteredPermissions: AuthPermission[]
): AuthContext => ({
  userId: user._id.toString(),
  isSuperAdmin: isPlatformSuperAdminUser(user),
  companyId: user.companyId ? user.companyId.toString() : null,
  departmentId: user.departmentId ? user.departmentId.toString() : null,
  subDepartmentId: user.subDepartmentId ? user.subDepartmentId.toString() : null,
  roleId: role ? role._id.toString() : user.customRoleId ? user.customRoleId.toString() : null,
  level: role?.level ?? 0,
  scope: role?.scope ?? (isPlatformSuperAdminUser(user) ? 'platform' : 'company'),
  filteredPermissions
});

export const resolveUserAccessContext = async (user: IUser): Promise<ResolvedAccessContext> => {
  const isPlatformSuperAdmin = isPlatformSuperAdminUser(user);

  const company = isPlatformSuperAdmin || !user.companyId
    ? null
    : await Company.findById(user.companyId).select('enabledModules isActive isSuspended');

  const role = isPlatformSuperAdmin
    ? await Role.findOne({ scope: 'platform', level: 0 })
    : user.customRoleId
      ? await Role.findById(user.customRoleId)
      : null;

  if (!isPlatformSuperAdmin && !role) {
    throw new Error('Assigned role not found');
  }

  if (!isPlatformSuperAdmin && !company) {
    throw new Error('Company not found');
  }

  if (!isPlatformSuperAdmin && role?.requiredModule) {
    const enabledModules = company?.enabledModules || [];
    if (!enabledModules.includes(role.requiredModule)) {
      const error = new Error(`Your role requires the ${role.requiredModule} module which is not enabled`);
      (error as any).statusCode = 403;
      throw error;
    }
  }

  const filteredPermissions = isPlatformSuperAdmin
    ? []
    : filterPermissionsByModules(role?.permissions || [], company?.enabledModules || []);

  return {
    user,
    role,
    company,
    filteredPermissions
  };
};

export const toObjectId = (value?: string | mongoose.Types.ObjectId | null): mongoose.Types.ObjectId | undefined => {
  if (!value) {
    return undefined;
  }

  return typeof value === 'string' ? new mongoose.Types.ObjectId(value) : value;
};

export const seedDefaultRoleDefinitions = (createdBy: mongoose.Types.ObjectId) => {
  const fullPermissions: AuthPermission[] = [
    { module: 'GRIEVANCE', actions: ['view', 'create', 'update', 'delete', 'assign', 'status_change', 'revert'] },
    { module: 'APPOINTMENT', actions: ['view', 'create', 'update', 'delete', 'status_change'] },
    { module: 'USER_MANAGEMENT', actions: ['view', 'create', 'update', 'delete'] },
    { module: 'DEPARTMENTS', actions: ['view', 'create', 'update', 'delete'] },
    { module: 'ANALYTICS', actions: ['view', 'export'] },
    { module: 'SETTINGS', actions: ['update', 'view_audit'] }
  ];

  const departmentPermissions: AuthPermission[] = [
    { module: 'GRIEVANCE', actions: ['view', 'create', 'update', 'assign', 'status_change', 'revert'] },
    { module: 'APPOINTMENT', actions: ['view', 'create', 'update', 'status_change'] },
    { module: 'USER_MANAGEMENT', actions: ['view', 'create', 'update'] },
    { module: 'DEPARTMENTS', actions: ['view', 'update'] },
    { module: 'ANALYTICS', actions: ['view'] }
  ];

  const subDepartmentPermissions: AuthPermission[] = [
    { module: 'GRIEVANCE', actions: ['view', 'update', 'assign', 'status_change'] },
    { module: 'APPOINTMENT', actions: ['view', 'update', 'status_change'] },
    { module: 'USER_MANAGEMENT', actions: ['view'] },
    { module: 'DEPARTMENTS', actions: ['view'] }
  ];

  const operatorPermissions: AuthPermission[] = [
    { module: 'GRIEVANCE', actions: ['view', 'update'] },
    { module: 'APPOINTMENT', actions: ['view', 'update'] }
  ];

  return [
    {
      level: 1,
      scope: 'company' as const,
      isSystem: true,
      name: 'Company Admin',
      permissions: fullPermissions,
      createdBy
    },
    {
      level: 2,
      scope: 'company' as const,
      isSystem: true,
      name: 'Department Admin',
      permissions: departmentPermissions,
      createdBy
    },
    {
      level: 3,
      scope: 'company' as const,
      isSystem: true,
      requiredModule: 'department_hierarchy',
      name: 'Sub Department Admin',
      permissions: subDepartmentPermissions,
      createdBy
    },
    {
      level: 4,
      scope: 'company' as const,
      isSystem: true,
      name: 'Operator',
      permissions: operatorPermissions,
      createdBy
    }
  ];
};

export const ensurePlatformSuperAdminRole = async () => {
  const existingRole = await Role.findOne({ scope: 'platform', level: 0 });
  if (existingRole) {
    return existingRole;
  }

  const superAdminUser = await User.findOne({ isSuperAdmin: true }).select('_id');
  const createdBy = superAdminUser?._id || new mongoose.Types.ObjectId();

  return Role.create({
    name: 'Platform Superadmin',
    level: 0,
    scope: 'platform',
    isSystem: true,
    permissions: [],
    createdBy
  });
};
