import mongoose from 'mongoose';
import ChatbotFlow from '../models/ChatbotFlow';

const footer = 'This is an official government assistance chatbot.\nType STOP to unsubscribe.';

const consentCopy: Record<'en' | 'hi' | 'or', {
  dataMessage: string;
  updatesMessage: string;
  yesData: string;
  noData: string;
  yesUpdates: string;
  noUpdates: string;
}> = {
  en: {
    dataMessage: `*Data Processing Consent*\n\nTo file your grievance, you must consent to the processing of the details you shared for grievance registration and resolution.\n\n${footer}\n\nPlease choose:`,
    updatesMessage: `*WhatsApp Update Consent*\n\nWould you like to receive grievance status updates on WhatsApp using approved templates?\n\n${footer}\n\nPlease choose:`,
    yesData: 'I Agree',
    noData: 'I Do Not Agree',
    yesUpdates: 'Yes, send updates',
    noUpdates: 'No updates'
  },
  hi: {
    dataMessage: `*Data Processing Consent*\n\nPlease confirm that you allow grievance registration and resolution using the details shared in this chat.\n\n${footer}\n\nPlease choose:`,
    updatesMessage: `*WhatsApp Update Consent*\n\nWould you like to receive grievance status updates on WhatsApp using approved templates?\n\n${footer}\n\nPlease choose:`,
    yesData: 'Agree',
    noData: 'Do not agree',
    yesUpdates: 'Yes, send updates',
    noUpdates: 'No updates'
  },
  or: {
    dataMessage: `*Data Processing Consent*\n\nPlease confirm that you allow grievance registration and resolution using the details shared in this chat.\n\n${footer}\n\nPlease choose:`,
    updatesMessage: `*WhatsApp Update Consent*\n\nWould you like to receive grievance status updates on WhatsApp using approved templates?\n\n${footer}\n\nPlease choose:`,
    yesData: 'Agree',
    noData: 'Do not agree',
    yesUpdates: 'Yes, send updates',
    noUpdates: 'No updates'
  }
};

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
}

function upsertStep(steps: any[], step: any): any[] {
  const next = [...steps];
  const index = next.findIndex((item) => item.stepId === step.stepId);
  if (index >= 0) {
    next[index] = { ...next[index], ...step };
  } else {
    next.push(step);
  }
  return next;
}

function upsertNode(flow: any, id: string, data: any, position: { x: number; y: number }) {
  if (!Array.isArray(flow.nodes)) return;
  const index = flow.nodes.findIndex((node: any) => node.id === id);
  const nextNode = {
    id,
    type: flow.nodes[index]?.type || 'chatbotNode',
    position,
    data
  };
  if (index >= 0) flow.nodes[index] = nextNode;
  else flow.nodes.push(nextNode);
}

function upsertEdge(flow: any, edge: any) {
  if (!Array.isArray(flow.edges)) return;
  const index = flow.edges.findIndex((item: any) => item.id === edge.id);
  if (index >= 0) flow.edges[index] = edge;
  else flow.edges.push(edge);
}

