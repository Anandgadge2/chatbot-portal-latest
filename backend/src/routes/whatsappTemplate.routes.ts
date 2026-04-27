import express, { Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { requireDatabaseConnection } from '../middleware/dbConnection';
import WhatsAppTemplate from '../models/WhatsAppTemplate';
import WhatsAppTemplateSyncLog from '../models/WhatsAppTemplateSyncLog';
import CompanyTemplateMapping from '../models/CompanyTemplateMapping';
import CompanyWhatsAppConfig from '../models/CompanyWhatsAppConfig';
import { syncTemplatesForCompany } from '../services/whatsappTemplateSyncService';
import { UserRole } from '../config/constants';

const router = express.Router();

router.use(requireDatabaseConnection);
router.use(authenticate);
router.use((req: Request, res: Response, next) => {
  if (req.user?.isSuperAdmin || req.user?.role === UserRole.COMPANY_ADMIN) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Admin access required.' });
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, status, language, category, companyId, search, approvedOnly } = req.query as any;

    const query: any = { isActive: true };
    if (companyId) {
      query.companyId = companyId;
      // Filter by current WABA if companyId is provided
      const config = await CompanyWhatsAppConfig.findOne({ companyId, isActive: true }).lean();
      if (config?.businessAccountId) {
        query.businessAccountId = config.businessAccountId;
      }
    }
    if (status) query.status = status;
    if (approvedOnly === 'true') query.status = 'APPROVED';
    if (language) query.language = language;
    if (category) query.category = category;
    if (search) query.name = { $regex: search, $options: 'i' };

    const templates = await WhatsAppTemplate.find(query)
      .sort({ updatedAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await WhatsAppTemplate.countDocuments(query);

    const templateNames = templates.map((template) => template.name);
    const mappings = companyId
      ? await CompanyTemplateMapping.find({
        companyId,
        templateName: { $in: templateNames }
      })
      : [];

    const mappingByTemplate = mappings.reduce<Record<string, Record<string, string>>>((acc, entry) => {
      const mapSource = entry.mappings instanceof Map ? Object.fromEntries(entry.mappings.entries()) : Object(entry.mappings || {});
      acc[entry.templateName] = mapSource as Record<string, string>;
      return acc;
    }, {});

    const serializedTemplates = templates.map((template) => ({
      ...template.toObject(),
      mapping: mappingByTemplate[template.name] || {}
    }));

    res.json({
      success: true,
      data: serializedTemplates,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/mapping', async (req: Request, res: Response) => {
  try {
    const { companyId, templateName, mappings } = req.body as {
      companyId?: string;
      templateName?: string;
      mappings?: Record<string, string>;
    };

    if (!companyId || !templateName || !mappings || typeof mappings !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'companyId, templateName and mappings are required'
      });
    }

    const updated = await CompanyTemplateMapping.findOneAndUpdate(
      { companyId, templateName },
      { $set: { mappings } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.json({
      success: true,
      data: {
        companyId,
        templateName,
        mappings: updated?.mappings instanceof Map
          ? Object.fromEntries(updated.mappings.entries())
          : Object(updated?.mappings || {})
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/logs', async (req: Request, res: Response) => {
  try {
    const { companyId, page = 1, limit = 20 } = req.query as any;
    const query: any = {};
    if (companyId) query.companyId = companyId;

    const logs = await WhatsAppTemplateSyncLog.find(query)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await WhatsAppTemplateSyncLog.countDocuments(query);

    res.json({
      success: true,
      data: logs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  const template = await WhatsAppTemplate.findById(req.params.id);
  if (!template) {
    return res.status(404).json({ success: false, message: 'Template not found' });
  }

  return res.json({ success: true, data: template });
});

router.post('/sync', async (req: Request, res: Response) => {
  try {
    const { companyId } = req.body;
    if (!companyId) {
      return res.status(400).json({ success: false, message: 'companyId is required' });
    }

    const result = await syncTemplatesForCompany(companyId);
    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/sync-templates', async (req: Request, res: Response) => {
  try {
    const { companyId } = req.body;
    if (!companyId) {
      return res.status(400).json({ success: false, message: 'companyId is required' });
    }

    const result = await syncTemplatesForCompany(companyId);
    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/:id/activate', async (req: Request, res: Response) => {
  const { isActive } = req.body;
  if (typeof isActive !== 'boolean') {
    return res.status(400).json({ success: false, message: 'isActive must be boolean' });
  }

  const template = await WhatsAppTemplate.findByIdAndUpdate(
    req.params.id,
    { $set: { isActive } },
    { new: true }
  );

  if (!template) {
    return res.status(404).json({ success: false, message: 'Template not found' });
  }

  return res.json({ success: true, data: template });
});

export default router;
