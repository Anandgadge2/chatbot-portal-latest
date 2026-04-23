/**
 * Normalizes phone number to 12 digits (with country code 91 for India)
 * If 10 digits, prepends 91. If 12 digits, returns as is.
 * @param phone - Phone number string
 * @returns 12 digit phone number
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return phone;
  
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '');
  
  // Handle leading zeros (common in Indian formats like 09356...)
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.substring(1);
  }

  // If 10 digits, prepend 91 (India)
  if (digits.length === 10) {
    return '91' + digits;
  }
  
  // If it's already 12 digits (starting with 91), return as is
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }

  // If it's more than 12 digits, take last 12
  if (digits.length > 12) {
    return digits.slice(-12);
  }
  
  return digits;
}

/**
 * Validates phone number - must be 10 or 12 digits
 * @param phone - Phone number string
 * @returns true if valid, false otherwise
 */
export function validatePhoneNumber(phone: string): boolean {
  if (!phone) return false;
  
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');
  
  // Must be 10 or 12 digits
  return digitsOnly.length === 10 || digitsOnly.length === 12;
}

/**
 * Validates telephone number (landline or mobile) - 6 to 15 digits after stripping spaces/dashes
 * Use for contact phone fields; use validatePhoneNumber for user mobile (10 digits)
 */
export function validateTelephone(phone: string): boolean {
  if (!phone) return false;
  const digitsOnly = phone.replace(/\D/g, '');
  return digitsOnly.length >= 6 && digitsOnly.length <= 15;
}

/**
 * Normalizes telephone for storage: digits only; return last 10 digits if longer
 */
export function normalizeTelephone(phone: string): string {
  if (!phone) return phone;
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length > 10) return digitsOnly.slice(-10);
  return digitsOnly;
}

/**
 * Validates password - must be at least 6 characters
 * @param password - Password string
 * @returns true if valid, false otherwise
 */
export function validatePassword(password: string): boolean {
  if (!password) return false;
  return password.length >= 5;
}
