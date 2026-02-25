import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ICompanySubscription extends Document {
  companyId: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
  status: 'active' | 'paused' | 'cancelled';
  billingCycle: 'monthly';
  startDate: Date;
  nextBillingDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CompanySubscriptionSchema = new Schema<ICompanySubscription>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, unique: true, index: true },
    planId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true },
    status: { type: String, enum: ['active', 'paused', 'cancelled'], default: 'active', index: true },
    billingCycle: { type: String, enum: ['monthly'], default: 'monthly' },
    startDate: { type: Date, default: Date.now },
    nextBillingDate: { type: Date, required: true },
  },
  { timestamps: true }
);

const CompanySubscription: Model<ICompanySubscription> = mongoose.model<ICompanySubscription>('CompanySubscription', CompanySubscriptionSchema);
export default CompanySubscription;
