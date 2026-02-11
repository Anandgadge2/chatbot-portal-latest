/**
 * WhatsApp Business API Limits (Cloud API)
 * These are non-negotiable platform constraints. Enforce in flow builder and at send time.
 *
 * References:
 * - Message & UI: Interactive buttons (max 3, 20 chars), Lists (max 10 rows/section, 1 section, 24/72 chars)
 * - 24-hour window: Free-form only within 24h of last user message; after that template required
 * - Media: Images 5MB, Video 16MB, Documents 100MB, Audio 16MB
 * - No native state: All flow state, progress, and branching must be in our backend.
 */

// ================================
// INTERACTIVE BUTTONS
// ================================
export const WHATSAPP_LIMITS_BUTTONS = {
  /** Max reply buttons per message (non-negotiable) */
  MAX_BUTTONS_PER_MESSAGE: 3,
  /** Button label max length (characters) */
  BUTTON_TITLE_MAX_LENGTH: 20,
  /** No icons/emojis as button icons, no custom colors - plain text only */
  BUTTON_PLAIN_TEXT_ONLY: true,
  /** Buttons expire once user sends a different message; chain steps instead of overloading one */
  BUTTONS_EXPIRE_ON_OTHER_MESSAGE: true
} as const;

// ================================
// LIST MESSAGES
// ================================
export const WHATSAPP_LIMITS_LIST = {
  /** Max rows per section (Cloud API: effectively 1 section per list) */
  MAX_ROWS_PER_SECTION: 10,
  /** Max sections per list (Cloud API now restricts to 1 in practice) */
  MAX_SECTIONS_PER_LIST: 1,
  /** Row title max length (characters) */
  ROW_TITLE_MAX_LENGTH: 24,
  /** Row description max length (characters) */
  ROW_DESCRIPTION_MAX_LENGTH: 72,
  /** Section title max length (characters) */
  SECTION_TITLE_MAX_LENGTH: 24
} as const;

// ================================
// CTA / URL BUTTONS
// ================================
export const WHATSAPP_LIMITS_CTA = {
  /** Only 1 URL button per message */
  MAX_URL_BUTTONS_PER_MESSAGE: 1,
  /** URL must be predefined in templates; no dynamic URL params at runtime (unless encoded earlier) */
  URL_PREDEFINED_ONLY: true
} as const;

// ================================
// TEMPLATE MESSAGES (Business-initiated)
// ================================
export const WHATSAPP_LIMITS_TEMPLATE = {
  /** Every outbound business-initiated message must use pre-approved template after 24h window */
  TEMPLATE_REQUIRED_AFTER_24H: true,
  /** No promotional/misleading content; variables must match example format */
  NO_DYNAMIC_BUTTON_LABELS: true,
  NO_DYNAMIC_BUTTON_COUNT: true
} as const;

// ================================
// SESSION & CONVERSATION WINDOW
// ================================
export const WHATSAPP_LIMITS_SESSION = {
  /** Free-form messages allowed only within 24 hours of last user message */
  CUSTOMER_SERVICE_WINDOW_HOURS: 24,
  /** After 24h, template message mandatory */
  TEMPLATE_REQUIRED_AFTER_WINDOW: true,
  /** Charged per conversation (Utility / Marketing / Auth / Service) */
  PRICING_PER_CONVERSATION: true
} as const;

// ================================
// MEDIA & FILES
// ================================
export const WHATSAPP_LIMITS_MEDIA = {
  /** Max size in bytes */
  IMAGE_MAX_BYTES: 5 * 1024 * 1024,
  VIDEO_MAX_BYTES: 16 * 1024 * 1024,
  DOCUMENT_MAX_BYTES: 100 * 1024 * 1024,
  AUDIO_MAX_BYTES: 16 * 1024 * 1024,
  IMAGE_MAX_MB: 5,
  VIDEO_MAX_MB: 16,
  DOCUMENT_MAX_MB: 100,
  AUDIO_MAX_MB: 16
} as const;

// ================================
// STATE (Backend responsibility)
// ================================
/** WhatsApp does NOT remember context. Flow state, user progress, form answers, branching = our backend only. */
export const WHATSAPP_NO_NATIVE_STATE = true;

// ================================
// SINGLE EXPORT OBJECT
// ================================
export const WHATSAPP_API_LIMITS = {
  BUTTONS: WHATSAPP_LIMITS_BUTTONS,
  LIST: WHATSAPP_LIMITS_LIST,
  CTA: WHATSAPP_LIMITS_CTA,
  TEMPLATE: WHATSAPP_LIMITS_TEMPLATE,
  SESSION: WHATSAPP_LIMITS_SESSION,
  MEDIA: WHATSAPP_LIMITS_MEDIA,
  NO_NATIVE_STATE: WHATSAPP_NO_NATIVE_STATE
} as const;

// ================================
// HELPERS
// ================================
export function truncateButtonTitle(text: string): string {
  if (!text || text.length <= WHATSAPP_LIMITS_BUTTONS.BUTTON_TITLE_MAX_LENGTH) return text;
  return text.slice(0, WHATSAPP_LIMITS_BUTTONS.BUTTON_TITLE_MAX_LENGTH - 3) + '...';
}

export function truncateListRowTitle(text: string): string {
  if (!text || text.length <= WHATSAPP_LIMITS_LIST.ROW_TITLE_MAX_LENGTH) return text;
  return text.slice(0, WHATSAPP_LIMITS_LIST.ROW_TITLE_MAX_LENGTH - 3) + '...';
}

export function truncateListRowDescription(text: string): string {
  if (!text || text.length <= WHATSAPP_LIMITS_LIST.ROW_DESCRIPTION_MAX_LENGTH) return text;
  return text.slice(0, WHATSAPP_LIMITS_LIST.ROW_DESCRIPTION_MAX_LENGTH - 3) + '...';
}

export function truncateListSectionTitle(text: string): string {
  if (!text || text.length <= WHATSAPP_LIMITS_LIST.SECTION_TITLE_MAX_LENGTH) return text;
  return text.slice(0, WHATSAPP_LIMITS_LIST.SECTION_TITLE_MAX_LENGTH - 3) + '...';
}
