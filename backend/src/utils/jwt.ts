import jwt from 'jsonwebtoken';
import { IPermission } from '../models/Role';

export interface JWTPayload {
  userId: string;
  email?: string;
  phone: string;
  companyId?: string;
  departmentId?: string;
  subDepartmentId?: string;
  roleId?: string;
  isSuperAdmin: boolean;
  level: number;
  scope: 'platform' | 'company' | 'department' | 'subdepartment' | 'assigned';
  filteredPermissions: IPermission[];
  permissionsVersion: number;
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
