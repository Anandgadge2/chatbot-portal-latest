'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save, Workflow } from 'lucide-react';
import FlowCanvas from '@/components/flow-builder/FlowCanvas';
import { FlowNode, FlowEdge, BackendFlow } from '@/types/flowTypes';
import { Toaster, toast } from 'react-hot-toast';
import { chatbotFlowApi } from '@/lib/api/chatbotFlow';
import { transformToBackendFormat, transformFromBackendFormat } from '@/lib/flowTransform';

export default function CreateFlowPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  
  const companyId = params.id as string;
  const editFlowId = searchParams.get('edit');
  const isEditing = !!editFlowId;

  const [flowName, setFlowName] = useState('Untitled Flow');
  const [flowDescription, setFlowDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEditing);
  const [initialNodes, setInitialNodes] = useState<FlowNode[]>([]);
  const [initialEdges, setInitialEdges] = useState<FlowEdge[]>([]);

  // Load existing flow if editing
  const loadFlowData = useCallback(async () => {
    if (!editFlowId) return;

    try {
      setLoading(true);
      const storageKey = `flow_edit_${editFlowId}`;
      let flowData: BackendFlow | null = null;

      // Try sessionStorage first (shared by edit page redirect)
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        flowData = JSON.parse(stored);
      } else {
        // Fallback to API if not in session storage
        const response = await chatbotFlowApi.getFlowById(editFlowId);
        if (response.success) {
          flowData = response.data;
        }
      }

      if (flowData) {
        setFlowName(flowData.flowName);
        setFlowDescription(flowData.flowDescription || '');
        
        const transformed = transformFromBackendFormat(flowData);
        setInitialNodes(transformed.nodes);
        setInitialEdges(transformed.edges);
      } else {
        toast.error('Flow data not found');
        router.push(`/superadmin/company/${companyId}/chatbot-flows`);
      }
    } catch (error) {
      console.error('Failed to load flow data:', error);
      toast.error('Failed to load flow data');
    } finally {
      setLoading(false);
    }
  }, [editFlowId, companyId, router]);

  useEffect(() => {
    if (isEditing) {
      loadFlowData();
    }
  }, [isEditing, loadFlowData]);

  const handleSave = useCallback(async (nodes: FlowNode[], edges: FlowEdge[]) => {
    if (!flowName.trim()) {
      toast.error('Please enter a flow name');
      return;
    }

    setSaving(true);
    try {
      const flowPayload = transformToBackendFormat({
        metadata: {
          name: flowName,
          description: flowDescription,
          companyId,
          version: 1,
          isActive: false,
          createdBy: user?.id || '',
          updatedBy: user?.id || '',
        },
        nodes,
        edges,
      });

      let response;
      if (isEditing) {
        response = await chatbotFlowApi.updateFlow(editFlowId!, flowPayload);
      } else {
        response = await chatbotFlowApi.createFlow(flowPayload);
      }

      if (response.success) {
        toast.success(isEditing ? 'Flow updated successfully' : 'Flow created successfully');
        
        // Clear session storage if editing
        if (isEditing) {
          sessionStorage.removeItem(`flow_edit_${editFlowId}`);
        }
        
        // Redirect back to flows list
        router.push(`/superadmin/company/${companyId}/chatbot-flows`);
      }
    } catch (error: any) {
      console.error('Failed to save flow:', error);
      toast.error(error.response?.data?.message || 'Failed to save flow');
    } finally {
      setSaving(false);
    }
  }, [flowName, flowDescription, companyId, isEditing, editFlowId, user, router]);

  const handleSaveClick = () => {
    // Trigger save event that FlowCanvas listens to
    window.dispatchEvent(new CustomEvent('flow:save'));
  };

  // Listen for flow data from canvas
  useEffect(() => {
    const handleFlowData = (event: any) => {
      const { nodes, edges } = event.detail;
      handleSave(nodes, edges);
    };

    window.addEventListener('flow:data', handleFlowData);
    return () => window.removeEventListener('flow:data', handleFlowData);
  }, [flowName, companyId, isEditing, editFlowId, user, handleSave]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <Workflow className="w-12 h-12 text-purple-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600 font-medium">Loading flow builder...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Toaster position="top-right" />
      
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 shadow-xl z-50">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                onClick={() => router.push(`/superadmin/company/${companyId}/chatbot-flows`)} 
                className="text-white/80 hover:text-white hover:bg-white/10 transition-all px-2"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              
              <div className="flex flex-col">
                <input
                  type="text"
                  value={flowName}
                  onChange={(e) => setFlowName(e.target.value)}
                  className="text-lg font-bold text-white bg-transparent border-none p-0 focus:outline-none placeholder-white/50"
                  placeholder="Flow name..."
                />
                <input
                  type="text"
                  value={flowDescription}
                  onChange={(e) => setFlowDescription(e.target.value)}
                  className="text-xs text-white/70 bg-transparent border-none p-0 focus:outline-none placeholder-white/30"
                  placeholder="Add a description..."
                />
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="hidden md:flex flex-col items-end mr-4 text-white/60 text-[10px] uppercase tracking-wider font-bold">
                <span>Company Mode</span>
                <span className="text-white/40">ID: {companyId.substring(0, 8)}...</span>
              </div>
              <Button
                onClick={handleSaveClick}
                disabled={saving}
                className="bg-white text-purple-600 hover:bg-white/90 transition-all rounded-xl px-6 h-10 font-bold shadow-lg disabled:opacity-50"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Flow'}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Flow Builder Canvas */}
      <div className="flex-1 overflow-hidden">
        <FlowCanvas 
          initialNodes={initialNodes}
          initialEdges={initialEdges}
          flowName={flowName}
          showToolbarSave={false}
          showToolbarName={false}
          onToolbarSave={(nodes, edges, name) => {
            if (name) setFlowName(name);
            handleSave(nodes, edges);
          }}
        />
      </div>
    </div>
  );
}
