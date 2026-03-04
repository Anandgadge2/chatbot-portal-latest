/**
 * chatbotEngine.ts — Pure Dynamic Multi-Tenant Chatbot Router
 *
 * This file is intentionally lean. It:
 *  1. Receives an incoming WhatsApp message
 *  2. Looks up the company and session
 *  3. Finds the company's active Flow from the database
 *  4. Delegates ALL conversation execution to DynamicFlowEngine
 *
 * No hardcoded translations. No tenant-specific logic.
 * All content (messages, buttons, languages) lives in the Flow Builder / DB.
 */

import mongoose from 'mongoose';
import Company from '../models/Company';
import ChatbotFlow from '../models/ChatbotFlow';
import { sendWhatsAppMessage } from './whatsappService';
import { uploadWhatsAppMediaToCloudinary } from './mediaService';
import { getSession, getSessionFromMongo, updateSession, clearSession, UserSession } from './sessionService';
import { loadFlowForTrigger, DynamicFlowEngine, getStartStepForTrigger } from './dynamicFlowEngine';
import CompanyWhatsAppConfig from '../models/CompanyWhatsAppConfig';

// ─── Message Interface ────────────────────────────────────────────────────────

export interface ChatbotMessage {
  companyId: string;
  from: string;
  messageText: string;
  messageType: string;
  messageId: string;
  mediaUrl?: string;
  metadata?: any;
  buttonId?: string;
}

// ─── Greeting Keywords ───────────────────────────────────────────────────────

const GREETINGS = new Set([
  'hi', 'hii', 'hello', 'start', 'namaste', 'नमस्ते', 'restart', 'menu',
  'ନମସ୍କାର', 'নমষ্কার', 'helo', 'hey', 'begin'
]);

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export async function processWhatsAppMessage(message: ChatbotMessage): Promise<any> {
  const { from, messageType, messageId } = message;
  const mediaUrl = message.mediaUrl;
  const companyId = message.companyId;
  const buttonId = message.buttonId?.trim();
  const userInput = (message.messageText || '').trim().toLowerCase();
  const rawInput = (message.messageText || '').trim();

  console.log(`\n📨 Incoming [${messageType}] from ${from} | Company: ${companyId}`);
  if (buttonId) console.log(`   ButtonId: ${buttonId}`);
  if (userInput) console.log(`   Text: "${rawInput.substring(0, 80)}"`);

  // ── 1. Find Company ───────────────────────────────────────────────────────
  const company = await findCompany(companyId);
  if (!company) {
    console.error(`❌ Company not found: ${companyId}`);
    return;
  }

  // ── 2. Load or create session ─────────────────────────────────────────────
  let session = await getSession(from, companyId);

  // ── 3. Handle greeting → always restart the flow ─────────────────────────
  if (!buttonId && GREETINGS.has(userInput)) {
    await handleGreeting(from, companyId, userInput, company, message);
    return;
  }

  // ── 4. Session recovery: if Redis lost the session, recover from Mongo ────
  if (
    session.step === 'start' &&
    !session.data?.flowId &&
    !buttonId &&
    rawInput &&
    !GREETINGS.has(userInput)
  ) {
    const mongoSession = await getSessionFromMongo(from, companyId);
    if (mongoSession?.data?.flowId && (mongoSession.data.currentStepId || mongoSession.data.awaitingInput)) {
      console.log('🔄 Session recovered from MongoDB');
      session.data = mongoSession.data;
      session.step = mongoSession.step;
      session.language = mongoSession.language;
    }
  }

  // ── 5. Auto-start if session has no flow context yet ─────────────────────
  if (session.step === 'start' && !session.data?.flowId) {
    await handleAutoStart(from, companyId, buttonId, company, session, message);
    return;
  }

  // ── 6. Continue an active flow ────────────────────────────────────────────
  if (session.data?.flowId) {
    await continueFlow(session, company, from, companyId, buttonId, userInput, rawInput, messageType, mediaUrl, message);
    return;
  }

  // ── 7. Fallback: no flow context at all ───────────────────────────────────
  await sendWhatsAppMessage(
    company,
    from,
    `👋 *Welcome!*\n\nType *"Hi"* to get started.\n\n_If the service is unavailable, please contact the administrator._`
  );
}

// ─── Helper: Find Company ─────────────────────────────────────────────────────

