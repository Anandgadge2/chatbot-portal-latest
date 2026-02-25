'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import RouteRedirectLoader from '@/components/ui/RouteRedirectLoader';


export default function FlowBuilderRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to new flows page
    router.replace('/flows');
  }, [router]);

  return (
    <RouteRedirectLoader
      title="Redirecting to Flow Builder"
      message="Taking you to the latest flow management experience..."
    />
  );
}
