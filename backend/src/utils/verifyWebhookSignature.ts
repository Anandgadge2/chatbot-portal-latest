import crypto from 'crypto';

const SIGNATURE_PREFIX = 'sha256=';

export function verifyWebhookSignature(rawBody: Buffer, signatureHeader: string, secret: string): boolean {
  if (!rawBody || !signatureHeader || !secret) {
    return false;
  }

  const normalizedSignature = signatureHeader.trim();
  if (!normalizedSignature.startsWith(SIGNATURE_PREFIX)) {
    return false;
  }

  const signatureHex = normalizedSignature.slice(SIGNATURE_PREFIX.length);
  if (!signatureHex) {
    return false;
  }

  const expectedDigest = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest();

  let providedDigest: Buffer;
  try {
    providedDigest = Buffer.from(signatureHex, 'hex');
  } catch {
    return false;
  }

  if (providedDigest.length !== expectedDigest.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedDigest, expectedDigest);
}
