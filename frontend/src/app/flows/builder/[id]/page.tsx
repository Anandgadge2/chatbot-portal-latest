'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
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
      // Load flow from localStorage
      const storedFlows = localStorage.getItem('chatbot_flows');
      if (storedFlows) {
        const flows = JSON.parse(storedFlows);
        const flow = flows.find((f: any) => f._id === id);
        
        if (flow) {
          setFlowName(flow.name || 'Untitled');
          setInitialNodes(flow.nodes || []);
          setInitialEdges(flow.edges || []);
        } else {
          toast.error('Flow not found');
        }
      }
      
      setLoaded(true);
    } catch (error) {
      console.error('Failed to load flow:', error);
      toast.error('Failed to load flow');
      setLoaded(true);
    }
  };

  const handleSave = useCallback((nodes: FlowNode[], edges: FlowEdge[]) => {
    setSaving(true);
    
    const flowData = {
      name: flowName,
      nodes,
      edges,
    };

    // Save to localStorage
    setTimeout(async () => {
      try {
        // Get existing flows from localStorage
        const storedFlows = localStorage.getItem('chatbot_flows');
        const flows = storedFlows ? JSON.parse(storedFlows) : [];

        if (isNewFlow) {
          // Create new flow
          const newFlow = {
            _id: `flow_${Date.now()}`,
            name: flowName,
            description: '',
            createdBy: { _id: 'user1', name: 'mukund' },
            isActive: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            nodes,
            edges,
          };
          
          flows.push(newFlow);
          localStorage.setItem('chatbot_flows', JSON.stringify(flows));
          
          toast.success('Flow created successfully');
          
          // Update URL to the new flow ID
          router.replace(`/flows/builder/${newFlow._id}`);
        } else {
          // Update existing flow
          const flowIndex = flows.findIndex((f: any) => f._id === flowId);
          
          if (flowIndex !== -1) {
            flows[flowIndex] = {
              ...flows[flowIndex],
              name: flowName,
              updatedAt: new Date().toISOString(),
              nodes,
              edges,
            };
            localStorage.setItem('chatbot_flows', JSON.stringify(flows));
            toast.success('Flow saved successfully');
          } else {
            toast.error('Flow not found');
          }
        }
      } catch (error) {
        console.error('Failed to save flow:', error);
        toast.error('Failed to save flow');
      } finally {
        setSaving(false);
      }
    }, 500);
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
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading flow...</p>
        </div>
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
