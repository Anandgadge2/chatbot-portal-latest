/**
 * Normalizes phone number by adding country code prefix (91 for India)
 * If phone is 10 digits, adds "91" prefix
 * If phone already has country code, returns as is
 * @param phone - Phone number string
 * @returns Normalized phone number with country code
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return phone;
  
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');
  
  // If it's exactly 10 digits, add 91 prefix
  if (digitsOnly.length === 10) {
    return `91${digitsOnly}`;
  }
  
  // If it already starts with 91 and has 12 digits total, return as is
  if (digitsOnly.startsWith('91') && digitsOnly.length === 12) {
    return digitsOnly;
  }
  
  // If it's 12 digits but doesn't start with 91, return as is (might be other country code)
  if (digitsOnly.length === 12) {
    return digitsOnly;
  }
  
  // For any other case, return the digits only
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
 * Normalizes telephone for storage: digits only; if 10 digits, prepend 91
 */
export function normalizeTelephone(phone: string): string {
  if (!phone) return phone;
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length === 10) return `91${digitsOnly}`;
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
