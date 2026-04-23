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

  // ✅ RESOLVED
  if (status === 'RESOLVED') {
    return [
      `Resolved By: ${safeResolvedBy || 'N/A'}`,
      `Resolved On: ${safeResolvedDate || 'N/A'}`,
      `Thank you for your patience.`
    ].join('\n');
  }

  // ✅ REJECTED
  if (status === 'REJECTED') {
    return [
      `Status Update: Grievance has been rejected.`,
      safeRemark ? `Note: ${safeRemark}` : null
    ]
      .filter(Boolean)
      .join('\n');
  }

  // ✅ IN PROGRESS (FIXED)
  if (status === 'IN_PROGRESS') {
    return [
      `Status Update: Your grievance is under review.`,
      safeRemark ? `Latest Update: ${safeRemark}` : null,
      `We will notify you once action is completed.`
    ]
      .filter(Boolean)
      .join('\n');
  }

  // ✅ FALLBACK (SAFE DEFAULT)
  return [
    `Status Update: Your grievance is being processed.`,
    safeRemark ? `Update: ${safeRemark}` : null
  ]
    .filter(Boolean)
    .join('\n');
}
