export const GRIEVANCE_DESCRIPTION_CONTINUATION_TEXT =
  'To see the full grievance description, go to the dashboard portal.';

function normalizeTemplateParameterWhitespace(text: string): string {
  return String(text || '')
    .replace(/[\t\r\n]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
}

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
  continuationText = GRIEVANCE_DESCRIPTION_CONTINUATION_TEXT
): string {
  const normalized = normalizeTemplateParameterWhitespace(summary);
  if (!normalized) return '';

  if (normalized.length <= summaryLimit) {
    return normalized;
  }

  const continuationSuffix = ` ${normalizeTemplateParameterWhitespace(continuationText)}`;
  const maxCoreLength = Math.max(0, summaryLimit - continuationSuffix.length);
  const core = truncateText(normalized, maxCoreLength);
  return normalizeTemplateParameterWhitespace(`${core}${continuationSuffix}`);
}
