// ================================
// USER ROLES
// ================================

export const UserRole = {
  SUPER_ADMIN: 'SUPER_ADMIN'
};

export type UserRoleType = typeof UserRole[keyof typeof UserRole] | string;

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

export const Module = {
  GRIEVANCE: 'GRIEVANCE',
  APPOINTMENT: 'APPOINTMENT',
  DOCUMENT_UPLOAD: 'DOCUMENT_UPLOAD',
  GEO_LOCATION: 'GEO_LOCATION',
  INCIDENT_WILDLIFE: 'INCIDENT_WILDLIFE',
  AUTO_NOTIFICATION: 'AUTO_NOTIFICATION',
  EMAIL_NOTIFICATION: 'EMAIL_NOTIFICATION',
  REPORT_DOWNLOAD: 'REPORT_DOWNLOAD',
  CUSTOMER_SUPPORT: 'CUSTOMER_SUPPORT',
  ASSIGNMENT_WHATSAPP: 'ASSIGNMENT_WHATSAPP',
  STATUS_UPDATE_WHATSAPP: 'STATUS_UPDATE_WHATSAPP',
  COMPANY_INFO: 'COMPANY_INFO',
  STATUS_TRACKING: 'STATUS_TRACKING',
  LEAD_CAPTURE: 'LEAD_CAPTURE',
  HIERARCHICAL_DEPARTMENTS: 'HIERARCHICAL_DEPARTMENTS'
};

export type ModuleType = typeof Module[keyof typeof Module] | string;


// ================================
// GRIEVANCE STATUS
// ================================

export enum GrievanceStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  REVERTED = 'REVERTED',
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
  CONFIG_CHANGE = 'CONFIG_CHANGE',
  WHATSAPP_MSG = 'WHATSAPP_MSG'
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

// ================================
// PERMISSIONS (Legacy Mapping)
// ================================

export const Permission = {
  // User Management
  READ_USER: 'READ_USER',
  CREATE_USER: 'CREATE_USER',
  UPDATE_USER: 'UPDATE_USER',
  DELETE_USER: 'DELETE_USER',

  // Department Management
  READ_DEPARTMENT: 'READ_DEPARTMENT',
  CREATE_DEPARTMENT: 'CREATE_DEPARTMENT',
  UPDATE_DEPARTMENT: 'UPDATE_DEPARTMENT',
  DELETE_DEPARTMENT: 'DELETE_DEPARTMENT',

  // Grievance Management
  READ_GRIEVANCE: 'READ_GRIEVANCE',
  CREATE_GRIEVANCE: 'CREATE_GRIEVANCE',
  UPDATE_GRIEVANCE: 'UPDATE_GRIEVANCE',
  DELETE_GRIEVANCE: 'DELETE_GRIEVANCE',
  ASSIGN_GRIEVANCE: 'ASSIGN_GRIEVANCE',
  STATUS_CHANGE_GRIEVANCE: 'STATUS_CHANGE_GRIEVANCE',

  // Appointment Management
  READ_APPOINTMENT: 'READ_APPOINTMENT',
  CREATE_APPOINTMENT: 'CREATE_APPOINTMENT',
  UPDATE_APPOINTMENT: 'UPDATE_APPOINTMENT',
  DELETE_APPOINTMENT: 'DELETE_APPOINTMENT',
  STATUS_CHANGE_APPOINTMENT: 'STATUS_CHANGE_APPOINTMENT',

  // Analytics & Logs
  VIEW_ANALYTICS: 'VIEW_ANALYTICS',
  VIEW_AUDIT_LOGS: 'VIEW_AUDIT_LOGS',
  EXPORT_DATA: 'EXPORT_DATA',
  EXPORT_ALL_DATA: 'EXPORT_ALL_DATA',
  IMPORT_DATA: 'IMPORT_DATA'
};

export const IMPORT_EXPORT = {
  MAX_ROWS_PER_IMPORT: 10000,
  BATCH_SIZE: 500,
  SUPPORTED_FORMATS: ['xlsx', 'csv']
};
