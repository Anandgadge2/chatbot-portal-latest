export const ADMIN_TEMPLATE_NAMES = [
  'grievance_received_admin_v1',
  'grievance_pending_admin_v1',
  'grievance_assigned_admin_v1',
  'grievance_reassigned_admin_v1',
  'grievance_reverted_company_v1'
] as const;

export const CITIZEN_TEMPLATE_NAMES = [
  'grievance_submitted_citizen_v1',
  'grievance_status_citizen_v1'
] as const;

export const META_GRIEVANCE_TEMPLATE_VARIABLE_COUNT: Record<string, number> = {
  grievance_received_admin_v1: 7,
  grievance_pending_admin_v1: 7,
  grievance_assigned_admin_v1: 9,
  grievance_reassigned_admin_v1: 12,
  grievance_reverted_company_v1: 8,
  grievance_submitted_citizen_v1: 6,
  grievance_status_citizen_v1: 6
};

export const DEFAULT_TEMPLATE_LANGUAGE = 'en';
