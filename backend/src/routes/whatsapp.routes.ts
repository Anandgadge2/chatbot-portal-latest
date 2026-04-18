import express, { Request, Response } from 'express';
import { requireDatabaseConnection } from '../middleware/dbConnection';
import { processWhatsAppMessage } from '../services/dynamicFlowEngine';
import { getRedisClient, isRedisConnected } from '../config/redis';
import Company from '../models/Company';
import CompanyWhatsAppConfig from '../models/CompanyWhatsAppConfig';
import WhatsAppSession from '../models/WhatsAppSession';
import CitizenProfile from '../models/CitizenProfile';
import { logger } from '../config/logger';
import { sendWhatsAppMessage } from '../services/whatsappService';
import { verifyWebhookSignature as verifyWebhookSignatureDigest } from '../utils/verifyWebhookSignature';

const router = express.Router();
type WebhookRequest = Request & { rawBody?: Buffer };
type VerifiedWebhookContext = {
  phoneNumberId: string;
  webhookSecret: string;
  config: {
    companyId: any;
    phoneNumberId: string;
    businessAccountId?: string;
    accessToken?: string;
    verifyToken?: string;
    rateLimits?: any;
  };
};
const DEFAULT_WEBHOOK_SECRET = 'chatbot_portal_verify';

/**
 * ============================================================
 * WEBHOOK VERIFICATION (GET)
 * ============================================================
 */
router.get('/', requireDatabaseConnection, async (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  try {
    if (mode === 'subscribe' && typeof token === 'string') {
      // ✅ Verify token from DB (no env fallback)
      const config = await CompanyWhatsAppConfig.findOne({
        verifyToken: token,
        isActive: true
      }).select('_id companyId phoneNumberId');

      if (config) {
        console.log('✅ WhatsApp webhook verified (DB token match)', {
          companyId: config.companyId,
          phoneNumberId: config.phoneNumberId
        });
        return res.status(200).send(challenge);
      }
    }

    return res.sendStatus(403);
  } catch (err) {
    console.error('❌ Webhook verification failed:', err);
    return res.sendStatus(403);
  }
});

/**
 * ============================================================
 * WEBHOOK RECEIVER (POST)
 * ============================================================
 */
router.post('/', requireDatabaseConnection, async (req: Request, res: Response) => {
  const signedRequest = req as WebhookRequest;
  const body = req.body;
  logger.info(`📥 Webhook POST received`);

  const verifiedWebhookContext = await verifyWebhookRequest(signedRequest);
  if (!verifiedWebhookContext) {
    logger.error('❌ Invalid webhook signature');
    return res.status(403).send('INVALID_SIGNATURE');
  }
  logger.info('✅ Webhook verified successfully', {
    phoneNumberId: verifiedWebhookContext.phoneNumberId,
    companyId: verifiedWebhookContext.config.companyId
  });

  // ✅ CRITICAL: On Vercel, we MUST await the processing before responding.
  // Using setImmediate or non-awaited promises will result in the process being killed
  // as soon as res.send() is called.
  
  const processTask = (async () => {
    try {
      if (body.object !== 'whatsapp_business_account') {
        logger.warn(`⚠️ Unknown webhook object: ${body.object}`);
        return;
      }

      // Iterate through entries and changes to find messages
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          const value = change.value;
          const metadata = value?.metadata;

          if (!value?.messages) {
            // logger.info(`ℹ️ Webhook received field: ${change.field}, but no 'messages' content found.`);
            continue;
          }

          // Resolve company early
          const company = await getCompanyFromMetadata(metadata, verifiedWebhookContext.config);
          if (!company) {
            logger.error(`❌ Could not resolve company for phoneNumberId: ${metadata?.phone_number_id}.`);
            continue;
          }

          // Process messages sequentially or in parallel?
          // Sequential is safer for session state, but parallel is faster.
          // Since it's usually 1 message anyway, we'll keep it simple but awaited.
          for (const message of value.messages) {
            try {
              const messageId = message.id;

              // IDEMPOTENCY CHECK
              if (await isMessageProcessed(messageId)) {
                logger.info(`⏭️ Message ${messageId} already processed, skipping...`);
                continue;
              }

              // Mark message as processed
              await markMessageAsProcessed(messageId);

              if (message.type === 'interactive') {
                logger.info(`🔘 Interactive message received from ${message.from}`);
                await handleInteractiveMessage(message, metadata, company);
              } else {
                logger.info(`📝 ${message.type} message received from ${message.from}`);
                await handleIncomingMessage(message, metadata, company);
              }
            } catch (msgErr: any) {
              logger.error(`❌ Error processing message loop: ${msgErr.message}`, { stack: msgErr.stack });
            }
          }
        }
      }
    } catch (error: any) {
      logger.error('❌ Webhook background processing failed:', error);
    }
  })();

  // Race against a 25s timeout (Vercel limit is 30s)
  // This ensures we always try to respond 200 to WhatsApp to avoid retries.
  await Promise.race([
    processTask,
    new Promise((resolve) => setTimeout(resolve, 25000))
  ]);

  res.status(200).send('EVENT_RECEIVED');
});


