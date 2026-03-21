import rateLimit from 'express-rate-limit';

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
