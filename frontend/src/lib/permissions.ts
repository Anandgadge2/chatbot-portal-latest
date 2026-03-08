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

export const UserRole = {
  SUPER_ADMIN: 'SUPER_ADMIN'
};

export type UserRoleType = typeof UserRole[keyof typeof UserRole] | string;

export enum Module {
  // Core Service Modules
  GRIEVANCE = 'GRIEVANCE',                                    // Government grievance management (consolidated)
  APPOINTMENT = 'APPOINTMENT',                                // CEO/Official appointment booking (consolidated)
  DOCUMENT_UPLOAD = 'DOCUMENT_UPLOAD',                        // Document upload support
  GEO_LOCATION = 'GEO_LOCATION',                             // Geolocation tracking
  INCIDENT_WILDLIFE = 'INCIDENT_WILDLIFE',                    // Wildlife/Forest incident reporting
  
  // Notification & Communication Modules
  AUTO_NOTIFICATION = 'AUTO_NOTIFICATION',                    // Auto-notify department heads on creation
  EMAIL_NOTIFICATION = 'EMAIL_NOTIFICATION',                  // Email notifications for status/assignment updates
  
  // Advanced Features
  REPORT_DOWNLOAD = 'REPORT_DOWNLOAD',                        // Download reports from external PHP APIs
  CUSTOMER_SUPPORT = 'CUSTOMER_SUPPORT',                      // Customer support module
  ASSIGNMENT_WHATSAPP = 'ASSIGNMENT_WHATSAPP',               // WhatsApp-based assignment management
  STATUS_UPDATE_WHATSAPP = 'STATUS_UPDATE_WHATSAPP',         // Status update with remarks & documents via WhatsApp
  COMPANY_INFO = 'COMPANY_INFO',                             // Company information and FAQs
  
  // Utility Modules
  STATUS_TRACKING = 'STATUS_TRACKING',                        // Status tracking by reference number
  LEAD_CAPTURE = 'LEAD_CAPTURE',                             // Lead capture for enterprises
  HIERARCHICAL_DEPARTMENTS = 'HIERARCHICAL_DEPARTMENTS'       // Hierarchical department structure
  
  // Note: MULTI_LANGUAGE is always enabled by default and not a selectable module
}

// Role permissions mapping - must match backend
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  [UserRole.SUPER_ADMIN]: Object.values(Permission)
};

// Mapping of legacy Permission identifiers to new Module/Action structure.
// This allows the frontend to check permissions against both old static roles
// and new dynamic roles defined in the database.
export const LEGACY_TO_DYNAMIC: Record<string, { module: string; action: string }> = {
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

/**
 * Check if user has a specific permission
 */
export function hasPermission(user: any, permission: Permission): boolean {
  if (!user) return false;
  const userRole = user.role;
  
  if (userRole === UserRole.SUPER_ADMIN) {
    return true; // SuperAdmin has all permissions
  }

  // 1. Check Dynamic Permissions if available
  if (user.permissions && Array.isArray(user.permissions)) {
    const mapped = LEGACY_TO_DYNAMIC[permission];
    if (mapped) {
      const modPerm = user.permissions.find((p: any) => p.module === mapped.module);
      if (modPerm) {
        return modPerm.actions.includes(mapped.action) || 
               modPerm.actions.includes('manage') || 
               modPerm.actions.includes('all');
      }
      // If module is present but action isn't, deny dynamic check
      return false;
    }
  }
  
  // 2. Fallback to Static Permissions (SUPER_ADMIN only)
  if (userRole === UserRole.SUPER_ADMIN) {
    return true;
  }

  const rolePermissions = ROLE_PERMISSIONS[userRole as string] || [];
  return rolePermissions.includes(permission);
}

/**
 * Check if user has any of the specified permissions
 */
export function hasAnyPermission(user: any, permissions: Permission[]): boolean {
  if (!user) return false;
  return permissions.some(permission => hasPermission(user, permission));
}

/**
 * Check if user has all of the specified permissions
 */
export function hasAllPermissions(user: any, permissions: Permission[]): boolean {
  if (!user) return false;
  return permissions.every(permission => hasPermission(user, permission));
}

/**
 * Check if user is SuperAdmin
 */
export function isSuperAdmin(userRole: string): boolean {
  return userRole === 'SUPER_ADMIN';
}

/**
 * Check if user is CompanyAdmin or higher
 */
export function isCompanyAdminOrHigher(userRole: string): boolean {
  return userRole === UserRole.SUPER_ADMIN;
}

/**
 * Check if user is DepartmentAdmin or higher
 */
export function isDepartmentAdminOrHigher(userRole: string): boolean {
  return userRole === UserRole.SUPER_ADMIN;
}
