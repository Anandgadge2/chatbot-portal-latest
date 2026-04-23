/**
 * Normalizes phone number to 12 digits (with country code 91 for India)
 * If 10 digits, prepends 91. If 12 digits, returns as is.
 * @param phone - Phone number string
 * @returns 12 digit phone number
 */
export function normalizePhoneNumber(phone: string | undefined | null): string {
    if (!phone) return "";
    
    // Remove all non-digit characters
    const digitsOnly = phone.toString().replace(/\D/g, '');
    
    // If 10 digits, prepend 91 (India)
    if (digitsOnly.length === 10) {
      return '91' + digitsOnly;
    }
    
    // If it's more than 10 digits (likely already has country code), return last 12
    if (digitsOnly.length > 12) {
      return digitsOnly.slice(-12);
    }
    
    return digitsOnly;
  }
  
  /**
   * Denormalizes phone number - returns only the last 10 digits for dashboard display
   * @param phone - Phone number string
   * @returns 10 digit phone number
   */
  export function denormalizePhoneNumber(phone: string | undefined | null): string {
    if (!phone) return "";
    const digitsOnly = phone.toString().replace(/\D/g, '');
    return digitsOnly.length > 10 ? digitsOnly.slice(-10) : digitsOnly;
  }
  
  /**
   * Formats phone number to exactly 10 digits for display (removes country code)
   * @param phone - Phone number string
   * @returns 10 digit phone number
   */
  export function formatTo10Digits(phone: string | undefined | null): string {
    if (!phone) return "";
    const digitsOnly = phone.toString().replace(/\D/g, '');
    if (digitsOnly.length > 10) {
      return digitsOnly.slice(-10);
    }
    return digitsOnly;
  }
  
  /**
   * Validates phone number - must be 10 or 12 digits
   * @param phone - Phone number string
   * @returns true if valid, false otherwise
   */
  export function validatePhoneNumber(phone: string | undefined | null): boolean {
    if (!phone) return false;
    
    // Remove all non-digit characters
    const digitsOnly = phone.toString().replace(/\D/g, '');
    
    // Must be 10 or 12 digits
    return digitsOnly.length === 10 || digitsOnly.length === 12;
  }
  
  /**
   * Validates telephone (contact phone: landline or mobile) - 6 to 15 digits after stripping
   */
  export function validateTelephone(phone: string | undefined | null): boolean {
    if (!phone) return false;
    const digitsOnly = phone.toString().replace(/\D/g, '');
    return digitsOnly.length >= 6 && digitsOnly.length <= 15;
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
