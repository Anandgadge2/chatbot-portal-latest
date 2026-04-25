import { buildCitizenMessage } from '../services/citizenMessageBuilder';
import { sanitizeText, sanitizeGrievanceDetails } from '../utils/sanitize';
import { validateTemplateVariables } from '../services/templateValidationService';
import { buildTemplatePayload } from '../services/whatsapp/payload.builder';

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

  it('resolves legacy meta variable names for reassignment templates', () => {
    const payload = buildTemplatePayload('grievance_reassigned_admin_v1', {
      recipientName: 'Officer One',
      grievanceId: 'GRV-1001',
      citizenName: 'Anand',
      departmentName: 'Water',
      officeName: 'Zone A',
      grievanceDetails: 'No water supply',
      submittedDate: '2026-04-01 10:00',
      reassignedByName: 'District Admin',
      reassignmentNote: 'Please prioritize',
      reassignedDate: '2026-04-02 11:00',
      originalDepartment: 'Public Health',
      originalOffice: 'HQ'
    });

    const body = payload.components.find((component) => component.type === 'body');
    expect(body.parameters).toHaveLength(12);
    expect(body.parameters[0].text).toBe('Officer One');
    expect(body.parameters[6].text).toBe('2026-04-01 10:00');
    expect(body.parameters[8].text).toBe('Please prioritize');
    expect(body.parameters[9].text).toBe('2026-04-02 11:00');
  });

  it('builds reverted company template with 9 parameters including description', () => {
    const payload = buildTemplatePayload('grievance_reverted_company_v1', {
      admin_name: 'Officer One',
      grievance_id: 'GRV-3001',
      citizen_name: 'Ravi',
      department_name: 'Water',
      office_name: 'Zone A',
      grievance_details: 'Water logging not cleared',
      reverted_by: 'District Admin',
      revert_note: 'Please re-check with field report',
      reverted_on: '2026-04-25 12:00'
    });

    const body = payload.components.find((component) => component.type === 'body');
    expect(body.parameters).toHaveLength(9);
    expect(body.parameters[5].text).toBe('Water logging not cleared');
    expect(body.parameters[8].text).toBe('2026-04-25 12:00');
  });

  it('builds citizen status template using summary and dynamic message values', () => {
    const payload = buildTemplatePayload('grievance_status_citizen_v1', {
      citizen_name: 'Anand',
      grievance_id: 'GRV-2001',
      department_name: 'Water',
      sub_department_name: 'Zone A',
      grievance_summary: 'No water supply for three days',
      dynamic_message: 'Status Update: Your grievance is under review.',
      updated_on: '2026-04-25 11:45'
    });

    const body = payload.components.find((component) => component.type === 'body');
    expect(body.parameters).toHaveLength(7);
    expect(body.parameters[4].text).toBe('No water supply for three days');
    expect(body.parameters[5].text).toBe('Status Update: Your grievance is under review.');
    expect(body.parameters[6].text).toBe('2026-04-25 11:45');
  });
});
