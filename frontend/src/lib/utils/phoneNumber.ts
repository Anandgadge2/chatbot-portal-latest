/**
 * Phone number formatting utilities for WhatsApp Business API
 * Handles both test mode (+1 555...) and production mode (+91...) numbers
 */

/**
 * Formats a phone number with country code and proper spacing
 * @param phoneNumber - Raw phone number (can include or exclude country code)
 * @param countryCode - Country code (default: +91 for India)
 * @returns Formatted phone number with country code and spacing
 */
export function formatPhoneNumber(phoneNumber: string, countryCode: string = '+91'): string {
  // Remove all non-digit characters except +
  const cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // If already has country code, extract it
  let number = cleaned;
  let code = countryCode;
  
  if (cleaned.startsWith('+')) {
    // Extract country code
    if (cleaned.startsWith('+1')) {
      code = '+1';
      number = cleaned.substring(2);
    } else if (cleaned.startsWith('+91')) {
      code = '+91';
      number = cleaned.substring(3);
    } else {
      // Generic: assume first 2-3 digits after + are country code
      const match = cleaned.match(/^\+(\d{1,3})(\d+)$/);
      if (match) {
        code = `+${match[1]}`;
        number = match[2];
      }
    }
  }
  
  // Format based on country code
  if (code === '+1') {
    // US format: +1 555 194 4395
    const digits = number.replace(/\D/g, '');
    if (digits.length === 10) {
      return `${code} ${digits.substring(0, 3)} ${digits.substring(3, 6)} ${digits.substring(6)}`;
    }
    return `${code} ${digits}`;
  } else if (code === '+91') {
    // India format: +91 95038 50561
    const digits = number.replace(/\D/g, '');
    if (digits.length === 10) {
      return `${code} ${digits.substring(0, 5)} ${digits.substring(5)}`;
    }
    return `${code} ${digits}`;
  } else {
    // Generic format: +XX XXXXXXXXXX
    return `${code} ${number}`;
  }
}

/**
 * Normalizes a phone number to WhatsApp API format (digits only with country code)
 * @param phoneNumber - Formatted or unformatted phone number
 * @returns Normalized phone number (e.g., "15551944395" or "919503850561")
 */
export function normalizePhoneNumber(phoneNumber: string): string {
  // Remove all non-digit characters
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  // If it starts with country code, return as is
  if (cleaned.startsWith('1') && cleaned.length === 11) {
    return cleaned; // US number with country code
  }
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    return cleaned; // India number with country code
  }
  
  // If 10 digits, assume it needs country code (default India)
  if (cleaned.length === 10) {
    return `91${cleaned}`;
  }
  
  return cleaned;
}

/**
 * Detects country code from phone number
 * @param phoneNumber - Phone number with or without country code
 * @returns Detected country code (e.g., "+91", "+1")
 */
export function detectCountryCode(phoneNumber: string): string {
  const cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  if (cleaned.startsWith('+1') || cleaned.startsWith('1')) {
    return '+1';
  }
  if (cleaned.startsWith('+91') || cleaned.startsWith('91')) {
    return '+91';
  }
  
  // Default to India
  return '+91';
}

/**
 * Validates if a phone number is valid for WhatsApp API
 * @param phoneNumber - Phone number to validate
 * @returns true if valid, false otherwise
 */
export function isValidPhoneNumber(phoneNumber: string): boolean {
  const normalized = normalizePhoneNumber(phoneNumber);
  
  // US: 11 digits (1 + 10)
  if (normalized.startsWith('1') && normalized.length === 11) {
    return true;
  }
  
  // India: 12 digits (91 + 10)
  if (normalized.startsWith('91') && normalized.length === 12) {
    return true;
  }
  
  // Generic: at least 10 digits
  return normalized.length >= 10;
}

/**
 * Gets display format and API format from a phone number
 * @param phoneNumber - Input phone number
 * @returns Object with displayFormat and apiFormat
 */
export function getPhoneNumberFormats(phoneNumber: string): {
  displayFormat: string;
  apiFormat: string;
  countryCode: string;
} {
  const countryCode = detectCountryCode(phoneNumber);
  const apiFormat = normalizePhoneNumber(phoneNumber);
  const displayFormat = formatPhoneNumber(phoneNumber, countryCode);
  
  return {
    displayFormat,
    apiFormat,
    countryCode
  };
}
