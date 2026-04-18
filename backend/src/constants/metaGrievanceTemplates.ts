export const ADMIN_TEMPLATE_NAMES = [
  'grievance_received_admin_v1',
  'grievance_pending_admin_v1',
  'grievance_assigned_admin_v1',
  'grievance_reassigned_admin_v1',
  'grievance_reverted_company_v1'
] as const;

export const CITIZEN_TEMPLATE_NAMES = [
  'grievance_submitted_citizen_v1',
  'grievance_status_citizen_v1',
  'grievance_limit_exceeded',
  'consent_request_citizen',
  'consent_confirmed',
  'consent_pending_admin'
] as const;

export const META_GRIEVANCE_TEMPLATE_VARIABLE_COUNT: Record<string, number> = {
  grievance_received_admin_v1: 5,
  grievance_pending_admin_v1: 5,
  grievance_assigned_admin_v1: 6,
  grievance_reassigned_admin_v1: 6,
  grievance_reverted_company_v1: 6,
  grievance_submitted_citizen_v1: 5,
  grievance_status_citizen_v1: 6,
  grievance_limit_exceeded: 1,
  consent_request_citizen: 0,
  consent_confirmed: 0,
  consent_pending_admin: 0
};

export const DEFAULT_TEMPLATE_LANGUAGE = 'en_US';
