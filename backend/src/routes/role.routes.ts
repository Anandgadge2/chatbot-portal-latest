import { Router, Request, Response } from 'express';
import Role from '../models/Role';
import User from '../models/User';
import { AuditAction } from '../config/constants';
import { logUserAction } from '../utils/auditLogger';
import { authenticate } from '../middleware/auth';
import { requireDatabaseConnection } from '../middleware/dbConnection';
import {
  canAssignRole,
  creatorPermissionsContain,
  filterPermissionsByModules,
  resolveUserAccessContext
} from '../utils/accessControl';

const router = Router();

router.use(requireDatabaseConnection);
router.use(authenticate);

function isOwnOrSuperAdmin(req: Request, targetCompanyId?: string | null): boolean {
  if (req.auth?.isSuperAdmin) return true;
  return !!targetCompanyId && req.auth?.companyId === targetCompanyId;
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const rawCompanyId = req.query.companyId as string | undefined;
    const companyId = req.auth?.isSuperAdmin ? rawCompanyId : req.auth?.companyId || undefined;

    if (!companyId) {
      return res.status(400).json({ success: false, message: 'companyId is required to fetch company roles' });
    }

    if (!isOwnOrSuperAdmin(req, companyId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const roles = await Role.find({ companyId, scope: 'company' }).sort({ level: 1, name: 1 });
    const roleIds = roles.map((role) => role._id);
    const userCounts = await User.aggregate([
      { $match: { customRoleId: { $in: roleIds } } },
      { $group: { _id: '$customRoleId', count: { $sum: 1 } } }
    ]);

    const countsByRoleId = new Map(userCounts.map((entry) => [entry._id.toString(), entry.count]));
    const enriched = roles.map((role) => ({
      ...role.toObject(),
      userCount: countsByRoleId.get(role._id.toString()) || 0
    }));

    return res.json({ success: true, data: { roles: enriched } });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });

    if (!isOwnOrSuperAdmin(req, role.companyId?.toString() || null)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const userCount = await User.countDocuments({ customRoleId: role._id });
    return res.json({ success: true, data: { role: { ...role.toObject(), userCount } } });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id/users', async (req: Request, res: Response) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });

    if (!isOwnOrSuperAdmin(req, role.companyId?.toString() || null)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const users = await User.find({ customRoleId: role._id })
      .select('-password')
      .populate('departmentId', 'name')
      .populate('subDepartmentId', 'name')
      .sort({ firstName: 1 });

    return res.json({ success: true, data: users });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { companyId, name, description, permissions, requiredModule } = req.body;
    const targetCompanyId = req.auth?.isSuperAdmin ? companyId : req.auth?.companyId;

    if (!targetCompanyId) {
      return res.status(400).json({ success: false, message: 'companyId is required' });
    }

    if (!isOwnOrSuperAdmin(req, targetCompanyId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'Role name is required' });
    }

    const Company = (await import('../models/Company')).default;
    const company = await Company.findById(targetCompanyId).select('enabledModules');
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    if (requiredModule && !company.enabledModules.includes(requiredModule)) {
      return res.status(400).json({ success: false, message: `Module ${requiredModule} is not enabled for this company` });
    }

    if (!req.auth?.isSuperAdmin) {
      const accessContext = await resolveUserAccessContext(user);
      if (!creatorPermissionsContain(accessContext.filteredPermissions, permissions || [])) {
        return res.status(403).json({ success: false, message: 'You cannot grant permissions you do not have' });
      }
    }

    const role = new Role({
      companyId: targetCompanyId,
      scope: 'company',
      name: name.trim(),
      description: description?.trim(),
      permissions: filterPermissionsByModules(permissions || [], company.enabledModules),
      notificationSettings: req.body.notificationSettings || { email: true, whatsapp: true },
      requiredModule: requiredModule || undefined,
      isSystem: false,
      createdBy: user._id
    });

    await role.save();
    await logUserAction(req, AuditAction.CREATE, 'Role', role._id.toString(), { roleName: role.name, level: role.level });

    return res.status(201).json({ success: true, data: { role }, message: 'Role created successfully' });
  } catch (err: any) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'A role with this name or level already exists in this company' });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const role = await Role.findById(req.params.id);

    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });
    if (!isOwnOrSuperAdmin(req, role.companyId?.toString() || null)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const Company = (await import('../models/Company')).default;
    const company = role.companyId ? await Company.findById(role.companyId).select('enabledModules') : null;

    if (!req.auth?.isSuperAdmin) {
      const accessContext = await resolveUserAccessContext(user);
      if (req.body.permissions !== undefined && !creatorPermissionsContain(accessContext.filteredPermissions, req.body.permissions)) {
        return res.status(403).json({ success: false, message: 'You cannot grant permissions you do not have' });
      }
    }

    if (req.body.name) role.name = req.body.name.trim();
    if (req.body.description !== undefined) role.description = req.body.description?.trim();
    if (req.body.permissions !== undefined) {
      role.permissions = company
        ? filterPermissionsByModules(req.body.permissions, company.enabledModules)
        : req.body.permissions;
    }
    if (req.body.requiredModule !== undefined) role.requiredModule = req.body.requiredModule || undefined;
    if (req.body.notificationSettings !== undefined) role.notificationSettings = req.body.notificationSettings;
    role.updatedBy = user._id;

    await role.save();
    await logUserAction(req, AuditAction.UPDATE, 'Role', role._id.toString(), { roleName: role.name, level: role.level });

    return res.json({ success: true, data: { role }, message: 'Role updated successfully' });
  } catch (err: any) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'A role with this name or level already exists in this company' });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });
    if (role.isSystem) {
      return res.status(403).json({ success: false, message: 'System roles cannot be deleted' });
    }
    if (!isOwnOrSuperAdmin(req, role.companyId?.toString() || null)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await User.updateMany({ customRoleId: role._id }, { $unset: { customRoleId: '' } });
    await Role.findByIdAndDelete(req.params.id);
    await logUserAction(req, AuditAction.DELETE, 'Role', role._id.toString(), { roleName: role.name, level: role.level });

    return res.json({ success: true, message: 'Role deleted successfully' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/:id/assign-user', async (req: Request, res: Response) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });

    if (!isOwnOrSuperAdmin(req, role.companyId?.toString() || null)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const targetUser = await User.findById(req.body.userId);
    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' });
    if (targetUser.companyId?.toString() !== role.companyId?.toString()) {
      return res.status(400).json({ success: false, message: 'User does not belong to this company' });
    }

    const allowed = await canAssignRole(req.user!, role.level);
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'You can only assign roles strictly below your own level' });
    }

    targetUser.customRoleId = role._id;
    targetUser.isSuperAdmin = false;
    await targetUser.save();

    return res.json({ success: true, message: `Role assigned to user`, data: { roleId: role._id } });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
