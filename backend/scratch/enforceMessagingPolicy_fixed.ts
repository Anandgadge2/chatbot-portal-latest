import { getSessionComplianceContext } from "../src/services/whatsappService";

async function enforceMessagingPolicy(
  company: any,
  to: string,
  messageType: 'template' | 'freeform',
  templateName?: string,
  options?: { requireConsent?: boolean; allowUnsubscribed?: boolean }
): Promise<void> {
  const compliance = await getSessionComplianceContext(company, to);
  const requireConsent = options?.requireConsent !== false;
  const optInTemplates = new Set<string>();
  const approvedOutsideWindowTemplates = new Set([
    'grievance_received_admin_v2',
    'grievance_assigned_admin_v2',
    'grievance_reassigned_admin_v2',
    'grievance_reverted_company_v2',
    'grievance_reminder_admin_v2',
    'number_admin_v1_',
    'grievance_status_inprogress_citizen_v2',
    'grievance_status_resolved_citizen_v2',
    'grievance_status_rejected_citizen_v2',
    'media_image_v1',
    'media_video_v1',
    'media_document_v1'
  ]);

  if ((!compliance.isSubscribed || compliance.optedOut) && !options?.allowUnsubscribed) {
    if (!(messageType === 'template' && templateName && optInTemplates.has(templateName))) {
      throw new Error('Recipient has unsubscribed (STOP). Message blocked.');
    }
  }

  // Consent is only required for proactive/outbound messages.
  // If the user is within the 24-hour window (they messaged us first), we can respond without consent.
  if (requireConsent && !compliance.consentGiven && !compliance.within24hWindow) {
    throw new Error('Recipient consent missing. Message blocked.');
  }

  if (messageType === 'freeform' && !compliance.within24hWindow) {
    throw new Error('Free-form message blocked outside 24-hour user-initiated window. Use an approved template.');
  }

  if (!compliance.within24hWindow && messageType === 'template' && templateName && !approvedOutsideWindowTemplates.has(templateName)) {
    throw new Error(`Template ${templateName} is not permitted outside the 24-hour window.`);
  }
}
