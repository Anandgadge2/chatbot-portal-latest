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

function canViewRole(req: Request, role: any): boolean {
  const user = req.user;
  if (!user) return false;
  
  // Super Admins see everything
  if (user.isSuperAdmin) return true;
  
  // Exclude level 0 roles (Platform Superadmin) for non-superadmins
  if (role.level === 0) return false;

  // Global roles (companyId is null) are readable by all authenticated users
  if (!role.companyId) return true;
  
  return user.companyId?.toString() === role.companyId.toString();
}

function canModifyRole(req: Request, role: any): boolean {
  const user = req.user;
  if (!user) return false;

  // Super Admins can modify everything
  if (user.isSuperAdmin) return true;

  // Non-SuperAdmins can NEVER modify system/global roles
  if (role.isSystem || !role.companyId || role.level === 0) return false;

  // Otherwise, must belong to the same company
  return user.companyId?.toString() === role.companyId.toString();
}

// ─── GET /roles?companyId=... ─────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const rawCompanyId = req.query.companyId as string;

    // Determine which company to fetch roles for
    const companyId =
      user.isSuperAdmin && rawCompanyId
        ? rawCompanyId
        : user.companyId?.toString();

    // If SUPER_ADMIN but no companyId provided, allow fetching all roles OR just system roles
    if (!companyId) {
       if (user.isSuperAdmin) {
         // Return all roles across all companies + system roles for SuperAdmin global view
         const allRoles = await Role.find({}).populate('companyId', 'name').sort({ level: 1, name: 1 });
         return res.json({ success: true, data: { roles: allRoles } });
       }
       return res.status(400).json({ success: false, message: 'companyId is required to fetch roles' });
    }

    if (!user.isSuperAdmin && companyId !== user.companyId?.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const filterGlobal = req.query.filterGlobal === 'true';

    const query: any = {};
    
    if (filterGlobal) {
      // Only return company-specific roles
      query.companyId = companyId;
    } else {
      // Return both company-specific and system roles (default behavior)
      query.$or = [
        { companyId },
        { companyId: null }
      ];
    }

    // If not SuperAdmin, hide roles with level 0 (Platform Superadmin)
    if (!user.isSuperAdmin) {
      query.level = { $ne: 0 };
    }

    const roles = await Role.find(query).populate('companyId', 'name').sort({ level: 1, name: 1 });

    // Attach user count per role
    const enriched = await Promise.all(
      roles.map(async (role: any) => {
        const targetCompanyId = role.companyId || companyId;
        const countQuery: any = { companyId: targetCompanyId };
        
        // Mutually Exclusive Counting Standard:
        // 1. Primary Match: Users explicitly assigned this Role Object ID
        const primaryMatch = { customRoleId: role._id };

        // 2. Legacy Fallback: Only for System Roles or when no customRoleId exists
        if (role.isSystem) {
          const roleRegex = new RegExp(`^${role.key?.replace(/[\s_]/g, '[\\s_]') || role.name.replace(/[\s_]/g, '[\\s_]')}$`, 'i');
          const nameRegex = new RegExp(`^${role.name.replace(/[\s_]/g, '[\\s_]')}$`, 'i');
          
          countQuery.$or = [
            primaryMatch,
            { 
              customRoleId: { $exists: false }, 
              $or: [
                { role: roleRegex },
                { role: nameRegex }
              ]
            }
          ];
        } else {
          // Company-specific roles ONLY count users with the exact ID
          // This prevents them from "stealing" counts from system roles via string matching
          Object.assign(countQuery, primaryMatch);
        }

        const userCount = await User.countDocuments(countQuery);
        return { ...role.toObject(), userCount };
      })
    );

    res.json({ success: true, data: { roles: enriched } });
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

    const targetCompanyId = role.companyId || req.query.companyId || req.user?.companyId;

    if (!canViewRole(req, role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const countQuery: any = { companyId: targetCompanyId };
    if (role.key) {
      countQuery.$or = [
        { customRoleId: role._id },
        { role: role.key }
      ];
    } else {
      countQuery.customRoleId = role._id;
    }

    const userCount = await User.countDocuments(countQuery);
    res.json({ success: true, data: { role: { ...role.toObject(), userCount } } });
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

    const targetCompanyId = role.companyId || req.query.companyId || req.user?.companyId;

    if (!canViewRole(req, role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const query: any = { companyId: targetCompanyId };
    
    if (role.key) {
      const roleRegex = new RegExp(`^${role.key.replace(/_/g, '[\\s_]')}$`, 'i');
      const nameRegex = new RegExp(`^${role.name.replace(/_/g, '[\\s_]')}$`, 'i');
      query.$or = [
        { customRoleId: role._id },
        { role: roleRegex },
        { role: nameRegex }
      ];
    } else {
      query.$or = [
        { customRoleId: role._id },
        { role: new RegExp(`^${role.name}$`, 'i') }
      ];
    }

    const users = await User.find(query)
      .select('-password -rawPassword')
      .populate('departmentIds', 'name')
      .sort({ firstName: 1 });

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
    const { companyId, name, description, permissions, level } = req.body;

    // 1. Scoping Check
    if (!user.isSuperAdmin && companyId !== user.companyId?.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized: Company scoping violation' });
    }

    // 2. Protect SuperAdmin role (level 0) creation
    if (!user.isSuperAdmin && level === 0) {
      return res.status(403).json({ success: false, message: 'Forbidden: Cannot create super-admin roles' });
    }

    const targetCompanyId = companyId || user.companyId?.toString();
    if (!targetCompanyId) {
      return res.status(400).json({ success: false, message: 'companyId is required' });
    }

    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'Role name is required' });
    }

    const role = new Role({
      companyId: targetCompanyId,
      name: name.trim(),
      description: description?.trim(),
      permissions: permissions || [],
      notificationSettings: req.body.notificationSettings || { email: true, whatsapp: true },
      isSystem: false,
      createdBy: user._id
    });

    await role.save();

    await logUserAction(req, AuditAction.CREATE, 'Role', role._id.toString(), { roleName: role.name });

    res.status(201).json({ success: true, data: { role }, message: 'Role created successfully' });
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
    let role = await Role.findById(req.params.id);

    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });
    
    if (!canModifyRole(req, role)) {
      return res.status(403).json({ success: false, message: 'Unauthorized: You do not have permission to modify this role' });
    }

    const { name, description, permissions, companyId } = req.body;

    // 🛡️ ROLE FORKING LOGIC
    // If this is a global system role and we're editing it for a specific company,
    // we fork (clone) it instead of modifying the global one.
    if ((role.isSystem || !role.companyId) && companyId && user.isSuperAdmin) {
      console.log(`[RoleForking] Cloning system role "${role.name}" for company "${companyId}"`);
      
      // Check if a role with this key/name already exists for this company
      const existingRole = await Role.findOne({
        companyId,
        $or: [{ key: role.key }, { name: name || role.name }]
      });

      if (existingRole) {
        role = existingRole;
        console.log(`[RoleForking] Found existing company role "${role._id}", updating it instead.`);
      } else {
        // Create a new company-specific override
        const forkedRole = new Role({
          companyId,
          name: (name || role.name).trim(),
          key: role.key, // Keep the same key (e.g., COMPANY_ADMIN) to maintain logic compatibility
          description: (description || role.description || '').trim(),
          permissions: permissions || role.permissions,
          level: role.level,
          isSystem: false, // It's no longer the global system role
          createdBy: user._id
        });
        role = forkedRole;
      }
    }

    if (name && !role.isSystem) role.name = name.trim();
    if (description !== undefined) role.description = description?.trim();
    if (permissions !== undefined) role.permissions = permissions;
    if (req.body.notificationSettings !== undefined) role.notificationSettings = req.body.notificationSettings;
    role.updatedBy = user._id;

    await role.save();

    await logUserAction(req, AuditAction.UPDATE, 'Role', role._id.toString(), { 
      roleName: role.name,
      isForked: !!companyId && user.isSuperAdmin
    });

    res.json({ success: true, data: { role }, message: 'Role updated successfully' });
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
    const role = await Role.findById(req.params.id);

    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });
    
    if (!canModifyRole(req, role)) {
      return res.status(403).json({ success: false, message: 'Unauthorized: You do not have permission to delete this role' });
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
    const { userId } = req.body;

    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });

    if (!canModifyRole(req, role)) {
      return res.status(403).json({ success: false, message: 'Unauthorized: You do not have permission to assign this role' });
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
