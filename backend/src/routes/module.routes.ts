import { Router, Request, Response } from 'express';
import Module from '../models/Module';
import { requireSuperAdmin } from '../middleware/rbac';
import { authenticate } from '../middleware/auth';

const router = Router();

const sanitizeModulePermissions = (input: unknown): Array<{ action: string; label: string }> => {
  const safePermissions: Array<{ action: string; label: string }> = [];

  if (!Array.isArray(input)) {
    return safePermissions;
  }

  for (const permission of input) {
    if (
      permission &&
      typeof permission === 'object' &&
      typeof (permission as any).action === 'string' &&
      typeof (permission as any).label === 'string'
    ) {
      safePermissions.push({
        action: (permission as any).action,
        label: (permission as any).label
      });
    }
  }

  return safePermissions;
};

// Apply authentication to all module management routes
router.use(authenticate);

/**
 * @route   GET /api/modules
 * @desc    Get all available modules
 * @access  SuperAdmin
 */
router.get('/', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const modules = await Module.find().sort({ category: 1, name: 1 });
    res.json({ success: true, count: modules.length, data: modules });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * @route   POST /api/modules
 * @desc    Create a new module
 * @access  SuperAdmin
 */
router.post('/', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { key, name, description, category, permissions, icon } = req.body;

    const existing = await Module.findOne({ key: key.toUpperCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Module key already exists' });
    }

    const module = new Module({
      key: key.toUpperCase(),
      name,
      description,
      category,
      permissions,
      icon
    });

    await module.save();
    res.status(201).json({ success: true, data: module });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * @route   PUT /api/modules/:id
 * @desc    Update a module
 * @access  SuperAdmin
 */
router.put('/:id', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const updates: Record<string, unknown> = {};

    if (typeof req.body.key === 'string') updates.key = req.body.key.toUpperCase();
    if (typeof req.body.name === 'string') updates.name = req.body.name;
    if (typeof req.body.description === 'string') updates.description = req.body.description;
    if (typeof req.body.category === 'string') updates.category = req.body.category;
    if (typeof req.body.icon === 'string') updates.icon = req.body.icon;
    if (typeof req.body.isActive === 'boolean') updates.isActive = req.body.isActive;
    if (typeof req.body.isSystem === 'boolean') updates.isSystem = req.body.isSystem;

    if (req.body.permissions !== undefined) {
      updates.permissions = sanitizeModulePermissions(req.body.permissions);
    }

    const module = await Module.findByIdAndUpdate(req.params.id, { $set: updates }, {
      new: true,
      runValidators: true
    });

    if (!module) {
      return res.status(404).json({ success: false, message: 'Module not found' });
    }

    res.json({ success: true, data: module });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * @route   DELETE /api/modules/:id
 * @desc    Delete a module (if not system)
 * @access  SuperAdmin
 */
router.delete('/:id', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const module = await Module.findById(req.params.id);

    if (!module) {
      return res.status(404).json({ success: false, message: 'Module not found' });
    }

    if (module.isSystem) {
      return res.status(400).json({ success: false, message: 'System modules cannot be deleted' });
    }

    await module.deleteOne();
    res.json({ success: true, message: 'Module deleted' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * @route   POST /api/modules/seed
 * @desc    Seed default modules
 * @access  SuperAdmin
 */
/**
 * @route   POST /api/modules/sync-all
 * @desc    Sync modules and roles for ALL companies
 * @access  SuperAdmin
 */
router.post('/sync-all', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const Company = (await import('../models/Company')).default;

    console.log('🚀 Manual System Sync Triggered');
    
    // 1. Sync Modules (Already global in Module collection)
    console.log('Syncing modules...');

    // 2. Sync Roles for all companies (REMOVED: roles are now fully dynamic and manual)
    // Seeding is no longer supported per system requirements.
    const companies = await Company.find({});
    
    res.json({ 
      success: true, 
      message: 'System-wide synchronization complete',
      processedCompanies: companies.length
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
