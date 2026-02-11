import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { UserRole } from '../config/constants';

export interface IUser extends Document {
  userId: string;
  firstName: string;
  lastName: string;
  email?: string;
  password?: string;
  phone: string;
  role: UserRole;
  companyId?: mongoose.Types.ObjectId;
  departmentId?: mongoose.Types.ObjectId;
  isActive: boolean;
  lastLogin?: Date;
  createdBy?: mongoose.Types.ObjectId; // Track who created this user for hierarchical rights
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
      select: false // Don't include password in queries by default
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      required: true,
      index: true
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      index: true
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      index: true
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
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes
UserSchema.index({ companyId: 1, role: 1 });
UserSchema.index({ departmentId: 1, role: 1 });

// Compound unique indexes: email and phone must be unique within the same company
// This allows the same email/phone to be used in different companies, but not in the same company
UserSchema.index({ email: 1, companyId: 1 }, { unique: true, sparse: true });
UserSchema.index({ phone: 1, companyId: 1 }, { unique: true });

// Pre-validate hook to generate userId (per-company)
UserSchema.pre('validate', async function (next) {
  if (this.isNew && !this.userId) {
    try {
      // Use atomic counter for ID generation (prevents race conditions)
      // Pass companyId for per-company counters (SUPER_ADMIN users have no companyId)
      const { getNextUserId } = await import('../utils/idGenerator');
      this.userId = await getNextUserId(this.companyId as any);
    } catch (error) {
      console.error('❌ Error generating user ID:', error);
      // Fallback to old method if counter fails - find last user for this company
      const query: any = {};
      if (this.companyId) {
        query.companyId = this.companyId;
      } else {
        // For SUPER_ADMIN, find users without companyId
        query.$or = [{ companyId: null }, { companyId: { $exists: false } }];
      }
      
      const lastUser = await mongoose.model('User')
        .findOne(query, { userId: 1 })
        .sort({ userId: -1 });

      let nextNum = 1;
      if (lastUser && lastUser.userId) {
        const match = lastUser.userId.match(/^USER(\d+)$/);
        if (match) {
          nextNum = parseInt(match[1], 10) + 1;
        }
      }
      
      this.userId = `USER${String(nextNum).padStart(6, '0')}`;
    }
  }
  next();
});

// Pre-save hook to hash password
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password as string, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Instance method to compare passwords
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Instance method to get full name
UserSchema.methods.getFullName = function (): string {
  return `${this.firstName} ${this.lastName}`;
};

const User: Model<IUser> = mongoose.model<IUser>('User', UserSchema);

export default User;
