// ================================
// USER ROLES
// ================================

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  COMPANY_ADMIN = 'COMPANY_ADMIN',
  DEPARTMENT_ADMIN = 'DEPARTMENT_ADMIN',
  OPERATOR = 'OPERATOR',
  ANALYTICS_VIEWER = 'ANALYTICS_VIEWER'
}

// ================================
// COMPANY TYPES
// ================================

export enum CompanyType {
  GOVERNMENT = 'GOVERNMENT',
  CUSTOM_ENTERPRISE = 'CUSTOM_ENTERPRISE'
}

// ================================
// MODULES
// ================================

export enum Module {
  GRIEVANCE = 'GRIEVANCE',
  APPOINTMENT = 'APPOINTMENT',
  STATUS_TRACKING = 'STATUS_TRACKING',
  RTS = 'RTS', // Right to Service
  DOCUMENT_UPLOAD = 'DOCUMENT_UPLOAD',
  GEO_LOCATION = 'GEO_LOCATION',
  MULTI_LANGUAGE = 'MULTI_LANGUAGE'
}

// ================================
// PERMISSIONS
// ================================

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
  STATUS_CHANGE_GRIEVANCE = 'STATUS_CHANGE_GRIEVANCE', // For operators - status and comments only
  
  // Appointment Management
  CREATE_APPOINTMENT = 'CREATE_APPOINTMENT',
  READ_APPOINTMENT = 'READ_APPOINTMENT',
  UPDATE_APPOINTMENT = 'UPDATE_APPOINTMENT',
  DELETE_APPOINTMENT = 'DELETE_APPOINTMENT',
  STATUS_CHANGE_APPOINTMENT = 'STATUS_CHANGE_APPOINTMENT', // For operators - status and comments only
  
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

// ================================
// ROLE PERMISSIONS MAPPING
// ================================

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
    Permission.CREATE_GRIEVANCE,
    Permission.READ_GRIEVANCE,
    Permission.UPDATE_GRIEVANCE,
    // DELETE_GRIEVANCE removed - Super Admin only
    Permission.ASSIGN_GRIEVANCE,
    Permission.STATUS_CHANGE_GRIEVANCE,
    Permission.CREATE_APPOINTMENT,
    Permission.READ_APPOINTMENT,
    Permission.UPDATE_APPOINTMENT,
    // DELETE_APPOINTMENT removed - Super Admin only
    Permission.STATUS_CHANGE_APPOINTMENT,
    Permission.VIEW_ANALYTICS,
    Permission.EXPORT_DATA,
    Permission.IMPORT_DATA,
    Permission.CONFIGURE_CHATBOT,
    Permission.MANAGE_SETTINGS
  ],
  
  [UserRole.DEPARTMENT_ADMIN]: [
    Permission.CREATE_DEPARTMENT,
    Permission.READ_DEPARTMENT,
    Permission.UPDATE_DEPARTMENT,
    Permission.CREATE_USER,
    Permission.READ_USER,
    Permission.UPDATE_USER,
    Permission.DELETE_USER,
    Permission.CREATE_GRIEVANCE,
    Permission.READ_GRIEVANCE,
    Permission.UPDATE_GRIEVANCE,
    // DELETE_GRIEVANCE removed - Super Admin only
    Permission.ASSIGN_GRIEVANCE,
    Permission.STATUS_CHANGE_GRIEVANCE,
    Permission.CREATE_APPOINTMENT,
    Permission.READ_APPOINTMENT,
    Permission.UPDATE_APPOINTMENT,
    // DELETE_APPOINTMENT removed - Super Admin only
    Permission.STATUS_CHANGE_APPOINTMENT,
    Permission.VIEW_ANALYTICS,
    Permission.EXPORT_DATA
  ],
  
  [UserRole.OPERATOR]: [
    Permission.READ_GRIEVANCE,
    Permission.STATUS_CHANGE_GRIEVANCE, // Only status and comments, not full update
    Permission.READ_APPOINTMENT,
    Permission.STATUS_CHANGE_APPOINTMENT, // Only status and comments, not full update
    Permission.VIEW_ANALYTICS, // For viewing dashboard statistics
    Permission.READ_DEPARTMENT, // For viewing department information
    Permission.READ_USER // For viewing users in their department
  ],
  
  [UserRole.ANALYTICS_VIEWER]: [
    Permission.READ_GRIEVANCE,
    Permission.READ_DEPARTMENT, // For viewing department information
    Permission.READ_USER,
    Permission.READ_APPOINTMENT, // For viewing appointments in their department
    Permission.VIEW_ANALYTICS,
    Permission.EXPORT_DATA
  ]
};

// ================================
// GRIEVANCE STATUS
// ================================

export enum GrievanceStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  RESOLVED = 'RESOLVED',
  REJECTED = 'REJECTED'
}

// ================================
// APPOINTMENT STATUS
// ================================

export enum AppointmentStatus {
  REQUESTED = 'REQUESTED', // Citizen requested appointment, waiting for admin approval
  SCHEDULED = 'SCHEDULED', // Admin scheduled the appointment
  CONFIRMED = 'CONFIRMED', // Appointment confirmed by admin
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

// ================================
// LEAD STATUS
// ================================

export enum LeadStatus {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  QUALIFIED = 'QUALIFIED',
  CONVERTED = 'CONVERTED',
  LOST = 'LOST'
}

// ================================
// AUDIT ACTION TYPES
// ================================

export enum AuditAction {
  CREATE = 'CREATE',
  READ = 'READ',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  IMPORT = 'IMPORT',
  EXPORT = 'EXPORT',
  RECOVER = 'RECOVER',
  ASSIGN = 'ASSIGN',
  STATUS_CHANGE = 'STATUS_CHANGE',
  CONFIG_CHANGE = 'CONFIG_CHANGE'
}

// ================================
// NOTIFICATION TYPES
// ================================

export enum NotificationType {
  EMAIL = 'EMAIL',
  WHATSAPP = 'WHATSAPP',
}

// ================================
// SLA CONFIGURATIONS (in hours)
// ================================

export const SLA_CONFIG = {
  [GrievanceStatus.PENDING]: 24, // Must be assigned within 24 hours
  [GrievanceStatus.ASSIGNED]: 120, // Must be resolved within 5 days
};

// ================================
// PAGINATION DEFAULTS
// ================================

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100
};

// ================================
// FILE UPLOAD LIMITS
// ================================

export const UPLOAD_LIMITS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
};

// ================================
// IMPORT/EXPORT LIMITS
// ================================

export const IMPORT_EXPORT = {
  MAX_ROWS_PER_IMPORT: 10000,
  BATCH_SIZE: 500,
  SUPPORTED_FORMATS: ['xlsx', 'csv']
};