/**
 * ============================================================
 * DYNAMIC COMPANY RESOLUTION (MULTI-TENANT)
 * ============================================================
 * Finds the company based on phone number ID from metadata.
 * ✅ Source of truth: CompanyWhatsAppConfig (DB). No env fallback.
 */
async function getCompanyFromMetadata(metadata: any, verifiedConfig?: VerifiedWebhookContext['config']): Promise<any | null> {
  const phoneNumberId = metadata?.phone_number_id;
  
  if (!phoneNumberId) {
    console.warn('⚠️ No phone number ID in metadata. Cannot resolve company.');
    return null;
  }
  
  console.log(`🔍 Looking up company by phone number ID: ${phoneNumberId}`);
  
  const config = verifiedConfig && verifiedConfig.phoneNumberId === phoneNumberId
    ? verifiedConfig
    : await CompanyWhatsAppConfig.findOne({
      phoneNumberId,
      isActive: true
    });

  if (!config) {
    console.error(`❌ WhatsApp config not found for phoneNumberId=${phoneNumberId}.`);
    return null;
  }

  const company = await Company.findById(config.companyId);
  if (!company) {
    console.error(`❌ Company not found for config.companyId=${config.companyId}`);
    return null;
  }

  // Attach WA config to company for downstream services (sending / media download)
  (company as any).whatsappConfig = {
    phoneNumberId: config.phoneNumberId,
    businessAccountId: config.businessAccountId,
    accessToken: config.accessToken,
    verifyToken: config.verifyToken,
    rateLimits: config.rateLimits
  };

  console.log(`✅ Company resolved by phone number ID: ${company.name} (${company.companyId})`);
  return company;
}

/**
 * ============================================================
 * HANDLE NORMAL MESSAGES
 * ============================================================
 */
async function handleIncomingMessage(message: any, metadata: any, resolvedCompany?: any) {
  try {
    // Use resolved company if provided, otherwise resolve from metadata
    const company = resolvedCompany || await getCompanyFromMetadata(metadata);
    
    if (!company) {
      console.error('❌ Could not resolve company for message');
      return;
    }

    const from = message.from;
    const messageId = message.id;
    const messageType = message.type;

    let messageText = '';
    let mediaUrl = '';
    let buttonId = '';

    if (messageType === 'text') {
      messageText = message.text?.body || '';
    } else if (messageType === 'button') {
      // Template quick-reply buttons are delivered as message.type = "button"
      // (not interactive.button_reply). Capture payload as buttonId so flow routing works.
      buttonId = message.button?.payload || '';
      messageText = message.button?.text || '';
    } else if (messageType === 'image') {
      messageText = message.image?.caption || '';
      mediaUrl = message.image?.id || '';
    } else if (messageType === 'document') {
      messageText = message.document?.caption || '';
      mediaUrl = message.document?.id || '';
    } else if (messageType === 'audio' || messageType === 'voice') {
      mediaUrl = message.audio?.id || message.voice?.id || '';
    } else if (messageType === 'video') {
      messageText = message.video?.caption || '';
      mediaUrl = message.video?.id || '';
    } else if (messageType === 'location') {
      // Capture WhatsApp location (Live or Static)
      const lat = message.location?.latitude;
      const long = message.location?.longitude;
      const address = message.location?.address || message.location?.name || '';
      messageText = `Lat: ${lat}, Long: ${long}${address ? `, Address: ${address}` : ''}`;
      // Pack location data into metadata for the engine
      (message as any).locationData = { lat, long, address };
    }

    console.log(
      `📨 Message from ${from} → Company: ${company.name} (ID: ${company.companyId})`
    );

    await handleConsentCommand({
      companyObjectId: company._id,
      from,
      messageText,
      company
    });

    await CitizenProfile.updateOne(
      { companyId: company._id, phone_number: from },
      { $set: { lastUserInteractionAt: new Date(), phoneNumber: from } },
      { upsert: true }
    );

    const citizenProfile = await CitizenProfile.findOne({ companyId: company._id, phone_number: from }).select('opt_out').lean();
    const normalizedText = (messageText || '').trim().toLowerCase();
    const isOptInCommand = normalizedText === 'start' || normalizedText === 'resume';
    if (citizenProfile?.opt_out && !isOptInCommand) {
      logger.info(`⛔ Message ignored for opted-out user ${from}`);
      return;
    }

    const response = await processWhatsAppMessage({
      companyId: company.companyId,
      from,
      messageText,
      messageType,
      messageId,
      mediaUrl,
      metadata,
      buttonId
    });

    return response;
  } catch (error) {
    console.error('❌ Error in handleIncomingMessage:', error);
    throw error;
  }
}

