import { buildCitizenMessage } from '../services/citizenMessageBuilder';
import { sanitizeText, sanitizeGrievanceDetails, sanitizeNote } from '../utils/sanitize';
import { validateTemplateVariables } from '../services/templateValidationService';
import { buildTemplatePayload } from '../services/whatsapp/payload.builder';
import { formatTemplateDateTime } from '../utils/templateDateTime';

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
      formattedResolvedDate: '26 April 2026 at 11:43:20 pm',
      remarks: 'done'
    });
    expect(msg).toContain('Resolved By: Officer One');
    expect(msg).toContain('Resolved On: 26 April 2026 at 11:43:20 pm');
    expect(msg).not.toContain('Status: Resolved');
  });


  it('preserves separators and spacing in dynamic status note blocks', () => {
    const note = sanitizeNote('Resolved By: ANAND Gadge\n\nResolved On: 26 April 2026 at 11:43:20 pm\n\nNote: rrrrrrrr');
    expect(note).toBe('Resolved By: ANAND Gadge\n\nResolved On: 26 April 2026 at 11:43:20 pm\n\nNote: rrrrrrrr');
  });


  it('uses a live formatted timestamp when no status date is provided', () => {
    const msg = buildCitizenMessage({
      status: 'IN_PROGRESS',
      resolvedByName: 'Officer One',
      remarks: 'working'
    });

    expect(msg).toContain('In Progress By: Officer One');
    expect(msg).toMatch(/In Progress On: .* at \d{2}:\d{2}:\d{2} (am|pm)/i);
    expect(msg).not.toContain('In Progress On: N/A');
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


  it('preserves HH:MM:SS colon formatting in admin template date fields', () => {
    const payload = buildTemplatePayload('grievance_reminder_admin_v1', {
      admin_name: 'Collector',
      grievance_id: 'GRV-9001',
      citizen_name: 'Anand',
      department_name: 'Water',
      office_name: 'Zone A',
      description: 'No water supply',
      submitted_on: '26 April 2026 at 11:43:20 pm',
      assigned_on: '26 April 2026 at 12:01:09 pm',
      reminder_remarks: 'Please resolve soon',
      dashboard_url: 'https://connect.pugarch.in/'
    });

    const body = payload.components.find((component) => component.type === 'body');
    expect(body.parameters[6].text).toBe('26 April 2026 at 11:43:20 pm');
    expect(body.parameters[7].text).toBe('26 April 2026 at 12:01:09 pm');
  });

  it('formats template datetime in the required admin reminder format', () => {
    expect(formatTemplateDateTime(new Date('2026-04-29T11:47:36.000Z'))).toBe(
      '29 April 2026 at 05:17:36 pm'
    );
  });

  it('builds citizen status template using summary and dynamic message values', () => {
    const payload = buildTemplatePayload('grievance_status_citizen_v1', {
      citizen_name: 'Anand',
      grievance_id: 'GRV-2001',
      department_name: 'Water',
      sub_department_name: 'Zone A',
      grievance_summary: 'No water supply for three days',
      status: 'In Progress',
      dynamic_message: 'In Progress By: Officer One	\n\nIn Progress On: 2026-04-25 11:45'
    });

    const body = payload.components.find((component) => component.type === 'body');
    expect(body.parameters).toHaveLength(7);
    expect(body.parameters[4].text).toBe('No water supply for three days');
    expect(body.parameters[5].text).toBe('In Progress');
    expect(body.parameters[6].text).toBe('In Progress By: Officer One In Progress On: 2026-04-25 11:45');
  });
});
