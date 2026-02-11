import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Chatbot Flow Template Model
 * 
 * Defines the complete chatbot conversation flow for a company
 * Fully customizable from superadmin dashboard
 */

export interface IFlowStep {
  stepId: string;
  stepType: 'start' | 'message' | 'buttons' | 'list' | 'input' | 'media' | 'condition' | 'api_call' | 'delay' | 'assign_department' | 'dynamic_response';
  stepName: string;
  
  // Message configuration
  messageText?: string; // Can contain placeholders like {name}, {date}, etc.
  // Removed: messageTemplate - redundant, messageText can handle templates
  
  // Button configuration
  buttons?: Array<{
    id: string;
    title: string;
    description?: string;
    nextStepId?: string; // Which step to go to when clicked
    action?: 'next' | 'end' | 'restart' | 'goto';
  }>;
  
  // List configuration (for WhatsApp lists)
  listConfig?: {
    listSource?: 'manual' | 'departments'; // 'departments' = load from company departments at runtime
    buttonText: string;
    sections: Array<{
      title: string;
      rows: Array<{
        id: string;
        title: string;
        description?: string;
        nextStepId?: string;
      }>;
    }>;
  };
  
  // Input configuration
  inputConfig?: {
    inputType: 'text' | 'number' | 'email' | 'phone' | 'date' | 'image' | 'document' | 'location';
    validation?: {
      required: boolean;
      minLength?: number;
      maxLength?: number;
      pattern?: string;
      errorMessage?: string;
    };
    placeholder?: string;
    saveToField: string; // Field name to save input (e.g., 'citizenName', 'description')
    nextStepId?: string;
  };
  
  // Media configuration
  mediaConfig?: {
    mediaType: 'image' | 'document' | 'video';
    mediaUrl?: string; // For sending media
    optional: boolean;
    saveToField?: string;
    nextStepId?: string;
  };
  
  // Condition/Branch configuration
  conditionConfig?: {
    field: string; // Field to check (e.g., 'citizenName', 'category')
    operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'exists';
    value: any;
    trueStepId: string;
    falseStepId: string;
  };
  
  // API Call configuration
  apiConfig?: {
    method: 'GET' | 'POST' | 'PUT';
    endpoint: string;
    headers?: Record<string, string>;
    body?: Record<string, any>;
    saveResponseTo?: string;
    nextStepId?: string;
  };
  
  // Timeout and retry
  timeout?: number; // in seconds
  retryOnFailure?: boolean;
  
  // Variables and dynamic content
  variables?: Record<string, any>;
  
  // Expected responses/triggers for routing
  expectedResponses?: Array<{
    type: 'text' | 'button_click' | 'list_selection' | 'any';
    value: string; // The expected input value (e.g., 'yes', 'no', 'lang_en', '*' for any)
    nextStepId?: string; // Which step to go to when this response is received
  }>;
  
  // Next step (default if no specific nextStepId)
  nextStepId?: string;
}

export interface IFlowTrigger {
  triggerType: 'keyword' | 'button_click' | 'menu_selection' | 'webhook';
  triggerValue: string; // 'hi', 'hello', 'menu_grievance', etc.
  startStepId: string; // Which step to start with
}

export interface IChatbotFlow extends Document {
  flowId: string;
  companyId: mongoose.Types.ObjectId;
  
  // Flow metadata
  flowName: string;
  flowDescription?: string;
  flowType: 'grievance' | 'appointment' | 'tracking' | 'custom';
  isActive: boolean;
  version: number;
  
  // Flow configuration
  startStepId: string; // Initial step when flow is triggered
  steps: IFlowStep[];
  
  // Triggers
  triggers: IFlowTrigger[];
  
  // Language support
  supportedLanguages: string[]; // ['en', 'hi', 'mr']
  defaultLanguage: string;
  
  // Translations (for multi-language support)
  translations?: Record<string, Record<string, string>>; // { en: { key: value }, hi: { key: value } }
  
  // Settings
  settings: {
    sessionTimeout: number; // in minutes
    enableTypingIndicator: boolean;
    enableReadReceipts: boolean;
    maxRetries: number;
    errorFallbackMessage: string;
  };
  
  // Analytics
  usageCount: number;
  lastUsedAt?: Date;
  
  // Audit
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  
  createdAt: Date;
  updatedAt: Date;
}

