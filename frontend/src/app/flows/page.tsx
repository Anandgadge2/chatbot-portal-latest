'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Edit, Copy, Trash2, MoreVertical } from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';
import { FlowTemplates, FLOW_TEMPLATES, FlowTemplate } from '@/components/flow-builder/FlowTemplates';

interface Flow {
  _id: string;
  name: string;
  description?: string;
  createdBy: {
    _id: string;
    name: string;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  nodes?: any[];  // Flow canvas nodes
  edges?: any[];  // Flow canvas edges
}

export default function FlowsPage() {
  const router = useRouter();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'your-flows' | 'templates'>('your-flows');

  useEffect(() => {
    fetchFlows();
  }, []);

  const fetchFlows = async () => {
    try {
      setLoading(true);
      
      // Get flows from localStorage
      const storedFlows = localStorage.getItem('chatbot_flows');
      if (storedFlows) {
        setFlows(JSON.parse(storedFlows));
      } else {
        // Initialize with empty array
        setFlows([]);
      }
    } catch (error) {
      console.error('Failed to fetch flows:', error);
      toast.error('Failed to load flows');
    } finally {
      setLoading(false);
    }
  };

  const saveFlowsToStorage = (updatedFlows: Flow[]) => {
    localStorage.setItem('chatbot_flows', JSON.stringify(updatedFlows));
    setFlows(updatedFlows);
  };

  const handleCreateFlow = () => {
    router.push('/flows/builder/new');
  };

  const handleEditFlow = (flowId: string) => {
    router.push(`/flows/builder/${flowId}`);
  };

  const handleDuplicateFlow = async (flowId: string) => {
    try {
      const flowToDuplicate = flows.find(f => f._id === flowId);
      if (!flowToDuplicate) return;

      const newFlow: Flow = {
        ...flowToDuplicate,
        _id: `flow_${Date.now()}`,
        name: `${flowToDuplicate.name} (Copy)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const updatedFlows = [...flows, newFlow];
      saveFlowsToStorage(updatedFlows);
      toast.success('Flow duplicated successfully');
    } catch (error) {
      toast.error('Failed to duplicate flow');
    }
  };

  const handleDeleteFlow = async (flowId: string) => {
    if (!confirm('Are you sure you want to delete this flow?')) return;
    
    try {
      const updatedFlows = flows.filter(f => f._id !== flowId);
      saveFlowsToStorage(updatedFlows);
      toast.success('Flow deleted successfully');
    } catch (error) {
      toast.error('Failed to delete flow');
    }
  };

  const handleToggleStatus = async (flowId: string, currentStatus: boolean) => {
    try {
      const updatedFlows = flows.map(f => 
        f._id === flowId ? { ...f, isActive: !currentStatus } : f
      );
      saveFlowsToStorage(updatedFlows);
      toast.success(`Flow ${!currentStatus ? 'activated' : 'deactivated'}`);
    } catch (error) {
      toast.error('Failed to update flow status');
    }
  };

  const handleSelectTemplate = (template: FlowTemplate) => {
    try {
      // Convert template steps to canvas nodes
      const nodes = template.steps || [];
      const edges = template.triggers || [];
      
      // Create a new flow from template with nodes and edges
      const newFlow: Flow = {
        _id: `flow_${Date.now()}`,
        name: template.name,
        description: template.description,
        createdBy: { _id: 'user1', name: 'mukund' },
        isActive: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        nodes,  // Save template nodes
        edges,  // Save template edges
      };

      const updatedFlows = [...flows, newFlow];
      saveFlowsToStorage(updatedFlows);
      
      // Show toast and navigate
      const toastId = toast.success(`Flow created from template: ${template.name}`, {
        duration: 2000, // Auto dismiss after 2 seconds
      });
      
      // Navigate to builder with the new flow after a brief delay
      setTimeout(() => {
        toast.dismiss(toastId);
        router.push(`/flows/builder/${newFlow._id}`);
      }, 1000);
    } catch (error) {
      toast.error('Failed to create flow from template');
    }
  };

  const handleSidebarNavigation = (path: string) => {
    router.push(path);
  };

  const filteredFlows = flows.filter(flow =>
    flow.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <Toaster position="top-right" />
      <div className="flex h-screen bg-gray-50">
        {/* Left Sidebar */}
        <div className="w-64 bg-white border-r border-gray-200 p-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Flows</h2>
          <nav className="space-y-1">
            <button 
              onClick={() => handleSidebarNavigation('/flows')}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-teal-600 bg-teal-50 rounded-lg"
            >
              <span className="text-lg">🔄</span>
              Flow Builder
            </button>
            <button 
              onClick={() => toast('Global Attributes - Coming soon!', { icon: 'ℹ️' })}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <span className="text-lg">⚙️</span>
              Global Attributes
            </button>
            <button 
              onClick={() => toast('Manage Catalogues - Coming soon!', { icon: 'ℹ️' })}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <span className="text-lg">📋</span>
              Manage Catalogues
            </button>
            <button 
              onClick={() => toast('Products - Coming soon!', { icon: 'ℹ️' })}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <span className="text-lg">🛍️</span>
              Products
            </button>
            <button 
              onClick={() => toast('Connect Catalogue - Coming soon!', { icon: 'ℹ️' })}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <span className="text-lg">🔗</span>
              Connect Catalogue
            </button>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-8">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Flow Builder</h1>
            </div>

            {/* Quick Guide */}
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Quick Guide</h3>
              <p className="text-xs text-gray-600 mb-3">
                You can connect with facebook to fetch catalogue and manage it from our platform.
              </p>
              <div className="flex gap-4 text-xs">
                <a href="#" className="flex items-center gap-1 text-blue-600 hover:underline">
                  <span>📘</span> How to create a catalogue in Commerce Manager?
                </a>
                <a href="#" className="flex items-center gap-1 text-blue-600 hover:underline">
                  <span>🛍️</span> How to manage your Meta catalogue with Shopify?
                </a>
              </div>
            </div>

            {/* Flow Count and Create Button */}
            <div className="flex items-center justify-between mb-6">
              <div className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{flows.length}</span> {flows.length === 1 ? 'Flow' : 'Flows'}
              </div>
              <button
                onClick={handleCreateFlow}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Create Flow
              </button>
            </div>

            {/* Search and Tabs */}
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by flow name"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => setActiveTab('your-flows')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'your-flows'
                      ? 'border-teal-600 text-teal-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>🔄</span> Your Flows
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('templates')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'templates'
                      ? 'border-teal-600 text-teal-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>📄</span> Templates
                    <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">NEW</span>
                  </span>
                </button>
              </div>

              {/* Tab Content */}
              {activeTab === 'your-flows' ? (
                // Your Flows Table
                loading ? (
                  <div className="p-8 text-center text-gray-500">Loading flows...</div>
                ) : filteredFlows.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    {searchQuery ? 'No flows found matching your search' : 'No flows yet. Create your first flow!'}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            Flow Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            Created By
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredFlows.map((flow) => (
                          <tr key={flow._id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <button
                                onClick={() => handleEditFlow(flow._id)}
                                className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                {flow.name}
                              </button>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                              {flow.createdBy.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={flow.isActive}
                                  onChange={() => handleToggleStatus(flow._id, flow.isActive)}
                                  className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                              </label>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleDuplicateFlow(flow._id)}
                                  className="p-1.5 text-gray-600 hover:text-teal-600 hover:bg-teal-50 rounded transition-colors"
                                  title="Duplicate"
                                >
                                  <Copy className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleEditFlow(flow._id)}
                                  className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="Edit"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteFlow(flow._id)}
                                  className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                // Templates Tab
                <div className="p-6">
                  <FlowTemplates onSelectTemplate={handleSelectTemplate} />
                </div>
              )}

              {/* Pagination */}
              {filteredFlows.length > 0 && (
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    1-2 of 2
                  </div>
                  <div className="flex gap-2">
                    <button className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50" disabled>
                      <span>‹</span>
                    </button>
                    <button className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50" disabled>
                      <span>›</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
