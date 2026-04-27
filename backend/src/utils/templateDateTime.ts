export function formatTemplateDateTime(
  date: Date = new Date(),
  locale = 'en-IN'
): string {
  try {
    const d = new Date(date);
    
    // Day: 27
    const day = d.getDate();
    
    // Month: April (Full name)
    const month = d.toLocaleString('en-US', { month: 'long', timeZone: 'Asia/Kolkata' });
    
    // Year: 2026
    const year = d.getFullYear();
    
    // Time Components
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';
    
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const hoursStr = String(hours).padStart(2, '0');

    // Format: 27 April 2026 at 01:28:22 pm
    return `${day} ${month} ${year} at ${hoursStr}:${minutes}:${seconds} ${ampm}`;
  } catch (_error) {
    // Fallback but still trying to keep format
    return date.toLocaleString(locale, { timeZone: 'Asia/Kolkata' });
  }
}
