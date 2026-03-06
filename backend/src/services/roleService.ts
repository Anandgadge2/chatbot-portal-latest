import Role, { IPermission } from '../models/Role';
import { UserRole } from '../config/constants';
import mongoose from 'mongoose';

/**
 * Default permission templates for system roles.
 * These are used to initialize a company's RBAC system.
 */
const DEFAULT_ROLE_TEMPLATES: Record<string, IPermission[]> = {
  [UserRole.COMPANY_ADMIN]: [
    { module: 'DASHBOARD', actions: ['view'] },
    { module: 'GRIEVANCE', actions: ['view', 'create', 'update', 'assign', 'status_change', 'export'] },
    { module: 'APPOINTMENT', actions: ['view', 'create', 'update', 'status_change', 'export'] },
    { module: 'DEPARTMENTS', actions: ['view', 'create', 'update', 'delete'] },
    { module: 'USER_MANAGEMENT', actions: ['view', 'create', 'update', 'delete'] },
    { module: 'ANALYTICS', actions: ['view', 'export'] },
    { module: 'SETTINGS', actions: ['view', 'update'] }
  ],
  [UserRole.DEPARTMENT_ADMIN]: [
    { module: 'DASHBOARD', actions: ['view'] },
    { module: 'GRIEVANCE', actions: ['view', 'create', 'update', 'assign', 'status_change'] },
    { module: 'APPOINTMENT', actions: ['view', 'create', 'update', 'status_change'] },
    { module: 'DEPARTMENTS', actions: ['view'] },
    { module: 'USER_MANAGEMENT', actions: ['view', 'create', 'update'] },
    { module: 'ANALYTICS', actions: ['view'] }
  ],
  [UserRole.OPERATOR]: [
    { module: 'DASHBOARD', actions: ['view'] },
    { module: 'GRIEVANCE', actions: ['view', 'status_change'] },
    { module: 'APPOINTMENT', actions: ['view', 'status_change'] }
  ],
  [UserRole.ANALYTICS_VIEWER]: [
    { module: 'DASHBOARD', actions: ['view'] },
    { module: 'ANALYTICS', actions: ['view', 'export'] }
  ]
};

export const roleService = {
  /**
   * Seeds default roles for a specific company.
   * This ensures every company starts with a functional RBAC system.
   */
  async seedDefaultRoles(companyId: string, createdBy: string) {
    const rolesToSeed = [
      {
        name: 'Company Administrator',
        description: 'Full access to company settings and personnel.',
        key: UserRole.COMPANY_ADMIN,
        isSystem: true
      },
      {
        name: 'Department Head',
        description: 'Authorized to manage departmental operations.',
        key: UserRole.DEPARTMENT_ADMIN,
        isSystem: true
      },
      {
        name: 'Official Operator',
        description: 'Handles day-to-day status updates and feedback.',
        key: UserRole.OPERATOR,
        isSystem: false
      },
      {
        name: 'Intelligence Analyst',
        description: 'Access to data insights and reporting.',
        key: UserRole.ANALYTICS_VIEWER,
        isSystem: false
      }
    ];

    const results = [];

    for (const roleDef of rolesToSeed) {
      const existing = await Role.findOne({ companyId, name: roleDef.name });
      const permissions = DEFAULT_ROLE_TEMPLATES[roleDef.key] || [];

      if (existing) {
        if (roleDef.isSystem) {
          // Force update permissions for system roles to match the latest template
          existing.permissions = permissions;
          existing.key = roleDef.key;
          await existing.save();
          results.push({ name: roleDef.name, status: 'updated' });
        } else {
          results.push({ name: roleDef.name, status: 'exists' });
        }
        continue;
      }

      const role = new Role({
        companyId,
        key: roleDef.key,
        name: roleDef.name,
        description: roleDef.description,
        isSystem: roleDef.isSystem,
        permissions,
        createdBy: new mongoose.Types.ObjectId(createdBy)
      });

      await role.save();
      results.push({ name: roleDef.name, status: 'created' });
    }

    return results;
  }
};
