import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Company Email Template Model
 * Stores customizable email templates per company (e.g. grievance_created, grievance_assigned).
 * Subject and htmlBody support placeholders: {citizenName}, {grievanceId}, {departmentName}, etc.
 */

export type EmailTemplateKey =
  | 'grievance_created'
  | 'grievance_assigned'
  | 'grievance_resolved'
  | 'appointment_created'
  | 'appointment_assigned'
  | 'appointment_resolved';

export interface ICompanyEmailTemplate extends Document {
  companyId: mongoose.Types.ObjectId;
  templateKey: EmailTemplateKey;
  subject: string;
  htmlBody: string;
  textBody?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CompanyEmailTemplateSchema: Schema = new Schema(
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
    subject: { type: String, required: true, trim: true },
    htmlBody: { type: String, required: true },
    textBody: { type: String },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

CompanyEmailTemplateSchema.index({ companyId: 1, templateKey: 1 }, { unique: true });

const CompanyEmailTemplate: Model<ICompanyEmailTemplate> = mongoose.model<ICompanyEmailTemplate>(
  'CompanyEmailTemplate',
  CompanyEmailTemplateSchema
);

export default CompanyEmailTemplate;
