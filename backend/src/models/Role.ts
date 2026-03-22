import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPermission {
  module: string;
  actions: string[];
}

export interface IRole extends Document {
  roleId: string;
  companyId?: mongoose.Types.ObjectId | null;
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
  createdBy: mongoose.Types.ObjectId;
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
      required: false,
      default: null,
      index: true
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
      index: true
    },
    scope: {
      type: String,
      enum: ['platform', 'company'],
      required: true,
      index: true
    },
    requiredModule: {
      type: String,
      trim: true
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
      required: true
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

RoleSchema.index({ companyId: 1, name: 1 }, { unique: true });
RoleSchema.index({ companyId: 1, level: 1 }, { unique: true });

RoleSchema.pre('validate', async function (next) {
  const roleDoc = this as unknown as IRole;

  if (roleDoc.scope === 'platform') {
    roleDoc.companyId = null;
  }

  if (roleDoc.scope === 'company' && !roleDoc.companyId) {
    return next(new Error('companyId is required for company-scoped roles'));
  }

  if (roleDoc.scope === 'platform' && roleDoc.level !== 0) {
    return next(new Error('Platform-scoped roles must use level 0'));
  }

  if (roleDoc.scope === 'company' && !roleDoc.isSystem && (roleDoc.level === undefined || roleDoc.level === null || roleDoc.level < 5)) {
    const latestRole = await mongoose.model('Role')
      .findOne<{ level?: number }>({ companyId: roleDoc.companyId, scope: 'company' })
      .sort({ level: -1 })
      .select('level')
      .lean();

    roleDoc.level = Math.max(((latestRole?.level as number | undefined) || 4) + 1, 5);
  }

  next();
});

RoleSchema.pre('save', async function (next) {
  if (this.isNew && !this.roleId) {
    try {
      const { getNextRoleId } = await import('../utils/idGenerator');
      this.roleId = await getNextRoleId((this.companyId as mongoose.Types.ObjectId | null) || null);
    } catch (error) {
      return next(error as any);
    }
  }

  next();
});

const Role: Model<IRole> = mongoose.model<IRole>('Role', RoleSchema);

export default Role;
