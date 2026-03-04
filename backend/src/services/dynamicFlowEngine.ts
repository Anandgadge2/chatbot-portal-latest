import mongoose from 'mongoose';
import ChatbotFlow, { IFlowStep, IChatbotFlow } from '../models/ChatbotFlow';
import Grievance from '../models/Grievance';
import Appointment from '../models/Appointment';
import Department from '../models/Department';
import User from '../models/User';
import { sendWhatsAppMessage, sendWhatsAppButtons, sendWhatsAppList } from './whatsappService';
import { UserSession, updateSession } from './sessionService';
import { ActionService } from './actionService';
import { findDepartmentByCategory } from './departmentMapper';
import { GrievanceStatus, AppointmentStatus, UserRole } from '../config/constants';

/**
 * Pick the best-fit message text for the current session language.
 * Priority: step.messageTextTranslations[lang] → step.messageTextTranslations['en'] → step.messageText
 */
function getLocalText(step: IFlowStep, lang: string): string {
  const translations = (step as any).messageTextTranslations as Record<string, string> | undefined;
  if (translations) {
    if (translations[lang]) return translations[lang];
    if (translations['en']) return translations['en'];
  }
  return step.messageText || '';
}

/** Fallback UI strings used when no Flow step provides them (department list loading etc.) */
const UI_TEXT: Record<string, Record<string, string>> = {
  en: {
    select_dept: 'Select Department',
    view_dept: '🏢 View Departments',
    load_more: '⬇️ Load More',
    no_dept: '⚠️ No departments are set up for this service yet. Please contact the administrator.',
    upload_photo: '📷 Please upload the image or document now:',
    sub_dept_title: '🏢 *Sub-Department Selection*\n\nPlease select the relevant sub-department:',
    sub_dept_btn: 'View Sub-Depts'
  },
  hi: {
    select_dept: 'विभाग चुनें',
    view_dept: '🏢 विभाग देखें',
    load_more: '⬇️ और देखें',
    no_dept: '⚠️ इस सेवा के लिए कोई विभाग सेट नहीं किया गया है। कृपया प्रशासक से संपर्क करें।',
    upload_photo: '📷 कृपया अभी छवि या दस्तावेज़ अपलोड करें:',
    sub_dept_title: '🏢 *उप-विभाग चयन*\n\nकृपया संबंधित उप-विभाग चुनें:',
    sub_dept_btn: 'उप-विभाग देखें'
  },
  or: {
    select_dept: 'ବିଭାଗ ବାଛନ୍ତୁ',
    view_dept: '🏢 ବିଭାଗ ଦେଖନ୍ତୁ',
    load_more: '⬇️ ଅଧିକ ଦେଖନ୍ତୁ',
    no_dept: '⚠️ ଏହି ସେବା ପାଇଁ କୌଣସି ବିଭାଗ ସ୍ଥାପନ କରାଯାଇ ନାହିଁ। ଦୟାକରି ପ୍ରଶାସକଙ୍କ ସହ ଯୋଗାଯୋଗ କରନ୍ତୁ।',
    upload_photo: '📷 ଦୟାକରି ବର୍ତ୍ତମାନ ଛବି/ଦସ୍ତାବିଜ୍ ଅପଲୋଡ କରନ୍ତୁ:',
    sub_dept_title: '🏢 *ଉପ-ବିଭାଗ ଚୟନ*\n\nଦୟାକରି ସମ୍ବନ୍ଧିତ ଉପ-ବିଭାଗ ବାଛନ୍ତୁ:',
    sub_dept_btn: 'ଉପ-ବିଭାଗ ଦେଖନ୍ତୁ'
  },
  mr: {
    select_dept: 'विभाग निवडा',
    view_dept: '🏢 विभाग पहा',
    load_more: '⬇️ आणखी पहा',
    no_dept: '⚠️ या सेवेसाठी कोणताही विभाग सेट केलेला नाही. कृपया प्रशासकाशी संपर्क साधा.',
    upload_photo: '📷 कृपया आता प्रतिमा किंवा दस्तऐवज अपलोड करा:',
    sub_dept_title: '🏢 *उप-विभाग निवड*\n\nकृपया संबंधित उप-विभाग निवडा:',
    sub_dept_btn: 'उप-विभाग पहा'
  }
};

function ui(key: string, lang: string): string {
  return (UI_TEXT[lang] || UI_TEXT['en'])[key] || (UI_TEXT['en'][key] || key);
}

/**
 * Dynamic Flow Execution Engine
 * 
 * Executes customizable chatbot flows defined in the database
 * Supports multi-step conversations with branching logic
 */

export class DynamicFlowEngine {
  private flow: IChatbotFlow;
  private session: UserSession;
  private company: any;
  private userPhone: string;

  constructor(flow: IChatbotFlow, session: UserSession, company: any, userPhone: string) {
    this.flow = flow;
    this.session = session;
    this.company = company;
    this.userPhone = userPhone;
  }

  /**
   * Run the next step by nextStepId if it is set and different from current (avoids loops / same step repeat).
   */
  private async runNextStepIfDifferent(nextStepId: string | undefined, fromStepId: string): Promise<void> {
    const id = nextStepId && String(nextStepId).trim();
    if (!id) return;
    if (id === fromStepId) {
      console.warn(`⚠️ Skipping same step "${fromStepId}" to avoid repeat (nextStepId === current step)`);
      return;
    }
    await this.executeStep(id);
  }

  /**
   * Execute a specific step in the flow.
   * Auto-advances to nextStepId when the step does not require user input; same step is never repeated.
   */
  async executeStep(stepId: string, userInput?: string): Promise<void> {
    let step = this.flow.steps.find(s => s.stepId === stepId);
    // If not found, try base step ID (e.g. grievance_category_en -> grievance_category) so flows with single department step work
    if (!step && stepId && /_.+$/.test(stepId)) {
      const baseId = stepId.replace(/_[a-z]{2}$/i, ''); // e.g. grievance_category_en -> grievance_category
      step = this.flow.steps.find(s => s.stepId === baseId);
      if (step) {
        console.log(`   Using step "${baseId}" (requested "${stepId}" not found)`);
      }
    }
    if (!step) {
      console.error(`❌ Step ${stepId} not found in flow ${this.flow.flowId}`);
      console.error(`   Available steps: ${this.flow.steps.map(s => s.stepId).join(', ')}`);
      await this.sendErrorMessage();
      return;
    } 

    // FIX: Force stepType for misconfigured nodes (e.g. start nodes saved as message by old builder versions)
    if (step && step.stepId && (step.stepId.startsWith('start_') || step.stepId === 'start') && step.stepType !== 'start') {
      console.log(`🔧 Forcing stepType "start" for node ${step.stepId} (was ${step.stepType})`);
      step.stepType = 'start' as any;
    }

    // Avoid re-sending the same interactive step only when we have already sent it (e.g. buttonMapping/listMapping set for this step)
    const currentStepId = this.session.data?.currentStepId;
    const isInteractive = ['buttons', 'list', 'input'].includes(step.stepType);
    const alreadySentThisStep = currentStepId === stepId && isInteractive && userInput === undefined &&
      (step.stepType === 'buttons' ? (this.session.data?.buttonMapping && Object.keys(this.session.data.buttonMapping).length > 0)
        : step.stepType === 'list' ? (this.session.data?.listMapping && Object.keys(this.session.data.listMapping).length > 0)
        : step.stepType === 'input' ? !!this.session.data?.awaitingInput
        : false);
    if (alreadySentThisStep) {
      console.warn(`⚠️ Same step "${stepId}" (${step.stepType}) already sent; not repeating`);
      return;
    }

    console.log(`🔄 Executing step: ${step.stepName} (${step.stepType})`);

    try {
      switch (step.stepType) {
        case 'start':
          // Start node should not send any message, just advance to next step
          console.log(`⏭️ Start node detected, skipping to next step`);
          this.session.data.currentStepId = step.stepId;
          await updateSession(this.session);
          await this.runNextStepIfDifferent(step.nextStepId, step.stepId);
          break;
        
        case 'message':
          await this.executeMessageStep(step);
          break;
        
        case 'buttons':
          await this.executeButtonsStep(step);
          break;
        
        case 'list':
          await this.executeListStep(step);
          break;
        
        case 'input':
          await this.executeInputStep(step, userInput);
          break;
        
        case 'media':
          await this.executeMediaStep(step);
          break;
        
        case 'condition':
          await this.executeConditionStep(step);
          break;
        
        case 'api_call':
          await this.executeApiCallStep(step);
          break;
        
        case 'assign_department':
          await this.executeAssignDepartmentStep(step);
          break;
        
        case 'end':
          await this.executeEndStep(step);
          break;
        
      default:
        console.error(`❌ Unknown step type: ${step.stepType}`);
        await this.sendErrorMessage();
      }
    } catch (error: any) {
      console.error(`❌ Error executing step ${stepId}:`, error);
      console.error(`   Error details:`, {
        message: error.message,
        stack: error.stack,
        stepId,
        stepType: step?.stepType,
        flowId: this.flow.flowId
      });
      
      // Try to send error message
      try {
        await this.sendErrorMessage();
      } catch (sendError: any) {
        console.error(`❌ Failed to send error message:`, sendError);
        // Last resort: try to send a simple text message
        try {
          const { sendWhatsAppMessage } = await import('./whatsappService');
          await sendWhatsAppMessage(
            this.company,
            this.userPhone,
            '⚠️ We encountered an error. Please try again later or contact support.'
          );
        } catch (finalError: any) {
          console.error(`❌ Complete failure to send any message:`, finalError);
        }
      }
    }
  }

