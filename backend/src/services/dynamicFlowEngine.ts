import mongoose from 'mongoose';
import ChatbotFlow, { IFlowStep, IChatbotFlow } from '../models/ChatbotFlow';
import Grievance from '../models/Grievance';
import Appointment from '../models/Appointment';
import Department from '../models/Department';
import User from '../models/User';
import { sendWhatsAppMessage, sendWhatsAppButtons, sendWhatsAppList } from './whatsappService';
import { UserSession, updateSession } from './sessionService';
import { findDepartmentByCategory } from './departmentMapper';
import { notifyDepartmentAdminOnCreation, notifyUserOnAssignment } from './notificationService';
import { GrievanceStatus, AppointmentStatus, UserRole } from '../config/constants';

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
    // Special handling for department selection – load departments automatically (stepId grievance_category or grievance_category_en etc.)
    if (step.stepId === 'grievance_category' || (step.stepId && step.stepId.startsWith('grievance_category_'))) {
      await this.loadDepartmentsForGrievance(step);
      return;
    }

    // Special handling for track_result: fetch grievance or appointment by refNumber and set session.data for placeholders (status, assignedTo, remarks)
    if (step.stepId === 'track_result' || (step.stepId && step.stepId.startsWith('track_result_'))) {
      await this.loadTrackResultIntoSession();
    }

    // If step has buttons (e.g. language_selection saved as "message" from dashboard), send as buttons
    if (step.buttons && step.buttons.length > 0) {
      const message = this.replacePlaceholders(step.messageText || '');
      const buttons = step.buttons.map(btn => ({ id: btn.id, title: btn.title }));
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

    const message = this.replacePlaceholders(step.messageText || '');
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
   */
  private async loadDepartmentsForGrievance(step: IFlowStep): Promise<void> {
    try {
      const Department = (await import('../models/Department')).default;
      const { getTranslation } = await import('./chatbotEngine');
      
      console.log(`🏬 Loading departments for company: ${this.company._id}`);
      
      // Get all departments for this company
      const departments = await Department.find({ 
        companyId: this.company._id, 
        isActive: true 
      });
      
      console.log(`📊 Found ${departments.length} department(s) for company ${this.company._id}`);
      departments.forEach((dept: any) => {
        console.log(`   - ${dept.name} (${dept._id})`);
      });
      
      if (departments.length === 0) {
        // No departments found - send error message
        const errorMessage = getTranslation('msg_no_dept_grv', this.session.language);
        await sendWhatsAppMessage(this.company, this.userPhone, errorMessage);
        
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
      const lang = this.session.language || 'en';
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
          const translatedName = getTranslation(`dept_${dept.name}`, lang);
          displayName = translatedName !== `dept_${dept.name}` ? translatedName : dept.name;
        }
        let displayDesc: string;
        if (lang === 'hi' && dept.descriptionHi && dept.descriptionHi.trim()) {
          displayDesc = dept.descriptionHi.trim();
        } else if (lang === 'or' && dept.descriptionOr && dept.descriptionOr.trim()) {
          displayDesc = dept.descriptionOr.trim();
        } else if (lang === 'mr' && dept.descriptionMr && dept.descriptionMr.trim()) {
          displayDesc = dept.descriptionMr.trim();
        } else {
          displayDesc = getTranslation(`desc_${dept.name}`, lang) || dept.description?.substring(0, 72) || '';
        }
        return {
          id: `grv_dept_${dept._id}`,
          title: displayName.length > 24 ? displayName.substring(0, 21) + '...' : displayName,
          description: displayDesc.substring(0, 72)
        };
      });
      
      // Add "Load More" button if there are more departments
      if (showLoadMore) {
        deptRows.push({
          id: 'grv_load_more',
          title: getTranslation('btn_load_more', this.session.language),
          description: `${departments.length - offset - 9} more departments available`
        });
      }
      
      // Create sections (WhatsApp requires at least 1 section with 1-10 rows)
      const sections = [{
        title: getTranslation('btn_select_dept', this.session.language),
        rows: deptRows
      }];
      
      console.log(`📋 Sending department list with ${deptRows.length} items (offset: ${offset})`);
      
      // Save step info and list mapping to session
      this.session.data.currentStepId = step.stepId;
      this.session.data.listMapping = {};
      deptRows.forEach((row: any) => {
        if (row.id.startsWith('grv_dept_')) {
          // Map department selection to next step
          this.session.data.listMapping[row.id] = step.nextStepId || 'grievance_description';
        }
      });
      
      // Handle "Load More" button mapping
      if (showLoadMore) {
        this.session.data.listMapping['grv_load_more'] = 'grievance_category'; // Stay on same step
      }
      
      await updateSession(this.session);
      
      try {
        const message = this.replacePlaceholders(step.messageText || getTranslation('selection_department', this.session.language));
        await sendWhatsAppList(
          this.company,
          this.userPhone,
          message,
          getTranslation('btn_select_dept', this.session.language),
          sections
        );
      } catch (error) {
        console.error('❌ Failed to send list, falling back to buttons');
        // If list fails, use buttons for first 3 departments (same language logic as list)
        if (departments.length <= 3) {
          const buttons = departments.map((dept: any) => {
            let displayName: string;
            if (lang === 'hi' && dept.nameHi && dept.nameHi.trim()) {
              displayName = dept.nameHi.trim();
            } else if (lang === 'or' && dept.nameOr && dept.nameOr.trim()) {
              displayName = dept.nameOr.trim();
            } else if (lang === 'mr' && dept.nameMr && dept.nameMr.trim()) {
              displayName = dept.nameMr.trim();
            } else {
              const translatedName = getTranslation(`dept_${dept.name}`, lang);
              displayName = translatedName !== `dept_${dept.name}` ? translatedName : dept.name;
            }
            return {
              id: `grv_dept_${dept._id}`,
              title: displayName.substring(0, 20)
            };
          });
          
          const message = this.replacePlaceholders(step.messageText || getTranslation('selection_department', this.session.language));
          await sendWhatsAppButtons(this.company, this.userPhone, message, buttons);
          
          // Save button mapping
          this.session.data.buttonMapping = {};
          buttons.forEach((btn: any) => {
            this.session.data.buttonMapping[btn.id] = step.nextStepId || 'grievance_description';
          });
          await updateSession(this.session);
        }
      }
    } catch (error: any) {
      console.error('❌ Error loading departments for grievance:', error);
      const { getTranslation } = await import('./chatbotEngine');
      const errorMessage = getTranslation('msg_no_dept_grv', this.session.language);
      await sendWhatsAppMessage(this.company, this.userPhone, errorMessage);
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

    const message = this.replacePlaceholders(step.messageText || '');
    const buttons = step.buttons.map(btn => ({
      id: btn.id,
      title: btn.title
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

    if (step.listConfig.listSource === 'departments') {
      await this.loadDepartmentsForListStep(step);
      return;
    }

    const message = this.replacePlaceholders(step.messageText || '');
    await sendWhatsAppList(
      this.company,
      this.userPhone,
      message,
      step.listConfig.buttonText,
      step.listConfig.sections || []
    );

    this.session.data.currentStepId = step.stepId;
    this.session.data.listMapping = {};
    (step.listConfig.sections || []).forEach(section => {
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
    try {
      const Department = (await import('../models/Department')).default;
      const { getTranslation } = await import('./chatbotEngine');

      const departments = await Department.find({
        companyId: this.company._id,
        isActive: true
      });

      if (departments.length === 0) {
        const errorMessage = getTranslation('msg_no_dept_grv', this.session.language);
        await sendWhatsAppMessage(this.company, this.userPhone, errorMessage);
        await this.runNextStepIfDifferent(step.nextStepId, step.stepId);
        return;
      }

      const lang = this.session.language || 'en';
      const deptRows = departments.slice(0, 10).map((dept: any) => {
        let displayName: string;
        if (lang === 'hi' && dept.nameHi && dept.nameHi.trim()) {
          displayName = dept.nameHi.trim();
        } else if (lang === 'or' && dept.nameOr && dept.nameOr.trim()) {
          displayName = dept.nameOr.trim();
        } else if (lang === 'mr' && dept.nameMr && dept.nameMr.trim()) {
          displayName = dept.nameMr.trim();
        } else {
          const translatedName = getTranslation(`dept_${dept.name}`, lang);
          displayName = translatedName !== `dept_${dept.name}` ? translatedName : dept.name;
        }
        const desc = (dept.description || '').substring(0, 72);
        return {
          id: `grv_dept_${dept._id}`,
          title: displayName.length > 24 ? displayName.substring(0, 21) + '...' : displayName,
          description: desc,
          nextStepId: step.nextStepId
        };
      });

      const listConfig = step.listConfig!;
      const sections = [{
        title: listConfig.buttonText || getTranslation('btn_select_dept', lang),
        rows: deptRows
      }];

      const message = this.replacePlaceholders(step.messageText || getTranslation('selection_department', lang));
      await sendWhatsAppList(this.company, this.userPhone, message, listConfig.buttonText || getTranslation('btn_select_dept', lang), sections);

      this.session.data.currentStepId = step.stepId;
      this.session.data.listMapping = {};
      deptRows.forEach((row: any) => {
        this.session.data.listMapping[row.id] = step.nextStepId || row.nextStepId;
      });
      await updateSession(this.session);
    } catch (error: any) {
      console.error('❌ Error loading departments for list step:', error);
      const { getTranslation } = await import('./chatbotEngine');
      await sendWhatsAppMessage(this.company, this.userPhone, getTranslation('msg_no_dept_grv', this.session.language));
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

    const isMediaInput = ['image', 'document', 'video'].includes(step.inputConfig.inputType);

    // If no user input yet, send the prompt
    if (!userInput) {
      const message = this.replacePlaceholders(step.messageText || 'Please provide your input:');
      await sendWhatsAppMessage(this.company, this.userPhone, message);

      this.session.data.currentStepId = step.stepId;
      if (isMediaInput) {
        // Wait for actual media (or skip); do not advance on text
        this.session.data.awaitingMedia = {
          mediaType: step.inputConfig.inputType as 'image' | 'document' | 'video',
          optional: !step.inputConfig.validation?.required,
          saveToField: step.inputConfig.saveToField || 'media',
          nextStepId: step.inputConfig.nextStepId
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
        const { getTranslation } = await import('./chatbotEngine');
        const reminder = (getTranslation('msg_upload_photo', this.session.language || 'en') as string) + '\n\n_Type *back* or *skip* to continue without uploading._';
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

    const message = this.replacePlaceholders(step.messageText || 'Please upload media:');
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
   * Create grievance from session data and set session.data.grievanceId, department, date for success step placeholders
   */
  private async createGrievanceAndSetSession(): Promise<void> {
    try {
      let departmentId: mongoose.Types.ObjectId | null = null;
      if (this.session.data.departmentId) {
        try {
          departmentId = typeof this.session.data.departmentId === 'string'
            ? new mongoose.Types.ObjectId(this.session.data.departmentId)
            : this.session.data.departmentId;
        } catch {
          departmentId = await findDepartmentByCategory(this.company._id, this.session.data.category);
        }
      }
      if (!departmentId && this.session.data.category) {
        departmentId = await findDepartmentByCategory(this.company._id, this.session.data.category);
      }
      const grievanceData = {
        companyId: this.company._id,
        departmentId: departmentId || undefined,
        citizenName: this.session.data.citizenName,
        citizenPhone: this.userPhone,
        citizenWhatsApp: this.userPhone,
        description: this.session.data.description,
        category: this.session.data.category,
        media: this.session.data.media || [],
        status: GrievanceStatus.PENDING,
        language: this.session.language
      };
      const grievance = new Grievance(grievanceData);
      await grievance.save();
      this.session.data.grievanceId = grievance.grievanceId;
      this.session.data.date = new Date(grievance.createdAt).toLocaleDateString('en-IN');
      const dept = departmentId ? await Department.findById(departmentId) : null;
      this.session.data.department = dept ? dept.name : (this.session.data.category || 'General');
      await updateSession(this.session);
      if (departmentId) {
        await notifyDepartmentAdminOnCreation({
          type: 'grievance',
          action: 'created',
          grievanceId: grievance.grievanceId,
          citizenName: this.session.data.citizenName,
          citizenPhone: this.userPhone,
          citizenWhatsApp: this.userPhone,
          departmentId,
          companyId: this.company._id,
          description: this.session.data.description,
          category: this.session.data.category,
          createdAt: grievance.createdAt,
          timeline: grievance.timeline
        });
        // Auto-assign to department admin and notify assignee (WhatsApp + email)
        const departmentAdmin = await User.findOne({
          departmentId,
          role: UserRole.DEPARTMENT_ADMIN,
          isActive: true
        });
        if (departmentAdmin) {
          grievance.assignedTo = departmentAdmin._id;
          await grievance.save();
          await notifyUserOnAssignment({
            type: 'grievance',
            action: 'assigned',
            grievanceId: grievance.grievanceId,
            citizenName: this.session.data.citizenName,
            citizenPhone: this.userPhone,
            citizenWhatsApp: this.userPhone,
            departmentId,
            companyId: this.company._id,
            assignedTo: departmentAdmin._id,
            assignedByName: 'System (Auto-assign)',
            assignedAt: new Date(),
            description: this.session.data.description,
            category: this.session.data.category,
            createdAt: grievance.createdAt,
            timeline: grievance.timeline
          });
        }
      }
    } catch (err: any) {
      console.error('❌ Error creating grievance in flow:', err);
    }
  }

  /**
   * Create appointment from session data and set session.data.appointmentId, status for success step placeholders
   */
  private async createAppointmentAndSetSession(): Promise<void> {
    try {
      const appointmentDate = new Date(this.session.data.appointmentDate);
      const appointmentData = {
        companyId: this.company._id,
        departmentId: null,
        citizenName: this.session.data.citizenName,
        citizenPhone: this.userPhone,
        citizenWhatsApp: this.userPhone,
        purpose: this.session.data.purpose,
        appointmentDate,
        appointmentTime: this.session.data.appointmentTime,
        status: AppointmentStatus.SCHEDULED
      };
      const appointment = new Appointment(appointmentData);
      await appointment.save();
      this.session.data.appointmentId = appointment.appointmentId;
      this.session.data.status = 'Scheduled';
      await updateSession(this.session);
      await notifyDepartmentAdminOnCreation({
        type: 'appointment',
        action: 'created',
        appointmentId: appointment.appointmentId,
        citizenName: this.session.data.citizenName,
        citizenPhone: this.userPhone,
        citizenWhatsApp: this.userPhone,
        companyId: this.company._id,
        purpose: this.session.data.purpose,
        appointmentDate: appointment.appointmentDate,
        appointmentTime: appointment.appointmentTime,
        createdAt: appointment.createdAt,
        timeline: appointment.timeline
      });
    } catch (err: any) {
      console.error('❌ Error creating appointment in flow:', err);
    }
  }

  /**
   * Replace placeholders in message templates
   * Example: "Hello {citizenName}, your ticket is {ticketId}"
   * Dynamic values come from session.data (set by backend when creating grievance/appointment or from API step for track).
   */
  private replacePlaceholders(template: string): string {
    let message = template;

    // Replace session data placeholders (flat keys and nested like status, assignedTo, remarks from track API)
    const placeholderRegex = /\{([^}]+)\}/g;
    message = message.replace(placeholderRegex, (match, key) => {
      const val = this.session.data[key];
      return val != null && val !== '' ? String(val) : match;
    });

    // Replace special placeholders
    message = message.replace(/\{date\}/g, this.session.data.date ?? new Date().toLocaleDateString('en-IN'));
    message = message.replace(/\{time\}/g, this.session.data.time ?? new Date().toLocaleTimeString('en-IN'));
    message = message.replace(/\{companyName\}/g, this.company.name);

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
        // Create grievance/appointment in DB before success step so placeholders (grievanceId, appointmentId, etc.) are set
        const isGrievanceConfirm = (currentStep.stepId === 'grievance_confirm' || (currentStep.stepId && currentStep.stepId.startsWith('grievance_confirm_')));
        const isAppointmentConfirm = (currentStep.stepId === 'appointment_confirm' || (currentStep.stepId && currentStep.stepId.startsWith('appointment_confirm_')));
        const isGrievanceSuccess = nextStepId === 'grievance_success' || (nextStepId && nextStepId.startsWith('grievance_success'));
        const isAppointmentSubmitted = nextStepId === 'appointment_submitted' || (nextStepId && nextStepId.startsWith('appointment_submitted'));
        if (isGrievanceConfirm && isGrievanceSuccess && (buttonId === 'confirm_yes' || String(buttonId).startsWith('confirm_yes'))) {
          await this.createGrievanceAndSetSession();
        } else if (isAppointmentConfirm && isAppointmentSubmitted && (buttonId === 'appt_confirm_yes' || String(buttonId).startsWith('appt_confirm_yes'))) {
          await this.createAppointmentAndSetSession();
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
    await this.sendErrorMessage();
  }

  /**
   * Handle list selection
   * Special handling for department selection in grievance flow
   */
  async handleListSelection(rowId: string): Promise<void> {
    const listMapping = this.session.data.listMapping || {};

    // Special handling for "Load More" button in department list
    if (rowId === 'grv_load_more') {
      this.session.data.deptOffset = (this.session.data.deptOffset || 0) + 9;
      await updateSession(this.session);
      const currentStep = this.flow.steps.find(s => s.stepId === this.session.data.currentStepId);
      if (currentStep?.listConfig?.listSource === 'departments') {
        await this.loadDepartmentsForListStep(currentStep);
      } else if (currentStep) {
        await this.loadDepartmentsForGrievance(currentStep);
      }
      return;
    }

    // Department selection (grv_dept_*) – set departmentId/category in session
    if (rowId.startsWith('grv_dept_')) {
      const Department = (await import('../models/Department')).default;
      const departmentId = rowId.replace('grv_dept_', '');
      
      console.log(`🏬 Department selected: ${departmentId}`);
      
      // Get department details
      const department = await Department.findById(departmentId);
      if (department) {
        this.session.data.departmentId = departmentId;
        this.session.data.departmentName = department.name;
        this.session.data.category = department.name;
        await updateSession(this.session);
        
        console.log(`✅ Department saved to session: ${department.name}`);
      }
    }

    const nextStepId = listMapping[rowId];
    if (nextStepId) {
      await this.runNextStepIfDifferent(nextStepId, this.session.data.currentStepId);
    } else {
      console.error(`❌ No mapping found for list row ${rowId}`);
      await this.sendErrorMessage();
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
    // Convert to ObjectId if it's a string
    const companyObjectId = typeof companyId === 'string' 
      ? (mongoose.Types.ObjectId.isValid(companyId) ? new mongoose.Types.ObjectId(companyId) : companyId)
      : companyId;
    
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

    const flow = await ChatbotFlow.findOne(query).sort({ 'triggers.priority': -1 });
    
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
