import mongoose from 'mongoose';
import Company, { ICompany } from '../models/Company';
import { getRedisClient } from '../config/redis';
import Role, { IPermission, IRole } from '../models/Role';
import { IUser } from '../models/User';


export interface AccessValidationError {
  statusCode: number;
  message: string;
}
type CompanyRBACSnapshot = Pick<ICompany, 'enabledModules' | 'isActive' | 'isSuspended' | 'permissionsVersion'> & { _id?: mongoose.Types.ObjectId | string };

export interface AccessContext {
  company: CompanyRBACSnapshot | null;
  role: IRole | null;
  filteredPermissions: IPermission[];
  level: number;
  scope: 'platform' | 'company';
  requiredModuleMissing: boolean;
  roleMissing: boolean;
}

export interface ScopedUser {
  isSuperAdmin?: boolean;
  companyId?: mongoose.Types.ObjectId | string | null;
  departmentId?: mongoose.Types.ObjectId | string | null;
  subDepartmentId?: mongoose.Types.ObjectId | string | null;
  level?: number | null;
  _id?: mongoose.Types.ObjectId | string;
}

const normalizeModuleKey = (value?: string | null): string => String(value || '').trim().toUpperCase();

const hasLegacySuperAdminFlag = (user: { isSuperAdmin?: boolean; role?: string }): boolean => {
  return user.isSuperAdmin || user.role === 'SUPER_ADMIN';
};

const RBAC_CACHE_TTL_SECONDS = 300;

const getCompanyRBACCacheKey = (companyId: string) => `company:${companyId}:rbac`;

const getCompanyRBACSnapshot = async (companyId: string): Promise<CompanyRBACSnapshot | null> => {
  const redis = getRedisClient();
  const cacheKey = getCompanyRBACCacheKey(companyId);

  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as CompanyRBACSnapshot;
      }
    } catch (err) {
      console.error('REDIS_FAIL', err);
    }
  }

  const company = await Company.findById(companyId).select('enabledModules isActive isSuspended permissionsVersion');
  if (!company) {
    return null;
  }

  const snapshot: CompanyRBACSnapshot = {
    _id: company._id,
    enabledModules: company.enabledModules || [],
    isActive: company.isActive,
    isSuspended: company.isSuspended,
    permissionsVersion: company.permissionsVersion || 1
  };

  if (redis) {
    try {
      await redis.set(cacheKey, JSON.stringify(snapshot), 'EX', RBAC_CACHE_TTL_SECONDS);
    } catch (err) {
      console.error('REDIS_FAIL', err);
    }
  }

  return snapshot;
};

export const invalidateCompanyRBACCache = async (companyId?: string | mongoose.Types.ObjectId | null): Promise<void> => {
  if (!companyId) return;
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.del(getCompanyRBACCacheKey(companyId.toString()));
  } catch (err) {
    console.error('REDIS_FAIL', err);
  }
};

export const normalizePermissions = (permissions: unknown): IPermission[] => {
  if (!Array.isArray(permissions)) {
    return [];
  }

  const normalized = permissions
    .filter((permission): permission is IPermission => Boolean(permission && typeof permission === 'object'))
    .map((permission) => ({
      module: normalizeModuleKey(permission.module),
      actions: Array.from(
        new Set(
          Array.isArray(permission.actions)
            ? permission.actions
                .filter((action): action is string => typeof action === 'string' && action.trim().length > 0)
                .map((action) => action.trim().toLowerCase())
            : []
        )
      )
    }))
    .filter((permission) => permission.module.length > 0);

  const byModule = new Map<string, Set<string>>();
  for (const permission of normalized) {
    const actions = byModule.get(permission.module) || new Set<string>();
    permission.actions.forEach((action) => actions.add(action));
    byModule.set(permission.module, actions);
  }

  return Array.from(byModule.entries()).map(([module, actions]) => ({
    module,
    actions: Array.from(actions)
  }));
};

