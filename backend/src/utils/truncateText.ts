export function truncateText(text: string, maxLength: number): string {
  if (!text) return '';

  const safeMax = Math.max(0, Math.floor(maxLength));
  if (safeMax === 0) return '';
  if (text.length <= safeMax) return text;

  if (safeMax <= 3) {
    return text.slice(0, safeMax);
  }

  const sliceLength = safeMax - 3;
  const truncated = text.slice(0, sliceLength);
  const lastSpaceIndex = truncated.lastIndexOf(' ');

  if (lastSpaceIndex > 0) {
    return `${truncated.slice(0, lastSpaceIndex)}...`;
  }

  return `${truncated}...`;
}

export function prepareSummaryText(
  summary: string,
  summaryLimit = 400,
  continuationText = 'Read more in dashboard.'
): string {
  const normalized = (summary || '').trim();
  if (!normalized) return '';

  if (normalized.length <= summaryLimit) {
    return normalized;
  }

  const continuationSuffix = `\n\n${continuationText}`;
  const maxCoreLength = Math.max(0, summaryLimit - continuationSuffix.length);
  const core = truncateText(normalized, maxCoreLength);
  return `${core}${continuationSuffix}`;
}
