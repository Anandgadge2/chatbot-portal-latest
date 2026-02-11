import AuditLog, { IAuditLog } from '../models/AuditLog';
import { AuditAction } from '../config/constants';
import { Request } from 'express';
import { IUser } from '../models/User';

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

export const createAuditLog = async (data: AuditLogData): Promise<IAuditLog> => {
  try {
    const auditLog = await AuditLog.create({
      ...data,
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
      companyId: user?.companyId?.toString(),
      departmentId: user?.departmentId?.toString(),
      details,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
  } catch (error) {
    // Don't throw error, just log it
    console.error('Failed to log user action:', error);
  }
};
