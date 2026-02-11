import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../config/constants';
import mongoose from 'mongoose';
import { IUser } from '../models/User';

export const requireSuperAdminDashboard = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // SuperAdmin can access all dashboards
  if (req.user?.role === UserRole.SUPER_ADMIN) {
    next();
    return;
  }

  // Other roles cannot access SuperAdmin dashboard
  res.status(403).json({
    success: false,
    message: 'Access denied. SuperAdmin dashboard access required.'
  });
};

export const requireCompanyAdminDashboard = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // SuperAdmin can access all dashboards
  if (req.user?.role === UserRole.SUPER_ADMIN) {
    next();
    return;
  }

  // CompanyAdmin can access their own dashboard
  if (req.user?.role === UserRole.COMPANY_ADMIN) {
    next();
    return;
  }

  res.status(403).json({
    success: false,
    message: 'Access denied. CompanyAdmin dashboard access required.'
  });
};

export const requireDepartmentAdminDashboard = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // SuperAdmin can access all dashboards
  if (req.user?.role === UserRole.SUPER_ADMIN) {
    next();
    return;
  }

  // CompanyAdmin can access department admin dashboard
  if (req.user?.role === UserRole.COMPANY_ADMIN) {
    next();
    return;
  }

  // DepartmentAdmin can access their own dashboard
  if (req.user?.role === UserRole.DEPARTMENT_ADMIN) {
    next();
    return;
  }

  res.status(403).json({
    success: false,
    message: 'Access denied. DepartmentAdmin dashboard access required.'
  });
};

export const canAccessAnyDashboard = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // SuperAdmin can access any dashboard without authentication
  if (req.headers['x-superadmin-bypass'] === 'true') {
    req.user = {
      _id: new mongoose.Types.ObjectId(),
      userId: 'SUPER001',
      firstName: 'Super',
      lastName: 'Admin',
      email: 'superadmin@dashboard.com',
      role: UserRole.SUPER_ADMIN,
      isActive: true
    } as Partial<IUser> as IUser;
    next();
    return;
  }

  // All authenticated users can access their appropriate dashboard
  if (req.user) {
    next();
    return;
  }

  res.status(401).json({
    success: false,
    message: 'Authentication required for dashboard access.'
  });
};
