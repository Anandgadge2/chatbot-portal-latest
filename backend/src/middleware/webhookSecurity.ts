import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

const parseAllowList = (): Set<string> => {
  const csv = process.env.META_IP_ALLOWLIST || '';
  return new Set(
    csv
      .split(',')
      .map((ip) => ip.trim())
      .filter(Boolean)
  );
};

const normalizeIp = (ip: string): string => ip.replace('::ffff:', '');

export const enforceMetaIpAllowlist = (req: Request, res: Response, next: NextFunction): void => {
  const allowList = parseAllowList();
  if (allowList.size === 0) {
    return next();
  }

  const sourceIp = normalizeIp(req.ip || req.socket.remoteAddress || '');
  if (!allowList.has(sourceIp)) {
    logger.warn(`Blocked webhook request from non-allowlisted IP: ${sourceIp}`);
    res.status(403).json({ success: false, message: 'IP not allowed' });
    return;
  }

  next();
};

export const verifyWebhookSignature = (req: Request, res: Response, next: NextFunction): void => {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    // Keep backward compatibility in environments not yet configured.
    return next();
  }

  const signature = req.get('x-hub-signature-256');
  if (!signature || !signature.startsWith('sha256=')) {
    res.status(401).json({ success: false, message: 'Missing signature header' });
    return;
  }

  const rawBody: Buffer | undefined = (req as any).rawBody;
  if (!rawBody) {
    res.status(500).json({ success: false, message: 'Raw body unavailable for signature verification' });
    return;
  }

  const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
  const provided = signature;

  const isValid =
    expected.length === provided.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));

  if (!isValid) {
    logger.warn('Webhook signature verification failed');
    res.status(401).json({ success: false, message: 'Invalid signature' });
    return;
  }

  next();
};
