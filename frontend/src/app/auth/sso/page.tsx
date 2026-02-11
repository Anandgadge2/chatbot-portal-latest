'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

import { Loader2 } from 'lucide-react';

function SSOContent() {
  const searchParams = useSearchParams();
  const { ssoLogin } = useAuth();
  const hasTriedLogin = useRef(false);

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (token && !hasTriedLogin.current) {
      hasTriedLogin.current = true;
      ssoLogin(token);
    }
  }, [searchParams, ssoLogin]);

  return (
    <div className="relative flex flex-col items-center gap-6 p-8 bg-slate-900/50 border border-white/10 rounded-3xl backdrop-blur-xl shadow-2xl">
      <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20">
        <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
      </div>
      
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
          Authenticating
        </h1>
        <p className="text-slate-400">
          Please wait while we securely log you in...
        </p>
      </div>
      
      {/* Progress dots */}
      <div className="flex gap-1.5">
        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
      </div>
    </div>
  );
}

export default function SSOPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white">
      <div className="relative">
        {/* Glow effect */}
        <div className="absolute -inset-4 bg-blue-500/20 blur-2xl rounded-full animate-pulse" />
        <Suspense fallback={
          <div className="relative flex flex-col items-center gap-6 p-8 bg-slate-900/50 border border-white/10 rounded-3xl backdrop-blur-xl shadow-2xl">
            <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
          </div>
        }>
          <SSOContent />
        </Suspense>
      </div>
    </div>
  );
}
