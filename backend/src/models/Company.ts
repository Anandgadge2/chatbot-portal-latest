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
  enabledModules: string[];
  showDepartmentPriorityColumn?: boolean;
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
        actions?: {
          [action: string]: { email: boolean, whatsapp: boolean };
        };
      };
    };
  };
  slaSettings?: {
    defaultSlaHours: number;
  };
  isActive: boolean;
  isSuspended: boolean;
  permissionsVersion: number;
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
      type: String
    }],
    showDepartmentPriorityColumn: {
      type: Boolean,
      default: true
    },
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
          whatsapp: { type: Boolean, default: true },
          actions: {
            grievance_created: {
              email: { type: Boolean, default: true },
              whatsapp: { type: Boolean, default: true }
            },
            grievance_assigned: {
              email: { type: Boolean, default: true },
              whatsapp: { type: Boolean, default: true }
            },
            grievance_resolved: {
              email: { type: Boolean, default: true },
              whatsapp: { type: Boolean, default: true }
            },
            grievance_status_update: {
              email: { type: Boolean, default: true },
              whatsapp: { type: Boolean, default: true }
            },
            grievance_reminder: {
              email: { type: Boolean, default: true },
              whatsapp: { type: Boolean, default: true }
            },
            grievance_reverted: {
              email: { type: Boolean, default: true },
              whatsapp: { type: Boolean, default: true }
            },
            appointment_created: {
              email: { type: Boolean, default: true },
              whatsapp: { type: Boolean, default: true }
            },
            appointment_scheduled: {
              email: { type: Boolean, default: true },
              whatsapp: { type: Boolean, default: true }
            }
          }
        },
        default: {}
      }
    },
    slaSettings: {
      defaultSlaHours: {
        type: Number,
        default: 120 // Default 5 days
      }
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isSuspended: {
      type: Boolean,
      default: false
    },
    permissionsVersion: {
      type: Number,
      default: 1,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Indexes
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
