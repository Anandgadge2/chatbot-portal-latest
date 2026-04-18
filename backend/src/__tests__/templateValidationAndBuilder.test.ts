import { buildCitizenMessage } from '../services/citizenMessageBuilder';
import { sanitizeText, sanitizeGrievanceDetails } from '../utils/sanitize';
import { validateTemplateVariables } from '../services/templateValidationService';

describe('template safety and builder', () => {
  it('sanitizes urls and special chars', () => {
    const input = 'Help!!! visit https://evil.com 😡';
    expect(sanitizeText(input, 80)).toBe('Help visit');
  });

  it('caps grievance details at 100 chars', () => {
    const longText = 'a'.repeat(150);
    expect(sanitizeGrievanceDetails(longText).length).toBe(100);
  });

  it('builds resolved citizen message block', () => {
    const msg = buildCitizenMessage({
      status: 'RESOLVED',
      resolvedByName: 'Officer One',
      formattedResolvedDate: '16-04-2026',
      remarks: 'done'
    });
    expect(msg).toContain('Resolved By: Officer One');
    expect(msg).toContain('Resolved On: 16-04-2026');
  });

  it('fails when template variables are missing', () => {
    expect(() => validateTemplateVariables('grievance_status_citizen_v1', ['a', 'b'])).toThrow();
  });
});
