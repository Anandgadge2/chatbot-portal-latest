import express, { Request, Response } from 'express';
import User from '../models/User';
import { generateToken, generateRefreshToken } from '../utils/jwt';
import { logUserAction } from '../utils/auditLogger';
import { AuditAction } from '../config/constants';
import { authenticate } from '../middleware/auth';
import { clearLoginRateLimit, loginRateLimiter } from '../middleware/rateLimiter';
import { getAccessValidationError, resolveAccessContext } from '../utils/accessControl';

const router = express.Router();

const logLoginFailure = (req: Request, userId: string | undefined, reason: string) => {
  console.warn('LOGIN_FAIL', { requestId: req.requestId, userId, reason });
};

const toObjectIdString = (value: any): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (value._id) return String(value._id);
  if (typeof value.toString === 'function') return value.toString();
  return undefined;
};

const buildUserResponse = (user: any, accessContext: Awaited<ReturnType<typeof resolveAccessContext>>, loginType?: 'SSO' | 'PASSWORD') => ({
  id: user._id,
  userId: user.userId,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  phone: user.phone,
  role: (user.isSuperAdmin || user.role === 'SUPER_ADMIN') ? 'SUPER_ADMIN' : accessContext.role?.name,
  companyId: user.companyId?._id || user.companyId,
  departmentId: user.departmentId,
  subDepartmentId: user.subDepartmentId,
  enabledModules: accessContext.company?.enabledModules || [],
  isActive: user.isActive,
  ...(loginType ? { loginType } : {}),
  customRoleId: user.customRoleId,
  isSuperAdmin: user.isSuperAdmin || user.role === 'SUPER_ADMIN',
  permissions: accessContext.filteredPermissions,
  notificationSettings: user.notificationSettings
});

const buildTokenPayload = (user: any, accessContext: Awaited<ReturnType<typeof resolveAccessContext>>) => ({
  userId: user._id.toString(),
  phone: user.phone,
  email: user.email,
  isSuperAdmin: user.isSuperAdmin || user.role === 'SUPER_ADMIN',
  companyId: toObjectIdString(user.companyId),
  departmentId: toObjectIdString(user.departmentId),
  subDepartmentId: toObjectIdString(user.subDepartmentId),
  roleId: accessContext.role?._id?.toString(),
  level: accessContext.level,
  scope: accessContext.scope,
  filteredPermissions: accessContext.filteredPermissions,
  permissionsVersion: accessContext.company?.permissionsVersion
});

const completeLogin = async (
  req: Request,
  res: Response,
  user: any,
  loginType: 'SSO' | 'PASSWORD',
  successMessage: string
) => {
  user.isSuperAdmin = user.isSuperAdmin || user.role === 'SUPER_ADMIN';
  const accessContext = await resolveAccessContext(user);

  const accessError = getAccessValidationError(user, accessContext);
  if (accessError) {
    logLoginFailure(req, user?._id?.toString(), accessError.message.toUpperCase().replace(/[^A-Z0-9]+/g, '_'));
    return res.status(accessError.statusCode).json({ success: false, message: accessError.message });
  }

  user.lastLogin = new Date();
  await user.save();

  const tokenPayload = buildTokenPayload(user, accessContext);
  if (loginType === 'PASSWORD') {
    await clearLoginRateLimit(req);
  }

  const accessToken = generateToken(tokenPayload as any);
  const refreshToken = generateRefreshToken(tokenPayload as any);

  await logUserAction(
    { user, ip: req.ip, get: req.get.bind(req) } as any,
    AuditAction.LOGIN,
    'User',
    user._id.toString(),
    { loginMethod: loginType }
  );

  return res.json({
    success: true,
    message: successMessage,
    data: {
      user: buildUserResponse(user, accessContext, loginType),
      accessToken,
      refreshToken
    }
  });
};

// @route   POST /api/auth/sso/login
// @desc    SSO Login from main dashboard (SSO Token Required - SECURE)
// @access  Public (but requires valid SSO token)
router.post('/sso/login', async (req: Request, res: Response) => {
  try {
    const ssoToken = req.body.ssoToken || req.body.token;

    if (!ssoToken) {
      res.status(400).json({ success: false, message: 'SSO token is required' });
      return;
    }

    const ssoSecret = process.env.JWT_SECRET;
    if (!ssoSecret) {
      res.status(500).json({ success: false, message: 'SSO authentication not configured' });
      return;
    }

    const jwt = await import('jsonwebtoken');

    let decoded: any;
    try {
      decoded = jwt.verify(ssoToken, ssoSecret);
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        res.status(401).json({ success: false, message: 'SSO token expired. Please login again from main dashboard.' });
        return;
      }

      res.status(401).json({ success: false, message: 'Invalid SSO token' });
      return;
    }

    const { phone } = decoded;
    if (!phone) {
      res.status(400).json({ success: false, message: 'Invalid SSO token payload' });
      return;
    }

    const user = await User.findOne({ phone }).populate('companyId');
    if (!user) {
      logLoginFailure(req, undefined, 'USER_NOT_FOUND');
      res.status(404).json({ success: false, message: 'No account found with this phone number' });
      return;
    }

    if (!user.isActive) {
      logLoginFailure(req, user._id?.toString(), 'INACTIVE_USER');
      res.status(403).json({ success: false, message: 'Your account is inactive. Please contact administrator.' });
      return;
    }

    await completeLogin(req, res, user, 'SSO', 'SSO login successful');
  } catch (error: any) {
    console.error('❌ SSO login error:', error);
    res.status(500).json({ success: false, message: 'SSO login failed' });
  }
});

