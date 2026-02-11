import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Company WhatsApp Configuration Model
 * 
 * Stores WhatsApp Business API credentials and settings per company
 * Enables multi-tenant chatbot with different phone numbers
 */

export interface ICompanyWhatsAppConfig extends Document {
  companyId: mongoose.Types.ObjectId;
  
  // WhatsApp Business API Credentials
  phoneNumber: string; // Actual phone number (e.g., '9821550841')
  displayPhoneNumber: string; // Formatted (e.g., '+91 98215 50841')
  phoneNumberId: string; // Meta Phone Number ID (unique identifier)
  businessAccountId: string; // WhatsApp Business Account ID
  accessToken: string; // Access token for API calls
  verifyToken: string; // Webhook verification token
  
  // Webhook Configuration
  webhookUrl?: string; // Optional custom webhook URL
  webhookSecret?: string; // For webhook signature verification
  
  // Chatbot Settings
  chatbotSettings: {
    isEnabled: boolean;
    defaultLanguage: string;
    supportedLanguages: string[];
    welcomeMessage: string;
    offlineMessage?: string;
    businessHours?: {
      enabled: boolean;
      timezone: string;
      schedule: Array<{
        day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
        startTime: string; // '09:00'
        endTime: string; // '18:00'
        isOpen: boolean;
      }>;
    };
  };
  
  // Active Flow Assignment
  activeFlows: Array<{
    flowId: mongoose.Types.ObjectId;
    flowType: 'grievance' | 'appointment' | 'tracking' | 'custom';
    isActive: boolean;
    priority: number; // For flow selection priority
  }>;
  
  // Rate Limiting
  rateLimits: {
    messagesPerMinute: number;
    messagesPerHour: number;
    messagesPerDay: number;
  };
  
  // Analytics
  stats: {
    totalMessagesSent: number;
    totalMessagesReceived: number;
    totalConversations: number;
    lastMessageAt?: Date;
  };
  
  // Status
  isActive: boolean;
  isVerified: boolean;
  verifiedAt?: Date;
  
  // Audit
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  
  createdAt: Date;
  updatedAt: Date;
}

const CompanyWhatsAppConfigSchema: Schema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      unique: true
    },
    phoneNumber: {
      type: String,
      required: true,
      unique: true
    },
    displayPhoneNumber: {
      type: String,
      required: true
    },
    phoneNumberId: {
      type: String,
      required: true,
      unique: true
    },
    businessAccountId: {
      type: String,
      required: true
    },
    accessToken: {
      type: String,
      required: true
    },
    verifyToken: {
      type: String,
      required: true
    },
    webhookUrl: String,
    webhookSecret: String,
    chatbotSettings: {
      isEnabled: { type: Boolean, default: true },
      defaultLanguage: { type: String, default: 'en' },
      supportedLanguages: { type: [String], default: ['en'] },
      welcomeMessage: { 
        type: String, 
        default: 'Welcome! How can we help you today?' 
      },
      offlineMessage: String,
      businessHours: {
        enabled: { type: Boolean, default: false },
        timezone: { type: String, default: 'Asia/Kolkata' },
        schedule: [{
          day: {
            type: String,
            enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
          },
          startTime: String,
          endTime: String,
          isOpen: Boolean
        }]
      }
    },
    activeFlows: [{
      flowId: {
        type: Schema.Types.ObjectId,
        ref: 'ChatbotFlow'
      },
      flowType: {
        type: String,
        enum: ['grievance', 'appointment', 'tracking', 'custom']
      },
      isActive: { type: Boolean, default: true },
      priority: { type: Number, default: 0 }
    }],
    rateLimits: {
      messagesPerMinute: { type: Number, default: 60 },
      messagesPerHour: { type: Number, default: 1000 },
      messagesPerDay: { type: Number, default: 10000 }
    },
    stats: {
      totalMessagesSent: { type: Number, default: 0 },
      totalMessagesReceived: { type: Number, default: 0 },
      totalConversations: { type: Number, default: 0 },
      lastMessageAt: Date
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    verifiedAt: Date,
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

// Indexes for fast lookup
CompanyWhatsAppConfigSchema.index({ phoneNumberId: 1, isActive: 1 });
CompanyWhatsAppConfigSchema.index({ companyId: 1, isActive: 1 });

// Methods
CompanyWhatsAppConfigSchema.methods.incrementMessageCount = async function(type: 'sent' | 'received') {
  if (type === 'sent') {
    this.stats.totalMessagesSent += 1;
  } else {
    this.stats.totalMessagesReceived += 1;
  }
  this.stats.lastMessageAt = new Date();
  await this.save();
};

const CompanyWhatsAppConfig: Model<ICompanyWhatsAppConfig> = mongoose.model<ICompanyWhatsAppConfig>(
  'CompanyWhatsAppConfig',
  CompanyWhatsAppConfigSchema
);

export default CompanyWhatsAppConfig;
