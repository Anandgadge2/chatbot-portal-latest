import axios from 'axios';
import mongoose from 'mongoose';
import CompanyWhatsAppConfig from '../models/CompanyWhatsAppConfig';
import WhatsAppTemplateSyncLog from '../models/WhatsAppTemplateSyncLog';
import { logger } from '../config/logger';
import { deactivateMissingTemplates, upsertNormalizedTemplate } from './whatsappTemplateRepository';

function extractVariables(text: string): number {
  const matches = text.match(/\{\{\d+\}\}/g) || [];
  const unique = new Set(matches.map((token) => Number(token.replace(/[^0-9]/g, ''))));
  return unique.size;
}

function extractBodySampleValues(rawBodyComponent: any): string[] {
  const example = rawBodyComponent?.example;
  const bodyText = example?.body_text;
  if (!Array.isArray(bodyText) || bodyText.length === 0) return [];

  const firstSampleSet = Array.isArray(bodyText[0]) ? bodyText[0] : bodyText;
  if (!Array.isArray(firstSampleSet)) return [];

  return firstSampleSet
    .map((value: any) => String(value ?? '').trim())
    .filter((value: string) => value.length > 0);
}

function normalizeTemplate(companyId: mongoose.Types.ObjectId, raw: any) {
  const components = raw.components || [];
  const header = components.find((c: any) => c.type === 'HEADER');
  const body = components.find((c: any) => c.type === 'BODY');
  const footer = components.find((c: any) => c.type === 'FOOTER');
  const buttons = components.find((c: any) => c.type === 'BUTTONS');

  return {
    companyId,
    metaTemplateId: raw.id,
    name: raw.name,
    language: raw.language,
    category: raw.category,
    status: raw.status,
    header: {
      type: header?.format || null,
      content: header?.text || header?.format || '',
      sampleValues: header?.example?.header_text || header?.example?.header_handle || []
    },
    body: {
      text: body?.text || '',
      variables: extractVariables(body?.text || ''),
      sampleValues: extractBodySampleValues(body)
    },
    footer: footer?.text || '',
    buttons: (buttons?.buttons || []).map((button: any) => ({
      type: button.type,
      text: button.text || '',
      value: button.url || button.phone_number || button.payload || '',
      otp_type: button.otp_type || undefined,
      autofill_text: button.autofill_text || undefined
    })),
    isActive: true,
    lastSyncedAt: new Date()
  };
}

export async function syncTemplatesForCompany(companyId: mongoose.Types.ObjectId) {
  const config = await CompanyWhatsAppConfig.findOne({ companyId, isActive: true });
  if (!config?.businessAccountId || !config?.accessToken) {
    throw new Error('WhatsApp config missing for template sync.');
  }

  let fetchedCount = 0;
  let upsertedCount = 0;
  let deactivatedCount = 0;

  try {
    const response = await axios.get(`https://graph.facebook.com/v18.0/${config.businessAccountId}/message_templates`, {
      headers: {
        Authorization: `Bearer ${config.accessToken}`
      }
    });

    const data = response.data?.data || [];
    fetchedCount = data.length;

    const incomingKeys = new Set<string>();
    for (const rawTemplate of data) {
      const normalized = normalizeTemplate(companyId, rawTemplate);
      incomingKeys.add(`${normalized.name}::${normalized.language}`);

      await upsertNormalizedTemplate(companyId, normalized);
      upsertedCount += 1;
    }
    deactivatedCount = await deactivateMissingTemplates(companyId, incomingKeys);

    await WhatsAppTemplateSyncLog.create({
      companyId,
      status: 'SUCCESS',
      fetchedCount,
      upsertedCount,
      deactivatedCount
    });

    return { fetchedCount, upsertedCount, deactivatedCount };
  } catch (error: any) {
    const status = error?.response?.status;
    const errorMessage = error?.response?.data?.error?.message || error.message;

    await WhatsAppTemplateSyncLog.create({
      companyId,
      status: upsertedCount > 0 ? 'PARTIAL_SUCCESS' : 'FAILED',
      fetchedCount,
      upsertedCount,
      deactivatedCount,
      errorMessage
    });

    if (status === 401 || status === 403) {
      throw new Error('Token expired or unauthorized while syncing templates from Meta.');
    }

    logger.error('Template sync failed', { companyId: companyId.toString(), error: errorMessage });
    throw new Error(`Template sync failed: ${errorMessage}`);
  }
}
