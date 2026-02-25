import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IConsentLog extends Document {
  companyId: mongoose.Types.ObjectId;
  citizenPhone: string;
  messageId: string;
  messageType: string;
  channel: 'whatsapp';
  consentType: 'implied_interaction';
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const ConsentLogSchema = new Schema<IConsentLog>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    citizenPhone: {
      type: String,
      required: true,
      index: true,
    },
    messageId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    messageType: {
      type: String,
      required: true,
    },
    channel: {
      type: String,
      enum: ['whatsapp'],
      default: 'whatsapp',
      required: true,
    },
    consentType: {
      type: String,
      enum: ['implied_interaction'],
      default: 'implied_interaction',
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

ConsentLogSchema.index({ companyId: 1, createdAt: -1 });

const ConsentLog: Model<IConsentLog> = mongoose.model<IConsentLog>('ConsentLog', ConsentLogSchema);
export default ConsentLog;
