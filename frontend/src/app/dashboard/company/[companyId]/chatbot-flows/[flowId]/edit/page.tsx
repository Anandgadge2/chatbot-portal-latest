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
  const companyId = (params.companyId || params.id) as string;
  const flowId = params.flowId as string;
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    // Allow if superadmin or if the user belongs to the company potentially, 
    // but the existing logic was superadmin only. I'll keep it consistent.
    if (!user.isSuperAdmin) {
      router.push('/dashboard');
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
        router.push(`/dashboard/company/${companyId}/chatbot-flows/create?edit=${flowId}`);
      } else {
        toast.error('Flow not found on server');
        router.push(`/dashboard/company/${companyId}?tab=flows`);
      }
    } catch (error: any) {
      console.error('Failed to load flow:', error);
      toast.error('Failed to load flow data from server');
      router.push(`/dashboard/company/${companyId}?tab=flows`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <LoadingSpinner text="Synchronizing workflow state..." />
    </div>
  );
}
