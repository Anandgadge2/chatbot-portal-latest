import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ICompanyTemplateMapping extends Document {
  companyId: mongoose.Types.ObjectId;
  templateName: string;
  mappings: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

const CompanyTemplateMappingSchema = new Schema<ICompanyTemplateMapping>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    templateName: { type: String, required: true, trim: true },
    mappings: { type: Map, of: String, default: {} }
  },
  { timestamps: true }
);

CompanyTemplateMappingSchema.index({ companyId: 1, templateName: 1 }, { unique: true });

const CompanyTemplateMapping: Model<ICompanyTemplateMapping> = mongoose.model<ICompanyTemplateMapping>(
  'CompanyTemplateMapping',
  CompanyTemplateMappingSchema
);

export default CompanyTemplateMapping;
