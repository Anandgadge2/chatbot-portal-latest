import mongoose, { Document, Schema } from 'mongoose';

/**
 * Incident Model - For Wildlife/Forest Incident Reporting
 * Supports Module: INCIDENT_WILDLIFE
 */

export interface IIncident extends Document {
  incidentId: string;
  companyId: mongoose.Types.ObjectId;
  departmentId?: mongoose.Types.ObjectId;
  subDepartmentId?: mongoose.Types.ObjectId;
  
  // Citizen Information
  citizenName: string;
  citizenPhone: string;
  citizenWhatsApp: string;
  
  // Incident Details
  incidentType: 'WILDLIFE_SIGHTING' | 'HUMAN_WILDLIFE_CONFLICT' | 'POACHING' | 'FOREST_FIRE' | 'ILLEGAL_LOGGING' | 'ANIMAL_INJURY' | 'OTHER';
  wildlifeType?: string; // e.g., "Tiger", "Elephant", "Leopard"
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  urgency: 'NORMAL' | 'URGENT' | 'EMERGENCY';
  description: string;
  
  // Location
  location?: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
    address?: string;
  };
  
  // Media
  media: Array<{
    url: string;
    type: 'image' | 'document';
    uploadedAt: Date;
  }>;
  
  // Status & Assignment
  status: 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  assignedTo?: mongoose.Types.ObjectId;
  assignedAt?: Date;
  resolvedAt?: Date;
  resolvedBy?: mongoose.Types.ObjectId;
  
  // Timeline
  statusHistory: Array<{
    status: string;
    changedBy: mongoose.Types.ObjectId;
    changedAt: Date;
    remarks?: string;
  }>;
  
  timeline: Array<{
    action: string;
    details: any;
    performedBy?: mongoose.Types.ObjectId;
    timestamp: Date;
  }>;
  
  // Metadata
  language?: 'en' | 'hi' | 'mr' | 'or';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const IncidentSchema: Schema = new Schema(
  {
    incidentId: {
      type: String,
      required: true,
      unique: true,
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
    
    // Citizen Information
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
    citizenWhatsApp: {
      type: String,
      required: true
    },
    
    // Incident Details
    incidentType: {
      type: String,
      enum: ['WILDLIFE_SIGHTING', 'HUMAN_WILDLIFE_CONFLICT', 'POACHING', 'FOREST_FIRE', 'ILLEGAL_LOGGING', 'ANIMAL_INJURY', 'OTHER'],
      required: true,
      index: true
    },
    wildlifeType: {
      type: String,
      trim: true
    },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
      index: true
    },
    urgency: {
      type: String,
      enum: ['NORMAL', 'URGENT', 'EMERGENCY'],
      default: 'NORMAL',
      index: true
    },
    description: {
      type: String,
      required: true
    },
    
    // Location
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
    
    // Media
    media: [{
      url: String,
      type: {
        type: String,
        enum: ['image', 'document']
      },
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }],
    
    // Status & Assignment
    status: {
      type: String,
      enum: ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
      default: 'PENDING',
      index: true
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    assignedAt: Date,
    resolvedAt: Date,
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    
    // Timeline
    statusHistory: [{
      status: String,
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
    
    timeline: [{
      action: String,
      details: Schema.Types.Mixed,
      performedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
      },
      timestamp: {
        type: Date,
        default: Date.now
      }
    }],
    
    // Metadata
    language: {
      type: String,
      enum: ['en', 'hi', 'mr', 'or'],
      default: 'en'
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

// Auto-generate incidentId before saving
IncidentSchema.pre('save', async function(next) {
  if (!this.incidentId) {
    const count = await mongoose.model('Incident').countDocuments();
    this.incidentId = `INC${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

// Indexes for better query performance
IncidentSchema.index({ companyId: 1, status: 1 });
IncidentSchema.index({ companyId: 1, incidentType: 1 });
IncidentSchema.index({ companyId: 1, severity: 1 });
IncidentSchema.index({ companyId: 1, urgency: 1 });
IncidentSchema.index({ citizenPhone: 1, companyId: 1 });
IncidentSchema.index({ createdAt: -1 });

export default mongoose.model<IIncident>('Incident', IncidentSchema);
