'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function FlowBuilderRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to new flows page
    router.replace('/flows');
  }, [router]);

  return (
    <div className="h-screen w-full flex items-center justify-center">
      <LoadingSpinner text="Redirecting to Flows..." />
    </div>
  );
}
