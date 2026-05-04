import { logger } from '../config/logger';

function truncate(value: string, maxLength = 160): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}

function pickDefined<T extends Record<string, any>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

function summarizeComponent(component: any) {
  if (!component || typeof component !== 'object') return component;

  const base = {
    type: component.type,
    subType: component.sub_type,
    index: component.index
  };

  if (!Array.isArray(component.parameters)) {
    return base;
  }

  const parameters = component.parameters.map((parameter: any) => {
    const parameterType = String(parameter?.type || '').toLowerCase();

    if (parameterType === 'text') {
      return {
        type: 'text',
        text: truncate(String(parameter?.text || ''), 120)
      };
    }

    if (['image', 'video', 'document', 'audio'].includes(parameterType)) {
      const media = parameter?.[parameterType] || {};
      return pickDefined({
        type: parameterType,
        link: media?.link,
        filename: media?.filename,
        caption: truncate(String(media?.caption || ''), 120)
      });
    }

    return pickDefined({
      type: parameterType || parameter?.type,
      value: truncate(JSON.stringify(parameter), 240)
    });
  });

  return {
    ...base,
    parameters
  };
}

export function summarizeWhatsAppPayload(payload: any) {
  if (!payload || typeof payload !== 'object') return payload;

  return pickDefined({
    messagingProduct: payload.messaging_product,
    to: payload.to,
    type: payload.type,
    text: payload.text?.body ? truncate(String(payload.text.body), 240) : undefined,
    template: payload.template
      ? pickDefined({
          name: payload.template.name,
          language: payload.template.language?.code,
          components: Array.isArray(payload.template.components)
            ? payload.template.components.map(summarizeComponent)
            : undefined
        })
      : undefined,
    interactive: payload.interactive
      ? pickDefined({
          type: payload.interactive.type,
          bodyText: payload.interactive.body?.text
            ? truncate(String(payload.interactive.body.text), 240)
            : undefined,
          headerText: payload.interactive.header?.text,
          footerText: payload.interactive.footer?.text,
          buttonTitle: payload.interactive.action?.button,
          buttons: Array.isArray(payload.interactive.action?.buttons)
            ? payload.interactive.action.buttons.map((button: any) => ({
                id: button?.reply?.id,
                title: button?.reply?.title
              }))
            : undefined,
          sections: Array.isArray(payload.interactive.action?.sections)
            ? payload.interactive.action.sections.map((section: any) => ({
                title: section?.title,
                rows: Array.isArray(section?.rows)
                  ? section.rows.map((row: any) => ({
                      id: row?.id,
                      title: row?.title,
                      description: row?.description
                    }))
                  : undefined
              }))
            : undefined,
          cta: payload.interactive.action?.parameters
            ? {
                displayText: payload.interactive.action.parameters.display_text,
                url: payload.interactive.action.parameters.url
              }
            : undefined
        })
      : undefined,
    media: payload.type && payload[payload.type]
      ? pickDefined({
          mediaType: payload.type,
          link: payload[payload.type]?.link,
          filename: payload[payload.type]?.filename,
          caption: payload[payload.type]?.caption
            ? truncate(String(payload[payload.type].caption), 240)
            : undefined
        })
      : undefined
  });
}

export function summarizeMetaWebhookMessage(message: any) {
  if (!message || typeof message !== 'object') return message;

  return pickDefined({
    id: message.id,
    from: message.from,
    type: message.type,
    timestamp: message.timestamp,
    text: message.text?.body ? truncate(String(message.text.body), 240) : undefined,
    buttonPayload: message.button?.payload,
    buttonText: message.button?.text,
    interactiveType: message.interactive?.type,
    buttonReplyId: message.interactive?.button_reply?.id,
    buttonReplyTitle: message.interactive?.button_reply?.title,
    listReplyId: message.interactive?.list_reply?.id,
    listReplyTitle: message.interactive?.list_reply?.title,
    mediaId:
      message.image?.id ||
      message.document?.id ||
      message.video?.id ||
      message.audio?.id ||
      message.voice?.id,
    mediaCaption:
      message.image?.caption ||
      message.document?.caption ||
      message.video?.caption,
    location: message.location
      ? pickDefined({
          latitude: message.location.latitude,
          longitude: message.location.longitude,
          address: message.location.address,
          name: message.location.name
        })
      : undefined
  });
}

export function summarizeWhatsAppStatus(status: any) {
  if (!status || typeof status !== 'object') return status;

  return pickDefined({
    messageId: status.id,
    recipientId: status.recipient_id,
    status: status.status,
    timestamp: status.timestamp,
    conversationId: status.conversation?.id,
    conversationOrigin: status.conversation?.origin?.type,
    pricingModel: status.pricing?.pricing_model,
    billable: status.pricing?.billable,
    category: status.pricing?.category,
    errors: Array.isArray(status.errors)
      ? status.errors.map((error: any) =>
          pickDefined({
            code: error?.code,
            title: error?.title,
            message: error?.message,
            details: error?.error_data?.details
          })
        )
      : undefined
  });
}

export function logWhatsAppEvent(
  event: string,
  details: Record<string, any> = {},
  level: 'info' | 'warn' | 'error' = 'info'
) {
  logger.log(level, `[WhatsApp] ${event}`, {
    channel: 'whatsapp',
    event,
    ...details
  });
}
