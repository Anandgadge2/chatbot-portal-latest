import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IWhatsAppTemplateSyncLog extends Document {
  companyId: mongoose.Types.ObjectId;
  status: 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED';
  fetchedCount: number;
  upsertedCount: number;
  deactivatedCount: number;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WhatsAppTemplateSyncLogSchema = new Schema<IWhatsAppTemplateSyncLog>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    status: { type: String, enum: ['SUCCESS', 'PARTIAL_SUCCESS', 'FAILED'], required: true },
    fetchedCount: { type: Number, default: 0 },
    upsertedCount: { type: Number, default: 0 },
    deactivatedCount: { type: Number, default: 0 },
    errorMessage: { type: String }
  },
  { timestamps: true }
);

const WhatsAppTemplateSyncLog: Model<IWhatsAppTemplateSyncLog> =
  mongoose.model<IWhatsAppTemplateSyncLog>('WhatsAppTemplateSyncLog', WhatsAppTemplateSyncLogSchema);

export default WhatsAppTemplateSyncLog;
