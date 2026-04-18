import { sanitizeText } from '../../utils/sanitize';
import { TemplateAudience } from './template.service';

type TemplateInputData = Record<string, string | number | null | undefined>;

type ParameterSpec = {
  key: string;
  aliases: string[];
  maxLength?: number;
};

type TemplateDefinition = {
  audience: TemplateAudience;
  body: ParameterSpec[];
};

export interface BuiltTemplatePayload {
  audience: TemplateAudience;
  components: any[];
  expectedKeys: string[];
  consumedKeys: string[];
}

const TEMPLATE_DEFINITIONS: Record<string, TemplateDefinition> = {
  grievance_received_admin_v1: {
    audience: 'ADMIN',
    body: [
      { key: 'grievance_id', aliases: ['grievance_id', 'grievanceId', 'reference_id'], maxLength: 30 },
      { key: 'citizen_name', aliases: ['citizen_name', 'citizenName'], maxLength: 60 },
      { key: 'citizen_phone', aliases: ['citizen_phone', 'citizenPhone'], maxLength: 20 },
      { key: 'department_name', aliases: ['department_name', 'departmentName', 'category'], maxLength: 60 },
      { key: 'description', aliases: ['description', 'grievance_details', 'grievanceDetails'], maxLength: 100 }
    ]
  },
  grievance_pending_admin_v1: {
    audience: 'ADMIN',
    body: [
      { key: 'grievance_id', aliases: ['grievance_id', 'grievanceId', 'reference_id'], maxLength: 30 },
      { key: 'citizen_name', aliases: ['citizen_name', 'citizenName'], maxLength: 60 },
      { key: 'citizen_phone', aliases: ['citizen_phone', 'citizenPhone'], maxLength: 20 },
      { key: 'department_name', aliases: ['department_name', 'departmentName', 'category'], maxLength: 60 },
      { key: 'description', aliases: ['description', 'grievance_details', 'grievanceDetails'], maxLength: 100 }
    ]
  },
  grievance_assigned_admin_v1: {
    audience: 'ADMIN',
    body: [
      { key: 'grievance_id', aliases: ['grievance_id', 'grievanceId', 'reference_id'], maxLength: 30 },
      { key: 'citizen_name', aliases: ['citizen_name', 'citizenName'], maxLength: 60 },
      { key: 'citizen_phone', aliases: ['citizen_phone', 'citizenPhone'], maxLength: 20 },
      { key: 'department_name', aliases: ['department_name', 'departmentName', 'category'], maxLength: 60 },
      { key: 'description', aliases: ['description', 'grievance_details', 'grievanceDetails'], maxLength: 100 },
      { key: 'remarks', aliases: ['remarks', 'note', 'assignment_note', 'revert_note'], maxLength: 100 }
    ]
  },
  grievance_reassigned_admin_v1: {
    audience: 'ADMIN',
    body: [
      { key: 'grievance_id', aliases: ['grievance_id', 'grievanceId', 'reference_id'], maxLength: 30 },
      { key: 'citizen_name', aliases: ['citizen_name', 'citizenName'], maxLength: 60 },
      { key: 'citizen_phone', aliases: ['citizen_phone', 'citizenPhone'], maxLength: 20 },
      { key: 'department_name', aliases: ['department_name', 'departmentName', 'category'], maxLength: 60 },
      { key: 'description', aliases: ['description', 'grievance_details', 'grievanceDetails'], maxLength: 100 },
      { key: 'remarks', aliases: ['remarks', 'note', 'assignment_note', 'revert_note'], maxLength: 100 }
    ]
  },
  grievance_reverted_company_v1: {
    audience: 'ADMIN',
    body: [
      { key: 'grievance_id', aliases: ['grievance_id', 'grievanceId', 'reference_id'], maxLength: 30 },
      { key: 'citizen_name', aliases: ['citizen_name', 'citizenName'], maxLength: 60 },
      { key: 'citizen_phone', aliases: ['citizen_phone', 'citizenPhone'], maxLength: 20 },
      { key: 'department_name', aliases: ['department_name', 'departmentName', 'category'], maxLength: 60 },
      { key: 'description', aliases: ['description', 'grievance_details', 'grievanceDetails'], maxLength: 100 },
      { key: 'remarks', aliases: ['remarks', 'note', 'assignment_note', 'revert_note'], maxLength: 100 }
    ]
  },
  grievance_submitted_citizen_v1: {
    audience: 'CITIZEN',
    body: [
      { key: 'citizen_name', aliases: ['citizen_name', 'citizenName'], maxLength: 60 },
      { key: 'grievance_id', aliases: ['grievance_id', 'grievanceId', 'reference_id'], maxLength: 30 },
      { key: 'department_name', aliases: ['department_name', 'departmentName'], maxLength: 60 },
      { key: 'sub_department_name', aliases: ['sub_department_name', 'subDepartmentName'], maxLength: 60 },
      { key: 'description', aliases: ['description', 'grievance_details', 'grievanceDetails'], maxLength: 100 }
    ]
  },
  grievance_status_citizen_v1: {
    audience: 'CITIZEN',
    body: [
      { key: 'citizen_name', aliases: ['citizen_name', 'citizenName'], maxLength: 60 },
      { key: 'grievance_id', aliases: ['grievance_id', 'grievanceId', 'reference_id'], maxLength: 30 },
      { key: 'department_name', aliases: ['department_name', 'departmentName'], maxLength: 60 },
      { key: 'sub_department_name', aliases: ['sub_department_name', 'subDepartmentName'], maxLength: 60 },
      { key: 'status', aliases: ['status', 'newStatus'], maxLength: 30 },
      { key: 'remarks', aliases: ['remarks', 'message', 'extra_message', 'extraMessage'], maxLength: 100 }
    ]
  }
};

