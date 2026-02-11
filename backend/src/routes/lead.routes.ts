import express, { Request, Response } from 'express';
import Lead from '../models/Lead';
import { requireDatabaseConnection } from '../middleware/dbConnection';
import { LeadStatus } from '../config/constants';

const router = express.Router();

router.use(requireDatabaseConnection);

/**
 * @route   POST /api/leads/chatbot
 * @desc    Submit a lead from the chatbot flow
 * @access  Public (via Chatbot API Call node)
 */
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

/**
 * @route   GET /api/leads
 * @desc    Get leads for a company
 * @access  Private (Authentication handled by separate middleware if needed)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { companyId } = req.query;
    if (!companyId) return res.status(400).json({ success: false, message: 'companyId is required' });

    const leads = await Lead.find({ companyId }).sort({ createdAt: -1 });
    res.json({ success: true, data: leads });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
