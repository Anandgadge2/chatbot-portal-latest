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
      { key: 'admin_name', aliases: ['admin_name', 'adminName', 'recipient_name', 'recipientName', 'recepientName', 'recipient'], maxLength: 60 },
      { key: 'grievance_id', aliases: ['grievance_id', 'grievanceId', 'reference_id'], maxLength: 30 },
      { key: 'citizen_name', aliases: ['citizen_name', 'citizenName'], maxLength: 60 },
      { key: 'department_name', aliases: ['department_name', 'departmentName', 'category'], maxLength: 60 },
      { key: 'office_name', aliases: ['office_name', 'officeName', 'sub_department_name', 'subDepartmentName'], maxLength: 60 },
      { key: 'description', aliases: ['description', 'grievance_details', 'grievanceDetails'], maxLength: 300 },
      { key: 'received_on', aliases: ['received_on', 'receivedOn', 'submitted_on', 'submittedOn', 'formattedDate', 'formatted_date', 'date'], maxLength: 60 }
    ]
  },
  grievance_pending_admin_v1: {
    audience: 'ADMIN',
    body: [
      { key: 'admin_name', aliases: ['admin_name', 'adminName', 'recipient_name', 'recipientName', 'recepientName', 'recipient'], maxLength: 60 },
      { key: 'grievance_id', aliases: ['grievance_id', 'grievanceId', 'reference_id'], maxLength: 30 },
      { key: 'citizen_name', aliases: ['citizen_name', 'citizenName'], maxLength: 60 },
      { key: 'department_name', aliases: ['department_name', 'departmentName', 'category'], maxLength: 60 },
      { key: 'office_name', aliases: ['office_name', 'officeName', 'sub_department_name', 'subDepartmentName'], maxLength: 60 },
      { key: 'description', aliases: ['description', 'grievance_details', 'grievanceDetails'], maxLength: 300 },
      { key: 'submitted_on', aliases: ['submitted_on', 'submittedOn', 'submittedDate', 'received_on', 'receivedOn', 'formattedDate', 'formatted_date', 'date'], maxLength: 60 }
    ]
  },
  grievance_assigned_admin_v1: {
    audience: 'ADMIN',
    body: [
      { key: 'admin_name', aliases: ['admin_name', 'adminName', 'recipient_name', 'recipientName', 'recepientName', 'recipient'], maxLength: 60 },
      { key: 'grievance_id', aliases: ['grievance_id', 'grievanceId', 'reference_id'], maxLength: 30 },
      { key: 'citizen_name', aliases: ['citizen_name', 'citizenName'], maxLength: 60 },
      { key: 'department_name', aliases: ['department_name', 'departmentName', 'category'], maxLength: 60 },
      { key: 'office_name', aliases: ['office_name', 'officeName', 'sub_department_name', 'subDepartmentName'], maxLength: 60 },
      { key: 'description', aliases: ['description', 'grievance_details', 'grievanceDetails'], maxLength: 300 },
      { key: 'assigned_by', aliases: ['assigned_by', 'assignedBy', 'assignedByName', 'reassigned_by', 'reassignedBy', 'reassignedByName'], maxLength: 60 },
      { key: 'assigned_on', aliases: ['assigned_on', 'assignedOn', 'assignedDate', 'formattedDate', 'formatted_date', 'date'], maxLength: 60 },
      { key: 'remarks', aliases: ['remarks', 'note', 'assignment_note', 'assignmentNote', 'reassignment_note', 'reassignmentNote', 'revert_note'], maxLength: 100 }
    ]
  },
  grievance_reassigned_admin_v1: {
    audience: 'ADMIN',
    body: [
      { key: 'admin_name', aliases: ['admin_name', 'adminName', 'recipient_name', 'recipientName', 'recepientName', 'recipient'], maxLength: 60 },
      { key: 'grievance_id', aliases: ['grievance_id', 'grievanceId', 'reference_id'], maxLength: 30 },
      { key: 'citizen_name', aliases: ['citizen_name', 'citizenName'], maxLength: 60 },
      { key: 'department_name', aliases: ['department_name', 'departmentName', 'category'], maxLength: 60 },
      { key: 'office_name', aliases: ['office_name', 'officeName', 'sub_department_name', 'subDepartmentName'], maxLength: 60 },
      { key: 'description', aliases: ['description', 'grievance_details', 'grievanceDetails'], maxLength: 300 },
      { key: 'submitted_on', aliases: ['submitted_on', 'submittedOn', 'submittedDate', 'formattedDate', 'formatted_date', 'date'], maxLength: 60 },
      { key: 'reassigned_by', aliases: ['reassigned_by', 'reassignedBy', 'reassignedByName', 'assigned_by', 'assignedBy', 'assignedByName'], maxLength: 60 },
      { key: 'remarks', aliases: ['remarks', 'note', 'assignment_note', 'reassignment_note', 'reassignmentNote', 'revert_note'], maxLength: 100 },
      { key: 'reassigned_on', aliases: ['reassigned_on', 'reassignedOn', 'reassignedDate', 'assigned_on', 'assignedOn', 'assignedDate', 'formattedDate', 'formatted_date'], maxLength: 60 },
      { key: 'original_department', aliases: ['original_department', 'originalDepartment'], maxLength: 60 },
      { key: 'original_office', aliases: ['original_office', 'originalOffice'], maxLength: 60 }
    ]
  },
  grievance_reverted_company_v1: {
    audience: 'ADMIN',
    body: [
      { key: 'admin_name', aliases: ['admin_name', 'adminName', 'recipient_name', 'recipientName', 'recepientName', 'recipient'], maxLength: 60 },
      { key: 'grievance_id', aliases: ['grievance_id', 'grievanceId', 'reference_id'], maxLength: 30 },
      { key: 'citizen_name', aliases: ['citizen_name', 'citizenName'], maxLength: 60 },
      { key: 'department_name', aliases: ['department_name', 'departmentName', 'category'], maxLength: 60 },
      { key: 'office_name', aliases: ['office_name', 'officeName', 'sub_department_name', 'subDepartmentName'], maxLength: 60 },
      { key: 'reverted_by', aliases: ['reverted_by', 'revertedBy', 'revertedByName'], maxLength: 60 },
      { key: 'remarks', aliases: ['remarks', 'note', 'revert_reason', 'revert_note'], maxLength: 100 },
      { key: 'reverted_on', aliases: ['reverted_on', 'revertedOn', 'revertedDate', 'formattedDate', 'formatted_date', 'date'], maxLength: 60 }
    ]
  },
  admin_password_reset_otp: {
    audience: 'ADMIN',
    body: [
      { key: 'otp', aliases: ['otp', 'code', 'verification_code', 'verificationCode'], maxLength: 20 }
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
