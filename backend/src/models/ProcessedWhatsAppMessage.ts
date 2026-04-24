import mongoose, { Schema, Document } from 'mongoose';

export interface IProcessedWhatsAppMessage extends Document {
  messageId: string;
  processedAt: Date;
  expireAt: Date;
}

const ProcessedWhatsAppMessageSchema = new Schema<IProcessedWhatsAppMessage>(
  {
    messageId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true
    },
    processedAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    expireAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }
    }
  },
  {
    timestamps: false,
    versionKey: false
  }
);

ProcessedWhatsAppMessageSchema.index({ messageId: 1 }, { unique: true });

export default mongoose.models.ProcessedWhatsAppMessage ||
  mongoose.model<IProcessedWhatsAppMessage>('ProcessedWhatsAppMessage', ProcessedWhatsAppMessageSchema);
