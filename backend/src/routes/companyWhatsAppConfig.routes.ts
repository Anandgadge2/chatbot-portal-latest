import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import CompanyWhatsAppConfig from '../models/CompanyWhatsAppConfig';
import CompanyWhatsAppTemplate from '../models/CompanyWhatsAppTemplate';
import { authenticate } from '../middleware/auth';
import { requireSuperAdmin } from '../middleware/rbac';

const WHATSAPP_TEMPLATE_KEYS = [
  'grievance_created', 'grievance_assigned', 'grievance_resolved',
  'appointment_created', 'appointment_assigned', 'appointment_resolved'
];

const router = express.Router();

/**
 * @route   GET /api/whatsapp-config
 * @desc    Get all WhatsApp configurations (superadmin only)
 * @access  Private/SuperAdmin
 */
router.get('/', authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const configs = await CompanyWhatsAppConfig.find()
      .populate('companyId', 'name companyId')
      .populate('activeFlows.flowId', 'flowName flowType')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: configs
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch WhatsApp configurations',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/whatsapp-config/company/:companyId
 * @desc    Get WhatsApp config for a specific company
 * @access  Private
 */
router.get('/company/:companyId', authenticate, async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    
    // Convert to ObjectId if it's a valid ObjectId string
    let query: any = {};
    if (mongoose.Types.ObjectId.isValid(companyId)) {
      query.companyId = new mongoose.Types.ObjectId(companyId);
    } else {
      // If not a valid ObjectId, try to find company by companyId string first
      const Company = (await import('../models/Company')).default;
      const company = await Company.findOne({ companyId: companyId });
      if (company) {
        query.companyId = company._id;
      } else {
        return res.status(404).json({
          success: false,
          message: 'Company not found'
        });
      }
    }
    
    const config = await CompanyWhatsAppConfig.findOne(query)
      .populate('activeFlows.flowId', 'flowName flowType isActive');

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'WhatsApp configuration not found'
      });
    }

    res.json({
      success: true,
      data: config
    });
  } catch (error: any) {
    console.error('❌ Error fetching WhatsApp config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch WhatsApp configuration',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/whatsapp-config/phone/:phoneNumberId
 * @desc    Get WhatsApp config by phone number ID (for webhook routing)
 * @access  Public (used by webhook)
 */
router.get('/phone/:phoneNumberId', async (req: Request, res: Response) => {
  try {
    const config = await CompanyWhatsAppConfig.findOne({ 
      phoneNumberId: req.params.phoneNumberId,
      isActive: true
    }).populate('companyId');

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'WhatsApp configuration not found'
      });
    }

    res.json({
      success: true,
      data: config
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch WhatsApp configuration',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/whatsapp-config
 * @desc    Create or update WhatsApp configuration (superadmin only)
 * @access  Private/SuperAdmin
 * @note    If config exists for company, it will update instead of create
 */
router.post('/', authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { companyId, phoneNumberId, phoneNumber } = req.body;
    
    // Validate companyId
    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID is required'
      });
    }
    
    // Check if config already exists for this company
    const existing = await CompanyWhatsAppConfig.findOne({ companyId });
    
    if (existing) {
      // Check if phoneNumberId or phoneNumber conflicts with another company's config
      if (phoneNumberId && phoneNumberId !== existing.phoneNumberId) {
        const conflictByPhoneId = await CompanyWhatsAppConfig.findOne({ 
          phoneNumberId, 
          _id: { $ne: existing._id } 
        });
        if (conflictByPhoneId) {
          return res.status(400).json({
            success: false,
            message: `Phone Number ID ${phoneNumberId} is already used by another company (${conflictByPhoneId.companyId})`
          });
        }
      }
      
      if (phoneNumber && phoneNumber !== existing.phoneNumber) {
        const conflictByPhone = await CompanyWhatsAppConfig.findOne({ 
          phoneNumber, 
          _id: { $ne: existing._id } 
        });
        if (conflictByPhone) {
          return res.status(400).json({
            success: false,
            message: `Phone Number ${phoneNumber} is already used by another company (${conflictByPhone.companyId})`
          });
        }
      }
      
      // Sanitized update
      const updateData = { ...req.body };
      const internalFields = ['_id', 'companyId', 'createdAt', 'updatedAt', '__v', 'createdBy', 'stats', 'isVerified', 'verifiedAt'];
      internalFields.forEach(field => delete (updateData as any)[field]);

      // Handle populated activeFlows
      if (Array.isArray(updateData.activeFlows)) {
        updateData.activeFlows = updateData.activeFlows.map((flow: any) => {
          if (flow.flowId && typeof flow.flowId === 'object' && flow.flowId._id) {
            return { ...flow, flowId: flow.flowId._id };
          }
          return flow;
        });
      }
      
      Object.assign(existing, updateData);
      existing.updatedBy = user._id;
      await existing.save();

      return res.json({
        success: true,
        message: 'WhatsApp configuration updated successfully',
        data: existing
      });
    }

    // Check for conflicts before creating new config
    if (phoneNumberId) {
      const conflictByPhoneId = await CompanyWhatsAppConfig.findOne({ phoneNumberId });
      if (conflictByPhoneId) {
        return res.status(400).json({
          success: false,
          message: `Phone Number ID ${phoneNumberId} is already used by another company`
        });
      }
    }
    
    if (phoneNumber) {
      const conflictByPhone = await CompanyWhatsAppConfig.findOne({ phoneNumber });
      if (conflictByPhone) {
        return res.status(400).json({
          success: false,
          message: `Phone Number ${phoneNumber} is already used by another company`
        });
      }
    }

    // Sanitized create data
    const createData = { ...req.body };
    const internalFields = ['_id', 'createdAt', 'updatedAt', '__v', 'stats', 'isVerified', 'verifiedAt'];
    internalFields.forEach(field => delete (createData as any)[field]);

    // Handle populated activeFlows
    if (Array.isArray(createData.activeFlows)) {
      createData.activeFlows = createData.activeFlows.map((flow: any) => {
        if (flow.flowId && typeof flow.flowId === 'object' && flow.flowId._id) {
          return { ...flow, flowId: flow.flowId._id };
        }
        return flow;
      });
    }

    // Create new config
    const config = await CompanyWhatsAppConfig.create({
      ...createData,
      createdBy: user._id
    });

    res.status(201).json({
      success: true,
      message: 'WhatsApp configuration created successfully',
      data: config
    });
  } catch (error: any) {
    console.error('❌ Error saving WhatsApp config:', error);
    
    // Pass to global error handler for proper status codes (400 for validation/duplicate)
    throw error;
  }
});

