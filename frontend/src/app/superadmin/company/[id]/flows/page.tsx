'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Plus, Workflow, Trash2, Edit, Copy, Search, Play, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { chatbotFlowApi, Flow } from '@/lib/api/chatbotFlow';

export default function CompanyFlowsPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;

  const [flows, setFlows] = useState<Flow[]>([]);
  const [activeTab, setActiveTab] = useState<'your-flows' | 'templates'>('your-flows');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [hasDefaults, setHasDefaults] = useState<boolean>(true); // Default to true to avoid flicker

  const loadFlows = useCallback(async () => {
    try {
      setLoading(true);
      const response = await chatbotFlowApi.getFlows(companyId);
      if (response.success) {
        setFlows(response.data || []);
      }
      
      const defaultsRes = await chatbotFlowApi.hasDefaults(companyId);
      if (defaultsRes.success) {
        setHasDefaults(defaultsRes.hasDefaults);
      }
    } catch (error) {
      console.error('Failed to load flows:', error);
      toast.error('Failed to load flows from server');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (companyId) {
      loadFlows();
    }
  }, [companyId, loadFlows]);

  const handleCreateFlow = () => {
    router.push(`/superadmin/company/${companyId}/chatbot-flows/create`);
  };

  const handleEditFlow = (flowId: string) => {
    router.push(`/superadmin/company/${companyId}/chatbot-flows/${flowId}/edit`);
  };

  const handleDuplicateFlow = async (flowId: string) => {
    try {
      const response = await chatbotFlowApi.duplicateFlow(flowId);
      if (response.success) {
        toast.success('Flow duplicated successfully');
        loadFlows();
      }
    } catch (error: any) {
      console.error('Failed to duplicate flow:', error);
      toast.error(error.response?.data?.message || 'Failed to duplicate flow');
    }
  };

  const handleDeleteFlow = async (flowId: string) => {
    if (!confirm('Are you sure you want to permanently delete this flow?')) return;

    try {
      const response = await chatbotFlowApi.deleteFlow(flowId);
      if (response.success) {
        toast.success('Flow deleted successfully');
        loadFlows();
      }
    } catch (error: any) {
      console.error('Failed to delete flow:', error);
      toast.error(error.response?.data?.message || 'Failed to delete flow');
    }
  };

  const handleActivateFlow = async (flowId: string) => {
    try {
      const response = await chatbotFlowApi.activateFlow(flowId);
      if (response.success) {
        toast.success('Flow activated successfully');
        loadFlows();
      }
    } catch (error: any) {
      console.error('Failed to activate flow:', error);
      toast.error(error.response?.data?.message || 'Failed to activate flow');
    }
  };

  const handleGenerateDefaults = async () => {
    try {
      toast.loading('Generating default flows...', { id: 'gen-defaults' });
      const response = await chatbotFlowApi.generateDefaults(companyId);
      if (response.success) {
        toast.success('Default flows generated!', { id: 'gen-defaults' });
        loadFlows();
      }
    } catch (error: any) {
      console.error('Failed to generate defaults:', error);
      toast.error(error.response?.data?.message || 'Failed to generate flows', { id: 'gen-defaults' });
    }
  };

  const handleUseTemplate = (flowId: string) => {
    router.push(`/superadmin/company/${companyId}/chatbot-flows/create?templateId=${flowId}`);
  };

  const filteredFlows = flows.filter(flow => {
    const matchesSearch = (flow.flowName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (flow.flowDescription || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const yourFlows = filteredFlows; // Backend currently doesn't distinguish templates in main fetch
  const templates: Flow[] = []; // Templates logic can be added later if backend supports it

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Workflow className="w-12 h-12 text-purple-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Loading flows...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 sticky top-0 z-50 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                onClick={() => router.push(`/superadmin/company/${companyId}`)} 
                className="text-white/80 hover:text-white hover:bg-white/10 transition-all">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Company
              </Button>
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm shadow-lg">
                <Workflow className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Flows</h1>
                <p className="text-sm text-white/80 mt-0.5">Manage your chatbot flows</p>
              </div>
            </div>
            <Button
              onClick={handleCreateFlow}
              className="bg-white text-purple-600 hover:bg-white/90 rounded-xl shadow-lg">
              <Plus className="w-4 h-4 mr-2" />
              Create Flow
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Default Flows Banner */}
        {!hasDefaults && (
          <Card className="mb-8 border-2 border-dashed border-purple-200 bg-purple-50/50 rounded-2xl overflow-hidden">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4 text-center md:text-left">
                  <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-purple-900">Generate default flows</h3>
                    <p className="text-purple-700/80">Get started quickly with pre-built flows for Grievance, Appointment, and Tracking.</p>
                  </div>
                </div>
                <Button 
                  onClick={handleGenerateDefaults}
                  className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-200 px-8 rounded-xl h-12 whitespace-nowrap"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Generate Default Flows
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by flow name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 text-sm border border-gray-200 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent shadow-sm"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-6">
          <TabsList className="inline-flex h-12 items-center justify-center rounded-2xl bg-white/80 backdrop-blur-sm p-1.5 shadow-lg border border-slate-200/50 gap-1">
            <TabsTrigger 
              value="your-flows" 
              className="px-6 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
            >
              Your Flows ({yourFlows.length})
            </TabsTrigger>
            <TabsTrigger 
              value="templates" 
              className="px-6 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
            >
              Templates ({templates.length})
            </TabsTrigger>
          </TabsList>

          {/* Your Flows Tab */}
          <TabsContent value="your-flows" className="space-y-4">
            {yourFlows.length === 0 ? (
              <Card className="rounded-2xl border-0 shadow-xl">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Workflow className="w-16 h-16 text-gray-300 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">No Flows Yet</h3>
                  <p className="text-gray-500 mb-6">Create your first chatbot flow to get started</p>
                  <Button onClick={handleCreateFlow} className="bg-purple-600 hover:bg-purple-700 rounded-xl">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Flow
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {yourFlows.map((flow) => (
                  <Card key={flow._id} className="rounded-2xl shadow-xl overflow-hidden hover:shadow-2xl transition-all border border-slate-100">
                    <div className="p-6 md:p-8">
                      <div className="flex flex-col md:flex-row justify-between gap-6">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                            <Workflow className="w-6 h-6 text-purple-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-xl font-bold text-gray-900">{flow.flowName}</h3>
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded uppercase">v{flow.version}</span>
                            </div>
                            <p className="text-gray-500 line-clamp-2 mb-4">{flow.flowDescription || 'No description'}</p>
                            
                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                              <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full"></span>
                                <b>{flow.steps?.length || 0}</b> steps
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                                Type: <b>{flow.flowType}</b>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></span>
                                Created: <b>{new Date(flow.createdAt).toLocaleDateString()}</b>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-row md:flex-col justify-end gap-2 shrink-0">
                          <div className="flex gap-2">
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => handleEditFlow(flow._id)}
                              className="rounded-xl border-purple-100 hover:bg-purple-50 hover:text-purple-600 transition-colors h-11 w-11"
                              title="Edit Flow"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => handleDuplicateFlow(flow._id)}
                              className="rounded-xl border-slate-200 hover:bg-slate-50 transition-colors h-11 w-11"
                              title="Duplicate"
                            >
                              <Copy className="w-4 h-4 text-slate-500" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => handleActivateFlow(flow._id)}
                              className={`rounded-xl border-slate-200 hover:bg-slate-50 transition-colors h-11 w-11 ${flow.isActive ? 'bg-green-50 border-green-200 text-green-600 hover:bg-green-100' : ''}`}
                              title={flow.isActive ? "Flow is Active" : "Activate Flow"}
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="destructive"
                              onClick={() => handleDeleteFlow(flow._id)}
                              className="rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border-0 transition-all h-11 w-11 shadow-sm"
                              title="Delete Permanently"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                         <div className="flex items-center gap-2 text-sm text-slate-600">
                            <b>Triggers:</b>
                            <div className="flex gap-1.5">
                               {flow.triggers?.map((t: any, i: number) => (
                                 <span key={i} className="px-2 py-0.5 bg-slate-100 rounded text-xs font-medium">{t.triggerValue}</span>
                               ))}
                            </div>
                         </div>
                         <Button 
                           variant={flow.isActive ? "default" : "secondary"}
                           disabled={flow.isActive}
                           onClick={() => handleActivateFlow(flow._id)}
                           className={`rounded-xl h-10 px-6 font-semibold shadow-sm ${flow.isActive ? 'bg-indigo-600' : ''}`}
                         >
                           {flow.isActive ? 'Active on WhatsApp' : 'Assign to WhatsApp'}
                         </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates" className="space-y-4">
            <Card className="rounded-2xl border-0 shadow-xl">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Workflow className="w-16 h-16 text-gray-300 mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">Templates Coming Soon</h3>
                <p className="text-gray-500 mb-6">Pre-built chatbot structures to help you get started even faster.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
