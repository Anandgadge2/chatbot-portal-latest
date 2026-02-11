'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiClient } from '@/lib/api/client';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Edit, Copy, Trash2, Workflow, PlayCircle, PauseCircle, Eye, MessageSquare, CheckCircle } from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

export default function ChatbotFlowsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const companyId = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<any>(null);
  const [flows, setFlows] = useState<any[]>([]);
  const [whatsappConfig, setWhatsappConfig] = useState<any>(null);
  const [hasDefaultFlows, setHasDefaultFlows] = useState<boolean>(false);
  const [checkingDefaults, setCheckingDefaults] = useState(false);
  const [activeTab, setActiveTab] = useState<'your-flows' | 'templates'>('your-flows');
  const [confirmDialog, setConfirmDialog] = useState<any>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  useEffect(() => {
    if (user?.role !== 'SUPER_ADMIN') {
      router.push('/superadmin/dashboard');
      return;
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when companyId/role change only
  }, [companyId, user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch company
      const companyRes = await apiClient.get(`/companies/${companyId}`);
      if (companyRes?.success && companyRes?.data?.company) {
        setCompany(companyRes.data.company);
      } else if (companyRes?.company) {
        setCompany(companyRes.company);
      } else if (companyRes?.data?.name) {
        setCompany(companyRes.data);
      }

      // Fetch WhatsApp config
      try {
        const configRes = await apiClient.get(`/whatsapp-config/company/${companyId}`);
        if (configRes?.success && configRes?.data) {
          setWhatsappConfig(configRes.data);
        } else if (configRes?.data) {
          setWhatsappConfig(configRes.data);
        } else if (configRes?._id) {
          setWhatsappConfig(configRes);
        }
      } catch (configError: any) {
        if (configError.response?.status !== 404) {
          console.error('Failed to load WhatsApp config:', configError);
        }
      }

      // Load flows from backend API
      try {
        const flowsRes = await apiClient.get(`/chatbot-flows?companyId=${companyId}`);
        let flowsData = [];
        
        if (flowsRes?.success && Array.isArray(flowsRes.data)) {
          flowsData = flowsRes.data;
        } else if (Array.isArray(flowsRes)) {
          flowsData = flowsRes;
        } else if (flowsRes?.data && Array.isArray(flowsRes.data)) {
          flowsData = flowsRes.data;
        } else if ((flowsRes as any)?.flows && Array.isArray((flowsRes as any).flows)) {
          flowsData = (flowsRes as any).flows;
        }
        
        console.log(`📥 Loaded ${flowsData.length} flows from API`);
        setFlows(flowsData);
      } catch (flowsError: any) {
        console.error('❌ Failed to load flows from API:', flowsError);
        toast.error('Failed to load chatbot flows');
        setFlows([]);
      }

      // Check if default flows exist
      try {
        const defaultsRes = await apiClient.get(`/chatbot-flows/company/${companyId}/has-defaults`);
        if (defaultsRes?.success) {
          setHasDefaultFlows(defaultsRes.hasDefaults || false);
        } else if (defaultsRes && typeof (defaultsRes as any).hasDefaults === 'boolean') {
          setHasDefaultFlows((defaultsRes as any).hasDefaults);
        }
      } catch (defaultsError: any) {
        console.warn('⚠️ Failed to check default flows:', defaultsError);
      }
    } catch (error: any) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load page data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFlow = () => {
    router.push(`/superadmin/company/${companyId}/chatbot-flows/create`);
  };

  const handleGenerateDefaultFlows = async () => {
    try {
      setCheckingDefaults(true);
      const res = await apiClient.post(`/chatbot-flows/company/${companyId}/generate-defaults`);
      
      if (res.success) {
        if (res.alreadyExists) {
          toast.success(res.message || 'Default flows already exist and are available in the list below');
        } else {
          toast.success(res.message || `Generated ${res.data?.length || 0} default flow(s) successfully`);
        }
        setHasDefaultFlows(true);
        fetchData(); // Refresh to show new flows
      } else {
        toast.error(res.message || 'Failed to generate default flows');
      }
    } catch (error: any) {
      console.error('❌ Failed to generate default flows:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to generate default flows';
      
      // If it's a 400 error saying flows exist, treat it as success and refresh
      if (error.response?.status === 400 && errorMessage.includes('already exist')) {
        toast.success('Default flows already exist. Refreshing list...');
        setHasDefaultFlows(true);
        fetchData();
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setCheckingDefaults(false);
    }
  };

  const handleEditFlow = (flowId: string) => {
    router.push(`/superadmin/company/${companyId}/chatbot-flows/${flowId}/edit`);
  };

  const handleViewFlow = (flowId: string) => {
    router.push(`/superadmin/company/${companyId}/chatbot-flows/${flowId}/edit`);
  };

  const handleDuplicateFlow = async (flowId: string) => {
    try {
      const res = await apiClient.post(`/chatbot-flows/${flowId}/duplicate`);
      if (res.success) {
        toast.success(res.message || 'Flow duplicated successfully');
        fetchData();
      } else {
        toast.error(res.message || 'Failed to duplicate flow');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to duplicate flow');
    }
  };

  const handleToggleActiveFlow = async (flowId: string, currentActive: boolean) => {
    try {
      if (!currentActive) {
        // Activating this flow
        const res = await apiClient.post(`/chatbot-flows/${flowId}/activate`);
        if (res.success) {
          toast.success(res.message || 'Flow activated successfully');
          fetchData();
        } else {
          toast.error(res.message || 'Failed to activate flow');
        }
      } else {
        // Deactivating
        const res = await apiClient.put(`/chatbot-flows/${flowId}`, { isActive: false });
        if (res.success) {
          toast.success(res.message || 'Flow deactivated');
          fetchData();
        } else {
          toast.error(res.message || 'Failed to deactivate flow');
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to toggle flow status');
    }
  };

  const handleDeleteFlow = async (flowId: string) => {
    if (!flowId) {
      toast.error('Invalid flow ID');
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Delete Flow',
      message: 'Are you sure you want to delete this chatbot flow? This action cannot be undone.',
      variant: 'danger',
      onConfirm: async () => {
        try {
          console.log('🗑️ Deleting flow:', flowId);
          
          const res = await apiClient.delete(`/chatbot-flows/${flowId}`);
          
          console.log('📥 Delete response:', res);
          
          // apiClient.delete() returns response.data directly
          if (res?.success === true) {
            toast.success(res.message || 'Flow deleted successfully');
            fetchData(); // Refresh the list
          } else if (res?.data?.success) {
            // Fallback for different response format
            toast.success('Flow deleted successfully');
            fetchData();
          } else {
            toast.error(res?.message || 'Failed to delete flow');
          }
        } catch (error: any) {
          console.error('❌ Failed to delete flow:', error);
          console.error('Error details:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
            url: error.config?.url
          });
          
          // Show specific error message
          if (error.response?.status === 404) {
            toast.error('Flow not found. It may have already been deleted.');
          } else if (error.response?.status === 400) {
            toast.error(error.response?.data?.message || 'Invalid flow ID');
          } else {
            const errorMessage = error.response?.data?.message || error.message || 'Failed to delete flow';
            toast.error(errorMessage);
          }
        } finally {
          setConfirmDialog({ ...confirmDialog, isOpen: false });
        }
      }
    });
  };

  const handleAssignFlow = async (flowId: string) => {
    try {
      if (!whatsappConfig?._id) {
        toast.error('Please configure WhatsApp settings first');
        router.push(`/superadmin/company/${companyId}/whatsapp-config`);
        return;
      }

      // Find the flow to get its type
      const flow = flows.find(f => f._id === flowId || f.flowId === flowId || (f as any).id === flowId);
      if (!flow) {
        console.error('❌ Flow not found. Available flows:', flows.map(f => ({ _id: f._id, flowId: f.flowId, id: (f as any).id })));
        toast.error('Flow not found');
        return;
      }

      // Use MongoDB _id (ObjectId) for assignment, not flowId string
      // Try multiple possible ID fields
      const flowObjectId = flow._id || (flow as any).id || flow.flowId;
      
      console.log('🔍 Flow object:', {
        _id: flow._id,
        id: (flow as any).id,
        flowId: flow.flowId,
        selectedId: flowObjectId,
        flowType: flow.flowType
      });
      
      if (!flowObjectId) {
        console.error('❌ Flow ID is missing. Flow object:', flow);
        toast.error('Flow ID is missing. Please refresh and try again.');
        return;
      }

      // Validate it looks like an ObjectId (24 hex characters)
      const objectIdPattern = /^[0-9a-fA-F]{24}$/;
      if (!objectIdPattern.test(flowObjectId.toString())) {
        console.error('❌ Invalid ObjectId format:', flowObjectId);
        toast.error(`Invalid flow ID format: ${flowObjectId}. Please contact support.`);
        return;
      }

      console.log('🔗 Assigning flow to WhatsApp:', {
        configId: whatsappConfig._id,
        flowId: flowObjectId,
        flowIdString: flow.flowId,
        flowType: flow.flowType || 'custom'
      });

      // Backend expects POST, not PUT, and needs flowType
      // Backend expects MongoDB ObjectId (_id), not flowId string
      const res = await apiClient.post(`/whatsapp-config/${whatsappConfig._id}/assign-flow`, {
        flowId: flowObjectId.toString(), // Ensure it's a string
        flowType: flow.flowType || 'custom',
        priority: 0
      });

      console.log('📥 Assign response:', res);

      // apiClient.post() returns response.data directly
      if (res?.success === true) {
        toast.success(res.message || 'Flow assigned to WhatsApp configuration successfully');
        // Clear the debug flag and refresh data
        (window as any).__assignedFlowLogged = false;
        await fetchData(); // Refresh to show updated state
      } else if (res?.data?.success) {
        // Fallback for different response format
        toast.success('Flow assigned to WhatsApp configuration successfully');
        (window as any).__assignedFlowLogged = false;
        await fetchData();
      } else {
        toast.error(res?.message || 'Failed to assign flow');
      }
    } catch (error: any) {
      console.error('❌ Failed to assign flow:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      // Show specific error message
      if (error.response?.status === 404) {
        toast.error(error.response?.data?.message || 'WhatsApp configuration not found. Please configure WhatsApp settings first.');
      } else if (error.response?.status === 400) {
        const errorMsg = error.response?.data?.message || 'Flow assignment failed';
        if (errorMsg.includes('already assigned')) {
          toast.error('This flow is already assigned to the WhatsApp configuration');
        } else {
          toast.error(errorMsg);
        }
      } else {
        // Prefer backend message (it now includes the real cause)
        const backendMsg = error.response?.data?.message;
        const errorMessage = backendMsg || error.message || 'Failed to assign flow';
        toast.error(errorMessage);
      }
    }
  };

  const handleUnassignFlow = async (flowId: string) => {
    try {
      if (!whatsappConfig?._id) {
        toast.error('Please configure WhatsApp settings first');
        return;
      }

      // Find the flow
      const flow = flows.find(f => f._id === flowId || f.flowId === flowId || (f as any).id === flowId);
      if (!flow) {
        toast.error('Flow not found');
        return;
      }

      // Use MongoDB _id (ObjectId) for unassignment
      const flowObjectId = flow._id || (flow as any).id || flow.flowId;
      
      if (!flowObjectId) {
        toast.error('Flow ID is missing. Please refresh and try again.');
        return;
      }

      // Validate ObjectId format
      const objectIdPattern = /^[0-9a-fA-F]{24}$/;
      if (!objectIdPattern.test(flowObjectId.toString())) {
        toast.error('Invalid flow ID format. Please contact support.');
        return;
      }

      console.log('🔗 Unassigning flow from WhatsApp:', {
        configId: whatsappConfig._id,
        flowId: flowObjectId
      });

      // Delete the flow from activeFlows
      const res = await apiClient.delete(`/whatsapp-config/${whatsappConfig._id}/flow/${flowObjectId}`);

      console.log('📥 Unassign response:', res);

      if (res?.success === true) {
        toast.success(res.message || 'Flow unassigned from WhatsApp configuration successfully');
        // Clear the debug flag and refresh data
        (window as any).__assignedFlowLogged = false;
        await fetchData(); // Refresh to show updated state
      } else if (res?.data?.success) {
        toast.success('Flow unassigned from WhatsApp configuration successfully');
        (window as any).__assignedFlowLogged = false;
        await fetchData();
      } else {
        toast.error(res?.message || 'Failed to unassign flow');
      }
    } catch (error: any) {
      console.error('❌ Failed to unassign flow:', error);
      const backendMsg = error.response?.data?.message;
      const errorMessage = backendMsg || error.message || 'Failed to unassign flow';
      toast.error(errorMessage);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  const activeFlow = flows.find(f => f.isActive);

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
                className="text-white/80 hover:text-white hover:bg-white/10 transition-all"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Company
              </Button>
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm shadow-lg">
                <Workflow className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Chatbot Flow Management</h1>
                <p className="text-sm text-white/80 mt-0.5">{company?.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={handleCreateFlow}
                className="bg-white text-purple-600 hover:bg-white/90"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create New Flow
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Active Flow Info */}
          {whatsappConfig && whatsappConfig._id && whatsappConfig.isActive && (
            <Card className="border-green-300 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl shadow-lg">
              <CardHeader className="bg-gradient-to-r from-green-100 to-emerald-100 border-b">
                <CardTitle className="text-green-700 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Active WhatsApp Configuration
                </CardTitle>
                <CardDescription className="text-green-600">
                  <span className="font-semibold">Phone Number:</span> {whatsappConfig.displayPhoneNumber || whatsappConfig.phoneNumber}
                  {activeFlow && (
                    <span className="ml-3">• <span className="font-semibold">Active Flow:</span> <strong>{activeFlow.flowName || activeFlow.name}</strong> (v{activeFlow.version || 1})</span>
                  )}
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {(!whatsappConfig || !whatsappConfig._id || !whatsappConfig.isActive) && (
            <Card className="border-yellow-200 bg-yellow-50/50 rounded-2xl shadow-lg">
              <CardHeader>
                <CardTitle className="text-yellow-700 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  ⚠️ WhatsApp Not Configured
                </CardTitle>
                <CardDescription>
                  Please configure WhatsApp settings before creating chatbot flows.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => router.push(`/superadmin/company/${companyId}/whatsapp-config`)}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white rounded-xl"
                >
                  Configure WhatsApp Now
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Default Flows Notice */}
          {!hasDefaultFlows && (
            <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl shadow-lg">
              <CardHeader className="bg-gradient-to-r from-blue-100 to-indigo-100 border-b">
                <CardTitle className="text-blue-700 flex items-center gap-2">
                  <Workflow className="w-5 h-5" />
                  Default Flows Available
                </CardTitle>
                <CardDescription className="text-blue-600">
                  Generate default flows (Grievance, Appointment, Tracking) that you can customize. These flows provide a starting point for your chatbot.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <Button
                  onClick={handleGenerateDefaultFlows}
                  disabled={checkingDefaults}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                >
                  {checkingDefaults ? (
                    <>
                      <LoadingSpinner className="w-4 h-4 mr-2" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Generate Default Flows
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Flows List with Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-6">
            <TabsList className="inline-flex h-12 items-center justify-center rounded-2xl bg-white/80 backdrop-blur-sm p-1.5 shadow-lg border border-slate-200/50 gap-1">
              <TabsTrigger 
                value="your-flows" 
                className="px-6 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
              >
                Your Flows ({flows.filter(f => !f.isTemplate).length})
              </TabsTrigger>
              <TabsTrigger 
                value="templates" 
                className="px-6 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
              >
                Templates ({flows.filter(f => f.isTemplate).length})
              </TabsTrigger>
            </TabsList>

            {/* Your Flows Tab */}
            <TabsContent value="your-flows">
              <div className="grid grid-cols-1 gap-6">
                {flows.filter(f => !f.isTemplate).length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Workflow className="w-16 h-16 text-gray-300 mb-4" />
                      <h3 className="text-xl font-semibold text-gray-700 mb-2">No Chatbot Flows</h3>
                      <p className="text-gray-500 mb-6">
                        {hasDefaultFlows 
                          ? 'Create a custom chatbot flow or customize the default flows below'
                          : 'Generate default flows or create your first custom chatbot flow to get started'
                        }
                      </p>
                      <div className="flex gap-3">
                        {!hasDefaultFlows && (
                          <Button 
                            onClick={handleGenerateDefaultFlows} 
                            disabled={checkingDefaults}
                            variant="outline"
                            className="border-blue-600 text-blue-600 hover:bg-blue-50"
                          >
                            {checkingDefaults ? (
                              <>
                                <LoadingSpinner className="w-4 h-4 mr-2" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <Workflow className="w-4 h-4 mr-2" />
                                Generate Default Flows
                              </>
                            )}
                          </Button>
                        )}
                        <Button onClick={handleCreateFlow} className="bg-purple-600 hover:bg-purple-700">
                          <Plus className="w-4 h-4 mr-2" />
                          Create Custom Flow
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  flows.filter(f => !f.isTemplate).map((flow) => {
                    const isDefaultFlow = ['grievance', 'appointment', 'tracking'].includes(flow.flowType);
                    return (
                    <Card key={flow._id} className={`rounded-2xl border-0 shadow-xl overflow-hidden bg-white/80 backdrop-blur-sm transition-all hover:shadow-2xl ${flow.isActive ? 'border-green-300 border-2' : ''} ${isDefaultFlow ? 'border-l-4 border-l-orange-400' : ''}`}>
                      <CardHeader className={`${flow.isActive ? 'bg-gradient-to-r from-green-50 to-emerald-50' : 'bg-gradient-to-r from-purple-50 to-indigo-50'} border-b px-6 py-5`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <CardTitle className="text-xl font-bold text-slate-800">{flow.flowName || flow.name || 'Unnamed Flow'}</CardTitle>
                              {isDefaultFlow && (
                                <span className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full border border-orange-200">
                                  📋 DEFAULT
                                </span>
                              )}
                              {flow.isActive && (
                                <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full border border-green-200">
                                  ✓ ACTIVE
                                </span>
                              )}
                              <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-bold rounded-full">
                                v{flow.version || 1}
                              </span>
                              {flow.flowType && (
                                <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                                  isDefaultFlow 
                                    ? 'bg-orange-100 text-orange-700' 
                                    : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {flow.flowType.toUpperCase()}
                                </span>
                              )}
                            </div>
                            <CardDescription className="text-slate-600 mt-1">{flow.flowDescription || flow.description || 'No description'}</CardDescription>
                            <div className="mt-3 text-sm text-slate-600 flex flex-wrap gap-3">
                              <span className="flex items-center gap-1">
                                <Workflow className="w-4 h-4" />
                                <span className="font-medium">{flow.steps?.length || 0}</span> steps
                              </span>
                              <span>•</span>
                              <span>Type: <strong>{flow.flowType || 'custom'}</strong></span>
                              <span>•</span>
                              <span>Created: {flow.createdAt ? new Date(flow.createdAt).toLocaleDateString() : 'N/A'}</span>
                              {flow.updatedAt && (
                                <>
                                  <span>•</span>
                                  <span>Updated: {new Date(flow.updatedAt).toLocaleDateString()}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4 flex-wrap">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewFlow(flow._id)}
                              title="View Flow"
                              className="rounded-xl border-blue-200 hover:bg-blue-50 hover:border-blue-300"
                            >
                              <Eye className="w-4 h-4 text-blue-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditFlow(flow._id)}
                              title="Edit Flow"
                              className="rounded-xl border-purple-200 hover:bg-purple-50 hover:border-purple-300"
                            >
                              <Edit className="w-4 h-4 text-purple-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDuplicateFlow(flow._id)}
                              title="Duplicate Flow"
                              className="rounded-xl border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300"
                            >
                              <Copy className="w-4 h-4 text-indigo-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant={flow.isActive ? 'default' : 'outline'}
                              onClick={() => handleToggleActiveFlow(flow._id, flow.isActive)}
                              title={flow.isActive ? 'Deactivate' : 'Activate'}
                              className={`rounded-xl ${flow.isActive ? 'bg-green-600 hover:bg-green-700 text-white' : 'border-gray-200 hover:bg-gray-50'}`}
                            >
                              {flow.isActive ? (
                                <PauseCircle className="w-4 h-4" />
                              ) : (
                                <PlayCircle className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteFlow(flow._id)}
                              title="Delete Flow"
                              className="rounded-xl bg-red-600 hover:bg-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="px-6 py-4 bg-white">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                          <div className="text-sm text-slate-600">
                            <span className="font-semibold text-slate-700">Triggers:</span>{' '}
                            {flow.triggers && flow.triggers.length > 0
                              ? flow.triggers.map((t: any, idx: number) => (
                                  <span key={idx} className="inline-block px-2 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium mr-1">
                                    {t.triggerType}: &quot;{t.triggerValue}&quot;
                                  </span>
                                ))
                              : flow.trigger?.type || 'message'
                            }
                            {flow.trigger?.value && !flow.triggers && (
                              <span className="inline-block px-2 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium ml-1">
                                → &quot;{flow.trigger.value}&quot;
                              </span>
                            )}
                            {flow.triggers && flow.triggers.length > 0 && (
                              <span className="ml-2 text-xs text-slate-500">
                                ({flow.triggers.length} trigger{flow.triggers.length > 1 ? 's' : ''})
                              </span>
                            )}
                          </div>
                          {whatsappConfig && whatsappConfig._id && whatsappConfig.isActive && (() => {
                            // Check if this flow is assigned - handle multiple ID formats
                            const flowId = flow._id || (flow as any).id || flow.flowId;
                            const flowIdString = flowId?.toString();
                            
                            // Check activeFlows array - handle both ObjectId, populated object, and string formats
                            const isAssigned = whatsappConfig.activeFlows?.some((af: any) => {
                              if (!af || !af.flowId) return false;
                              
                              // Handle different formats:
                              // 1. flowId is an ObjectId (has toString method)
                              // 2. flowId is a populated object (has _id property)
                              // 3. flowId is a string
                              let activeFlowId: string;
                              if (af.flowId?._id) {
                                // Populated object - use _id
                                activeFlowId = af.flowId._id.toString();
                              } else if (af.flowId?.toString) {
                                // ObjectId
                                activeFlowId = af.flowId.toString();
                              } else {
                                // String or other
                                activeFlowId = String(af.flowId);
                              }
                              
                              const match = activeFlowId === flowIdString;
                              
                              // Debug logging for troubleshooting (only log first time or when match found)
                              if (match || (!(window as any).__flowCheckLogged && flowIdString)) {
                                console.log('🔍 Flow assignment check:', {
                                  flowId: flowIdString,
                                  activeFlowId,
                                  match,
                                  flowIdType: typeof flowId,
                                  activeFlowIdType: typeof af.flowId,
                                  activeFlowIdHas_id: !!af.flowId?._id,
                                  activeFlowIdHasToString: !!af.flowId?.toString,
                                  activeFlowRaw: af.flowId
                                });
                                if (match) {
                                  (window as any).__flowCheckLogged = true;
                                }
                              }
                              
                              return match;
                            }) || false;
                            
                            return (
                              <div className="flex items-center gap-2">
                                {isAssigned ? (
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      console.log('🔘 Unassign button clicked for flow:', {
                                        _id: flow._id,
                                        flowId: flow.flowId,
                                        id: (flow as any).id,
                                        flowIdString
                                      });
                                      handleUnassignFlow(flowId);
                                    }}
                                    className="bg-green-100 hover:bg-green-200 text-green-700 border border-green-300 rounded-xl font-semibold"
                                  >
                                    <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                                    Assigned
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      console.log('🔘 Assign button clicked for flow:', {
                                        _id: flow._id,
                                        flowId: flow.flowId,
                                        id: (flow as any).id,
                                        flowIdString,
                                        fullFlow: flow
                                      });
                                      handleAssignFlow(flowId);
                                    }}
                                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                                  >
                                    Assign to WhatsApp
                                  </Button>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </CardContent>
                    </Card>
                  );
                  })
                )}
              </div>
            </TabsContent>

            {/* Templates Tab */}
            <TabsContent value="templates">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {flows.filter(f => f.isTemplate).length === 0 ? (
                  <Card className="col-span-full">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Workflow className="w-16 h-16 text-gray-300 mb-4" />
                      <h3 className="text-xl font-semibold text-gray-700 mb-2">No Templates Yet</h3>
                      <p className="text-gray-500 mb-6">Create flows and mark them as templates to see them here</p>
                    </CardContent>
                  </Card>
                ) : (
                  flows.filter(f => f.isTemplate).map((template) => (
                    <Card key={template._id} className="rounded-2xl border-0 shadow-xl hover:shadow-2xl transition-all">
                      <CardHeader className="bg-gradient-to-br from-purple-50 to-indigo-50 border-b">
                        <div className="flex items-start justify-between">
                          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-3">
                            <Workflow className="w-6 h-6 text-purple-600" />
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteFlow(template._id)}
                            className="text-red-600 hover:bg-red-50 rounded-lg"
                            title="Delete Template"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <CardTitle className="text-lg font-bold text-gray-900">{template.name || template.flowName}</CardTitle>
                        <CardDescription className="text-sm text-gray-600">
                          {template.description || template.flowDescription || 'No description'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-sm text-gray-600">
                            <span>Nodes:</span>
                            <span className="font-semibold">{template.nodes?.length || 0}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm text-gray-600">
                            <span>Edges:</span>
                            <span className="font-semibold">{template.edges?.length || 0}</span>
                          </div>
                          <Button
                            onClick={() => handleDuplicateFlow(template._id)}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-xl mt-4"
                          >
                            Use Template
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>

        </div>
      </main>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
      />
    </div>
  );
}
