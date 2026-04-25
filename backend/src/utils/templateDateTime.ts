export function formatTemplateDateTime(
  date: Date = new Date(),
  locale = 'en-IN'
): string {
  try {
    const formatter = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata'
    });

    const parts = formatter.formatToParts(date);
    const p: Record<string, string> = {};
    parts.forEach((part) => {
      p[part.type] = part.value;
    });

    const day = p.day || '';
    const month = p.month || '';
    const year = p.year || '';
    const hour = (p.hour || '').padStart(2, '0');
    const minute = (p.minute || '').padStart(2, '0');
    const second = (p.second || '').padStart(2, '0');
    const dayPeriod = String(p.dayPeriod || p.ampm || '').toLowerCase();

    return `${day} ${month} ${year} at ${hour}:${minute}:${second} ${dayPeriod}`
      .trim()
      .replace(/\s+/g, ' ');
  } catch (_error) {
    return date.toLocaleString(locale, { timeZone: 'Asia/Kolkata' });
  }
}
