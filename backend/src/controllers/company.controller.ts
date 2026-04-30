import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Company from '../models/Company';
import User from '../models/User';
import { logUserAction } from '../utils/auditLogger';
import { AuditAction } from '../config/constants';

const ALLOWED_LANGUAGES = ['en', 'hi', 'or', 'mr'] as const;

const normalizeSelectedLanguages = (languages: unknown): string[] => {
  const normalized = Array.isArray(languages)
    ? languages.filter((language): language is string =>
      typeof language === 'string' && ALLOWED_LANGUAGES.includes(language as any)
    )
    : [];

  if (!normalized.includes('en')) normalized.unshift('en');
  return Array.from(new Set(normalized));
};

export const list = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, search, companyType, isActive } = req.query;

    const query: any = {};
    if (!req.user?.isSuperAdmin) {
      query._id = req.user?.companyId;
    }

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

    // Dynamically identify company administrators based on their permissions or role names
    const companyIds = companies.map(c => c._id);
    const Role = (await import('../models/Role')).default;
    const companyAdminRoles = await Role.find({
      companyId: { $in: companyIds },
      $or: [
        { name: { $regex: /admin|head|manager|supervisor|collector|official/i } },
        { 
          'permissions.module': { $in: ['SETTINGS', 'USER_MANAGEMENT', 'DEPARTMENTS'] },
          'permissions.actions': { $in: ['update', 'all', 'manage'] }
        }
      ]
    }).select('_id name');

    const adminRoleIds = companyAdminRoles.map(r => r._id);
    const adminRoleNames = companyAdminRoles.map(r => r.name);

    const admins = await User.find({
      companyId: { $in: companyIds },
      isActive: true,
      $or: [
        { customRoleId: { $in: adminRoleIds } },
        { isSuperAdmin: true }
      ]
    }).select('firstName lastName email phone companyId customRoleId isSuperAdmin').sort({ createdAt: 1 });

    const Department = (await import('../models/Department')).default;
    const departmentCounts = await Department.aggregate([
      { $match: { companyId: { $in: companyIds } } },
      { $group: { _id: '$companyId', count: { $sum: 1 } } }
    ]);

    const userCounts = await User.aggregate([
      { $match: { companyId: { $in: companyIds } } },
      { $group: { _id: '$companyId', count: { $sum: 1 } } }
    ]);
    
    const mainDepartmentCounts = await Department.aggregate([
      { $match: { companyId: { $in: companyIds }, parentDepartment: null } },
      { $group: { _id: '$companyId', count: { $sum: 1 } } }
    ]);

    const subDepartmentCounts = await Department.aggregate([
      { $match: { companyId: { $in: companyIds }, parentDepartment: { $ne: null } } },
      { $group: { _id: '$companyId', count: { $sum: 1 } } }
    ]);

    const companiesWithHead = companies.map(c => {
      const admin = admins.find(a => a.companyId?.toString() === c._id.toString());
      const companyObj = c.toObject();
      
      // Attach admin info as 'companyHead'
      if (admin) {
        (companyObj as any).companyHead = {
          name: `${admin.firstName} ${admin.lastName}`,
          email: admin.email,
          phone: admin.phone
        };
      }
      
      const departmentCount = departmentCounts.find(d => d._id.toString() === c._id.toString());
      (companyObj as any).departmentCount = departmentCount ? departmentCount.count : 0;

      const userCount = userCounts.find(u => u._id.toString() === c._id.toString());
      (companyObj as any).userCount = userCount ? userCount.count : 0;

      const mainDepartmentCount = mainDepartmentCounts.find(d => d._id.toString() === c._id.toString());
      (companyObj as any).mainDepartmentCount = mainDepartmentCount ? mainDepartmentCount.count : 0;

      const subDepartmentCount = subDepartmentCounts.find(d => d._id.toString() === c._id.toString());
      (companyObj as any).subDepartmentCount = subDepartmentCount ? subDepartmentCount.count : 0;

      return companyObj;
    });

    const total = await Company.countDocuments(query);

    res.json({
      success: true,
      data: {
        companies: companiesWithHead,
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

};

export const create = async (req: Request, res: Response) => {
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
      showDepartmentPriorityColumn,
      selectedLanguages,
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
          message: 'Admin password must be at least 5 characters'
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
      enabledModules: Array.from(new Set([
        'DASHBOARD', 
        'USER_MANAGEMENT', 
        'DEPARTMENTS', 
        'ANALYTICS', 
        'GRIEVANCE',
        'APPOINTMENT',
        'SETTINGS', 
        ...(enabledModules || [])
      ])),
      showDepartmentPriorityColumn: showDepartmentPriorityColumn !== false,
      selectedLanguages: normalizeSelectedLanguages(selectedLanguages),
      theme: theme || {
        primaryColor: '#0f4c81',
        secondaryColor: '#1a73e8'
      },
      isSuspended: false
    });

    console.log('Company created successfully:', company._id);

    // ✅ AUTO-SEED DEFAULT TEMPLATES (WhatsApp & Email)
    const { seedDefaultTemplates } = await import('../services/templateSeeder');
    seedDefaultTemplates(company).catch(err => console.error('❌ Template seeding failed:', err));

    // ✅ PROVISION ADMINISTRATIVE ECOSYSTEM (Roles)
    // We clone roles for EVERY company, regardless of whether an admin user is created immediately.
    // This ensures that when a SuperAdmin later adds users, the correct roles are already present.
    let clonedRoles: any[] = [];
    try {
      const Role = (await import('../models/Role')).default;
      
      // 1. Fetch all system roles (Blueprints)
      const systemRoles = await Role.find({ companyId: null, isSystem: true });
      
      // 2. Clone roles specifically for this company
      if (systemRoles.length > 0) {
        clonedRoles = await Promise.all(systemRoles.map(async (sr: any) => {
          const roleData = sr.toObject();
          const { _id, createdAt, updatedAt, ...cleanRoleData } = roleData;
          
          return Role.create({
            ...cleanRoleData,
            name: `${sr.name} (${company.name})`,
            description: `Customized role for ${company.name} based on ${sr.name}`,
            isSystem: false,
            companyId: company._id,
            createdBy: req.user!._id
          });
        }));
        console.log(`✅ Provisioned isolated role set (${clonedRoles.length} roles) for ${company.name}`);
      } else {
        console.warn('⚠️ No system roles found to clone for company:', company.name);
      }
    } catch (roleError: any) {
      console.error('❌ Role provisioning failed:', roleError);
    }

    // Create company admin if admin data is provided
    let adminUser: any = null;
    if (admin && admin.email && admin.password && admin.firstName && admin.lastName) {
      console.log('Provisioning administrator for company:', admin.email);

      try {
        // 4. Identify the primary "Company Administrator" from the new clones
        const adminRole = clonedRoles.find(r => r.name.startsWith('Company Administrator'));
        
        if (!adminRole) {
          console.warn('⚠️ No "Company Administrator" role found in clones. Admin user creation will use fallback or skip customRoleId.');
        }

        // 5. Create the actual admin user linked to the new company-specific role
        adminUser = await User.create({
          firstName: admin.firstName,
          lastName: admin.lastName,
          email: admin.email.toLowerCase().trim(),
          password: admin.password,
          phone: normalizedAdminPhone || normalizedContactPhone || undefined,
          role: adminRole ? adminRole.name : 'COMPANY_ADMIN',
          customRoleId: adminRole ? adminRole._id : undefined,
          companyId: company._id,
          isActive: true,
          rawPassword: admin.password,
          createdBy: req.user!._id
        });

        console.log(`✅ Admin user created for ${company.name}`);
      } catch (adminError: any) {
        console.error('❌ Admin user provisioning failed:', adminError);
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

};

export const me = async (req: Request, res: Response) => {
  try {
    const currentUser = req.user;

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!currentUser.companyId) {
      return res.status(404).json({
        success: false,
        message: 'You are not associated with any company'
      });
    }

    // Safely parse companyId
    const companyIdStr = currentUser.companyId ? currentUser.companyId.toString() : '';

    if (!mongoose.Types.ObjectId.isValid(companyIdStr)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company association format'
      });
    }

    const company = await Company.findById(companyIdStr);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Associated company not found'
      });
    }

    return res.json({
      success: true,
      data: { company }
    });
  } catch (error: any) {
    console.error('[CompanyController.me] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch company information',
      error: error.message
    });
  }
};