async function findCompany(companyId: string): Promise<any | null> {
  try {
    let company: any = null;

    // 1. Try finding by _id if it's a valid ObjectId
    if (mongoose.Types.ObjectId.isValid(companyId) && companyId.length === 24) {
      company = await Company.findById(companyId).lean();
    }

    // 2. Fallback: try finding by custom companyId string field (e.g., 'CMP000006')
    if (!company) {
      company = await Company.findOne({ companyId }).lean();
    }

    if (!company) return null;

    // 3. Load WhatsApp config using the actual company document _id (which is an ObjectId)
    const waConfig = await CompanyWhatsAppConfig.findOne({ 
      companyId: company._id, 
      isActive: true 
    }).lean();
    
    if (waConfig) (company as any).whatsappConfig = waConfig;

    return company;
  } catch (err) {
    console.error('❌ Error finding company:', err);
    return null;
  }
}

// ─── Helper: Handle Greeting (restart) ───────────────────────────────────────

async function handleGreeting(
  from: string,
  companyId: string,
  trigger: string,
  company: any,
  message: ChatbotMessage
): Promise<void> {
  console.log(`🔄 Greeting received: "${trigger}" → restarting flow`);

  const flow = await loadFlowForTrigger(companyId, trigger);
  if (!flow || !flow.isActive) {
    // Try the generic "hi" trigger as fallback
    const fallback = await loadFlowForTrigger(companyId, 'hi');
    if (!fallback || !fallback.isActive) {
      await sendNoFlowMessage(company, from);
      return;
    }
    return executeFlowFromStart(from, companyId, fallback, company, 'hi');
  }
  return executeFlowFromStart(from, companyId, flow, company, trigger);
}

// ─── Helper: Auto-start on first message ─────────────────────────────────────

async function handleAutoStart(
  from: string,
  companyId: string,
  buttonId: string | undefined,
  company: any,
  session: UserSession,
  message: ChatbotMessage
): Promise<void> {
  const flow = await loadFlowForTrigger(companyId, 'hi');
  if (!flow || !flow.isActive) {
    await sendNoFlowMessage(company, from);
    return;
  }

  let startStepId = getStartStepForTrigger(flow, 'hi') || flow.startStepId;
  const startStep = flow.steps.find(s => s.stepId === startStepId);
  if (!startStep) startStepId = flow.startStepId;

  // If a button/list click arrived while session had no flow — reconstruct mapping and handle
  if (buttonId) {
    session.data = { flowId: flow.flowId, currentStepId: startStepId, buttonMapping: {}, listMapping: {} };
    flow.steps.forEach((s: any) => {
      (s.buttons || []).forEach((btn: any) => {
        if (btn.nextStepId) (session.data as any).buttonMapping[btn.id] = btn.nextStepId;
      });
      ((s.listConfig?.sections) || []).forEach((sec: any) => {
        (sec.rows || []).forEach((row: any) => {
          if (row.nextStepId) (session.data as any).listMapping[row.id] = row.nextStepId;
        });
      });
    });
    const firstLangStep = flow.steps.find((s: any) => s.stepId === startStepId);
    (firstLangStep?.expectedResponses || []).forEach((r: any) => {
      if (r.type === 'button_click' && r.nextStepId) (session.data as any).buttonMapping[r.value] = r.nextStepId;
    });
    await updateSession(session);

    const engine = new DynamicFlowEngine(flow, session, company, from);
    if ((session.data as any).listMapping?.[buttonId]) {
      await engine.handleListSelection(buttonId);
    } else {
      await engine.handleButtonClick(buttonId);
    }
    return;
  }

  // Normal auto-start
  session.data = { flowId: flow.flowId };
  await updateSession(session);
  const engine = new DynamicFlowEngine(flow, session, company, from);
  await engine.executeStep(startStepId);
}

// ─── Helper: Continue an active flow ─────────────────────────────────────────