export const filterPermissionsByModules = (
  permissions: IPermission[],
  enabledModules: string[] = []
): IPermission[] => {
  const enabled = new Set(enabledModules.map((module) => normalizeModuleKey(module)).filter(Boolean));

  return normalizePermissions(permissions).filter((permission) => {
    if (permission.module === '*' || permission.module === 'SETTINGS' || permission.module === 'USER_MANAGEMENT' || permission.module === 'DEPARTMENTS' || permission.module === 'ANALYTICS') {
      return true;
    }

    return enabled.size === 0 || enabled.has(permission.module);
  });
};

export const hasPermission = (
  filteredPermissions: IPermission[] = [],
  module: string,
  action: string
): boolean => {
  const normalizedModule = normalizeModuleKey(module);
  const normalizedAction = action.trim().toLowerCase();
  return normalizePermissions(filteredPermissions).some((permission) => {
    if (permission.module !== '*' && permission.module !== normalizedModule) {
      return false;
    }

    return permission.actions.includes('*')
      || permission.actions.includes(normalizedAction)
      || permission.actions.includes('manage')
      || permission.actions.includes('all');
  });
};

export async function resolveAccessContext(user: Pick<IUser, 'isSuperAdmin' | 'customRoleId' | 'companyId' | 'role'>): Promise<AccessContext> {
  const company = user.companyId ? await getCompanyRBACSnapshot(user.companyId.toString()) : null;
  const isSuperAdmin = hasLegacySuperAdminFlag(user);

  if (isSuperAdmin) {
    return {
      company,
      role: null,
      filteredPermissions: [],
      level: 0,
      scope: 'platform',
      requiredModuleMissing: false,
      roleMissing: false
    };
  }

  const role = user.customRoleId ? await Role.findById(user.customRoleId) : null;
  const filteredPermissions = filterPermissionsByModules(role?.permissions || [], company?.enabledModules || []);
  const requiredModule = normalizeModuleKey(role?.requiredModule);

  return {
    company,
    role,
    filteredPermissions,
    level: typeof role?.level === 'number' ? role.level : Number.MAX_SAFE_INTEGER,
    scope: role?.scope === 'platform' ? 'platform' : 'company',
    requiredModuleMissing: Boolean(requiredModule && !new Set((company?.enabledModules || []).map((module) => normalizeModuleKey(module))).has(requiredModule)),
    roleMissing: Boolean(user.customRoleId && !role)
  };
}

export const scopeToUser = (user: ScopedUser): Record<string, unknown> => {
  if (hasLegacySuperAdminFlag(user)) {
    return {};
  }

  const level = Number(user.level ?? Number.MAX_SAFE_INTEGER);

  if (level === 1) {
    return user.companyId ? { companyId: user.companyId } : {};
  }

  if (level === 2) {
    return {
      ...(user.companyId ? { companyId: user.companyId } : {}),
      ...(user.departmentId ? { departmentId: user.departmentId } : {})
    };
  }

  if (level === 3) {
    return {
      ...(user.companyId ? { companyId: user.companyId } : {}),
      ...(user.departmentId ? { departmentId: user.departmentId } : {}),
      ...(user.subDepartmentId ? { subDepartmentId: user.subDepartmentId } : {})
    };
  }

  if (level === 4) {
    return {
      ...(user.companyId ? { companyId: user.companyId } : {}),
      assignedTo: user._id
    };
  }

  return user.companyId ? { companyId: user.companyId } : {};
};

export const canAssignRole = (
  assigner: Pick<ScopedUser, 'isSuperAdmin' | 'level'>,
  targetLevel: number
): boolean => {
  if (assigner.isSuperAdmin) {
    return true;
  }

  if (typeof assigner.level !== 'number') {
    return false;
  }

  return targetLevel > assigner.level;
};

