import mongoose from 'mongoose';
import Module from '../models/Module';

const DEFAULT_MODULES = [
  {
    key: 'DASHBOARD',
    name: 'Dashboard',
    description: 'Main dashboard and basic analytics overview',
    category: 'CORE',
    isSystem: true,
    permissions: [{ action: 'view', label: 'View Dashboard' }]
  },
  {
    key: 'GRIEVANCE',
    name: 'Grievance Management',
    description: 'Handle citizen complaints and feedback',
    category: 'CORE',
    isSystem: true,
    permissions: [
      { action: 'view', label: 'View Grievances' },
      { action: 'create', label: 'Create Grievance' },
      { action: 'update', label: 'Update Grievance' },
      { action: 'delete', label: 'Delete Grievance' },
      { action: 'assign', label: 'Assign Grievance' },
      { action: 'status_change', label: 'Change Status' }
    ]
  },
  {
    key: 'APPOINTMENT',
    name: 'Appointment System',
    description: 'Booking and management of official meetings',
    category: 'CORE',
    isSystem: true,
    permissions: [
      { action: 'view', label: 'View Appointments' },
      { action: 'create', label: 'Create Appointment' },
      { action: 'update', label: 'Update Appointment' },
      { action: 'delete', label: 'Delete Appointment' },
      { action: 'status_change', label: 'Change Status' }
    ]
  },
  {
    key: 'USER_MANAGEMENT',
    name: 'User Management',
    description: 'Manage company employees and departments',
    category: 'CORE',
    isSystem: true,
    permissions: [
      { action: 'view', label: 'View Users' },
      { action: 'create', label: 'Add Users' },
      { action: 'update', label: 'Edit Users' },
      { action: 'delete', label: 'Delete Users' }
    ]
  },
  {
    key: 'FLOW_BUILDER',
    name: 'Chatbot Flow Builder',
    description: 'Design and deploy automated chat flows',
    category: 'ADVANCED',
    isSystem: true,
    permissions: [
      { action: 'view', label: 'View Flows' },
      { action: 'manage', label: 'Full Management' }
    ]
  },
  {
    key: 'DEPARTMENTS',
    name: 'Department Management',
    description: 'Structure and oversee organizational departments',
    category: 'CORE',
    isSystem: true,
    permissions: [
      { action: 'view', label: 'View Departments' },
      { action: 'create', label: 'Create Department' },
      { action: 'update', label: 'Update Department' },
      { action: 'delete', label: 'Delete Department' }
    ]
  },
  {
    key: 'ANALYTICS',
    name: 'Advanced Analytics',
    description: 'Comprehensive reports and performance metrics',
    category: 'ADVANCED',
    isSystem: true,
    permissions: [
      { action: 'view', label: 'View Analytics' },
      { action: 'export', label: 'Export Data' }
    ]
  },
  {
    key: 'SETTINGS',
    name: 'Platform Settings',
    description: 'System-wide configuration and audit trails',
    category: 'UTILITY',
    isSystem: true,
    permissions: [
      { action: 'view', label: 'View Settings' },
      { action: 'update', label: 'Manage Settings' },
      { action: 'view_audit', label: 'View Audit Logs' }
    ]
  }
];

export const seedModules = async () => {
  console.log('🌱 Seeding modules...');
  for (const mod of DEFAULT_MODULES) {
    await Module.findOneAndUpdate({ key: mod.key }, mod, { upsert: true });
  }
  console.log('✅ Modules seeded successfully');
};
