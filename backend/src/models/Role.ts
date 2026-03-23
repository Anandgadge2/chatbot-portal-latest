import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPermission {
  module: string;
  actions: string[];
}

export interface IRole extends Document {
  roleId: string;
  key?: string; // Legacy read-only field for backward compatibility
  companyId?: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  level: number;
  scope: 'platform' | 'company';
  requiredModule?: string;
  isSystem: boolean;
  permissions: IPermission[];
  notificationSettings?: {
    email: boolean;
    whatsapp: boolean;
  };
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PermissionSchema = new Schema({
  module: { type: String, required: true },
  actions: [{ type: String }]
}, { _id: false });

const RoleSchema: Schema = new Schema(
  {
    roleId: {
      type: String,
      index: true
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: false
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    level: {
      type: Number,
      required: true,
      min: 0,
      index: true
    },
    scope: {
      type: String,
      enum: ['platform', 'company'],
      default: 'company',
      index: true
    },
    requiredModule: {
      type: String,
      trim: true,
      uppercase: true
    },
    isSystem: {
      type: Boolean,
      default: false
    },
    permissions: {
      type: [PermissionSchema],
      default: []
    },
    notificationSettings: {
      email: { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: true }
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

RoleSchema.index({ companyId: 1 });
RoleSchema.index({ companyId: 1, name: 1 }, { unique: true, sparse: true });
RoleSchema.index(
  { companyId: 1, level: 1 },
  {
    unique: true,
    partialFilterExpression: {
      companyId: { $exists: true },
      scope: 'company'
    }
  }
);

RoleSchema.pre('validate', function (next) {
  if (this.scope === 'platform') {
    this.companyId = undefined;
    if (this.level !== 0) {
      this.level = 0;
    }
  }

  next();
});

RoleSchema.pre('save', async function (next) {
  if (this.isNew && !this.roleId) {
    const { getNextRoleId } = await import('../utils/idGenerator');
    this.roleId = await getNextRoleId(this.companyId as mongoose.Types.ObjectId | undefined);
  }
  next();
});

const Role: Model<IRole> = mongoose.model<IRole>('Role', RoleSchema);

export default Role;
