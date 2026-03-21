import express, { Request, Response } from 'express';
import Lead from '../models/Lead';
import { authenticate } from '../middleware/auth';
import { requireDatabaseConnection } from '../middleware/dbConnection';
import Company from '../models/Company';
import { LeadStatus, Module, UserRole } from '../config/constants';

const router = express.Router();

router.use(requireDatabaseConnection);

// Submit lead from chatbot (Public)
router.post('/chatbot', async (req: Request, res: Response) => {
  try {
    const { 
      companyId, 
      name, 
      companyName, 
      projectType, 
      projectDescription, 
      budgetRange, 
      timeline, 
      contactInfo 
    } = req.body;

    if (!companyId || !name || !projectType || !contactInfo) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: companyId, name, projectType, contactInfo'
      });
    }

    const lead = new Lead({
      companyId,
      name,
      companyName,
      projectType,
      projectDescription,
      budgetRange,
      timeline,
      contactInfo,
      source: 'whatsapp',
      status: LeadStatus.NEW
    });

    await lead.save();

    console.log(`✅ New Lead created for company ${companyId}: ${lead.leadId}`);

    res.status(201).json({
      success: true,
      message: 'Lead submitted successfully',
      data: {
        leadId: lead.leadId,
        name: lead.name
      }
    });
  } catch (error: any) {
    console.error('❌ Error creating lead from chatbot:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit lead',
      error: error.message
    });
  }
});

// Protected routes - require authentication
router.use(authenticate);

/**
 * @route   GET /api/leads
 * @desc    Get leads for a company
 * @access  Private
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { companyId, page = 1, limit = 25 } = req.query;
    if (!companyId) return res.status(400).json({ success: false, message: 'companyId is required' });

    // ✅ Multi-Tenant Scoping Check
    const currentUser = req.user!;
    if (currentUser.role !== UserRole.SUPER_ADMIN && companyId !== currentUser.companyId?.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied - you can only view leads for your own company' });
    }

    // Validate that the company has the LEAD_CAPTURE module enabled
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    if (!company.enabledModules?.includes(Module.LEAD_CAPTURE)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Lead Capture module is not enabled for this company' 
      });
    }

    const leads = await Lead.find({ companyId })
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await Lead.countDocuments({ companyId });

    res.json({
      success: true,
      data: leads,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
