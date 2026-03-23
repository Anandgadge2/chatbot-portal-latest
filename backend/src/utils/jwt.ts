import jwt from 'jsonwebtoken';

export interface JWTPermission {
  module: string;
  actions: string[];
}

export interface JWTPayload {
  userId: string;
  email?: string;
  phone: string;
  role?: string;
  // roleId is for reference only, not for authorization logic
  roleId?: string;
  isSuperAdmin?: boolean;
  companyId?: string;
  departmentId?: string;
  subDepartmentId?: string;
  level?: number;
  scope?: 'platform' | 'company';
  filteredPermissions?: JWTPermission[];
  permissionsVersion?: number;
}

export const generateToken = (payload: JWTPayload): string => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not defined');
  }

  return jwt.sign(payload, secret, {
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as string
  } as jwt.SignOptions);
};

export const generateRefreshToken = (payload: JWTPayload): string => {
  const secret = process.env.JWT_REFRESH_SECRET;

  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET is not defined');
  }

  return jwt.sign(payload, secret, {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '30d') as string
  } as jwt.SignOptions);
};

export const verifyToken = (token: string): JWTPayload => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not defined');
  }

  return jwt.verify(token, secret) as JWTPayload;
};

export const verifyRefreshToken = (token: string): JWTPayload => {
  const secret = process.env.JWT_REFRESH_SECRET;

  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET is not defined');
  }

  return jwt.verify(token, secret) as JWTPayload;
};
