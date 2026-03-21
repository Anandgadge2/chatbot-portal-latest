import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { authenticate } from '../middleware/auth';
import { requireDatabaseConnection } from '../middleware/dbConnection';
import { UserRole } from '../config/constants';
import User from '../models/User';
import Role from '../models/Role';
import Company from '../models/Company';
import Department from '../models/Department';

const router = Router();

router.use(requireDatabaseConnection);
router.use(authenticate);

const hasActionPermission = (
  permissions: Array<{ module: string; actions: string[] }>,
  module: string,
  actions: string[] = ['view'],
) => {
  const modulePermission = permissions.find((permission) => permission.module === module);
  if (!modulePermission) return false;

  return actions.some((action) =>
    modulePermission.actions.includes(action) ||
    modulePermission.actions.includes('manage') ||
    modulePermission.actions.includes('all'),
  );
};

const buildHumanizedRoleName = (roleKey: string) =>
  roleKey
    .replace(/_/g, ' ')
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

async function resolvePermissions(user: any) {
  if (user.role === UserRole.SUPER_ADMIN) {
    return { roleDoc: null, permissions: [] as Array<{ module: string; actions: string[] }> };
  }

  if (user.customRoleId) {
    const roleDoc = await Role.findById(user.customRoleId);
    return {
      roleDoc,
      permissions: roleDoc?.permissions || [],
    };
  }

  if (!user.companyId) {
    return { roleDoc: null, permissions: [] as Array<{ module: string; actions: string[] }> };
  }

  const companyId = user.companyId instanceof mongoose.Types.ObjectId
    ? user.companyId
    : user.companyId?._id || user.companyId;

  const roleKey = (user.role || 'CUSTOM').toUpperCase();

  let roleDoc = await Role.findOne({ companyId, key: roleKey });

  if (!roleDoc && roleKey !== 'CUSTOM') {
    roleDoc = await Role.findOne({
      companyId,
      name: new RegExp(`^${buildHumanizedRoleName(roleKey)}$`, 'i'),
    });
  }

  return {
    roleDoc,
    permissions: roleDoc?.permissions || [],
  };
}

const toIdString = (value: any): string | null => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  if (typeof value === 'object' && value._id) return value._id.toString();
  return value.toString();
};

const toDepartmentScopeType = (department: any) =>
  department?.parentDepartmentId ? 'subdepartment' : 'department';

