/**
 * Normalizes phone number by removing country code prefix (91 for India)
 * Returns only the last 10 digits
 * @param phone - Phone number string
 * @returns 10 digit phone number
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return phone;
  
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');
  
  // Return the last 10 digits
  if (digitsOnly.length > 10) {
    return digitsOnly.slice(-10);
  }
  
  return digitsOnly;
}

/**
 * Validates phone number - must be exactly 10 digits
 * @param phone - Phone number string
 * @returns true if valid, false otherwise
 */
export function validatePhoneNumber(phone: string): boolean {
  if (!phone) return false;
  
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');
  
  // Must be exactly 10 digits
  return digitsOnly.length === 10;
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
  return password.length >= 6;
}
