import express, { Request, Response } from 'express';
import User from '../models/User';
import { generateToken, generateRefreshToken } from '../utils/jwt';
import { logUserAction } from '../utils/auditLogger';
import { AuditAction } from '../config/constants';
import { authenticate } from '../middleware/auth';
import {
  buildAuthContext,
  ensurePlatformSuperAdminRole,
  isPlatformSuperAdminUser,
  resolveUserAccessContext
} from '../utils/accessControl';

const router = express.Router();

const buildAuthResponse = async (user: any, loginType: 'PASSWORD' | 'SSO') => {
  const { role, company, filteredPermissions } = await resolveUserAccessContext(user);
  const authContext = buildAuthContext(user, role, filteredPermissions);

  const tokenPayload = {
    ...authContext,
    email: user.email,
    phone: user.phone
  };

  const accessToken = generateToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  return {
    accessToken,
    refreshToken,
    filteredPermissions,
    role,
    company,
    authContext,
    user: {
      id: user._id,
      userId: user.userId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      isSuperAdmin: isPlatformSuperAdminUser(user),
      role: isPlatformSuperAdminUser(user) ? 'SUPER_ADMIN' : role?.name || null,
      companyId: user.companyId,
      departmentId: user.departmentId || null,
      subDepartmentId: user.subDepartmentId || null,
      enabledModules: (company as any)?.enabledModules || [],
      isActive: user.isActive,
      loginType,
      customRoleId: user.customRoleId,
      roleId: authContext.roleId,
      level: authContext.level,
      scope: authContext.scope,
      permissions: filteredPermissions,
      notificationSettings: user.notificationSettings
    }
  };
};

const handleResolvedLogin = async (
  req: Request,
  res: Response,
  user: any,
  loginType: 'PASSWORD' | 'SSO'
) => {
  try {
    const response = await buildAuthResponse(user, loginType);

    user.lastLogin = new Date();
    await user.save();

    await logUserAction(
      { user, ip: req.ip, get: req.get.bind(req) } as any,
      AuditAction.LOGIN,
      'User',
      user._id.toString(),
      { loginMethod: loginType }
    );

    return res.json({
      success: true,
      message: `${loginType === 'SSO' ? 'SSO login' : 'Login'} successful`,
      data: {
        user: response.user,
        accessToken: response.accessToken,
        refreshToken: response.refreshToken
      }
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: statusCode === 500 ? `${loginType === 'SSO' ? 'SSO login' : 'Login'} failed` : error.message,
      error: statusCode === 500 ? error.message : undefined
    });
  }
};

router.post('/sso/login', async (req: Request, res: Response) => {
  try {
    const ssoToken = req.body.ssoToken || req.body.token;
    if (!ssoToken) {
      return res.status(400).json({ success: false, message: 'SSO token is required' });
    }

    const ssoSecret = process.env.JWT_SECRET;
    if (!ssoSecret) {
      return res.status(500).json({ success: false, message: 'SSO authentication not configured' });
    }

    const jwt = await import('jsonwebtoken');
    const decoded = jwt.verify(ssoToken, ssoSecret) as { phone?: string; email?: string };
    const identifierQuery = decoded.phone ? { phone: decoded.phone } : decoded.email ? { email: decoded.email } : null;

    if (!identifierQuery) {
      return res.status(400).json({ success: false, message: 'Invalid SSO token payload' });
    }

    const user = await User.findOne(identifierQuery).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found for this SSO identity' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Your account is inactive. Please contact administrator.' });
    }

    if (isPlatformSuperAdminUser(user)) {
      await ensurePlatformSuperAdminRole();
    }

    return handleResolvedLogin(req, res, user, 'SSO');
  } catch (error: any) {
    const message = error.name === 'TokenExpiredError'
      ? 'SSO token expired. Please login again from main dashboard.'
      : 'Invalid SSO token';

    return res.status(error.name === 'TokenExpiredError' ? 401 : 401).json({ success: false, message });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { phone, email, password } = req.body;

    if ((!phone && !email) || !password) {
      return res.status(400).json({
        success: false,
        message: 'Phone number or email and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    let normalizedPhone = phone;
    if (phone && phone.trim()) {
      const { validatePhoneNumber, normalizePhoneNumber } = await import('../utils/phoneUtils');
      const phoneTrimmed = phone.trim();
      if (!validatePhoneNumber(phoneTrimmed)) {
        return res.status(400).json({
          success: false,
          message: 'Phone number must be 10 digits or 12 digits (with country code)'
        });
      }
      normalizedPhone = normalizePhoneNumber(phoneTrimmed);
    }

    const identifierQuery = email
      ? { email: email.toLowerCase().trim() }
      : { phone: normalizedPhone };

    const user = await User.findOne(identifierQuery).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: email
          ? 'Email is incorrect. Please check and try again.'
          : 'Phone number is incorrect. Please check and try again.'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account is inactive. Contact administrator.'
      });
    }

    if (!user.isSuperAdmin && user.companyId) {
      const Company = (await import('../models/Company')).default;
      const company = await Company.findById(user.companyId).select('isActive isSuspended');
      if (!company || !company.isActive || company.isSuspended) {
        return res.status(403).json({
          success: false,
          message: 'Your company account is inactive or suspended.'
        });
      }
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Password is incorrect. Please check and try again.'
      });
    }

    if (isPlatformSuperAdminUser(user)) {
      await ensurePlatformSuperAdminRole();
    }

    return handleResolvedLogin(req, res, user, 'PASSWORD');
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
});

router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const response = await buildAuthResponse(user, 'PASSWORD');

    return res.json({
      success: true,
      data: {
        user: response.user
      }
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'Server error',
      error: error.statusCode ? undefined : error.message
    });
  }
});

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, password, phone, companyId, departmentId, subDepartmentId, customRoleId } = req.body;

    if (!firstName || !lastName || !password || (!phone && !email) || !customRoleId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide first name, last name, password, one login identifier, and customRoleId'
      });
    }

    const user = await User.create({
      firstName,
      lastName,
      email: email?.toLowerCase().trim(),
      password,
      phone,
      companyId,
      departmentId,
      subDepartmentId,
      customRoleId,
      isSuperAdmin: false
    });

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user._id,
          userId: user.userId,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          customRoleId: user.customRoleId,
          isSuperAdmin: user.isSuperAdmin
        }
      }
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
});

export default router;
