import mongoose, { Schema, Document, Model } from 'mongoose';
import { LeadStatus } from '../config/constants';

export interface ILead extends Document {
  leadId: string;
  companyId: mongoose.Types.ObjectId;
  name: string;
  companyName?: string;
  projectType: string;
  projectDescription: string;
  budgetRange?: string;
  timeline?: string;
  contactInfo: string;
  email?: string;
  phone?: string;
  status: LeadStatus;
  source: 'whatsapp' | 'web' | 'manual';
  metadata?: Record<string, any>;
  assignedTo?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LeadSchema: Schema = new Schema(
  {
    leadId: { 
      type: String, 
      unique: true, 
      index: true 
    },
    companyId: { 
      type: Schema.Types.ObjectId, 
      ref: 'Company', 
      required: true, 
      index: true 
    },
    name: { 
      type: String, 
      required: true 
    },
    companyName: { 
      type: String 
    },
    projectType: { 
      type: String, 
      required: true 
    },
    projectDescription: { 
      type: String, 
      required: true 
    },
    budgetRange: { 
      type: String 
    },
    timeline: { 
      type: String 
    },
    contactInfo: { 
      type: String, 
      required: true 
    },
    email: { 
      type: String, 
      lowercase: true, 
      trim: true 
    },
    phone: { 
      type: String 
    },
    status: {
      type: String,
      enum: Object.values(LeadStatus),
      default: LeadStatus.NEW,
      index: true
    },
    source: {
      type: String,
      enum: ['whatsapp', 'web', 'manual'],
      default: 'whatsapp'
    },
    metadata: { 
      type: Schema.Types.Mixed 
    },
    assignedTo: { 
      type: Schema.Types.ObjectId, 
      ref: 'User' 
    }
  },
  { 
    timestamps: true 
  }
);

// Pre-save hook to generate leadId
LeadSchema.pre('save', async function (next) {
  if (this.isNew && !this.leadId) {
    const count = await mongoose.model('Lead').countDocuments();
    this.leadId = `LEAD${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

const Lead: Model<ILead> = mongoose.model<ILead>('Lead', LeadSchema);
export default Lead;
