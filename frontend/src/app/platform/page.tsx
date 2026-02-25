'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import RouteRedirectLoader from '@/components/ui/RouteRedirectLoader';

export default function PlatformIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/platform/overview');
  }, [router]);

  return (
    <RouteRedirectLoader
      title="Redirecting to Platform Control Center"
      message="Routing you to the Super Admin platform overview..."
    />
  );
}
