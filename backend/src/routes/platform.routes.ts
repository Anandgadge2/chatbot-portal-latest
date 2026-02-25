import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import { authenticate } from '../middleware/auth';
import { requireSuperAdmin } from '../middleware/rbac';
import { requireDatabaseConnection } from '../middleware/dbConnection';
import Company from '../models/Company';
import User from '../models/User';
import BillingUsage from '../models/BillingUsage';
import FailedMessage from '../models/FailedMessage';
import SubscriptionPlan from '../models/SubscriptionPlan';
import CompanySubscription from '../models/CompanySubscription';
import Invoice from '../models/Invoice';
import Grievance from '../models/Grievance';
import Appointment from '../models/Appointment';
import PIIAccessLog from '../models/PIIAccessLog';
import { getQueueHealth } from '../workers/messageWorker';
import { getSystemHealth, getPrometheusText } from '../services/monitoringService';
import { generateMonthlyInvoice } from '../services/billingService';
import { tryDecryptPII } from '../utils/crypto';

const router = express.Router();
router.use(requireDatabaseConnection);
router.use(authenticate);
router.use(requireSuperAdmin);

router.get('/overview', async (_req: Request, res: Response) => {
  try {
    const [totalTenants, activeTenants, totalUsers, failedJobs, queueHealth, usage] = await Promise.all([
      Company.countDocuments({}),
      Company.countDocuments({ isActive: true, isSuspended: false }),
      User.countDocuments({}),
      FailedMessage.countDocuments({}),
      getQueueHealth(),
      BillingUsage.aggregate([
        { $group: { _id: null, inbound: { $sum: '$inboundMessages' }, outbound: { $sum: '$outboundMessages' }, conv: { $sum: '$conversations' } } },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        tenancy: { totalTenants, activeTenants, suspendedTenants: totalTenants - activeTenants },
        users: { totalUsers },
        messaging: {
          inboundMessages: usage?.[0]?.inbound || 0,
          outboundMessages: usage?.[0]?.outbound || 0,
          conversations: usage?.[0]?.conv || 0,
          failedJobs,
          queueHealth,
        },
        compliance: {
          uptimeTarget: '99.9%',
          abuseDetection: 'enabled',
          auditTrail: 'enabled',
          piiAccessAudited: true,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to load platform overview', error: error.message });
  }
});

router.get('/billing/usage', async (req: Request, res: Response) => {
  try {
    const { from, to, companyId } = req.query;
    const query: any = {};
    if (companyId) query.companyId = companyId;
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = from;
      if (to) query.date.$lte = to;
    }

    const usage = await BillingUsage.find(query)
      .populate('companyId', 'name companyId')
      .sort({ date: -1 })
      .limit(1000)
      .lean();

    return res.json({ success: true, data: usage });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to fetch billing usage', error: error.message });
  }
});

// Billing plans
router.get('/billing/plans', async (_req: Request, res: Response) => {
  const plans = await SubscriptionPlan.find({}).sort({ monthlyPrice: 1 }).lean();
  res.json({ success: true, data: plans });
});

router.post('/billing/plans', async (req: Request, res: Response) => {
  try {
    const plan = await SubscriptionPlan.create(req.body);
    res.status(201).json({ success: true, data: plan });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/billing/subscriptions/:companyId', async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const { planId, startDate } = req.body;

    const companyObjectId = mongoose.Types.ObjectId.isValid(companyId)
      ? new mongoose.Types.ObjectId(companyId)
      : (await Company.findOne({ companyId }))?._id;

    if (!companyObjectId) return res.status(404).json({ success: false, message: 'Company not found' });

    const start = startDate ? new Date(startDate) : new Date();
    const next = new Date(start);
    next.setMonth(next.getMonth() + 1);

    const sub = await CompanySubscription.findOneAndUpdate(
      { companyId: companyObjectId },
      {
        $set: {
          planId,
          status: 'active',
          billingCycle: 'monthly',
          startDate: start,
          nextBillingDate: next,
        },
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, data: sub });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/billing/invoices/generate', async (req: Request, res: Response) => {
  try {
    const { companyId } = req.body;
    const invoice = await generateMonthlyInvoice(companyId, new Date());
    res.json({ success: true, data: invoice });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/billing/invoices', async (req: Request, res: Response) => {
  const { companyId, status } = req.query;
  const query: any = {};
  if (companyId) query.companyId = companyId;
  if (status) query.status = status;
  const invoices = await Invoice.find(query).sort({ createdAt: -1 }).limit(1000).lean();
  res.json({ success: true, data: invoices });
});

router.post('/billing/invoices/:id/mark-paid', async (req: Request, res: Response) => {
  const invoice = await Invoice.findByIdAndUpdate(
    req.params.id,
    { $set: { status: 'paid', paidAt: new Date() } },
    { new: true }
  );
  res.json({ success: true, data: invoice });
});

router.get('/monitoring/health', async (_req: Request, res: Response) => {
  try {
    const [queueHealth, system] = await Promise.all([getQueueHealth(), getSystemHealth()]);
    return res.json({
      success: true,
      data: {
        ...system,
        queue: queueHealth,
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Monitoring check failed', error: error.message });
  }
});

router.get('/monitoring/metrics', async (_req: Request, res: Response) => {
  const body = await getPrometheusText();
  res.setHeader('Content-Type', 'text/plain; version=0.0.4');
  res.send(body);
});

router.get('/monitoring/failed-messages', async (_req: Request, res: Response) => {
  const failed = await FailedMessage.find({}).sort({ createdAt: -1 }).limit(500).lean();
  res.json({ success: true, data: failed });
});

// PII audited access endpoints
router.get('/pii/grievance/:id', async (req: Request, res: Response) => {
  const doc = await Grievance.findById(req.params.id).lean();
  if (!doc) return res.status(404).json({ success: false, message: 'Grievance not found' });

  const data = {
    citizenName: tryDecryptPII((doc as any)?.piiEncrypted?.citizenName),
    citizenPhone: tryDecryptPII((doc as any)?.piiEncrypted?.citizenPhone),
    citizenWhatsApp: tryDecryptPII((doc as any)?.piiEncrypted?.citizenWhatsApp),
  };

  await PIIAccessLog.create({
    actorUserId: req.user!._id,
    actorRole: req.user!.role,
    companyId: (doc as any).companyId,
    resourceType: 'Grievance',
    resourceId: String(doc._id),
    fields: Object.keys(data),
    reason: String(req.query.reason || 'platform-review'),
  });

  res.json({ success: true, data });
});

router.get('/pii/appointment/:id', async (req: Request, res: Response) => {
  const doc = await Appointment.findById(req.params.id).lean();
  if (!doc) return res.status(404).json({ success: false, message: 'Appointment not found' });

  const data = {
    citizenName: tryDecryptPII((doc as any)?.piiEncrypted?.citizenName),
    citizenPhone: tryDecryptPII((doc as any)?.piiEncrypted?.citizenPhone),
    citizenWhatsApp: tryDecryptPII((doc as any)?.piiEncrypted?.citizenWhatsApp),
    citizenEmail: tryDecryptPII((doc as any)?.piiEncrypted?.citizenEmail),
  };

  await PIIAccessLog.create({
    actorUserId: req.user!._id,
    actorRole: req.user!.role,
    companyId: (doc as any).companyId,
    resourceType: 'Appointment',
    resourceId: String(doc._id),
    fields: Object.keys(data),
    reason: String(req.query.reason || 'platform-review'),
  });

  res.json({ success: true, data });
});

router.get('/pii/access-logs', async (_req: Request, res: Response) => {
  const logs = await PIIAccessLog.find({}).sort({ createdAt: -1 }).limit(1000).lean();
  res.json({ success: true, data: logs });
});

export default router;
