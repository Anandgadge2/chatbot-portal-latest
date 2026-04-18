import CompanyWhatsAppConfig from '../models/CompanyWhatsAppConfig';
import { logger } from '../config/logger';
import { syncTemplatesForCompany } from './whatsappTemplateSyncService';

let cronHandle: NodeJS.Timeout | null = null;

export function startWhatsAppTemplateSyncCron(intervalMs = 6 * 60 * 60 * 1000) {
  if (cronHandle) {
    return;
  }

  cronHandle = setInterval(async () => {
    try {
      const configs = await CompanyWhatsAppConfig.find({ isActive: true }).select('companyId');
      for (const config of configs) {
        try {
          await syncTemplatesForCompany(config.companyId as any);
        } catch (error: any) {
          logger.error('Scheduled template sync failed for company', {
            companyId: String(config.companyId),
            error: error.message
          });
        }
      }
    } catch (error: any) {
      logger.error('Scheduled template sync failed', { error: error.message });
    }
  }, intervalMs);

  logger.info(`🕒 WhatsApp template sync cron enabled (every ${intervalMs / (60 * 60 * 1000)} hours)`);
}
