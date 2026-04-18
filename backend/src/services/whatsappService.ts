import axios from 'axios';
import {
  WHATSAPP_LIMITS_BUTTONS,
  WHATSAPP_LIMITS_LIST
} from '../config/whatsappLimits';
import { createAuditLog } from '../utils/auditLogger';
import { AuditAction } from '../config/constants';
import { normalizePhoneNumber } from '../utils/phoneUtils';
import { getRedisClient, isRedisConnected } from '../config/redis';
import WhatsAppSession from '../models/WhatsAppSession';
import CitizenProfile from '../models/CitizenProfile';
import { assertTemplateApproved, normalizeLanguage, sanitizeTemplateVariables, validateTemplateVariables } from './templateValidationService';
import { buildTemplatePayload } from './whatsapp/payload.builder';
import { resolveTemplateAudience, resolveTemplateRecord, TemplateAudience } from './whatsapp/template.service';
import { validateTemplate } from './whatsapp/validator.service';
import { isWithin24Hours, parseWhatsAppApiError, sendTemplateRequest } from './whatsapp/whatsapp.service';

/**
 * WhatsApp Business API limits are enforced here and in flow builder.
 * See config/whatsappLimits.ts for full documentation.
 */

function getWhatsAppConfig(company: any) {
  // Check if config is attached to company object (from chatbotEngine)
  // Source of truth: CompanyWhatsAppConfig attached to company (DB). No env fallback.
  const phoneNumberId = company?.whatsappConfig?.phoneNumberId;
  const accessToken = company?.whatsappConfig?.accessToken;

  if (!phoneNumberId || !accessToken) {
    throw new Error(`WhatsApp not configured for company: ${company?.name || 'System'}`);
  }

  return {
    url: `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  };
}

const DEFAULT_RATE_LIMITS = {
  messagesPerMinute: 30,
  messagesPerHour: 500,
  messagesPerDay: 5000
};
const USER_INITIATED_WINDOW_MS = 24 * 60 * 60 * 1000;
const RECIPIENT_LIMIT_PER_MINUTE = 10;
const rateFallbackStore = new Map<string, { count: number; expiresAt: number }>();
const FALLBACK_CLEANUP_INTERVAL = 250;
let fallbackWritesSinceCleanup = 0;

function cleanupExpiredFallbackCounters(now: number): void {
  for (const [key, value] of rateFallbackStore.entries()) {
    if (value.expiresAt <= now) {
      rateFallbackStore.delete(key);
    }
  }
}

function getRateLimitConfig(company: any) {
  return {
    messagesPerMinute: Math.max(
      1,
      Number(company?.whatsappConfig?.rateLimits?.messagesPerMinute) || DEFAULT_RATE_LIMITS.messagesPerMinute
    ),
    messagesPerHour: Math.max(
      1,
      Number(company?.whatsappConfig?.rateLimits?.messagesPerHour) || DEFAULT_RATE_LIMITS.messagesPerHour
    ),
    messagesPerDay: Math.max(
      1,
      Number(company?.whatsappConfig?.rateLimits?.messagesPerDay) || DEFAULT_RATE_LIMITS.messagesPerDay
    )
  };
}

function getWindowSuffix(date: Date, window: 'minute' | 'hour' | 'day'): string {
  const iso = date.toISOString();
  if (window === 'minute') return iso.slice(0, 16);
  if (window === 'hour') return iso.slice(0, 13);
  return iso.slice(0, 10);
}

function getTtlSeconds(window: 'minute' | 'hour' | 'day'): number {
  if (window === 'minute') return 70;
  if (window === 'hour') return 3700;
  return 90000;
}

function incrementFallbackCounter(key: string, ttlSeconds: number): number {
  const now = Date.now();
  fallbackWritesSinceCleanup += 1;
  if (fallbackWritesSinceCleanup >= FALLBACK_CLEANUP_INTERVAL) {
    cleanupExpiredFallbackCounters(now);
    fallbackWritesSinceCleanup = 0;
  }
  const existing = rateFallbackStore.get(key);
  if (!existing || existing.expiresAt <= now) {
    rateFallbackStore.set(key, { count: 1, expiresAt: now + ttlSeconds * 1000 });
    return 1;
  }

  const nextCount = existing.count + 1;
  rateFallbackStore.set(key, { count: nextCount, expiresAt: existing.expiresAt });
  return nextCount;
}

async function incrementRateCounter(key: string, ttlSeconds: number): Promise<number> {
  const redis = getRedisClient();
  if (!redis || !isRedisConnected()) {
    return incrementFallbackCounter(key, ttlSeconds);
  }

  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, ttlSeconds);
  }
  return count;
}

async function enforceRateLimit(company: any, to: string): Promise<void> {
  const limits = getRateLimitConfig(company);
  const companyId = company?._id?.toString() || 'unknown_company';
  const normalizedTo = normalizePhoneNumber(to);
  const now = new Date();

  const windows = [
    { name: 'minute' as const, limit: limits.messagesPerMinute },
    { name: 'hour' as const, limit: limits.messagesPerHour },
    { name: 'day' as const, limit: limits.messagesPerDay }
  ];

  for (const window of windows) {
    const suffix = getWindowSuffix(now, window.name);
    const key = `wa_rate:${companyId}:${window.name}:${suffix}`;
    const count = await incrementRateCounter(key, getTtlSeconds(window.name));
    if (count > window.limit) {
      throw new Error(`Rate limit exceeded for ${window.name}. Try again later.`);
    }
  }

  const recipientKey = `wa_rate:recipient:${companyId}:${normalizedTo}:${getWindowSuffix(now, 'minute')}`;
  const recipientCount = await incrementRateCounter(recipientKey, getTtlSeconds('minute'));
  if (recipientCount > RECIPIENT_LIMIT_PER_MINUTE) {
    throw new Error('Recipient message rate limit exceeded. Try again later.');
  }
}

async function logOutgoingMessage(company: any, to: string, message: string, type: string, templateName?: string) {
  try {
    await createAuditLog({
      action: AuditAction.WHATSAPP_MSG,
      resource: 'OUTGOING',
      resourceId: to,
      companyId: company._id?.toString(),
      details: {
        to,
        message: message.substring(0, 1000), // Cap length
        type,
        templateName: templateName || null,
        description: `Bot replied to ${to} (${type}): ${message.substring(0, 50)}...`
      }
    });
  } catch (err) {
    console.error('Failed to log outgoing WhatsApp message to audit:', err);
  }
}

function safeText(text: string, limit = 4000): string {
  if (!text) return '';
  return text.length > limit ? text.substring(0, limit - 10) + '…' : text;
}

function buildComplianceFooter(): string {
  return [
    'This is an official government assistance chatbot.',
    'Type STOP to unsubscribe.'
  ].join('\n');
}

function applyComplianceFooter(message: string, includeFooter: boolean = false, limit = 4000): string {
  const base = safeText(message, limit);

  if (!includeFooter) {
    return base;
  }

  const footer = buildComplianceFooter();

  if (!base.trim()) {
    return safeText(footer, limit);
  }

  if (base.includes('Type STOP to unsubscribe') && base.includes('official government assistance chatbot')) {
    return base;
  }

  return safeText(`${base}\n\n${footer}`, limit);
}

async function getSessionComplianceContext(
  company: any,
  to: string
): Promise<{ optedOut: boolean; within24hWindow: boolean; consentGiven: boolean; isSubscribed: boolean }> {
  const companyId = company?._id;
  if (!companyId) {
    return { optedOut: false, within24hWindow: false, consentGiven: true, isSubscribed: true };
  }

  const normalizedTo = normalizePhoneNumber(to);
  const citizen = await CitizenProfile.findOne({
    companyId,
    phone_number: normalizedTo
  }).select('opt_out isSubscribed citizen_consent consentGiven lastUserInteractionAt').lean();

  if (citizen?.opt_out || citizen?.isSubscribed === false) {
    return { optedOut: true, within24hWindow: false, consentGiven: Boolean(citizen?.citizen_consent || citizen?.consentGiven), isSubscribed: false };
  }

  if (citizen?.lastUserInteractionAt) {
    const within24hWindow = (Date.now() - new Date(citizen.lastUserInteractionAt).getTime()) <= USER_INITIATED_WINDOW_MS;
    return {
      optedOut: false,
      within24hWindow,
      consentGiven: Boolean(citizen.citizen_consent || citizen.consentGiven),
      isSubscribed: Boolean(citizen?.isSubscribed ?? true)
    };
  }

  const session = await WhatsAppSession.findOne({
    phoneNumber: normalizedTo,
    companyId
  }).select('lastMessageAt sessionData').lean();

  if (!session) {
    return {
      optedOut: false,
      within24hWindow: false,
      consentGiven: Boolean(citizen?.citizen_consent || citizen?.consentGiven || true),
      isSubscribed: Boolean(citizen?.isSubscribed ?? true)
    };
  }

  const lastMessageAt = session.lastMessageAt ? new Date(session.lastMessageAt) : null;
  const within24hWindow = !!lastMessageAt && (Date.now() - lastMessageAt.getTime()) <= USER_INITIATED_WINDOW_MS;
  const optedOut = Boolean((session.sessionData as any)?.optedOut);

  return {
    optedOut,
    within24hWindow,
    consentGiven: Boolean(citizen?.citizen_consent || citizen?.consentGiven || true),
    isSubscribed: Boolean(citizen?.isSubscribed ?? true)
  };
}

async function enforceMessagingPolicy(
  company: any,
  to: string,
  messageType: 'template' | 'freeform',
  templateName?: string,
  options?: { requireConsent?: boolean; allowUnsubscribed?: boolean }
): Promise<void> {
  const compliance = await getSessionComplianceContext(company, to);
  const requireConsent = options?.requireConsent !== false;
  const optInTemplates = new Set<string>();
  const approvedOutsideWindowTemplates = new Set([
    'grievance_received_admin_v1',
    'grievance_pending_admin_v1',
    'grievance_assigned_admin_v1',
    'grievance_reassigned_admin_v1',
    'grievance_reverted_company_v1',
    'grievance_submitted_citizen_v1',
    'grievance_status_citizen_v1'
  ]);

  if ((!compliance.isSubscribed || compliance.optedOut) && !options?.allowUnsubscribed) {
    if (!(messageType === 'template' && templateName && optInTemplates.has(templateName))) {
      throw new Error('Recipient has unsubscribed (STOP). Message blocked.');
    }
  }

  // Consent is only required for proactive/outbound messages.
  // If the user is within the 24-hour window (they messaged us first), we can respond without consent.
  if (requireConsent && !compliance.consentGiven && !compliance.within24hWindow) {
    throw new Error('Recipient consent missing. Message blocked.');
  }

  if (messageType === 'freeform' && !compliance.within24hWindow) {
    throw new Error('Free-form message blocked outside 24-hour user-initiated window. Use an approved template.');
  }

  if (!compliance.within24hWindow && messageType === 'template' && templateName && !approvedOutsideWindowTemplates.has(templateName)) {
    throw new Error(`Template ${templateName} is not permitted outside the 24-hour window.`);
  }
}

function logMetaError(error: any, context: Record<string, any>) {
  const metaError = error?.response?.data?.error;

  console.error('❌ WhatsApp API Error', {
    ...context,
    metaCode: metaError?.code,
    metaMessage: metaError?.message,
    fbtraceId: metaError?.fbtrace_id
  });
}

/**
 * ============================================================
 * SEND TEXT MESSAGE
 * ============================================================
 */
export async function sendWhatsAppMessage(
  company: any,
  to: string,
  message: string,
  options?: { requireConsent?: boolean; allowUnsubscribed?: boolean; includeComplianceFooter?: boolean }
): Promise<any> {
  try {
    await enforceMessagingPolicy(company, to, 'freeform', undefined, options);
    await enforceRateLimit(company, to);
    const { url, headers } = getWhatsAppConfig(company);

    const normalizedTo = normalizePhoneNumber(to);
    const composedMessage = applyComplianceFooter(message, options?.includeComplianceFooter);
    const payload = {
      messaging_product: 'whatsapp',
      to: normalizedTo,
      type: 'text',
      text: {
        body: composedMessage
      }
    };

    const response = await axios.post(url, payload, { headers });

    console.log(`✅ [WhatsApp API] Text message sent to ${to} (${company.name})`);
    console.log(`   Message ID: ${response.data.messages?.[0]?.id || 'N/A'}`);
    
    // Log to audit for SuperAdmin terminal
    await logOutgoingMessage(company, to, composedMessage, 'text');
    
    return {
      success: true,
      messageId: response.data.messages?.[0]?.id
    };

  } catch (error: any) {
    const errorDetails = {
      action: 'send_text',
      to,
      company: company?.name,
      phoneNumberId: company?.whatsappConfig?.phoneNumberId
    };
    
    logMetaError(error, errorDetails);
    
    // CRITICAL: Log detailed error for debugging
    if (error.response) {
      console.error('❌ WhatsApp API Error Details:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: JSON.stringify(error.response.data, null, 2),
        errorCode: error.response.data?.error?.code,
        errorMessage: error.response.data?.error?.message,
        errorType: error.response.data?.error?.type,
        errorSubcode: error.response.data?.error?.error_subcode,
        fbtraceId: error.response.data?.error?.fbtrace_id,
        ...errorDetails
      });
      
      // Specifically log the payload that was sent
      console.error('📦 Payload sent that failed:', JSON.stringify(error.config?.data, null, 2));
      
      // Specific error code handling
      if (error.response.data?.error?.code === 190) {
        console.error('   ⚠️ Error 190: Invalid or expired access token');
      } else if (error.response.data?.error?.code === 100) {
        console.error('   ⚠️ Error 100: Invalid parameter (check phone number ID)');
      } else if (error.response.data?.error?.code === 131047) {
        console.error('   ⚠️ Error 131047: Message template required (24-hour window expired)');
      }
    } else {
      console.error('❌ WhatsApp Network Error:', {
        message: error.message,
        code: error.code,
        ...errorDetails
      });
    }

    return {
      success: false,
      error: error?.response?.data?.error?.message || error.message
    };
  }
}

/**
 * ============================================================
 * SEND TEMPLATE MESSAGE (24-HOUR SAFE)
 * ============================================================
 * Supports multi-component templates with variables in Header, Body, or Buttons.
 */
export async function sendWhatsAppTemplate(
  company: any,
  to: string,
  templateName: string,
  parameters: string[] | Record<string, string> = [],
  language: string = 'en',
  headerParam?: string,
  buttonParam?: string,
  options?: {
    requireConsent?: boolean;
    allowUnsubscribed?: boolean;
    recipientType?: TemplateAudience;
    citizenPhone?: string;
    fallbackText?: string;
    disableFreeformFallback?: boolean;
    includeComplianceFooter?: boolean;
  }
): Promise<any> {
  try {
    const companyId = company?._id;
    if (!companyId) {
      throw new Error('Company ID missing for template compliance validation.');
    }
    const normalizedTo = normalizePhoneNumber(to);
    const recipientType = options?.recipientType || resolveTemplateAudience(templateName);
    const compliance = await getSessionComplianceContext(company, normalizedTo);

    if (
      recipientType === 'CITIZEN' &&
      options?.fallbackText &&
      !options?.disableFreeformFallback &&
      compliance.within24hWindow &&
      isWithin24Hours(new Date())
    ) {
      return sendWhatsAppMessage(company, normalizedTo, options.fallbackText, {
        requireConsent: options.requireConsent,
        allowUnsubscribed: options.allowUnsubscribed,
        includeComplianceFooter: options.includeComplianceFooter
      });
    }

    const resolvedTemplate = await resolveTemplateRecord({
      companyId,
      templateName,
      requestedLanguage: normalizeLanguage(language),
      companyDefaultLanguage: company?.whatsappConfig?.chatbotSettings?.defaultLanguage
    });

    let components: any[] = [];
    if (Array.isArray(parameters)) {
      const sanitizedParams = sanitizeTemplateVariables(parameters);
      validateTemplateVariables(templateName, sanitizedParams);
      await assertTemplateApproved({
        companyId,
        templateName,
        language: resolvedTemplate.resolvedLanguage
      });

      if (headerParam) {
        components.push({
          type: 'header',
          parameters: [{ type: 'text', text: safeText(headerParam, 60) }]
        });
      }

      if (sanitizedParams.length > 0) {
        components.push({
          type: 'body',
          parameters: sanitizedParams.map((param) => ({
            type: 'text',
            text: safeText(param, 1000)
          }))
        });
      }

      if (buttonParam) {
        components.push({
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [{ type: 'text', text: safeText(buttonParam, 255) }]
        });
      }
    } else {
      components = buildTemplatePayload(templateName, parameters).components;
    }

    validateTemplate({
      templateName,
      language: resolvedTemplate.resolvedLanguage,
      template: resolvedTemplate.template,
      recipientType,
      to: normalizedTo,
      citizenPhone: options?.citizenPhone,
      components
    });

    await enforceMessagingPolicy(company, normalizedTo, 'template', templateName, options);
    await enforceRateLimit(company, normalizedTo);
    const { url, headers } = getWhatsAppConfig(company);

    const payload: any = {
      messaging_product: 'whatsapp',
      to: normalizedTo,
      type: 'template',
      template: {
        name: templateName,
        language: { code: resolvedTemplate.resolvedLanguage },
        components: components.length > 0 ? components : undefined
      }
    };

    const response = await sendTemplateRequest({
      url,
      headers,
      payload,
      retryCount: 1,
      logContext: {
        action: 'send_template',
        templateName,
        language: resolvedTemplate.resolvedLanguage,
        to: normalizedTo,
        company: company?.name
      }
    });

    console.log('✅ WhatsApp template sent', {
      action: 'send_template',
      templateName,
      language: resolvedTemplate.resolvedLanguage,
      to: normalizedTo,
      company: company?.name,
      payload,
      status: 'SUCCESS',
      error: null
    });
    await logOutgoingMessage(company, to, `Template: ${templateName}`, 'template', templateName);

    return {
      success: true,
      messageId: response.data.messages?.[0]?.id
    };

  } catch (error: any) {
    const parsed = parseWhatsAppApiError(error);
    console.error('❌ WhatsApp template failed', {
      action: 'send_template',
      templateName,
      language,
      to: normalizePhoneNumber(to),
      company: company?.name,
      payload: error?.config?.data || null,
      status: 'FAILED',
      error: {
        statusCode: parsed.status || null,
        metaCode: parsed.code || null,
        metaMessage: parsed.message,
        fbtraceId: parsed.fbtraceId || null
      }
    });

    return {
      success: false,
      error: parsed.message
    };
  }
}

/**
 * ============================================================
 * SEND BUTTON MESSAGE (MAX 3 BUTTONS)
 * ============================================================
 */
export async function sendWhatsAppButtons(
  company: any,
  to: string,
  message: string,
  buttons: Array<{ id: string; title: string }>,
  options?: { includeComplianceFooter?: boolean }
): Promise<any> {
  try {
    await enforceMessagingPolicy(company, to, 'freeform');
    await enforceRateLimit(company, to);
    const { url, headers } = getWhatsAppConfig(company);

    const composedMessage = applyComplianceFooter(message, options?.includeComplianceFooter);
    const normalizedTo = normalizePhoneNumber(to);
    const payload = {
      messaging_product: 'whatsapp',
      to: normalizedTo,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: safeText(composedMessage)
        },
        action: {
          buttons: buttons
            .slice(0, WHATSAPP_LIMITS_BUTTONS.MAX_BUTTONS_PER_MESSAGE)
            .map(btn => ({
              type: 'reply',
              reply: {
                id: btn.id,
                title: (btn.title || '').slice(0, WHATSAPP_LIMITS_BUTTONS.BUTTON_TITLE_MAX_LENGTH)
              }
            }))
        }
      }
    };

    const response = await axios.post(url, payload, { headers });

    console.log(`✅ [WhatsApp API] Buttons sent to ${to} (${company.name})`);

    // Log to audit for SuperAdmin terminal
    await logOutgoingMessage(company, to, composedMessage, 'buttons');

    return {
      success: true,
      messageId: response.data.messages?.[0]?.id
    };

  } catch (error: any) {
    logMetaError(error, {
      action: 'send_buttons',
      to,
      company: company?.name
    });

    // Fallback to plain text
    const fallbackText =
      applyComplianceFooter(message, options?.includeComplianceFooter) +
      '\n\n' +
      buttons.map((b, i) => `${i + 1}. ${b.title}`).join('\n');

    return sendWhatsAppMessage(company, to, fallbackText);
  }
}

/**
 * ============================================================
 * SEND CTA URL BUTTON (1 ACTION BUTTON)
 * ============================================================
 */
export async function sendWhatsAppCTA(
  company: any,
  to: string,
  message: string,
  buttonTitle: string,
  url: string,
  headerText?: string,
  footerText?: string,
  options?: { includeComplianceFooter?: boolean }
): Promise<any> {
  try {
    await enforceMessagingPolicy(company, to, 'freeform');
    await enforceRateLimit(company, to);
    const { url: apiURL, headers } = getWhatsAppConfig(company);

    const composedMessage = applyComplianceFooter(message, options?.includeComplianceFooter, 1024);
    const normalizedTo = normalizePhoneNumber(to);
    const payload: any = {
      messaging_product: 'whatsapp',
      to: normalizedTo,
      recipient_type: 'individual',
      type: 'interactive',
      interactive: {
        type: 'cta_url',
        body: {
          text: composedMessage
        },
        action: {
          name: 'cta_url',
          parameters: {
            display_text: buttonTitle.slice(0, 20),
            url: url
          }
        }
      }
    };

    if (headerText) {
      payload.interactive.header = {
        type: 'text',
        text: safeText(headerText, 60)
      };
    }

    if (footerText) {
      payload.interactive.footer = {
        text: safeText(footerText, 60)
      };
    }

    const response = await axios.post(apiURL, payload, { headers });

    console.log(`✅ WhatsApp CTA sent → ${to} (Button: ${buttonTitle})`);

    // Log to audit for SuperAdmin terminal
    await logOutgoingMessage(company, to, composedMessage, 'cta_url');

    return {
      success: true,
      messageId: response.data.messages?.[0]?.id
    };

  } catch (error: any) {
    logMetaError(error, {
      action: 'send_cta_url',
      to,
      company: company?.name,
      buttonTitle,
      url
    });

    // Fallback to text
    const fallbackText = `${applyComplianceFooter(message, options?.includeComplianceFooter)}\n\n🔗 ${buttonTitle}: ${url}`;
    return sendWhatsAppMessage(company, to, fallbackText);
  }
}

/**
 * ============================================================
 * SEND LIST MESSAGE
 * ============================================================
 */
export async function sendWhatsAppList(
  company: any,
  to: string,
  message: string,
  buttonText: string,
  sections: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>,
  options?: { includeComplianceFooter?: boolean }
): Promise<any> {
  try {
    await enforceMessagingPolicy(company, to, 'freeform');
    await enforceRateLimit(company, to);
    const { url, headers } = getWhatsAppConfig(company);

    const composedMessage = applyComplianceFooter(message, options?.includeComplianceFooter, 1024);
    // Enforce WhatsApp list limits (max 1 section, 10 rows, 24/72 chars)
    const validatedSections = sections
      .slice(0, WHATSAPP_LIMITS_LIST.MAX_SECTIONS_PER_LIST)
      .map(section => ({
        title: (section.title || '').slice(0, WHATSAPP_LIMITS_LIST.SECTION_TITLE_MAX_LENGTH),
        rows: section.rows
          .slice(0, WHATSAPP_LIMITS_LIST.MAX_ROWS_PER_SECTION)
          .map(row => ({
            id: (row.id || '').slice(0, 200),
            title: (row.title || '').slice(0, WHATSAPP_LIMITS_LIST.ROW_TITLE_MAX_LENGTH),
            description: row.description
              ? (row.description || '').slice(0, WHATSAPP_LIMITS_LIST.ROW_DESCRIPTION_MAX_LENGTH)
              : undefined
          }))
      }));

    const normalizedTo = normalizePhoneNumber(to);
    const payload = {
      messaging_product: 'whatsapp',
      to: normalizedTo,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: {
          text: composedMessage // Max 1024 chars for body
        },
        action: {
          button: (buttonText || 'Select').slice(0, WHATSAPP_LIMITS_BUTTONS.BUTTON_TITLE_MAX_LENGTH),
          sections: validatedSections
        }
      }
    };

    console.log('📋 Sending WhatsApp list:', {
      to,
      sectionsCount: validatedSections.length,
      totalRows: validatedSections.reduce((sum, s) => sum + s.rows.length, 0)
    });

    const response = await axios.post(url, payload, { headers });

    console.log(`✅ [WhatsApp API] List sent to ${to} (${company.name})`);

    // Log to audit for SuperAdmin terminal
    await logOutgoingMessage(company, to, composedMessage, 'list');

    return {
      success: true,
      messageId: response.data.messages?.[0]?.id
    };

  } catch (error: any) {
    console.error('❌ WhatsApp list error:', {
      message: error?.response?.data?.error?.message,
      code: error?.response?.data?.error?.code
    });
    
    logMetaError(error, {
      action: 'send_list',
      to,
      company: company?.name
    });

    // Fallback to text
    const fallbackText =
      applyComplianceFooter(message, options?.includeComplianceFooter) +
      '\n\n' +
      sections
        .map(section =>
          `${section.title}\n` +
          section.rows.map((r, i) => `${i + 1}. ${r.title}`).join('\n')
        )
        .join('\n\n');

    return sendWhatsAppMessage(company, to, fallbackText);
  }
}

/**
 * ============================================================
 * SEND MEDIA MESSAGE (IMAGE, DOCUMENT, VIDEO, AUDIO)
 * ============================================================
 */
export async function sendWhatsAppMedia(
  company: any,
  to: string,
  mediaUrl: string,
  mediaType: 'image' | 'document' | 'video' | 'audio' = 'image',
  caption?: string,
  filename?: string
): Promise<any> {
  try {
    await enforceMessagingPolicy(company, to, 'freeform');
    await enforceRateLimit(company, to);
    const { url, headers } = getWhatsAppConfig(company);

    const normalizedTo = normalizePhoneNumber(to);
    const payload: any = {
      messaging_product: 'whatsapp',
      to: normalizedTo,
      type: mediaType,
      [mediaType]: {
        link: mediaUrl
      }
    };

    if (caption) {
      payload[mediaType].caption = safeText(caption, 1024);
    }

    if (mediaType === 'document' && filename) {
      payload[mediaType].filename = filename;
    }

    const response = await axios.post(url, payload, { headers });

    console.log(`✅ [WhatsApp API] Media (${mediaType}) sent to ${to} (${company.name})`);
    
    // Log to audit
    await logOutgoingMessage(company, to, `Media (${mediaType}): ${mediaUrl}`, 'media');

    return {
      success: true,
      messageId: response.data.messages?.[0]?.id
    };

  } catch (error: any) {
    logMetaError(error, {
      action: 'send_media',
      mediaType,
      to,
      company: company?.name
    });

    // Fallback? Media cannot easily fallback to text without the file itself being visible.
    // However, we can send a text message with the link as a fallback.
    return sendWhatsAppMessage(company, to, `${caption ? caption + '\n\n' : ''}🔗 Attachment: ${mediaUrl}`);
  }
}