router.get('/bootstrap', async (req: Request, res: Response) => {
  try {
    const viewer = req.user;
    if (!viewer?._id) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const { roleDoc, permissions } = await resolvePermissions(viewer);
    const requestedCompanyId = typeof req.query.companyId === 'string' ? req.query.companyId : undefined;
    const requestedDepartmentId = typeof req.query.departmentId === 'string' ? req.query.departmentId : undefined;

    const fullUser = await User.findById(viewer._id)
      .populate('companyId')
      .populate('departmentId');

    if (!fullUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const isSuperAdmin = fullUser.role === UserRole.SUPER_ADMIN;
    const userCompanyId = toIdString(fullUser.companyId);
    const userDepartmentId = toIdString(fullUser.departmentId);

    let company: any = fullUser.companyId || null;
    let department: any = fullUser.departmentId || null;
    let scopeType: 'admin' | 'company' | 'department' | 'subdepartment' = isSuperAdmin ? 'admin' : 'company';

    if (requestedDepartmentId) {
      department = await Department.findById(requestedDepartmentId).populate('companyId');
      if (!department) {
        return res.status(404).json({ success: false, message: 'Department not found.' });
      }

      const targetCompanyId = toIdString(department.companyId);
      const hasCompanyWideAccess = !!userCompanyId && !userDepartmentId && userCompanyId === targetCompanyId;
      const hasDepartmentAccess = !!userDepartmentId && userDepartmentId === requestedDepartmentId;

      if (!isSuperAdmin && !hasCompanyWideAccess && !hasDepartmentAccess) {
        return res.status(403).json({ success: false, message: 'Access denied to this department.' });
      }

      company = department.companyId && (department.companyId as any)._id
        ? department.companyId
        : targetCompanyId
          ? await Company.findById(targetCompanyId)
          : null;
      scopeType = toDepartmentScopeType(department);
    } else if (requestedCompanyId) {
      if (!isSuperAdmin && userCompanyId !== requestedCompanyId) {
        return res.status(403).json({ success: false, message: 'Access denied to this company.' });
      }

      company = await Company.findById(requestedCompanyId);
      if (!company) {
        return res.status(404).json({ success: false, message: 'Company not found.' });
      }
      scopeType = 'company';
      department = null;
    } else if (isSuperAdmin) {
      scopeType = 'admin';
      company = null;
      department = null;
    } else if (department) {
      scopeType = toDepartmentScopeType(department);
      if (!company) {
        company = await Company.findById(toIdString((department as any).companyId));
      }
    } else if (company) {
      scopeType = 'company';
    }

    const enabledModules = Array.isArray((company as any)?.enabledModules)
      ? (company as any).enabledModules
      : Array.isArray((fullUser.companyId as any)?.enabledModules)
        ? (fullUser.companyId as any).enabledModules
        : [];

    const hasModule = (moduleKey: string) => isSuperAdmin || enabledModules.includes(moduleKey);
    const canViewUsers = isSuperAdmin || hasActionPermission(permissions, 'USER_MANAGEMENT', ['view']);
    const canViewDepartments = isSuperAdmin || hasActionPermission(permissions, 'DEPARTMENTS', ['view']);
    const canViewAnalytics = isSuperAdmin || hasActionPermission(permissions, 'ANALYTICS', ['view']);
    const canViewGrievances = hasModule('GRIEVANCE') && (isSuperAdmin || hasActionPermission(permissions, 'GRIEVANCE', ['view']));
    const canViewAppointments = hasModule('APPOINTMENT') && (isSuperAdmin || hasActionPermission(permissions, 'APPOINTMENT', ['view']));
    const canManageFlows = isSuperAdmin || hasActionPermission(permissions, 'FLOW_BUILDER', ['view', 'update', 'manage']);
    const canManageSettings = isSuperAdmin || hasActionPermission(permissions, 'SETTINGS', ['view', 'update', 'manage']);

    const visibleTabs = [
      'overview',
      canViewDepartments ? 'departments' : null,
      canViewUsers ? 'users' : null,
      canViewGrievances ? 'grievances' : null,
      canViewAppointments ? 'appointments' : null,
      hasModule('LEAD_CAPTURE') ? 'leads' : null,
      canViewAnalytics ? 'analytics' : null,
      isSuperAdmin ? 'roles' : null,
      canManageSettings ? 'notifications' : null,
    ].filter(Boolean) as string[];

    const actorRoleLabel = roleDoc?.name || fullUser.role || 'CUSTOM';
    const companyId = toIdString(company);
    const departmentId = toIdString(department);

    const entryRoute = scopeType === 'admin'
      ? '/portal/admin'
      : scopeType === 'company' && companyId
        ? `/portal/company/${companyId}`
        : scopeType === 'subdepartment' && departmentId
          ? `/portal/subdepartment/${departmentId}`
          : departmentId
            ? `/portal/department/${departmentId}`
            : '/portal';

    return res.json({
      success: true,
      data: {
        actor: {
          id: fullUser._id,
          userId: fullUser.userId,
          firstName: fullUser.firstName,
          lastName: fullUser.lastName,
          email: fullUser.email,
          phone: fullUser.phone,
          role: fullUser.role,
          roleLabel: actorRoleLabel,
          companyId: userCompanyId,
          departmentId: userDepartmentId,
          customRoleId: toIdString(fullUser.customRoleId),
          permissions,
          enabledModules,
          notificationSettings: fullUser.notificationSettings,
        },
        scope: {
          type: scopeType,
          companyId,
          departmentId,
        },
        access: {
          visibleTabs,
          visibleSettingsTabs: [
            canManageSettings ? 'notifications' : null,
            canManageSettings ? 'email' : null,
            canManageSettings ? 'whatsapp' : null,
            canManageFlows ? 'flows' : null,
            isSuperAdmin ? 'roles' : null,
          ].filter(Boolean),
          modules: enabledModules,
          actions: {
            canViewUsers,
            canViewDepartments,
            canViewGrievances,
            canViewAppointments,
            canViewAnalytics,
            canManageFlows,
            canManageSettings,
            canDeleteData: isSuperAdmin,
            canManageRoles: isSuperAdmin,
          },
        },
        navigation: {
          entryRoute,
          homeRoute: entryRoute,
        },
        company: company
          ? {
              _id: toIdString(company),
              companyId: (company as any).companyId,
              name: (company as any).name,
              enabledModules,
            }
          : null,
        department: department
          ? {
              _id: toIdString(department),
              departmentId: (department as any).departmentId,
              name: (department as any).name,
              parentDepartmentId: toIdString((department as any).parentDepartmentId),
            }
          : null,
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Failed to resolve portal bootstrap.',
      error: error.message,
    });
  }
});

export default router;
