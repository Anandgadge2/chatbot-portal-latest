import WhatsAppTemplate from '../../models/WhatsAppTemplate';
import { ADMIN_TEMPLATE_NAMES, CITIZEN_TEMPLATE_NAMES } from '../../constants/metaGrievanceTemplates';

export type TemplateAudience = 'ADMIN' | 'CITIZEN';

export interface ResolvedWhatsAppTemplate {
  template: any;
  resolvedLanguage: string;
  audience: TemplateAudience;
  supportedLanguages: string[];
}

function comparableLanguage(value?: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');
}

function baseLanguage(value?: string): string {
  const normalized = comparableLanguage(value);
  if (!normalized) return '';
  if (normalized === 'od') return 'or';
  return normalized.split('-')[0];
}

function uniqueLanguages(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = String(value || '').trim();
    if (!normalized) continue;
    const comparable = comparableLanguage(normalized);
    if (seen.has(comparable)) continue;
    seen.add(comparable);
    result.push(normalized);
  }

  return result;
}

function matchesExact(candidate: string, requested?: string): boolean {
  return !!requested && comparableLanguage(candidate) === comparableLanguage(requested);
}

function matchesEnglish(candidate: string): boolean {
  return baseLanguage(candidate) === 'en';
}

function isExplicitUsEnglish(value?: string): boolean {
  return comparableLanguage(value) === 'en-us';
}

function findUsEnglishTemplate(templates: any[]): any | undefined {
  return templates.find((template: any) => comparableLanguage(template.language) === 'en-us');
}

function findPlainEnglishTemplate(templates: any[]): any | undefined {
  return templates.find((template: any) => comparableLanguage(template.language) === 'en');
}

export function resolveTemplateAudience(templateName: string): TemplateAudience {
  if ((ADMIN_TEMPLATE_NAMES as readonly string[]).includes(templateName)) return 'ADMIN';
  if ((CITIZEN_TEMPLATE_NAMES as readonly string[]).includes(templateName)) return 'CITIZEN';

  const error: any = new Error(`Template ${templateName} is not whitelisted for grievance messaging.`);
  error.code = 'TEMPLATE_INVALID';
  throw error;
}

export async function resolveTemplateRecord(options: {
  companyId: any;
  templateName: string;
  requestedLanguage?: string;
  companyDefaultLanguage?: string;
}): Promise<ResolvedWhatsAppTemplate> {
  const templates = await WhatsAppTemplate.find({
    companyId: options.companyId,
    name: options.templateName,
    status: 'APPROVED'
  }).lean();

  if (!templates.length) {
    const isStandardMediaTemplate = ['media_image_v1', 'media_video_v1', 'media_document_v1'].includes(options.templateName);
    if (isStandardMediaTemplate) {
      return {
        template: { name: options.templateName, language: options.requestedLanguage || 'en_US' },
        resolvedLanguage: options.requestedLanguage || 'en_US',
        audience: 'CITIZEN',
        supportedLanguages: ['en_US']
      };
    }
    const error: any = new Error(`Template ${options.templateName} is not approved/active (or status is not yet synced) for this company.`);
    error.code = 'TEMPLATE_INVALID';
    throw error;
  }

  const supportedLanguages = uniqueLanguages(templates.map((template: any) => template.language));
  const requestedLanguage = String(options.requestedLanguage || '').trim();
  const companyDefaultLanguage = String(options.companyDefaultLanguage || '').trim();

  const exactRequested = templates.find((template: any) => matchesExact(template.language, requestedLanguage));
  if (exactRequested) {
    return {
      template: exactRequested,
      resolvedLanguage: exactRequested.language,
      audience: resolveTemplateAudience(options.templateName),
      supportedLanguages
    };
  }

  const exactCompanyDefault = templates.find((template: any) => matchesExact(template.language, companyDefaultLanguage));
  if (exactCompanyDefault) {
    return {
      template: exactCompanyDefault,
      resolvedLanguage: exactCompanyDefault.language,
      audience: resolveTemplateAudience(options.templateName),
      supportedLanguages
    };
  }

  const usEnglishTemplate = findUsEnglishTemplate(templates);
  const plainEnglishTemplate = findPlainEnglishTemplate(templates);
  const englishTemplate = usEnglishTemplate
    || plainEnglishTemplate
    || templates.find((template: any) => matchesEnglish(template.language));

  if (englishTemplate) {
    return {
      template: englishTemplate,
      resolvedLanguage: englishTemplate.language,
      audience: resolveTemplateAudience(options.templateName),
      supportedLanguages
    };
  }

  if (isExplicitUsEnglish(requestedLanguage) || isExplicitUsEnglish(companyDefaultLanguage)) {
    if (usEnglishTemplate) {
      return {
        template: usEnglishTemplate,
        resolvedLanguage: usEnglishTemplate.language,
        audience: resolveTemplateAudience(options.templateName),
        supportedLanguages
      };
    }
  }

  const error: any = new Error(
    `Template ${options.templateName} has no approved language match for requested=${requestedLanguage || 'n/a'} ` +
    `default=${companyDefaultLanguage || 'n/a'}. Supported: ${supportedLanguages.join(', ')}`
  );
  error.code = 'TEMPLATE_INVALID';
  throw error;
}
