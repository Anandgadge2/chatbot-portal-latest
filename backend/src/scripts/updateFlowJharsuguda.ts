import mongoose from 'mongoose';

async function updateFlow() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';
  console.log('Connecting to:', uri);
  await mongoose.connect(uri);
  const flows = mongoose.connection.collection('chatbotflows');

  const flowId = 'FLOW000007';
  const flow = await flows.findOne({ flowId });

  if (!flow) {
    console.error('Flow not found');
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log('Found flow, updating steps...');

  // 1. Add New Steps
  const cancelSteps = [
    {
      stepId: 'grv_cancel_msg_en',
      stepType: 'buttons',
      stepName: 'Grievance Cancelled (EN)',
      messageText: '❌ Your grievance request has been cancelled.\n\nYou can start again by typing *Hi* or clicking below.',
      buttons: [{ id: 'back_to_menu_en', title: '🔙 Main Menu', nextStepId: 'main_menu_en', action: 'next' }],
      expectedResponses: [{ type: 'button_click', value: 'back_to_menu_en', nextStepId: 'main_menu_en' }],
      position: { x: 3200, y: 1500 }
    },
    {
      stepId: 'grv_cancel_msg_hi',
      stepType: 'buttons',
      stepName: 'Grievance Cancelled (HI)',
      messageText: '❌ आपका शिकायत अनुरोध रद्द कर दिया गया है।\n\nआप *Hi* टाइप करके या नीचे क्लिक करके फिर से शुरू कर सकते हैं।',
      buttons: [{ id: 'back_to_menu_hi', title: '🔙 मुख्य मेनू', nextStepId: 'main_menu_hi', action: 'next' }],
      expectedResponses: [{ type: 'button_click', value: 'back_to_menu_hi', nextStepId: 'main_menu_hi' }],
      position: { x: 3200, y: 1600 }
    },
    {
      stepId: 'grv_cancel_msg_or',
      stepType: 'buttons',
      stepName: 'Grievance Cancelled (OR)',
      messageText: '❌ ଆପଣଙ୍କ ଅଭିଯୋଗ ଅନୁରୋଧ ବାତିଲ କରାଯାଇଛି |\n\nଆପଣ ପୁଣିଥରେ *Hi* ଟାଇପ୍ କରି କିମ୍ବା ତଳେ କ୍ଲିକ୍ କରି ଆରମ୍ଭ କରିପାରିବେ |',
      buttons: [{ id: 'back_to_menu_or', title: '🔙 ମୁଖ୍ୟ ମେନୁ', nextStepId: 'main_menu_or', action: 'next' }],
      expectedResponses: [{ type: 'button_click', value: 'back_to_menu_or', nextStepId: 'main_menu_or' }],
      position: { x: 3200, y: 1700 }
    }
  ];

  const aptCancelSteps = [
    {
      stepId: 'apt_cancel_msg_en',
      stepType: 'buttons',
      stepName: 'Appointment Cancelled (EN)',
      messageText: '❌ Your appointment request has been cancelled.\n\nYou can start again by typing *Hi* or clicking below.',
      buttons: [{ id: 'back_to_menu_en_apt', title: '🔙 Main Menu', nextStepId: 'main_menu_en', action: 'next' }],
      expectedResponses: [{ type: 'button_click', value: 'back_to_menu_en_apt', nextStepId: 'main_menu_en' }],
      position: { x: 3500, y: 1500 }
    },
    {
      stepId: 'apt_cancel_msg_hi',
      stepType: 'buttons',
      stepName: 'Appointment Cancelled (HI)',
      messageText: '❌ आपका अपॉइंटमेंट अनुरोध रद्द कर दिया गया है।\n\nआप *Hi* टाइप करके या नीचे क्लिक करके फिर से शुरू कर सकते हैं।',
      buttons: [{ id: 'back_to_menu_hi_apt', title: '🔙 मुख्य मेनू', nextStepId: 'main_menu_hi', action: 'next' }],
      expectedResponses: [{ type: 'button_click', value: 'back_to_menu_hi_apt', nextStepId: 'main_menu_hi' }],
      position: { x: 3500, y: 1600 }
    },
    {
      stepId: 'apt_cancel_msg_or',
      stepType: 'buttons',
      stepName: 'Appointment Cancelled (OR)',
      messageText: '❌ ଆପଣଙ୍କ ଆପଏଣ୍ଟମେଣ୍ଟ ଅନୁରୋଧ ବାତିଲ କରାଯାଇଛି |\n\nଆପଣ ପୁଣିଥରେ *Hi* ଟାଇପ୍ କରି କିମ୍ବା ତଳେ କ୍ଲିକ୍ କରି ଆରମ୍ଭ କରିପାରିବେ |',
      buttons: [{ id: 'back_to_menu_or_apt', title: '🔙 ମୁଖ୍ୟ ମେନୁ', nextStepId: 'main_menu_or', action: 'next' }],
      expectedResponses: [{ type: 'button_click', value: 'back_to_menu_or_apt', nextStepId: 'main_menu_or' }],
      position: { x: 3500, y: 1700 }
    }
  ];

  const existingStepIds = new Set(flow.steps.map((s: any) => s.stepId));
  const newStepsToAdd = [...cancelSteps, ...aptCancelSteps].filter(s => !existingStepIds.has(s.stepId));

  // 2. Update existing buttons
  const updatedSteps = flow.steps.map((step: any) => {
    if (step.stepId === 'grv_confirm_en') {
      step.buttons = step.buttons.map((b: any) => b.id === 'cancel_grv_en' ? { ...b, nextStepId: 'grv_cancel_msg_en' } : b);
      step.expectedResponses = step.expectedResponses.map((r: any) => r.value === 'cancel_grv_en' ? { ...r, nextStepId: 'grv_cancel_msg_en' } : r);
    } else if (step.stepId === 'grv_confirm_hi') {
      step.buttons = step.buttons.map((b: any) => b.id === 'cancel_grv_hi' ? { ...b, nextStepId: 'grv_cancel_msg_hi' } : b);
      step.expectedResponses = step.expectedResponses.map((r: any) => r.value === 'cancel_grv_hi' ? { ...r, nextStepId: 'grv_cancel_msg_hi' } : r);
    } else if (step.stepId === 'grv_confirm_or') {
      step.buttons = step.buttons.map((b: any) => b.id === 'cancel_grv_or' ? { ...b, nextStepId: 'grv_cancel_msg_or' } : b);
      step.expectedResponses = step.expectedResponses.map((r: any) => r.value === 'cancel_grv_or' ? { ...r, nextStepId: 'grv_cancel_msg_or' } : r);
    } else if (step.stepId === 'apt_confirm_en') {
      step.buttons = step.buttons.map((b: any) => b.id === 'cancel_apt_en' ? { ...b, nextStepId: 'apt_cancel_msg_en' } : b);
      step.expectedResponses = step.expectedResponses.map((r: any) => r.value === 'cancel_apt_en' ? { ...r, nextStepId: 'apt_cancel_msg_en' } : r);
    } else if (step.stepId === 'apt_confirm_hi') {
      step.buttons = step.buttons.map((b: any) => b.id === 'cancel_apt_hi' ? { ...b, nextStepId: 'apt_cancel_msg_hi' } : b);
      step.expectedResponses = step.expectedResponses.map((r: any) => r.value === 'cancel_apt_hi' ? { ...r, nextStepId: 'apt_cancel_msg_hi' } : r);
    } else if (step.stepId === 'apt_confirm_or') {
      step.buttons = step.buttons.map((b: any) => b.id === 'cancel_apt_or' ? { ...b, nextStepId: 'apt_cancel_msg_or' } : b);
      step.expectedResponses = step.expectedResponses.map((r: any) => r.value === 'cancel_apt_or' ? { ...r, nextStepId: 'apt_cancel_msg_or' } : r);
    }
    return step;
  });

  const finalSteps = [...updatedSteps, ...newStepsToAdd];

  // 3. Update Nodes
  const newNodes = newStepsToAdd.map(s => ({
    id: s.stepId,
    type: 'chatbotNode',
    data: { label: s.stepName, step: s },
    position: s.position
  }));
  
  const finalNodes = [...flow.nodes, ...newNodes];

  await flows.updateOne({ flowId }, { $set: { steps: finalSteps, nodes: finalNodes } });
  console.log('✅ Flow FLOW000007 updated successfully');
  await mongoose.disconnect();
}

updateFlow().catch(async (err) => {
  console.error('❌ Error updating flow:', err);
  await mongoose.disconnect();
  process.exit(1);
});
