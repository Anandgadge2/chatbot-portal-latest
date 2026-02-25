import { Request, Response, NextFunction } from 'express';
import { getRedisClient, isRedisConnected } from '../config/redis';

interface TenantRateLimitOptions {
  maxRequests: number;
  windowSeconds: number;
}

const memoryCounters = new Map<string, { count: number; resetAt: number }>();

function getTenantKey(req: Request): string {
  const user = (req as any).user;
  const companyId = user?.companyId?.toString?.() || req.get('x-company-id') || 'public';
  return `tenant:${companyId}`;
}

export const tenantRateLimit = (options: TenantRateLimitOptions) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = getTenantKey(req);

    // Redis path (preferred)
    const redis = getRedisClient();
    if (redis && isRedisConnected()) {
      const redisKey = `rate_limit:${key}`;
      const current = await redis.incr(redisKey);
      if (current === 1) {
        await redis.expire(redisKey, options.windowSeconds);
      }
      if (current > options.maxRequests) {
        res.status(429).json({ success: false, message: 'Tenant rate limit exceeded' });
        return;
      }
      return next();
    }

    // Memory fallback
    const now = Date.now();
    const existing = memoryCounters.get(key);
    const windowMs = options.windowSeconds * 1000;

    if (!existing || existing.resetAt <= now) {
      memoryCounters.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    existing.count += 1;
    if (existing.count > options.maxRequests) {
      res.status(429).json({ success: false, message: 'Tenant rate limit exceeded' });
      return;
    }

    next();
  };
};
