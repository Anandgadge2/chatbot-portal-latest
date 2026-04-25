export const ADMIN_TEMPLATE_NAMES = [
  'grievance_received_admin_v1',
  'grievance_pending_admin_v1',
  'grievance_assigned_admin_v1',
  'grievance_reassigned_admin_v1',
  'grievance_reverted_company_v1',
  'grievance_reminder_admin_v1',
  'admin_password_reset_otp'
] as const;

export const CITIZEN_TEMPLATE_NAMES = [
  'grievance_status_citizen_v1',
  'media_image_v1',
  'media_video_v1',
  'media_document_v1'
] as const;

export const META_GRIEVANCE_TEMPLATE_VARIABLE_COUNT: Record<string, number> = {
  grievance_received_admin_v1: 7,
  grievance_pending_admin_v1: 7,
  grievance_assigned_admin_v1: 9,
  grievance_reassigned_admin_v1: 12,
  grievance_reverted_company_v1: 8,
  grievance_reminder_admin_v1: 10,
  admin_password_reset_otp: 1,
  grievance_status_citizen_v1: 7,
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
