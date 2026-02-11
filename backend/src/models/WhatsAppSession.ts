import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IWhatsAppSession extends Document {
  phoneNumber: string;
  companyId: mongoose.Types.ObjectId;
  currentFlow?: string;
  currentStep?: string;
  sessionData: any;
  language?: string;
  lastMessageAt: Date;
  isActive: boolean;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WhatsAppSessionSchema: Schema = new Schema(
  {
    phoneNumber: {
      type: String,
      required: true,
      index: true
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: false,
      index: true
    },
    currentFlow: {
      type: String
    },
    currentStep: {
      type: String
    },
    sessionData: {
      type: Schema.Types.Mixed,
      default: {}
    },
    language: {
      type: String,
      default: 'en'
    },
    lastMessageAt: {
      type: Date,
      default: Date.now
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true
      // Note: Index is created below with TTL option
    }
  },
  {
    timestamps: true
  }
);

// Compound index for finding active sessions
WhatsAppSessionSchema.index({ phoneNumber: 1, companyId: 1, isActive: 1 });

// TTL index to auto-delete expired sessions (also creates regular index)
WhatsAppSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const WhatsAppSession: Model<IWhatsAppSession> = mongoose.model<IWhatsAppSession>('WhatsAppSession', WhatsAppSessionSchema);

export default WhatsAppSession;
