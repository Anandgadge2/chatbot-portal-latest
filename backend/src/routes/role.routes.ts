import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import Role from '../models/Role';
import User from '../models/User';
import Company from '../models/Company';
import { AuditAction } from '../config/constants';
import { logRBACChange, logUserAction } from '../utils/auditLogger';
import { authenticate } from '../middleware/auth';
import { requireDatabaseConnection } from '../middleware/dbConnection';
import {
  canAssignRole,
  getNextRoleLevel,
  isPermissionSubset,
  invalidateCompanyRBACCache,
  normalizePermissions,
  resolveAccessContext
} from '../utils/accessControl';

const router = Router();

router.use(requireDatabaseConnection);
router.use(authenticate);

const getTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const getValidObjectId = (value: unknown): mongoose.Types.ObjectId | undefined => {
  const trimmed = getTrimmedString(value);
  if (!trimmed || !mongoose.Types.ObjectId.isValid(trimmed)) return undefined;
  return new mongoose.Types.ObjectId(trimmed);
};

function isOwnOrSuperAdmin(req: Request, targetCompanyId: string): boolean {
  const user = req.user;
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  return user.companyId?.toString() === targetCompanyId;
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const rawCompanyId = getTrimmedString(req.query.companyId);
    const companyId = user.isSuperAdmin && rawCompanyId ? rawCompanyId : user.companyId?.toString();

    if (rawCompanyId && !mongoose.Types.ObjectId.isValid(rawCompanyId)) {
      return res.status(400).json({ success: false, message: 'Invalid companyId' });
    }

    if (!companyId) {
      return res.status(400).json({ success: false, message: 'companyId is required to fetch roles' });
    }

    if (!isOwnOrSuperAdmin(req, companyId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const companyObjectId = new mongoose.Types.ObjectId(companyId);
    const roles = await Role.find({ companyId: companyObjectId, scope: 'company' }).sort({ isSystem: -1, level: 1, name: 1 });
    const enriched = await Promise.all(
      roles.map(async (role: any) => ({
        ...role.toObject(),
        userCount: await User.countDocuments({ companyId: companyObjectId, customRoleId: role._id })
      }))
    );

    res.json({ success: true, data: { roles: enriched } });
  } catch (err: any) {
    console.error('❌ GET /roles error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch roles' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const roleId = getValidObjectId(req.params.id);
    if (!roleId) return res.status(400).json({ success: false, message: 'Invalid role ID' });

    const role = await Role.findById(roleId);
    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });

    if (!role.companyId || !isOwnOrSuperAdmin(req, role.companyId.toString())) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const userCount = await User.countDocuments({ companyId: role.companyId, customRoleId: role._id });
    res.json({ success: true, data: { role: { ...role.toObject(), userCount } } });
  } catch (err: any) {
    console.error('❌ GET /roles/:id error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch role' });
  }
});