async function continueFlow(
  session: UserSession,
  company: any,
  from: string,
  companyId: string,
  buttonId: string | undefined,
  userInput: string,
  rawInput: string,
  messageType: string,
  mediaUrl: string | undefined,
  message: ChatbotMessage
): Promise<void> {
  let flow = await ChatbotFlow.findOne({ flowId: session.data.flowId, isActive: true });

  // Fallback: session may have stored ObjectId instead of flowId string
  if (!flow && mongoose.Types.ObjectId.isValid(String(session.data.flowId))) {
    flow = await ChatbotFlow.findOne({ _id: session.data.flowId, isActive: true });
    if (flow) {
      session.data.flowId = (flow as any).flowId;
      await updateSession(session);
    }
  }

  if (!flow) {
    console.warn('⚠️ Active flow not found or deactivated, clearing session');
    await clearSession(from, companyId);
    await sendWhatsAppMessage(
      company,
      from,
      `⚠️ *Service Temporarily Unavailable*\n\nThe chatbot flow is inactive or not configured.\n\nPlease contact the administrator, or type *"Hi"* to check again.`
    );
    return;
  }

  console.log(`🔄 Continuing flow: ${flow.flowName} (${(flow as any).flowId})`);
  const engine = new DynamicFlowEngine(flow, session, company, from);

  // ── Date selection from availability API ──────────────────────────────────
  if (buttonId?.startsWith('date_') && session.data.dateMapping) {
    const date = session.data.dateMapping[buttonId];
    if (date) {
      session.data.selectedDate = date;
      session.data.appointmentDate = date;
      await updateSession(session);
      const nextStepId = session.data.availabilityNextStepId || session.data.currentStepId;
      if (nextStepId) await engine.executeStep(nextStepId);
    }
    return;
  }

  // ── Time selection from availability API ──────────────────────────────────
  if (buttonId?.startsWith('time_') && session.data.timeMapping) {
    const time = session.data.timeMapping[buttonId];
    if (time) {
      session.data.selectedTime = time;
      session.data.appointmentTime = time;
      await updateSession(session);
      const nextStepId = session.data.availabilityNextStepId || session.data.currentStepId;
      if (nextStepId) await engine.executeStep(nextStepId);
    }
    return;
  }

  // ── List selection ────────────────────────────────────────────────────────
  if (buttonId && session.data.listMapping?.[buttonId] !== undefined) {
    await engine.handleListSelection(buttonId);
    return;
  }

  // ── Button click ──────────────────────────────────────────────────────────
  if (buttonId) {
    await engine.handleButtonClick(buttonId);
    return;
  }

  // ── Media upload ──────────────────────────────────────────────────────────
  if (session.data.awaitingMedia && (messageType === 'image' || messageType === 'document' || messageType === 'video') && mediaUrl) {
    await handleMediaUpload(session, company, from, messageType, mediaUrl, engine);
    return;
  }

  // ── Skip when awaiting media but user sent text ───────────────────────────
  if (session.data.awaitingMedia) {
    const skipKeywords = ['back', 'skip', 'cancel', 'no', 'na', 'n/a'];
    if (skipKeywords.some(k => userInput === k || userInput.includes(k))) {
      const nextStepId = session.data.awaitingMedia.nextStepId;
      delete session.data.awaitingMedia;
      await updateSession(session);
      if (nextStepId) await engine.executeStep(nextStepId);
    } else {
      await sendWhatsAppMessage(company, from, `📷 Please upload the image/document, or type *"skip"* to continue without it.`);
    }
    return;
  }

  // ── Media input step skip ─────────────────────────────────────────────────
  const isMediaInputStep = ['image', 'document', 'video'].includes(session.data.awaitingInput?.type);
  if (isMediaInputStep && session.data.awaitingInput) {
    const skipKeywords = ['back', 'skip', 'cancel', 'no', 'na'];
    if (skipKeywords.some(k => userInput === k || userInput.includes(k))) {
      const nextStepId = session.data.awaitingInput.nextStepId;
      delete session.data.awaitingInput;
      await updateSession(session);
      if (nextStepId) await engine.executeStep(nextStepId);
    } else {
      await sendWhatsAppMessage(company, from, `📷 Please upload the file, or type *"skip"* to continue without it.`);
    }
    return;
  }

  // ── Text input for current step ───────────────────────────────────────────
  if (session.data.awaitingInput) {
    await engine.executeStep(session.data.currentStepId, rawInput);
    return;
  }

  // ── Fallback: user sent regular text while a list/button was waiting ──────
  if (session.data.listMapping && Object.keys(session.data.listMapping).length > 0) {
    const lang = session.language || 'en';
    const msgs: Record<string, string> = {
      en: '⚠️ *Please use the menu above.*\n\nTap the *"Select"* or *"View"* button to open the list and pick an option. Typing a reply here won\'t work for this step.',
      hi: '⚠️ *कृपया ऊपर दिए गए मेनू का उपयोग करें।*\n\nसूची खोलने के लिए *"चुनें"* बटन टैप करें।',
      or: '⚠️ *ଦୟାକରି ଉପରୋକ୍ତ ମେନୁ ବ୍ୟବହାର କରନ୍ତୁ।*\n\n*"ବାଛନ୍ତୁ"* ବଟନ୍ ଟ୍ୟାପ୍ କରି ତାଲିକାରୁ ବାଛନ୍ତୁ।',
      mr: '⚠️ *कृपया वरील मेनू वापरा।*\n\n*"निवडा"* बटण टॅप करून यादीतून निवडा।'
    };
    await sendWhatsAppMessage(company, from, msgs[lang] || msgs['en']);
    return;
  }

  if (session.data.buttonMapping && Object.keys(session.data.buttonMapping).length > 0) {
    const lang = session.language || 'en';
    const msgs: Record<string, string> = {
      en: '⚠️ *Please use the buttons above.*\n\nTap one of the options shown to continue. Typing a reply won\'t work for this step.',
      hi: '⚠️ *कृपया ऊपर दिए गए बटन का उपयोग करें।*\n\nजारी रखने के लिए किसी एक विकल्प पर टैप करें।',
      or: '⚠️ *ଦୟାକରି ଉପରୋକ୍ତ ବଟନ୍ ବ୍ୟବହାର କରନ୍ତୁ।*\n\nଜାରି ରଖିବା ପାଇଁ ଗୋଟିଏ ବିକଳ୍ପ ଟ୍ୟାପ୍ କରନ୍ତୁ।',
      mr: '⚠️ *कृपया वरील बटणे वापरा।*\n\nसुरू ठेवण्यासाठी एका पर्यायांवर टॅप करा।'
    };
    await sendWhatsAppMessage(company, from, msgs[lang] || msgs['en']);
    return;
  }

  // ── Fallback: re-run current step with user input ─────────────────────────
  const stepId = session.data.currentStepId || flow.startStepId;
  console.log(`🔄 No specific handler; running step: ${stepId}`);
  await engine.executeStep(stepId, rawInput);
}

