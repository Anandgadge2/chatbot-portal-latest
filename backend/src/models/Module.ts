import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IModule extends Document {
  key: string;          // e.g., 'GRIEVANCE', 'APPOINTMENT'
  name: string;         // Display name
  description: string;  // Short description
  icon?: string;        // Lucide icon name
  category: 'CORE' | 'COMMUNICATION' | 'ADVANCED' | 'UTILITY';
  isActive: boolean;    // Whether this module is available for activation
  isSystem: boolean;    // Cannot be deleted if true
  permissions: {        // Default granular actions available in this module
    action: string;     // e.g., 'view', 'create', 'update'
    label: string;      // e.g., 'View Grievances'
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const ModuleSchema: Schema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true
    },
    icon: {
      type: String
    },
    category: {
      type: String,
      enum: ['CORE', 'COMMUNICATION', 'ADVANCED', 'UTILITY'],
      default: 'CORE'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isSystem: {
      type: Boolean,
      default: false
    },
    permissions: [
      {
        action: { type: String, required: true },
        label: { type: String, required: true }
      }
    ]
  },
  {
    timestamps: true
  }
);

const Module: Model<IModule> = mongoose.model<IModule>('Module', ModuleSchema);

export default Module;
