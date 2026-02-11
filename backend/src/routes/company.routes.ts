import express, { Request, Response } from 'express';
import Company from '../models/Company';
import User from '../models/User';
import { authenticate } from '../middleware/auth';
import { requireSuperAdmin } from '../middleware/rbac';
import { requireDatabaseConnection } from '../middleware/dbConnection';
import { logUserAction } from '../utils/auditLogger';
import { AuditAction, UserRole } from '../config/constants';

const router = express.Router();

// All routes require database connection and authentication
router.use(requireDatabaseConnection);
router.use(authenticate);

// @route   GET /api/companies
// @desc    Get all companies (SuperAdmin only)
// @access  Private/SuperAdmin
router.get('/', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, search, companyType, isActive } = req.query;

    const query: any = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { companyId: { $regex: search, $options: 'i' } }
      ];
    }

    if (companyType) {
      query.companyType = companyType;
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const companies = await Company.find(query)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .sort({ createdAt: -1 });

    const total = await Company.countDocuments(query);

    res.json({
      success: true,
      data: {
        companies,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch companies',
      error: error.message
    });
  }
});

// @route   POST /api/companies
// @desc    Create new company with admin (SuperAdmin only)
// @access  Private/SuperAdmin
router.post('/', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    console.log('Company creation request body:', req.body);
    
    const { 
      name, 
      nameHi,
      nameOr,
      nameMr,
      companyType, 
      contactEmail, 
      contactPhone, 
      address, 
      enabledModules,
      theme,
      admin // Admin user data
    } = req.body;

    // Validate required fields (only name and companyType; contact email/phone are optional)
    if (!name || !companyType) {
      console.log('Validation failed: missing required fields');
      return res.status(400).json({
        success: false,
        message: 'Please provide company name and type'
      });
    }

    // Validate and normalize contact phone if provided (telephone: landline or mobile)
    const { validateTelephone, normalizeTelephone } = await import('../utils/phoneUtils');
    let normalizedContactPhone: string | undefined = contactPhone;
    if (contactPhone) {
      if (!validateTelephone(contactPhone)) {
        return res.status(400).json({
          success: false,
          message: 'Contact phone must be 6–15 digits (e.g. 0721-2662926 or 9356150561)'
        });
      }
      normalizedContactPhone = normalizeTelephone(contactPhone);
    }

    // Validate admin password if admin is provided
    if (admin && admin.password) {
      const { validatePassword } = await import('../utils/phoneUtils');
      if (!validatePassword(admin.password)) {
        return res.status(400).json({
          success: false,
          message: 'Admin password must be at least 6 characters'
        });
      }
    }

    // Validate and normalize admin phone if provided (10-digit mobile)
    let normalizedAdminPhone = admin?.phone;
    if (admin && admin.phone) {
      const { validatePhoneNumber, normalizePhoneNumber } = await import('../utils/phoneUtils');
      if (!validatePhoneNumber(admin.phone)) {
        return res.status(400).json({
          success: false,
          message: 'Admin phone number must be exactly 10 digits'
        });
      }
      normalizedAdminPhone = normalizePhoneNumber(admin.phone);
    }

    console.log('Creating company with data:', { name, companyType, contactEmail, contactPhone: normalizedContactPhone });

    // Create company
    const company = await Company.create({
      name,
      nameHi: nameHi || undefined,
      nameOr: nameOr || undefined,
      nameMr: nameMr || undefined,
      companyType,
      contactEmail: contactEmail || undefined,
      contactPhone: normalizedContactPhone,
      address,
      enabledModules: enabledModules || [],
      theme: theme || {
        primaryColor: '#0f4c81',
        secondaryColor: '#1a73e8'
      },
      isSuspended: false
    });

    console.log('Company created successfully:', company._id);

    // Create company admin if admin data is provided
    let adminUser = null;
    if (admin && admin.email && admin.password && admin.firstName && admin.lastName) {
      console.log('Creating admin user for company:', admin.email);

      try {
        // Create admin user (password will be hashed by pre-save hook)
        adminUser = await User.create({
          firstName: admin.firstName,
          lastName: admin.lastName,
          email: admin.email,
          password: admin.password, // Pre-save hook will hash this
          phone: normalizedAdminPhone || normalizedContactPhone || undefined,
          role: UserRole.COMPANY_ADMIN,
          companyId: company._id,
          isActive: true,
          isEmailVerified: true
        });

        console.log('Admin user created successfully:', adminUser._id);
      } catch (userError: any) {
        console.error('Failed to create admin user:', userError);
        // Don't fail the whole company creation if admin creation fails
        console.warn('Company created but admin user creation failed');
      }
    }

    // Log company creation
    try {
      await logUserAction(
        req,
        AuditAction.CREATE,
        'Company',
        company._id.toString(),
        { 
          companyName: company.name,
          companyType: company.companyType,
          adminCreated: !!adminUser
        }
      );
    } catch (logError) {
      console.error('Failed to log company creation:', logError);
    }

    // Log admin creation if admin was created
    if (adminUser) {
      try {
        await logUserAction(
          req,
          AuditAction.CREATE,
          'User',
          adminUser._id.toString(),
          { 
            email: adminUser.email,
            role: adminUser.role,
            companyId: company._id
          }
        );
      } catch (logError) {
        console.error('Failed to log admin creation:', logError);
      }
    }

    console.log('Sending successful response');
    return res.status(201).json({
      success: true,
      message: 'Company created successfully' + (adminUser ? ' with admin user' : ''),
      data: { 
        company,
        admin: adminUser ? {
          id: adminUser._id,
          userId: adminUser.userId,
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          email: adminUser.email,
          role: adminUser.role,
          companyId: adminUser.companyId
        } : null
      }
    });
  } catch (error: any) {
    console.error('Company creation error:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({
      success: false,
      message: 'Failed to create company',
      error: error.message
    });
  }
});

