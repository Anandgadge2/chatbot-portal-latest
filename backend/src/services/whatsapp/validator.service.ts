import { normalizePhoneNumber } from '../../utils/phoneUtils';
import { TemplateAudience, resolveTemplateAudience } from './template.service';

export function validateTemplate(options: {
  templateName: string;
  language: string;
  template: any;
  recipientType: TemplateAudience;
  to: string;
  citizenPhone?: string;
  components: any[];
}): void {
  if (!options.template) {
    const error: any = new Error(`Template ${options.templateName} was not resolved.`);
    error.code = 'TEMPLATE_INVALID';
    throw error;
  }

  const expectedAudience = resolveTemplateAudience(options.templateName);
  if (expectedAudience !== options.recipientType) {
    const error: any = new Error(
      `Template ${options.templateName} is for ${expectedAudience} recipients, not ${options.recipientType}.`
    );
    error.code = 'TEMPLATE_ROUTE_INVALID';
    throw error;
  }

  if (
    options.recipientType === 'ADMIN' &&
    options.citizenPhone &&
    normalizePhoneNumber(options.citizenPhone) === normalizePhoneNumber(options.to)
  ) {
    const error: any = new Error(`Admin template ${options.templateName} cannot be sent to the citizen number.`);
    error.code = 'TEMPLATE_ROUTE_INVALID';
    throw error;
  }

  const expectedVariableCount = Number(options.template?.body?.variables || 0);
  const bodyComponent = options.components.find((component: any) => component.type === 'body');
  const bodyParameters = Array.isArray(bodyComponent?.parameters) ? bodyComponent.parameters : [];

  if (expectedVariableCount > 0 && bodyParameters.length !== expectedVariableCount) {
    const error: any = new Error(
      `Template ${options.templateName} requires ${expectedVariableCount} body variables but got ${bodyParameters.length}.`
    );
    error.code = 'TEMPLATE_INVALID';
    throw error;
  }

  if (expectedVariableCount > 0 && bodyParameters.some((parameter: any) => !String(parameter?.text || '').trim())) {
    const error: any = new Error(`Template ${options.templateName} has empty body parameters.`);
    error.code = 'TEMPLATE_INVALID';
    throw error;
  }

  if (!String(options.language || '').trim()) {
    const error: any = new Error(`Template ${options.templateName} resolved with an empty language code.`);
    error.code = 'TEMPLATE_INVALID';
    throw error;
  }
}
