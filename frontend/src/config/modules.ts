import { Module } from '@/lib/permissions';

export interface ModuleConfig {
  id: Module;
  name: string;
  description: string;
  icon?: string; // Optional icon name/path
}

export const AVAILABLE_MODULES: ModuleConfig[] = [
  // ========================================
  // CORE SERVICE MODULES
  // ========================================
  { 
    id: Module.GRIEVANCE, 
    name: '🏛️ Grievance Management', 
    description: 'Enable citizens to raise grievances for government services with department routing' 
  },
  { 
    id: Module.APPOINTMENT, 
    name: '📅 Appointment Booking', 
    description: 'Allow appointment booking with CEO or officials directly' 
  },
  { 
    id: Module.DOCUMENT_UPLOAD, 
    name: '📄 Document Upload', 
    description: 'Enable document and image uploads via WhatsApp (PDF, images, etc.)' 
  },
  { 
    id: Module.GEO_LOCATION, 
    name: '📍 Geo Location', 
    description: 'Capture and track GPS coordinates and addresses for location-based services' 
  },
  { 
    id: Module.INCIDENT_WILDLIFE, 
    name: '🦁 Wildlife Incident Reporting', 
    description: 'Report wildlife/forest incidents with location tracking and urgent routing' 
  },
  
  // ========================================
  // NOTIFICATION & COMMUNICATION MODULES
  // ========================================
  { 
    id: Module.AUTO_NOTIFICATION, 
    name: '🔔 Auto Department Notification', 
    description: 'Automatically notify department heads when grievances/incidents are raised' 
  },
  { 
    id: Module.EMAIL_NOTIFICATION, 
    name: '📧 Email Notifications', 
    description: 'Send email notifications for status updates, assignments, and important events' 
  },
  
  // ========================================
  // ADVANCED FEATURES
  // ========================================
  { 
    id: Module.REPORT_DOWNLOAD, 
    name: '📊 Report Download (External API)', 
    description: 'Generate and download reports from external PHP systems via API integration' 
  },
  { 
    id: Module.CUSTOMER_SUPPORT, 
    name: '💬 Customer Support', 
    description: 'Dedicated customer support module with ticket management and FAQs' 
  },
  { 
    id: Module.ASSIGNMENT_WHATSAPP, 
    name: '👤 WhatsApp Assignment', 
    description: 'Allow admins to assign grievances/tasks directly via WhatsApp interface' 
  },
  { 
    id: Module.STATUS_UPDATE_WHATSAPP, 
    name: '✅ WhatsApp Status Update', 
    description: 'Update status with remarks and supporting documents directly from WhatsApp' 
  },
  { 
    id: Module.COMPANY_INFO, 
    name: 'ℹ️ Company Information', 
    description: 'Provide company details, FAQs, and general information to users' 
  },
  
  // ========================================
  // UTILITY MODULES
  // ========================================
  { 
    id: Module.STATUS_TRACKING, 
    name: '🔍 Status Tracking', 
    description: 'Track grievance and appointment status using reference numbers' 
  },
  { 
    id: Module.LEAD_CAPTURE, 
    name: '🎯 Lead Capture', 
    description: 'Capture and manage business leads for sales and marketing' 
  },
  { 
    id: Module.HIERARCHICAL_DEPARTMENTS, 
    name: '🏢 Hierarchical Departments', 
    description: 'Enable parent-child department relationships and sub-department routing' 
  }
  
  // Note: MULTI_LANGUAGE is always enabled by default for all companies and is not a selectable module
];
