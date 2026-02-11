import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Company WhatsApp Template Model
 * Stores customizable WhatsApp message templates per company (e.g. grievance_created, grievance_assigned).
 * Message supports placeholders: {citizenName}, {grievanceId}, {departmentName}, etc.
 */

export type WhatsAppTemplateKey =
  | 'grievance_created'
  | 'grievance_assigned'
  | 'grievance_resolved'
  | 'appointment_created'
  | 'appointment_assigned'
  | 'appointment_resolved';

export interface ICompanyWhatsAppTemplate extends Document {
  companyId: mongoose.Types.ObjectId;
  templateKey: WhatsAppTemplateKey;
  message: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CompanyWhatsAppTemplateSchema: Schema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true
    },
    templateKey: {
      type: String,
      required: true,
      enum: [
        'grievance_created',
        'grievance_assigned',
        'grievance_resolved',
        'appointment_created',
        'appointment_assigned',
        'appointment_resolved'
      ],
      index: true
    },
    message: { type: String, required: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

CompanyWhatsAppTemplateSchema.index({ companyId: 1, templateKey: 1 }, { unique: true });

const CompanyWhatsAppTemplate: Model<ICompanyWhatsAppTemplate> =
  mongoose.model<ICompanyWhatsAppTemplate>('CompanyWhatsAppTemplate', CompanyWhatsAppTemplateSchema);

export default CompanyWhatsAppTemplate;
