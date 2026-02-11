import mongoose, { Document, Schema } from 'mongoose';

// Time slot interface
export interface ITimeSlot {
  enabled: boolean;
  startTime: string; // HH:MM format
  endTime: string;   // HH:MM format
}

// Day availability interface
export interface IDayAvailability {
  isAvailable: boolean;
  morning: ITimeSlot;
  afternoon: ITimeSlot;
  evening: ITimeSlot;
}

// Special date (holiday or custom availability)
export interface ISpecialDate {
  date: Date;
  type: 'holiday' | 'custom';
  name?: string;
  isAvailable: boolean;
  morning?: ITimeSlot;
  afternoon?: ITimeSlot;
  evening?: ITimeSlot;
}

// Main availability settings interface
export interface IAppointmentAvailability extends Document {
  companyId: mongoose.Types.ObjectId;
  departmentId?: mongoose.Types.ObjectId;
  
  // Default weekly schedule (0 = Sunday, 1 = Monday, etc.)
  weeklySchedule: {
    sunday: IDayAvailability;
    monday: IDayAvailability;
    tuesday: IDayAvailability;
    wednesday: IDayAvailability;
    thursday: IDayAvailability;
    friday: IDayAvailability;
    saturday: IDayAvailability;
  };
  
  // Special dates (holidays, custom availability)
  specialDates: ISpecialDate[];
  
  // Settings
  slotDurationMinutes: number; // Duration of each appointment slot
  bufferMinutes: number;       // Buffer time between appointments
  maxAdvanceBookingDays: number; // How far in advance can book
  minAdvanceBookingHours: number; // Minimum hours before appointment
  
  // Removed: defaultMorningStart/End, defaultAfternoonStart/End, defaultEveningStart/End
  // These can be derived from weeklySchedule if needed
  
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TimeSlotSchema = new Schema<ITimeSlot>({
  enabled: { type: Boolean, default: true },
  startTime: { type: String, default: '09:00' },
  endTime: { type: String, default: '12:00' }
}, { _id: false });

const DayAvailabilitySchema = new Schema<IDayAvailability>({
  isAvailable: { type: Boolean, default: true },
  morning: { type: TimeSlotSchema, default: () => ({ enabled: true, startTime: '09:00', endTime: '12:00' }) },
  afternoon: { type: TimeSlotSchema, default: () => ({ enabled: true, startTime: '14:00', endTime: '17:00' }) },
  evening: { type: TimeSlotSchema, default: () => ({ enabled: true, startTime: '17:00', endTime: '19:00' }) }
}, { _id: false });

const SpecialDateSchema = new Schema<ISpecialDate>({
  date: { type: Date, required: true },
  type: { type: String, enum: ['holiday', 'custom'], required: true },
  name: { type: String },
  isAvailable: { type: Boolean, default: false },
  morning: TimeSlotSchema,
  afternoon: TimeSlotSchema,
  evening: TimeSlotSchema
}, { _id: false });

const AppointmentAvailabilitySchema = new Schema<IAppointmentAvailability>({
  companyId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Company', 
    required: true 
  },
  departmentId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Department'
  },
  
  weeklySchedule: {
    sunday: { type: DayAvailabilitySchema, default: () => ({ isAvailable: false, morning: { enabled: false, startTime: '09:00', endTime: '12:00' }, afternoon: { enabled: false, startTime: '14:00', endTime: '17:00' }, evening: { enabled: false, startTime: '17:00', endTime: '19:00' } }) },
    monday: { type: DayAvailabilitySchema, default: () => ({ isAvailable: true, morning: { enabled: true, startTime: '09:00', endTime: '12:00' }, afternoon: { enabled: true, startTime: '14:00', endTime: '17:00' }, evening: { enabled: true, startTime: '17:00', endTime: '19:00' } }) },
    tuesday: { type: DayAvailabilitySchema, default: () => ({ isAvailable: true, morning: { enabled: true, startTime: '09:00', endTime: '12:00' }, afternoon: { enabled: true, startTime: '14:00', endTime: '17:00' }, evening: { enabled: true, startTime: '17:00', endTime: '19:00' } }) },
    wednesday: { type: DayAvailabilitySchema, default: () => ({ isAvailable: true, morning: { enabled: true, startTime: '09:00', endTime: '12:00' }, afternoon: { enabled: true, startTime: '14:00', endTime: '17:00' }, evening: { enabled: true, startTime: '17:00', endTime: '19:00' } }) },
    thursday: { type: DayAvailabilitySchema, default: () => ({ isAvailable: true, morning: { enabled: true, startTime: '09:00', endTime: '12:00' }, afternoon: { enabled: true, startTime: '14:00', endTime: '17:00' }, evening: { enabled: true, startTime: '17:00', endTime: '19:00' } }) },
    friday: { type: DayAvailabilitySchema, default: () => ({ isAvailable: true, morning: { enabled: true, startTime: '09:00', endTime: '12:00' }, afternoon: { enabled: true, startTime: '14:00', endTime: '17:00' }, evening: { enabled: true, startTime: '17:00', endTime: '19:00' } }) },
    saturday: { type: DayAvailabilitySchema, default: () => ({ isAvailable: false, morning: { enabled: false, startTime: '09:00', endTime: '12:00' }, afternoon: { enabled: false, startTime: '14:00', endTime: '17:00' }, evening: { enabled: false, startTime: '17:00', endTime: '19:00' } }) }
  },
  
  specialDates: [SpecialDateSchema],
  
  slotDurationMinutes: { type: Number, default: 30 },
  bufferMinutes: { type: Number, default: 10 },
  maxAdvanceBookingDays: { type: Number, default: 30 },
  minAdvanceBookingHours: { type: Number, default: 24 },
  
  // Removed redundant default time fields - can be derived from weeklySchedule
  
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

// Compound index for company + department
AppointmentAvailabilitySchema.index({ companyId: 1, departmentId: 1 }, { unique: true });

export default mongoose.model<IAppointmentAvailability>('AppointmentAvailability', AppointmentAvailabilitySchema);
