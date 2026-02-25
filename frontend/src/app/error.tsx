'use client';

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
        <h2 className="text-xl font-semibold text-red-700">Something went wrong</h2>
        <p className="mt-2 text-sm text-slate-700">
          {error?.message || 'Unexpected error occurred. Please retry.'}
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white"
          >
            Retry
          </button>
          <button
            onClick={() => (window.location.href = '/')}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700"
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}
