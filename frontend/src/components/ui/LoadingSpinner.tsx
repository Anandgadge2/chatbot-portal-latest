'use client';

interface LoadingSpinnerProps {
  text?: string;
  className?: string;
}

export default function LoadingSpinner({ text, className = '' }: LoadingSpinnerProps) {
  // Enforced single medium size
  const sizeClass = 'w-10 h-10 border-3';
  const innerDotClass = 'w-5 h-5';

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className="relative">
        <div className={`${sizeClass} rounded-full border-slate-200 border-t-primary animate-spin`}></div>
      </div>
      
      {text && (
        <p className={`mt-4 text-slate-600 font-medium animate-pulse text-sm`}>
          {text}
        </p>
      )}
    </div>
  );
}
