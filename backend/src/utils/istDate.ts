const IST_TIMEZONE = 'Asia/Kolkata';

export function getIstDateKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

export function isSameIstDate(left: Date | string, right: Date | string): boolean {
  return getIstDateKey(new Date(left)) === getIstDateKey(new Date(right));
}

export function getNextIstMidnightUtc(date: Date = new Date()): Date {
  const now = date;
  const istNow = new Date(now.toLocaleString('en-US', { timeZone: IST_TIMEZONE }));
  const nextIstMidnightLocal = new Date(istNow);
  nextIstMidnightLocal.setHours(24, 0, 0, 0);

  // Convert IST-local interpreted date back to UTC instant.
  const offsetNow = now.getTime() - istNow.getTime();
  return new Date(nextIstMidnightLocal.getTime() + offsetNow);
}

export const IST_TZ = IST_TIMEZONE;

export function getIstDayBoundsUtc(date: Date = new Date()): { start: Date; end: Date } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const dayKey = formatter.format(date); // YYYY-MM-DD
  const start = new Date(`${dayKey}T00:00:00+05:30`);
  const end = new Date(`${dayKey}T23:59:59.999+05:30`);
  return { start, end };
}

export function isWithin24Hours(from: Date | string, to: Date | string = new Date()): boolean {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  return (toDate.getTime() - fromDate.getTime()) <= 24 * 60 * 60 * 1000;
}
