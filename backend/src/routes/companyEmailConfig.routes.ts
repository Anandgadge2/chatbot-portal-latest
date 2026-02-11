import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import CompanyEmailConfig from '../models/CompanyEmailConfig';
import CompanyEmailTemplate from '../models/CompanyEmailTemplate';
import Company from '../models/Company';
import { authenticate } from '../middleware/auth';
import { requireSuperAdmin } from '../middleware/rbac';
import nodemailer from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';

const router = express.Router();

const TEMPLATE_KEYS = [
  'grievance_created', 'grievance_assigned', 'grievance_resolved',
  'appointment_created', 'appointment_assigned', 'appointment_resolved'
] as const;

/**
 * @route   GET /api/email-config
 * @desc    Get all email configurations (superadmin only)
 */
router.get('/', authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const configs = await CompanyEmailConfig.find()
      .populate('companyId', 'name companyId')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: configs
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch email configurations',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/email-config/company/:companyId
 * @desc    Get email config for a specific company (sensitive fields masked in list; full for edit)
 */
router.get('/company/:companyId', authenticate, async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    let query: any = {};
    if (mongoose.Types.ObjectId.isValid(companyId)) {
      query.companyId = new mongoose.Types.ObjectId(companyId);
    } else {
      const company = await Company.findOne({ companyId });
      if (!company) {
        return res.status(404).json({ success: false, message: 'Company not found' });
      }
      query.companyId = company._id;
    }

    const config = await CompanyEmailConfig.findOne(query);
    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Email configuration not found'
      });
    }

    // Return full config (needed for edit); frontend should not log auth.pass
    res.json({
      success: true,
      data: config
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch email configuration',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/email-config
 * @desc    Create or update email configuration by companyId (superadmin only)
 */
router.post('/', authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { companyId, host, port, secure, auth, fromEmail, fromName, isActive } = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID is required'
      });
    }
    if (!host || !auth?.user || !auth?.pass || !fromEmail || !fromName) {
      return res.status(400).json({
        success: false,
        message: 'host, auth.user, auth.pass, fromEmail, and fromName are required'
      });
    }

    const portNum = Number(port) || 465;
    const secureBool = secure !== false && portNum === 465;

    const payload = {
      companyId,
      host: String(host).trim(),
      port: portNum,
      secure: secureBool,
      auth: {
        user: String(auth.user).trim(),
        pass: String(auth.pass)
      },
      fromEmail: String(fromEmail).trim().toLowerCase(),
      fromName: String(fromName).trim(),
      isActive: isActive !== false
    };

    const existing = await CompanyEmailConfig.findOne({ companyId });
    if (existing) {
      existing.host = payload.host;
      existing.port = payload.port;
      existing.secure = payload.secure;
      existing.auth = payload.auth;
      existing.fromEmail = payload.fromEmail;
      existing.fromName = payload.fromName;
      existing.isActive = payload.isActive;
      existing.updatedBy = user._id;
      await existing.save();
      return res.json({
        success: true,
        message: 'Email configuration updated successfully',
        data: existing
      });
    }

    const config = await CompanyEmailConfig.create({
      ...payload,
      createdBy: user._id
    });

    res.status(201).json({
      success: true,
      message: 'Email configuration created successfully',
      data: config
    });
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Email configuration already exists for this company',
        error: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to save email configuration',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/email-config/:id
 * @desc    Update email configuration (superadmin only)
 */