  /**
   * Execute message step - Send a simple text message
   * Special handling: grievance_category (or grievance_category_en etc.) loads departments; steps with buttons send buttons
   */
  private async executeMessageStep(step: IFlowStep): Promise<void> {
    // Special handling for department selection – load departments automatically
    if (step.stepId === 'grievance_category' || 
        (step.stepId && (step.stepId.startsWith('grievance_category_') || step.stepId.startsWith('grv_dept_')))) {
      await this.loadDepartmentsForGrievance(step);
      return;
    }

    // Special handling for track_result: fetch grievance or appointment by refNumber and set session.data for placeholders (status, assignedTo, remarks)
    if (step.stepId === 'track_result' || (step.stepId && step.stepId.startsWith('track_result_'))) {
      await this.loadTrackResultIntoSession();
    }

    // If step has buttons (e.g. language_selection saved as "message" from dashboard), send as buttons
    if (step.buttons && step.buttons.length > 0) {
      const lang = this.session.language || 'en';
      const message = this.replacePlaceholders(getLocalText(step, lang));
      const buttons = step.buttons.map(btn => ({ id: btn.id, title: (btn as any).titleTranslations?.[lang] || btn.title }));
      await sendWhatsAppButtons(this.company, this.userPhone, message, buttons);
      this.session.data.currentStepId = step.stepId;
      this.session.data.buttonMapping = {};
      step.buttons.forEach(btn => {
        if (btn.nextStepId) {
          this.session.data.buttonMapping[btn.id] = btn.nextStepId;
        }
      });
      await updateSession(this.session);
      return;
    }

    const message = this.replacePlaceholders(getLocalText(step, this.session.language || 'en'));

    // FIX: Avoid sending empty messages (would cause WhatsApp error #100)
    if (!message || message.trim() === '') {
      console.warn(`⚠️ Skipping empty message for step ${step.stepId}`);
      this.session.data.currentStepId = step.stepId;
      await updateSession(this.session);
      await this.runNextStepIfDifferent(step.nextStepId, step.stepId);
      return;
    }

    const msgLower = (step.messageText || '').toLowerCase();

    // Photo/media upload prompt: wait for user to send photo or skip (do NOT auto-advance)
    const isPhotoUploadPrompt =
      (step.stepId && /photo_upload|photo_upload_wait|grievance_photo_upload/i.test(step.stepId)) ||
      (msgLower.includes('send a photo') || msgLower.includes('send a document') || (msgLower.includes('upload') && msgLower.includes('photo')));
    if (isPhotoUploadPrompt && step.nextStepId) {
      await sendWhatsAppMessage(this.company, this.userPhone, message);
      this.session.data.currentStepId = step.stepId;
      this.session.data.awaitingMedia = {
        mediaType: 'image',
        optional: true,
        saveToField: 'media',
        nextStepId: step.nextStepId
      };
      await updateSession(this.session);
      return;
    }

    await sendWhatsAppMessage(this.company, this.userPhone, message);
    this.session.data.currentStepId = step.stepId;
    await updateSession(this.session);
    await this.runNextStepIfDifferent(step.nextStepId, step.stepId);
  }

  /**
   * Load and display departments for grievance flow
   * Updated to only show top-level departments initially
   */
  private async loadDepartmentsForGrievance(step: IFlowStep): Promise<void> {
    const lang = this.session.language || 'en';
    try {
      const Department = (await import('../models/Department')).default;
      
      console.log(`🏬 Loading top-level departments for company: ${this.company._id}`);
      
      // Get ALL departments for this company first to determine structure
      let allDepts = await Department.find({ 
        companyId: this.company._id, 
        isActive: true 
      });

      // Check if hierarchical departments module is enabled
      const hierarchicalEnabled = this.company.enabledModules?.includes('HIERARCHICAL_DEPARTMENTS');
      
      let departments = allDepts;
      
      if (hierarchicalEnabled) {
        // Filter for top-level departments (no parent) only if module is enabled
        departments = allDepts.filter((d: any) => !d.parentDepartmentId);

        // Fallback: if no hierarchy is defined, show all
        if (departments.length === 0 && allDepts.length > 0) {
          console.warn(`⚠️ Hierarchical Departments enabled but no top-level departments found for company ${this.company._id}. Falling back to all departments.`);
          departments = allDepts;
        }
      }
      
      console.log(`📊 Found ${departments.length} top-level department(s)`);
      
      if (departments.length === 0) {
        await sendWhatsAppMessage(this.company, this.userPhone, ui('no_dept', lang));
        
        // Auto-advance to next step (never repeat same step)
        await this.runNextStepIfDifferent(step.nextStepId, step.stepId);
        return;
      }
      
      // Initialize department offset if not set
      if (!this.session.data.deptOffset) {
        this.session.data.deptOffset = 0;
      }
      
      const offset = this.session.data.deptOffset || 0;
      const showLoadMore = departments.length > offset + 9;
      const deptRows = departments.slice(offset, offset + 9).map((dept: any) => {
        // Use department's Hindi/Odia/Marathi name if set and language matches; else fallback to central translation or name
        let displayName: string;
        if (lang === 'hi' && dept.nameHi && dept.nameHi.trim()) {
          displayName = dept.nameHi.trim();
        } else if (lang === 'or' && dept.nameOr && dept.nameOr.trim()) {
          displayName = dept.nameOr.trim();
        } else if (lang === 'mr' && dept.nameMr && dept.nameMr.trim()) {
          displayName = dept.nameMr.trim();
        } else {
          displayName = dept.name;
        }
        let displayDesc: string;
        if (lang === 'hi' && dept.descriptionHi && dept.descriptionHi.trim()) {
          displayDesc = dept.descriptionHi.trim();
        } else if (lang === 'or' && dept.descriptionOr && dept.descriptionOr.trim()) {
          displayDesc = dept.descriptionOr.trim();
        } else if (lang === 'mr' && dept.descriptionMr && dept.descriptionMr.trim()) {
          displayDesc = dept.descriptionMr.trim();
        } else {
          displayDesc = dept.description?.substring(0, 72) || '';
        }
        const prefix = (step.stepId && (step.stepId.startsWith('apt') || step.stepId.includes('appointment'))) ? 'apt' : 'grv';
        return {
          id: `${prefix}_dept_${dept._id}`,
          title: displayName.length > 24 ? displayName.substring(0, 21) + '...' : displayName,
          description: displayDesc.substring(0, 72)
        };
      });
      
      if (showLoadMore) {
        deptRows.push({
          id: 'grv_load_more',
          title: ui('load_more', lang),
          description: `${departments.length - offset - 9} more departments available`
        });
      }
      
      const sections = [{
        title: ui('select_dept', lang),
        rows: deptRows
      }];
      
      console.log(`📋 Sending top-level department list with ${deptRows.length} items (offset: ${offset})`);
      
      // Save step info and list mapping to session
      this.session.data.currentStepId = step.stepId;
      this.session.data.listMapping = {};
      const prefix = (step.stepId && (step.stepId.startsWith('apt') || step.stepId.includes('appointment'))) ? 'apt' : 'grv';
      deptRows.forEach((row: any) => {
        if (row.id.startsWith(`${prefix}_dept_`)) {
          // Map department selection to next step (will be intercepted in handleListSelection for sub-depts)
          this.session.data.listMapping[row.id] = step.nextStepId || (prefix === 'apt' ? 'appointment_date' : 'grievance_description');
        }
      });
      
      // Handle "Load More" button mapping
      if (showLoadMore) {
        this.session.data.listMapping['grv_load_more'] = step.stepId; // Stay on same step
      }
      
      await updateSession(this.session);
      
      try {
        const message = this.replacePlaceholders(getLocalText(step, lang) || ui('view_dept', lang));
        await sendWhatsAppList(
          this.company,
          this.userPhone,
          message,
          ui('view_dept', lang),
          sections
        );
      } catch (error) {
        console.error('❌ Failed to send list, falling back to buttons');
        // fallback logic...
      }
    } catch (error: any) {
      console.error('❌ Error loading departments for grievance:', error);
      await sendWhatsAppMessage(this.company, this.userPhone, ui('no_dept', this.session.language || 'en'));
    }
  }

