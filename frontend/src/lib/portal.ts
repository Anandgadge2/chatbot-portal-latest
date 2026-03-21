export interface PortalPermission {
  module: string;
  actions: string[];
}

export interface PortalBootstrapResponse {
  success: boolean;
  data: {
    actor: {
      id: string;
      userId: string;
      firstName: string;
      lastName: string;
      email?: string;
      phone?: string;
      role?: string;
      roleLabel?: string;
      companyId?: string | null;
      departmentId?: string | null;
      customRoleId?: string | null;
      permissions?: PortalPermission[];
      enabledModules?: string[];
      notificationSettings?: {
        email: boolean;
        whatsapp: boolean;
      };
    };
    scope: {
      type: 'admin' | 'company' | 'department' | 'subdepartment';
      companyId?: string | null;
      departmentId?: string | null;
    };
    access: {
      visibleTabs: string[];
      visibleSettingsTabs: string[];
      modules: string[];
      actions: {
        canViewUsers: boolean;
        canViewDepartments: boolean;
        canViewGrievances: boolean;
        canViewAppointments: boolean;
        canViewAnalytics: boolean;
        canManageFlows: boolean;
        canManageSettings: boolean;
        canDeleteData: boolean;
        canManageRoles: boolean;
      };
    };
    navigation: {
      entryRoute: string;
      homeRoute: string;
    };
    company: {
      _id: string;
      companyId?: string;
      name?: string;
      enabledModules?: string[];
    } | null;
    department: {
      _id: string;
      departmentId?: string;
      name?: string;
      parentDepartmentId?: string | null;
    } | null;
  };
}

export const normalizeId = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && '_id' in value) {
    const id = (value as { _id?: unknown })._id;
    return typeof id === 'string' ? id : id ? String(id) : null;
  }
  return String(value);
};

export const isSuperAdminUser = (user: any) => user?.role === 'SUPER_ADMIN';

export const getPortalHomePath = (user?: any | null) => {
  if (!user) return '/portal';
  if (isSuperAdminUser(user)) return '/portal/admin';

  const departmentId = normalizeId(user.departmentId);
  if (departmentId) return `/portal/department/${departmentId}`;

  const companyId = normalizeId(user.companyId);
  if (companyId) return `/portal/company/${companyId}`;

  return '/portal';
};

export const hasPortalPermission = (
  user: { role?: string; permissions?: PortalPermission[] } | null | undefined,
  module: string,
  actions: string[] = ['view'],
) => {
  if (!user) return false;
  if (isSuperAdminUser(user)) return true;

  const permission = user.permissions?.find((item) => item.module === module);
  if (!permission) return false;

  return actions.some(
    (action) =>
      permission.actions.includes(action) ||
      permission.actions.includes('manage') ||
      permission.actions.includes('all'),
  );
};

export const canAccessCompanyPortal = (user: any, companyId: string) => {
  if (!user) return false;
  if (isSuperAdminUser(user)) return true;
  return normalizeId(user.companyId) === companyId && !normalizeId(user.departmentId);
};

export const canManageCompanySettings = (user: any, companyId: string) => {
  if (!canAccessCompanyPortal(user, companyId)) return false;
  return isSuperAdminUser(user) || hasPortalPermission(user, 'SETTINGS', ['view', 'update', 'manage']);
};

export const canManageCompanyFlows = (user: any, companyId: string) => {
  if (!canAccessCompanyPortal(user, companyId)) return false;
  return isSuperAdminUser(user) || hasPortalPermission(user, 'FLOW_BUILDER', ['view', 'update', 'manage']);
};
