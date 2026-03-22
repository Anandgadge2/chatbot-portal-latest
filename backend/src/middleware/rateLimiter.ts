import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../config/redis';

export const tenantLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  keyGenerator: (req: any) => req.user?.companyId?.toString() || req.ip,
  message: {
    success: false,
    error: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const LOGIN_WINDOW_MS = 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const loginAttempts = new Map<string, { count: number; expiresAt: number; timeout?: NodeJS.Timeout }>();

const getLoginAttemptKey = (req: Request): string => {
  const identifier = String(req.body?.email || req.body?.phone || 'unknown').trim().toLowerCase();
  return `login:${req.ip}:${identifier}`;
};

const pruneExpiredLoginAttempts = (now: number) => {
  for (const [key, value] of loginAttempts.entries()) {
    if (value.expiresAt <= now) {
      loginAttempts.delete(key);
    }
  }
};

const scheduleLoginAttemptCleanup = (key: string, windowMs: number) => {
  const existing = loginAttempts.get(key);
  if (existing?.timeout) {
    clearTimeout(existing.timeout);
  }

  const timeout = setTimeout(() => {
    loginAttempts.delete(key);
  }, windowMs);

  const nextValue = loginAttempts.get(key);
  if (nextValue) {
    nextValue.timeout = timeout;
    loginAttempts.set(key, nextValue);
  }
};

export const loginRateLimiter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const key = getLoginAttemptKey(req);
  const redis = getRedisClient();

  if (redis) {
    try {
      const attemptCount = await redis.incr(key);
      if (attemptCount === 1) {
        await redis.pexpire(key, LOGIN_WINDOW_MS);
      }

      if (attemptCount > LOGIN_MAX_ATTEMPTS) {
        res.status(429).json({
          success: false,
          message: 'Too many login attempts. Try again later.'
        });
        return;
      }

      next();
      return;
    } catch (_error) {}
  }

  const now = Date.now();
  pruneExpiredLoginAttempts(now);

  const existing = loginAttempts.get(key);
  if (!existing || existing.expiresAt <= now) {
    loginAttempts.set(key, { count: 1, expiresAt: now + LOGIN_WINDOW_MS });
    scheduleLoginAttemptCleanup(key, LOGIN_WINDOW_MS);
    next();
    return;
  }

  existing.count += 1;
  loginAttempts.set(key, existing);
  scheduleLoginAttemptCleanup(key, Math.max(existing.expiresAt - now, 1));

  if (existing.count > LOGIN_MAX_ATTEMPTS) {
    res.status(429).json({
      success: false,
      message: 'Too many login attempts. Try again later.'
    });
    return;
  }

  next();
};

export const clearLoginRateLimit = async (req: Request): Promise<void> => {
  const key = getLoginAttemptKey(req);
  const redis = getRedisClient();

  if (redis) {
    try {
      await redis.del(key);
      return;
    } catch (_error) {}
  }

  const inMemoryEntry = loginAttempts.get(key);
  if (inMemoryEntry?.timeout) {
    clearTimeout(inMemoryEntry.timeout);
  }
  loginAttempts.delete(key);
};
