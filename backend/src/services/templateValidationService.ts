import { sanitizeText } from '../utils/sanitize';
import { DEFAULT_TEMPLATE_LANGUAGE, META_GRIEVANCE_TEMPLATE_VARIABLE_COUNT } from '../constants/metaGrievanceTemplates';
import { resolveTemplateAudience, resolveTemplateRecord } from './whatsapp/template.service';

export function normalizeLanguage(language?: string): string {
  const value = String(language || DEFAULT_TEMPLATE_LANGUAGE).trim().toLowerCase().replace('-', '_');
  const map: Record<string, string> = {
    en: 'en_US',
    en_us: 'en_US',
    hi: 'hi_IN',
    hi_in: 'hi_IN',
    od: 'or',
    or: 'or',
    or_in: 'or_IN'
  };
  return map[value] || String(language || DEFAULT_TEMPLATE_LANGUAGE).trim();
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
  const resolved = await resolveTemplateRecord({
    companyId: options.companyId,
    templateName: options.templateName,
    requestedLanguage: options.language
  });
  const template = resolved.template;

  const audience = resolveTemplateAudience(options.templateName);
  const requiresUnsubscribeInstruction = /(consent|opt[_\s-]?in|subscription)/i.test(options.templateName);
  if (audience === 'CITIZEN' && requiresUnsubscribeInstruction) {
    const footer = String((template as any).footer || '').toLowerCase();
    const body = String((template as any).body?.text || '').toLowerCase();
    if (!footer.includes('stop') && !body.includes('stop')) {
      const error: any = new Error(`Template ${options.templateName} must include unsubscribe instruction (Reply STOP to unsubscribe).`);
      error.code = 'TEMPLATE_INVALID';
      throw error;
    }
  }
  return template;
}
