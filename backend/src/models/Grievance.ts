import mongoose, { Schema, Document, Model } from 'mongoose';
import { GrievanceStatus } from '../config/constants';

export interface IGrievance extends Document {
  grievanceId: string;
  companyId: mongoose.Types.ObjectId;
  departmentId?: mongoose.Types.ObjectId;
  subDepartmentId?: mongoose.Types.ObjectId; // 🏢 Added for hierarchical departments
  additionalDepartmentIds?: mongoose.Types.ObjectId[];
  additionalAssigneeIds?: mongoose.Types.ObjectId[];
  citizenName: string;
  citizenPhone: string;
  phone_number: string;
  citizenWhatsApp?: string;
  description: string;
  message: string;
  category?: string;
  status: GrievanceStatus;
  admin_consent: boolean;
  admin_consent_timestamp?: Date;
  isFlagged?: boolean;
  statusHistory: Array<{
    status: GrievanceStatus;
    changedBy?: mongoose.Types.ObjectId;
    changedAt: Date;
    remarks?: string;
  }>;
  assignedTo?: mongoose.Types.ObjectId;
  assignedAt?: Date;
  location?: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
    address?: string;
  };
  media: Array<{
    url: string;
    type: 'image' | 'document' | 'video';
    mimeType?: string;
    originalName?: string;
    uploadedByRole?: 'citizen' | 'admin';
    uploadedAt: Date;
    uploadedBy?: mongoose.Types.ObjectId;
  }>;
  resolution?: string;
  resolvedAt?: Date;
  closedAt?: Date;
  slaDueDate?: Date;
  slaHours?: number;
  reminderCount?: number;
  reopenedCount?: number;
  lastReminderAt?: Date;
  lastReminderRemarks?: string;
  language: 'en' | 'hi' | 'mr' | 'or';
  timeline: Array<{
    action: string;
    details?: any;
    performedBy?: mongoose.Types.ObjectId;
    timestamp: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const GrievanceSchema: Schema = new Schema(
  {
    grievanceId: {
      type: String,
      required: false, // Set by pre-save hook, not required on input
      index: true
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      index: true
    },
    subDepartmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      index: true
    },
    additionalDepartmentIds: [{
      type: Schema.Types.ObjectId,
      ref: 'Department'
    }],
    additionalAssigneeIds: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }],
    citizenName: {
      type: String,
      required: true,
      trim: true
    },
    citizenPhone: {
      type: String,
      required: true,
      index: true
    },
    phone_number: {
      type: String,
      required: false, // Legacy fallback
      index: true
    },
    citizenWhatsApp: {
      type: String
    },
    description: {
      type: String,
      required: true
    },
    message: {
      type: String,
      required: false // Legacy fallback
    },
    category: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      default: GrievanceStatus.PENDING,
      index: true
    },
    admin_consent: {
      type: Boolean,
      default: false,
      index: true
    },
    admin_consent_timestamp: {
      type: Date
    },
    isFlagged: {
      type: Boolean,
      default: false,
      index: true
    },
    statusHistory: [{
      status: {
        type: String,
        required: true
      },
      changedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
      },
      changedAt: {
        type: Date,
        default: Date.now
      },
      remarks: String
    }],
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    assignedAt: {
      type: Date
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        index: '2dsphere'
      },
      address: String
    },
    media: [{
      url: {
        type: String,
        required: true
      },
      type: {
        type: String,
        enum: ['image', 'document', 'video'],
        required: true
      },
      mimeType: String,
      originalName: String,
      uploadedByRole: {
        type: String,
        enum: ['citizen', 'admin']
      },
      uploadedAt: {
        type: Date,
        default: Date.now
      },
      uploadedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
      }
    }],
    resolution: {
      type: String
    },
    resolvedAt: {
      type: Date
    },
    closedAt: {
      type: Date
    },
    slaBreached: {
      type: Boolean,
      default: false,
      index: true
    },
    slaDueDate: {
      type: Date
    },
    slaHours: {
      type: Number
    },
    reopenedCount: {
      type: Number,
      default: 0
    },
    reminderCount: {
      type: Number,
      default: 0
    },
    lastReminderAt: {
      type: Date
    },
    lastReminderRemarks: {
      type: String
    },
    language: {
      type: String,
      enum: ['en', 'hi', 'mr', 'or'],
      default: 'en'
    },
    timeline: [{
      action: {
        type: String,
        required: true
      },
      details: Schema.Types.Mixed,
      performedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
      },
      timestamp: {
        type: Date,
        default: Date.now
      }
    }]
  },
  {
    timestamps: true
  }
);

GrievanceSchema.pre('validate', function (next) {
  // Backfill legacy records so status/assignment updates do not fail schema validation.
  if (!this.phone_number) {
    this.phone_number = this.citizenPhone || this.citizenWhatsApp || '';
  }

  if (!this.message) {
    this.message = this.description || '';
  }

  next();
});

// Compound indexes
GrievanceSchema.index({ companyId: 1, status: 1 });
GrievanceSchema.index({ companyId: 1, createdAt: -1 });
GrievanceSchema.index({ departmentId: 1, status: 1 });
GrievanceSchema.index({ assignedTo: 1, status: 1 });
GrievanceSchema.index({ createdAt: -1 });
// ✅ Per-company uniqueness: allows GRV00000001.. to restart per company safely
GrievanceSchema.index({ companyId: 1, grievanceId: 1 }, { unique: true, sparse: true });

// Pre-save hook to generate grievanceId (using atomic counter if not provided)
GrievanceSchema.pre('save', async function (this: IGrievance, next) {
  // Handle SLA recalculation on creation or update
  if (this.isModified('slaHours') || (this.isNew && !this.slaDueDate)) {
    const hours = this.slaHours || 120;
    const baseDate = this.createdAt || new Date();
    const dueDate = new Date(baseDate);
    dueDate.setMinutes(dueDate.getMinutes() + Math.round(hours * 60));
    this.slaDueDate = dueDate;
  }

  if (this.isNew && !this.grievanceId) {
    try {
      // Use atomic counter for ID generation (prevents race conditions)
      // Pass companyId for per-company counters
      const { getNextGrievanceId } = await import('../utils/idGenerator');
      this.grievanceId = await getNextGrievanceId(this.companyId as any);
      
      if (!this.slaHours) {
        const Company = mongoose.model('Company');
        const company = await Company.findById(this.companyId);
        this.slaHours = (company as any)?.slaSettings?.defaultSlaHours || 120;
      }
    } catch (error) {
      console.error('❌ Error generating grievance ID:', error);
      return next(error as any);
    }
    
    // Initialize status history
    this.statusHistory = [{
      status: this.status,
      changedAt: new Date()
    }];

    // Initialize timeline
    this.timeline = [{
      action: 'CREATED',
      details: {
        description: this.description,
        category: this.category
      },
      timestamp: new Date()
    }];
  }
  next();
});

const Grievance: Model<IGrievance> = mongoose.model<IGrievance>('Grievance', GrievanceSchema);

export default Grievance;
