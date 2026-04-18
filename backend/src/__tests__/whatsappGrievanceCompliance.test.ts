import { enforceWhatsAppGrievanceCompliance } from '../middleware/whatsappGrievanceCompliance';
import CitizenProfile from '../models/CitizenProfile';
import Company from '../models/Company';
import { enforceDailyLimitOrThrow } from '../services/grievanceRateLimitService';

jest.mock('../models/CitizenProfile', () => ({ __esModule: true, default: { findOne: jest.fn() } }));
jest.mock('../models/Company', () => ({ __esModule: true, default: { findById: jest.fn() } }));
jest.mock('../services/grievanceRateLimitService', () => ({ enforceDailyLimitOrThrow: jest.fn() }));

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('whatsapp grievance compliance middleware', () => {
  const next = jest.fn();
  const findCompany = Company.findById as unknown as jest.Mock;
  const findCitizen = CitizenProfile.findOne as unknown as jest.Mock;
  const enforceLimit = enforceDailyLimitOrThrow as unknown as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    findCompany.mockResolvedValue({ _id: 'company1' });
  });

  it('blocks when STOP opt-out is active', async () => {
    findCitizen.mockResolvedValue({ opt_out: true });
    const req: any = { body: { companyId: 'company1', citizenPhone: '91x' } };
    const res = mockRes();

    await enforceWhatsAppGrievanceCompliance(req, res as any, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'OPT_OUT' }));
  });

  it('blocks when citizen consent missing', async () => {
    findCitizen.mockResolvedValue({ opt_out: false, citizen_consent: false });
    const req: any = { body: { companyId: 'company1', citizenPhone: '91x' } };
    const res = mockRes();

    await enforceWhatsAppGrievanceCompliance(req, res as any, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'CONSENT_REQUIRED' }));
  });

  it('blocks when limit exceeded', async () => {
    findCitizen.mockResolvedValue({ opt_out: false, citizen_consent: true });
    enforceLimit.mockRejectedValue(Object.assign(new Error('blocked'), { code: 'LIMIT_EXCEEDED', statusCode: 429 }));
    const req: any = { body: { companyId: 'company1', citizenPhone: '91x' } };
    const res = mockRes();

    await enforceWhatsAppGrievanceCompliance(req, res as any, next);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'LIMIT_EXCEEDED' }));
  });

  it('restricts free-form outside 24-hour window', async () => {
    findCitizen.mockResolvedValue({
      opt_out: false,
      citizen_consent: true,
      lastUserInteractionAt: new Date(Date.now() - (25 * 60 * 60 * 1000))
    });
    enforceLimit.mockResolvedValue({ allowed: true });

    const req: any = { body: { companyId: 'company1', citizenPhone: '91x', outboundMessageType: 'freeform' } };
    const res = mockRes();

    await enforceWhatsAppGrievanceCompliance(req, res as any, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'WINDOW_RESTRICTED' }));
  });

  it('allows request when consent given and limit not exceeded', async () => {
    findCitizen.mockResolvedValue({
      opt_out: false,
      citizen_consent: true,
      lastUserInteractionAt: new Date()
    });
    enforceLimit.mockResolvedValue({ allowed: true });

    const req: any = { body: { companyId: 'company1', citizenPhone: '91x' } };
    const res = mockRes();

    await enforceWhatsAppGrievanceCompliance(req, res as any, next);
    expect(next).toHaveBeenCalled();
  });
});
