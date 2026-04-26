import { sanitizeText } from '../utils/sanitize';

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
  const safeDate = sanitizeText(formattedResolvedDate || '', 60);

  // Mapping internal status to display text
  const statusDisplay: Record<string, string> = {
    'RESOLVED': 'Resolved',
    'REJECTED': 'Rejected',
    'IN_PROGRESS': 'In Progress',
    'ASSIGNED': 'Assigned'
  };

  const currentStatusLabel = statusDisplay[status] || status;
  const actionLabel = currentStatusLabel;

  return [
    `Status: ${currentStatusLabel}`,
    `${actionLabel} By: ${safeAdminName || 'N/A'}`,
    `${actionLabel} On: ${safeDate || 'N/A'}`,
    safeRemark ? `Note: ${safeRemark}` : null
  ]
    .filter(Boolean)
    .join('\n');
}
