'use client';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  text?: string;
  className?: string;
}

export default function LoadingSpinner({ size = 'md', text, className = '' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-5 h-5 border-2',
    md: 'w-10 h-10 border-4',
    lg: 'w-16 h-16 border-4',
    xl: 'w-24 h-24 border-4'
  };

  const innerDotClasses = {
    sm: 'w-2 h-2',
    md: 'w-5 h-5',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className="relative">
        <div className={`${sizeClasses[size]} rounded-full border-transparent border-t-purple-500 border-r-cyan-500 animate-spin`}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className={`${innerDotClasses[size]} bg-gradient-to-br from-purple-500 to-cyan-500 rounded-full animate-pulse shadow-lg shadow-purple-500/50`}></div>
        </div>
      </div>
      
      {text && (
        <p className={`mt-4 text-slate-600 font-medium animate-pulse ${
          size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base'
        }`}>
          {text}
        </p>
      )}
    </div>
  );
}
