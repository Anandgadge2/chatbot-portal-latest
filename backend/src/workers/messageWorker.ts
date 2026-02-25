import { initMessageQueues, getQueues } from '../queue/messageQueue';
import { processWhatsAppMessage } from '../services/chatbotEngine';
import FailedMessage from '../models/FailedMessage';
import BillingUsage from '../models/BillingUsage';
import { logger } from '../config/logger';

const dayKey = () => new Date().toISOString().slice(0, 10);

export const startMessageWorker = async () => {
  const { incomingMessageQueue, dlq } = await initMessageQueues();
  if (!incomingMessageQueue) return;

  incomingMessageQueue.process(async (job) => {
    const p = job.data;

    await processWhatsAppMessage({
      companyId: p.companyId,
      from: p.from,
      messageText: p.messageText,
      messageType: p.messageType,
      messageId: p.messageId,
      mediaUrl: p.mediaUrl,
      metadata: p.metadata,
      buttonId: p.buttonId,
    });

    // Usage tracking for billing readiness
    await BillingUsage.updateOne(
      { companyId: p.companyId as any, date: dayKey() },
      {
        $setOnInsert: { companyId: p.companyId as any, date: dayKey() },
        $inc: { inboundMessages: 1 },
      },
      { upsert: true }
    );
  });

  incomingMessageQueue.on('failed', async (job, err) => {
    if (!job) return;
    const isTerminal = (job.attemptsMade || 0) >= 3;
    if (!isTerminal) return;

    await FailedMessage.create({
      companyId: job.data.companyId,
      messageId: job.data.messageId,
      from: job.data.from,
      payload: job.data,
      error: err?.message || 'Unknown worker failure',
      attempts: job.attemptsMade,
    });

    if (dlq) {
      await dlq.add(
        {
          ...job.data,
          error: err?.message || 'Unknown worker failure',
          attempts: job.attemptsMade,
        },
        { jobId: `dlq:${job.data.messageId}:${Date.now()}`, removeOnComplete: 1000 }
      );
    }
  });

  logger.info('✅ Message worker started');
};

export const getQueueHealth = async () => {
  const { incomingMessageQueue, dlq } = getQueues();
  if (!incomingMessageQueue) {
    return { enabled: false };
  }

  const waiting = await incomingMessageQueue.getWaitingCount();
  const active = await incomingMessageQueue.getActiveCount();
  const failed = await incomingMessageQueue.getFailedCount();
  const delayed = await incomingMessageQueue.getDelayedCount();
  const dlqWaiting = dlq ? await dlq.getWaitingCount() : 0;

  return {
    enabled: true,
    incoming: { waiting, active, failed, delayed },
    dlq: { waiting: dlqWaiting },
  };
};
