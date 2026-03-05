import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Company WhatsApp Template Model
 * Stores customizable WhatsApp message templates per company (e.g. grievance_created, grievance_assigned).
 * Message supports placeholders: {citizenName}, {grievanceId}, {departmentName}, etc.
 */

// Built-in system keys — companies may also add custom keys (e.g. 'grievance_escalated')
export type WhatsAppTemplateKey =
  | 'grievance_created'
  | 'grievance_assigned'
  | 'grievance_resolved'
  | 'appointment_created'
  | 'appointment_assigned'
  | 'appointment_resolved'
  | string; // custom keys allowed

export interface ICompanyWhatsAppTemplate extends Document {
  companyId: mongoose.Types.ObjectId;
  templateKey: string;          // e.g. 'grievance_created', or custom key
  label?: string;               // Human-readable label
  message: string;              // Message body
  keywords?: string[];          // For command templates (stop, restart, etc.)
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
      trim: true,
      index: true
      // No enum — companies can create custom notification templates freely
    },
    label: {
      type: String,
      trim: true
    },
    message: { type: String, required: true },
    keywords: { type: [String], default: [] },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

CompanyWhatsAppTemplateSchema.index({ companyId: 1, templateKey: 1 }, { unique: true });

const CompanyWhatsAppTemplate: Model<ICompanyWhatsAppTemplate> =
  mongoose.model<ICompanyWhatsAppTemplate>('CompanyWhatsAppTemplate', CompanyWhatsAppTemplateSchema);

export default CompanyWhatsAppTemplate;
