import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IDepartment extends Document {
  departmentId: string;
  companyId: mongoose.Types.ObjectId;
  name: string;
  /** Display name in Hindi (for chatbot list when user selects Hindi) */
  nameHi?: string;
  /** Display name in Odia (for chatbot list when user selects Odia) */
  nameOr?: string;
  /** Display name in Marathi (for chatbot list when user selects Marathi) */
  nameMr?: string;
  description?: string;
  /** Description in Hindi */
  descriptionHi?: string;
  /** Description in Odia */
  descriptionOr?: string;
  /** Description in Marathi */
  descriptionMr?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DepartmentSchema: Schema = new Schema(
  {
    departmentId: {
      type: String,
      required: false,
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
      required: true,
      trim: true
    },
    nameHi: { type: String, trim: true },
    nameOr: { type: String, trim: true },
    nameMr: { type: String, trim: true },
    description: {
      type: String,
      trim: true
    },
    descriptionHi: { type: String, trim: true },
    descriptionOr: { type: String, trim: true },
    descriptionMr: { type: String, trim: true },
    contactPerson: {
      type: String,
      trim: true
    },
    contactEmail: {
      type: String,
      lowercase: true,
      trim: true
    },
    contactPhone: {
      type: String
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes
DepartmentSchema.index({ companyId: 1, name: 1 }, { unique: true });

// Pre-save hook to generate departmentId
DepartmentSchema.pre('save', async function (next) {
  if (this.isNew && !this.departmentId) {
    // Find the last departmentId globally, including soft-deleted docs
    const lastDept = await mongoose.model('Department')
      .findOne({}, { departmentId: 1 })
      .sort({ departmentId: -1 });

    let nextNum = 1;
    if (lastDept && lastDept.departmentId) {
      const match = lastDept.departmentId.match(/^DEPT(\d+)$/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    
    this.departmentId = `DEPT${String(nextNum).padStart(6, '0')}`;
  }
  next();
});

const Department: Model<IDepartment> = mongoose.model<IDepartment>('Department', DepartmentSchema);

export default Department;