export const isPermissionSubset = (
  creatorPermissions: IPermission[] = [],
  candidatePermissions: IPermission[] = []
): boolean => {
  const creatorPermissionMap = new Map<string, Set<string>>();

  for (const permission of normalizePermissions(creatorPermissions)) {
    creatorPermissionMap.set(permission.module, new Set(permission.actions));
  }

  for (const permission of normalizePermissions(candidatePermissions)) {
    const allowedActions = creatorPermissionMap.get(permission.module);
    if (!allowedActions) {
      return false;
    }

    if (allowedActions.has('all') || allowedActions.has('manage')) {
      continue;
    }

    for (const action of permission.actions) {
      if (!allowedActions.has(action)) {
        return false;
      }
    }
  }

  return true;
};

export async function getNextRoleLevel(companyId: string | mongoose.Types.ObjectId): Promise<number> {
  const highestRole = await Role.findOne({ companyId, scope: 'company' }).sort({ level: -1 }).select('level');
  const highestLevel = typeof highestRole?.level === 'number' ? highestRole.level : 4;
  return highestLevel + 1;
}

const COMPANY_ROLE_MODULES = [
  'USER_MANAGEMENT',
  'DEPARTMENTS',
  'ANALYTICS',
  'SETTINGS',
  'GRIEVANCE',
  'APPOINTMENT',
  'LEAD_CAPTURE',
  'FLOW_BUILDER',
  'DASHBOARD'
];

const buildDefaultPermissions = (enabledModules: string[], level: number): IPermission[] => {
  const modules = Array.from(new Set([...COMPANY_ROLE_MODULES, ...enabledModules.map((module) => normalizeModuleKey(module)).filter(Boolean)]));

  const actionSets: Record<number, string[]> = {
    1: ['view', 'create', 'update', 'delete', 'assign', 'export', 'status_change', 'revert', 'manage', 'all'],
    2: ['view', 'create', 'update', 'assign', 'export', 'status_change', 'manage'],
    3: ['view', 'create', 'update', 'assign', 'status_change'],
    4: ['view', 'update']
  };

  return modules.map((module) => ({
    module,
    actions: actionSets[level] || ['view']
  }));
};

export async function seedDefaultRoles(
  companyId: mongoose.Types.ObjectId,
  createdBy: mongoose.Types.ObjectId,
  enabledModules: string[] = []
): Promise<IRole[]> {
  const defaults = [
    { level: 1, name: 'Company Admin', description: 'Default company-wide administrator role' },
    { level: 2, name: 'Department Admin', description: 'Default department-level administrator role' },
    { level: 3, name: 'Sub Department Admin', description: 'Default sub-department administrator role' },
    { level: 4, name: 'Assigned User', description: 'Default assigned-data operator role' }
  ];

  const seededRoles: IRole[] = [];

  for (const roleDefinition of defaults) {
    const role = await Role.findOneAndUpdate(
      { companyId, level: roleDefinition.level },
      {
        $setOnInsert: {
          companyId,
          name: roleDefinition.name,
          description: roleDefinition.description,
          level: roleDefinition.level,
          scope: 'company',
          isSystem: true,
          permissions: buildDefaultPermissions(enabledModules, roleDefinition.level),
          createdBy
        }
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    );

    seededRoles.push(role);
  }

  return seededRoles;
}

export const getAccessValidationError = (
  user: Pick<IUser, 'isSuperAdmin' | 'companyId' | 'role'>,
  accessContext: AccessContext
): AccessValidationError | null => {
  if (hasLegacySuperAdminFlag(user)) {
    return null;
  }

  if (!user.companyId || !accessContext.company) {
    return { statusCode: 403, message: 'Company account not found.' };
  }

  if (!accessContext.company.isActive) {
    return { statusCode: 403, message: 'Company account is inactive.' };
  }

  if (accessContext.company.isSuspended) {
    return { statusCode: 403, message: 'Company account is suspended.' };
  }

  if (accessContext.roleMissing) {
    return { statusCode: 403, message: 'Assigned role no longer exists' };
  }

  if (!accessContext.role) {
    return { statusCode: 403, message: 'No role assigned to this user.' };
  }

  if (accessContext.requiredModuleMissing) {
    return { statusCode: 403, message: 'Required module is not enabled for this company.' };
  }

  return null;
};