  /**
   * Load and display sub-departments for a selected parent department
   * Works for both grievance and appointment flows (uses prefix from parent)
   */
  private async loadSubDepartmentsForGrievance(parentId: string, rowIdPrefix: string = 'grv'): Promise<void> {
    try {
      const Department = (await import('../models/Department')).default;
      const lang = this.session.language || 'en';
      
      console.log(`🏢 Loading sub-departments for parent: ${parentId} (Prefix: ${rowIdPrefix})`);
      
      const subDepartments = await Department.find({ 
        parentDepartmentId: parentId, 
        isActive: true 
      });

      // Special check: If the next flow node after the dept step explicitly handles sub-departments,
      // skip injecting our own dynamic sub-dept menu to avoid showing it twice.
      const stepForSubDeptCheck = this.flow.steps.find(s => s.stepId === this.session.data.currentStepId);
      if (stepForSubDeptCheck && stepForSubDeptCheck.nextStepId) {
        const nextStep = this.flow.steps.find(s => s.stepId === stepForSubDeptCheck.nextStepId);
        const isNextStepSubDept = nextStep && (
          (nextStep.listConfig as any)?.dynamicSource === 'sub-departments' ||
          (nextStep.listConfig as any)?.isDynamic === true
        );
        
        if (isNextStepSubDept) {
          console.log(`⏩ Next flow node is already a sub-dept node. Advancing directly to it instead of injecting menu.`);
          this.session.data.departmentId = parentId; // Ensure parent is saved
          await updateSession(this.session);
          await this.executeStep(stepForSubDeptCheck.nextStepId);
          return;
        }
      }

      if (subDepartments.length === 0) {
        console.warn(`⚠️ No sub-departments found for parent ${parentId}. Proceeding.`);
        return;
      }

      const rows = subDepartments.map((dept: any) => {
        let displayName: string;
        if (lang === 'hi' && dept.nameHi && dept.nameHi.trim()) {
          displayName = dept.nameHi.trim();
        } else if (lang === 'or' && dept.nameOr && dept.nameOr.trim()) {
          displayName = dept.nameOr.trim();
        } else if (lang === 'mr' && dept.nameMr && dept.nameMr.trim()) {
          displayName = dept.nameMr.trim();
        } else {
          displayName = dept.name;
        }

        let displayDesc: string;
        if (lang === 'hi' && dept.descriptionHi && dept.descriptionHi.trim()) {
          displayDesc = dept.descriptionHi.trim();
        } else if (lang === 'or' && dept.descriptionOr && dept.descriptionOr.trim()) {
          displayDesc = dept.descriptionOr.trim();
        } else if (lang === 'mr' && dept.descriptionMr && dept.descriptionMr.trim()) {
          displayDesc = dept.descriptionMr.trim();
        } else {
          displayDesc = (dept.description || '').substring(0, 72);
        }

        return {
          id: `${rowIdPrefix}_sub_dept_${dept._id}`,
          title: displayName.length > 24 ? displayName.substring(0, 21) + '...' : displayName,
          description: displayDesc
        };
      });

      const sections = [{
        title: ui('select_dept', lang),
        rows: rows
      }];

      // Update list mapping for sub-departments — reuse stepForSubDeptCheck
      const subDeptMappingStep = this.flow.steps.find(s => s.stepId === this.session.data.currentStepId);
      this.session.data.listMapping = {};
      rows.forEach((row: any) => {
        this.session.data.listMapping[row.id] = subDeptMappingStep?.nextStepId || (rowIdPrefix === 'apt' ? 'appointment_date' : 'grievance_description');
      });
      await updateSession(this.session);

      await sendWhatsAppList(
        this.company,
        this.userPhone,
        ui('sub_dept_title', lang),
        ui('sub_dept_btn', lang),
        sections
      );
    } catch (error: any) {
      console.error('❌ Error loading sub-departments:', error);
    }
  }

  /**
   * Execute buttons step - Send message with buttons
   */
  private async executeButtonsStep(step: IFlowStep): Promise<void> {
    if (!step.buttons || step.buttons.length === 0) {
      console.error('❌ Buttons step has no buttons defined');
      return;
    }

    const lang = this.session.language || 'en';
    const message = this.replacePlaceholders(getLocalText(step, lang));
    const buttons = step.buttons.map(btn => ({
      id: btn.id,
      title: (btn as any).titleTranslations?.[lang] || btn.title
    }));

    await sendWhatsAppButtons(this.company, this.userPhone, message, buttons);
    
    // Save button step info to session for handling response
    this.session.data.currentStepId = step.stepId;
    this.session.data.buttonMapping = {};
    step.buttons.forEach(btn => {
      if (btn.nextStepId) {
        this.session.data.buttonMapping[btn.id] = btn.nextStepId;
      }
    });
    
    // ✅ CRITICAL: Save session after creating button mapping
    await updateSession(this.session);
  }

  /**
   * Execute list step - Send WhatsApp list (manual sections or dynamic departments)
   */
  private async executeListStep(step: IFlowStep): Promise<void> {
    if (!step.listConfig) {
      console.error('❌ List step has no list configuration');
      return;
    }

    // Check if we should load departments dynamically
    const isDynamicDepartments = 
      step.listConfig.listSource === 'departments' || 
      (step.listConfig as any).dynamicSource === 'departments' ||
      (step.listConfig as any).isDynamic === true;

    if (isDynamicDepartments) {
      await this.loadDepartmentsForListStep(step);
      return;
    }

    const lang = this.session.language || 'en';
    const message = this.replacePlaceholders(getLocalText(step, lang));
    
    // Map sections and rows to their translated versions
    const translatedSections = (step.listConfig.sections || []).map(section => ({
      title: section.title, // Section titles don't have translations in schema yet, adding if needed or just using default
      rows: section.rows.map(row => ({
        id: row.id,
        title: (row as any).titleTranslations?.[lang] || row.title,
        description: (row as any).descriptionTranslations?.[lang] || row.description,
        nextStepId: row.nextStepId
      }))
    }));

    await sendWhatsAppList(
      this.company,
      this.userPhone,
      message,
      step.listConfig.buttonText,
      translatedSections
    );

    this.session.data.currentStepId = step.stepId;
    this.session.data.listMapping = {};
    translatedSections.forEach(section => {
      section.rows.forEach(row => {
        if (row.nextStepId) {
          this.session.data.listMapping[row.id] = row.nextStepId;
        }
      });
    });
    await updateSession(this.session);
  }

  /**
   * Load departments from DB and send as list (for list steps with listSource: 'departments')
   */
  private async loadDepartmentsForListStep(step: IFlowStep): Promise<void> {
    const lang = this.session.language || 'en';
    try {
      const Department = (await import('../models/Department')).default;

      // Get ALL departments for this company first
      let allDepts = await Department.find({
        companyId: this.company._id,
        isActive: true
      });

      if (allDepts.length === 0) {
        console.warn(`⚠️ No departments found for ObjectId companyId: ${this.company._id}. Trying string comparison...`);
        allDepts = await Department.find({
          companyId: this.company._id.toString(),
          isActive: true
        });
      }

      // Check if hierarchical departments module is enabled
      const hierarchicalEnabled = this.company.enabledModules?.includes('HIERARCHICAL_DEPARTMENTS');
      
      let departments = allDepts;
      
      if (hierarchicalEnabled) {
        // Filter for top-level departments (no parent) only if module is enabled
        departments = allDepts.filter((d: any) => !d.parentDepartmentId);

        // Fallback: if no hierarchy is defined, show all
        if (departments.length === 0 && allDepts.length > 0) {
          console.warn(`⚠️ Hierarchical Departments enabled but no top-level departments found for company ${this.company._id}. Falling back to all departments.`);
          departments = allDepts;
        }
      }

      if (departments.length === 0) {
        await sendWhatsAppMessage(this.company, this.userPhone, ui('no_dept', lang));
        await this.runNextStepIfDifferent(step.nextStepId, step.stepId);
        return;
      }

      const offset = this.session.data.deptOffset || 0;
      
      const deptRows = departments.slice(offset, offset + 9).map((dept: any) => {
        let displayName: string;
        if (lang === 'hi' && dept.nameHi && dept.nameHi.trim()) {
          displayName = dept.nameHi.trim();
        } else if (lang === 'or' && dept.nameOr && dept.nameOr.trim()) {
          displayName = dept.nameOr.trim();
        } else if (lang === 'mr' && dept.nameMr && dept.nameMr.trim()) {
          displayName = dept.nameMr.trim();
        } else {
          displayName = dept.name;
        }
        let displayDesc: string;
        if (lang === 'hi' && dept.descriptionHi && dept.descriptionHi.trim()) {
          displayDesc = dept.descriptionHi.trim();
        } else if (lang === 'or' && dept.descriptionOr && dept.descriptionOr.trim()) {
          displayDesc = dept.descriptionOr.trim();
        } else if (lang === 'mr' && dept.descriptionMr && dept.descriptionMr.trim()) {
          displayDesc = dept.descriptionMr.trim();
        } else {
          displayDesc = (dept.description || '').substring(0, 72);
        }

        const prefix = (step.stepId && (step.stepId.startsWith('apt') || step.stepId.includes('appointment'))) ? 'apt' : 'grv';
        return {
          id: `${prefix}_dept_${dept._id}`,
          title: displayName.length > 24 ? displayName.substring(0, 21) + '...' : displayName,
          description: displayDesc,
          nextStepId: step.nextStepId
        }; 
      });

      if (departments.length > offset + 9) {
        deptRows.push({
          id: 'grv_load_more',
          title: ui('load_more', lang),
          description: 'Show more departments...',
          nextStepId: step.stepId
        });
      }

      const listConfig = step.listConfig!;
      const sections = [{
        title: listConfig.buttonText || ui('select_dept', lang),
        rows: deptRows
      }];

      const message = this.replacePlaceholders(getLocalText(step, lang) || ui('view_dept', lang));
      await sendWhatsAppList(this.company, this.userPhone, message, listConfig.buttonText || ui('view_dept', lang), sections);

      this.session.data.currentStepId = step.stepId;
      this.session.data.listMapping = {};
      deptRows.forEach((row: any) => {
        this.session.data.listMapping[row.id] = row.nextStepId || step.nextStepId;
      });
      await updateSession(this.session);
    } catch (error: any) {
      console.error('❌ Error loading departments for list step:', error);
      await sendWhatsAppMessage(this.company, this.userPhone, ui('no_dept', this.session.language || 'en'));
    }
  }

