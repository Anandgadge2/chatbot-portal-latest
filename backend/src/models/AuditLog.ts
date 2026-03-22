import mongoose, { Schema, Document, Model } from 'mongoose';
import { AuditAction } from '../config/constants';

export interface IAuditLog extends Document {
  userId?: mongoose.Types.ObjectId;
  actorUserId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  targetId?: string;
  companyId?: mongoose.Types.ObjectId;
  departmentId?: mongoose.Types.ObjectId;
  details?: any;
  changes?: any;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  createdAt?: Date;
}

const AuditLogSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    actorUserId: {
      type: String,
      index: true
    },
    action: {
      type: String,
      enum: [...Object.values(AuditAction), 'ROLE_CREATED', 'ROLE_UPDATED', 'ROLE_DELETED', 'MODULE_CHANGED'],
      required: true,
      index: true
    },
    resource: {
      type: String,
      required: true,
      index: true
    },
    resourceId: {
      type: String,
      index: true
    },
    targetId: {
      type: String,
      index: true
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      index: true
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      index: true
    },
    details: {
      type: Schema.Types.Mixed
    },
    changes: {
      type: Schema.Types.Mixed
    },
    ipAddress: {
      type: String
    },
    userAgent: {
      type: String
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: false
  }
);

AuditLogSchema.index({ userId: 1, timestamp: -1 });
AuditLogSchema.index({ companyId: 1, action: 1, timestamp: -1 });
AuditLogSchema.index({ resource: 1, resourceId: 1, timestamp: -1 });
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

const AuditLog: Model<IAuditLog> = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

export default AuditLog;
