'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { chatbotFlowApi } from '@/lib/api/chatbotFlow';
import toast from 'react-hot-toast';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function EditFlowPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const companyId = params.id as string;
  const flowId = params.flowId as string;
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    if (user.role !== 'SUPER_ADMIN') {
      router.push('/superadmin/dashboard');
      return;
    }
    
    loadFlowAndRedirect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, companyId, flowId]);

  const loadFlowAndRedirect = async () => {
    try {
      const response = await chatbotFlowApi.getFlowById(flowId);
      if (response.success && response.data) {
        // Store flow data in sessionStorage for the creator/editor
        const storageKey = `flow_edit_${flowId}`;
        sessionStorage.setItem(storageKey, JSON.stringify(response.data));
        
        // Redirect to main builder with the edit flag
        router.push(`/superadmin/company/${companyId}/chatbot-flows/create?edit=${flowId}`);
      } else {
        toast.error('Flow not found on server');
        router.push(`/superadmin/company/${companyId}/chatbot-flows`);
      }
    } catch (error: any) {
      console.error('Failed to load flow:', error);
      toast.error('Failed to load flow data from server');
      router.push(`/superadmin/company/${companyId}/chatbot-flows`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <LoadingSpinner size="xl" text="Loading flow editor..." />
    </div>
  );
}