  /**
   * Execute input step - Request user input
   * For image/document/video we wait for actual media (or skip keyword); text does not advance.
   */
  private async executeInputStep(step: IFlowStep, userInput?: string): Promise<void> {
    if (!step.inputConfig) {
      console.error('❌ Input step has no input configuration');
      return;
    }

    const isMediaInput = ['image', 'document', 'video', 'file'].includes(step.inputConfig.inputType);

    // If no user input yet, send the prompt
    if (!userInput) {
      const lang = this.session.language || 'en';
      const message = this.replacePlaceholders(getLocalText(step, lang) || 'Please provide your input:');
      await sendWhatsAppMessage(this.company, this.userPhone, message);

      this.session.data.currentStepId = step.stepId;
      if (isMediaInput) {
        // Wait for actual media (or skip); do not advance on text
        // 'file' type maps to 'document' for WhatsApp media handling
        const mediaType = (step.inputConfig.inputType === 'file' ? 'document' : step.inputConfig.inputType) as 'image' | 'document' | 'video';
        this.session.data.awaitingMedia = {
          mediaType,
          optional: !step.inputConfig.validation?.required,
          saveToField: step.inputConfig.saveToField || 'media',
          nextStepId: step.inputConfig.nextStepId || step.nextStepId
        };
        delete this.session.data.awaitingInput;
      } else {
        this.session.data.awaitingInput = {
          type: step.inputConfig.inputType,
          saveToField: step.inputConfig.saveToField,
          validation: step.inputConfig.validation,
          nextStepId: step.inputConfig.nextStepId
        };
      }
      await updateSession(this.session);
      return;
    }

    // For media input types, text is not valid input – only media or skip advances (handled in chatbotEngine)
    if (isMediaInput) {
      const skipKeywords = ['back', 'skip', 'cancel', 'no', 'no thanks', 'continue without', 'without photo', 'na', 'n/a'];
      const textLower = (userInput || '').trim().toLowerCase();
      const isSkip = skipKeywords.some(k => textLower === k || textLower.includes(k));
      if (isSkip) {
        const nextStepId = step.inputConfig.nextStepId || step.nextStepId;
        delete this.session.data.awaitingMedia;
        delete this.session.data.awaitingInput;
        await updateSession(this.session);
        if (nextStepId) await this.runNextStepIfDifferent(nextStepId, step.stepId);
      } else {
        const reminder = ui('upload_photo', this.session.language || 'en') + '\n\n_Type *back* or *skip* to continue without uploading._';
        await sendWhatsAppMessage(this.company, this.userPhone, reminder);
      }
      return;
    }

    // Validate user input (text/number/email etc.)
    const validation = step.inputConfig.validation;
    if (validation) {
      if (validation.required && !userInput) {
        await sendWhatsAppMessage(
          this.company,
          this.userPhone,
          validation.errorMessage || 'This field is required.'
        );
        return;
      }

      if (validation.minLength && userInput.length < validation.minLength) {
        await sendWhatsAppMessage(
          this.company,
          this.userPhone,
          `Input must be at least ${validation.minLength} characters.`
        );
        return;
      }

      if (validation.maxLength && userInput.length > validation.maxLength) {
        await sendWhatsAppMessage(
          this.company,
          this.userPhone,
          `Input must not exceed ${validation.maxLength} characters.`
        );
        return;
      }

      if (validation.pattern) {
        const regex = new RegExp(validation.pattern);
        if (!regex.test(userInput)) {
          await sendWhatsAppMessage(
            this.company,
            this.userPhone,
            validation.errorMessage || 'Invalid input format.'
          );
          return;
        }
      }
    }

    // Save user input to session
    if (step.inputConfig.saveToField) {
      this.session.data[step.inputConfig.saveToField] = userInput;
    }
    // Clear awaitingInput so next message is not treated as input for this step
    delete this.session.data.awaitingInput;
    await updateSession(this.session);

    // Auto-advance: use inputConfig.nextStepId, or fallback to step's default nextStepId (flow builder "Default Next Step")
    let nextStepId = step.inputConfig?.nextStepId || step.nextStepId;
    if (!nextStepId) {
      // Fallback: infer next step for known grievance/input patterns (handles old flows or missing config)
      const lang = (this.session.language || 'en') as string;
      const suffix = lang === 'en' ? '_en' : lang === 'hi' ? '_hi' : lang === 'or' ? '_or' : lang === 'mr' ? '_mr' : '_en';
      const candidates =
        step.stepId === 'grievance_name' || step.inputConfig?.saveToField === 'citizenName'
          ? [`grievance_category${suffix}`, 'grievance_category']
          : step.stepId === 'grievance_start'
          ? ['grievance_name']
          : [];
      for (const candidate of candidates) {
        if (this.flow.steps.some((s) => s.stepId === candidate)) {
          nextStepId = candidate;
          console.log(`📤 Input step "${step.stepId}" fallback nextStepId: ${nextStepId}`);
          break;
        }
      }
    }
    console.log(`📤 Input step "${step.stepId}" done. nextStepId: ${nextStepId || '(none)'}`);
    if (!nextStepId) {
      console.warn(`⚠️ Input step "${step.stepId}" has no next step configured. Set "Default Next Step" or "Next Step ID (when this response is received)" in the flow builder (e.g. grievance_category_en).`);
    }
    await this.runNextStepIfDifferent(nextStepId, step.stepId);
  }

  /**
   * Execute media step - Handle media upload/download
   */
  private async executeMediaStep(step: IFlowStep): Promise<void> {
    if (!step.mediaConfig) {
      console.error('❌ Media step has no media configuration');
      return;
    }

    const lang = this.session.language || 'en';
    const message = this.replacePlaceholders(getLocalText(step, lang) || 'Please upload media:');
    await sendWhatsAppMessage(this.company, this.userPhone, message);

    // Save media step info to session
    this.session.data.currentStepId = step.stepId;
    this.session.data.awaitingMedia = {
      mediaType: step.mediaConfig.mediaType,
      optional: step.mediaConfig.optional,
      saveToField: step.mediaConfig.saveToField,
      nextStepId: step.mediaConfig.nextStepId
    };
    await updateSession(this.session);
  }

  /**
   * Execute condition step - Branching logic
   */
  private async executeConditionStep(step: IFlowStep): Promise<void> {
    if (!step.conditionConfig) {
      console.error('❌ Condition step has no condition configuration');
      return;
    }

    const { field, operator, value, trueStepId, falseStepId } = step.conditionConfig;
    const fieldValue = this.session.data[field];

    let conditionMet = false;

    switch (operator) {
      case 'equals':
        conditionMet = fieldValue === value;
        break;
      case 'contains':
        conditionMet = String(fieldValue).includes(String(value));
        break;
      case 'greater_than':
        conditionMet = Number(fieldValue) > Number(value);
        break;
      case 'less_than':
        conditionMet = Number(fieldValue) < Number(value);
        break;
      case 'exists':
        conditionMet = fieldValue !== undefined && fieldValue !== null;
        break;
    }

    const nextStepId = conditionMet ? trueStepId : falseStepId;
    await this.runNextStepIfDifferent(nextStepId, step.stepId);
  }