// ─── Helper: Execute flow from its start step ─────────────────────────────────

async function executeFlowFromStart(
  from: string,
  companyId: string,
  flow: any,
  company: any,
  trigger: string
): Promise<void> {
  let startStepId = getStartStepForTrigger(flow, trigger) || flow.startStepId;
  const startStep = flow.steps.find((s: any) => s.stepId === startStepId);
  if (!startStep) {
    console.warn(`⚠️ startStepId "${startStepId}" not found in flow ${flow.flowId}; using flow.startStepId`);
    startStepId = flow.startStepId;
    if (!flow.steps.find((s: any) => s.stepId === startStepId)) {
      console.error(`❌ Flow ${flow.flowId} has no valid startStepId`);
      await sendWhatsAppMessage(company, from, '⚠️ Flow configuration error. Please contact support.');
      return;
    }
  }

  await clearSession(from, companyId);
  const session = await getSession(from, companyId);
  session.data = { flowId: flow.flowId };
  await updateSession(session);

  const engine = new DynamicFlowEngine(flow, session, company, from);
  await engine.executeStep(startStepId);
}

// ─── Helper: Handle media upload in a flow step ───────────────────────────────

async function handleMediaUpload(
  session: UserSession,
  company: any,
  from: string,
  messageType: string,
  mediaUrl: string,
  engine: DynamicFlowEngine
): Promise<void> {
  const { nextStepId, saveToField = 'media' } = session.data.awaitingMedia;

  try {
    const accessToken = (company as any)?.whatsappConfig?.accessToken;
    if (accessToken) {
      const folder = (company?.name || company?._id?.toString() || 'chatbot').replace(/\s+/g, '_');
      const cloudUrl = await uploadWhatsAppMediaToCloudinary(mediaUrl, accessToken, folder);
      storeMedia(session.data, saveToField, cloudUrl || mediaUrl, messageType, !!cloudUrl);
    } else {
      storeMedia(session.data, saveToField, mediaUrl, messageType, false);
    }
  } catch (err: any) {
    console.error('❌ Media upload failed:', err.message);
    storeMedia(session.data, saveToField, mediaUrl, messageType, false);
  }

  delete session.data.awaitingMedia;
  await updateSession(session);
  if (nextStepId) {
    console.log(`📎 Media saved, advancing to step: ${nextStepId}`);
    await engine.executeStep(nextStepId);
  }
}

function storeMedia(data: any, field: string, url: string, type: string, isCloudinary: boolean): void {
  const mediaEntry = { url, type, uploadedAt: new Date(), isCloudinary };

  if (field === 'media') {
    // Standard media array field
    data.media = data.media || [];
    data.media.push(mediaEntry);
  } else {
    // Custom field name (e.g. attachmentUrl) — save the URL string for placeholder resolution
    data[field] = url;
    // ALSO push to data.media[] so the Grievance/Appointment model always receives it
    const attachmentFields = ['attachmentUrl', 'attachment', 'fileUrl', 'documentUrl', 'mediaUrl'];
    if (attachmentFields.includes(field)) {
      data.media = data.media || [];
      // Only push if not already in array (avoid duplicates)
      const alreadyStored = data.media.some((m: any) => m.url === url);
      if (!alreadyStored) {
        data.media.push(mediaEntry);
      }
    }
  }
}

// ─── Helper: No flow configured ───────────────────────────────────────────────

async function sendNoFlowMessage(company: any, to: string): Promise<void> {
  await sendWhatsAppMessage(
    company,
    to,
    `👋 *Welcome!*\n\nThis service is not yet configured.\n\nPlease contact the administrator to set up the chatbot flow.\n\n_Type "Hi" to try again once the flow is configured._`
  );
}
