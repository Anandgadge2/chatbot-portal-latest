import axios from 'axios';

export type WhatsAppMediaType = 'image' | 'video' | 'document';

export interface WhatsAppAttachment {
  url: string;
  type: WhatsAppMediaType;
  caption?: string;
  filename?: string;
}

interface TemplateBodyParameter {
  type: 'text';
  text: string;
}

interface CompanyWhatsAppContext {
  whatsappConfig?: {
    phoneNumberId?: string;
    accessToken?: string;
  };
}

const WHATSAPP_GRAPH_VERSION = 'v19.0';
const MESSAGE_DELAY_MS = 500;

function getCompanyCredentials(company: CompanyWhatsAppContext): { phoneNumberId: string; accessToken: string } {
  const phoneNumberId = String(company?.whatsappConfig?.phoneNumberId || '').trim();
  const accessToken = String(company?.whatsappConfig?.accessToken || '').trim();

  if (!phoneNumberId || !accessToken) {
    throw new Error('Company WhatsApp credentials are missing (phoneNumberId/accessToken).');
  }

  return { phoneNumberId, accessToken };
}

function getMessagesEndpoint(phoneNumberId: string): string {
  return `https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}/${phoneNumberId}/messages`;
}

function buildHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };
}

function asText(value: unknown): string {
  return String(value ?? '').trim();
}

function isHttpsUrl(url?: string): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function postWhatsAppMessage(endpoint: string, headers: Record<string, string>, payload: any) {
  return axios.post(endpoint, payload, { headers });
}

export async function sendTemplateMessage(
  company: CompanyWhatsAppContext,
  adminPhone: string,
  templateName: string,
  bodyParameters: TemplateBodyParameter[],
  languageCode = 'en'
): Promise<void> {
  const { phoneNumberId, accessToken } = getCompanyCredentials(company);

  await postWhatsAppMessage(
    getMessagesEndpoint(phoneNumberId),
    buildHeaders(accessToken),
    {
      messaging_product: 'whatsapp',
      to: adminPhone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components: [
          {
            type: 'body',
            parameters: bodyParameters
          }
        ]
      }
    }
  );
}

export async function sendImageMessage(company: CompanyWhatsAppContext, adminPhone: string, file: WhatsAppAttachment): Promise<void> {
  const { phoneNumberId, accessToken } = getCompanyCredentials(company);
  await postWhatsAppMessage(getMessagesEndpoint(phoneNumberId), buildHeaders(accessToken), {
    messaging_product: 'whatsapp',
    to: adminPhone,
    type: 'image',
    image: {
      link: file.url,
      caption: file.caption || 'Grievance Image'
    }
  });
}

export async function sendVideoMessage(company: CompanyWhatsAppContext, adminPhone: string, file: WhatsAppAttachment): Promise<void> {
  const { phoneNumberId, accessToken } = getCompanyCredentials(company);
  await postWhatsAppMessage(getMessagesEndpoint(phoneNumberId), buildHeaders(accessToken), {
    messaging_product: 'whatsapp',
    to: adminPhone,
    type: 'video',
    video: {
      link: file.url,
      caption: file.caption || 'Grievance Video'
    }
  });
}

export async function sendDocumentMessage(company: CompanyWhatsAppContext, adminPhone: string, file: WhatsAppAttachment): Promise<void> {
  const { phoneNumberId, accessToken } = getCompanyCredentials(company);
  await postWhatsAppMessage(getMessagesEndpoint(phoneNumberId), buildHeaders(accessToken), {
    messaging_product: 'whatsapp',
    to: adminPhone,
    type: 'document',
    document: {
      link: file.url,
      filename: file.filename || 'Attachment',
      caption: file.caption || 'Supporting Document'
    }
  });
}

/**
 * Reusable flow for grievance/admin (and future citizen status updates):
 * Template first, then attachments sequentially.
 */
export async function sendTemplateAndAttachments(options: {
  recipientPhone: string;
  templateName: string;
  languageCode?: string;
  bodyParameters: TemplateBodyParameter[];
  attachments?: WhatsAppAttachment[];
  company: CompanyWhatsAppContext;
  grievanceId?: string;
}): Promise<void> {
  const {
    recipientPhone,
    templateName,
    languageCode = 'en',
    bodyParameters,
    attachments = [],
    company,
    grievanceId
  } = options;

  try {
    await sendTemplateMessage(company, recipientPhone, templateName, bodyParameters, languageCode);
  } catch (error: any) {
    console.error(`❌ Failed to send template ${templateName} for grievance ${grievanceId || 'N/A'}:`, error?.response?.data || error?.message || error);
    throw error;
  }

  for (const file of attachments) {
    if (!file || !isHttpsUrl(file.url)) {
      console.warn(`⚠️ Skipping invalid attachment URL for grievance ${grievanceId || 'N/A'}:`, file?.url);
      continue;
    }

    try {
      if (file.type === 'image') {
        await sendImageMessage(company, recipientPhone, file);
      } else if (file.type === 'video') {
        await sendVideoMessage(company, recipientPhone, file);
      } else if (file.type === 'document') {
        await sendDocumentMessage(company, recipientPhone, file);
      }
    } catch (error: any) {
      console.error(
        `❌ Failed to send ${file.type} attachment for grievance ${grievanceId || 'N/A'} (${file.url}):`,
        error?.response?.data || error?.message || error
      );
    }

    await new Promise(resolve => setTimeout(resolve, MESSAGE_DELAY_MS));
  }
}

export async function sendGrievanceToAdmin(
  adminPhone: string,
  grievance: any,
  attachments: WhatsAppAttachment[],
  company: CompanyWhatsAppContext
): Promise<void> {
  const templateBodyParameters: TemplateBodyParameter[] = [
    { type: 'text', text: asText(grievance?.adminName) },
    { type: 'text', text: asText(grievance?.referenceId) },
    { type: 'text', text: asText(grievance?.citizenName) },
    { type: 'text', text: asText(grievance?.department) },
    { type: 'text', text: asText(grievance?.office) },
    { type: 'text', text: asText(grievance?.description) },
    { type: 'text', text: asText(grievance?.createdAt) }
  ];

  await sendTemplateAndAttachments({
    recipientPhone: adminPhone,
    templateName: 'grievance_received_admin_v1',
    bodyParameters: templateBodyParameters,
    attachments,
    company,
    grievanceId: grievance?.referenceId || grievance?.grievanceId
  });
}
