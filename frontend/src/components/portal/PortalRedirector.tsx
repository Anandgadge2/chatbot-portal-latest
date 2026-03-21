'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { portalAPI } from '@/lib/api/portal';
import { getPortalHomePath } from '@/lib/portal';
import toast from 'react-hot-toast';

export default function PortalRedirector() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const hasResolvedRef = useRef(false);

  useEffect(() => {
    if (loading || hasResolvedRef.current) return;

    if (!user) {
      router.replace('/');
      return;
    }

    hasResolvedRef.current = true;

    portalAPI
      .getBootstrap({ force: true })
      .then((response) => {
        const target = response?.data?.navigation?.entryRoute || getPortalHomePath(user);
        router.replace(target);
      })
      .catch((error: any) => {
        console.error('Failed to resolve portal entry route:', error);
        toast.error(error?.response?.data?.message || 'Failed to load your portal. Redirecting to the best available view.');
        router.replace(getPortalHomePath(user));
      });
  }, [loading, router, user]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <LoadingSpinner text="Preparing your portal..." />
    </div>
  );
}
