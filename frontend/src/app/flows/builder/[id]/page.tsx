'use client';

import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import FlowCanvas from '@/components/flow-builder/FlowCanvas';
import { Toaster, toast } from 'react-hot-toast';
import { ArrowLeft, Save } from 'lucide-react';
import { FlowNode, FlowEdge } from '@/types/flowTypes';

export default function FlowBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const flowId = params.id as string;
  const isNewFlow = flowId === 'new';
  
  const [flowName, setFlowName] = useState('Untitled Flow');
  const [saving, setSaving] = useState(false);
  const [initialNodes, setInitialNodes] = useState<FlowNode[]>([]);
  const [initialEdges, setInitialEdges] = useState<FlowEdge[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isNewFlow) {
      loadFlow(flowId);
    } else {
      setLoaded(true);
    }
  }, [flowId, isNewFlow]);

  const loadFlow = async (id: string) => {
    try {
      setLoaded(false);
      const response = await axios.get(`/api/chatbot-flows/${id}`);
      
      if (response.data.success) {
        const flow = response.data.data;
        setFlowName(flow.flowName || flow.name || 'Untitled');
        setInitialNodes(flow.nodes || []);
        setInitialEdges(flow.edges || []);
      } else {
        toast.error('Flow not found');
      }
      
      setLoaded(true);
    } catch (error: any) {
      console.error('Failed to load flow:', error);
      // Fallback for demo/testing if API fails
      if (error.response?.status === 404 || !id.match(/^[0-9a-fA-F]{24}$/)) {
        const storedFlows = localStorage.getItem('chatbot_flows');
        if (storedFlows) {
          const flows = JSON.parse(storedFlows);
          const flow = flows.find((f: any) => f._id === id || f.flowId === id);
          if (flow) {
            setFlowName(flow.name || flow.flowName || 'Untitled');
            setInitialNodes(flow.nodes || []);
            setInitialEdges(flow.edges || []);
            setLoaded(true);
            return;
          }
        }
      }
      toast.error('Failed to load flow from server');
      setLoaded(true);
    }
  };

  const handleSave = useCallback(async (nodes: FlowNode[], edges: FlowEdge[]) => {
    setSaving(true);
    
    try {
      const flowData = {
        name: flowName,
        flowName: flowName,
        nodes,
        edges,
        isPreTransformed: true, // We want to save the raw nodes/edges if possible or let backend handle it
      };

      if (isNewFlow) {
        const response = await axios.post('/api/chatbot-flows', {
          ...flowData,
          companyId: 'CMP000001', // Default or from context
          isActive: true
        });
        
        if (response.data.success) {
          toast.success('Flow created successfully');
          router.replace(`/flows/builder/${response.data.data._id}`);
        }
      } else {
        const response = await axios.put(`/api/chatbot-flows/${flowId}`, flowData);
        if (response.data.success) {
          toast.success('Flow saved successfully to server');
        }
      }
    } catch (error: any) {
      console.error('Failed to save flow:', error);
      toast.error(`Failed to save: ${error.response?.data?.message || error.message}`);
      
      // Fallback to localStorage on error
      const storedFlows = localStorage.getItem('chatbot_flows');
      const flows = storedFlows ? JSON.parse(storedFlows) : [];
      const localFlow = {
        _id: isNewFlow ? `flow_${Date.now()}` : flowId,
        name: flowName,
        nodes,
        edges,
        updatedAt: new Date().toISOString()
      };
      
      if (isNewFlow) flows.push(localFlow);
      else {
        const idx = flows.findIndex((f: any) => f._id === flowId);
        if (idx !== -1) flows[idx] = localFlow;
        else flows.push(localFlow);
      }
      localStorage.setItem('chatbot_flows', JSON.stringify(flows));
      toast.success('Saved locally as fallback');
    } finally {
      setSaving(false);
    }
  }, [flowName, flowId, isNewFlow, router]);

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
  }, [flowName, flowId, isNewFlow, handleSave]);

  const handleBack = () => {
    if (confirm('Are you sure you want to leave? Any unsaved changes will be lost.')) {
      router.push('/flows');
    }
  };

  if (!loaded) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <LoadingSpinner size="xl" text="Loading flow..." />
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-right" />
      <div className="h-screen w-full flex flex-col">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Flows
            </button>
            <div className="h-6 w-px bg-gray-300"></div>
            <input
              type="text"
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              className="text-lg font-semibold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-teal-500 rounded px-2"
              placeholder="Flow name..."
            />
          </div>
          <button
            onClick={handleSaveClick}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Flow'}
          </button>
        </div>

        {/* Canvas */}
        <div className="flex-1">
          <FlowCanvas 
            initialNodes={initialNodes}
            initialEdges={initialEdges}
          />
        </div>
      </div>
    </>
  );
}