router.put('/:id', authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const config = await CompanyEmailConfig.findById(req.params.id);
    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Email configuration not found'
      });
    }

    const { host, port, secure, auth, fromEmail, fromName, isActive } = req.body;
    if (host !== undefined) config.host = String(host).trim();
    if (port !== undefined) config.port = Number(port) || 465;
    if (secure !== undefined) config.secure = Boolean(secure);
    if (auth) {
      if (auth.user !== undefined) config.auth.user = String(auth.user).trim();
      if (auth.pass !== undefined) config.auth.pass = String(auth.pass);
    }
    if (fromEmail !== undefined) config.fromEmail = String(fromEmail).trim().toLowerCase();
    if (fromName !== undefined) config.fromName = String(fromName).trim();
    if (isActive !== undefined) config.isActive = Boolean(isActive);
    config.updatedBy = user._id;
    await config.save();

    res.json({
      success: true,
      message: 'Email configuration updated successfully',
      data: config
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to update email configuration',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/email-config/company/:companyId/test
 * @desc    Test SMTP connection for a company's email config
 */
router.post('/company/:companyId/test', authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const { host, port, secure, auth } = req.body;
    
    let configToTest: any;

    if (host && auth?.user && auth?.pass) {
      // Use provided settings for testing before save
      configToTest = {
        host,
        port: Number(port) || 465,
        secure: secure === undefined ? (Number(port) === 465) : Boolean(secure),
        auth
      };
    } else {
      // Fetch from database
      let query: any = {};
      if (mongoose.Types.ObjectId.isValid(companyId)) {
        query.companyId = new mongoose.Types.ObjectId(companyId);
      } else {
        const company = await Company.findOne({ companyId });
        if (!company) {
          return res.status(404).json({ success: false, message: 'Company not found' });
        }
        query.companyId = company._id;
      }

      configToTest = await CompanyEmailConfig.findOne(query);
      if (!configToTest) {
        return res.status(404).json({
          success: false,
          message: 'Email configuration not found for this company'
        });
      }
    }

    const transport = nodemailer.createTransport({
      host: configToTest.host,
      port: configToTest.port,
      secure: configToTest.secure,
      requireTLS: configToTest.port === 587,
      auth: configToTest.auth,
      tls: { 
        rejectUnauthorized: true,
        // Some older servers might need this, but for security we keep it true by default
      }
    } as SMTPTransport.Options);

    await transport.verify();

    res.json({
      success: true,
      message: 'SMTP connection successful'
    });
  } catch (error: any) {
    console.error('SMTP test error:', error);
    res.status(400).json({
      success: false,
      message: 'SMTP test failed',
      error: error.message || 'Connection or authentication failed'
    });
  }
});

/**
 * @route   GET /api/email-config/company/:companyId/templates
 * @desc    Get email templates for a company (superadmin or company admin)
 */
router.get('/company/:companyId/templates', authenticate, async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const query: any = mongoose.Types.ObjectId.isValid(companyId)
      ? { companyId: new mongoose.Types.ObjectId(companyId) }
      : { companyId: (await Company.findOne({ companyId }))?._id };
    if (!query.companyId) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }
    const templates = await CompanyEmailTemplate.find(query);
    const byKey: Record<string, any> = {};
    templates.forEach((t: { templateKey: string; subject: string; htmlBody: string; textBody?: string; isActive: boolean }) => {
      byKey[t.templateKey] = { subject: t.subject, htmlBody: t.htmlBody, textBody: t.textBody, isActive: t.isActive };
    });
    const list = TEMPLATE_KEYS.map((key: string) => ({ templateKey: key, ...byKey[key] }));
    res.json({ success: true, data: list });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch email templates',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/email-config/company/:companyId/templates
 * @desc    Upsert email templates for a company (superadmin only). Body: { templates: [{ templateKey, subject, htmlBody }] }
 */
router.put('/company/:companyId/templates', authenticate, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const { templates } = req.body as { templates: Array<{ templateKey: string; subject: string; htmlBody: string; textBody?: string }> };
    let cid: mongoose.Types.ObjectId;
    if (mongoose.Types.ObjectId.isValid(companyId)) {
      cid = new mongoose.Types.ObjectId(companyId);
    } else {
      const company = await Company.findOne({ companyId });
      if (!company) return res.status(404).json({ success: false, message: 'Company not found' });
      cid = company._id;
    }
    if (!Array.isArray(templates)) {
      return res.status(400).json({ success: false, message: 'templates array required' });
    }
    for (const t of templates) {
      if (!t.templateKey || !(TEMPLATE_KEYS as readonly string[]).includes(t.templateKey)) continue;
      await CompanyEmailTemplate.findOneAndUpdate(
        { companyId: cid, templateKey: t.templateKey },
        { subject: t.subject || '', htmlBody: t.htmlBody || '', textBody: t.textBody, isActive: true },
        { upsert: true, new: true }
      );
    }
    const updated = await CompanyEmailTemplate.find({ companyId: cid });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to save email templates',
      error: error.message
    });
  }
});

export default router;
