// Permission checking utility for frontend
// This mirrors the backend Permission enum and ROLE_PERMISSIONS mapping

export enum Permission {
  // Company Management
  CREATE_COMPANY = 'CREATE_COMPANY',
  READ_COMPANY = 'READ_COMPANY',
  UPDATE_COMPANY = 'UPDATE_COMPANY',
  DELETE_COMPANY = 'DELETE_COMPANY',
  
  // Department Management
  CREATE_DEPARTMENT = 'CREATE_DEPARTMENT',
  READ_DEPARTMENT = 'READ_DEPARTMENT',
  UPDATE_DEPARTMENT = 'UPDATE_DEPARTMENT',
  DELETE_DEPARTMENT = 'DELETE_DEPARTMENT',
  
  // User Management
  CREATE_USER = 'CREATE_USER',
  READ_USER = 'READ_USER',
  UPDATE_USER = 'UPDATE_USER',
  DELETE_USER = 'DELETE_USER',
  
  // Grievance Management
  CREATE_GRIEVANCE = 'CREATE_GRIEVANCE',
  READ_GRIEVANCE = 'READ_GRIEVANCE',
  UPDATE_GRIEVANCE = 'UPDATE_GRIEVANCE',
  DELETE_GRIEVANCE = 'DELETE_GRIEVANCE',
  ASSIGN_GRIEVANCE = 'ASSIGN_GRIEVANCE',
  
  // Appointment Management
  CREATE_APPOINTMENT = 'CREATE_APPOINTMENT',
  READ_APPOINTMENT = 'READ_APPOINTMENT',
  UPDATE_APPOINTMENT = 'UPDATE_APPOINTMENT',
  DELETE_APPOINTMENT = 'DELETE_APPOINTMENT',
  
  // Analytics
  VIEW_ANALYTICS = 'VIEW_ANALYTICS',
  EXPORT_DATA = 'EXPORT_DATA',
  
  // Import/Export
  IMPORT_DATA = 'IMPORT_DATA',
  EXPORT_ALL_DATA = 'EXPORT_ALL_DATA',
  
  // Audit Logs
  VIEW_AUDIT_LOGS = 'VIEW_AUDIT_LOGS',
  
  // Chatbot Configuration
  CONFIGURE_CHATBOT = 'CONFIGURE_CHATBOT',
  
  // System Settings
  MANAGE_SETTINGS = 'MANAGE_SETTINGS',
  
  // Recovery
  RECOVER_DELETED = 'RECOVER_DELETED'
}

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  COMPANY_ADMIN = 'COMPANY_ADMIN',
  DEPARTMENT_ADMIN = 'DEPARTMENT_ADMIN',
  OPERATOR = 'OPERATOR',
  ANALYTICS_VIEWER = 'ANALYTICS_VIEWER'
}

// Role permissions mapping - must match backend
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: Object.values(Permission), // All permissions
  
  [UserRole.COMPANY_ADMIN]: [
    Permission.READ_COMPANY,
    Permission.UPDATE_COMPANY,
    Permission.CREATE_DEPARTMENT,
    Permission.READ_DEPARTMENT,
    Permission.UPDATE_DEPARTMENT,
    Permission.DELETE_DEPARTMENT,
    Permission.CREATE_USER,
    Permission.READ_USER,
    Permission.UPDATE_USER,
    Permission.DELETE_USER,
    Permission.READ_GRIEVANCE,
    Permission.UPDATE_GRIEVANCE,
    Permission.ASSIGN_GRIEVANCE,
    Permission.READ_APPOINTMENT,
    Permission.UPDATE_APPOINTMENT,
    Permission.VIEW_ANALYTICS,
    Permission.EXPORT_DATA,
    Permission.IMPORT_DATA,
    Permission.CONFIGURE_CHATBOT,
    Permission.MANAGE_SETTINGS
  ],
  
  [UserRole.DEPARTMENT_ADMIN]: [
    Permission.READ_DEPARTMENT,
    Permission.UPDATE_DEPARTMENT,
    Permission.CREATE_USER,
    Permission.READ_USER,
    Permission.UPDATE_USER,
    Permission.DELETE_USER,
    Permission.READ_GRIEVANCE,
    Permission.UPDATE_GRIEVANCE,
    Permission.ASSIGN_GRIEVANCE,
    Permission.READ_APPOINTMENT,
    Permission.UPDATE_APPOINTMENT,
    Permission.VIEW_ANALYTICS,
    Permission.EXPORT_DATA
  ],
  
  [UserRole.OPERATOR]: [
    Permission.READ_GRIEVANCE,
    Permission.UPDATE_GRIEVANCE,
    Permission.READ_APPOINTMENT,
    Permission.UPDATE_APPOINTMENT,
    Permission.VIEW_ANALYTICS, // For viewing dashboard statistics
    Permission.READ_DEPARTMENT, // For viewing department information
    Permission.READ_USER // For viewing users in their department
  ],
  
  [UserRole.ANALYTICS_VIEWER]: [
    Permission.VIEW_ANALYTICS,
    Permission.EXPORT_DATA
  ]
};

/**
 * Check if user has a specific permission
 */
export function hasPermission(userRole: UserRole | string, permission: Permission): boolean {
  if (userRole === UserRole.SUPER_ADMIN) {
    return true; // SuperAdmin has all permissions
  }
  
  const rolePermissions = ROLE_PERMISSIONS[userRole as UserRole] || [];
  return rolePermissions.includes(permission);
}

/**
 * Check if user has any of the specified permissions
 */
export function hasAnyPermission(userRole: UserRole | string, permissions: Permission[]): boolean {
  if (userRole === UserRole.SUPER_ADMIN) {
    return true;
  }
  
  const rolePermissions = ROLE_PERMISSIONS[userRole as UserRole] || [];
  return permissions.some(permission => rolePermissions.includes(permission));
}

/**
 * Check if user has all of the specified permissions
 */
export function hasAllPermissions(userRole: UserRole | string, permissions: Permission[]): boolean {
  if (userRole === UserRole.SUPER_ADMIN) {
    return true;
  }
  
  const rolePermissions = ROLE_PERMISSIONS[userRole as UserRole] || [];
  return permissions.every(permission => rolePermissions.includes(permission));
}

/**
 * Check if user is SuperAdmin
 */
export function isSuperAdmin(userRole: UserRole | string): boolean {
  return userRole === UserRole.SUPER_ADMIN;
}

/**
 * Check if user is CompanyAdmin or higher
 */
export function isCompanyAdminOrHigher(userRole: UserRole | string): boolean {
  return userRole === UserRole.SUPER_ADMIN || userRole === UserRole.COMPANY_ADMIN;
}

/**
 * Check if user is DepartmentAdmin or higher
 */
export function isDepartmentAdminOrHigher(userRole: UserRole | string): boolean {
  return userRole === UserRole.SUPER_ADMIN || 
         userRole === UserRole.COMPANY_ADMIN || 
         userRole === UserRole.DEPARTMENT_ADMIN;
}