// @route   POST /api/auth/login
// @desc    Login user with phone and password
// @access  Public
router.post('/login', loginRateLimiter, async (req: Request, res: Response) => {
  try {
    const { phone, password } = req.body;
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : undefined;

    if ((!phone && !email) || !password) {
      return res.status(400).json({ success: false, message: 'Phone number or email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    let normalizedPhone = phone;
    if (phone && phone.trim()) {
      const { validatePhoneNumber, normalizePhoneNumber } = await import('../utils/phoneUtils');
      const phoneTrimmed = phone.trim();
      if (!validatePhoneNumber(phoneTrimmed)) {
        return res.status(400).json({ success: false, message: 'Phone number must be 10 digits or 12 digits (with country code)' });
      }
      normalizedPhone = normalizePhoneNumber(phoneTrimmed);
    }

    const query: any = email ? { email } : { phone: normalizedPhone };
    const user = await User.findOne(query).select('+password').populate('companyId');

    if (!user) {
      logLoginFailure(req, undefined, 'USER_NOT_FOUND');
      return res.status(401).json({
        success: false,
        message: email
          ? 'Email is incorrect. Please check and try again.'
          : 'Phone number is incorrect. Please check and try again.'
      });
    }

    if (!user.isActive) {
      logLoginFailure(req, user._id?.toString(), 'INACTIVE_USER');
      return res.status(403).json({ success: false, message: 'Your account is inactive. Contact administrator.' });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      logLoginFailure(req, user._id?.toString(), 'INVALID_PASSWORD');
      return res.status(401).json({ success: false, message: 'Password is incorrect. Please check and try again.' });
    }

    return completeLogin(req, res, user, 'PASSWORD', 'Login successful');
  } catch (error: any) {
    console.error('❌ Login error:', error);
    return res.status(500).json({ success: false, message: 'Login failed' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user profile & permissions
// @access  Private
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const user = await User.findById(userId).populate('companyId');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const accessContext = await resolveAccessContext(user);

    res.json({
      success: true,
      data: {
        user: buildUserResponse(user, accessContext)
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/auth/register
// @desc    Register new user (Admin only)
// @access  Private
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, password, phone, role, companyId, departmentId } = req.body;

    // Validation
    if (!firstName || !lastName || !phone || !role) {
      res.status(400).json({
        success: false,
        message: 'Please provide first name, last name, phone, and role'
      });
      return;
    }

    // Check if user already exists by phone in the same company
    // Allow same phone/email across different companies, but not within the same company
    // For SUPER_ADMIN (companyId = null), keep phone/email globally unique
    const phoneQuery: any = { 
      phone
    };
    
    if (companyId) {
      phoneQuery.companyId = companyId;
    } else {
      // SUPER_ADMIN: check globally (companyId is null or undefined)
      phoneQuery.$or = [
        { companyId: null },
        { companyId: { $exists: false } }
      ];
    }
    
    const existingUser = await User.findOne(phoneQuery);

    if (existingUser) {
      const message = companyId 
        ? 'User with this phone number already exists in this company'
        : 'User with this phone number already exists';
      res.status(400).json({
        success: false,
        message
      });
      return;
    }

    // Check if email already exists in the same company if provided
    if (email) {
      const emailQuery: any = { 
        email: email.toLowerCase().trim()
      };
      
      if (companyId) {
        emailQuery.companyId = companyId;
      } else {
        // SUPER_ADMIN: check globally (companyId is null or undefined)
        emailQuery.$or = [
          { companyId: null },
          { companyId: { $exists: false } }
        ];
      }
      
      const existingEmail = await User.findOne(emailQuery);
      if (existingEmail) {
        const message = companyId 
          ? 'User with this email already exists in this company'
          : 'User with this email already exists';
        res.status(400).json({
          success: false,
          message
        });
        return;
      }
    }

    // Create user
    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      phone,
      role,
      companyId,
      departmentId
    });

    res.status(201).json({
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
          role: user.role
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
});



export default router;