async function run() {
  const uri = process.env.MONGODB_URI;
  const flowId = getArg('flowId') || process.env.FLOW_ID;

  if (!uri) {
    throw new Error('MONGODB_URI is required.');
  }

  if (!flowId) {
    throw new Error('Pass --flowId=FLOW000013 (or set FLOW_ID).');
  }

  await mongoose.connect(uri);

  const flow = await ChatbotFlow.findOne({ flowId });
  if (!flow) {
    throw new Error(`Flow ${flowId} not found.`);
  }

  for (const lang of ['en', 'hi', 'or'] as const) {
    const copy = consentCopy[lang];
    const confirmStepId = `grv_confirm_${lang}`;
    const dataStepId = `grv_consent_data_${lang}`;
    const updatesStepId = `grv_consent_updates_${lang}`;
    const menuStepId = `main_menu_${lang}`;

    flow.steps = flow.steps.map((step: any) => {
      if (step.stepId === `grv_evidence_${lang}`) {
        step.buttons = (step.buttons || []).map((button: any) =>
          button.id === `skip_evidence_${lang}`
            ? { ...button, nextStepId: dataStepId }
            : button
        );
        step.expectedResponses = (step.expectedResponses || []).map((response: any) =>
          response.value === `skip_evidence_${lang}`
            ? { ...response, nextStepId: dataStepId }
            : response
        );
      }

      if (step.stepId === `grv_upload_${lang}`) {
        step.nextStepId = dataStepId;
        if (step.inputConfig) {
          step.inputConfig.nextStepId = dataStepId;
        }
      }

      if (step.stepId === 'language_selection' || step.stepId === 'language_selection_en') {
        const current = String(step.messageText || '');
        if (!current.includes('This is an official government assistance chatbot.')) {
          step.messageText = `${current}\n\n${footer}`;
        }
      }

      return step;
    });

    flow.steps = upsertStep(flow.steps as any[], {
      stepId: dataStepId,
      stepType: 'buttons',
      stepName: `Grievance Data Consent (${lang.toUpperCase()})`,
      messageText: copy.dataMessage,
      buttons: [
        { id: `grv_consent_data_yes_${lang}`, title: copy.yesData, nextStepId: updatesStepId, action: 'next' },
        { id: `grv_consent_data_no_${lang}`, title: copy.noData, nextStepId: menuStepId, action: 'next' }
      ],
      expectedResponses: [
        { type: 'button_click', value: `grv_consent_data_yes_${lang}`, nextStepId: updatesStepId },
        { type: 'button_click', value: `grv_consent_data_no_${lang}`, nextStepId: menuStepId }
      ],
      nextStepId: updatesStepId
    });

    flow.steps = upsertStep(flow.steps as any[], {
      stepId: updatesStepId,
      stepType: 'buttons',
      stepName: `Grievance Update Consent (${lang.toUpperCase()})`,
      messageText: copy.updatesMessage,
      buttons: [
        { id: `grv_consent_updates_yes_${lang}`, title: copy.yesUpdates, nextStepId: confirmStepId, action: 'next' },
        { id: `grv_consent_updates_no_${lang}`, title: copy.noUpdates, nextStepId: confirmStepId, action: 'next' }
      ],
      expectedResponses: [
        { type: 'button_click', value: `grv_consent_updates_yes_${lang}`, nextStepId: confirmStepId },
        { type: 'button_click', value: `grv_consent_updates_no_${lang}`, nextStepId: confirmStepId }
      ],
      nextStepId: confirmStepId
    });

    const confirmNode = Array.isArray(flow.nodes)
      ? flow.nodes.find((node: any) => node.id === confirmStepId)
      : null;
    const confirmPosition = confirmNode?.position || { x: 2600, y: 0 };

    upsertNode(flow, dataStepId, {
      label: `Data Consent (${lang.toUpperCase()})`,
      messageText: copy.dataMessage,
      buttons: [
        { id: `grv_consent_data_yes_${lang}`, text: copy.yesData, type: 'quick_reply', nextStepId: updatesStepId },
        { id: `grv_consent_data_no_${lang}`, text: copy.noData, type: 'quick_reply', nextStepId: menuStepId }
      ]
    }, { x: confirmPosition.x - 320, y: confirmPosition.y - 40 });

    upsertNode(flow, updatesStepId, {
      label: `Notification Consent (${lang.toUpperCase()})`,
      messageText: copy.updatesMessage,
      buttons: [
        { id: `grv_consent_updates_yes_${lang}`, text: copy.yesUpdates, type: 'quick_reply', nextStepId: confirmStepId },
        { id: `grv_consent_updates_no_${lang}`, text: copy.noUpdates, type: 'quick_reply', nextStepId: confirmStepId }
      ]
    }, { x: confirmPosition.x - 160, y: confirmPosition.y - 40 });

    upsertEdge(flow, {
      id: `e_${lang}_grv8`,
      source: `grv_evidence_${lang}`,
      target: dataStepId,
      sourceHandle: `skip_evidence_${lang}`,
      type: 'smoothstep'
    });

    upsertEdge(flow, {
      id: `e_${lang}_grv9`,
      source: `grv_upload_${lang}`,
      target: dataStepId,
      type: 'smoothstep'
    });

    upsertEdge(flow, {
      id: `e_${lang}_grv_consent_data_yes`,
      source: dataStepId,
      target: updatesStepId,
      sourceHandle: `grv_consent_data_yes_${lang}`,
      type: 'smoothstep'
    });

    upsertEdge(flow, {
      id: `e_${lang}_grv_consent_data_no`,
      source: dataStepId,
      target: menuStepId,
      sourceHandle: `grv_consent_data_no_${lang}`,
      type: 'smoothstep'
    });

    upsertEdge(flow, {
      id: `e_${lang}_grv_consent_updates_yes`,
      source: updatesStepId,
      target: confirmStepId,
      sourceHandle: `grv_consent_updates_yes_${lang}`,
      type: 'smoothstep'
    });

    upsertEdge(flow, {
      id: `e_${lang}_grv_consent_updates_no`,
      source: updatesStepId,
      target: confirmStepId,
      sourceHandle: `grv_consent_updates_no_${lang}`,
      type: 'smoothstep'
    });
  }

  await flow.save();
  console.log(`Patched grievance consent flow for ${flowId}`);
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
