import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IForestArea extends Document {
  areaId: string; // Unique ID from KML/Excel (e.g. Compartment Number)
  name: string;
  type: 'COMPARTMENT' | 'BEAT' | 'RANGE' | 'DIVISION';
  boundary: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: any[];
  };
  metadata: {
    range?: string;
    beat?: string;
    section?: string;
    division?: string;
    area_sq_km?: number;
  };
  companyId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ForestAreaSchema: Schema = new Schema(
  {
    areaId: {
      type: String,
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['COMPARTMENT', 'BEAT', 'RANGE', 'DIVISION'],
      required: true,
      index: true
    },
    boundary: {
      type: {
        type: String,
        enum: ['Polygon', 'MultiPolygon'],
        required: true
      },
      coordinates: {
        type: [Schema.Types.Mixed],
        required: true
      }
    },
    metadata: {
      range: String,
      beat: String,
      section: String,
      division: String,
      area_sq_km: Number
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// 🌍 Critical for geospatial queries
ForestAreaSchema.index({ boundary: '2dsphere' });
ForestAreaSchema.index({ companyId: 1, areaId: 1 }, { unique: true });

const ForestArea: Model<IForestArea> = mongoose.model<IForestArea>('ForestArea', ForestAreaSchema);

export default ForestArea;
