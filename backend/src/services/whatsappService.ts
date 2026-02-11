import axios from 'axios';
import {
  WHATSAPP_LIMITS_BUTTONS,
  WHATSAPP_LIMITS_LIST
} from '../config/whatsappLimits';

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

function safeText(text: string, limit = 4000): string {
  if (!text) return '';
  return text.length > limit ? text.substring(0, limit - 10) + '…' : text;
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
  message: string
): Promise<any> {
  try {
    const { url, headers } = getWhatsAppConfig(company);

    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: {
        body: safeText(message)
      }
    };

    const response = await axios.post(url, payload, { headers });

    console.log(`✅ WhatsApp text sent → ${to}`);
    console.log(`   Message ID: ${response.data.messages?.[0]?.id || 'N/A'}`);
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
        errorCode: error.response.data?.error?.code,
        errorMessage: error.response.data?.error?.message,
        errorType: error.response.data?.error?.type,
        errorSubcode: error.response.data?.error?.error_subcode,
        fbtraceId: error.response.data?.error?.fbtrace_id,
        ...errorDetails
      });
      
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
 */
export async function sendWhatsAppTemplate(
  company: any,
  to: string,
  templateName: string,
  parameters: string[] = [],
  language: 'en' | 'hi' | 'mr' | 'or' = 'en'
): Promise<any> {
  try {
    const { url, headers } = getWhatsAppConfig(company);

    const payload: any = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: language }
      }
    };

    if (parameters.length > 0) {
      payload.template.components = [
        {
          type: 'body',
          parameters: parameters.map(p => ({
            type: 'text',
            text: safeText(p, 1000)
          }))
        }
      ];
    }

    const response = await axios.post(url, payload, { headers });

    console.log(`✅ WhatsApp template sent → ${to}`);
    return {
      success: true,
      messageId: response.data.messages?.[0]?.id
    };

  } catch (error: any) {
    logMetaError(error, {
      action: 'send_template',
      templateName,
      to,
      company: company?.name
    });

    return {
      success: false,
      error: error?.response?.data?.error?.message || error.message
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
  buttons: Array<{ id: string; title: string }>
): Promise<any> {
  try {
    const { url, headers } = getWhatsAppConfig(company);

    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: safeText(message)
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

    console.log(`✅ WhatsApp buttons sent → ${to}`);
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
      safeText(message) +
      '\n\n' +
      buttons.map((b, i) => `${i + 1}. ${b.title}`).join('\n');

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
  }>
): Promise<any> {
  try {
    const { url, headers } = getWhatsAppConfig(company);

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

    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: {
          text: safeText(message, 1024) // Max 1024 chars for body
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

    console.log(`✅ WhatsApp list sent → ${to}`);
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
      safeText(message) +
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
