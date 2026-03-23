import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import User, { IUser } from '../models/User';
import Company from '../models/Company';
import Role from '../models/Role';

// Extend Express Request to include user

declare global {
  namespace Express {
    interface Request {
      user?: IUser & {
        isSuperAdmin?: boolean;
        level?: number;
        scope?: 'platform' | 'company' | 'department' | 'subdepartment' | 'assigned';
        filteredPermissions?: { module: string; actions: string[] }[];
        permissionsVersion?: number;
        roleId?: string;
      };
    }
  }
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'No token provided. Authentication required.'
      });
      return;
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.userId).select('+password');

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User not found. Invalid token.'
      });
      return;
    }

    if (!user.isActive) {
      res.status(401).json({
        success: false,
        message: 'User account is inactive.'
      });
      return;
    }


    if (!decoded.isSuperAdmin && user.customRoleId) {
      const assignedRoleExists = await Role.exists({ _id: user.customRoleId });
      if (!assignedRoleExists) {
        res.status(401).json({
          success: false,
          message: 'Assigned role no longer exists'
        });
        return;
      }
    }

    if (!decoded.isSuperAdmin && user.companyId) {
      const company = await Company.findById(user.companyId).select('isActive isSuspended permissionsVersion').lean();

      if (!company || !company.isActive || company.isSuspended) {
        res.status(401).json({
          success: false,
          message: 'Company access is unavailable.'
        });
        return;
      }

      if (decoded.permissionsVersion !== (company.permissionsVersion ?? 1)) {
        res.status(401).json({
          success: false,
          message: 'Session expired. Please login again.'
        });
        return;
      }
    }

    req.user = Object.assign(user, {
      isSuperAdmin: decoded.isSuperAdmin,
      level: decoded.level,
      scope: decoded.scope,
      filteredPermissions: decoded.filteredPermissions,
      permissionsVersion: decoded.permissionsVersion,
      roleId: decoded.roleId,
    });

    next();
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
      return;
    }

    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.'
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Authentication error.'
    });
  }
};

export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);
      const user = await User.findById(decoded.userId);
      
      if (user && user.isActive) {
        req.user = Object.assign(user, {
          isSuperAdmin: decoded.isSuperAdmin,
          level: decoded.level,
          scope: decoded.scope,
          filteredPermissions: decoded.filteredPermissions,
          permissionsVersion: decoded.permissionsVersion,
          roleId: decoded.roleId,
        });
      }
    }

    next();
  } catch (_error) {
    next();
  }
};
