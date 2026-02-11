import mongoose from 'mongoose';
import Counter from '../models/Counter';

/**
 * Atomically generate the next sequential ID for grievances (per-company)
 */
export async function getNextGrievanceId(companyId?: mongoose.Types.ObjectId): Promise<string> {
  const query = companyId 
    ? { name: 'grievance', companyId }
    : { name: 'grievance', companyId: { $exists: false } };
  
  const result = await Counter.findOneAndUpdate(
    query,
    { $inc: { value: 1 } },
    { upsert: true, new: true }
  );

  const nextNum = result.value;
  return `GRV${String(nextNum).padStart(8, '0')}`;
}

/**
 * Atomically generate the next sequential ID for appointments (per-company)
 */
export async function getNextAppointmentId(companyId?: mongoose.Types.ObjectId): Promise<string> {
  const query = companyId 
    ? { name: 'appointment', companyId }
    : { name: 'appointment', companyId: { $exists: false } };
  
  const result = await Counter.findOneAndUpdate(
    query,
    { $inc: { value: 1 } },
    { upsert: true, new: true }
  );

  const nextNum = result.value;
  return `APT${String(nextNum).padStart(8, '0')}`;
}

/**
 * Atomically generate the next sequential ID for users (per-company)
 */
export async function getNextUserId(companyId?: mongoose.Types.ObjectId): Promise<string> {
  const query = companyId 
    ? { name: 'user', companyId }
    : { name: 'user', companyId: { $exists: false } };
  
  const result = await Counter.findOneAndUpdate(
    query,
    { $inc: { value: 1 } },
    { upsert: true, new: true }
  );

  const nextNum = result.value;
  return `USER${String(nextNum).padStart(6, '0')}`;
}

/**
 * Initialize counters from existing data (migration helper)
 * Now supports per-company counters
 */
export async function initializeCounters(companyId?: mongoose.Types.ObjectId): Promise<void> {
  try {
    const Grievance = mongoose.model('Grievance');
    const Appointment = mongoose.model('Appointment');
    const User = mongoose.model('User');

    const query = companyId 
      ? { name: 'grievance', companyId }
      : { name: 'grievance', companyId: { $exists: false } };

    // Initialize grievance counter
    const grievanceCounter = await Counter.findOne(query);
    if (!grievanceCounter) {
      const grievanceQuery: any = {};
      if (companyId) {
        grievanceQuery.companyId = companyId;
      }
      
      const lastGrievance = await Grievance.findOne(grievanceQuery, { grievanceId: 1 })
        .sort({ grievanceId: -1 });

      let initialValue = 0;
      if (lastGrievance && lastGrievance.grievanceId) {
        const match = lastGrievance.grievanceId.match(/^GRV(\d+)$/);
        if (match) {
          initialValue = parseInt(match[1], 10);
        }
      }

      await Counter.create({ name: 'grievance', companyId, value: initialValue });
      console.log(`✅ Initialized grievance counter${companyId ? ` for company ${companyId}` : ' (global)'} at ${initialValue}`);
    }

    // Initialize appointment counter
    const appointmentQuery = companyId 
      ? { name: 'appointment', companyId }
      : { name: 'appointment', companyId: { $exists: false } };
    
    const appointmentCounter = await Counter.findOne(appointmentQuery);
    if (!appointmentCounter) {
      const aptQuery: any = {};
      if (companyId) {
        aptQuery.companyId = companyId;
      }
      
      const lastAppointment = await Appointment.findOne(aptQuery, { appointmentId: 1 })
        .sort({ appointmentId: -1 });

      let initialValue = 0;
      if (lastAppointment && lastAppointment.appointmentId) {
        const match = lastAppointment.appointmentId.match(/^APT(\d+)$/);
        if (match) {
          initialValue = parseInt(match[1], 10);
        }
      }

      await Counter.create({ name: 'appointment', companyId, value: initialValue });
      console.log(`✅ Initialized appointment counter${companyId ? ` for company ${companyId}` : ' (global)'} at ${initialValue}`);
    }

    // Initialize user counter
    const userQuery = companyId 
      ? { name: 'user', companyId }
      : { name: 'user', companyId: { $exists: false } };
    
    const userCounter = await Counter.findOne(userQuery);
    if (!userCounter) {
      const usrQuery: any = {};
      if (companyId) {
        usrQuery.companyId = companyId;
      } else {
        usrQuery.$or = [{ companyId: null }, { companyId: { $exists: false } }];
      }
      
      const lastUser = await User.findOne(usrQuery, { userId: 1 })
        .sort({ userId: -1 });

      let initialValue = 0;
      if (lastUser && lastUser.userId) {
        const match = lastUser.userId.match(/^USER(\d+)$/);
        if (match) {
          initialValue = parseInt(match[1], 10);
        }
      }

      await Counter.create({ name: 'user', companyId, value: initialValue });
      console.log(`✅ Initialized user counter${companyId ? ` for company ${companyId}` : ' (global)'} at ${initialValue}`);
    }
  } catch (error) {
    console.error('❌ Error initializing counters:', error);
  }
}
