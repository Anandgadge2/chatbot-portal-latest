import axios from 'axios';
import { sendMediaSequentially, sendWhatsAppTemplate } from '../whatsappService';

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
  phoneNumberId?: string;
  accessToken?: string;
  whatsappConfig?: {
    phoneNumberId?: string;
    accessToken?: string;
  };
}

const WHATSAPP_GRAPH_VERSION = 'v19.0';
const MESSAGE_DELAY_MS = 500;

function getCompanyCredentials(company: CompanyWhatsAppContext): { phoneNumberId: string; accessToken: string } {
  const phoneNumberId = String(company?.phoneNumberId || company?.whatsappConfig?.phoneNumberId || '').trim();
  const accessToken = String(company?.accessToken || company?.whatsappConfig?.accessToken || '').trim();

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

export async function sendTemplateMessage(options: {
  company: CompanyWhatsAppContext;
  recipientPhone: string;
  templateName: string;
  bodyParameters: TemplateBodyParameter[];
  languageCode?: string;
  grievanceId?: string;
}): Promise<void> {
  const {
    company,
    recipientPhone,
    templateName,
    bodyParameters,
    languageCode = 'en',
    grievanceId
  } = options;

  try {
    const rawParameters = bodyParameters.map((parameter) => asText(parameter?.text));
    const result = await sendWhatsAppTemplate(
      company as any,
      recipientPhone,
      templateName,
      rawParameters,
      languageCode,
      undefined,
      undefined,
      { recipientType: 'ADMIN' }
    );

    if (!result?.success) {
      throw new Error(result?.error || 'Failed to send WhatsApp template');
    }
  } catch (error: any) {
    console.error(
      `❌ Failed to send template ${templateName} for grievance ${grievanceId || 'N/A'}:`,
      error?.response?.data || error?.message || error
    );
    throw error;
  }
}

export async function sendImageMessage(
  company: CompanyWhatsAppContext,
  recipientPhone: string,
  file: WhatsAppAttachment,
  grievanceId?: string
): Promise<void> {
  try {
    const { phoneNumberId, accessToken } = getCompanyCredentials(company);
    await postWhatsAppMessage(getMessagesEndpoint(phoneNumberId), buildHeaders(accessToken), {
      messaging_product: 'whatsapp',
      to: recipientPhone,
      type: 'image',
      image: {
        link: file.url,
        caption: file.caption || 'Grievance Image'
      }
    });
  } catch (error: any) {
    console.error(
      `❌ Failed to send image attachment for grievance ${grievanceId || 'N/A'} (${file.url}):`,
      error?.response?.data || error?.message || error
    );
    throw error;
  }
}

export async function sendVideoMessage(
  company: CompanyWhatsAppContext,
  recipientPhone: string,
  file: WhatsAppAttachment,
  grievanceId?: string
): Promise<void> {
  try {
    const { phoneNumberId, accessToken } = getCompanyCredentials(company);
    await postWhatsAppMessage(getMessagesEndpoint(phoneNumberId), buildHeaders(accessToken), {
      messaging_product: 'whatsapp',
      to: recipientPhone,
      type: 'video',
      video: {
        link: file.url,
        caption: file.caption || 'Grievance Video'
      }
    });
  } catch (error: any) {
    console.error(
      `❌ Failed to send video attachment for grievance ${grievanceId || 'N/A'} (${file.url}):`,
      error?.response?.data || error?.message || error
    );
    throw error;
  }
}

export async function sendDocumentMessage(
  company: CompanyWhatsAppContext,
  recipientPhone: string,
  file: WhatsAppAttachment,
  grievanceId?: string
): Promise<void> {
  try {
    const { phoneNumberId, accessToken } = getCompanyCredentials(company);
    await postWhatsAppMessage(getMessagesEndpoint(phoneNumberId), buildHeaders(accessToken), {
      messaging_product: 'whatsapp',
      to: recipientPhone,
      type: 'document',
      document: {
        link: file.url,
        filename: file.filename || 'Attachment',
        caption: file.caption || 'Supporting Document'
      }
    });
  } catch (error: any) {
    console.error(
      `❌ Failed to send document attachment for grievance ${grievanceId || 'N/A'} (${file.url}):`,
      error?.response?.data || error?.message || error
    );
    throw error;
  }
}

/**
 * Reusable flow for grievance/admin (and future citizen status updates):
 * template first, then attachments sequentially.
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

  // Always send template first.
  await sendTemplateMessage({
    company,
    recipientPhone,
    templateName,
    bodyParameters,
    languageCode,
    grievanceId
  });

  const validAttachments = attachments.filter((file) => file && isHttpsUrl(file.url));
  const skippedCount = attachments.length - validAttachments.length;
  if (skippedCount > 0) {
    console.warn(`⚠️ Skipped ${skippedCount} invalid attachment(s) for grievance ${grievanceId || 'N/A'}.`);
  }

  if (validAttachments.length === 0) return;

  await sendMediaSequentially(
    company,
    recipientPhone,
    validAttachments.map((file) => ({
      url: file.url,
      type: file.type || 'document',
      caption: file.caption,
      filename: file.filename
    }))
  );
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
    grievanceId: grievance?.referenceId || grievance?.grievanceId || grievance?._id
  });
}
