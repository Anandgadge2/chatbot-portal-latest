import WhatsAppTemplate from '../models/WhatsAppTemplate';
import { sanitizeText } from '../utils/sanitize';
import { DEFAULT_TEMPLATE_LANGUAGE, META_GRIEVANCE_TEMPLATE_VARIABLE_COUNT } from '../constants/metaGrievanceTemplates';

export function normalizeLanguage(language?: string): string {
  const value = (language || DEFAULT_TEMPLATE_LANGUAGE).toLowerCase().replace('-', '_');
  const map: Record<string, string> = {
    en: 'en_US',
    en_us: 'en_US',
    hi: 'hi_IN',
    hi_in: 'hi_IN',
    od: 'or_IN',
    or: 'or_IN',
    or_in: 'or_IN'
  };
  return map[value] || language || DEFAULT_TEMPLATE_LANGUAGE;
}

export function sanitizeTemplateVariables(values: string[] = []): string[] {
  return values.map((value) => sanitizeText(value || '', 100));
}

export function validateTemplateVariables(templateName: string, values: string[] = []): void {
  const expected = META_GRIEVANCE_TEMPLATE_VARIABLE_COUNT[templateName];
  if (typeof expected !== 'number') {
    const error: any = new Error(`Template ${templateName} is not whitelisted for grievance messaging.`);
    error.code = 'TEMPLATE_INVALID';
    throw error;
  }

  if (values.length < expected) {
    const error: any = new Error(`Template ${templateName} requires ${expected} variables but received ${values.length}.`);
    error.code = 'TEMPLATE_INVALID';
    throw error;
  }

  if (values.slice(0, expected).some((value) => !String(value || '').trim())) {
    const error: any = new Error(`Template ${templateName} has empty required variables.`);
    error.code = 'TEMPLATE_INVALID';
    throw error;
  }
}

export async function assertTemplateApproved(options: {
  companyId: any;
  templateName: string;
  language: string;
}) {
  const normalizedLanguage = normalizeLanguage(options.language);
  const candidateLanguages = [normalizedLanguage, normalizedLanguage.toLowerCase(), normalizedLanguage.replace('_', '-')];

  const template = await WhatsAppTemplate.findOne({
    companyId: options.companyId,
    name: options.templateName,
    language: { $in: candidateLanguages },
    status: 'APPROVED',
    isActive: true
  }).lean();

  if (!template) {
    const error: any = new Error(`Template ${options.templateName} is not approved/active for ${normalizedLanguage}.`);
    error.code = 'TEMPLATE_INVALID';
    throw error;
  }

  return template;
}
