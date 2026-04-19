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
      { key: 'admin_name', aliases: ['admin_name', 'adminName', 'recipient_name'], maxLength: 60 },
      { key: 'grievance_id', aliases: ['grievance_id', 'grievanceId', 'reference_id'], maxLength: 30 },
      { key: 'citizen_name', aliases: ['citizen_name', 'citizenName'], maxLength: 60 },
      { key: 'department_name', aliases: ['department_name', 'departmentName', 'category'], maxLength: 60 },
      { key: 'office_name', aliases: ['office_name', 'officeName', 'sub_department_name', 'subDepartmentName'], maxLength: 60 },
      { key: 'description', aliases: ['description', 'grievance_details', 'grievanceDetails'], maxLength: 100 },
      { key: 'received_on', aliases: ['received_on', 'receivedOn', 'submitted_on', 'submittedOn', 'date'], maxLength: 30 }
    ]
  },
  grievance_pending_admin_v1: {
    audience: 'ADMIN',
    body: [
      { key: 'admin_name', aliases: ['admin_name', 'adminName', 'recipient_name'], maxLength: 60 },
      { key: 'grievance_id', aliases: ['grievance_id', 'grievanceId', 'reference_id'], maxLength: 30 },
      { key: 'citizen_name', aliases: ['citizen_name', 'citizenName'], maxLength: 60 },
      { key: 'department_name', aliases: ['department_name', 'departmentName', 'category'], maxLength: 60 },
      { key: 'office_name', aliases: ['office_name', 'officeName', 'sub_department_name', 'subDepartmentName'], maxLength: 60 },
      { key: 'description', aliases: ['description', 'grievance_details', 'grievanceDetails'], maxLength: 100 },
      { key: 'submitted_on', aliases: ['submitted_on', 'submittedOn', 'received_on', 'receivedOn', 'date'], maxLength: 30 }
    ]
  },
  grievance_assigned_admin_v1: {
    audience: 'ADMIN',
    body: [
      { key: 'admin_name', aliases: ['admin_name', 'adminName', 'recipient_name'], maxLength: 60 },
      { key: 'grievance_id', aliases: ['grievance_id', 'grievanceId', 'reference_id'], maxLength: 30 },
      { key: 'citizen_name', aliases: ['citizen_name', 'citizenName'], maxLength: 60 },
      { key: 'department_name', aliases: ['department_name', 'departmentName', 'category'], maxLength: 60 },
      { key: 'office_name', aliases: ['office_name', 'officeName', 'sub_department_name', 'subDepartmentName'], maxLength: 60 },
      { key: 'description', aliases: ['description', 'grievance_details', 'grievanceDetails'], maxLength: 100 },
      { key: 'assigned_by', aliases: ['assigned_by', 'assignedBy', 'reassigned_by', 'reassignedBy'], maxLength: 60 },
      { key: 'assigned_on', aliases: ['assigned_on', 'assignedOn', 'date'], maxLength: 30 },
      { key: 'remarks', aliases: ['remarks', 'note', 'assignment_note', 'revert_note'], maxLength: 100 }
    ]
  },
  grievance_reassigned_admin_v1: {
    audience: 'ADMIN',
    body: [
      { key: 'admin_name', aliases: ['admin_name', 'adminName', 'recipient_name'], maxLength: 60 },
      { key: 'grievance_id', aliases: ['grievance_id', 'grievanceId', 'reference_id'], maxLength: 30 },
      { key: 'citizen_name', aliases: ['citizen_name', 'citizenName'], maxLength: 60 },
      { key: 'department_name', aliases: ['department_name', 'departmentName', 'category'], maxLength: 60 },
      { key: 'office_name', aliases: ['office_name', 'officeName', 'sub_department_name', 'subDepartmentName'], maxLength: 60 },
      { key: 'description', aliases: ['description', 'grievance_details', 'grievanceDetails'], maxLength: 100 },
      { key: 'submitted_on', aliases: ['submitted_on', 'submittedOn', 'date'], maxLength: 30 },
      { key: 'reassigned_by', aliases: ['reassigned_by', 'reassignedBy', 'assigned_by', 'assignedBy'], maxLength: 60 },
      { key: 'remarks', aliases: ['remarks', 'note', 'assignment_note', 'reassignment_note', 'revert_note'], maxLength: 100 },
      { key: 'reassigned_on', aliases: ['reassigned_on', 'reassignedOn', 'assigned_on', 'assignedOn'], maxLength: 30 },
      { key: 'original_department', aliases: ['original_department', 'originalDepartment'], maxLength: 60 },
      { key: 'original_office', aliases: ['original_office', 'originalOffice'], maxLength: 60 }
    ]
  },
  grievance_reverted_company_v1: {
    audience: 'ADMIN',
    body: [
      { key: 'admin_name', aliases: ['admin_name', 'adminName', 'recipient_name'], maxLength: 60 },
      { key: 'grievance_id', aliases: ['grievance_id', 'grievanceId', 'reference_id'], maxLength: 30 },
      { key: 'citizen_name', aliases: ['citizen_name', 'citizenName'], maxLength: 60 },
      { key: 'department_name', aliases: ['department_name', 'departmentName', 'category'], maxLength: 60 },
      { key: 'office_name', aliases: ['office_name', 'officeName', 'sub_department_name', 'subDepartmentName'], maxLength: 60 },
      { key: 'reverted_by', aliases: ['reverted_by', 'revertedBy'], maxLength: 60 },
      { key: 'remarks', aliases: ['remarks', 'note', 'revert_reason', 'revert_note'], maxLength: 100 },
      { key: 'reverted_on', aliases: ['reverted_on', 'revertedOn', 'date'], maxLength: 30 }
    ]
  },
  grievance_submitted_citizen_v1: {
    audience: 'CITIZEN',
    body: [
      { key: 'citizen_name', aliases: ['citizen_name', 'citizenName'], maxLength: 60 },
      { key: 'grievance_id', aliases: ['grievance_id', 'grievanceId', 'reference_id'], maxLength: 30 },
      { key: 'department_name', aliases: ['department_name', 'departmentName'], maxLength: 60 },
      { key: 'office_name', aliases: ['office_name', 'officeName', 'sub_department_name', 'subDepartmentName'], maxLength: 60 },
      { key: 'description', aliases: ['description', 'grievance_details', 'grievanceDetails'], maxLength: 100 },
      { key: 'submitted_on', aliases: ['submitted_on', 'submittedOn', 'date'], maxLength: 30 }
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
