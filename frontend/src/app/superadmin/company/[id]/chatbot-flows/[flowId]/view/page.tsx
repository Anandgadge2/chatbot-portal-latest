'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function ViewFlowPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.id as string;
  const flowId = params.flowId as string;

  useEffect(() => {
    // Redirect to the edit page which opens the visual builder
    router.replace(`/superadmin/company/${companyId}/chatbot-flows/${flowId}/edit`);
  }, [router, companyId, flowId]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <LoadingSpinner size="xl" text="Redirecting to flow builder..." />
    </div>
  );
}
