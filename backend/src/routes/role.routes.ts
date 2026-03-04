import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import Role from '../models/Role';
import User from '../models/User';
import { UserRole, AuditAction } from '../config/constants';
import { createAuditLog, logUserAction } from '../utils/auditLogger';
import { authenticate } from '../middleware/auth';
import { requireDatabaseConnection } from '../middleware/dbConnection';

const router = Router();

// Apply middleware to all routes
router.use(requireDatabaseConnection);
router.use(authenticate);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isOwnOrSuperAdmin(req: Request, targetCompanyId: string): boolean {
  const user = req.user;
  if (!user) return false;
  if (user.role === UserRole.SUPER_ADMIN) return true;
  return user.companyId?.toString() === targetCompanyId;
}

// ─── GET /roles?companyId=... ─────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const rawCompanyId = req.query.companyId as string;

    // Determine which company to fetch roles for
    const companyId =
      user.role === UserRole.SUPER_ADMIN && rawCompanyId
        ? rawCompanyId
        : user.companyId?.toString();

    // If SUPER_ADMIN but no companyId provided, we can return an empty list or system roles
    if (!companyId) {
      // If we want to return a 400, it's safer for now as roles are company-scoped
      return res.status(400).json({ success: false, message: 'companyId is required to fetch roles' });
    }

    if (!isOwnOrSuperAdmin(req, companyId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const roles = await Role.find({ companyId }).sort({ isSystem: -1, name: 1 });

    // Attach user count per role
    const enriched = await Promise.all(
      roles.map(async (role: any) => {
        const userCount = await User.countDocuments({ customRoleId: role._id });
        return { ...role.toObject(), userCount };
      })
    );

    res.json({ success: true, data: enriched });
  } catch (err: any) {
    console.error('❌ GET /roles error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /roles/:id ───────────────────────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });

    if (!isOwnOrSuperAdmin(req, role.companyId.toString())) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const userCount = await User.countDocuments({ customRoleId: role._id });
    res.json({ success: true, data: { ...role.toObject(), userCount } });
  } catch (err: any) {
    console.error('❌ GET /roles/:id error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /roles/:id/users ─────────────────────────────────────────────────────

router.get('/:id/users', async (req: Request, res: Response) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });

    if (!isOwnOrSuperAdmin(req, role.companyId.toString())) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const users = await User.find({ customRoleId: role._id }).select('-password -rawPassword').sort({ firstName: 1 });
    res.json({ success: true, data: users });
  } catch (err: any) {
    console.error('❌ GET /roles/:id/users error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /roles ──────────────────────────────────────────────────────────────

router.post('/', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { companyId, name, description, permissions } = req.body;

    const targetCompanyId = companyId || user.companyId?.toString();
    if (!targetCompanyId) {
      return res.status(400).json({ success: false, message: 'companyId is required' });
    }

    if (!isOwnOrSuperAdmin(req, targetCompanyId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'Role name is required' });
    }

    const role = new Role({
      companyId: targetCompanyId,
      name: name.trim(),
      description: description?.trim(),
      permissions: permissions || [],
      isSystem: false,
      createdBy: user._id
    });

    await role.save();

    await logUserAction(req, AuditAction.CREATE, 'Role', role._id.toString(), { roleName: role.name });

    res.status(201).json({ success: true, data: role, message: 'Role created successfully' });
  } catch (err: any) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'A role with this name already exists in this company' });
    }
    console.error('❌ POST /roles error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PUT /roles/:id ───────────────────────────────────────────────────────────

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const role = await Role.findById(req.params.id);

    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });
    if (!isOwnOrSuperAdmin(req, role.companyId.toString())) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { name, description, permissions } = req.body;

    if (name) role.name = name.trim();
    if (description !== undefined) role.description = description?.trim();
    if (permissions !== undefined) role.permissions = permissions;
    role.updatedBy = user._id;

    await role.save();

    await logUserAction(req, AuditAction.UPDATE, 'Role', role._id.toString(), { roleName: role.name });

    res.json({ success: true, data: role, message: 'Role updated successfully' });
  } catch (err: any) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'A role with this name already exists in this company' });
    }
    console.error('❌ PUT /roles/:id error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DELETE /roles/:id ────────────────────────────────────────────────────────

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const role = await Role.findById(req.params.id);

    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });
    if (role.isSystem) {
      return res.status(403).json({ success: false, message: 'System roles cannot be deleted' });
    }
    if (!isOwnOrSuperAdmin(req, role.companyId.toString())) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Unassign users from this role before deleting
    const usersWithRole = await User.countDocuments({ customRoleId: role._id });
    if (usersWithRole > 0) {
      await User.updateMany({ customRoleId: role._id }, { $unset: { customRoleId: '' } });
      console.log(`Snapshot: Unassigned role from ${usersWithRole} user(s)`);
    }

    await Role.findByIdAndDelete(req.params.id);

    await logUserAction(req, AuditAction.DELETE, 'Role', role._id.toString(), { roleName: role.name });

    res.json({ success: true, message: 'Role deleted successfully' });
  } catch (err: any) {
    console.error('❌ DELETE /roles/:id error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /roles/:id/assign-user ─────────────────────────────────────────────

router.post('/:id/assign-user', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { userId } = req.body;

    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });

    if (!isOwnOrSuperAdmin(req, role.companyId.toString())) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' });
    if (targetUser.companyId?.toString() !== role.companyId.toString()) {
      return res.status(400).json({ success: false, message: 'User does not belong to this company' });
    }

    targetUser.customRoleId = role._id;
    await targetUser.save();

    res.json({ success: true, message: `Role "${role.name}" assigned to user` });
  } catch (err: any) {
    console.error('❌ POST /roles/:id/assign-user error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