  /**
   * Execute API call step - Make external API calls
   * Special handling for availability API to generate dynamic buttons
   */
  private async executeApiCallStep(step: IFlowStep): Promise<void> {
    if (!step.apiConfig) {
      console.error('❌ API call step has no API configuration');
      return;
    }

    try {
      const { method, endpoint, headers, body, saveResponseTo, nextStepId } = step.apiConfig;

      // Build URL with query parameters for GET requests (replace placeholders in body values e.g. {appointmentDate})
      let url = this.replacePlaceholders(endpoint);
      if (method === 'GET' && body) {
        const queryParams = new URLSearchParams();
        Object.keys(body).forEach(key => {
          if (body[key] !== null && body[key] !== undefined) {
            const value = typeof body[key] === 'string' ? this.replacePlaceholders(body[key]) : body[key].toString();
            queryParams.append(key, value);
          }
        });
        if (queryParams.toString()) {
          url += (url.includes('?') ? '&' : '?') + queryParams.toString();
        }
      }

      // Make API call using built-in fetch (Node.js 18+) or axios
      let fetchFn: any;
      try {
        // Try to use global fetch (Node.js 18+)
        if (typeof fetch !== 'undefined') {
          fetchFn = fetch;
        } else {
          // Fallback to axios if available
          const axios = (await import('axios')).default;
          fetchFn = async (url: string, options: any) => {
            const response = await axios({
              url,
              method: options.method || 'GET',
              headers: options.headers || {},
              data: options.body ? JSON.parse(options.body) : undefined
            });
            return {
              json: async () => response.data,
              status: response.status,
              ok: response.status >= 200 && response.status < 300
            };
          };
        }
      } catch (error) {
        console.error('❌ Failed to load fetch or axios:', error);
        throw new Error('API call functionality not available');
      }
      
      const options: any = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      if (body && method !== 'GET') {
        const bodyStr = JSON.stringify(body);
        options.body = this.replacePlaceholders(bodyStr);
      }

      // Replace placeholders in URL (e.g., {companyId})
      url = this.replacePlaceholders(url);
      // Node fetch needs absolute URL for same-server API calls
      if (url.startsWith('/')) {
        const base = process.env.API_BASE_URL || process.env.BASE_URL || `http://localhost:${process.env.PORT || 5001}`;
        url = base.replace(/\/$/, '') + url;
      }
      console.log(`🌐 Making API call: ${method} ${url}`);
      const response = await fetchFn(url, options);
      const data = await response.json();

      // Save response to session if needed
      if (saveResponseTo) {
        this.session.data[saveResponseTo] = data;
      }

      // Special handling for availability API - generate buttons dynamically
      if (endpoint.includes('/availability/chatbot/') && data.success && data.data) {
        const availabilityData = data.data;
        
        // If it's a date selection (availableDates array)
        if (availabilityData.availableDates && Array.isArray(availabilityData.availableDates)) {
          const dates = availabilityData.availableDates;
          const buttons = dates.slice(0, 3).map((date: any, index: number) => ({
            id: `date_${date.date}`,
            title: date.formattedDate || date.date
          }));
          
          if (buttons.length > 0) {
            const message = this.replacePlaceholders(step.messageText || '📅 Please select a date:');
            await sendWhatsAppButtons(this.company, this.userPhone, message, buttons);
            
            // Save date mapping and next step so chatbot can advance on button click
            this.session.data.currentStepId = step.stepId;
            this.session.data.availabilityNextStepId = nextStepId || null;
            this.session.data.dateMapping = {};
            dates.forEach((date: any) => {
              this.session.data.dateMapping[`date_${date.date}`] = date.date;
            });
            await updateSession(this.session);
            return;
          }
        }
        
        // If it's a time slot selection (formattedTimeSlots array)
        if (availabilityData.formattedTimeSlots && Array.isArray(availabilityData.formattedTimeSlots)) {
          const timeSlots = availabilityData.formattedTimeSlots;
          const buttons = timeSlots.slice(0, 3).map((slot: any, index: number) => ({
            id: `time_${slot.time}`,
            title: slot.label || slot.time
          }));
          
          if (buttons.length > 0) {
            const message = this.replacePlaceholders(step.messageText || '⏰ Please select a time:');
            await sendWhatsAppButtons(this.company, this.userPhone, message, buttons);
            
            // Save time mapping and next step so chatbot can advance on button click
            this.session.data.currentStepId = step.stepId;
            this.session.data.availabilityNextStepId = nextStepId || null;
            this.session.data.timeMapping = {};
            timeSlots.forEach((slot: any) => {
              this.session.data.timeMapping[`time_${slot.time}`] = slot.time;
            });
            await updateSession(this.session);
            return;
          }
        }
      }

      // Auto-advance to next step (never repeat same step)
      await this.runNextStepIfDifferent(nextStepId, step.stepId);
    } catch (error) {
      console.error('❌ API call failed:', error);
      await this.sendErrorMessage();
    }
  }

  /**
   * Execute assign department step - Forcibly set department in session
   */
  private async executeAssignDepartmentStep(step: IFlowStep): Promise<void> {
    const config = (step as any).assignDepartmentConfig;
    if (!config) {
      console.warn('⚠️ Assign department step has no config; skipping');
      await this.runNextStepIfDifferent(step.nextStepId, step.stepId);
      return;
    }

    let departmentId = config.departmentId;
    if (config.isDynamic && config.conditionField) {
      departmentId = this.session.data[config.conditionField];
    }

    if (departmentId) {
      try {
        const Department = (await import('../models/Department')).default;
        const dept = await Department.findById(departmentId);
        if (dept) {
          const lang = this.session.language || 'en';
          let localizedName = dept.name;
          if (lang === 'hi' && dept.nameHi) localizedName = dept.nameHi;
          else if (lang === 'or' && dept.nameOr) localizedName = dept.nameOr;
          else if (lang === 'mr' && dept.nameMr) localizedName = dept.nameMr;

          this.session.data.departmentId = departmentId;
          this.session.data.departmentName = localizedName;
          this.session.data.category = dept.name; // Use original name for category mapping if needed
          await updateSession(this.session);
          console.log(`✅ Assigned department: ${localizedName} (${departmentId})`);
        }
      } catch (err) {
        console.error('❌ Error in executeAssignDepartmentStep:', err);
      }
    }

    await this.runNextStepIfDifferent(step.nextStepId, step.stepId);
  }

  /**
   * Execute end step - Send final message and optionally clear session
   */
  private async executeEndStep(step: IFlowStep): Promise<void> {
    const lang = this.session.language || 'en';
    const message = this.replacePlaceholders(getLocalText(step, lang));
    
    if (message && message.trim()) {
      await sendWhatsAppMessage(this.company, this.userPhone, message);
    }

    const clearSessionFlag = (step as any).endConfig?.clearSession || (step as any).clearSession;
    if (clearSessionFlag) {
      console.log(`🧹 Clearing session for user ${this.userPhone}`);
      this.session.data = { currentStepId: 'start' };
      await updateSession(this.session);
    }
  }

  /**
   * Load grievance or appointment by refNumber into session.data for track_result step placeholders (status, assignedTo, remarks, recordType)
   */
  private async loadTrackResultIntoSession(): Promise<void> {
    const ref = (this.session.data.refNumber || '').trim().toUpperCase();
    if (!ref) return;
    try {
      if (ref.startsWith('GRV')) {
        const grievance = await Grievance.findOne({
          companyId: this.company._id,
          grievanceId: ref
        }).populate('assignedTo', 'name');
        if (grievance) {
          this.session.data.recordType = 'Grievance';
          this.session.data.status = grievance.status;
          const lastHistory = grievance.statusHistory && grievance.statusHistory.length > 0
            ? grievance.statusHistory[grievance.statusHistory.length - 1]
            : null;
          this.session.data.remarks = (lastHistory as any)?.remarks ?? (grievance as any).remarks ?? '—';
          this.session.data.assignedTo = (grievance as any).assignedTo?.name ?? (grievance as any).assignedTo ?? 'Not assigned';
          await updateSession(this.session);
        } else {
          this.session.data.status = 'Not Found';
          this.session.data.assignedTo = '—';
          this.session.data.remarks = 'No record found for this reference number.';
          this.session.data.recordType = '—';
        }
      } else if (ref.startsWith('APT')) {
        const appointment = await Appointment.findOne({
          companyId: this.company._id,
          appointmentId: ref
        }).populate('assignedTo', 'name');
        if (appointment) {
          this.session.data.recordType = 'Appointment';
          this.session.data.status = appointment.status;
          const lastHistory = appointment.statusHistory && appointment.statusHistory.length > 0
            ? appointment.statusHistory[appointment.statusHistory.length - 1]
            : null;
          this.session.data.remarks = (lastHistory as any)?.remarks ?? (appointment as any).remarks ?? '—';
          this.session.data.assignedTo = (appointment as any).assignedTo?.name ?? (appointment as any).assignedTo ?? 'Not assigned';
          await updateSession(this.session);
        } else {
          this.session.data.status = 'Not Found';
          this.session.data.assignedTo = '—';
          this.session.data.remarks = 'No record found for this reference number.';
          this.session.data.recordType = '—';
        }
      } else {
        this.session.data.status = 'Invalid';
        this.session.data.assignedTo = '—';
        this.session.data.remarks = 'Reference number should start with GRV (grievance) or APT (appointment).';
        this.session.data.recordType = '—';
      }
    } catch (err: any) {
      console.error('❌ Error loading track result:', err);
      this.session.data.status = 'Error';
      this.session.data.assignedTo = '—';
      this.session.data.remarks = 'Could not fetch status. Please try again.';
      this.session.data.recordType = '—';
    }
  }

  /**
   * Replace placeholders in message templates
   * Example: "Hello {citizenName}, your ticket is {ticketId}"
   * Dynamic values come from session.data (set by backend when creating grievance/appointment or from API step for track).
   */
  private replacePlaceholders(template: string): string {
    let message = template;

    // Build comprehensive replacement map from session data
    const sessionData = this.session.data;

    // Handle confirmation message department/sub-dept formatting
    const deptDisplay = sessionData.departmentName || sessionData.category || '';
    const subDeptDisplay = sessionData.subDepartmentName || '';

    // Replace session data placeholders (flat keys from session)
    const placeholderRegex = /\{([^}]+)\}/g;
    message = message.replace(placeholderRegex, (match, key) => {
      const val = sessionData[key];
      return val != null && val !== '' ? String(val) : match;
    });

