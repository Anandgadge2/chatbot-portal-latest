'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import RouteRedirectLoader from '@/components/ui/RouteRedirectLoader';

export default function CompanyIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);

  return (
    <RouteRedirectLoader
      title="Redirecting to Company Dashboard"
      message="Routing you to your operational dashboard..."
    />
  );
}
