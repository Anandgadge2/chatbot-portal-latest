'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Workflow } from 'lucide-react';

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
      <div className="text-center">
        <Workflow className="w-12 h-12 text-purple-600 mx-auto mb-4 animate-spin" />
        <p className="text-gray-600 font-medium">Redirecting to flow builder...</p>
      </div>
    </div>
  );
}
