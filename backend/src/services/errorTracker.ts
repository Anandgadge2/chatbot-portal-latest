import { logger } from '../config/logger';

let initialized = false;
let sentry: any = null;

export const initErrorTracker = async () => {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  try {
    // Dynamic import by variable so TS does not require package at compile time
    const dynamicImport = new Function('m', 'return import(m)') as (m: string) => Promise<any>;
    sentry = await dynamicImport('@sentry/node');
    sentry.init({ dsn, environment: process.env.NODE_ENV || 'development' });
    initialized = true;
  } catch (error: any) {
    logger.warn('⚠️ Sentry SDK not installed; continuing without Sentry:', error?.message || error);
  }
};

export const captureException = (error: any, context?: any) => {
  if (initialized && sentry) {
    sentry.captureException(error, { extra: context });
  }
  logger.error('Tracked exception:', error?.message || error, context || '');
};
