import Company from '../models/Company';
import ConsentLog from '../models/ConsentLog';
import FailedMessage from '../models/FailedMessage';
import RefreshTokenSession from '../models/RefreshTokenSession';
import { logger } from '../config/logger';

const DAY = 24 * 60 * 60 * 1000;

const runPurgeOnce = async () => {
  const companies = await Company.find({ 'dataRetention.purgeEnabled': true }).select('_id dataRetention').lean();

  for (const c of companies) {
    const days = c.dataRetention?.retentionDays || 365;
    const cutoff = new Date(Date.now() - days * DAY);

    await ConsentLog.deleteMany({ companyId: c._id, createdAt: { $lt: cutoff } });
    await FailedMessage.deleteMany({ companyId: String(c._id), createdAt: { $lt: cutoff } });
  }

  // global token cleanup
  await RefreshTokenSession.deleteMany({
    $or: [{ expiresAt: { $lt: new Date() } }, { revokedAt: { $lt: new Date(Date.now() - 30 * DAY) } }],
  });
};

export const startDataRetentionScheduler = () => {
  const enabled = process.env.ENABLE_RETENTION_CRON !== 'false';
  if (!enabled) return;

  runPurgeOnce()
    .then(() => logger.info('✅ Retention purge run completed'))
    .catch((e) => logger.warn('⚠️ Retention purge run failed:', e?.message || e));

  setInterval(() => {
    runPurgeOnce().catch((e) => logger.warn('⚠️ Retention purge run failed:', e?.message || e));
  }, DAY);
};
