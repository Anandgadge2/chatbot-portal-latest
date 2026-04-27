const date = new Date('2026-04-27T13:28:22');
const locale = 'en-IN';

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
const p = {};
parts.forEach((part) => {
  p[part.type] = part.value;
});

console.log('Parts:', p);

const day = p.day || '';
const month = p.month || '';
const year = p.year || '';
const hour = (p.hour || '').padStart(2, '0');
const minute = (p.minute || '').padStart(2, '0');
const second = (p.second || '').padStart(2, '0');
const dayPeriod = String(p.dayPeriod || p.ampm || '').toLowerCase();

const result = `${day} ${month} ${year} at ${hour}:${minute}:${second} ${dayPeriod}`
  .trim()
  .replace(/\s+/g, ' ');

console.log('Result:', result);
