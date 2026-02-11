import { Module } from '@/lib/permissions';

export interface ModuleConfig {
  id: Module;
  name: string;
  description: string;
  icon?: string; // Optional icon name/path
}

export const AVAILABLE_MODULES: ModuleConfig[] = [
  { 
    id: Module.GRIEVANCE, 
    name: 'Grievance Management', 
    description: 'Handle citizen complaints and grievances' 
  },
  { 
    id: Module.APPOINTMENT, 
    name: 'Appointment Booking', 
    description: 'Schedule and manage appointments' 
  },
  { 
    id: Module.STATUS_TRACKING, 
    name: 'Status Tracking', 
    description: 'Track application and request status' 
  },
  { 
    id: Module.LEAD_CAPTURE, 
    name: 'Lead Capture', 
    description: 'Capture and manage leads' 
  },
  { 
    id: Module.DOCUMENT_UPLOAD, 
    name: 'Document Upload', 
    description: 'Allow document uploads' 
  },
  { 
    id: Module.GEO_LOCATION, 
    name: 'Geo Location', 
    description: 'Location-based services' 
  },
  { 
    id: Module.MULTI_LANGUAGE, 
    name: 'Multi Language', 
    description: 'Support multiple languages' 
  }
];
