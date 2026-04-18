import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ICitizenProfile extends Document {
  companyId: mongoose.Types.ObjectId;
  phone_number: string;
  citizen_consent: boolean;
  citizen_consent_timestamp?: Date;
  consent_source?: 'whatsapp_button';
  admin_consent: boolean;
  admin_consent_timestamp?: Date;
  opt_out: boolean;
  lastUserInteractionAt?: Date;
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
    citizen_consent: {
      type: Boolean,
      default: false,
      index: true
    },
    citizen_consent_timestamp: {
      type: Date,
      default: null
    },
    consent_source: {
      type: String,
      enum: ['whatsapp_button'],
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
    lastUserInteractionAt: {
      type: Date,
      default: null,
      index: true
    }
  },
  { timestamps: true }
);

CitizenProfileSchema.index({ companyId: 1, phone_number: 1 }, { unique: true });

const CitizenProfile: Model<ICitizenProfile> = mongoose.model<ICitizenProfile>('CitizenProfile', CitizenProfileSchema);

export default CitizenProfile;
