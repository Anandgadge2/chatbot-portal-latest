import express, { Request, Response } from 'express';
import User from '../models/User';
import { generateToken, generateRefreshToken } from '../utils/jwt';
import { logUserAction } from '../utils/auditLogger';
import { AuditAction } from '../config/constants';
import mongoose from 'mongoose';

const router = express.Router();

// @route   POST /api/auth/sso/login
// @desc    SSO Login from main dashboard (SSO Token Required - SECURE)
// @access  Public (but requires valid SSO token)
router.post('/sso/login', async (req: Request, res: Response) => {
  try {
    const ssoToken = req.body.ssoToken || req.body.token;

    // SECURITY: Require SSO token - NEVER accept phone directly
    if (!ssoToken) {
      console.log('❌ SSO login attempted without token');
      res.status(400).json({
        success: false,
        message: 'SSO token is required'
      });
      return;
    }

    console.log('🔐 SSO Login attempt with token');

    // Get SSO secret from environment
    const ssoSecret = process.env.JWT_SECRET;
    console.log('JWT_SECRET:', ssoSecret);
    if (!ssoSecret) {
      console.error('❌ SSO_SECRET not configured');
      
      res.status(500).json({
        success: false,
        message: 'SSO authentication not configured'
      });
      return;
    }

    const jwt = await import('jsonwebtoken');
    
    // STEP 1: Verify SSO token signature and expiry
    let decoded: any;
    try {
      decoded = jwt.verify(ssoToken, ssoSecret);
      console.log('✅ SSO token verified:', { phone: decoded.phone, source: decoded.source });
    } catch (err: any) {
      console.error('❌ SSO token verification failed:', err.message);
      
      if (err.name === 'TokenExpiredError') {
        res.status(401).json({
          success: false,
          message: 'SSO token expired. Please login again from main dashboard.'
        });
        return;
      }
      
      res.status(401).json({
        success: false,
        message: 'Invalid SSO token'
      });
      return;
    }

    // STEP 2: Validate token source (must come from MAIN_DASHBOARD)
    // if (decoded.source !== 'MAIN_DASHBOARD') {
    //   console.error('❌ Invalid SSO token source:', decoded.source);
    //   res.status(401).json({
    //     success: false,
    //     message: 'Invalid SSO token source'
    //   });
    //   return;
    // }

    // STEP 3: Extract phone from verified token (NOT from request body)
    const { phone } = decoded;
    
    if (!phone) {
      console.error('❌ No phone number in SSO token payload');
      res.status(400).json({
        success: false,
        message: 'Invalid SSO token payload'
      });
      return;
    }

    console.log('📱 SSO Login for verified phone:', phone);

    // STEP 4: Find user in database
    const user = await User.findOne({ 
      phone
    });

    if (!user) {
      console.log('❌ User not found for phone:', phone);
      res.status(404).json({
        success: false,
        message: 'No account found with this phone number'
      });
      return;
    }

    // STEP 5: Check if user is active
    if (!user.isActive) {
      console.log('❌ User account is inactive:', phone);
      res.status(403).json({
        success: false,
        message: 'Your account is inactive. Please contact administrator.'
      });
      return;
    }

    console.log('✅ SSO authentication successful for:', phone);
    
    // STEP 6: Update last login
    user.lastLogin = new Date();
    await user.save();

    // STEP 7: Generate NEW session tokens (DO NOT reuse SSO token)
    const sessionPayload = {
      userId: user._id.toString(),
      phone: user.phone,
      email: user.email,
      role: user.role,
      companyId: user.companyId?.toString(),
      departmentId: user.departmentId?.toString(),
      loginType: 'SSO' // Track login method
    };

    const accessToken = generateToken(sessionPayload);
    const refreshToken = generateRefreshToken(sessionPayload);

    // STEP 8: Audit log with SSO login type
    await logUserAction(
      { user, ip: req.ip, get: req.get.bind(req) } as any,
      AuditAction.LOGIN,
      'User',
      user._id.toString(),
      { loginMethod: 'SSO', source: 'MAIN_DASHBOARD' }
    );

    console.log('✅ SSO login completed for:', user.userId);

    res.json({
      success: true,
      message: 'SSO login successful',
      data: {
        user: {
          id: user._id,
          userId: user.userId,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          companyId: user.companyId,
          departmentId: user.departmentId,
          isActive: user.isActive,
          loginType: 'SSO'
        },
        accessToken,
        refreshToken
      }
    });

  } catch (error: any) {
    console.error('❌ SSO login error:', error);
    res.status(500).json({
      success: false,
      message: 'SSO login failed',
      error: error.message
    });
  }
});
  
// @route   POST /api/auth/login
// @desc    Login user with phone and password
// @access  Public
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { phone, email, password } = req.body;

    // Validation - require either phone or email, plus password
    if ((!phone && !email) || !password) {
      return res.status(400).json({
        success: false,
        message: 'Phone number or email and password are required'
      });
    }

    // Validate password length
    if (password && password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Validate and normalize phone number if provided (add 91 prefix if 10 digits)
    let normalizedPhone = phone;
    if (phone && phone.trim()) {
      const { validatePhoneNumber, normalizePhoneNumber } = await import('../utils/phoneUtils');
      const phoneTrimmed = phone.trim();
      // Validate phone number format (must be 10 digits)
      if (!validatePhoneNumber(phoneTrimmed)) {
        return res.status(400).json({
          success: false,
          message: 'Phone number must be exactly 10 digits'
        });
      }
      normalizedPhone = normalizePhoneNumber(phoneTrimmed);
    }

    console.log('🔐 Login attempt for:', normalizedPhone || email);

    // Find user by phone or email (exclude soft-deleted)
    const query: any = {};
    if (email) {
      query.email = email;
    } else {
      query.phone = normalizedPhone;
    }

    const user = await User.findOne(query).select('+password'); // IMPORTANT

    if (!user) {
      console.log('❌ User not found for:', phone || email);
      return res.status(401).json({
        success: false,
        message: email 
          ? 'Email is incorrect. Please check and try again.'
          : 'Phone number is incorrect. Please check and try again.'
      });
    }

    // Check active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account is inactive. Contact administrator.'
      });
    }

    // Verify password using User model method
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      console.log('❌ Invalid password for:', phone);
      return res.status(401).json({
        success: false,
        message: 'Password is incorrect. Please check and try again.'
      });
    }

    console.log('✅ Password verified. Login successful for:', phone);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Token payload
    const tokenPayload = {
      userId: user._id.toString(),
      phone: user.phone,
      email: user.email,
      role: user.role,
      companyId: user.companyId?.toString(),
      departmentId: user.departmentId?.toString(),
      loginType: 'PASSWORD' // Track login method
    };

    const accessToken = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Audit log
    await logUserAction(
      { user, ip: req.ip, get: req.get.bind(req) } as any,
      AuditAction.LOGIN,
      'User',
      user._id.toString(),
      { loginMethod: 'PASSWORD' }
    );

    return res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          userId: user.userId,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          companyId: user.companyId,
          departmentId: user.departmentId,
          isActive: user.isActive,
          loginType: 'PASSWORD'
        },
        accessToken,
        refreshToken
      }
    });

  } catch (error: any) {
    console.error('❌ Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Login failed'
    });
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
