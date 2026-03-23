import { Request, Response } from 'express';
import Company from '../models/Company';
import User from '../models/User';
import Role from '../models/Role';
import { logUserAction } from '../utils/auditLogger';
import { AuditAction } from '../config/constants';
import { normalizePhoneNumber, validatePassword, validatePhoneNumber, validateTelephone, normalizeTelephone } from '../utils/phoneUtils';
import { seedDefaultRoleDefinitions } from '../utils/accessControl';

const ALLOWED_LANGUAGES = ['en', 'hi', 'or', 'mr'] as const;

const normalizeSelectedLanguages = (languages: unknown): string[] => {
  const normalized = Array.isArray(languages)
    ? languages.filter((language): language is string => (
      typeof language === 'string' && ALLOWED_LANGUAGES.includes(language as any)
    ))
    : [];

  if (!normalized.includes('en')) normalized.unshift('en');
  return Array.from(new Set(normalized));
};

export const list = async (req: Request, res: Response) => {
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

    const companyIds = companies.map((company) => company._id);
    const companyAdminRoles = await Role.find({
      companyId: { $in: companyIds },
      level: 1,
      scope: 'company'
    }).select('_id companyId');

    const adminRoleIds = companyAdminRoles.map((role) => role._id);
    const admins = await User.find({
      companyId: { $in: companyIds },
      isActive: true,
      customRoleId: { $in: adminRoleIds }
    }).select('firstName lastName email phone companyId').sort({ createdAt: 1 });

    const companiesWithHead = companies.map((company) => {
      const admin = admins.find((candidate) => candidate.companyId?.toString() === company._id.toString());
      const companyObj = company.toObject();

      if (admin) {
        (companyObj as any).companyHead = {
          name: `${admin.firstName} ${admin.lastName}`,
          email: admin.email,
          phone: admin.phone
        };
      }

      return companyObj;
    });

    const total = await Company.countDocuments(query);

    return res.json({
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
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch companies',
      error: error.message
    });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
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
      selectedLanguages,
      theme,
      admin
    } = req.body;

    if (!name || !companyType) {
      return res.status(400).json({
        success: false,
        message: 'Please provide company name and type'
      });
    }

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

    if (admin?.password && !validatePassword(admin.password)) {
      return res.status(400).json({
        success: false,
        message: 'Admin password must be at least 6 characters'
      });
    }

    let normalizedAdminPhone = admin?.phone;
    if (admin?.phone) {
      if (!validatePhoneNumber(admin.phone)) {
        return res.status(400).json({
          success: false,
          message: 'Admin phone number must be exactly 10 digits'
        });
      }
      normalizedAdminPhone = normalizePhoneNumber(admin.phone);
    }

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
      selectedLanguages: normalizeSelectedLanguages(selectedLanguages),
      theme: theme || {
        primaryColor: '#0f4c81',
        secondaryColor: '#1a73e8'
      },
      isSuspended: false
    });

    const actorId = req.user?._id;
    if (!actorId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const defaultRoles = seedDefaultRoleDefinitions(actorId).map((role) => ({
      ...role,
      companyId: company._id
    }));

    const createdRoles = await Role.insertMany(defaultRoles, { ordered: true });
    const companyAdminRole = createdRoles.find((role) => role.level === 1) || null;

    let adminUser: any = null;
    if (admin && admin.email && admin.password && admin.firstName && admin.lastName && companyAdminRole) {
      adminUser = await User.create({
        firstName: admin.firstName,
        lastName: admin.lastName,
        email: admin.email.toLowerCase().trim(),
        password: admin.password,
        phone: normalizedAdminPhone || normalizedContactPhone,
        designation: admin.designation,
        companyId: company._id,
        customRoleId: companyAdminRole._id,
        isSuperAdmin: false,
        isActive: true,
        createdBy: actorId
      });
    }

    await logUserAction(req, AuditAction.CREATE, 'Company', company._id.toString(), {
      companyName: company.name,
      companyType: company.companyType,
      seededDefaultRoles: createdRoles.length,
      adminCreated: !!adminUser
    });

    if (adminUser) {
      await logUserAction(req, AuditAction.CREATE, 'User', adminUser._id.toString(), {
        email: adminUser.email,
        customRoleId: adminUser.customRoleId,
        companyId: company._id
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Company created successfully' + (adminUser ? ' with admin user' : ''),
      data: {
        company,
        roles: createdRoles,
        admin: adminUser ? {
          id: adminUser._id,
          userId: adminUser.userId,
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          email: adminUser.email,
          customRoleId: adminUser.customRoleId,
          companyId: adminUser.companyId
        } : null
      }
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create company',
      error: error.message
    });
  }
};