// @route   GET /api/companies/me
// @desc    Get current user's company (for CompanyAdmin)
// @access  Private/CompanyAdmin
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;

    if (!currentUser.companyId) {
      return res.status(404).json({
        success: false,
        message: 'You are not associated with any company'
      });
    }

    const company = await Company.findById(currentUser.companyId);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    return res.json({
      success: true,
      data: { company }
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch company',
      error: error.message
    });
  }
});

// @route   GET /api/companies/:id
// @desc    Get company by ID
// @access  Private/SuperAdmin
router.get('/:id', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const company = await Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    return res.json({
      success: true,
      data: { company }
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch company',
      error: error.message
    });
  }
});

// @route   PUT /api/companies/:id
// @desc    Update company
// @access  Private/SuperAdmin
router.put('/:id', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    // Normalize phone numbers if provided in update
    const updateData: any = { ...req.body };
    
    if (updateData.contactPhone) {
      const { validateTelephone, normalizeTelephone } = await import('../utils/phoneUtils');
      if (!validateTelephone(updateData.contactPhone)) {
        return res.status(400).json({
          success: false,
          message: 'Contact phone must be 6–15 digits (e.g. 0721-2662926 or 9356150561)'
        });
      }
      updateData.contactPhone = normalizeTelephone(updateData.contactPhone);
    }

    const company = await Company.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    await logUserAction(
      req,
      AuditAction.UPDATE,
      'Company',
      company._id.toString(),
      { updates: req.body }
    );

    return res.json({
      success: true,
      message: 'Company updated successfully',
      data: { company }
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update company',
      error: error.message
    });
  }
});

// @route   DELETE /api/companies/:id
// @desc    Soft delete company
// @access  Private/SuperAdmin
router.delete('/:id', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const company = await Company.findByIdAndDelete(req.params.id);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    await logUserAction(
      req,
      AuditAction.DELETE,
      'Company',
      company._id.toString()
    );

    return res.json({
      success: true,
      message: 'Company deleted successfully'
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete company',
      error: error.message
    });
  }
});

export default router;