type ConsentCommandInput = {
  companyObjectId: any;
  from: string;
  messageText: string;
  company?: any;
};

async function handleConsentCommand({
  companyObjectId,
  from,
  messageText,
  company
}: ConsentCommandInput): Promise<void> {
  const normalized = (messageText || '').trim().toLowerCase();
  if (!normalized) {
    return;
  }

  const isStopCommand = normalized === 'stop' || normalized === 'unsubscribe';
  const isStartCommand = normalized === 'start' || normalized === 'resume';
  const isConsentAffirmed = normalized === 'yes' || normalized === 'i agree';

  if (!isStopCommand && !isStartCommand && !isConsentAffirmed) {
    return;
  }

  const consentPatch = isStopCommand
    ? {
      'sessionData.optedOut': true,
      'sessionData.consentStatus': 'opted_out',
      'sessionData.lastConsentAction': 'STOP',
      'sessionData.lastConsentAt': new Date()
    }
    : isConsentAffirmed
      ? {
        'sessionData.consentStatus': 'consent_given',
        'sessionData.lastConsentAction': 'YES',
        'sessionData.lastConsentAt': new Date()
      }
    : {
      'sessionData.optedOut': false,
      'sessionData.consentStatus': 'subscribed',
      'sessionData.lastConsentAction': 'START',
      'sessionData.lastConsentAt': new Date()
    };

  await WhatsAppSession.updateOne(
    { phoneNumber: from, companyId: companyObjectId },
    {
      $set: consentPatch
    },
    { upsert: false }
  );

  await CitizenProfile.updateOne(
    { companyId: companyObjectId, phone_number: from },
    {
      $set: isStopCommand
        ? {
            opt_out: true,
            isSubscribed: false
          }
        : isConsentAffirmed
          ? {
              citizen_consent: true,
              consentGiven: true,
              citizen_consent_timestamp: new Date(),
              consentTimestamp: new Date(),
              consent_source: 'whatsapp_text',
              isSubscribed: true,
              opt_out: false
            }
        : {
            opt_out: false,
            isSubscribed: true
          }
    },
    { upsert: true }
  );

  if (company && isStopCommand) {
    await sendWhatsAppMessage(
      company,
      from,
      'You have been unsubscribed from grievance updates. Reply START to subscribe again.',
      { requireConsent: false, allowUnsubscribed: true }
    );
  }

  if (company && isConsentAffirmed) {
    await sendWhatsAppMessage(
      company,
      from,
      'Thank you. Your consent has been recorded. You can now continue grievance submission.',
      { requireConsent: false }
    );
  }

  logger.info(`✅ Consent command processed for ${from}: ${isStopCommand ? 'STOP' : isConsentAffirmed ? 'YES' : 'START'}`);
}

/**
 * ============================================================
 * HANDLE INTERACTIVE MESSAGES
 * ============================================================
 */
