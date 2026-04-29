import axios from 'axios';
import mongoose from 'mongoose';
import CompanyWhatsAppConfig from '../models/CompanyWhatsAppConfig';
import WhatsAppTemplate from '../models/WhatsAppTemplate';
import WhatsAppTemplateSyncLog from '../models/WhatsAppTemplateSyncLog';
import { logger } from '../config/logger';
import {
  deactivateMissingTemplates,
  ensureAutoTemplateMappings,
  upsertNormalizedTemplate
} from './whatsappTemplateRepository';

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

function normalizeTemplate(companyId: mongoose.Types.ObjectId, businessAccountId: string, raw: any) {
  const components = raw.components || [];
  const header = components.find((c: any) => c.type === 'HEADER');
  const body = components.find((c: any) => c.type === 'BODY');
  const footer = components.find((c: any) => c.type === 'FOOTER');
  const buttons = components.find((c: any) => c.type === 'BUTTONS');

  return {
    companyId,
    metaTemplateId: raw.id,
    businessAccountId,
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
  let autoMappedCount = 0;

  try {
    const headers = {
      Authorization: `Bearer ${config.accessToken}`
    };

    // 🔄 Cleanup: Deactivate templates that don't match the current businessAccountId
    // This ensures only templates for the active WABA are visible.
    // They will be reactivated by the sync loop if they are present in the current account.
    const staleTemplates = await WhatsAppTemplate.find({
      companyId,
      businessAccountId: { $ne: config.businessAccountId },
      isActive: true
    }).select('_id');

    if (staleTemplates.length > 0) {
      const syncTimestamp = new Date();
      for (const template of staleTemplates) {
        await WhatsAppTemplate.findByIdAndUpdate(template._id, {
          $set: { isActive: false, lastSyncedAt: syncTimestamp }
        });
      }
    }

    const validTemplates: any[] = [];
    let nextUrl: string | null = `https://graph.facebook.com/v19.0/${config.businessAccountId}/message_templates?limit=200`;

    while (nextUrl) {
      const response: any = await axios.get(nextUrl, { headers });
      const batch = response.data?.data || [];
      fetchedCount += batch.length;
      // Log all templates from Meta for debugging
      batch.forEach((t: any) => {
        console.log(`- [Meta] ${t.name} (${t.status})`);
      });

      // Include APPROVED, PENDING, and other active states.
      // Meta API statuses: APPROVED, PENDING, REJECTED, PAUSED, DISABLED, IN_APPEAL
      const batchFiltered = batch.filter((template: any) => {
        const status = String(template?.status || '').toUpperCase();
        return status === 'APPROVED' || status === 'PENDING' || status === 'IN_APPEAL' || status === 'PAUSED';
      });
      
      validTemplates.push(...batchFiltered);
      nextUrl = response.data?.paging?.next || null;
    }

    const incomingKeys = new Set<string>();
    for (const rawTemplate of validTemplates) {
      const normalized = normalizeTemplate(companyId, config.businessAccountId, rawTemplate);
      incomingKeys.add(`${normalized.name}::${normalized.language}`);

      await upsertNormalizedTemplate(companyId, normalized);
      upsertedCount += 1;
    }

    autoMappedCount = await ensureAutoTemplateMappings(
      companyId,
      validTemplates.map((template: any) => String(template?.name || '').trim())
    );

    deactivatedCount = await deactivateMissingTemplates(companyId, config.businessAccountId, incomingKeys);

    await WhatsAppTemplateSyncLog.create({
      companyId,
      status: 'SUCCESS',
      fetchedCount,
      upsertedCount,
      deactivatedCount
    });

    return { fetchedCount, upsertedCount, deactivatedCount, autoMappedCount };
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
