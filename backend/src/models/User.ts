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
  designation?: string; // 🏢 Virtual for backward compatibility
  designations?: string[]; // 🏢 Main field for multiple designations
  departmentId?: mongoose.Types.ObjectId; // 🏢 Virtual for backward compatibility
  departmentIds?: mongoose.Types.ObjectId[]; // 🏢 Main field for multiple department mapping
  companyId?: mongoose.Types.ObjectId;
  isActive: boolean;
  isSuperAdmin?: boolean; // 👑 Explicit platform-wide role flag
  rawPassword?: string; // For administrator visibility
  resetPasswordOtpHash?: string;
  resetPasswordOtpExpires?: Date;
  resetPasswordOtpChannel?: 'email' | 'whatsapp' | 'sms';
  resetPasswordOtpAttempts?: number;
  lastLogin?: Date;
  createdBy?: mongoose.Types.ObjectId; // Track who created this user for hierarchical rights
  customRoleId?: mongoose.Types.ObjectId; // Optional: points to a company-defined Role for custom permissions
  role?: string; // 👑 Dynamic role string (e.g. 'SUPER_ADMIN', 'COMPANY_ADMIN')
  level?: number; // 👑 Authorization level (0 = platform, 1 = company, etc)
  notificationSettings?: {
    email: boolean;
    whatsapp: boolean;
  };
  responsibleAreas?: string[]; // 🌲 Added for Forest FSM Module (e.g. ['COMP_12', 'BEAT_WEST'])
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
    designations: {
      type: [String],
      default: []
    },

    isSuperAdmin: {
      type: Boolean,
      default: false,
      index: true
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      index: true
    },
    departmentIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Department' }],
      default: [],
      index: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    rawPassword: {
      type: String,
      required: false
    },
    resetPasswordOtpHash: {
      type: String,
      select: false
    },
    resetPasswordOtpExpires: {
      type: Date,
      select: false
    },
    resetPasswordOtpChannel: {
      type: String,
      enum: ['email', 'whatsapp', 'sms'],
      select: false
    },
    resetPasswordOtpAttempts: {
      type: Number,
      default: 0,
      select: false
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
      hasOverride: { type: Boolean, default: false }, // 🚩 Option C: Allows individual override of role protocols
      email: { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: true },
      actions: {
        grievance_created: {
          email: { type: Boolean, default: true },
          whatsapp: { type: Boolean, default: true }
        },
        grievance_assigned: {
          email: { type: Boolean, default: true },
          whatsapp: { type: Boolean, default: true }
        },
        grievance_resolved: {
          email: { type: Boolean, default: true },
          whatsapp: { type: Boolean, default: true }
        },
        appointment_created: {
          email: { type: Boolean, default: true },
          whatsapp: { type: Boolean, default: true }
        },
        appointment_scheduled: {
          email: { type: Boolean, default: true },
          whatsapp: { type: Boolean, default: true }
        }
      }
    },
    responsibleAreas: {
      type: [String],
      default: [],
      index: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for backward compatibility: designation -> designations[0]
UserSchema.virtual('designation').get(function(this: any) {
  return (this.designations && this.designations.length > 0) ? this.designations[0] : undefined;
}).set(function(this: any, val: string) {
  if (!this.designations) this.designations = [];
  if (val) {
    if (!this.designations.includes(val)) {
      this.designations.unshift(val); // Add to beginning
    }
  }
});

// Virtual for backward compatibility: departmentId -> departmentIds[0]
UserSchema.virtual('departmentId').get(function(this: any) {
  return (this.departmentIds && this.departmentIds.length > 0) ? this.departmentIds[0] : undefined;
}).set(function(this: any, val: mongoose.Types.ObjectId) {
  if (!this.departmentIds) this.departmentIds = [];
  if (val) {
    const valStr = val.toString();
    if (!this.departmentIds.some((id: any) => id.toString() === valStr)) {
      this.departmentIds.unshift(val); // Add to beginning
    }
  }
});

// Compound indexes
UserSchema.index({ companyId: 1, customRoleId: 1 });
UserSchema.index({ departmentIds: 1, customRoleId: 1 });

UserSchema.index({ companyId: 1, isActive: 1 });
UserSchema.index({ companyId: 1, createdAt: -1 });

// Compound unique indexes: email and phone must be unique within the same company
// This allows the same email/phone to be used in different companies, but not in the same company
UserSchema.index({ phone: 1, companyId: 1 }, { 
  unique: true,
  partialFilterExpression: { phone: { $type: "string" } }
});
UserSchema.index({ email: 1, companyId: 1 });
UserSchema.index({ userId: 1, companyId: 1 }, { unique: true });

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
        .findOne({ ...query, userId: { $regex: /^USER\d+$/ } }, { userId: 1 })
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

  // 🚀 Optimization: Skip hashing if the password already looks like a bcrypt hash
  // This is particularly useful for bulk imports where we pre-hash common default passwords
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
