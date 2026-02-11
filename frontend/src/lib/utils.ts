import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function formatDateTime(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

/**
 * Get a user-friendly error message from API/axios errors.
 * Prefers backend message (error.response?.data?.message) so users see why the request failed.
 */
export function getErrorMessage(error: unknown, fallback: string = 'Something went wrong'): string {
  if (error == null) return fallback;
  const err = error as { response?: { data?: { message?: string; error?: string }; status?: number }; message?: string };
  if (err.response?.data?.message && typeof err.response.data.message === 'string') return err.response.data.message;
  if (err.response?.data?.error && typeof err.response.data.error === 'string') return err.response.data.error;
  if (err.message && typeof err.message === 'string') return err.message;
  if (err.response?.status === 400) return 'Invalid request. Please check your input.';
  if (err.response?.status === 401) return 'Session expired. Please log in again.';
  if (err.response?.status === 403) return 'You do not have permission for this action.';
  if (err.response?.status === 404) return 'The requested resource was not found.';
  if (err.response?.status && err.response.status >= 500) return 'Server error. Please try again later.';
  return fallback;
}
