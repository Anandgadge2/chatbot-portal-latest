const URL_REGEX = /(https?:\/\/|www\.)\S+/gi;
const ABUSIVE_TERMS = [/\b(abuse|hate|kill|terror|bomb)\b/i];

export const sanitizeText = (text: string = '', max = 80): string =>
  text
    ?.replace(URL_REGEX, '')
    .replace(/[^a-zA-Z0-9 .,-]/g, '')
    .substring(0, max)
    .trim();

export function sanitizeGrievanceDetails(text: string = ''): string {
  const cleaned = sanitizeText(text, 100);
  return ABUSIVE_TERMS.reduce((acc, pattern) => acc.replace(pattern, '[redacted]'), cleaned);
}

export function sanitizeRemarks(text: string = ''): string {
  return sanitizeText(text, 80);
}

export function sanitizeNote(text: string = ''): string {
  return sanitizeText(text, 80);
}
