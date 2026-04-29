export function formatTemplateDateTime(
  date: Date = new Date(),
  locale = 'en-IN'
): string {
  try {
    const formatter = new Intl.DateTimeFormat(locale, {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    const parts = formatter.formatToParts(new Date(date));
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '';

    const day = get('day');
    const month = get('month');
    const year = get('year');
    const hour = get('hour');
    const minute = get('minute');
    const second = get('second');
    const dayPeriod = get('dayPeriod').toLowerCase();

    return `${day} ${month} ${year} at ${hour}:${minute}:${second} ${dayPeriod}`;
  } catch (_error) {
    return new Date(date).toLocaleString(locale, { timeZone: 'Asia/Kolkata' });
  }
}
