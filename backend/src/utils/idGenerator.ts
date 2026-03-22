import mongoose from 'mongoose';
import Counter from '../models/Counter';

const buildCounterQuery = (name: string, companyId?: mongoose.Types.ObjectId | null) => (
  companyId
    ? { name, companyId }
    : { name, companyId: null }
);

const getNextCounterValue = async (
  name: string,
  companyId?: mongoose.Types.ObjectId | null,
  increment = 1
) => {
  const result = await Counter.findOneAndUpdate(
    buildCounterQuery(name, companyId),
    { $inc: { value: increment } },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );

  return result.value;
};

export async function getNextGrievanceId(companyId?: mongoose.Types.ObjectId): Promise<string> {
  const nextNum = await getNextCounterValue('grievance', companyId);
  return `GRV${String(nextNum).padStart(8, '0')}`;
}

export async function getNextAppointmentId(companyId?: mongoose.Types.ObjectId): Promise<string> {
  const nextNum = await getNextCounterValue('appointment', companyId);
  return `APT${String(nextNum).padStart(8, '0')}`;
}

export async function getNextUserId(companyId?: mongoose.Types.ObjectId): Promise<string> {
  const nextNum = await getNextCounterValue('user', companyId);
  return `USER${String(nextNum).padStart(6, '0')}`;
}

export async function getNextUserIdBatch(count: number, companyId?: mongoose.Types.ObjectId): Promise<number> {
  if (count <= 0) return 0;
  const nextValue = await getNextCounterValue('user', companyId, count);
  return nextValue - (count - 1);
}

export async function getNextRoleId(companyId?: mongoose.Types.ObjectId | null): Promise<string> {
  const nextNum = await getNextCounterValue('role', companyId);
  return `ROLE${String(nextNum).padStart(4, '0')}`;
}

export async function getNextCompanyId(): Promise<string> {
  const nextNum = await getNextCounterValue('company', null);
  return `CMP${String(nextNum).padStart(6, '0')}`;
}

export async function initializeCounters(companyId?: mongoose.Types.ObjectId): Promise<void> {
  try {
    const Grievance = mongoose.model('Grievance');
    const Appointment = mongoose.model('Appointment');
    const User = mongoose.model('User');
    const Role = mongoose.model('Role');
    const Company = mongoose.model('Company');

    const ensureCounter = async (
      name: string,
      model: any,
      field: string,
      regex: RegExp,
      globalOnly = false
    ) => {
      const counterQuery = buildCounterQuery(name, globalOnly ? null : companyId);
      const existingCounter = await Counter.findOne(counterQuery);
      if (existingCounter) {
        return;
      }

      const docQuery: any = {};
      if (globalOnly) {
        // no filter
      } else if (companyId) {
        docQuery.companyId = companyId;
      } else if (name === 'user' || name === 'role') {
        docQuery.companyId = null;
      }

      const lastDocument = await model.findOne(docQuery, { [field]: 1 }).sort({ [field]: -1 });
      let initialValue = 0;
      const value = lastDocument?.[field];
      if (typeof value === 'string') {
        const match = value.match(regex);
        if (match) {
          initialValue = parseInt(match[1], 10);
        }
      }

      await Counter.create({ name, companyId: globalOnly ? null : companyId || null, value: initialValue });
    };

    await ensureCounter('grievance', Grievance, 'grievanceId', /^GRV(\d+)$/);
    await ensureCounter('appointment', Appointment, 'appointmentId', /^APT(\d+)$/);
    await ensureCounter('user', User, 'userId', /^USER(\d+)$/);
    await ensureCounter('role', Role, 'roleId', /^ROLE(\d+)$/);
    await ensureCounter('company', Company, 'companyId', /^CMP(\d+)$/, true);
  } catch (error) {
    console.error('❌ Error initializing counters:', error);
  }
}