export const updateMe = async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;
    if (!currentUser.companyId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const updateData: any = {};
    if (req.body.name) updateData.name = req.body.name;
    if (req.body.nameHi) updateData.nameHi = req.body.nameHi;
    if (req.body.nameOr) updateData.nameOr = req.body.nameOr;
    if (req.body.nameMr) updateData.nameMr = req.body.nameMr;
    if (req.body.contactEmail) updateData.contactEmail = req.body.contactEmail;
    if (req.body.contactPhone) updateData.contactPhone = req.body.contactPhone;
    if (req.body.address) updateData.address = req.body.address;
    if (req.body.selectedLanguages) updateData.selectedLanguages = normalizeSelectedLanguages(req.body.selectedLanguages);
    if (req.body.slaSettings) updateData.slaSettings = req.body.slaSettings;

    const company = await Company.findByIdAndUpdate(
      currentUser.companyId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    await logUserAction(req, AuditAction.UPDATE, 'Company', company._id.toString(), { updates: updateData });

    res.json({ success: true, message: 'Company settings updated', data: { company } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update company information', error: error.message });
  }
};

export const getById = async (req: Request, res: Response) => {
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

};

export const update = async (req: Request, res: Response) => {
  try {
    // Normalize phone numbers if provided in update
    const updateData: any = { ...req.body };

    if (req.body.selectedLanguages !== undefined) {
      updateData.selectedLanguages = normalizeSelectedLanguages(req.body.selectedLanguages);
    }
    
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

    // Dynamic Permission Sync: If modules were updated, sync the Company Administrator role
    if (req.body.enabledModules !== undefined) {
      try {
        const Role = (await import('../models/Role')).default;
        const adminRole = await Role.findOne({ 
          companyId: company._id, 
          isSystem: true, 
          name: 'Company Administrator' 
        });

        if (adminRole) {
          const newModules = req.body.enabledModules || [];
          const permissions: any[] = newModules.map((m: string) => ({
            module: m.toUpperCase(),
            actions: ['*']
          }));
          
          // Ensure mandatory modules are preserved
          const mandatoryModules = ['SETTINGS', 'USER_MANAGEMENT', 'DEPARTMENTS', 'ANALYTICS'];
          mandatoryModules.forEach(m => {
            if (!permissions.find(p => p.module === m)) {
              permissions.push({ module: m, actions: ['*'] });
            }
          });

          adminRole.permissions = permissions;
          await adminRole.save();
          console.log(`[Sync] Updated "Company Administrator" role permissions for company ${company.name}`);
        }
      } catch (syncError) {
        console.error('Failed to sync Company Administrator permissions:', syncError);
      }
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

};

export const remove = async (req: Request, res: Response) => {
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

};
