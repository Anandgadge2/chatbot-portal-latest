import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  userId: string;
  firstName: string;
  lastName: string;
  email?: string;
  password?: string;
  phone?: string;
  designation?: string;
  role?: string; // legacy runtime-only property for backward compatibility
  isSuperAdmin: boolean;
  companyId?: mongoose.Types.ObjectId;
  departmentId?: mongoose.Types.ObjectId;
  subDepartmentId?: mongoose.Types.ObjectId;
  isActive: boolean;
  lastLogin?: Date;
  createdBy?: mongoose.Types.ObjectId;
  customRoleId?: mongoose.Types.ObjectId;
  notificationSettings?: {
    email: boolean;
    whatsapp: boolean;
  };
  responsibleAreas?: string[];
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  getFullName(): string;
}

const UserSchema: Schema = new Schema(
  {
    userId: {
      type: String,
      required: false,
      unique: true,
      index: true
    },
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    lastName: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: false,
      lowercase: true,
      trim: true,
      sparse: true,
      index: true
    },
    password: {
      type: String,
      required: false,
      select: false
    },
    phone: {
      type: String,
      required: false,
      trim: true,
      index: true,
      sparse: true
    },
    designation: {
      type: String,
      trim: true
    },
    isSuperAdmin: {
      type: Boolean,
      default: false,
      index: true
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      index: true,
      default: null
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      index: true,
      default: null
    },
    subDepartmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      index: true,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastLogin: {
      type: Date
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    customRoleId: {
      type: Schema.Types.ObjectId,
      ref: 'Role',
      index: true,
      default: null
    },
    notificationSettings: {
      email: { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: true }
    },
    responsibleAreas: {
      type: [String],
      default: [],
      index: true
    }
  },
  {
    timestamps: true
  }
);

UserSchema.index({ companyId: 1, isActive: 1 });
UserSchema.index({ companyId: 1, createdAt: -1 });
UserSchema.index({ companyId: 1, departmentId: 1 });
UserSchema.index({ companyId: 1, subDepartmentId: 1 });
UserSchema.index({ email: 1, companyId: 1 }, { unique: true, sparse: true });
UserSchema.index({ phone: 1, companyId: 1 }, { unique: true, sparse: true });

UserSchema.pre('validate', async function (next) {
  if (this.isNew && !this.userId) {
    try {
      const { getNextUserId } = await import('../utils/idGenerator');
      this.userId = await getNextUserId(this.companyId as any);
    } catch (error) {
      return next(error as any);
    }
  }

  if (this.isSuperAdmin) {
    this.companyId = undefined;
    this.departmentId = undefined;
    this.subDepartmentId = undefined;
  }

  next();
});

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  const password = this.password as string;
  if (password && (password.startsWith('$2a$') || password.startsWith('$2b$') || password.startsWith('$2y$'))) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

UserSchema.methods.getFullName = function (): string {
  return `${this.firstName} ${this.lastName}`;
};

const User: Model<IUser> = mongoose.model<IUser>('User', UserSchema);

export default User;
