import mongoose, { Document, Schema } from 'mongoose';

export type NotificationEventType =
  | 'GRIEVANCE_RECEIVED'
  | 'GRIEVANCE_REMINDER'
  | 'GRIEVANCE_REVERTED'
  | 'GRIEVANCE_ASSIGNED'
  | 'GRIEVANCE_REASSIGNED'
  | 'GRIEVANCE_STATUS_UPGRADED'
  | 'GRIEVANCE_REOPENED';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  grievanceId?: string;
  grievanceObjectId?: mongoose.Types.ObjectId;
  eventType: NotificationEventType;
  title: string;
  message: string;
  meta?: Record<string, any>;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    grievanceId: { type: String, trim: true },
    grievanceObjectId: { type: Schema.Types.ObjectId, ref: 'Grievance' },
    eventType: {
      type: String,
      enum: [
        'GRIEVANCE_RECEIVED',
        'GRIEVANCE_REMINDER',
        'GRIEVANCE_REVERTED',
        'GRIEVANCE_ASSIGNED',
        'GRIEVANCE_REASSIGNED',
        'GRIEVANCE_STATUS_UPGRADED',
        'GRIEVANCE_REOPENED',
      ],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    meta: { type: Schema.Types.Mixed, default: {} },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date },
  },
  {
    timestamps: true,
  },
);

NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ companyId: 1, createdAt: -1 });

export default mongoose.models.Notification || mongoose.model<INotification>('Notification', NotificationSchema);
