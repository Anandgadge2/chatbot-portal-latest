import { Router, Request, Response } from 'express';
import Module from '../models/Module';
import { requireSuperAdmin } from '../middleware/rbac';
import { authenticate } from '../middleware/auth';

const router = Router();

// Apply authentication to all module management routes
router.use(authenticate);

/**
 * @route   GET /api/modules?companyId=...
 * @desc    Get all available modules or filter by company enablement
 * @access  Authenticated (Company Admin or Super Admin)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { companyId } = req.query;
    let modules = await Module.find().sort({ category: 1, name: 1 });

    if (companyId) {
      const Company = (await import('../models/Company')).default;
      const company = await Company.findById(companyId);
      if (company && company.enabledModules) {
        // Return only modules that are in the company's enabledModules list
        modules = modules.filter(m => company.enabledModules.includes(m.key));
      }
    }

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
    const module = await Module.findByIdAndUpdate(req.params.id, req.body, {
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
