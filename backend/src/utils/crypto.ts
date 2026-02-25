import crypto from 'crypto';

const ALGO = 'aes-256-gcm';

const getKeyRing = (): Record<string, Buffer> => {
  const active = process.env.PII_ENCRYPTION_KEY || '';
  if (!active) {
    throw new Error('PII_ENCRYPTION_KEY is not configured');
  }

  const ringRaw = process.env.PII_ENCRYPTION_KEY_RING || ''; // format: v1:key1,v2:key2
  const out: Record<string, Buffer> = { v1: deriveKey(active) };

  if (ringRaw) {
    for (const pair of ringRaw.split(',')) {
      const [version, key] = pair.split(':').map((x) => x.trim());
      if (!version || !key) continue;
      out[version] = deriveKey(key);
    }
  }

  return out;
};

const deriveKey = (raw: string): Buffer => {
  if (raw.length === 32) return Buffer.from(raw, 'utf8');
  return crypto.createHash('sha256').update(raw).digest();
};

const getActiveVersion = (): string => process.env.PII_ENCRYPTION_ACTIVE_VERSION || 'v1';

export const encryptPII = (value: string): string => {
  if (!value) return value;
  const version = getActiveVersion();
  const key = getKeyRing()[version];
  if (!key) throw new Error(`Missing active PII key version: ${version}`);

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${version}:${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
};

export const decryptPII = (payload: string): string => {
  if (!payload) return payload;

  const versionSplit = payload.split(':');
  const hasVersion = versionSplit.length > 1;
  const version = hasVersion ? versionSplit[0] : getActiveVersion();
  const body = hasVersion ? versionSplit.slice(1).join(':') : payload;

  const [ivB64, tagB64, encB64] = body.split('.');
  if (!ivB64 || !tagB64 || !encB64) return payload;

  const keyRing = getKeyRing();
  const key = keyRing[version];
  if (!key) throw new Error(`No key for version ${version}`);

  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const encrypted = Buffer.from(encB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const out = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return out.toString('utf8');
};

export const tryEncryptPII = (value?: string): string | undefined => {
  if (!value) return value;
  try {
    return encryptPII(value);
  } catch {
    return undefined;
  }
};

export const tryDecryptPII = (value?: string): string | undefined => {
  if (!value) return value;
  try {
    return decryptPII(value);
  } catch {
    return undefined;
  }
};