    // Replace special placeholders that may not be in session.data directly
    message = message.replace(/\{id\}/g, sessionData.id || sessionData.grievanceId || sessionData.appointmentId || sessionData.leadId || '{id}');
    message = message.replace(/\{date\}/g, sessionData.date ?? new Date().toLocaleDateString('en-IN'));
    message = message.replace(/\{time\}/g, sessionData.time ?? new Date().toLocaleTimeString('en-IN'));
    message = message.replace(/\{companyName\}/g, this.company.name);
    // Extra aliases used in confirmation steps
    message = message.replace(/\{department\}/g, deptDisplay);
    message = message.replace(/\{subDepartment\}/g, subDeptDisplay);
    message = message.replace(/\{subDepartmentName\}/g, subDeptDisplay);
    message = message.replace(/\{description\}/g, sessionData.description || '');
    message = message.replace(/\{citizenName\}/g, sessionData.citizenName || '');
    message = message.replace(/\{websiteUrl\}/g, this.company.website || 'Digital Portal');
    message = message.replace(/\{companyAddress\}/g, this.company.address || 'Office Headquarters');
    message = message.replace(/\{helplineNumber\}/g, this.company.helplineNumber || 'For support, reply Help');
    // Remove any remaining unresolved placeholders that would look ugly to the user
    message = message.replace(/\{[a-zA-Z_]+\}/g, '');

