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
  const safeRemark = sanitizeText(remarks || '', 60);
  const safeResolvedBy = sanitizeText(resolvedByName || '', 40);
  const safeResolvedDate = sanitizeText(formattedResolvedDate || '', 30);

  if (status === 'RESOLVED') {
    return `Resolved By: ${safeResolvedBy || 'N/A'}\nResolved On: ${safeResolvedDate || 'N/A'}\nThank you for your patience.`;
  }

  if (status === 'REJECTED') {
    return `We regret to inform you that your grievance has been rejected.\n${safeRemark ? 'Note: ' + safeRemark : ''}`.trim();
  }

  return `Your grievance is being processed.\n${safeRemark ? 'Update: ' + safeRemark : ''}`.trim();
}