async function handleInteractiveMessage(message: any, metadata: any, resolvedCompany?: any) {
  try {
    // Use resolved company if provided, otherwise resolve from metadata
    const company = resolvedCompany || await getCompanyFromMetadata(metadata);
    
    if (!company) {
      console.error('❌ Could not resolve company for interactive message');
      return;
    }

    const from = message.from;
    const messageId = message.id;
    const interactive = message.interactive;

    let buttonId = '';
    let messageText = '';

    if (interactive?.type === 'button_reply') {
      buttonId = interactive.button_reply?.id || '';
      messageText = interactive.button_reply?.title || '';
    }

    if (interactive?.type === 'list_reply') {
      buttonId = interactive.list_reply?.id || '';
      messageText = interactive.list_reply?.title || '';
    }

    if (!buttonId) return;

    console.log(`🔘 Button "${buttonId}" clicked by ${from}`);

    await CitizenProfile.updateOne(
      { companyId: company._id, phone_number: from },
      { $set: { lastUserInteractionAt: new Date(), phoneNumber: from } },
      { upsert: true }
    );

    const response = await processWhatsAppMessage({
      companyId: company.companyId,
      from,
      messageText,
      messageType: 'interactive',
      messageId,
      metadata,
      buttonId
    });

    return response;
  } catch (error) {
    console.error('❌ Error in handleInteractiveMessage:', error);
    throw error;
  }
}

/**
 * ============================================================
 * IDEMPOTENCY PROTECTION
 * ============================================================
 * Prevents duplicate processing of the same WhatsApp message
 */
const MESSAGE_TTL = 48 * 60 * 60; // 48 hours in seconds

async function isMessageProcessed(messageId: string): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis || !isRedisConnected()) {
    // If Redis unavailable, we can't check idempotency
    // In production, you might want to use MongoDB as fallback
    return false;
  }

  try {
    const key = `processed_message:${messageId}`;
    const exists = await redis.exists(key);
    return exists === 1;
  } catch (error) {
    console.error('❌ Error checking message idempotency:', error);
    return false; // Allow processing if check fails
  }
}

async function markMessageAsProcessed(messageId: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis || !isRedisConnected()) {
    return;
  }

  try {
    const key = `processed_message:${messageId}`;
    await redis.setex(key, MESSAGE_TTL, '1');
  } catch (error) {
    console.error('❌ Error marking message as processed:', error);
  }
}

export default router;

async function verifyWebhookRequest(req: WebhookRequest): Promise<VerifiedWebhookContext | null> {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature || typeof signature !== 'string') {
    logger.warn('⚠️ Missing x-hub-signature-256 header on webhook request.');
    return null;
  }

  const body = req.body;
  const phoneNumberId = body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
  if (!phoneNumberId) {
    logger.warn('⚠️ Webhook payload missing phone_number_id. Signature verification skipped.');
    return null;
  }

  if (!req.rawBody) {
    logger.warn('⚠️ rawBody not available for signature verification.');
    return null;
  }

  if (!signature.startsWith('sha256=')) {
    logger.warn('⚠️ Invalid webhook signature format.');
    return null;
  }

  const config = await CompanyWhatsAppConfig.findOne({
    phoneNumberId,
    isActive: true
  }).select('webhookSecret companyId phoneNumberId businessAccountId accessToken verifyToken rateLimits');

  if (!config) {
    logger.error(`❌ Active WhatsApp config not found for phoneNumberId=${phoneNumberId}.`);
    return null;
  }

  const webhookSecret = config.webhookSecret || DEFAULT_WEBHOOK_SECRET;
  if (!config.webhookSecret) {
    logger.warn(
      `⚠️ Webhook secret missing in CompanyWhatsAppConfig for phoneNumberId=${phoneNumberId}. Using fallback secret.`
    );
  }

  const isValid = verifyWebhookSignatureDigest(req.rawBody, signature, webhookSecret);
  if (!isValid) {
    logger.error('❌ Invalid webhook signature');
    return null;
  }

  return {
    phoneNumberId,
    webhookSecret,
    config: {
      companyId: config.companyId,
      phoneNumberId: config.phoneNumberId,
      businessAccountId: config.businessAccountId,
      accessToken: config.accessToken,
      verifyToken: config.verifyToken,
      rateLimits: config.rateLimits
    }
  };
}
