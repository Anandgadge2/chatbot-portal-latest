import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IFailedMessage extends Document {
  companyId?: string;
  messageId: string;
  from: string;
  payload: any;
  error: string;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
}

const FailedMessageSchema = new Schema<IFailedMessage>(
  {
    companyId: { type: String, index: true },
    messageId: { type: String, required: true, index: true },
    from: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    error: { type: String, required: true },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const FailedMessage: Model<IFailedMessage> = mongoose.model<IFailedMessage>('FailedMessage', FailedMessageSchema);
export default FailedMessage;
