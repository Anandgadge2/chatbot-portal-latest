import mongoose, { Document, Model, Schema } from 'mongoose';

export type TemplateCategory = 'UTILITY' | 'AUTHENTICATION' | 'MARKETING';
export type TemplateStatus = 'APPROVED' | 'PENDING' | 'REJECTED';

export interface IWhatsAppTemplate extends Document {
  companyId: mongoose.Types.ObjectId;
  metaTemplateId?: string;
  name: string;
  language: string;
  category: TemplateCategory;
  status: TemplateStatus;
  header: {
    type: 'TEXT' | 'IMAGE' | 'VIDEO' | null;
    content: string;
  };
  body: {
    text: string;
    variables: number;
  };
  footer: string;
  buttons: Array<{
    type: 'QUICK_REPLY' | 'URL' | 'PHONE';
    text: string;
    value: string;
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
      content: { type: String, default: '' }
    },
    body: {
      text: { type: String, default: '' },
      variables: { type: Number, default: 0 }
    },
    footer: { type: String, default: '' },
    buttons: [
      {
        type: {
          type: String,
          enum: ['QUICK_REPLY', 'URL', 'PHONE'],
          required: true
        },
        text: { type: String, required: true },
        value: { type: String, default: '' }
      }
    ],
    isActive: { type: Boolean, default: true, index: true },
    lastSyncedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

WhatsAppTemplateSchema.index({ companyId: 1, name: 1, language: 1 }, { unique: true });

const WhatsAppTemplate: Model<IWhatsAppTemplate> = mongoose.model<IWhatsAppTemplate>('WhatsAppTemplate', WhatsAppTemplateSchema);

export default WhatsAppTemplate;
