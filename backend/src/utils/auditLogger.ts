import AuditLog, { IAuditLog } from '../models/AuditLog';
import { AuditAction } from '../config/constants';
import { Request } from 'express';
import { IUser } from '../models/User';
import mongoose from 'mongoose';

interface AuditLogData {
  userId?: string;
  userEmail?: string;
  userName?: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  companyId?: string;
  departmentId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
}

type ObjectIdLike = string | mongoose.Types.ObjectId | { _id?: any } | undefined | null;

function normalizeObjectId(value: ObjectIdLike, fieldName: 'userId' | 'companyId' | 'departmentId'): mongoose.Types.ObjectId | undefined {
  if (!value) {
    return undefined;
  }

  const candidate = typeof value === 'object' && '_id' in value ? (value as any)._id : value;

  if (candidate instanceof mongoose.Types.ObjectId) {
    return candidate;
  }

  const asString = String(candidate);
  if (mongoose.Types.ObjectId.isValid(asString) && asString.length === 24) {
    return new mongoose.Types.ObjectId(asString);
  }

  console.warn(`Skipping invalid ${fieldName} in audit log`, {
    fieldName,
    receivedType: typeof value,
    preview: typeof asString === 'string' ? asString.slice(0, 80) : '[non-string]'
  });

  return undefined;
}

export const createAuditLog = async (data: AuditLogData): Promise<IAuditLog> => {
  try {
    const normalizedData = {
      ...data,
      userId: normalizeObjectId(data.userId as ObjectIdLike, 'userId'),
      companyId: normalizeObjectId(data.companyId as ObjectIdLike, 'companyId'),
      departmentId: normalizeObjectId(data.departmentId as ObjectIdLike, 'departmentId')
    };

    const auditLog = await AuditLog.create({
      ...normalizedData,
      timestamp: new Date()
    });

    return auditLog;
  } catch (error) {
    console.error('Failed to create audit log:', error);
    throw error;
  }
};

export const logUserAction = async (
  req: Request,
  action: AuditAction,
  resource: string,
  resourceId?: string,
  details?: any
): Promise<void> => {
  try {
    const user = req.user as IUser;

    await createAuditLog({
      userId: user?._id.toString(),
      userEmail: user?.email,
      userName: user?.getFullName(),
      action,
      resource,
      resourceId,
      companyId: user?.companyId instanceof Object && '_id' in user.companyId 
        ? (user.companyId as any)._id.toString() 
        : (user?.companyId as any)?.toString(),
      departmentId: user?.departmentId instanceof Object && '_id' in user.departmentId
        ? (user.departmentId as any)._id.toString()
        : (user?.departmentId as any)?.toString(),
      details,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
  } catch (error) {
    // Don't throw error, just log it
    console.error('Failed to log user action:', error);
  }
};
