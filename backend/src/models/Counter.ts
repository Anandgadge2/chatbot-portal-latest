import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICounter extends Document {
  name: string;
  companyId?: mongoose.Types.ObjectId; // Optional - for per-company counters
  value: number;
}

const CounterSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: false, // Optional for global counters
      index: true
    },
    value: {
      type: Number,
      required: true,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

// ✅ Single source of truth: per-company (and optional global via companyId undefined)
// IMPORTANT: We intentionally do NOT keep a global unique index on {name: 1}
// because it breaks per-company counters when older indexes exist in production.
CounterSchema.index({ name: 1, companyId: 1 }, { unique: true });

const Counter: Model<ICounter> = mongoose.model<ICounter>('Counter', CounterSchema);

export default Counter;