/**
 * @route   PUT /api/whatsapp-config/:id
 * @desc    Update WhatsApp configuration (superadmin only)
 * @access  Private/SuperAdmin
 */
router.put('/:id', authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { phoneNumberId, phoneNumber } = req.body;
    
    const config = await CompanyWhatsAppConfig.findById(req.params.id);
    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'WhatsApp configuration not found'
      });
    }

    // Check for conflicts with other configs
    if (phoneNumberId && phoneNumberId !== config.phoneNumberId) {
      const conflict = await CompanyWhatsAppConfig.findOne({ 
        phoneNumberId, 
        _id: { $ne: config._id } 
      });
      if (conflict) {
        return res.status(400).json({
          success: false,
          message: `Phone Number ID ${phoneNumberId} is already used by another company`
        });
      }
    }
    
    if (phoneNumber && phoneNumber !== config.phoneNumber) {
      const conflict = await CompanyWhatsAppConfig.findOne({ 
        phoneNumber, 
        _id: { $ne: config._id } 
      });
      if (conflict) {
        return res.status(400).json({
          success: false,
          message: `Phone Number ${phoneNumber} is already used by another company`
        });
      }
    }

    // Sanitized update
    const updateData = { ...req.body };
    const internalFields = ['_id', 'companyId', 'createdAt', 'updatedAt', '__v', 'createdBy', 'stats', 'isVerified', 'verifiedAt'];
    internalFields.forEach(field => delete (updateData as any)[field]);

    // Handle populated activeFlows
    if (Array.isArray(updateData.activeFlows)) {
      updateData.activeFlows = updateData.activeFlows.map((flow: any) => {
        if (flow.flowId && typeof flow.flowId === 'object' && flow.flowId._id) {
          return { ...flow, flowId: flow.flowId._id };
        }
        return flow;
      });
    }

    Object.assign(config, updateData);
    config.updatedBy = user._id;
    
    await config.save();

    res.json({
      success: true,
      message: 'WhatsApp configuration updated successfully',
      data: config
    });
  } catch (error: any) {
    console.error('❌ Error updating WhatsApp config:', error);
    // Throwing here will be caught by express-async-errors and passed to our global errorHandler
    throw error;
  }
});

