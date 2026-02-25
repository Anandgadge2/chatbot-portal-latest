import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IRefreshTokenSession extends Document {
  userId: mongoose.Types.ObjectId;
  familyId: string;
  tokenHash: string;
  jti: string;
  parentJti?: string;
  companyId?: mongoose.Types.ObjectId;
  revokedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RefreshTokenSessionSchema = new Schema<IRefreshTokenSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    familyId: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    jti: { type: String, required: true, unique: true, index: true },
    parentJti: { type: String },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    revokedAt: { type: Date },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

RefreshTokenSessionSchema.index({ userId: 1, familyId: 1, revokedAt: 1 });

const RefreshTokenSession: Model<IRefreshTokenSession> = mongoose.model<IRefreshTokenSession>(
  'RefreshTokenSession',
  RefreshTokenSessionSchema
);

export default RefreshTokenSession;
