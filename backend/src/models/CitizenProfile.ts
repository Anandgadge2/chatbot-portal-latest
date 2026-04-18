import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ICitizenProfile extends Document {
  companyId: mongoose.Types.ObjectId;
  phone_number: string;
  phoneNumber?: string;
  name?: string;
  citizen_consent: boolean;
  consentGiven?: boolean;
  citizen_consent_timestamp?: Date;
  consentTimestamp?: Date;
  consent_source?: 'whatsapp_button' | 'whatsapp_text';
  admin_consent: boolean;
  admin_consent_timestamp?: Date;
  opt_out: boolean;
  isSubscribed?: boolean;
  lastUserInteractionAt?: Date;
  lastGrievanceDate?: Date;
  isFlagged?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CitizenProfileSchema = new Schema<ICitizenProfile>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true
    },
    phone_number: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    phoneNumber: {
      type: String,
      trim: true,
      index: true
    },
    name: {
      type: String,
      trim: true
    },
    citizen_consent: {
      type: Boolean,
      default: false,
      index: true
    },
    consentGiven: {
      type: Boolean,
      default: false,
      index: true
    },
    citizen_consent_timestamp: {
      type: Date,
      default: null
    },
    consentTimestamp: {
      type: Date,
      default: null
    },
    consent_source: {
      type: String,
      enum: ['whatsapp_button', 'whatsapp_text'],
      default: null
    },
    admin_consent: {
      type: Boolean,
      default: false,
      index: true
    },
    admin_consent_timestamp: {
      type: Date,
      default: null
    },
    opt_out: {
      type: Boolean,
      default: false,
      index: true
    },
    isSubscribed: {
      type: Boolean,
      default: true,
      index: true
    },
    lastUserInteractionAt: {
      type: Date,
      default: null,
      index: true
    },
    lastGrievanceDate: {
      type: Date,
      default: null
    },
    isFlagged: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

CitizenProfileSchema.index({ companyId: 1, phone_number: 1 }, { unique: true });

const CitizenProfile: Model<ICitizenProfile> = mongoose.model<ICitizenProfile>('CitizenProfile', CitizenProfileSchema);

export default CitizenProfile;
