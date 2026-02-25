'use client';

import LoadingSpinner from './LoadingSpinner';

interface RouteRedirectLoaderProps {
  title?: string;
  message?: string;
}

export default function RouteRedirectLoader({
  title = 'Redirecting...',
  message = 'Please wait while we navigate you to the requested page.'
}: RouteRedirectLoaderProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
        <LoadingSpinner className="mx-auto" />
        <h2 className="mt-4 text-xl font-semibold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
      </div>
    </div>
  );
}