function resolveValue(data: TemplateInputData, spec: ParameterSpec): { value: string; alias: string } {
  for (const alias of spec.aliases) {
    const current = data[alias];
    if (current === undefined || current === null) continue;

    const normalized = sanitizeText(String(current), spec.maxLength || 100);
    if (normalized.trim()) {
      return { value: normalized, alias };
    }
  }

  const error: any = new Error(`Missing required template parameter: ${spec.key}`);
  error.code = 'TEMPLATE_INVALID';
  throw error;
}

export function buildTemplatePayload(templateName: string, data: TemplateInputData): BuiltTemplatePayload {
  const definition = TEMPLATE_DEFINITIONS[templateName];
  if (!definition) {
    const error: any = new Error(`Template ${templateName} is not supported by the payload builder.`);
    error.code = 'TEMPLATE_INVALID';
    throw error;
  }

  const consumedKeys = new Set<string>();
  const bodyParameters = definition.body.map((spec) => {
    const { value, alias } = resolveValue(data, spec);
    consumedKeys.add(alias);
    return { type: 'text', text: value };
  });

  const ignoredKeys = new Set(['header_text', 'headerText', 'button_url', 'buttonUrl']);
  const extraKeys = Object.keys(data).filter((key) => !consumedKeys.has(key) && !ignoredKeys.has(key));
  if (extraKeys.length > 0) {
    const error: any = new Error(`Unexpected template parameters for ${templateName}: ${extraKeys.join(', ')}`);
    error.code = 'TEMPLATE_INVALID';
    throw error;
  }

  const components: any[] = [];
  const headerValue = data.header_text ?? data.headerText;
  if (headerValue) {
    components.push({
      type: 'header',
      parameters: [{ type: 'text', text: sanitizeText(String(headerValue), 60) }]
    });
  }

  components.push({
    type: 'body',
    parameters: bodyParameters
  });

  const buttonValue = data.button_url ?? data.buttonUrl;
  if (buttonValue) {
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: sanitizeText(String(buttonValue), 255) }]
    });
  }

  return {
    audience: definition.audience,
    components,
    expectedKeys: definition.body.map((spec) => spec.key),
    consumedKeys: Array.from(consumedKeys)
  };
}
