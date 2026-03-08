import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Role Model
 *
 * Company-scoped custom roles with granular permissions.
 * Each company can define their own roles (e.g. "Finance Supervisor", "Field Officer").
 * Only SUPER_ADMIN remains a static platform-wide system role.
 */

export interface IPermission {
  module: string;   // e.g. 'grievances', 'appointments', 'users', 'departments', 'reports', 'flow_builder', 'settings', 'analytics'
  actions: string[]; // e.g. ['view', 'create', 'update', 'delete', 'assign', 'export']
}

export interface IRole extends Document {
  roleId: string;
  key?: string;              // legacy identifier for system roles (e.g. 'COMPANY_ADMIN')
  companyId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  isSystem: boolean;         // true = cannot be deleted (e.g. default Company Admin role)
  permissions: IPermission[];
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
    key: {
      type: String,
      index: true
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
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
    isSystem: {
      type: Boolean,
      default: false
    },
    permissions: {
      type: [PermissionSchema],
      default: []
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

// Compound uniqueness: role name must be unique per company
RoleSchema.index({ companyId: 1, name: 1 }, { unique: true });

// Pre-save hook to generate roleId
RoleSchema.pre('save', async function (next) {
  if (this.isNew && !this.roleId) {
    const count = await mongoose.model('Role').countDocuments({ companyId: this.companyId });
    this.roleId = `ROLE${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

const Role: Model<IRole> = mongoose.model<IRole>('Role', RoleSchema);

export default Role;
