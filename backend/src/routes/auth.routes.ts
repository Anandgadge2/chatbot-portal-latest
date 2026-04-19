import express, { Request, Response } from 'express';
import User from '../models/User';
import { generateToken, generateRefreshToken } from '../utils/jwt';
import { logUserAction } from '../utils/auditLogger';
import { AuditAction } from '../config/constants';
import mongoose from 'mongoose';
import Company from '../models/Company';
import { resolveUserAccess } from '../utils/accessControl';
import { authenticate } from '../middleware/auth';
import crypto from 'crypto';
import CompanyWhatsAppConfig from '../models/CompanyWhatsAppConfig';
import { sendWhatsAppTemplate } from '../services/whatsappService';


const router = express.Router();

const PASSWORD_RESET_OTP_TEMPLATE_NAME = process.env.WHATSAPP_PASSWORD_RESET_OTP_TEMPLATE || 'admin_password_reset_otp';
const PASSWORD_RESET_OTP_TEMPLATE_LANGUAGE = (process.env.WHATSAPP_PASSWORD_RESET_OTP_TEMPLATE_LANGUAGE || 'en') as 'en' | 'hi' | 'mr' | 'or';

const buildPhoneLookupQuery = (rawPhone: string) => {
  const digitsOnly = String(rawPhone || '').replace(/\D/g, '');
  const last10Digits = digitsOnly.length >= 10 ? digitsOnly.slice(-10) : digitsOnly;
  const variants = Array.from(
    new Set([digitsOnly, last10Digits ? `91${last10Digits}` : '', last10Digits].filter(Boolean)),
  );

  return variants.length === 1 ? { phone: variants[0] } : { phone: { $in: variants } };
};


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
      role: access.roleName || (access.isSuperAdmin ? 'Super Administrator' : 'Staff'),
      roleId: access.roleId,
      companyId: user.companyId?._id || user.companyId,
      departmentId: user.departmentId,
      departmentIds: user.departmentIds || [],
      designations: user.designations || [],
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

    const user = await User.findOne(buildPhoneLookupQuery(phone)).populate('companyId').populate('departmentIds');

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

    const query: any = email ? { email } : buildPhoneLookupQuery(normalizedPhone);
    const user = await User.findOne(query).select('+password').populate('companyId').populate('departmentIds');
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

