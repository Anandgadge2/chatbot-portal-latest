import BillingUsage from '../models/BillingUsage';
import CompanySubscription from '../models/CompanySubscription';
import Invoice from '../models/Invoice';
import SubscriptionPlan from '../models/SubscriptionPlan';

const monthRange = (date = new Date()) => {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
};

export const generateMonthlyInvoice = async (companyId: string, runDate = new Date()) => {
  const sub = await CompanySubscription.findOne({ companyId, status: 'active' }).lean();
  if (!sub) throw new Error('Active subscription not found');

  const plan = await SubscriptionPlan.findById(sub.planId).lean();
  if (!plan) throw new Error('Subscription plan not found');

  const { start, end } = monthRange(runDate);

  const usage = await BillingUsage.aggregate([
    { $match: { companyId: sub.companyId, date: { $gte: start, $lte: end } } },
    { $group: { _id: null, conversations: { $sum: '$conversations' } } }
  ]);
  const conv = usage?.[0]?.conversations || 0;

  const overage = Math.max(0, conv - plan.includedConversations);
  const overageAmount = overage * plan.overagePerConversation;
  const baseAmount = plan.monthlyPrice;
  const totalAmount = baseAmount + overageAmount;

  const invoiceNumber = `INV-${companyId}-${start.replace(/-/g, '')}`;

  const invoice = await Invoice.findOneAndUpdate(
    { companyId: sub.companyId, periodStart: start, periodEnd: end },
    {
      $set: {
        subscriptionId: sub._id,
        invoiceNumber,
        baseAmount,
        overageAmount,
        totalAmount,
        status: 'issued',
        issuedAt: new Date(),
        dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      $setOnInsert: {
        companyId: sub.companyId,
        periodStart: start,
        periodEnd: end,
        currency: 'INR',
      }
    },
    { upsert: true, new: true }
  );

  return invoice;
};
