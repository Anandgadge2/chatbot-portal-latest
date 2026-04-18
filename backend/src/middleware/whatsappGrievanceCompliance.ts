import { NextFunction, Request, Response } from 'express';
import CitizenProfile from '../models/CitizenProfile';
import Company from '../models/Company';
import { sendWhatsAppTemplate } from '../services/whatsappService';
import { enforceDailyLimitOrThrow } from '../services/grievanceRateLimitService';
import { isWithin24Hours } from '../utils/istDate';
import { logger } from '../config/logger';

function rejection(res: Response, statusCode: number, code: string, message: string) {
  return res.status(statusCode).json({ success: false, code, message });
}

export async function enforceWhatsAppGrievanceCompliance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const companyId = req.body.companyId;
    const phone_number = req.body.citizenPhone || req.body.citizenWhatsApp;
    const language = req.body.language || 'en';

    if (!companyId || !phone_number) {
      rejection(res, 400, 'INVALID_INPUT', 'companyId and phone_number are required.');
      return;
    }

    const company = await Company.findById(companyId);
    if (!company) {
      rejection(res, 404, 'COMPANY_NOT_FOUND', 'Company not found.');
      return;
    }

    const citizen = await CitizenProfile.findOne({ companyId, phone_number });

    // 1) opt-out check
    if (citizen?.opt_out) {
      logger.warn('Rejected due to opt-out', { companyId, phone_number });
      rejection(res, 403, 'OPT_OUT', 'Citizen has opted out (STOP/UNSUBSCRIBE).');
      return;
    }

    // 2) citizen consent check
    if (!citizen?.citizen_consent) {
      await sendWhatsAppTemplate(company, phone_number, 'consent_request_citizen', [], language);
      logger.warn('Rejected due to missing citizen consent', { companyId, phone_number });
      rejection(res, 403, 'CONSENT_REQUIRED', 'Citizen consent is required before grievance creation.');
      return;
    }

    // 3) daily limit check (DB count query)
    await enforceDailyLimitOrThrow({
      companyId: company._id,
      phone_number,
      company,
      language
    });

    // 4) 24-hour window restriction
    if (citizen?.lastUserInteractionAt && !isWithin24Hours(citizen.lastUserInteractionAt, new Date())) {
      req.body.whatsappWindowRestricted = true;
      if (req.body.outboundMessageType === 'freeform') {
        logger.warn('Rejected free-form due to 24-hour window restriction', { companyId, phone_number });
        rejection(res, 403, 'WINDOW_RESTRICTED', 'Outside 24-hour WhatsApp window; only template messages are allowed.');
        return;
      }
    }

    next();
  } catch (error: any) {
    if (error?.code === 'LIMIT_EXCEEDED') {
      rejection(res, error.statusCode || 429, 'LIMIT_EXCEEDED', error.message);
      return;
    }
    if (error?.code === 'TEMPLATE_INVALID') {
      rejection(res, 400, 'TEMPLATE_INVALID', error.message);
      return;
    }

    logger.error('Compliance middleware failed', { message: error.message, stack: error.stack });
    rejection(res, 500, 'COMPLIANCE_ERROR', 'Compliance middleware failed.');
  }
}
