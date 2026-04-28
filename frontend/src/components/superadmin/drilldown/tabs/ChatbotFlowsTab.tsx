"use client";

import React, { useState, useEffect, useMemo } from "react";
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

  const [loading, setLoading] = useState(!cachedFlows);
  const [refreshing, setRefreshing] = useState(false);
  const [flows, setFlows] = useState<any[]>(cachedFlows || []);
  const [whatsappConfig, setWhatsappConfig] = useState<any>(cachedWhatsappConfig || null);
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

  // Sync with cache for instant loading
  useEffect(() => {
    if (cachedFlows) {
      setFlows(cachedFlows);
      setLoading(false);
    }
  }, [cachedFlows]);

  useEffect(() => {
    if (cachedWhatsappConfig !== undefined) {
      setWhatsappConfig(cachedWhatsappConfig);
    }
  }, [cachedWhatsappConfig]);

  useEffect(() => {
    // If we don't have cached flows, trigger a fetch
    if (!cachedFlows) {
      fetchData();
    } else {
      // Check defaults anyway in background
      checkDefaults();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  // Performance: Memoize filtered lists to avoid re-calculating on every render
  const operationalFlows = useMemo(() => flows.filter(f => !f.isTemplate), [flows]);
  const templateFlows = useMemo(() => flows.filter(f => f.isTemplate), [flows]);
  const checkDefaults = async () => {
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
  };

  const fetchData = async (silent = false) => {
    try {
      if (!silent && !cachedFlows) setLoading(true);
      const res = await chatbotFlowApi.getFlows(companyId as string);
      if (res.success) {
        setFlows(res.data);
      }
      
      if (silent) {
        setRefreshing(true);
      }
      
      // Check if default flows exist
      await checkDefaults();
    } catch (error: any) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
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

  const handleSimulateFlow = async (flow: any) => {
    if (!flow?._id) {
      toast.error("Unable to open simulator for this flow.");
      return;
    }

    try {
      setLoadingAction({ flowId: flow._id, action: "simulate" });

      let fullFlow = flow;
      const needsFullFetch =
        !Array.isArray(flow.nodes) ||
        !Array.isArray(flow.edges);

      if (needsFullFetch) {
        const res = await chatbotFlowApi.getFlowById(flow._id);
        if (!res?.success || !res?.data) {
          throw new Error(res?.message || "Failed to load flow design");
        }
        fullFlow = res.data;
      }

      if (!Array.isArray(fullFlow.nodes) || !Array.isArray(fullFlow.edges)) {
        toast.error(
          "This flow has no design nodes to simulate. Please open the builder to design the flow first.",
        );
        return;
      }

      setSimulatorState({
        isOpen: true,
        flow: fullFlow,
      });
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to open flow simulator",
      );
    } finally {
      setLoadingAction(null);
    }
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
    <div className="space-y-4 sm:space-y-6">
      {refreshing && (
        <div className="fixed inset-0 z-50 bg-white/40 backdrop-blur-[2px] flex items-center justify-center pointer-events-none">
          <Card className="shadow-xl px-6 py-4 flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
            <span className="text-sm font-semibold text-slate-700">Refining Data Node...</span>
          </Card>
        </div>
      )}

      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
         <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-tight truncate">Response Pipelines</h2>
            <p className="text-[9px] sm:text-[10px] text-slate-500 font-medium font-mono uppercase tracking-widest truncate">{company?.name || "Neural Node"}</p>
         </div>
         <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button onClick={() => fetchData(true)} variant="ghost" className="h-8 w-8 p-0 text-slate-400">
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
            <Button onClick={handleCreateFlow} className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 sm:px-4 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
                <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1 sm:mr-1.5" />
                Build Custom Pipeline
            </Button>
         </div>
      </div>

      {whatsappConfig && whatsappConfig._id && whatsappConfig.isActive ? (
        <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-slate-50/30">
           <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-[auto_1fr_auto_auto] items-center gap-4 sm:gap-8">
              <div className="flex items-center gap-3">
                 <div className="w-9 h-9 sm:w-10 sm:h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                    <MessageSquare className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-emerald-600" />
                 </div>
                 <div className="min-w-0">
                    <p className="text-[8px] sm:text-[9px] text-slate-400 font-black uppercase tracking-widest truncate">Active Endpoint</p>
                    <p className="text-xs font-bold text-slate-700 truncate">{whatsappConfig.displayPhoneNumber || whatsappConfig.phoneNumber}</p>
                 </div>
              </div>
              <div className="hidden sm:block w-px h-10 bg-slate-200" />
              <div className="flex items-center gap-3">
                 <div className="w-9 h-9 sm:w-10 sm:h-10 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
                    <Workflow className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-indigo-600" />
                 </div>
                 <div className="min-w-0">
                    <p className="text-[8px] sm:text-[9px] text-slate-400 font-black uppercase tracking-widest truncate">Active Logic Matrix</p>
                    <p className="text-xs font-bold text-slate-700 truncate">
                      {activeFlow ? (activeFlow.flowName || activeFlow.name) : <span className="text-slate-400 italic font-medium">None Selected</span>}
                      {activeFlow && <span className="ml-2 px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[8px] font-black uppercase tracking-tighter">v{activeFlow.version || 1}</span>}
                    </p>
                 </div>
              </div>
              {activeFlow && (
                <Button 
                  onClick={() => handleSimulateFlow(activeFlow)}
                  variant="outline" 
                  className="w-full sm:w-auto h-9 rounded-xl border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-bold text-[9px] sm:text-[10px] uppercase tracking-wider mt-2 sm:mt-0"
                >
                  <Eye className="w-3.5 h-3.5 mr-2" />
                  Simulate Matrix
                </Button>
              )}
           </CardContent>
        </Card>
      ) : (
        <Card className="rounded-xl border border-amber-200 bg-amber-50/50">
           <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 sm:w-12 sm:h-12 bg-amber-100 rounded-2xl flex items-center justify-center shrink-0">
                    <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
                 </div>
                 <div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-800">Infrastructure Mismatch</h4>
                    <p className="text-[10px] sm:text-xs text-slate-600 mt-0.5 sm:mt-1">Chatbot flows require an active WhatsApp configuration to deploy.</p>
                 </div>
              </div>
              <Button onClick={() => {}} className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 h-9 font-bold text-[10px] sm:text-xs uppercase tracking-wider">
                 Initialize WhatsApp
              </Button>
           </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="your-flows" className="flex-1 sm:flex-none px-4 sm:px-6 h-8 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm whitespace-nowrap">
              Operational Nodes ({operationalFlows.length})
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex-1 sm:flex-none px-4 sm:px-6 h-8 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm whitespace-nowrap">
              Templates ({templateFlows.length})
            </TabsTrigger>
          </TabsList>

          <div className="flex flex-wrap items-center gap-2">
           {selectedFlows.size > 0 && (
             <Button
                variant="destructive"
               size="sm"
               onClick={handleBulkDeleteFlows}
               disabled={isDeletingBulk}
               className="h-8 text-[9px] font-black uppercase tracking-widest bg-red-600 hover:bg-red-700 animate-in zoom-in duration-200"
             >
               <Trash2 className="w-3 h-3 mr-1.5" />
               Delete ({selectedFlows.size})
             </Button>
           )}
           {operationalFlows.length > 0 && (
             <Button
               variant="outline"
               size="sm"
               onClick={() => {
                  const filtered = operationalFlows.map(f => f._id);
                  if (selectedFlows.size === filtered.length) {
                    setSelectedFlows(new Set());
                  } else {
                    setSelectedFlows(new Set(filtered));
                  }
               }}
               className="h-8 text-[9px] font-black uppercase tracking-widest border-slate-200 hover:bg-slate-50"
              >
                {selectedFlows.size === operationalFlows.length ? "Deselect All" : "Select All Nodes"}
              </Button>
            )}
          </div>
        </div>

        <TabsContent value="your-flows" className="space-y-4 pt-2">
           {operationalFlows.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-16 sm:py-20 bg-white border border-slate-200 rounded-2xl border-dashed">
                <Workflow className="w-10 h-10 sm:w-12 sm:h-12 text-slate-200 mb-4" />
                <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest text-center">No Operational Pipelines Found</p>
                <Button onClick={handleCreateFlow} variant="ghost" className="mt-4 text-[9px] sm:text-[10px] font-black uppercase text-indigo-600 hover:bg-indigo-50">Start Architecture Design</Button>
             </div>
           ) : (
             <div className="grid grid-cols-1 gap-4">
                {operationalFlows.map((flow) => (
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
                         className="w-4.5 h-4.5 text-indigo-600 border-slate-300 rounded-lg focus:ring-indigo-500 cursor-pointer shadow-sm transition-transform hover:scale-110"
                       />
                     </div>

                     <CardHeader className="py-4 px-4 sm:px-6 pl-12 border-b border-slate-50">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                           <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                 <h3 className="text-[11px] sm:text-xs font-bold text-slate-800 uppercase tracking-tight truncate max-w-[150px] sm:max-w-none">{flow.flowName || flow.name}</h3>
                                 {flow.isActive && <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[8px] font-black uppercase tracking-widest border border-emerald-100">Deployed</span>}
                                 <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[8px] font-black uppercase tracking-widest border border-slate-200">v{flow.version || 1}</span>
                              </div>
                              <p className="text-[10px] sm:text-[11px] text-slate-500 line-clamp-1">{flow.flowDescription || flow.description || "Experimental pipeline node"}</p>
                              <div className="flex items-center gap-4 mt-3">
                                 <span className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest">Type: <span className="text-indigo-600 font-black">{flow.flowType || "Custom"}</span></span>
                                 <span className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest">Steps: <span className="text-slate-800 font-black">{flow.steps?.length || 0}</span></span>
                              </div>
                           </div>
                           <div className="flex items-center gap-1 sm:gap-2 self-end sm:self-auto sm:ml-4 bg-slate-50/50 sm:bg-transparent p-1 sm:p-0 rounded-lg">
                               <Button onClick={() => handleEditFlow(flow._id)} variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit className="w-3.5 h-3.5"/></Button>
                               <Button onClick={() => handleSimulateFlow(flow)} variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"><Eye className="w-3.5 h-3.5"/></Button>
                               <Button onClick={() => handleDuplicateFlow(flow._id)} variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Copy className="w-3.5 h-3.5"/></Button>
                               <Button onClick={() => handleDeleteFlow(flow._id)} disabled={isActionLoading(flow._id, 'delete')} variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">{isActionLoading(flow._id, 'delete') ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Trash2 className="w-3.5 h-3.5"/>}</Button>
                           </div>
                        </div>
                     </CardHeader>
                     <CardContent className="py-3 px-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/20">
                        <div className="text-[9px] sm:text-[10px] text-slate-500 font-medium overflow-x-auto no-scrollbar whitespace-nowrap pb-1 sm:pb-0">
                           <span className="font-bold text-slate-700 uppercase tracking-widest mr-2">Triggers:</span>
                           {flow.triggers?.map((t: any, i: number) => (
                             <span key={i} className="inline-block px-2 py-0.5 bg-white border border-slate-200 rounded text-[9px] sm:text-[10px] font-bold text-slate-600 mr-1.5">&quot;{t.triggerValue}&quot;</span>
                           )) || <span className="italic">N/A</span>}
                        </div>
                        {flow.isActive ? (
                           <div className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-widest w-full sm:w-auto">
                              <CheckCircle className="w-3.5 h-3.5" /> Deployed Matrix
                           </div>
                        ) : (
                           <Button onClick={() => handleSetActiveFlow(flow._id)} disabled={isActionLoading(flow._id, 'set-active')} className="bg-indigo-600 hover:bg-indigo-700 h-8.5 sm:h-8 px-4 rounded-lg font-black text-[9px] sm:text-[10px] uppercase tracking-widest shadow-md w-full sm:w-auto">
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

        <TabsContent value="templates" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 pt-2">
           {templateFlows.length === 0 ? (
             <div className="col-span-full py-16 sm:py-20 text-center bg-white rounded-2xl border border-slate-100 border-dashed">
                <Workflow className="w-10 h-10 sm:w-12 sm:h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest">Library is currently empty</p>
             </div>
           ) : (
             templateFlows.map(template => (
               <Card key={template._id} className="rounded-xl border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all flex flex-col">
                  <div className="h-1.5 sm:h-2 bg-gradient-to-r from-purple-500 to-indigo-600 shrink-0" />
                  <CardHeader className="py-4 px-4 sm:px-6">
                     <CardTitle className="text-[11px] sm:text-sm font-bold text-slate-800 uppercase tracking-tight truncate">{template.name || template.flowName}</CardTitle>
                     <p className="text-[9px] sm:text-[10px] text-slate-500 line-clamp-2 mt-1 min-h-[2.5rem]">{template.description || "Reusable blueprint for organizational workflows"}</p>
                  </CardHeader>
                  <CardContent className="pb-4 px-4 sm:px-6 space-y-4 mt-auto">
                     <div className="flex items-center gap-4 text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <span>Nodes: <span className="text-slate-700">{template.nodes?.length || 0}</span></span>
                        <span>Edges: <span className="text-slate-700">{template.edges?.length || 0}</span></span>
                     </div>
                     <Button onClick={() => handleDuplicateFlow(template._id)} className="w-full bg-slate-900 hover:bg-black text-white h-9 rounded-lg font-black text-[9px] sm:text-[10px] uppercase tracking-widest">
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
          companyId={companyId}
          onClose={() => setSimulatorState({ isOpen: false, flow: null })}
        />
      )}
    </div>
  );
}