// @route   POST /api/auth/forgot-password
// @desc    Request a password reset link
// @access  Public
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { phone } = req.body as {
      phone?: string;
    };

    if (!phone || !phone.trim()) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    const channel = 'whatsapp' as const;

    const { validatePhoneNumber, normalizePhoneNumber } = await import('../utils/phoneUtils');
    const phoneTrimmed = phone.trim();
    if (!validatePhoneNumber(phoneTrimmed)) {
      return res.status(400).json({ success: false, message: 'Phone number must be 10 digits or 12 digits (with country code)' });
    }
    const normalizedPhone = normalizePhoneNumber(phoneTrimmed);

    const user = await User.findOne(buildPhoneLookupQuery(normalizedPhone))
      .select('+resetPasswordOtpHash +resetPasswordOtpExpires +resetPasswordOtpChannel +resetPasswordOtpAttempts')
      .populate('companyId');

    // Always respond success to prevent account enumeration
    if (!user || !user.isActive) {
      return res.json({
        success: true,
        message: 'If an account exists, an OTP has been sent on WhatsApp.'
      });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.resetPasswordOtpHash = otpHash;
    user.resetPasswordOtpExpires = otpExpiry;
    user.resetPasswordOtpChannel = 'whatsapp';
    user.resetPasswordOtpAttempts = 0;
    await user.save();

    let deliverySuccess = false;
    let deliveryError: string | undefined;

    const companyId = user.companyId instanceof mongoose.Types.ObjectId
      ? user.companyId
      : (user.companyId as any)?._id;
    const waConfig = companyId
      ? await CompanyWhatsAppConfig.findOne({ companyId, isActive: true })
      : null;

    if (waConfig) {
      const waCompany = {
        _id: companyId,
        name: (user.companyId as any)?.name || 'Portal',
        whatsappConfig: {
          phoneNumberId: waConfig.phoneNumberId,
          accessToken: waConfig.accessToken
        }
      };

      const templateResult = await sendWhatsAppTemplate(
        waCompany,
        user.phone,
        PASSWORD_RESET_OTP_TEMPLATE_NAME,
        [otp],
        PASSWORD_RESET_OTP_TEMPLATE_LANGUAGE,
        undefined,
        undefined,
        {
          recipientType: 'ADMIN',
          requireConsent: false
        }
      );

      deliverySuccess = !!templateResult?.success;
      deliveryError = templateResult?.error;
    } else {
      deliveryError = 'WhatsApp is not configured for this company';
    }
    /*
      const companyId = user.companyId instanceof mongoose.Types.ObjectId
        ? user.companyId
        : (user.companyId as any)?._id;
      const waConfig = companyId
        ? await CompanyWhatsAppConfig.findOne({ companyId, isActive: true })
        : null;

      if (waConfig) {
        const waCompany = {
          name: (user.companyId as any)?.name || 'Portal',
          whatsappConfig: {
            phoneNumberId: waConfig.phoneNumberId,
            accessToken: waConfig.accessToken
          }
        };
        const otpTextMessage = `Your password reset OTP is ${otp}. It expires in 10 minutes.`;

        // Prefer Meta-approved authentication template for out-of-window reliability.
        const templateResult = await sendWhatsAppTemplate(
          waCompany,
          user.phone,
          PASSWORD_RESET_OTP_TEMPLATE_NAME,
          [otp],
          PASSWORD_RESET_OTP_TEMPLATE_LANGUAGE
        );

        if (templateResult?.success) {
          deliverySuccess = true;
        } else {
          console.warn(
            `⚠️ OTP template send failed for ${user.phone}. Falling back to text message.`,
            { error: templateResult?.error, templateName: PASSWORD_RESET_OTP_TEMPLATE_NAME }
          );

          const fallbackResult = await sendWhatsAppMessage(waCompany, user.phone, otpTextMessage);
          deliverySuccess = !!fallbackResult?.success;
          deliveryError = fallbackResult?.error || templateResult?.error;
        }
      } else {
        deliveryError = 'WhatsApp is not configured for this company';
      }
    } else {
      deliveryError = 'Selected delivery channel is unavailable for this account';
    }

    */

    if (!deliverySuccess) {
      user.resetPasswordOtpHash = undefined;
      user.resetPasswordOtpExpires = undefined;
      user.resetPasswordOtpChannel = undefined;
      user.resetPasswordOtpAttempts = 0;
      await user.save();
      return res.status(400).json({
        success: false,
        message: deliveryError || 'Unable to send OTP on WhatsApp. Please try again.'
      });
    }

    return res.json({
      success: true,
      message: 'If an account exists, an OTP has been sent on WhatsApp.',
      data: process.env.NODE_ENV === 'production' ? undefined : { otp }
    });
  } catch (_error: any) {
    return res.status(500).json({ success: false, message: 'Unable to process forgot password request' });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password using reset token
// @access  Public
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { phone, otp, password } = req.body;

    if (!phone || !otp || !password) {
      return res.status(400).json({ success: false, message: 'Phone, OTP and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const { validatePhoneNumber, normalizePhoneNumber } = await import('../utils/phoneUtils');
    const phoneTrimmed = phone.trim();
    if (!validatePhoneNumber(phoneTrimmed)) {
      return res.status(400).json({ success: false, message: 'Phone number must be 10 digits or 12 digits (with country code)' });
    }
    const normalizedPhone = normalizePhoneNumber(phoneTrimmed);

    const user = await User.findOne(buildPhoneLookupQuery(normalizedPhone))
      .select('+resetPasswordOtpHash +resetPasswordOtpExpires +resetPasswordOtpAttempts +password');

    if (!user || !user.isActive) {
      return res.status(400).json({ success: false, message: 'Invalid OTP or OTP has expired' });
    }

    if (
      !user.resetPasswordOtpHash ||
      !user.resetPasswordOtpExpires ||
      user.resetPasswordOtpExpires <= new Date()
    ) {
      return res.status(400).json({ success: false, message: 'Invalid OTP or OTP has expired' });
    }

    if ((user.resetPasswordOtpAttempts || 0) >= 5) {
      return res.status(429).json({ success: false, message: 'Too many invalid OTP attempts. Request a new OTP.' });
    }

    const otpHash = crypto.createHash('sha256').update(String(otp).trim()).digest('hex');
    if (otpHash !== user.resetPasswordOtpHash) {
      user.resetPasswordOtpAttempts = (user.resetPasswordOtpAttempts || 0) + 1;
      await user.save();
      return res.status(400).json({ success: false, message: 'Invalid OTP or OTP has expired' });
    }

    user.password = password;
    user.resetPasswordOtpHash = undefined;
    user.resetPasswordOtpExpires = undefined;
    user.resetPasswordOtpChannel = undefined;
    user.resetPasswordOtpAttempts = 0;
    await user.save();

    return res.json({ success: true, message: 'Password has been reset successfully' });
  } catch (_error: any) {
    return res.status(500).json({ success: false, message: 'Unable to reset password' });
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

    const user = await User.findById(userId).populate('companyId').populate('departmentIds');
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

// @route   PUT /api/auth/profile
// @desc    Update current user profile
// @access  Private
router.put('/profile', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const { firstName, lastName, email, phone, designation, password } = req.body;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // 1. Validation for Email Uniqueness (within company)
    if (email && email.toLowerCase().trim() !== user.email) {
      const normalizedEmail = email.toLowerCase().trim();
      const emailQuery: any = {
        email: normalizedEmail,
        _id: { $ne: user._id }
      };
      
      if (user.companyId) {
        emailQuery.companyId = user.companyId;
      } else {
        emailQuery.$or = [{ companyId: null }, { companyId: { $exists: false } }];
      }
      
      const conflictingUser = await User.findOne(emailQuery);
      if (conflictingUser) {
        return res.status(400).json({ success: false, message: 'Email already in use' });
      }
      user.email = normalizedEmail;
    }

    // 2. Validation for Phone Uniqueness (within company)
    if (phone && phone.trim() !== user.phone) {
      const { validatePhoneNumber, normalizePhoneNumber } = await import('../utils/phoneUtils');
      const phoneTrimmed = phone.trim();
      if (!validatePhoneNumber(phoneTrimmed)) {
        return res.status(400).json({ success: false, message: 'Invalid phone number format' });
      }
      const normalizedPhone = normalizePhoneNumber(phoneTrimmed);
      
      const phoneQuery: any = {
        phone: normalizedPhone,
        _id: { $ne: user._id }
      };
      
      if (user.companyId) {
        phoneQuery.companyId = user.companyId;
      } else {
        phoneQuery.$or = [{ companyId: null }, { companyId: { $exists: false } }];
      }
      
      const conflictingPhone = await User.findOne(phoneQuery);
      if (conflictingPhone) {
        return res.status(400).json({ success: false, message: 'Phone number already in use' });
      }
      user.phone = normalizedPhone;
    }

    // 3. Update basic fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (designation) {
      user.designation = designation; // Uses the virtual setter to unshift into designations
    }
    
    // 4. Update password if provided
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
      }
      user.password = password; // Pre-save hook will hash this
    }

    await user.save();

    await logUserAction(
      { user, ip: req.ip, get: req.get.bind(req) } as any,
      AuditAction.UPDATE,
      'User',
      user._id.toString(),
      { update: 'profile' }
    );

    const { user: responseUser } = await buildSessionResponse(user);
    res.json({ success: true, message: 'Profile updated successfully', data: { user: responseUser } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update profile', error: error.message });
  }
});


// @route   POST /api/auth/register
// @desc    Register new user (Admin only)
// @access  Private
router.post('/register', authenticate, async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, password, phone, customRoleId, companyId, departmentId } = req.body;

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
    if (!firstName || !lastName || !phone || !customRoleId) {
      res.status(400).json({
        success: false,
        message: 'Please provide first name, last name, phone, and role ID'
      });
      return;
    }

    const { validatePhoneNumber, normalizePhoneNumber } = await import('../utils/phoneUtils');
    const phoneTrimmed = String(phone).trim();
    if (!validatePhoneNumber(phoneTrimmed)) {
      res.status(400).json({
        success: false,
        message: 'Phone number must be 10 digits or 12 digits (with country code)'
      });
      return;
    }
    const normalizedPhone = normalizePhoneNumber(phoneTrimmed);

    // Check if user already exists by phone in the same company
    // Allow same phone/email across different companies, but not within the same company
    // For SUPER_ADMIN (companyId = null), keep phone/email globally unique
    const phoneQuery: any = { 
      phone: normalizedPhone
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
      phone: normalizedPhone,
      customRoleId: customRoleId || null,
      companyId,
      departmentIds: departmentId ? [departmentId] : []
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
          customRoleId: user.customRoleId
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
