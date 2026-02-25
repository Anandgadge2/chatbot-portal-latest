import Queue from 'bull';
import { getRedisClient } from '../config/redis';
import { logger } from '../config/logger';

export interface IncomingMessageJob {
  companyId: string;
  from: string;
  messageText: string;
  messageType: string;
  messageId: string;
  mediaUrl?: string;
  metadata?: any;
  buttonId?: string;
}

export interface QueueLike {
  add: (payload: any, options?: any) => Promise<any>;
  process: (handler: (job: any) => Promise<void>) => Promise<void> | void;
  on: (event: string, handler: (...args: any[]) => void) => void;
  getWaitingCount: () => Promise<number>;
  getActiveCount: () => Promise<number>;
  getFailedCount: () => Promise<number>;
  getDelayedCount: () => Promise<number>;
}

let incomingMessageQueue: QueueLike | null = null;
let dlq: QueueLike | null = null;
let queueEngine: 'bull' | 'bullmq' = 'bull';

const getRedisOpts = () => ({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT || 6379),
  password: process.env.REDIS_PASSWORD || undefined,
});

const createBullQueue = (): { incomingMessageQueue: QueueLike; dlq: QueueLike } => {
  const redisOpts = getRedisOpts();
  const q = new Queue<IncomingMessageJob>('incoming-whatsapp-messages', { redis: redisOpts });
  const d = new Queue('incoming-whatsapp-messages-dlq', { redis: redisOpts });

  return {
    incomingMessageQueue: q as any,
    dlq: d as any,
  };
};

const createBullMQQueue = async (): Promise<{ incomingMessageQueue: QueueLike; dlq: QueueLike }> => {
  // Dynamic import so project builds even when bullmq package is not available
  const dynamicImport = new Function('m', 'return import(m)') as (m: string) => Promise<any>;
  const mod = await dynamicImport('bullmq');
  const { Queue: BullMQQueue, Worker, QueueEvents } = mod;
  const connection = getRedisOpts();

  const incoming = new BullMQQueue('incoming-whatsapp-messages', { connection });
  const dead = new BullMQQueue('incoming-whatsapp-messages-dlq', { connection });

  const wrap = (q: any): QueueLike => ({
    add: async (payload: any, options?: any) => q.add('message', payload, options),
    process: (handler: (job: any) => Promise<void>) => {
      const worker = new Worker('incoming-whatsapp-messages', handler, { connection });
      const events = new QueueEvents('incoming-whatsapp-messages', { connection });
      worker.on('failed', (job: any, err: any) => {
        (q as any).__failedHandlers?.forEach((h: any) => h(job, err));
      });
      (q as any).__events = events;
    },
    on: (event: string, handler: (...args: any[]) => void) => {
      (q as any).__failedHandlers = (q as any).__failedHandlers || [];
      if (event === 'failed') (q as any).__failedHandlers.push(handler);
    },
    getWaitingCount: () => q.getWaitingCount(),
    getActiveCount: () => q.getActiveCount(),
    getFailedCount: () => q.getFailedCount(),
    getDelayedCount: () => q.getDelayedCount(),
  });

  return {
    incomingMessageQueue: wrap(incoming),
    dlq: wrap(dead),
  };
};

export const initMessageQueues = async () => {
  if (incomingMessageQueue && dlq) return { incomingMessageQueue, dlq, queueEngine };

  const redis = getRedisClient();
  if (!redis) {
    logger.warn('⚠️ Redis not available. Queue pipeline disabled; webhook will fallback to sync processing.');
    return { incomingMessageQueue: null, dlq: null, queueEngine };
  }

  const requested = (process.env.QUEUE_ENGINE || 'bull').toLowerCase();

  if (requested === 'bullmq') {
    try {
      const built = await createBullMQQueue();
      incomingMessageQueue = built.incomingMessageQueue;
      dlq = built.dlq;
      queueEngine = 'bullmq';
      logger.info('✅ Queue engine initialized: BullMQ');
      return { incomingMessageQueue, dlq, queueEngine };
    } catch (error: any) {
      logger.warn(`⚠️ BullMQ unavailable (${error?.message || error}). Falling back to Bull.`);
    }
  }

  const built = createBullQueue();
  incomingMessageQueue = built.incomingMessageQueue;
  dlq = built.dlq;
  queueEngine = 'bull';
  logger.info('✅ Queue engine initialized: Bull');
  return { incomingMessageQueue, dlq, queueEngine };
};

export const enqueueIncomingMessage = async (payload: IncomingMessageJob): Promise<void> => {
  const { incomingMessageQueue } = await initMessageQueues();
  if (!incomingMessageQueue) {
    throw new Error('Queue unavailable');
  }

  await incomingMessageQueue.add(payload, {
    jobId: payload.messageId,
    attempts: 3,
    backoff: { type: 'exponential', delay: 1500 },
    removeOnComplete: 500,
    removeOnFail: false,
  });
};

export const getQueues = () => ({ incomingMessageQueue, dlq, queueEngine });
