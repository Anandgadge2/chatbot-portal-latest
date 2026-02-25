import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IPIIAccessLog extends Document {
  actorUserId: mongoose.Types.ObjectId;
  actorRole: string;
  companyId?: mongoose.Types.ObjectId;
  resourceType: 'Grievance' | 'Appointment';
  resourceId: string;
  fields: string[];
  reason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PIIAccessLogSchema = new Schema<IPIIAccessLog>(
  {
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    actorRole: { type: String, required: true, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    resourceType: { type: String, enum: ['Grievance', 'Appointment'], required: true, index: true },
    resourceId: { type: String, required: true, index: true },
    fields: [{ type: String, required: true }],
    reason: { type: String },
  },
  { timestamps: true }
);

const PIIAccessLog: Model<IPIIAccessLog> = mongoose.model<IPIIAccessLog>('PIIAccessLog', PIIAccessLogSchema);
export default PIIAccessLog;