const FlowStepSchema = new Schema({
  stepId: { type: String, required: true },
  stepType: { 
    type: String, 
    enum: ['start', 'message', 'buttons', 'list', 'input', 'media', 'condition', 'api_call', 'delay', 'assign_department', 'dynamic_response'],
    required: true 
  },
  stepName: { type: String, required: true },
  messageText: String, // Can contain placeholders like {name}, {date}, etc.
  // Removed: messageTemplate - redundant, messageText can handle templates
  buttons: [{
    id: String,
    title: String,
    description: String,
    nextStepId: String,
    action: { type: String, enum: ['next', 'end', 'restart', 'goto'] }
  }],
  listConfig: {
    buttonText: String,
    sections: [{
      title: String,
      rows: [{
        id: String,
        title: String,
        description: String,
        nextStepId: String
      }]
    }]
  },
  inputConfig: {
    inputType: { 
      type: String, 
      enum: ['text', 'number', 'email', 'phone', 'date', 'image', 'document', 'location'] 
    },
    validation: {
      required: Boolean,
      minLength: Number,
      maxLength: Number,
      pattern: String,
      errorMessage: String
    },
    placeholder: String,
    saveToField: String,
    nextStepId: String
  },
  mediaConfig: {
    mediaType: { type: String, enum: ['image', 'document', 'video'] },
    mediaUrl: String,
    optional: Boolean,
    saveToField: String,
    nextStepId: String
  },
  conditionConfig: {
    field: String,
    operator: { 
      type: String, 
      enum: ['equals', 'contains', 'greater_than', 'less_than', 'exists'] 
    },
    value: Schema.Types.Mixed,
    trueStepId: String,
    falseStepId: String
  },
  apiConfig: {
    method: { type: String, enum: ['GET', 'POST', 'PUT'] },
    endpoint: String,
    headers: Schema.Types.Mixed,
    body: Schema.Types.Mixed,
    saveResponseTo: String,
    nextStepId: String
  },
  delayConfig: {
    duration: Number,
    unit: { type: String, enum: ['seconds', 'minutes', 'hours'] }
  },
  assignDepartmentConfig: {
    departmentId: String,
    isDynamic: Boolean,
    conditionField: String
  },
  timeout: Number,
  retryOnFailure: Boolean,
  variables: Schema.Types.Mixed,
  expectedResponses: [{
    type: { type: String, enum: ['text', 'button_click', 'list_selection', 'any'], required: true },
    value: { type: String, required: true },
    nextStepId: { type: String, required: false }
  }],
  position: {
    x: Number,
    y: Number
  },
  nextStepId: String
}, { _id: false });

const FlowTriggerSchema = new Schema({
  triggerType: { 
    type: String, 
    enum: ['keyword', 'button_click', 'menu_selection', 'webhook'],
    required: true 
  },
  triggerValue: { type: String, required: true },
  startStepId: { type: String, required: true }
}, { _id: false });

const ChatbotFlowSchema: Schema = new Schema(
  {
    flowId: {
      type: String,
      required: false, // Generated in pre-save hook, but NOT globally unique
      // ❌ Do NOT enforce unique index here:
      // In production we had duplicate key errors on flowId_1 when copying or seeding flows.
      // The Mongo _id is our real primary key; flowId is just a human-friendly code.
      index: true
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true
    },
    flowName: {
      type: String,
      required: true
    },
    flowDescription: String,
    flowType: {
      type: String,
      enum: ['grievance', 'appointment', 'tracking', 'custom'],
      required: true,
      index: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    version: {
      type: Number,
      default: 1
    },
    startStepId: {
      type: String,
      required: true
    },
    steps: {
      type: [FlowStepSchema],
      required: true,
      validate: {
        validator: function(steps: IFlowStep[]) {
          return steps && steps.length > 0;
        },
        message: 'Flow must have at least one step'
      }
    },
    triggers: {
      type: [FlowTriggerSchema],
      required: true
    },
    supportedLanguages: {
      type: [String],
      default: ['en']
    },
    defaultLanguage: {
      type: String,
      default: 'en'
    },
    translations: {
      type: Schema.Types.Mixed,
      default: {}
    },
    settings: {
      sessionTimeout: { type: Number, default: 30 }, // 30 minutes
      enableTypingIndicator: { type: Boolean, default: true },
      enableReadReceipts: { type: Boolean, default: true },
      maxRetries: { type: Number, default: 3 },
      errorFallbackMessage: { 
        type: String, 
        default: 'We encountered an error. Please try again.' 
      }
    },
    usageCount: {
      type: Number,
      default: 0
    },
    lastUsedAt: Date,
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

// Indexes
ChatbotFlowSchema.index({ companyId: 1, flowType: 1, isActive: 1 });
// Note: flowId already has index:true in schema definition, no need to add here
ChatbotFlowSchema.index({ 'triggers.triggerValue': 1, companyId: 1 });

// Pre-save hook to generate flowId
ChatbotFlowSchema.pre('save', async function (next) {
  if (this.isNew && !this.flowId) {
    const count = await mongoose.model('ChatbotFlow').countDocuments();
    this.flowId = `FLOW${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

const ChatbotFlow: Model<IChatbotFlow> = mongoose.model<IChatbotFlow>('ChatbotFlow', ChatbotFlowSchema);

export default ChatbotFlow;
