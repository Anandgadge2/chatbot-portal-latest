import mongoose, { Schema, Document, Model } from 'mongoose';
import { CompanyType } from '../config/constants';

export interface ICompany extends Document {
  companyId: string;
  name: string;
  nameHi?: string;
  nameOr?: string;
  nameMr?: string;
  companyType: CompanyType;
  enabledModules: string[];
  selectedLanguages: string[];
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  theme: {
    primaryColor: string;
    secondaryColor: string;
    logoUrl?: string;
  };
  notificationSettings?: {
    roles: {
      [role: string]: {
        email: boolean;
        whatsapp: boolean;
      };
    };
  };
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
    enabledModules: [{ type: String }],
    selectedLanguages: [{
      type: String,
      enum: ['en', 'hi', 'or', 'mr']
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
    notificationSettings: {
      roles: {
        type: Map,
        of: {
          email: { type: Boolean, default: true },
          whatsapp: { type: Boolean, default: true }
        },
        default: {}
      }
    },
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

CompanySchema.index({ companyType: 1 });
CompanySchema.index({ isActive: 1, isSuspended: 1 });

CompanySchema.pre('validate', function (next) {
  const doc = this as any;

  if (!Array.isArray(doc.selectedLanguages) || doc.selectedLanguages.length === 0) {
    doc.selectedLanguages = ['en'];
  }

  if (!doc.selectedLanguages.includes('en')) {
    doc.selectedLanguages.unshift('en');
  }

  doc.selectedLanguages = Array.from(new Set(doc.selectedLanguages));
  next();
});

CompanySchema.pre('save', async function (next) {
  if (this.isNew && !this.companyId) {
    try {
      const { getNextCompanyId } = await import('../utils/idGenerator');
      this.companyId = await getNextCompanyId();
    } catch (error) {
      return next(error as any);
    }
  }

  next();
});

const Company: Model<ICompany> = mongoose.model<ICompany>('Company', CompanySchema);

export default Company;
