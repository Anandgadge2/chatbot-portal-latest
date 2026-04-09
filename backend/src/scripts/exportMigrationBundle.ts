import fs from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';
import { connectDatabase, closeDatabase } from '../config/database';
import Company from '../models/Company';
import User from '../models/User';
import Department from '../models/Department';
import Role from '../models/Role';
import CompanyWhatsAppTemplate from '../models/CompanyWhatsAppTemplate';
import CompanyEmailTemplate from '../models/CompanyEmailTemplate';
import CompanyWhatsAppConfig from '../models/CompanyWhatsAppConfig';
import CompanyEmailConfig from '../models/CompanyEmailConfig';
import ChatbotFlow from '../models/ChatbotFlow';

type CliOptions = {
  companyId?: string;
  outputPath: string;
  redactSecrets: boolean;
};

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  let companyId: string | undefined;
  let outputPath = `migration-export-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  let redactSecrets = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === '--companyId' && args[i + 1]) {
      companyId = args[i + 1];
      i += 1;
      continue;
    }

    if (arg === '--out' && args[i + 1]) {
      outputPath = args[i + 1];
      i += 1;
      continue;
    }

    if (arg === '--redact-secrets') {
      redactSecrets = true;
    }
  }

  return { companyId, outputPath, redactSecrets };
};

const toStringId = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  if (typeof value === 'object' && value !== null && 'toString' in value) {
    return String(value);
  }
  return null;
};

const maskSecret = (secret?: string): string | undefined => {
  if (!secret) return secret;
  if (secret.length <= 8) return '********';
  return `${secret.slice(0, 4)}********${secret.slice(-4)}`;
};

const run = async () => {
  const { companyId, outputPath, redactSecrets } = parseArgs();

  if (companyId && !mongoose.Types.ObjectId.isValid(companyId)) {
    throw new Error('Invalid --companyId. Please provide a valid MongoDB ObjectId.');
  }

  await connectDatabase();

  const companyFilter = companyId ? { _id: new mongoose.Types.ObjectId(companyId) } : {};

  const companies = await Company.find(companyFilter).lean();
  const companyIds = companies.map((company) => company._id);

  if (!companies.length) {
    console.warn('No companies found for supplied filters.');
  }

  const [users, departments, roles, whatsappTemplates, emailTemplates, whatsappConfigs, emailConfigs, chatbotFlows] = await Promise.all([
    User.find({ companyId: { $in: companyIds } }).select('+password').lean(),
    Department.find({ companyId: { $in: companyIds } }).lean(),
    Role.find({ companyId: { $in: companyIds } }).lean(),
    CompanyWhatsAppTemplate.find({ companyId: { $in: companyIds } }).lean(),
    CompanyEmailTemplate.find({ companyId: { $in: companyIds } }).lean(),
    CompanyWhatsAppConfig.find({ companyId: { $in: companyIds } }).lean(),
    CompanyEmailConfig.find({ companyId: { $in: companyIds } }).lean(),
    ChatbotFlow.find({ companyId: { $in: companyIds } }).lean()
  ]);

  const companyById = new Map(companies.map((company) => [company._id.toString(), company]));
  const departmentById = new Map(departments.map((dept) => [dept._id.toString(), dept]));

  const userDepartmentMappings = users.map((user) => {
    const mappedDepartments = (user.departmentIds || [])
      .map((departmentId) => {
        const department = departmentById.get(toStringId(departmentId) || '');
        return {
          departmentObjectId: toStringId(departmentId),
          departmentId: department?.departmentId || null,
          departmentName: department?.name || null
        };
      })
      .filter((row) => row.departmentObjectId);

    return {
      userObjectId: user._id.toString(),
      userId: user.userId || null,
      userName: `${user.firstName} ${user.lastName}`.trim(),
      phone: user.phone,
      email: user.email || null,
      companyObjectId: toStringId(user.companyId),
      companyName: companyById.get(toStringId(user.companyId) || '')?.name || null,
      departments: mappedDepartments
    };
  });

  const sanitizedWhatsAppConfigs = whatsappConfigs.map((config) => ({
    ...config,
    accessToken: redactSecrets ? maskSecret(config.accessToken) : config.accessToken,
    verifyToken: redactSecrets ? maskSecret(config.verifyToken) : config.verifyToken,
    webhookSecret: redactSecrets ? maskSecret(config.webhookSecret) : config.webhookSecret
  }));

  const sanitizedEmailConfigs = emailConfigs.map((config) => ({
    ...config,
    auth: {
      ...config.auth,
      pass: redactSecrets ? maskSecret(config.auth?.pass) : config.auth?.pass
    }
  }));

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    source: {
      databaseName: mongoose.connection.db?.databaseName,
      companyFilter: companyId || 'ALL'
    },
    counts: {
      companies: companies.length,
      users: users.length,
      departments: departments.length,
      userDepartmentMappings: userDepartmentMappings.length,
      roles: roles.length,
      whatsappTemplates: whatsappTemplates.length,
      emailTemplates: emailTemplates.length,
      whatsappConfigs: sanitizedWhatsAppConfigs.length,
      emailConfigs: sanitizedEmailConfigs.length,
      chatbotFlows: chatbotFlows.length
    },
    data: {
      companies,
      users,
      departments,
      userDepartmentMappings,
      roles,
      templates: {
        whatsapp: whatsappTemplates,
        email: emailTemplates
      },
      configurations: {
        whatsapp: sanitizedWhatsAppConfigs,
        email: sanitizedEmailConfigs
      },
      chatbotFlows
    }
  };

  const absoluteOutputPath = path.resolve(process.cwd(), outputPath);
  await fs.writeFile(absoluteOutputPath, JSON.stringify(exportPayload, null, 2), 'utf-8');

  console.log(`✅ Migration export completed: ${absoluteOutputPath}`);
  console.log(`Companies: ${companies.length}, Users: ${users.length}, Departments: ${departments.length}`);
};

run()
  .catch((error) => {
    console.error('❌ Failed to create migration export bundle:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