    return message;
  }

  /**
   * Send error message
   */
  private async sendErrorMessage(): Promise<void> {
    const errorMessage = this.flow.settings.errorFallbackMessage || 
                        'We encountered an error. Please try again.';
    
    await sendWhatsAppMessage(this.company, this.userPhone, errorMessage);
  }

  /**
   * Handle button click
   */
  async handleButtonClick(buttonId: string): Promise<void> {
    console.log(`🔘 Handling button click: ${buttonId} in step: ${this.session.data.currentStepId}`);
    console.log(`   Flow ID: ${this.flow.flowId}, Flow Name: ${this.flow.flowName}`);
    
    // Get current step
    const currentStep = this.flow.steps.find(s => s.stepId === this.session.data.currentStepId);
    if (!currentStep) {
      console.error(`❌ Current step ${this.session.data.currentStepId} not found`);
      console.error(`   Available steps: ${this.flow.steps.map(s => s.stepId).join(', ')}`);
      await this.sendErrorMessage();
      return;
    }

    console.log(`   Current step: ${currentStep.stepId} (${currentStep.stepType})`);
    console.log(`   Expected responses: ${JSON.stringify(currentStep.expectedResponses)}`);
    console.log(`   Button mapping: ${JSON.stringify(this.session.data.buttonMapping)}`);
    console.log(`   Default nextStepId: ${currentStep.nextStepId}`);

    // ✅ FIRST: Check expectedResponses for button_click type
    if (currentStep.expectedResponses && currentStep.expectedResponses.length > 0) {
      const matchingResponse = currentStep.expectedResponses.find(
        (resp) => resp.type === 'button_click' && resp.value === buttonId
      );
      
      if (matchingResponse) {
        console.log(`✅ Found expected response match: ${buttonId} → ${matchingResponse.nextStepId || 'NO NEXT STEP (will use fallback)'}`);
        
        // Handle language buttons specially - set language in session
        if (buttonId === 'lang_en' || buttonId === 'lang_hi' || buttonId === 'lang_mr' || buttonId === 'lang_or') {
          if (buttonId === 'lang_en') {
            this.session.language = 'en';
          } else if (buttonId === 'lang_hi') {
            this.session.language = 'hi';
          } else if (buttonId === 'lang_mr') {
            this.session.language = 'mr';
          } else if (buttonId === 'lang_or') {
            this.session.language = 'or';
          }
          console.log(`   Language set to: ${this.session.language}`);
          await updateSession(this.session);
        }
        
        // Use nextStepId from expectedResponse, or fallback to step's default; auto-advance without repeating same step
        const nextStepId = matchingResponse.nextStepId || currentStep.nextStepId;
        if (!nextStepId) {
          console.error(`❌ No nextStepId found for button ${buttonId}. Expected response has no nextStepId and step has no default nextStepId.`);
          await this.sendErrorMessage();
          return;
        }
        console.log(`   Executing next step: ${nextStepId}`);

        // ---- Detect which action to trigger ----
        // Grievance confirm step: any step whose ID contains 'confirm' and maps to a 'grv_success' or 'grievance_success' step
        const isGrievanceConfirm = (
          currentStep.stepId === 'grievance_confirm' ||
          currentStep.stepId?.startsWith('grievance_confirm_') ||
          currentStep.stepId?.startsWith('grv_conf_') ||
          currentStep.stepId?.startsWith('grv_confirm_')
        );
        const isGrievanceSuccess = (
          nextStepId === 'grievance_success' ||
          nextStepId?.startsWith('grievance_success') ||
          nextStepId?.startsWith('grv_success_')
        );
        // Appointment confirm step
        const isAppointmentConfirm = (
          currentStep.stepId === 'appointment_confirm' ||
          currentStep.stepId?.startsWith('appointment_confirm_') ||
          currentStep.stepId?.startsWith('apt_conf_') ||
          currentStep.stepId?.startsWith('apt_confirm_')
        );
        const isAppointmentSubmitted = (
          nextStepId === 'appointment_submitted' ||
          nextStepId?.startsWith('appointment_submitted') ||
          nextStepId?.startsWith('apt_success_')
        );
        // Lead confirm
        const isLeadConfirm = (
          currentStep.stepId === 'lead_confirm' ||
          currentStep.stepId?.startsWith('lead_confirm_') ||
          currentStep.stepId?.startsWith('lead_conf_')
        );
        const isLeadSuccess = (
          nextStepId === 'lead_success' ||
          nextStepId?.startsWith('lead_success')
        );

        // Detect SUBMIT button click (any submit/confirm-yes variant)
        const isSubmitClick = (
          buttonId === 'confirm_yes' ||
          String(buttonId).startsWith('confirm_yes') ||
          String(buttonId).startsWith('submit_grv') ||
          String(buttonId).startsWith('submit_grievance') ||
          buttonId === 'grv_confirm_yes'
        );
        const isApptSubmitClick = (
          buttonId === 'appt_confirm_yes' ||
          String(buttonId).startsWith('appt_confirm_yes') ||
          String(buttonId).startsWith('submit_apt') ||
          String(buttonId).startsWith('confirm_apt')
        );
        const isLeadSubmitClick = (
          buttonId === 'lead_confirm_yes' ||
          String(buttonId).startsWith('lead_confirm_yes') ||
          String(buttonId).startsWith('submit_lead')
        );

        if (isGrievanceConfirm && isGrievanceSuccess && isSubmitClick) {
          console.log(`🎯 Triggering createGrievance for button: ${buttonId}`);
          await ActionService.createGrievance(this.session, this.company, this.userPhone);
        } else if (isAppointmentConfirm && isAppointmentSubmitted && isApptSubmitClick) {
          console.log(`🎯 Triggering createAppointment for button: ${buttonId}`);
          await ActionService.createAppointment(this.session, this.company, this.userPhone);
        } else if (isLeadConfirm && isLeadSuccess && isLeadSubmitClick) {
          console.log(`🎯 Triggering createLead for button: ${buttonId}`);
          await ActionService.createLead(this.session, this.company, this.userPhone);
        }
        await this.runNextStepIfDifferent(nextStepId, currentStep.stepId);
        return;
      } else {
        console.log(`   No matching expected response found for button ${buttonId}`);
      }
    }

    // ✅ SECOND: Check buttonMapping (from button.nextStepId)
    const buttonMapping = this.session.data.buttonMapping || {};
    const nextStepIdFromMapping = buttonMapping[buttonId];
    if (nextStepIdFromMapping) {
      console.log(`✅ Found button mapping: ${buttonId} → ${nextStepIdFromMapping}`);
      
      // Handle language buttons specially
      if (buttonId === 'lang_en' || buttonId === 'lang_hi' || buttonId === 'lang_mr' || buttonId === 'lang_or') {
        if (buttonId === 'lang_en') {
          this.session.language = 'en';
        } else if (buttonId === 'lang_hi') {
          this.session.language = 'hi';
        } else if (buttonId === 'lang_mr') {
          this.session.language = 'mr';
        } else if (buttonId === 'lang_or') {
          this.session.language = 'or';
        }
        console.log(`   Language set to: ${this.session.language}`);
        await updateSession(this.session);
      }
      
      console.log(`   Executing next step from button mapping: ${nextStepIdFromMapping}`);
      // Also trigger grievance/appointment/lead creation if this is a submit button
      const bmIsGrievanceConfirm = (
        currentStep.stepId?.startsWith('grv_confirm_') ||
        currentStep.stepId?.startsWith('grievance_confirm')
      );
      const bmIsGrievanceSuccess = nextStepIdFromMapping?.startsWith('grv_success_') || nextStepIdFromMapping?.startsWith('grievance_success');
      const bmIsAptConfirm = currentStep.stepId?.startsWith('apt_confirm_') || currentStep.stepId?.startsWith('appointment_confirm');
      const bmIsAptSuccess = nextStepIdFromMapping?.startsWith('apt_success_') || nextStepIdFromMapping?.startsWith('appointment_submitted');
      const bmIsSubmit = String(buttonId).startsWith('submit_grv') || String(buttonId).startsWith('submit_apt') || buttonId === 'confirm_yes' || String(buttonId).startsWith('confirm_apt');
      
      if (bmIsGrievanceConfirm && bmIsGrievanceSuccess && bmIsSubmit) {
        console.log(`🎯 [buttonMapping path] Triggering createGrievance for button: ${buttonId}`);
        await ActionService.createGrievance(this.session, this.company, this.userPhone);
      } else if (bmIsAptConfirm && bmIsAptSuccess && bmIsSubmit) {
        console.log(`🎯 [buttonMapping path] Triggering createAppointment for button: ${buttonId}`);
        await ActionService.createAppointment(this.session, this.company, this.userPhone);
      }
      await this.runNextStepIfDifferent(nextStepIdFromMapping, currentStep.stepId);
      return;
    } else {
      console.log(`   No button mapping found for ${buttonId}`);
    }

    // ✅ THIRD: Check step's default nextStepId
    if (currentStep.nextStepId) {
      console.log(`✅ Using step's default nextStepId: ${currentStep.nextStepId}`);
      
      // Handle language buttons specially
      if (buttonId === 'lang_en' || buttonId === 'lang_hi' || buttonId === 'lang_mr' || buttonId === 'lang_or') {
        if (buttonId === 'lang_en') {
          this.session.language = 'en';
        } else if (buttonId === 'lang_hi') {
          this.session.language = 'hi';
        } else if (buttonId === 'lang_mr') {
          this.session.language = 'mr';
        } else if (buttonId === 'lang_or') {
          this.session.language = 'or';
        }
        console.log(`   Language set to: ${this.session.language}`);
        await updateSession(this.session);
      }
      
      // ✅ CRITICAL: Trigger business actions on confirm/submit steps
      // This path is hit when buttons don't have nextStepId set (e.g. Jharsuguda JSON flow)
      // — routing comes purely from step.nextStepId set by the flow transformer via edges.
      const defNextStepId = currentStep.nextStepId;
      const dfIsGrievanceConfirmStep = (
        currentStep.stepId === 'grievance_confirm' ||
        currentStep.stepId?.startsWith('grievance_confirm_') ||
        currentStep.stepId?.startsWith('grv_conf_') ||
        currentStep.stepId?.startsWith('grv_confirm_')
      );
      const dfIsGrievanceSuccessStep = (
        defNextStepId === 'grievance_success' ||
        defNextStepId?.startsWith('grievance_success') ||
        defNextStepId?.startsWith('grv_success_')
      );
      // For this path, ANY button click from a grv_confirm step to grv_success should trigger
      // (because cancel buttons route to menu — NOT to grv_success — so this is safe)
      const dfIsNotCancel = !String(buttonId).startsWith('cancel') && !String(buttonId).startsWith('cancel_grv');
      
      if (dfIsGrievanceConfirmStep && dfIsGrievanceSuccessStep && dfIsNotCancel) {
        console.log(`🎯 [Path3/default] Triggering createGrievance. StepId: ${currentStep.stepId}, NextStep: ${defNextStepId}, ButtonId: ${buttonId}`);
        await ActionService.createGrievance(this.session, this.company, this.userPhone);
      } else {
        const dfIsAptConfirmStep = (
          currentStep.stepId === 'appointment_confirm' ||
          currentStep.stepId?.startsWith('appointment_confirm_') ||
          currentStep.stepId?.startsWith('apt_conf_') ||
          currentStep.stepId?.startsWith('apt_confirm_')
        );
        const dfIsAptSuccessStep = (
          defNextStepId === 'appointment_submitted' ||
          defNextStepId?.startsWith('appointment_submitted') ||
          defNextStepId?.startsWith('apt_success_')
        );
        if (dfIsAptConfirmStep && dfIsAptSuccessStep && dfIsNotCancel) {
          console.log(`🎯 [Path3/default] Triggering createAppointment. StepId: ${currentStep.stepId}, NextStep: ${defNextStepId}, ButtonId: ${buttonId}`);
          await ActionService.createAppointment(this.session, this.company, this.userPhone);
        }
      }

      console.log(`   Executing next step from default: ${currentStep.nextStepId}`);
      await this.runNextStepIfDifferent(currentStep.nextStepId, currentStep.stepId);
      return;
    }

    // ✅ FALLBACK: Language selection step – match common button id/title variants
    const isLanguageStep = (currentStep.stepId === 'language_selection' || (currentStep.stepName || '').toLowerCase().includes('language'));
    if (isLanguageStep) {
      const normalized = (buttonId || '').trim().toLowerCase();
      const langMap: Array<{ keys: string[]; lang: 'en' | 'hi' | 'mr' | 'or'; nextStepId: string }> = [
        { keys: ['lang_en', 'en', 'english', 'gb english', '🇬🇧 english'], lang: 'en', nextStepId: 'main_menu_en' },
        { keys: ['lang_hi', 'hi', 'hindi', 'हिंदी', 'in हिंदी', 'hindi'], lang: 'hi', nextStepId: 'main_menu_hi' },
        { keys: ['lang_mr', 'mr', 'marathi', 'मराठी'], lang: 'mr', nextStepId: 'main_menu' },
        { keys: ['lang_or', 'or', 'odia', 'ଓଡ଼ିଆ', 'in ଓଡ଼ିଆ'], lang: 'or', nextStepId: 'main_menu_or' }
      ];
      for (const entry of langMap) {
        if (entry.keys.some(k => normalized === k.toLowerCase() || normalized.includes(k.toLowerCase()))) {
          const nextStep = this.flow.steps.find(s => s.stepId === entry.nextStepId);
          const stepIdToUse = nextStep ? entry.nextStepId : (this.flow.steps.find(s => s.stepId?.startsWith('main_menu'))?.stepId || currentStep.nextStepId);
          if (stepIdToUse) {
            this.session.language = entry.lang;
            console.log(`   Language fallback: button "${buttonId}" → ${entry.lang}, nextStep: ${stepIdToUse}`);
            await updateSession(this.session);
            await this.runNextStepIfDifferent(stepIdToUse, currentStep.stepId);
            return;
          }
        }
      }
    }

    // ❌ No routing found
    console.error(`❌ No routing found for button ${buttonId} in step ${this.session.data.currentStepId}`);
    console.error(`   Flow: ${this.flow.flowId}, Step: ${currentStep.stepId}`);
    console.error(`   Expected responses: ${JSON.stringify(currentStep.expectedResponses)}`);
    console.error(`   Button mapping: ${JSON.stringify(this.session.data.buttonMapping)}`);
    console.error(`   Default nextStepId: ${currentStep.nextStepId}`);
    // Send a user-friendly fallback message instead of generic error
    const lang = this.session.language || 'en';
    const fallbackMsgs: Record<string, string> = {
      en: '⚠️ *Invalid selection.*\n\nPlease tap one of the buttons above to continue.',
      hi: '⚠️ *अमान्य चयन।*\n\nजारी रखने के लिए ऊपर दिए गए बटनों में से किसी एक पर टैप करें।',
      or: '⚠️ *ଅବୈଧ ଚୟନ।*\n\nଜାରି ରଖିବା ପାଇଁ ଉପରୋକ୍ତ ବଟନ୍ ଗୁଡ଼ିକ ମଧ୍ୟରୁ ଗୋଟିଏ ଟ୍ୟାପ୍ କରନ୍ତୁ।',
      mr: '⚠️ *अवैध निवड।*\n\nपुढे सुरू ठेवण्यासाठी वरील बटणांपैकी एकावर टॅप करा।'
    };
    await sendWhatsAppMessage(this.company, this.userPhone, fallbackMsgs[lang] || fallbackMsgs['en']);
    // Re-send the current step to show the buttons again
    if (currentStep.stepType === 'buttons') {
      await this.executeButtonsStep(currentStep);
    }
  }

  /**
   * Handle list selection
   * Special handling for department selection in grievance flow
   */
  async handleListSelection(rowId: string): Promise<void> {
    const listMapping = this.session.data.listMapping || {};
    const Department = (await import('../models/Department')).default;

    // Special handling for "Load More" button in department list
    if (rowId === 'grv_load_more') {
      this.session.data.deptOffset = (this.session.data.deptOffset || 0) + 9;
      await updateSession(this.session);
      const currentStep = this.flow.steps.find(s => s.stepId === this.session.data.currentStepId);
      const isDynamic = 
      currentStep?.listConfig?.listSource === 'departments' || 
      (currentStep?.listConfig as any)?.dynamicSource === 'departments' ||
      (currentStep?.listConfig as any)?.isDynamic === true;

    if (isDynamic && currentStep) {
      await this.loadDepartmentsForListStep(currentStep);
    } else if (currentStep) {
        await this.loadDepartmentsForGrievance(currentStep);
      }
      return;
    }

    // Department selection (grv_dept_* or apt_dept_*)
    if (rowId.includes('_dept_') && !rowId.includes('_sub_dept_')) {
      const match = rowId.match(/^([a-z]+)_dept_(.+)$/);
      if (match) {
        const prefix = match[1];
        const departmentId = match[2];
        console.log(`🏬 Department selected: ${departmentId} (Prefix: ${prefix})`);
        
        const department = await Department.findById(departmentId);
        if (department) {
          const lang = this.session.language || 'en';
          let localizedName = department.name;
          if (lang === 'hi' && department.nameHi) localizedName = department.nameHi;
          else if (lang === 'or' && department.nameOr) localizedName = department.nameOr;
          else if (lang === 'mr' && department.nameMr) localizedName = department.nameMr;

          const hierarchicalEnabled = this.company.enabledModules?.includes('HIERARCHICAL_DEPARTMENTS');
          
          if (hierarchicalEnabled) {
            const subDepts = await Department.find({ parentDepartmentId: departmentId, isActive: true });
            
            if (subDepts.length > 0) {
              console.log(`   - Has ${subDepts.length} sub-departments. Loading sub-menu...`);
              this.session.data.departmentId = departmentId;
              this.session.data.departmentName = localizedName;
              await updateSession(this.session);
              await this.loadSubDepartmentsForGrievance(departmentId, prefix);
              return;
            }
          }

          this.session.data.departmentId = departmentId;
          this.session.data.departmentName = localizedName;
          this.session.data.category = department.name;
          delete this.session.data.subDepartmentId;
          await updateSession(this.session);
          
          console.log(`✅ Department saved to session: ${localizedName}`);
        }
      }
    }

    // Sub-department selection (grv_sub_dept_* or apt_sub_dept_*)
    // NOTE: We intentionally do NOT recurse deeper than 1 level of sub-department.
    // If more nesting is needed, the flow builder should handle it explicitly.
    if (rowId.includes('_sub_dept_')) {
      const match = rowId.match(/^([a-z]+)_sub_dept_(.+)$/);
      if (match) {
        const subDeptId = match[2];
        const subDept = await Department.findById(subDeptId);
        
        if (subDept) {
          const lang = this.session.language || 'en';
          let localizedSubName = subDept.name;
          if (lang === 'hi' && subDept.nameHi) localizedSubName = subDept.nameHi;
          else if (lang === 'or' && subDept.nameOr) localizedSubName = subDept.nameOr;
          else if (lang === 'mr' && subDept.nameMr) localizedSubName = subDept.nameMr;

          // Save sub-department separately (for placeholder resolution and confirmation messages)
          this.session.data.subDepartmentId = subDeptId;
          this.session.data.subDepartmentName = localizedSubName;
          this.session.data.category = subDept.name;
          // Keep parent departmentName intact; add sub-dept name separately
          // Do NOT overwrite departmentName to avoid confusion in confirmation steps
          await updateSession(this.session);
          console.log(`✅ Sub-department saved to session: ${localizedSubName} (parent dept: ${this.session.data.departmentName})`);
        }
      }
    }

    const nextStepId = listMapping[rowId];
    if (nextStepId) {
      await this.runNextStepIfDifferent(nextStepId, this.session.data.currentStepId);
    } else {
      console.error(`❌ No mapping found for list row ${rowId}`);
      // User may have typed text when a list was expected — send a friendly fallback
      const lang = this.session.language || 'en';
      const fallbackMsgs: Record<string, string> = {
        en: '⚠️ *Please use the list menu above.*\n\nTap *"Select"* or *"View"* button to open the options and make your selection.',
        hi: '⚠️ *कृपया ऊपर दी गई सूची मेनू का उपयोग करें।*\n\nविकल्प खोलने के लिए *"चुनें"* या *"देखें"* बटन पर टैप करें।',
        or: '⚠️ *ଦୟାକରି ଉପରୋକ୍ତ ତାଲିକା ମେନୁ ବ୍ୟବହାର କରନ୍ତୁ।*\n\nବିକଳ୍ପ ଖୋଲିବାକୁ *"ବାଛନ୍ତୁ"* ବଟନ୍ ଟ୍ୟାପ୍ କରନ୍ତୁ।',
        mr: '⚠️ *कृपया वरील याद्या मेनू वापरा।*\n\nपर्याय उघडण्यासाठी *"निवडा"* बटणावर टॅप करा।'
      };
      await sendWhatsAppMessage(this.company, this.userPhone, fallbackMsgs[lang] || fallbackMsgs['en']);
    }
  }
}

