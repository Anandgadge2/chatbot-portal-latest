import toast, { ToastOptions } from 'react-hot-toast';

const baseToastOptions: ToastOptions = {
  duration: 4500,
};

export const getErrorMessage = (error: any, fallback = 'Something went wrong. Please try again.'): string => {
  if (!error) return fallback;
  return (
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
};

export const showSuccessToast = (message: string, options?: ToastOptions) =>
  toast.success(message, { ...baseToastOptions, ...options });

export const showErrorToast = (error: any, fallback?: string, options?: ToastOptions) =>
  toast.error(getErrorMessage(error, fallback), { ...baseToastOptions, ...options });

export const showInfoToast = (message: string, options?: ToastOptions) =>
  toast(message, { icon: 'ℹ️', ...baseToastOptions, ...options });
