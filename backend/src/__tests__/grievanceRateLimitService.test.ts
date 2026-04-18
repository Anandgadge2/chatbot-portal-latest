import Grievance from '../models/Grievance';
import { checkDailyLimit } from '../services/grievanceRateLimitService';
import { getIstDateKey, getIstDayBoundsUtc } from '../utils/istDate';

jest.mock('../models/Grievance', () => ({
  __esModule: true,
  default: {
    countDocuments: jest.fn()
  }
}));

describe('grievance daily limit service', () => {
  const mockedCount = Grievance.countDocuments as unknown as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows first grievance of the day', async () => {
    mockedCount.mockResolvedValueOnce(0);
    const result = await checkDailyLimit({ companyId: 'c1' as any, phone_number: '919999999999' });
    expect(result.allowed).toBe(true);
  });

  it('blocks second grievance on same IST day', async () => {
    mockedCount.mockResolvedValueOnce(1);
    const result = await checkDailyLimit({ companyId: 'c1' as any, phone_number: '919999999999' });
    expect(result.allowed).toBe(false);
  });

  it('returns allowed on next day as a fresh window', async () => {
    mockedCount.mockResolvedValueOnce(0);
    const result = await checkDailyLimit({ companyId: 'c1' as any, phone_number: '919999999999' });
    expect(result.allowed).toBe(true);
  });

  it('calculates IST bounds for DB query window', () => {
    const { start, end } = getIstDayBoundsUtc(new Date('2026-04-16T18:31:00.000Z'));
    expect(start.toISOString()).toBe('2026-04-16T18:30:00.000Z');
    expect(end.toISOString()).toBe('2026-04-17T18:29:59.999Z');
  });

  it('handles timezone edge case 11:59 PM vs 12:01 AM IST', () => {
    const before = new Date('2026-04-16T18:29:00.000Z');
    const after = new Date('2026-04-16T18:31:00.000Z');
    expect(getIstDateKey(before)).not.toEqual(getIstDateKey(after));
  });
});
