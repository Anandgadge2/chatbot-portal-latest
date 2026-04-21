import mongoose from 'mongoose';
import Grievance from '../models/Grievance';
import { getIstDayBoundsUtc, getNextIstMidnightUtc } from '../utils/istDate';
import { logger } from '../config/logger';

export async function checkDailyLimit(options: {
  companyId: mongoose.Types.ObjectId;
  phone_number: string;
}): Promise<{ allowed: boolean; countToday: number; nextEligibleAt?: string }> {
  const { companyId, phone_number } = options;
  const { start, end } = getIstDayBoundsUtc(new Date());

  const countToday = await Grievance.countDocuments({
    companyId,
    phone_number,
    createdAt: { $gte: start, $lte: end }
  });

  if (countToday >= 3) {
    return {
      allowed: false,
      countToday,
      nextEligibleAt: getNextIstMidnightUtc(new Date()).toISOString()
    };
  }

  return { allowed: true, countToday };
}

export async function enforceDailyLimitOrThrow(options: {
  companyId: mongoose.Types.ObjectId;
  phone_number: string;
  company?: any;
  language?: string;
}) {
  const result = await checkDailyLimit({
    companyId: options.companyId,
    phone_number: options.phone_number
  });

  if (!result.allowed) {
    logger.warn('Rejected grievance due to daily limit', {
      companyId: options.companyId.toString(),
      phone_number: options.phone_number,
      countToday: result.countToday
    });

    const error: any = new Error('Citizen can submit up to 3 grievances per day (IST).');
    error.code = 'LIMIT_EXCEEDED';
    error.statusCode = 429;
    error.nextEligibleAt = result.nextEligibleAt;
    throw error;
  }

  return result;
}
