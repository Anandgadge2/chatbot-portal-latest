import crypto from 'crypto';
import { randomUUID } from 'crypto';
import RefreshTokenSession from '../models/RefreshTokenSession';
import { generateRefreshToken, JWTPayload } from '../utils/jwt';

const hashToken = (token: string): string => crypto.createHash('sha256').update(token).digest('hex');

export const issueRefreshToken = async (
  payload: JWTPayload,
  opts?: { familyId?: string; parentJti?: string; expiresAt?: Date }
): Promise<{ refreshToken: string; familyId: string; jti: string }> => {
  const familyId = opts?.familyId || randomUUID();
  const jti = randomUUID();

  const refreshToken = generateRefreshToken({
    ...payload,
    tokenType: 'refresh',
    familyId,
    jti,
  });

  const expiresAt = opts?.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await RefreshTokenSession.create({
    userId: payload.userId,
    companyId: payload.companyId || null,
    familyId,
    jti,
    parentJti: opts?.parentJti,
    tokenHash: hashToken(refreshToken),
    expiresAt,
  });

  return { refreshToken, familyId, jti };
};

export const rotateRefreshToken = async (
  oldRefreshToken: string,
  payload: JWTPayload & { familyId?: string; jti?: string }
): Promise<{ refreshToken: string; familyId: string; jti: string }> => {
  const oldHash = hashToken(oldRefreshToken);

  const existing = await RefreshTokenSession.findOne({ tokenHash: oldHash });
  if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
    throw new Error('Invalid refresh session');
  }

  // single-use: revoke old token
  existing.revokedAt = new Date();
  await existing.save();

  return issueRefreshToken(payload, {
    familyId: existing.familyId,
    parentJti: existing.jti,
    expiresAt: existing.expiresAt,
  });
};

export const revokeTokenFamily = async (familyId: string): Promise<void> => {
  await RefreshTokenSession.updateMany({ familyId, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
};
