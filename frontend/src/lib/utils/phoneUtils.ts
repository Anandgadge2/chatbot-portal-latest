/**
 * Normalizes phone number by removing country code prefix (91 for India)
 * Returns only the last 10 digits
 * @param phone - Phone number string
 * @returns 10 digit phone number
 */
export function normalizePhoneNumber(phone: string | undefined | null): string {
    if (!phone) return "";
    
    // Remove all non-digit characters
    const digitsOnly = phone.toString().replace(/\D/g, '');
    
    // Return the last 10 digits
    if (digitsOnly.length > 10) {
      return digitsOnly.slice(-10);
    }
    
    return digitsOnly;
  }
  
  /**
   * Denormalizes phone number - since we now only store 10 digits, it just returns the digits
   * @param phone - Phone number string
   * @returns 10 digit phone number
   */
  export function denormalizePhoneNumber(phone: string | undefined | null): string {
    if (!phone) return "";
    return phone.toString().replace(/\D/g, '');
  }
  
  /**
   * Formats phone number to exactly 10 digits by removing prefixes 
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
   * Validates phone number - must be exactly 10 digits
   * @param phone - Phone number string
   * @returns true if valid, false otherwise
   */
  export function validatePhoneNumber(phone: string | undefined | null): boolean {
    if (!phone) return false;
    
    // Remove all non-digit characters
    const digitsOnly = phone.toString().replace(/\D/g, '');
    
    // Must be exactly 10 digits
    return digitsOnly.length === 10;
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
    return password.length >= 6;
  }
