"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { apiClient } from '@/lib/api/client';

export default function HealthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
        const healthUrl = `${apiUrl}/health?t=${Date.now()}`;
        
        // Using the timestamp in URL is enough to bust cache on most modern browsers
        const response = await fetch(healthUrl, {
          cache: 'no-store'
        });
        
        const data = await response.json();
        
        // Lenient but safe check for health
        const isCurrentlyHealthy = 
          response.ok && 
          data.status === 'OK' && 
          data.maintenance !== true;
        
        if (isCurrentlyHealthy) {
          if (pathname === '/maintenance') {
            console.log('✅ System healthy, restoring access...');
            // Hard redirect to clear all states and force a full app reload
            window.location.href = '/';
          }
          setIsChecking(false);
        } else {
          if (pathname !== '/maintenance') {
            router.push('/maintenance');
          }
        }
      } catch (error) {
        // If server is unreachable
        if (pathname !== '/maintenance') {
          router.push('/maintenance');
        }
      }
    };

    checkHealth();
    
    // Poll frequently (every 4s) during maintenance for immediate recovery
    const intervalTime = pathname === '/maintenance' ? 4000 : 30000;
    const interval = setInterval(checkHealth, intervalTime);
    return () => clearInterval(interval);
  }, [pathname, router]);

  if (isChecking && pathname !== '/maintenance') {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
          <p className="text-slate-400 font-medium animate-pulse">Initializing Portal...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