export const me = async (req: Request, res: Response) => {
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
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    return res.json({ success: true, data: { company } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to fetch company', error: error.message });
  }
};

export const getById = async (req: Request, res: Response) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    return res.json({ success: true, data: { company } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to fetch company', error: error.message });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const updateData: Record<string, unknown> = {};

    if (typeof req.body.name === 'string') updateData.name = req.body.name.trim();
    if (typeof req.body.nameHi === 'string') updateData.nameHi = req.body.nameHi.trim();
    if (typeof req.body.nameOr === 'string') updateData.nameOr = req.body.nameOr.trim();
    if (typeof req.body.nameMr === 'string') updateData.nameMr = req.body.nameMr.trim();
    if (typeof req.body.companyType === 'string') updateData.companyType = req.body.companyType;
    if (typeof req.body.contactEmail === 'string') updateData.contactEmail = req.body.contactEmail.trim().toLowerCase();
    if (typeof req.body.address === 'string') updateData.address = req.body.address.trim();
    if (typeof req.body.isActive === 'boolean') updateData.isActive = req.body.isActive;
    if (typeof req.body.isSuspended === 'boolean') updateData.isSuspended = req.body.isSuspended;

    if (Array.isArray(req.body.enabledModules)) {
      updateData.enabledModules = req.body.enabledModules.filter((module: unknown): module is string => typeof module === 'string');
    }

    if (req.body.selectedLanguages !== undefined) {
      updateData.selectedLanguages = normalizeSelectedLanguages(req.body.selectedLanguages);
    }

    if (req.body.theme && typeof req.body.theme === 'object') {
      const theme = req.body.theme as Record<string, unknown>;
      if (typeof theme.primaryColor === 'string') updateData['theme.primaryColor'] = theme.primaryColor;
      if (typeof theme.secondaryColor === 'string') updateData['theme.secondaryColor'] = theme.secondaryColor;
      if (typeof theme.logoUrl === 'string') updateData['theme.logoUrl'] = theme.logoUrl;
    }

    if (req.body.notificationSettings && typeof req.body.notificationSettings === 'object') {
      const roles = (req.body.notificationSettings as Record<string, unknown>).roles;
      const safeRoles: Record<string, { email: boolean; whatsapp: boolean }> = {};

      if (roles && typeof roles === 'object') {
        for (const [roleKey, value] of Object.entries(roles as Record<string, unknown>)) {
          if (
            value &&
            typeof value === 'object' &&
            typeof (value as Record<string, unknown>).email === 'boolean' &&
            typeof (value as Record<string, unknown>).whatsapp === 'boolean'
          ) {
            safeRoles[roleKey] = {
              email: (value as Record<string, boolean>).email,
              whatsapp: (value as Record<string, boolean>).whatsapp
            };
          }
        }
      }

      updateData.notificationSettings = { roles: safeRoles };
    }

    if (typeof req.body.contactPhone === 'string' && req.body.contactPhone.trim()) {
      if (!validateTelephone(req.body.contactPhone)) {
        return res.status(400).json({
          success: false,
          message: 'Contact phone must be 6–15 digits (e.g. 0721-2662926 or 9356150561)'
        });
      }
      updateData.contactPhone = normalizeTelephone(req.body.contactPhone);
    }

    const company = await Company.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    await logUserAction(req, AuditAction.UPDATE, 'Company', company._id.toString(), { updates: updateData });

    return res.json({ success: true, message: 'Company updated successfully', data: { company } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to update company', error: error.message });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    const company = await Company.findByIdAndDelete(req.params.id);
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    await logUserAction(req, AuditAction.DELETE, 'Company', company._id.toString());

    return res.json({ success: true, message: 'Company deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to delete company', error: error.message });
  }
};
