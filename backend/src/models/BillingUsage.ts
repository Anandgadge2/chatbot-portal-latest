import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IBillingUsage extends Document {
  companyId: mongoose.Types.ObjectId;
  date: string; // YYYY-MM-DD
  inboundMessages: number;
  outboundMessages: number;
  conversations: number;
  templateMessages: number;
  createdAt: Date;
  updatedAt: Date;
}

const BillingUsageSchema = new Schema<IBillingUsage>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    date: { type: String, required: true, index: true },
    inboundMessages: { type: Number, default: 0 },
    outboundMessages: { type: Number, default: 0 },
    conversations: { type: Number, default: 0 },
    templateMessages: { type: Number, default: 0 },
  },
  { timestamps: true }
);

BillingUsageSchema.index({ companyId: 1, date: 1 }, { unique: true });

const BillingUsage: Model<IBillingUsage> = mongoose.model<IBillingUsage>('BillingUsage', BillingUsageSchema);
export default BillingUsage;
