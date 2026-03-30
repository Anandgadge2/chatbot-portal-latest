"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyContext } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiClient } from "@/lib/api/client";
import { chatbotFlowApi } from '@/lib/api/chatbotFlow';
import { toast } from 'react-hot-toast';
import { useQueryCache } from "@/lib/query/cache";
import {
  Plus,
  Edit,
  Copy,
  Trash2,
  Workflow,
  Eye,
  MessageSquare,
  CheckCircle,
  Loader2,
  Zap,
  RefreshCw,
  Building,
  AlertCircle,
} from "lucide-react";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useFlows } from "@/lib/query/useFlows";
import { useWhatsappConfig } from "@/lib/query/useWhatsappConfig";
import FlowSimulator from "@/components/flow-builder/FlowSimulator";

export interface ChatbotFlowsTabProps {
  companyId: string;
}

export default function ChatbotFlowsTab({ companyId }: ChatbotFlowsTabProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { company } = useCompanyContext();
  const { invalidate } = useQueryCache();
  const { data: cachedFlows, isLoading: flowsLoading } = useFlows(companyId);
  const { data: cachedWhatsappConfig } = useWhatsappConfig(companyId);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [flows, setFlows] = useState<any[]>([]);
  const [whatsappConfig, setWhatsappConfig] = useState<any>(null);
  const [hasDefaultFlows, setHasDefaultFlows] = useState<boolean>(false);
  const [checkingDefaults, setCheckingDefaults] = useState(false);
  const [activeTab, setActiveTab] = useState<"your-flows" | "templates">(
    "your-flows",
  );
  
  // Per-button loading: stores { flowId, action } for the currently-loading button
  const [loadingAction, setLoadingAction] = useState<{
    flowId: string;
    action: string;
  } | null>(null);
  const [selectedFlows, setSelectedFlows] = useState<Set<string>>(new Set());
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  
  const [confirmDialog, setConfirmDialog] = useState<any>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const [simulatorState, setSimulatorState] = useState<{
    isOpen: boolean;
    flow: any;
  }>({
    isOpen: false,
    flow: null,
  });

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);



  useEffect(() => {
    if (cachedWhatsappConfig !== undefined) {
      setWhatsappConfig(cachedWhatsappConfig);
    }
  }, [cachedWhatsappConfig]);

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await chatbotFlowApi.getFlows(companyId as string);
      if (res.success) {
        setFlows(res.data);
      }
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      // Check if default flows exist
      try {
        const defaultsRes = await apiClient.get(
          `/chatbot-flows/company/${companyId}/has-defaults`,
        );
        if (defaultsRes?.success) {
          setHasDefaultFlows(defaultsRes.hasDefaults || false);
        } else if (
          defaultsRes &&
          typeof (defaultsRes as any).hasDefaults === "boolean"
        ) {
          setHasDefaultFlows((defaultsRes as any).hasDefaults);
        }
      } catch (defaultsError: any) {
        console.warn("⚠️ Failed to check default flows:", defaultsError);
      }
    } catch (error: any) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(flowsLoading);
      setRefreshing(false);
    }
  };

  const handleCreateFlow = () => {
    const isMasterContext = typeof window !== "undefined" && window.location.pathname === "/dashboard";
    router.push(`/dashboard/company/${companyId}/chatbot-flows/create${isMasterContext ? "?fromMaster=true" : ""}`);
  };

  const handleGenerateDefaultFlows = async () => {
    try {
      setCheckingDefaults(true);
      const res = await apiClient.post(
        `/chatbot-flows/company/${companyId}/generate-defaults`,
      );

      if (res.success) {
        toast.success(res.message || "Default flows generated successfully");
        setHasDefaultFlows(true);
        fetchData(true);
      } else {
        toast.error(res.message || "Failed to generate default flows");
      }
    } catch (error: any) {
      console.error("❌ Failed to generate default flows:", error);
      const errorMessage = error.response?.data?.message || error.message || "Failed to generate default flows";
      if (error.response?.status === 400 && errorMessage.includes("already exist")) {
        toast.success("Default flows already exist. Refreshing list...");
        setHasDefaultFlows(true);
        fetchData(true);
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setCheckingDefaults(false);
    }
  };

  const handleEditFlow = (flowId: string) => {
    const isMasterContext = typeof window !== "undefined" && window.location.pathname === "/dashboard";
    router.push(`/dashboard/company/${companyId}/chatbot-flows/${flowId}/edit${isMasterContext ? "?fromMaster=true" : ""}`);
  };

  const handleDuplicateFlow = async (flowId: string) => {
    try {
      setLoadingAction({ flowId, action: "duplicate" });
      const res = await apiClient.post(`/chatbot-flows/${flowId}/duplicate`);
      if (res.success) {
        toast.success(res.message || "Flow duplicated successfully");
        if (res.data) {
          setFlows((prev) => [...prev, res.data]);
        }
        fetchData(true);
      } else {
        toast.error(res.message || "Failed to duplicate flow");
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to duplicate flow");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSetActiveFlow = async (flowId: string) => {
    try {
      setLoadingAction({ flowId, action: "set-active" });
      const res = await apiClient.post(`/chatbot-flows/${flowId}/set-active-flow`);
      if (res?.success) {
        toast.success(res.message || "Flow activated successfully");
        setFlows((prev) =>
          prev.map((f) => ({ ...f, isActive: f._id === flowId })),
        );
        fetchData(true);
      } else {
        toast.error(res?.message || "Failed to set active flow");
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || "Failed to set active flow");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDeleteFlow = async (flowId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Flow",
      message:
        "Are you sure you want to delete this chatbot flow? This action cannot be undone.",
      variant: "danger",
      onConfirm: async () => {
        try {
          setLoadingAction({ flowId, action: "delete" });
          const res = await apiClient.delete(`/chatbot-flows/${flowId}`);
          if (res?.success === true) {
            toast.success(res.message || "Flow deleted successfully");
            // Update local state immediately for instant feedback
            setFlows((prev) => prev.filter((f) => f._id !== flowId));
            invalidate(`["flows","${companyId}"]`);
            fetchData(true);
          } else {
            toast.error(res?.message || "Failed to delete flow");
          }
        } catch (error: any) {
          toast.error(
            error.response?.data?.message ||
              error.message ||
              "Failed to delete flow",
          );
        } finally {
          setLoadingAction(null);
          setConfirmDialog((prev: any) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleBulkDeleteFlows = async () => {
    if (selectedFlows.size === 0) return;

    setConfirmDialog({
      isOpen: true,
      title: "Delete Selected Flows",
      message: `Are you sure you want to delete ${selectedFlows.size} chatbot flow(s)? This action cannot be undone.`,
      variant: "danger",
      onConfirm: async () => {
        setIsDeletingBulk(true);
        try {
          const response = await chatbotFlowApi.deleteBulk(
            Array.from(selectedFlows),
          );
          if (response.success) {
            toast.success(response.message);
            const deletedIds = Array.from(selectedFlows);
            setFlows((prev) => prev.filter((f) => !deletedIds.includes(f._id)));
            setSelectedFlows(new Set());
            invalidate(`["flows","${companyId}"]`);
            fetchData(true);
          } else {
            toast.error("Failed to delete flows");
          }
        } catch (error: any) {
          toast.error(
            error?.response?.data?.message ||
              error?.message ||
              "Failed to delete flows",
          );
        } finally {
          setIsDeletingBulk(false);
          setConfirmDialog((prev: any) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleSimulateFlow = (flow: any) => {
    if (!flow || !flow.nodes || !flow.edges) {
      toast.error("This flow has no architecture nodes to simulate.");
      return;
    }
    setSimulatorState({
      isOpen: true,
      flow: flow,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <LoadingSpinner text="Retrieving response pipelines..." />
      </div>
    );
  }

  const activeFlow = flows.find((f) => f.isActive);
  const isActionLoading = (flowId: string, action: string) => loadingAction?.flowId === flowId && loadingAction?.action === action;

  return (
    <div className="space-y-6">
      {refreshing && (
        <div className="fixed inset-0 z-50 bg-white/40 backdrop-blur-[2px] flex items-center justify-center pointer-events-none">
          <Card className="shadow-xl px-6 py-4 flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
            <span className="text-sm font-semibold text-slate-700">Refining Data Node...</span>
          </Card>
        </div>
      )}

      {/* Header Actions */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
         <div>
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Response Pipelines</h2>
            <p className="text-[10px] text-slate-500 font-medium font-mono uppercase tracking-widest">{company?.name || "Neural Node"}</p>
         </div>
         <div className="flex items-center gap-2">
            <Button onClick={() => fetchData(true)} variant="ghost" className="h-8 w-8 p-0 text-slate-400">
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
            <Button onClick={handleCreateFlow} className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 text-[10px] font-bold uppercase tracking-wider">
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Build Custom Pipeline
            </Button>
         </div>
      </div>

      {whatsappConfig && whatsappConfig._id && whatsappConfig.isActive ? (
        <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-slate-50/30">
           <CardContent className="p-4 flex flex-wrap items-center gap-8">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-emerald-600" />
                 </div>
                 <div>
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Active Endpoint</p>
                    <p className="text-xs font-bold text-slate-700">{whatsappConfig.displayPhoneNumber || whatsappConfig.phoneNumber}</p>
                 </div>
              </div>
              <div className="w-px h-10 bg-slate-200" />
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                    <Workflow className="w-5 h-5 text-indigo-600" />
                 </div>
                 <div>
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Active Logic Matrix</p>
                    <p className="text-xs font-bold text-slate-700">
                      {activeFlow ? (activeFlow.flowName || activeFlow.name) : <span className="text-slate-400 italic font-medium">None Selected</span>}
                      {activeFlow && <span className="ml-2 px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[9px] font-black uppercase tracking-tighter">v{activeFlow.version || 1}</span>}
                    </p>
                 </div>
              </div>
              <div className="flex-1" />
              {activeFlow && (
                <Button 
                  onClick={() => handleSimulateFlow(activeFlow)}
                  variant="outline" 
                  className="h-9 rounded-xl border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-bold text-[10px] uppercase tracking-wider"
                >
                  <Eye className="w-3.5 h-3.5 mr-2" />
                  Simulate Matrix
                </Button>
              )}
           </CardContent>
        </Card>
      ) : (
        <Card className="rounded-xl border border-amber-200 bg-amber-50/50">
           <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-amber-600" />
                 </div>
                 <div>
                    <h4 className="text-sm font-bold text-slate-800">Infrastructure Mismatch</h4>
                    <p className="text-xs text-slate-600 mt-1">Chatbot flows require an active WhatsApp configuration to deploy.</p>
                 </div>
              </div>
              <Button onClick={() => {}} className="bg-amber-600 hover:bg-amber-700 h-9 font-bold text-xs uppercase tracking-wider">
                 Initialize WhatsApp
              </Button>
           </CardContent>
        </Card>
      )}



      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
        <TabsList className="bg-slate-100 p-1 rounded-xl h-10 border border-slate-200">
           <TabsTrigger value="your-flows" className="px-6 h-8 rounded-lg text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm">
             Operational Nodes ({flows.filter(f => !f.isTemplate).length})
           </TabsTrigger>
           <TabsTrigger value="templates" className="px-6 h-8 rounded-lg text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm">
             Library Targets ({flows.filter(f => f.isTemplate).length})
           </TabsTrigger>
        </TabsList>

        <div className="flex items-center gap-2">
           {selectedFlows.size > 0 && (
             <Button
               variant="destructive"
               size="sm"
               onClick={handleBulkDeleteFlows}
               disabled={isDeletingBulk}
               className="h-8 text-[9px] font-black uppercase tracking-widest bg-red-600 hover:bg-red-700 animate-in zoom-in duration-200"
             >
               <Trash2 className="w-3 h-3 mr-1.5" />
               Delete Selected ({selectedFlows.size})
             </Button>
           )}
           {flows.filter(f => !f.isTemplate).length > 0 && (
             <Button
               variant="outline"
               size="sm"
               onClick={() => {
                  const filtered = flows.filter(f => !f.isTemplate).map(f => f._id);
                  if (selectedFlows.size === filtered.length) {
                    setSelectedFlows(new Set());
                  } else {
                    setSelectedFlows(new Set(filtered));
                  }
               }}
               className="h-8 text-[9px] font-black uppercase tracking-widest border-slate-200 hover:bg-slate-50"
             >
               {selectedFlows.size === flows.filter(f => !f.isTemplate).length ? "Deselect All" : "Select All Nodes"}
             </Button>
           )}
         </div>

        <TabsContent value="your-flows" className="space-y-4 pt-2">
           {flows.filter(f => !f.isTemplate).length === 0 ? (
             <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-2xl border-dashed">
                <Workflow className="w-12 h-12 text-slate-200 mb-4" />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No Operational Pipelines Found</p>
                <Button onClick={handleCreateFlow} variant="ghost" className="mt-4 text-[10px] font-black uppercase text-indigo-600 hover:bg-indigo-50">Start Architecture Design</Button>
             </div>
           ) : (
             <div className="grid grid-cols-1 gap-4">
                {flows.filter(f => !f.isTemplate).map((flow) => (
                  <Card key={flow._id} className={`rounded-xl border transition-all hover:shadow-md relative group/card ${flow.isActive ? "border-indigo-200 bg-white shadow-indigo-50" : "border-slate-100 bg-white shadow-sm"}`}>
                     {/* Batch Selection Overlay */}
                     <div className="absolute top-4 left-4 z-10">
                       <input
                         type="checkbox"
                         checked={selectedFlows.has(flow._id)}
                         onChange={() => {
                           const next = new Set(selectedFlows);
                           if (next.has(flow._id)) next.delete(flow._id);
                           else next.add(flow._id);
                           setSelectedFlows(next);
                         }}
                         className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer shadow-sm transition-transform hover:scale-110"
                       />
                     </div>

                     <CardHeader className="py-4 px-6 pl-12 border-b border-slate-50">
                        <div className="flex items-start justify-between">
                           <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                 <h3 className="text-xs font-bold text-slate-800 uppercase tracking-tight truncate">{flow.flowName || flow.name}</h3>
                                 {flow.isActive && <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[8px] font-black uppercase tracking-widest border border-emerald-100">Deployed</span>}
                                 <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[8px] font-black uppercase tracking-widest border border-slate-200">v{flow.version || 1}</span>
                              </div>
                              <p className="text-[11px] text-slate-500 line-clamp-1">{flow.flowDescription || flow.description || "Experimental pipeline node"}</p>
                              <div className="flex items-center gap-4 mt-3">
                                 <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Type: <span className="text-indigo-600 font-black">{flow.flowType || "Custom"}</span></span>
                                 <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Steps: <span className="text-slate-800 font-black">{flow.steps?.length || 0} Nodes</span></span>
                              </div>
                           </div>
                           <div className="flex items-center gap-2 ml-4">
                               <Button onClick={() => handleEditFlow(flow._id)} variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Edit Logic"><Edit className="w-3.5 h-3.5"/></Button>
                               <Button onClick={() => handleSimulateFlow(flow)} variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg" title="Simulate Node"><Eye className="w-3.5 h-3.5"/></Button>
                               <Button onClick={() => handleDuplicateFlow(flow._id)} variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Duplicate"><Copy className="w-3.5 h-3.5"/></Button>
                               <Button onClick={() => handleDeleteFlow(flow._id)} disabled={isActionLoading(flow._id, 'delete')} variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete">{isActionLoading(flow._id, 'delete') ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Trash2 className="w-3.5 h-3.5"/>}</Button>
                           </div>
                        </div>
                     </CardHeader>
                     <CardContent className="py-3 px-6 flex items-center justify-between bg-slate-50/20">
                        <div className="text-[10px] text-slate-500 font-medium">
                           <span className="font-bold text-slate-700 uppercase tracking-widest mr-2">Triggers:</span>
                           {flow.triggers?.map((t: any, i: number) => (
                             <span key={i} className="inline-block px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-600 mr-1.5">&quot;{t.triggerValue}&quot;</span>
                           )) || <span className="italic">N/A</span>}
                        </div>
                        {flow.isActive ? (
                           <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-black uppercase tracking-widest">
                              <CheckCircle className="w-3.5 h-3.5" /> Deployed Matrix
                           </div>
                        ) : (
                          <Button onClick={() => handleSetActiveFlow(flow._id)} disabled={isActionLoading(flow._id, 'set-active')} className="bg-indigo-600 hover:bg-indigo-700 h-8 px-4 rounded-lg font-black text-[10px] uppercase tracking-widest shadow-md">
                             {isActionLoading(flow._id, 'set-active') ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5"/> : <Zap className="w-3.5 h-3.5 mr-1.5"/>}
                             Activate Node
                          </Button>
                        )}
                     </CardContent>
                  </Card>
                ))}
             </div>
           )}
        </TabsContent>

        <TabsContent value="templates" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
           {flows.filter(f => f.isTemplate).length === 0 ? (
             <div className="col-span-full py-20 text-center bg-white rounded-2xl border border-slate-100 border-dashed">
                <Workflow className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Library is currently empty</p>
             </div>
           ) : (
             flows.filter(f => f.isTemplate).map(template => (
               <Card key={template._id} className="rounded-xl border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all">
                  <div className="h-2 bg-gradient-to-r from-purple-500 to-indigo-600" />
                  <CardHeader className="py-4">
                     <CardTitle className="text-sm font-bold text-slate-800 uppercase tracking-tight">{template.name || template.flowName}</CardTitle>
                     <p className="text-[10px] text-slate-500 line-clamp-2 mt-1">{template.description || "Reusable blueprint for organizational workflows"}</p>
                  </CardHeader>
                  <CardContent className="pb-4 space-y-4">
                     <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <span>Nodes: <span className="text-slate-700">{template.nodes?.length || 0}</span></span>
                        <span>Edges: <span className="text-slate-700">{template.edges?.length || 0}</span></span>
                     </div>
                     <Button onClick={() => handleDuplicateFlow(template._id)} className="w-full bg-slate-900 hover:bg-black text-white h-9 rounded-lg font-black text-[10px] uppercase tracking-widest">
                        Instantiate Template
                     </Button>
                  </CardContent>
               </Card>
             ))
           )}
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
      />

      {simulatorState.isOpen && (
        <FlowSimulator
          nodes={simulatorState.flow.nodes || []}
          edges={simulatorState.flow.edges || []}
          flowName={simulatorState.flow.flowName || simulatorState.flow.name || "Flow Simulation"}
          onClose={() => setSimulatorState({ isOpen: false, flow: null })}
        />
      )}
    </div>
  );
}
