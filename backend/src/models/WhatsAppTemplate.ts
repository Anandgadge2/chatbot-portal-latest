import mongoose, { Document, Model, Schema } from 'mongoose';

export type TemplateCategory = 'UTILITY' | 'AUTHENTICATION' | 'MARKETING';
export type TemplateStatus = 'APPROVED' | 'PENDING' | 'REJECTED';

export interface IWhatsAppTemplate extends Document {
  companyId: mongoose.Types.ObjectId;
  metaTemplateId?: string;
  businessAccountId?: string;
  name: string;
  language: string;
  category: TemplateCategory;
  status: TemplateStatus;
  header: {
    type: 'TEXT' | 'IMAGE' | 'VIDEO' | null;
    content: string;
    sampleValues?: string[];
  };
  body: {
    text: string;
    variables: number;
    sampleValues?: string[];
  };
  footer: string;
  buttons: Array<{
    type: string;
    text: string;
    value: string;
    otp_type?: string;
    autofill_text?: string;
  }>;
  isActive: boolean;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WhatsAppTemplateSchema = new Schema<IWhatsAppTemplate>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    metaTemplateId: { type: String, index: true },
    businessAccountId: { type: String, index: true },
    name: { type: String, required: true, trim: true },
    language: { type: String, required: true, trim: true, default: 'en_US' },
    category: { type: String, enum: ['UTILITY', 'AUTHENTICATION', 'MARKETING'], required: true },
    status: { type: String, enum: ['APPROVED', 'PENDING', 'REJECTED'], required: true },
    header: {
      type: {
        type: String,
        enum: ['TEXT', 'IMAGE', 'VIDEO', null],
        default: null
      },
      content: { type: String, default: '' },
      sampleValues: { type: [String], default: [] }
    },
    body: {
      text: { type: String, default: '' },
      variables: { type: Number, default: 0 },
      sampleValues: { type: [String], default: [] }
    },
    footer: { type: String, default: '' },
    buttons: [
      {
        type: {
          type: String,
          required: true
        },
        text: { type: String, required: true },
        value: { type: String, default: '' },
        otp_type: { type: String },
        autofill_text: { type: String }
      }
    ],
    isActive: { type: Boolean, default: true, index: true },
    lastSyncedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

WhatsAppTemplateSchema.index({ companyId: 1, name: 1, language: 1, businessAccountId: 1 }, { unique: true });

const WhatsAppTemplate: Model<IWhatsAppTemplate> = mongoose.model<IWhatsAppTemplate>('WhatsAppTemplate', WhatsAppTemplateSchema);

export default WhatsAppTemplate;
