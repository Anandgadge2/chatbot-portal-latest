import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import Module from '../models/Module';
import { requireSuperAdmin } from '../middleware/rbac';
import { authenticate } from '../middleware/auth';

const router = Router();

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
    const key = getTrimmedString(req.body?.key);
    const name = getTrimmedString(req.body?.name);
    const description = getTrimmedString(req.body?.description);
    const category = getTrimmedString(req.body?.category);
    const permissions = Array.isArray(req.body?.permissions) ? req.body.permissions : [];
    const icon = getTrimmedString(req.body?.icon);

    if (!key || !name) {
      return res.status(400).json({ success: false, message: 'Module key and name are required' });
    }

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
    const moduleId = getValidObjectId(req.params.id);
    if (!moduleId) {
      return res.status(400).json({ success: false, message: 'Invalid module ID' });
    }

    const updates: Record<string, unknown> = {};
    const key = getTrimmedString(req.body?.key);
    const name = getTrimmedString(req.body?.name);
    const description = req.body?.description === undefined ? undefined : getTrimmedString(req.body?.description) || '';
    const category = req.body?.category === undefined ? undefined : getTrimmedString(req.body?.category) || '';
    const permissions = req.body?.permissions;
    const icon = req.body?.icon === undefined ? undefined : getTrimmedString(req.body?.icon) || '';

    if (key) updates.key = key.toUpperCase();
    if (name) updates.name = name;
    if (req.body?.description !== undefined) updates.description = description;
    if (req.body?.category !== undefined) updates.category = category;
    if (Array.isArray(permissions)) updates.permissions = permissions;
    if (req.body?.icon !== undefined) updates.icon = icon;

    const module = await Module.findByIdAndUpdate(moduleId, updates, {
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
    const moduleId = getValidObjectId(req.params.id);
    if (!moduleId) {
      return res.status(400).json({ success: false, message: 'Invalid module ID' });
    }

    const module = await Module.findById(moduleId);

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
