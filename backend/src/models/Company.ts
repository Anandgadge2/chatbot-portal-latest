import mongoose, { Schema, Document, Model } from 'mongoose';
import { CompanyType, Module } from '../config/constants';

export interface ICompany extends Document {
  companyId: string;
  name: string;
  /** Display name in Hindi */
  nameHi?: string;
  /** Display name in Odia */
  nameOr?: string;
  /** Display name in Marathi */
  nameMr?: string;
  companyType: CompanyType;
  enabledModules: Module[];
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  theme: {
    primaryColor: string;
    secondaryColor: string;
    logoUrl?: string;
  };
  // Note: whatsappConfig moved to CompanyWhatsAppConfig model
  // Note: chatbotConfig moved to ChatbotFlow model
  isActive: boolean;
  isSuspended: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CompanySchema: Schema = new Schema(
  {
    companyId: {
      type: String,
      required: false,
      unique: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    nameHi: { type: String, trim: true },
    nameOr: { type: String, trim: true },
    nameMr: { type: String, trim: true },
    companyType: {
      type: String,
      enum: Object.values(CompanyType),
      required: true
    },
    enabledModules: [{
      type: String,
      enum: Object.values(Module)
    }],
    contactEmail: {
      type: String,
      required: false,
      lowercase: true,
      trim: true
    },
    contactPhone: {
      type: String,
      required: false
    },
    address: {
      type: String,
      trim: true
    },
    theme: {
      primaryColor: {
        type: String,
        default: '#0f4c81'
      },
      secondaryColor: {
        type: String,
        default: '#1a73e8'
      },
      logoUrl: {
        type: String
      }
    },
    // Removed: whatsappConfig - now in CompanyWhatsAppConfig model
    // Removed: chatbotConfig - now in ChatbotFlow model
    isActive: {
      type: Boolean,
      default: true
    },
    isSuspended: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Indexes
CompanySchema.index({ companyType: 1 });
CompanySchema.index({ isActive: 1, isSuspended: 1 });

// Pre-save hook to generate companyId
CompanySchema.pre('save', async function (next) {
  if (this.isNew && !this.companyId) {
    // Find the last companyId globally, including soft-deleted ones
    const lastCompany = await mongoose.model('Company')
      .findOne({}, { companyId: 1 })
      .sort({ companyId: -1 });

    let nextNum = 1;
    if (lastCompany && lastCompany.companyId) {
      const match = lastCompany.companyId.match(/^CMP(\d+)$/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }

    this.companyId = `CMP${String(nextNum).padStart(6, '0')}`;
  }
  next();
});

const Company: Model<ICompany> = mongoose.model<ICompany>('Company', CompanySchema);

export default Company;