router.get('/:id/users', async (req: Request, res: Response) => {
  try {
    const roleId = getValidObjectId(req.params.id);
    if (!roleId) return res.status(400).json({ success: false, message: 'Invalid role ID' });

    const role = await Role.findById(roleId);
    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });

    if (!role.companyId || !isOwnOrSuperAdmin(req, role.companyId.toString())) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const users = await User.find({ companyId: role.companyId, customRoleId: role._id })
      .select('-password')
      .populate('departmentId', 'name')
      .sort({ firstName: 1 });

    res.json({ success: true, data: users });
  } catch (err: any) {
    console.error('❌ GET /roles/:id/users error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch role users' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const companyId = getValidObjectId(req.body?.companyId);
    const name = getTrimmedString(req.body?.name);
    const description = getTrimmedString(req.body?.description);
    const permissions = req.body?.permissions;
    const requiredModule = getTrimmedString(req.body?.requiredModule);

    if (req.body?.companyId !== undefined && !companyId) {
      return res.status(400).json({ success: false, message: 'Invalid companyId' });
    }

    const targetCompanyId = user.isSuperAdmin && companyId ? companyId.toString() : user.companyId?.toString();
    if (!targetCompanyId) {
      return res.status(400).json({ success: false, message: 'companyId is required' });
    }

    if (!isOwnOrSuperAdmin(req, targetCompanyId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'Role name is required' });
    }

    const normalizedPermissions = normalizePermissions(permissions || []);
    const accessContext = await resolveAccessContext(user);

    if (!user.isSuperAdmin && !isPermissionSubset(accessContext.filteredPermissions, normalizedPermissions)) {
      return res.status(403).json({ success: false, message: 'Role permissions must be a subset of your permissions' });
    }

    const level = await getNextRoleLevel(targetCompanyId);
    const role = new Role({
      companyId: new mongoose.Types.ObjectId(targetCompanyId),
      name: name.trim(),
      description: description?.trim(),
      permissions: normalizedPermissions,
      requiredModule: requiredModule?.trim()?.toUpperCase(),
      notificationSettings: req.body?.notificationSettings || { email: true, whatsapp: true },
      isSystem: false,
      level,
      scope: 'company',
      createdBy: user._id
    });

    await role.save();
    await logRBACChange(req, 'ROLE_CREATED', targetCompanyId, role._id.toString(), { level: role.level, permissions: role.permissions });
    await logUserAction(req, AuditAction.CREATE, 'Role', role._id.toString(), { roleName: role.name, level: role.level });

    res.status(201).json({ success: true, data: { role }, message: 'Role created successfully' });
  } catch (err: any) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'A role with this name or level already exists in this company' });
    }
    console.error('❌ POST /roles error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to create role' });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const roleId = getValidObjectId(req.params.id);
    if (!roleId) return res.status(400).json({ success: false, message: 'Invalid role ID' });

    const role = await Role.findById(roleId);

    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });
    if (!role.companyId || !isOwnOrSuperAdmin(req, role.companyId.toString())) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const normalizedPermissions = req.body?.permissions !== undefined ? normalizePermissions(req.body.permissions) : role.permissions;
    const permissionsChanged = req.body?.permissions !== undefined
      && JSON.stringify(normalizedPermissions) !== JSON.stringify(normalizePermissions(role.permissions));
    const accessContext = await resolveAccessContext(user);

    if (!user.isSuperAdmin && !isPermissionSubset(accessContext.filteredPermissions, normalizedPermissions)) {
      return res.status(403).json({ success: false, message: 'Role permissions must be a subset of your permissions' });
    }

    const nextName = getTrimmedString(req.body?.name);
    const nextDescription = req.body?.description === undefined ? undefined : getTrimmedString(req.body?.description) || '';
    const nextRequiredModule = req.body?.requiredModule === undefined ? undefined : getTrimmedString(req.body?.requiredModule)?.toUpperCase() || '';

    if (nextName) role.name = nextName;
    if (req.body?.description !== undefined) role.description = nextDescription;
    if (req.body?.permissions !== undefined) role.permissions = normalizedPermissions;
    if (req.body?.requiredModule !== undefined) role.requiredModule = nextRequiredModule;
    if (req.body?.notificationSettings !== undefined) role.notificationSettings = req.body.notificationSettings;
    role.updatedBy = user._id;

    await role.save();
    if (permissionsChanged && role.companyId) {
      const company = await Company.findByIdAndUpdate(role.companyId, { $inc: { permissionsVersion: 1 } }, { new: true }).select('permissionsVersion');
      await invalidateCompanyRBACCache(role.companyId);
      await logRBACChange(req, 'ROLE_UPDATED', role.companyId.toString(), role._id.toString(), {
        permissions: role.permissions,
        permissionsVersion: company?.permissionsVersion
      });
    }
    await logUserAction(req, AuditAction.UPDATE, 'Role', role._id.toString(), { roleName: role.name, level: role.level });

    res.json({ success: true, data: { role }, message: 'Role updated successfully' });
  } catch (err: any) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'A role with this name or level already exists in this company' });
    }
    console.error('❌ PUT /roles/:id error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to update role' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const roleId = getValidObjectId(req.params.id);
    if (!roleId) return res.status(400).json({ success: false, message: 'Invalid role ID' });

    const role = await Role.findById(roleId);

    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });
    if (role.isSystem) {
      return res.status(403).json({ success: false, message: 'System roles cannot be deleted' });
    }
    if (!role.companyId || !isOwnOrSuperAdmin(req, role.companyId.toString())) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const usersWithRole = await User.countDocuments({ customRoleId: role._id });
    if (usersWithRole > 0) {
      await User.updateMany({ customRoleId: role._id }, { $unset: { customRoleId: '' } });
    }

    await Role.findByIdAndDelete(roleId);
    if (role.companyId) {
      const company = await Company.findByIdAndUpdate(role.companyId, { $inc: { permissionsVersion: 1 } }, { new: true }).select('permissionsVersion');
      await invalidateCompanyRBACCache(role.companyId);
      await logRBACChange(req, 'ROLE_DELETED', role.companyId.toString(), role._id.toString(), {
        permissionsVersion: company?.permissionsVersion
      });
    }
    await logUserAction(req, AuditAction.DELETE, 'Role', role._id.toString(), { roleName: role.name, level: role.level });

    res.json({ success: true, message: 'Role deleted successfully' });
  } catch (err: any) {
    console.error('❌ DELETE /roles/:id error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to delete role' });
  }
});

router.post('/:id/assign-user', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const userId = getValidObjectId(req.body?.userId);

    if (!userId) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }

    const roleId = getValidObjectId(req.params.id);
    if (!roleId) return res.status(400).json({ success: false, message: 'Invalid role ID' });

    const role = await Role.findById(roleId);
    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });

    if (!role.companyId || !isOwnOrSuperAdmin(req, role.companyId.toString())) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const assignerContext = await resolveAccessContext(user);
    if (!canAssignRole({ isSuperAdmin: user.isSuperAdmin, level: assignerContext.level }, role.level)) {
      return res.status(403).json({ success: false, message: 'You cannot assign this role level' });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' });
    if (targetUser.companyId?.toString() !== role.companyId.toString()) {
      return res.status(400).json({ success: false, message: 'User does not belong to this company' });
    }

    targetUser.customRoleId = role._id;
    await targetUser.save();

    res.json({ success: true, message: `Role \"${role.name}\" assigned to user` });
  } catch (err: any) {
    console.error('❌ POST /roles/:id/assign-user error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to assign role' });
  }
});

export default router;
