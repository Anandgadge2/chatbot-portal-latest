import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ISubscriptionPlan extends Document {
  code: string;
  name: string;
  monthlyPrice: number;
  includedConversations: number;
  overagePerConversation: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionPlanSchema = new Schema<ISubscriptionPlan>(
  {
    code: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    monthlyPrice: { type: Number, required: true, min: 0 },
    includedConversations: { type: Number, required: true, min: 0 },
    overagePerConversation: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

const SubscriptionPlan: Model<ISubscriptionPlan> = mongoose.model<ISubscriptionPlan>('SubscriptionPlan', SubscriptionPlanSchema);
export default SubscriptionPlan;
