import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Company Email (SMTP) Configuration Model
 *
 * Stores SMTP credentials and settings per company.
 * Used for sending notifications (grievance, appointment, etc.) instead of .env.
 */

export interface ICompanyEmailConfig extends Document {
  companyId: mongoose.Types.ObjectId;

  // SMTP
  host: string;
  port: number;
  secure: boolean; // true for 465, false for 587 (STARTTLS)
  auth: {
    user: string;
    pass: string;
  };
  fromEmail: string; // e.g. noreply@example.com
  fromName: string; // e.g. "Zilla Parishad Amravati"

  isActive: boolean;
  isVerified?: boolean;
  verifiedAt?: Date;

  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const CompanyEmailConfigSchema: Schema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      unique: true,
      index: true
    },
    host: {
      type: String,
      required: true,
      trim: true,
      default: 'smtp.gmail.com'
    },
    port: {
      type: Number,
      required: true,
      default: 465
    },
    secure: {
      type: Boolean,
      default: true // 465 = true, 587 = false
    },
    auth: {
      user: { type: String, required: true, trim: true },
      pass: { type: String, required: true }
    },
    fromEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    fromName: {
      type: String,
      required: true,
      trim: true,
      default: 'Dashboard Notifications'
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    isVerified: { type: Boolean, default: false },
    verifiedAt: { type: Date },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  {
    timestamps: true
  }
);

CompanyEmailConfigSchema.index({ companyId: 1, isActive: 1 });

const CompanyEmailConfig: Model<ICompanyEmailConfig> = mongoose.model<ICompanyEmailConfig>(
  'CompanyEmailConfig',
  CompanyEmailConfigSchema
);

export default CompanyEmailConfig;
