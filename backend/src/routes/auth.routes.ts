import express, { Request, Response } from 'express';
import User from '../models/User';
import { generateToken, generateRefreshToken } from '../utils/jwt';
import { logUserAction } from '../utils/auditLogger';
import { AuditAction } from '../config/constants';
import mongoose from 'mongoose';
import Company from '../models/Company';
import { resolveUserAccess } from '../utils/accessControl';
import { authenticate } from '../middleware/auth';


const router = express.Router();


const buildSessionResponse = async (user: any) => {
  const access = await resolveUserAccess(user);

  return {
    access,
    sessionPayload: {
      userId: user._id.toString(),
      phone: user.phone,
      email: user.email,
      companyId: user.companyId instanceof mongoose.Types.ObjectId
        ? user.companyId.toString()
        : (user.companyId as any)?._id?.toString() || (user.companyId as any)?.toString(),
      departmentId: user.departmentId instanceof mongoose.Types.ObjectId
        ? user.departmentId.toString()
        : (user.departmentId as any)?._id?.toString() || (user.departmentId as any)?.toString(),
      subDepartmentId: undefined,
      roleId: access.roleId,
      isSuperAdmin: access.isSuperAdmin,
      level: access.level,
      scope: access.scope,
      filteredPermissions: access.filteredPermissions,
      permissionsVersion: access.permissionsVersion,
    },
    user: {
      id: user._id,
      userId: user.userId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      roleId: access.roleId,
      companyId: user.companyId?._id || user.companyId,
      departmentId: user.departmentId,
      enabledModules: (user.companyId as any)?.enabledModules || [],
      isActive: user.isActive,
      customRoleId: user.customRoleId,
      permissions: access.filteredPermissions,
      filteredPermissions: access.filteredPermissions,
      isSuperAdmin: access.isSuperAdmin,
      level: access.level,
      scope: access.scope,
      permissionsVersion: access.permissionsVersion,
      notificationSettings: user.notificationSettings
    }
  };
};

const ensureCompanyAccess = async (user: any) => {
  if (!user.companyId) {
    return null;
  }

  const companyId = user.companyId instanceof mongoose.Types.ObjectId
    ? user.companyId
    : (user.companyId as any)?._id || user.companyId;

  const company = await Company.findById(companyId).select('isActive isSuspended enabledModules permissionsVersion').lean();

  if (!company || !company.isActive || company.isSuspended) {
    return null;
  }

  return company;
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
    } catch (error: any) {
      res.status(401).json({
        success: false,
        message: error.name === 'TokenExpiredError'
          ? 'SSO token expired. Please login again from main dashboard.'
          : 'Invalid SSO token'
      });
      return;
    }

    const { phone } = decoded;
    if (!phone) {
      res.status(400).json({ success: false, message: 'Invalid SSO token payload' });
      return;
    }

    const user = await User.findOne({ phone }).populate('companyId');

    if (!user) {
      res.status(404).json({ success: false, message: 'No account found with this phone number' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ success: false, message: 'Your account is inactive. Please contact administrator.' });
      return;
    }

    const company = await ensureCompanyAccess(user);
    if (user.companyId && !company) {
      res.status(403).json({ success: false, message: 'Company access is unavailable.' });
      return;
    }

    const { access, sessionPayload, user: responseUser } = await buildSessionResponse(user);
    const accessToken = generateToken(sessionPayload);
    const refreshToken = generateRefreshToken(sessionPayload);

    user.lastLogin = new Date();
    await user.save();

    await logUserAction(
      { user, ip: req.ip, get: req.get.bind(req) } as any,
      AuditAction.LOGIN,
      'User',
      user._id.toString(),
      { loginMethod: 'SSO', level: access.level, scope: access.scope }
    );

    res.json({
      success: true,
      message: 'SSO login successful',
      data: {
        user: { ...responseUser, loginType: 'SSO' },
        accessToken,
        refreshToken
      }
    });
  } catch (_error: any) {
    if (_error?.code === 'ASSIGNED_ROLE_MISSING') {
      res.status(401).json({ success: false, message: 'Assigned role no longer exists' });
      return;
    }

    res.status(500).json({ success: false, message: 'SSO login failed' });
  }
});
  
// @route   POST /api/auth/login
// @desc    Login user with phone and password
// @access  Public
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { phone, email, password } = req.body;

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
      return res.status(401).json({
        success: false,
        message: email ? 'Email is incorrect. Please check and try again.' : 'Phone number is incorrect. Please check and try again.'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Your account is inactive. Contact administrator.' });
    }

    const company = await ensureCompanyAccess(user);
    if (user.companyId && !company) {
      return res.status(403).json({ success: false, message: 'Company access is unavailable.' });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Password is incorrect. Please check and try again.' });
    }

    const { access, sessionPayload, user: responseUser } = await buildSessionResponse(user);
    const accessToken = generateToken(sessionPayload);
    const refreshToken = generateRefreshToken(sessionPayload);

    user.lastLogin = new Date();
    await user.save();

    await logUserAction(
      { user, ip: req.ip, get: req.get.bind(req) } as any,
      AuditAction.LOGIN,
      'User',
      user._id.toString(),
      { loginMethod: 'PASSWORD', level: access.level, scope: access.scope }
    );

    return res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: { ...responseUser, loginType: 'PASSWORD' },
        accessToken,
        refreshToken
      }
    });
  } catch (_error: any) {
    if (_error?.code === 'ASSIGNED_ROLE_MISSING') {
      return res.status(401).json({ success: false, message: 'Assigned role no longer exists' });
    }

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

    const company = await ensureCompanyAccess(user);
    if (user.companyId && !company) {
      return res.status(403).json({ success: false, message: 'Company access is unavailable.' });
    }

    const { user: responseUser } = await buildSessionResponse(user);

    res.json({ success: true, data: { user: responseUser } });
  } catch (_error: any) {
    if (_error?.code === 'ASSIGNED_ROLE_MISSING') {
      res.status(401).json({ success: false, message: 'Assigned role no longer exists' });
      return;
    }

    res.status(500).json({ success: false, message: 'Server error' });
  }
});


// @route   POST /api/auth/register
// @desc    Register new user (Admin only)
// @access  Private
router.post('/register', authenticate, async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, password, phone, role, companyId, departmentId } = req.body;

    if (!req.user?.isSuperAdmin && req.user?.level !== 1) {
      res.status(403).json({ success: false, message: 'Access denied.' });
      return;
    }

    if (companyId && !mongoose.Types.ObjectId.isValid(companyId)) {
      res.status(400).json({ success: false, message: 'Invalid companyId' });
      return;
    }

    if (departmentId && !mongoose.Types.ObjectId.isValid(departmentId)) {
      res.status(400).json({ success: false, message: 'Invalid departmentId' });
      return;
    }

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
      message: 'Registration failed'
    });
  }
});



export default router;
