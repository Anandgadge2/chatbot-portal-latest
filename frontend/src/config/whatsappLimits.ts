/**
 * WhatsApp Business API Limits (Cloud API)
 * Enforced in flow builder UI and validated on save.
 * See backend config/whatsappLimits.ts for full documentation.
 */

export const WHATSAPP_LIMITS = {
  BUTTONS: {
    MAX_PER_MESSAGE: 3,
    TITLE_MAX_LENGTH: 20,
    NOTE: 'No icons/emojis as button icons. Buttons expire when user sends a different message—chain steps instead.',
  },
  LIST: {
    MAX_ROWS_PER_SECTION: 10,
    MAX_SECTIONS: 1,
    ROW_TITLE_MAX_LENGTH: 24,
    ROW_DESCRIPTION_MAX_LENGTH: 72,
    SECTION_TITLE_MAX_LENGTH: 24,
    NOTE: 'For 20+ options use "Departments (dynamic)" or pagination.',
  },
  SESSION: {
    WINDOW_HOURS: 24,
    NOTE: 'Free-form messages only within 24h of last user message. After that, template required.',
  },
  MEDIA: {
    IMAGE_MB: 5,
    VIDEO_MB: 16,
    DOCUMENT_MB: 100,
    AUDIO_MB: 16,
  },
} as const;
