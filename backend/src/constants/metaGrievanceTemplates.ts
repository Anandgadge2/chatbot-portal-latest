export const ADMIN_TEMPLATE_NAMES = [
  'grievance_received_admin_v2',
  'grievance_assigned_admin_v2',
  'grievance_reassigned_admin_v2',
  'grievance_reverted_company_v2',
  'grievance_reminder_admin_v2',
  'number_admin_v1_'
] as const;

export const CITIZEN_TEMPLATE_NAMES = [
  'grievance_status_inprogress_citizen_v2',
  'grievance_status_resolved_citizen_v2',
  'grievance_status_rejected_citizen_v2',
  'media_image_v1',
  'media_video_v1',
  'media_document_v1'
] as const;

export const META_GRIEVANCE_TEMPLATE_VARIABLE_COUNT: Record<string, number> = {
  grievance_received_admin_v2: 7,
  grievance_assigned_admin_v2: 9,
  grievance_reassigned_admin_v2: 12,
  grievance_reverted_company_v2: 9,
  grievance_reminder_admin_v2: 8,
  number_admin_v1_: 1,
  grievance_status_inprogress_citizen_v2: 8,
  grievance_status_resolved_citizen_v2: 8,
  grievance_status_rejected_citizen_v2: 8,
  media_image_v1: 1,
  media_video_v1: 1,
  media_document_v1: 1
};

export const DEFAULT_TEMPLATE_LANGUAGE = 'en';
export const META_GRIEVANCE_CMD_START = 'cmd_start';
export const META_GRIEVANCE_CMD_STOP = 'cmd_stop';
export const META_GRIEVANCE_CMD_RESTART = 'cmd_restart';
export const META_GRIEVANCE_CMD_MENU = 'cmd_menu';
export const META_GRIEVANCE_CMD_BACK = 'cmd_back';
export const META_GRIEVANCE_CMD_HELP = 'cmd_help';

export const META_GRIEVANCE_CMD_RESPONSES: Record<string, string> = {
  [META_GRIEVANCE_CMD_STOP]: "ðŸ›‘ Conversation ended. Thank you for using our service. You can type 'hi' at any time to start again.",
  [META_GRIEVANCE_CMD_RESTART]: "ðŸ”„ Restarting the conversation... please wait.",
  [META_GRIEVANCE_CMD_MENU]: "ðŸ  Returning to the main menu.",
  [META_GRIEVANCE_CMD_BACK]: "ðŸ”™ Going back to the previous step."
};
