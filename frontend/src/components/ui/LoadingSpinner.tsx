'use client';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  text?: string;
  className?: string;
}

export default function LoadingSpinner({ size = 'md', text, className = '' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24'
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className="relative">
        {/* Outer rotating ring */}
        <div className={`${sizeClasses[size]} rounded-full border-4 border-gray-200 animate-spin`}></div>
        
        {/* Gradient spinner */}
        <div 
          className={`absolute top-0 left-0 ${sizeClasses[size]} rounded-full border-4 border-transparent border-t-blue-600 border-r-purple-600 animate-spin`}
          style={{ animationDuration: '1s' }}
        ></div>
        
        {/* Inner pulsing dot */}
        <div 
          className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 ${
            size === 'sm' ? 'w-2 h-2' : size === 'md' ? 'w-3 h-3' : size === 'lg' ? 'w-4 h-4' : 'w-6 h-6'
          } bg-gradient-to-r from-blue-600 to-purple-600 rounded-full animate-pulse`}
        ></div>
      </div>
      
      {text && (
        <p className={`mt-4 text-gray-600 font-medium animate-pulse ${
          size === 'sm' ? 'text-sm' : size === 'md' ? 'text-base' : size === 'lg' ? 'text-lg' : 'text-xl'
        }`}>
          {text}
        </p>
      )}
    </div>
  );
}
