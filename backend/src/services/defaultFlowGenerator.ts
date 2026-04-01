import mongoose from 'mongoose';
import ChatbotFlow from '../models/ChatbotFlow';
import Company from '../models/Company';
import { Module } from '../config/constants';

/**
 * Generate default flows for a company
 * Creates standard flows (grievance, appointment, tracking) that can be customized
 */
export async function generateDefaultFlows(companyId: string | mongoose.Types.ObjectId, createdBy: mongoose.Types.ObjectId): Promise<void> {
  try {
    const companyObjectId = typeof companyId === 'string' 
      ? (mongoose.Types.ObjectId.isValid(companyId) ? new mongoose.Types.ObjectId(companyId) : companyId)
      : companyId;

    const company = await Company.findById(companyObjectId);
    if (!company) {
      throw new Error(`Company not found: ${companyId}`);
    }

    console.log(`🔄 Default flow generation is disabled for company: ${company.name} (${company.companyId})`);
    console.log(`ℹ️  Companies can now create their own custom flows from scratch.`);

    // Default flow generation is disabled
    // Companies should create their own flows using the flow builder
    return;

    /* DISABLED: Default flow generation
    
    // Check if default flows already exist
    const existingFlows = await ChatbotFlow.find({ 
      companyId: companyObjectId,
      flowType: { $in: ['grievance', 'appointment', 'tracking'] }
    });

    if (existingFlows.length > 0) {
      console.log(`⚠️ Default flows already exist for company ${company.companyId}. Found ${existingFlows.length} flow(s):`);
      existingFlows.forEach((f: any) => {
        console.log(`   - ${f.flowName} (${f.flowType}) - ${f.flowId || f._id}`);
      });
      throw new Error(`Default flows already exist for this company. Found: ${existingFlows.map((f: any) => f.flowName).join(', ')}`);
    }

    const defaultFlows: any[] = [];

    // 1. DEFAULT GRIEVANCE FLOW
    if (company.enabledModules.includes(Module.GRIEVANCE)) {
      defaultFlows.push({
        companyId: companyObjectId,
        flowName: 'Default Grievance Flow',
        flowDescription: 'Standard grievance filing flow. Customize this flow to match your requirements.',
        flowType: 'grievance',
        isActive: false, // Not active by default - user must activate
        version: 1,
        startStepId: 'grievance_start',
        steps: [
          {
            stepId: 'grievance_start',
            stepType: 'message',
            stepName: 'Grievance Welcome',
            messageText: '📝 *Register a Grievance*\\n\\nYou can file a formal complaint regarding any department. To begin, please provide the details as requested.',
            nextStepId: 'grievance_name'
          },
          {
            stepId: 'grievance_name',
            stepType: 'input',
            stepName: 'Collect Name',
            messageText: '👤 *Citizen Identification*\\n\\nPlease enter your Full Name as per official documents:',
            inputConfig: {
              inputType: 'text',
              validation: {
                required: true,
                minLength: 2,
                errorMessage: '⚠️ Please enter a valid name (minimum 2 characters).'
              },
              saveToField: 'citizenName',
              nextStepId: 'grievance_category'
            }
          },
          {
            stepId: 'grievance_category',
            stepType: 'message',
            stepName: 'Department Selection',
            messageText: '🏢 *Department Selection*\\n\\nPlease select the relevant department:',
            nextStepId: 'grievance_description'
          },
          {
            stepId: 'grievance_description',
            stepType: 'input',
            stepName: 'Collect Description',
            messageText: '✍️ *Grievance Details*\\n\\nPlease describe your issue in detail. Tip: Include date, location, and specific information for faster resolution.',
            inputConfig: {
              inputType: 'text',
              validation: {
                required: true,
                minLength: 10,
                errorMessage: '⚠️ Please provide more details (minimum 10 characters).'
              },
              saveToField: 'description',
              nextStepId: 'grievance_photo'
            }
          },
          {
            stepId: 'grievance_photo',
            stepType: 'message',
            stepName: 'Photo Request',
            messageText: '📎 *Supporting Evidence*\\n\\nUpload a photo or document to support your grievance (Optional).',
            nextStepId: 'grievance_confirm'
          },
          {
            stepId: 'grievance_confirm',
            stepType: 'buttons',
            stepName: 'Confirmation',
            messageText: '📋 *Confirm Submission*\\n\\n👤 Name: {citizenName}\\n🏢 Department: {category}\\n📝 Issue: {description}\\n\\nIs the above information correct?',
            buttons: [
              { id: 'confirm_yes', title: '✅ Submit Grievance', nextStepId: 'grievance_success' },
              { id: 'confirm_no', title: '❌ Cancel', nextStepId: 'grievance_cancelled' }
            ],
            expectedResponses: [
              { type: 'button_click', value: 'confirm_yes', nextStepId: 'grievance_success' },
              { type: 'button_click', value: 'confirm_no', nextStepId: 'grievance_cancelled' }
            ]
          },
          {
            stepId: 'grievance_success',
            stepType: 'message',
            stepName: 'Success Message',
            messageText: '✅ *Grievance Registered Successfully*\\n\\n📄 Reference Number: {grievanceId}\\n\\nYour grievance has been forwarded to the concerned department. You will be notified on status updates.'
          },
          {
            stepId: 'grievance_cancelled',
            stepType: 'message',
            stepName: 'Cancelled',
            messageText: '🚫 *Cancelled*\\n\\nGrievance registration has been cancelled.'
          }
        ],
        triggers: [
          {
            triggerType: 'button_click',
            triggerValue: 'grievance',
            startStepId: 'grievance_start'
          }
        ],
        supportedLanguages: ['en', 'hi', 'mr', 'or'],
        defaultLanguage: 'en',
        settings: {
          sessionTimeout: 30,
          enableTypingIndicator: true,
          enableReadReceipts: true,
          maxRetries: 3,
          errorFallbackMessage: 'We encountered an error. Please try again later.'
        },
        createdBy,
        updatedBy: createdBy
      });
    }

    // 2. DEFAULT APPOINTMENT FLOW
    if (company.enabledModules.includes(Module.APPOINTMENT)) {
      defaultFlows.push({
        companyId: companyObjectId,
        flowName: 'Default Appointment Flow',
        flowDescription: 'Standard appointment booking flow. Customize this flow to match your requirements.',
        flowType: 'appointment',
        isActive: false,
        version: 1,
        startStepId: 'appointment_start',
        steps: [
          {
            stepId: 'appointment_start',
            stepType: 'message',
            stepName: 'Appointment Welcome',
            messageText: '📅 *Book an Official Appointment*\\n\\nSchedule a meeting with the Chief Executive Officer (CEO). Please provide the required details to proceed with your appointment request.',
            nextStepId: 'appointment_name'
          },
          {
            stepId: 'appointment_name',
            stepType: 'input',
            stepName: 'Collect Name',
            messageText: '👤 *New Appointment Request*\\n\\nPlease enter your Full Name (as per official records):',
            inputConfig: {
              inputType: 'text',
              validation: {
                required: true,
                minLength: 2
              },
              saveToField: 'citizenName',
              nextStepId: 'appointment_purpose'
            }
          },
          {
            stepId: 'appointment_purpose',
            stepType: 'input',
            stepName: 'Collect Purpose',
            messageText: '🎯 *Purpose of Meeting*\\n\\nPlease briefly describe the purpose of your meeting with the CEO:',
            inputConfig: {
              inputType: 'text',
              validation: {
                required: true,
                minLength: 5
              },
              saveToField: 'purpose',
              nextStepId: 'appointment_date'
            }
          },
          {
            stepId: 'appointment_date',
            stepType: 'api_call',
            stepName: 'Select Date',
            messageText: '📅 *Select Preferred Date*\\n\\nPlease choose a convenient date for your appointment:',
            apiConfig: {
              method: 'GET',
              endpoint: `/api/availability/chatbot/${companyObjectId}`,
              saveResponseTo: 'availableDates',
              nextStepId: 'appointment_time'
            }
          },
          {
            stepId: 'appointment_time',
            stepType: 'message',
            stepName: 'Select Time',
            messageText: '⏰ *Select Time Slot*\\n\\nPlease choose a preferred time:',
            nextStepId: 'appointment_verify'
          },
          {
            stepId: 'appointment_verify',
            stepType: 'buttons',
            stepName: 'Verify Appointment',
            messageText: '📋 *Verify Appointment Details*\\n\\n👤 Name: {citizenName}\\n👔 Meeting With: CEO\\n🎯 Purpose: {purpose}\\n📅 Date: {appointmentDate}\\n⏰ Time: {appointmentTime}\\n\\nIs the above information correct?',
            buttons: [
              { id: 'confirm_yes', title: '✅ Confirm Booking', nextStepId: 'appointment_submitted' },
              { id: 'confirm_no', title: '❌ Cancel', nextStepId: 'appointment_cancelled' }
            ],
            expectedResponses: [
              { type: 'button_click', value: 'confirm_yes', nextStepId: 'appointment_submitted' },
              { type: 'button_click', value: 'confirm_no', nextStepId: 'appointment_cancelled' }
            ]
          },
          {
            stepId: 'appointment_submitted',
            stepType: 'message',
            stepName: 'Success Message',
            messageText: '✅ *Appointment Request Submitted*\\n\\nYour appointment request has been received.\\n\\n📄 Reference Number: {appointmentId}\\n📅 Requested Date: {appointmentDate}\\n⏰ Requested Time: {appointmentTime}\\n⏳ Status: Pending Approval\\n\\nYou will be notified once the CEO approves or rejects the request.'
          },
          {
            stepId: 'appointment_cancelled',
            stepType: 'message',
            stepName: 'Cancelled',
            messageText: '🚫 *Cancelled*\\n\\nAppointment booking has been cancelled.'
          }
        ],
        triggers: [
          {
            triggerType: 'button_click',
            triggerValue: 'appointment',
            startStepId: 'appointment_start'
          }
        ],
        supportedLanguages: ['en', 'hi', 'mr', 'or'],
        defaultLanguage: 'en',
        settings: {
          sessionTimeout: 30,
          enableTypingIndicator: true,
          enableReadReceipts: true,
          maxRetries: 3,
          errorFallbackMessage: 'We encountered an error. Please try again later.'
        },
        createdBy,
        updatedBy: createdBy
      });
    }

    // 3. DEFAULT TRACKING FLOW
    defaultFlows.push({
      companyId: companyObjectId,
      flowName: 'Default Tracking Flow',
      flowDescription: 'Standard status tracking flow. Customize this flow to match your requirements.',
      flowType: 'tracking',
      isActive: false,
      version: 1,
      startStepId: 'track_start',
      steps: [
        {
          stepId: 'track_start',
          stepType: 'input',
          stepName: 'Collect Reference Number',
          messageText: '🔍 *Track Status*\\n\\nPlease enter your Reference Number:',
          inputConfig: {
            inputType: 'text',
            validation: {
              required: true,
              minLength: 5
            },
            saveToField: 'referenceNumber',
            nextStepId: 'track_result'
          }
        },
        {
          stepId: 'track_result',
          stepType: 'message',
          stepName: 'Show Status',
          messageText: '📊 *Status Information*\\n\\nReference: {referenceNumber}\\nStatus: {status}\\nLast Updated: {lastUpdated}\\n\\nThank you for using our tracking service.'
        }
      ],
      triggers: [
        {
          triggerType: 'button_click',
          triggerValue: 'track',
          startStepId: 'track_start'
        }
      ],
      supportedLanguages: ['en', 'hi', 'mr', 'or'],
      defaultLanguage: 'en',
      settings: {
        sessionTimeout: 30,
        enableTypingIndicator: true,
        enableReadReceipts: true,
        maxRetries: 3,
        errorFallbackMessage: 'We encountered an error. Please try again later.'
      },
      createdBy,
      updatedBy: createdBy
    });

    // Create all default flows
    const createdFlows = await ChatbotFlow.insertMany(defaultFlows);
    console.log(`✅ Created ${createdFlows.length} default flow(s) for company ${company.companyId}:`);
    createdFlows.forEach((flow: any) => {
      console.log(`   - ${flow.flowName} (${flow.flowType}) - ${flow.flowId || flow._id}`);
    });

    return;
    
    END OF DISABLED CODE */
  } catch (error: any) {
    console.error('❌ Error generating default flows:', error);
    throw error;
  }
}

/**
 * Check if default flows exist for a company
 * Note: This uses setOptions to bypass the pre-find middleware that filters deleted flows
 */
export async function hasDefaultFlows(companyId: string | mongoose.Types.ObjectId): Promise<boolean> {
  try {
    const companyObjectId = typeof companyId === 'string' 
      ? (mongoose.Types.ObjectId.isValid(companyId) ? new mongoose.Types.ObjectId(companyId) : companyId)
      : companyId;

    // Check for default flows
    const existingFlow = await ChatbotFlow.findOne({ 
      companyId: companyObjectId,
      flowType: { $in: ['grievance', 'appointment', 'tracking'] }
    });

    const exists = !!existingFlow;
    console.log(`🔍 Checking default flows for company ${companyObjectId}: ${exists ? 'EXISTS' : 'NOT FOUND'}`);
    
    if (exists) {
      console.log(`   Found flow: ${existingFlow.flowName} (${existingFlow.flowType})`);
    }
    
    return exists;
  } catch (error) {
    console.error('❌ Error checking default flows:', error);
    return false;
  }
}