/**
 * @route   POST /api/whatsapp-config/:id/assign-flow
 * @desc    Assign a flow to WhatsApp configuration
 * @access  Private/SuperAdmin
 */
router.post('/:id/assign-flow', authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { flowId, flowType, priority } = req.body;
    const { id } = req.params;
    
    console.log('🔗 Assigning flow to WhatsApp config:', {
      configId: id,
      flowId,
      flowIdType: typeof flowId,
      flowIdValue: flowId,
      flowType,
      priority,
      requestBody: req.body
    });
    
    // Validate required fields
    if (!flowId) {
      console.error('❌ Flow ID is missing from request body');
      return res.status(400).json({
        success: false,
        message: 'Flow ID is required'
      });
    }
    
    // Validate ObjectId format for config ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.error(`❌ Invalid WhatsApp config ID format: ${id}`);
      return res.status(400).json({
        success: false,
        message: `Invalid WhatsApp configuration ID format: ${id}. Expected MongoDB ObjectId.`
      });
    }
    
    // Validate ObjectId format for flow ID
    const flowIdStr = String(flowId).trim();
    if (!mongoose.Types.ObjectId.isValid(flowIdStr)) {
      console.error(`❌ Invalid flow ID format:`, {
        flowId: flowIdStr,
        type: typeof flowId,
        length: flowIdStr.length,
        isValid: mongoose.Types.ObjectId.isValid(flowIdStr)
      });
      return res.status(400).json({
        success: false,
        message: `Invalid flow ID format: ${flowIdStr}. Expected MongoDB ObjectId (_id), not flowId string. Please use the flow's _id field. The ID should be 24 hexadecimal characters.`
      });
    }
    
    // Convert to ObjectId
    const flowObjectId = new mongoose.Types.ObjectId(flowId);
    
    const config = await CompanyWhatsAppConfig.findById(id);
    if (!config) {
      console.error(`❌ WhatsApp config not found: ${id}`);
      return res.status(404).json({
        success: false,
        message: 'WhatsApp configuration not found'
      });
    }

    // ✅ Defensive: clean up any corrupted entries (e.g., { flowId: null })
    if (Array.isArray(config.activeFlows) && config.activeFlows.length > 0) {
      const before = config.activeFlows.length;
      config.activeFlows = config.activeFlows.filter((f: any) => f?.flowId);
      const after = config.activeFlows.length;
      if (after !== before) {
        console.warn(`🧹 Cleaned corrupted activeFlows entries: ${before - after} removed`);
        await config.save();
      }
    }

    // Check if flow already assigned
    const existing = config.activeFlows.find((f: any) => f?.flowId && f.flowId.toString() === flowIdStr);
    if (existing) {
      console.warn(`⚠️ Flow already assigned: ${flowId}`);
      return res.status(400).json({
        success: false,
        message: 'Flow already assigned to this configuration'
      });
    }

    // Add flow to activeFlows
    config.activeFlows.push({
      flowId: flowObjectId,
      flowType: flowType || 'custom',
      isActive: true,
      priority: priority || 0
    } as any);

    await config.save();

    // CRITICAL: Activate the flow in ChatbotFlow model
    // This ensures the flow is active and will be used by the chatbot engine
    try {
      const ChatbotFlow = (await import('../models/ChatbotFlow')).default;
      const flow = await ChatbotFlow.findById(flowObjectId);
      if (flow) {
        // Deactivate other flows for this company
        await ChatbotFlow.updateMany(
          { 
            companyId: config.companyId, 
            _id: { $ne: flow._id }
          },
          { isActive: false }
        );
        // Activate this flow
        flow.isActive = true;
        await flow.save();
        console.log(`✅ Flow activated: ${flow.flowId || flowId}`);
      } else {
        console.warn(`⚠️ Flow not found: ${flowId}`);
      }
    } catch (flowError: any) {
      // Log but don't fail - assignment to config is more important
      console.error('❌ Could not activate flow in ChatbotFlow model:', flowError.message);
    }

    console.log(`✅ Flow assigned successfully: ${flowId} to config ${id}`);

    res.json({
      success: true,
      message: 'Flow assigned successfully',
      data: config
    });
  } catch (error: any) {
    console.error('❌ Error assigning flow:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      message: error?.message ? `Failed to assign flow: ${error.message}` : 'Failed to assign flow',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/whatsapp-config/:id/flow/:flowId
 * @desc    Remove a flow from WhatsApp configuration
 * @access  Private/SuperAdmin
 */
router.delete('/:id/flow/:flowId', authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const config = await CompanyWhatsAppConfig.findById(req.params.id);
    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'WhatsApp configuration not found'
      });
    }

    // ✅ Defensive cleanup of corrupted entries
    if (Array.isArray(config.activeFlows) && config.activeFlows.length > 0) {
      config.activeFlows = config.activeFlows.filter((f: any) => f?.flowId);
    }

    const flowIdStr = String(req.params.flowId).trim();
    if (!mongoose.Types.ObjectId.isValid(flowIdStr)) {
      return res.status(400).json({
        success: false,
        message: `Invalid flow ID format: ${flowIdStr}. Expected MongoDB ObjectId.`
      });
    }

    config.activeFlows = config.activeFlows.filter(
      (f: any) => f?.flowId && f.flowId.toString() !== flowIdStr
    );

    await config.save();

    res.json({
      success: true,
      message: 'Flow removed successfully',
      data: config
    });
  } catch (error: any) {
    console.error('❌ Error removing flow from WhatsApp config:', error);
    res.status(500).json({
      success: false,
      message: error?.message ? `Failed to remove flow: ${error.message}` : 'Failed to remove flow',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/whatsapp-config/company/:companyId/templates
 * @desc    Get WhatsApp message templates for a company
 * @access  Private
 */
router.get('/company/:companyId/templates', authenticate, async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    let cid: mongoose.Types.ObjectId;
    if (mongoose.Types.ObjectId.isValid(companyId)) {
      cid = new mongoose.Types.ObjectId(companyId);
    } else {
      const Company = (await import('../models/Company')).default;
      const company = await Company.findOne({ companyId });
      if (!company) {
        return res.status(404).json({ success: false, message: 'Company not found' });
      }
      cid = company._id;
    }
    const templates = await CompanyWhatsAppTemplate.find({ companyId: cid });
    const byKey: Record<string, { message: string; isActive: boolean }> = {};
    templates.forEach(t => { byKey[t.templateKey] = { message: t.message, isActive: t.isActive }; });
    const list = WHATSAPP_TEMPLATE_KEYS.map(key => ({ templateKey: key, ...byKey[key] }));
    res.json({ success: true, data: list });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch WhatsApp templates',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/whatsapp-config/company/:companyId/templates
 * @desc    Upsert WhatsApp message templates for a company (superadmin only)
 * @access  Private/SuperAdmin
 */
router.put('/company/:companyId/templates', authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const { templates } = req.body as { templates: Array<{ templateKey: string; message: string }> };
    let cid: mongoose.Types.ObjectId;
    if (mongoose.Types.ObjectId.isValid(companyId)) {
      cid = new mongoose.Types.ObjectId(companyId);
    } else {
      const Company = (await import('../models/Company')).default;
      const company = await Company.findOne({ companyId });
      if (!company) return res.status(404).json({ success: false, message: 'Company not found' });
      cid = company._id;
    }
    if (!Array.isArray(templates)) {
      return res.status(400).json({ success: false, message: 'templates array required' });
    }
    for (const t of templates) {
      if (!t.templateKey || !WHATSAPP_TEMPLATE_KEYS.includes(t.templateKey)) continue;
      await CompanyWhatsAppTemplate.findOneAndUpdate(
        { companyId: cid, templateKey: t.templateKey },
        { message: t.message ?? '', isActive: true },
        { upsert: true, new: true }
      );
    }
    const updated = await CompanyWhatsAppTemplate.find({ companyId: cid });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to save WhatsApp templates',
      error: error.message
    });
  }
});

export default router;