/**
 * Find and load flow for a company based on trigger
 */
export async function loadFlowForTrigger(
  companyId: string | mongoose.Types.ObjectId,
  trigger: string,
  flowType?: string
): Promise<IChatbotFlow | null> {
  try {
    let companyObjectId: mongoose.Types.ObjectId;

    // Convert to ObjectId if it's a string
    if (typeof companyId === 'string') {
      if (mongoose.Types.ObjectId.isValid(companyId) && companyId.length === 24) {
        companyObjectId = new mongoose.Types.ObjectId(companyId);
      } else {
        // It's likely a custom companyId string like 'CMP000006'
        const Company = (await import('../models/Company')).default;
        const companyDoc = await Company.findOne({ companyId }).lean();
        if (companyDoc) {
          companyObjectId = companyDoc._id as mongoose.Types.ObjectId;
        } else {
          console.error(`❌ Could not resolve companyId string "${companyId}" to an ObjectId`);
          return null;
        }
      }
    } else {
      companyObjectId = companyId;
    }
    
    console.log(`🔍 Searching for flow with trigger "${trigger}" for company: ${companyObjectId}`);
    
    // First, check if there's an active WhatsApp config with assigned flows
    const CompanyWhatsAppConfig = (await import('../models/CompanyWhatsAppConfig')).default;
    const whatsappConfig = await CompanyWhatsAppConfig.findOne({
      companyId: companyObjectId,
      isActive: true
    });
    
    let assignedFlowIds: mongoose.Types.ObjectId[] = [];
    if (whatsappConfig && whatsappConfig.activeFlows && whatsappConfig.activeFlows.length > 0) {
      assignedFlowIds = whatsappConfig.activeFlows
        .filter((af: any) => af?.isActive !== false && af?.flowId) // ✅ avoid null flowId
        .map((af: any) => af.flowId)
        .filter((id: any) => !!id);
      console.log(`📋 Found ${assignedFlowIds.length} assigned flow(s) in WhatsApp config`);
    }
    
    const query: any = {
      companyId: companyObjectId,
      isActive: true,
      'triggers.triggerValue': { $regex: new RegExp(`^${trigger}$`, 'i') } // Case-insensitive match
    };

    if (flowType) {
      query.flowType = flowType;
    }

    // If there are assigned flows, prioritize them
    if (assignedFlowIds.length > 0) {
      query._id = { $in: assignedFlowIds };
      console.log(`🎯 Prioritizing assigned flows: ${assignedFlowIds.length} flow(s)`);
    }

    console.log(`🔍 Flow query:`, JSON.stringify(query, null, 2));
    
    // First, let's check all flows for this company to see what we have
    const allFlows = await ChatbotFlow.find({ companyId: companyObjectId });
    console.log(`📊 Total flows for company: ${allFlows.length}`);
    allFlows.forEach((f: any) => {
      const isAssigned = assignedFlowIds.some((id: any) => id && id.toString && id.toString() === f._id.toString());
      console.log(`  - Flow: ${f.flowName} (${f.flowId}), Active: ${f.isActive}, Assigned: ${isAssigned}, Triggers: ${JSON.stringify(f.triggers?.map((t: any) => t.triggerValue))}`);
    });

    let flow = await ChatbotFlow.findOne(query).sort({ 'triggers.priority': -1 });
    
    // 🔄 FALLBACK: If no flow found for specific trigger, but there are assigned flows and it's a greeting
    if (!flow && assignedFlowIds.length > 0) {
      const greetings = ['hi', 'hello', 'start', 'restart', 'menu', 'namaste', 'नमस्ते', 'test'];
      if (greetings.includes(trigger.toLowerCase().trim())) {
        console.log(`🔄 No specific flow found for trigger "${trigger}", but found ${assignedFlowIds.length} assigned flow(s). Using the first one as default.`);
        flow = await ChatbotFlow.findById(assignedFlowIds[0]);
      }
    }

    if (flow) {
      const isAssigned = assignedFlowIds.some((id: any) => id && id.toString && id.toString() === flow._id.toString());
      console.log(`✅ Found flow: ${flow.flowName} (${flow.flowId}) for trigger: ${trigger}`);
      console.log(`   Assigned to WhatsApp: ${isAssigned ? 'YES ✅' : 'NO ⚠️'}`);
      console.log(`   Start Step ID: ${flow.startStepId}`);
      console.log(`   Total Steps: ${flow.steps?.length || 0}`);
      
      // Warn if flow is active but not assigned
      if (!isAssigned && assignedFlowIds.length > 0) {
        console.warn(`⚠️ Flow is active but not assigned to WhatsApp config. Consider assigning it.`);
      }
    } else {
      console.log(`⚠️ No flow found for trigger "${trigger}" in company ${companyObjectId}`);
      console.log(`   Query used:`, JSON.stringify(query, null, 2));
    }
    
    return flow;
  } catch (error) {
    console.error('❌ Error loading flow:', error);
    return null;
  }
}

/**
 * Get start step ID for a trigger
 */
export function getStartStepForTrigger(flow: IChatbotFlow, trigger: string): string | null {
  const triggerConfig = flow.triggers.find(t => t.triggerValue === trigger);
  return triggerConfig?.startStepId || flow.startStepId;
}
