import { sanitizeDateTimeText, sanitizeText } from '../utils/sanitize';
import { formatTemplateDateTime } from '../utils/templateDateTime';

export function getCitizenStatusLabel(status: string): string {
  const normalizedStatus = String(status || '').trim();
  const statusKey = normalizedStatus.toUpperCase().replace(/[\s-]+/g, '_');

  const statusDisplay: Record<string, string> = {
    RESOLVED: 'Resolved',
    REJECTED: 'Rejected',
    IN_PROGRESS: 'In Progress',
    ASSIGNED: 'Assigned',
    PENDING: 'Pending',
    CLOSED: 'Closed',
    OPEN: 'Open'
  };

  return statusDisplay[statusKey] || normalizedStatus;
}

export function buildCitizenMessage({
  status,
  resolvedByName,
  formattedResolvedDate,
  remarks
}: {
  status: string;
  resolvedByName?: string;
  formattedResolvedDate?: string;
  remarks?: string;
}): string {

  const safeRemark = sanitizeText(remarks || '', 400);
  const safeAdminName = sanitizeText(resolvedByName || '', 60);
  const safeDate = sanitizeDateTimeText(formattedResolvedDate || '', 60) || formatTemplateDateTime(new Date(), 'en-IN');

  const currentStatusLabel = getCitizenStatusLabel(status);
  const actionLabel = currentStatusLabel;

  return [
    `${actionLabel} By: ${safeAdminName || 'N/A'}`,
    `${actionLabel} On: ${safeDate}`,
    safeRemark ? `Note: ${safeRemark}` : null
  ]
    .filter(Boolean)
    .join('\n\n');
}
