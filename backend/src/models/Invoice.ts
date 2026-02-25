import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IInvoice extends Document {
  companyId: mongoose.Types.ObjectId;
  subscriptionId: mongoose.Types.ObjectId;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  baseAmount: number;
  overageAmount: number;
  totalAmount: number;
  currency: string;
  status: 'draft' | 'issued' | 'paid' | 'overdue';
  issuedAt?: Date;
  dueAt?: Date;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceSchema = new Schema<IInvoice>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'CompanySubscription', required: true, index: true },
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    periodStart: { type: String, required: true },
    periodEnd: { type: String, required: true },
    baseAmount: { type: Number, required: true, min: 0 },
    overageAmount: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    status: { type: String, enum: ['draft', 'issued', 'paid', 'overdue'], default: 'issued', index: true },
    issuedAt: { type: Date },
    dueAt: { type: Date },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

InvoiceSchema.index({ companyId: 1, periodStart: 1, periodEnd: 1 }, { unique: true });

const Invoice: Model<IInvoice> = mongoose.model<IInvoice>('Invoice', InvoiceSchema);
export default Invoice;
