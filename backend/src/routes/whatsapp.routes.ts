import express, { Request, Response } from 'express';
import { requireDatabaseConnection } from '../middleware/dbConnection';
import { processWhatsAppMessage } from '../services/chatbotEngine';
import { getRedisClient, isRedisConnected } from '../config/redis';
import Company from '../models/Company';
import CompanyWhatsAppConfig from '../models/CompanyWhatsAppConfig';

const router = express.Router();

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
  try {
    const body = req.body;

    console.log(
      '📥 Webhook POST received:',
      JSON.stringify(body, null, 2).substring(0, 500)
    );

    if (body.object !== 'whatsapp_business_account') {
      console.log(`⚠️ Unknown webhook object: ${body.object}`);
      return res.sendStatus(404);
    }

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    console.log(
      `📨 Processing webhook: entry=${!!entry}, changes=${!!changes}`
    );

    if (!value?.messages) {
      console.log('ℹ️ No messages (status update or delivery receipt)');
      return res.status(200).send('EVENT_RECEIVED');
    }

    for (const message of value.messages) {
      try {
        const messageId = message.id;
        
        // IDEMPOTENCY CHECK: Prevent duplicate processing
        if (await isMessageProcessed(messageId)) {
          console.log(`⏭️ Message ${messageId} already processed, skipping...`);
          continue;
        }

        // Mark message as processed (TTL: 48 hours)
        await markMessageAsProcessed(messageId);

        if (message.type === 'interactive') {
          console.log('🔘 Interactive message received');
          await handleInteractiveMessage(message, value.metadata);
        } else {
          console.log(`📝 ${message.type} message received`);
          await handleIncomingMessage(message, value.metadata);
        }
      } catch (msgErr) {
        console.error('❌ Error processing message:', msgErr);
      }
    }

    return res.status(200).send('EVENT_RECEIVED');
  } catch (error: any) {
    console.error('❌ Webhook processing failed:', error);
    return res.status(200).send('ERROR_PROCESSED');
  }
});

/**
 * ============================================================
 * DYNAMIC COMPANY RESOLUTION (MULTI-TENANT)
 * ============================================================
 * Finds the company based on phone number ID from metadata.
 * ✅ Source of truth: CompanyWhatsAppConfig (DB). No env fallback.
 */
async function getCompanyFromMetadata(metadata: any): Promise<any | null> {
  const phoneNumberId = metadata?.phone_number_id;
  
  if (!phoneNumberId) {
    console.warn('⚠️ No phone number ID in metadata. Cannot resolve company.');
    return null;
  }
  
  console.log(`🔍 Looking up company by phone number ID: ${phoneNumberId}`);
  
  const config = await CompanyWhatsAppConfig.findOne({
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
    verifyToken: config.verifyToken
  };

  console.log(`✅ Company resolved by phone number ID: ${company.name} (${company.companyId})`);
  return company;
}

/**
 * ============================================================
 * HANDLE NORMAL MESSAGES
 * ============================================================
 */
async function handleIncomingMessage(message: any, metadata: any) {
  try {
    // Dynamically resolve company from metadata
    const company = await getCompanyFromMetadata(metadata);
    
    if (!company) {
      console.error('❌ Could not resolve company for message');
      return;
    }

    const from = message.from;
    const messageId = message.id;
    const messageType = message.type;

    let messageText = '';
    let mediaUrl = '';

    if (messageType === 'text') {
      messageText = message.text?.body || '';
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
    }

    console.log(
      `📨 Message from ${from} → Company: ${company.name} (ID: ${company.companyId})`
    );

    const response = await processWhatsAppMessage({
      companyId: company.companyId,
      from,
      messageText,
      messageType,
      messageId,
      mediaUrl,
      metadata
    });

    return response;
  } catch (error) {
    console.error('❌ Error in handleIncomingMessage:', error);
    throw error;
  }
}

/**
 * ============================================================
 * HANDLE INTERACTIVE MESSAGES
 * ============================================================
 */
async function handleInteractiveMessage(message: any, metadata: any) {
  try {
    // Dynamically resolve company from metadata
    const company = await getCompanyFromMetadata(metadata);
    
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
