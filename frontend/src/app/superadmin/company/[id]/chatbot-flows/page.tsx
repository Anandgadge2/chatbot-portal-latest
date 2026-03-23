"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { isSuperAdmin } from "@/lib/permissions";
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
import toast from "react-hot-toast";
import {
  ArrowLeft,
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
} from "lucide-react";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useFlows } from "@/lib/query/useFlows";
import { useWhatsappConfig } from "@/lib/query/useWhatsappConfig";

export default function ChatbotFlowsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const companyId = params.id as string;
  const { company } = useCompanyContext();
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
  const [confirmDialog, setConfirmDialog] = useState<any>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  useEffect(() => {
    if (!isSuperAdmin(user)) {
      router.push("/superadmin/dashboard");
      return;
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when companyId/role change only
  }, [companyId, user]);

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

  const fetchData = async (silent = false) => {
    try {
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
      toast.error("Failed to load page data");
    } finally {
      setLoading(flowsLoading);
      setRefreshing(false);
    }
  };

  const handleCreateFlow = () => {
    router.push(`/superadmin/company/${companyId}/chatbot-flows/create`);
  };

  const handleGenerateDefaultFlows = async () => {
    try {
      setCheckingDefaults(true);
      const res = await apiClient.post(
        `/chatbot-flows/company/${companyId}/generate-defaults`,
      );

      if (res.success) {
        if (res.alreadyExists) {
          toast.success(
            res.message ||
              "Default flows already exist and are available in the list below",
            { duration: 1500 },
          );
        } else {
          toast.success(
            res.message ||
              `Generated ${res.data?.length || 0} default flow(s) successfully`,
            { duration: 1500 },
          );
        }
        setHasDefaultFlows(true);
        fetchData(true); // Silent refresh
      } else {
        toast.error(res.message || "Failed to generate default flows");
      }
    } catch (error: any) {
      console.error("❌ Failed to generate default flows:", error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to generate default flows";

      // If it's a 400 error saying flows exist, treat it as success and refresh
      if (
        error.response?.status === 400 &&
        errorMessage.includes("already exist")
      ) {
        toast.success("Default flows already exist. Refreshing list...", {
          duration: 1500,
        });
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
    router.push(
      `/superadmin/company/${companyId}/chatbot-flows/${flowId}/edit`,
    );
  };

  const handleViewFlow = (flowId: string) => {
    router.push(
      `/superadmin/company/${companyId}/chatbot-flows/${flowId}/edit`,
    );
  };

  const handleDuplicateFlow = async (flowId: string) => {
    try {
      setLoadingAction({ flowId, action: "duplicate" });
      const res = await apiClient.post(`/chatbot-flows/${flowId}/duplicate`);
      if (res.success) {
        toast.success(res.message || "Flow duplicated successfully", {
          duration: 1500,
        });
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

  /** One-click: activate flow + deactivate others + sync WhatsApp activeFlows */
  const handleSetActiveFlow = async (flowId: string) => {
    try {
      setLoadingAction({ flowId, action: "set-active" });
      const res = await apiClient.post(
        `/chatbot-flows/${flowId}/set-active-flow`,
      );
      if (res?.success) {
        toast.success(
          res.message || "Flow activated and assigned successfully",
          {
            duration: 2000,
          },
        );
        fetchData(true);
      } else {
        toast.error(res?.message || "Failed to set active flow");
      }
    } catch (error: any) {
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Failed to set active flow",
      );
    } finally {
      setLoadingAction(null);
    }
  };
  const handleDeleteFlow = async (flowId: string) => {
    if (!flowId) {
      toast.error("Invalid flow ID");
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: "Delete Flow",
      message:
        "Are you sure you want to delete this chatbot flow? This action cannot be undone.",
      variant: "danger",
      onConfirm: async () => {
        try {
          setLoadingAction({ flowId, action: "delete" });
          console.log("🗑️ Deleting flow:", flowId);

          const res = await apiClient.delete(`/chatbot-flows/${flowId}`);
          console.log("📥 Delete response:", res);

          if (res?.success === true) {
            toast.success(res.message || "Flow deleted successfully", {
              duration: 1500,
            });
            fetchData(true);
          } else if (res?.data?.success) {
            toast.success("Flow deleted successfully", { duration: 1500 });
            fetchData(true);
          } else {
            toast.error(res?.message || "Failed to delete flow");
          }
        } catch (error: any) {
          console.error("❌ Failed to delete flow:", error);
          if (error.response?.status === 404) {
            toast.error("Flow not found. It may have already been deleted.");
          } else if (error.response?.status === 400) {
            toast.error(error.response?.data?.message || "Invalid flow ID");
          } else {
            toast.error(
              error.response?.data?.message ||
                error.message ||
                "Failed to delete flow",
            );
          }
        } finally {
          setLoadingAction(null);
          setConfirmDialog((prev: any) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  const activeFlow = flows.find((f) => f.isActive);

  const isActionLoading = (flowId: string, action: string) =>
    loadingAction?.flowId === flowId && loadingAction?.action === action;

  return (
    <div className="min-h-screen bg-slate-50/50 relative">
      {/* Refresh overlay: shows only when silently reloading data */}
      {refreshing && (
        <div className="fixed inset-0 z-50 bg-white/40 backdrop-blur-[2px] flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-2xl shadow-xl px-6 py-4 flex items-center gap-3 border border-slate-200">
            <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
            <span className="text-sm font-semibold text-slate-700">
              Updating...
            </span>
          </div>
        </div>
      )}
      {/* Header with Dark Slate Theme */}
      <header className="bg-slate-900 sticky top-0 z-50 shadow-2xl border-b border-slate-800">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVHJhbnNmb3JtPSJyb3RhdGUoNDUpIj48cGF0aCBkPSJNLTEwIDMwaDYwdjJoLTYweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNhKSIvPjwvc3ZnPg==')] opacity-10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <Button
                variant="ghost"
                onClick={() => router.push(`/superadmin/company/${companyId}`)}
                className="text-slate-400 hover:text-white hover:bg-white/10 transition-all -ml-2 h-9 w-9 p-0 rounded-xl"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/20 shadow-inner">
                <Workflow className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-none">
                  Response Pipelines
                </h1>
                <div className="flex items-center gap-2 mt-1.5 min-w-0">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate">
                    Intelligence Node:{" "}
                    <span className="text-indigo-400">{company?.name}</span>
                  </p>
                </div>
              </div>
            </div>
            <div className="flex w-full md:w-auto items-center justify-end gap-2">
              <Button
                onClick={handleCreateFlow}
                className="h-9 sm:h-10 px-4 sm:px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all shadow-lg shadow-indigo-900/20 font-bold text-[11px] uppercase tracking-wider border-0"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Flow
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto w-full px-4 py-4">
        <div className="space-y-6">
          {/* Active Flow Info */}
          {whatsappConfig && whatsappConfig._id && whatsappConfig.isActive && (
            <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
              <CardHeader className="bg-slate-900 px-6 py-4 border-b border-slate-800">
                <CardTitle className="text-base font-bold text-white uppercase tracking-tight flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-green-400" />
                  Active Operational Matrix
                </CardTitle>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                  Live WhatsApp Deployment Status
                </p>
              </CardHeader>
              <CardContent className="p-6 bg-slate-50/50">
                <div className="flex flex-wrap items-center gap-6">
                  <div>
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">
                      Phone Endpoint
                    </p>
                    <p className="text-sm font-bold text-slate-700 mt-1">
                      {whatsappConfig.displayPhoneNumber ||
                        whatsappConfig.phoneNumber}
                    </p>
                  </div>
                  {activeFlow && (
                    <div className="pl-6 border-l border-slate-200">
                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">
                        Active Logic Node
                      </p>
                      <p className="text-sm font-bold text-slate-700 mt-1">
                        {activeFlow.flowName || activeFlow.name}{" "}
                        <span className="text-slate-400 font-medium ml-1">
                          (v{activeFlow.version || 1})
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {(!whatsappConfig ||
            !whatsappConfig._id ||
            !whatsappConfig.isActive) && (
            <Card className="rounded-xl border border-amber-200 shadow-sm overflow-hidden bg-white">
              <CardHeader className="bg-slate-900 px-6 py-4 border-b border-slate-800">
                <CardTitle className="text-base font-bold text-white uppercase tracking-tight flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-amber-400" />
                  Incomplete Infrastructure
                </CardTitle>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                  WhatsApp Configuration Required
                </p>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() =>
                    router.push(
                      `/superadmin/company/${companyId}/whatsapp-config`,
                    )
                  }
                  className="bg-yellow-600 hover:bg-yellow-700 text-white rounded-xl"
                >
                  Configure WhatsApp Now
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Default Flows Notice */}
          {!hasDefaultFlows && (
            <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
              <CardHeader className="bg-slate-900 px-6 py-4 border-b border-slate-800">
                <CardTitle className="text-base font-bold text-white uppercase tracking-tight flex items-center gap-2">
                  <Workflow className="w-4 h-4 text-indigo-400" />
                  Standard Pipeline Templates Available
                </CardTitle>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                  Initialize core organization workflows
                </p>
              </CardHeader>
              <CardContent className="pt-4">
                <Button
                  onClick={handleGenerateDefaultFlows}
                  disabled={checkingDefaults}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg h-9 text-[11px] font-bold uppercase tracking-wider px-6 border-0 shadow-lg shadow-indigo-900/20"
                >
                  {checkingDefaults ? (
                    <>
                      <LoadingSpinner className="w-3 h-3 mr-2" />
                      Provisioning...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Initialize Core Flows
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Flows List with Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as any)}
            className="space-y-6"
          >
            <TabsList className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-100 p-1 border border-slate-200 gap-1">
              <TabsTrigger
                value="your-flows"
                className="px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm data-[state=inactive]:text-slate-500 data-[state=inactive]:hover:text-slate-800"
              >
                Operational Pipelines (
                {flows.filter((f) => !f.isTemplate).length})
              </TabsTrigger>
              <TabsTrigger
                value="templates"
                className="px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm data-[state=inactive]:text-slate-500 data-[state=inactive]:hover:text-slate-800"
              >
                Workflow Library ({flows.filter((f) => f.isTemplate).length})
              </TabsTrigger>
            </TabsList>

            {/* Your Flows Tab */}
            <TabsContent value="your-flows">
              <div className="grid grid-cols-1 gap-6">
                {flows.filter((f) => !f.isTemplate).length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Workflow className="w-16 h-16 text-gray-300 mb-4" />
                      <h3 className="text-xl font-semibold text-gray-700 mb-2">
                        No Chatbot Flows
                      </h3>
                      <p className="text-gray-500 mb-6">
                        {hasDefaultFlows
                          ? "Create a custom chatbot flow or customize the default flows below"
                          : "Generate default flows or create your first custom chatbot flow to get started"}
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
                        <Button
                          onClick={handleCreateFlow}
                          className="bg-purple-600 hover:bg-purple-700"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create Custom Flow
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  flows
                    .filter((f) => !f.isTemplate)
                    .map((flow) => {
                      const isDefaultFlow = [
                        "grievance",
                        "appointment",
                        "tracking",
                      ].includes(flow.flowType);
                      return (
                        <Card
                          key={flow._id}
                          className={`rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white transition-all hover:shadow-md ${flow.isActive ? "ring-1 ring-green-500 shadow-green-100" : ""}`}
                        >
                          <CardHeader className="bg-slate-50 border-b border-slate-100 px-6 py-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                  <CardTitle className="text-sm font-bold text-slate-800 uppercase tracking-tight">
                                    {flow.flowName ||
                                      flow.name ||
                                      "Unnamed Flow"}
                                  </CardTitle>
                                  {isDefaultFlow && (
                                    <span className="px-2 py-0.5 bg-orange-50 text-orange-600 text-[8px] font-black uppercase tracking-widest rounded border border-orange-100">
                                      Standard
                                    </span>
                                  )}
                                  {flow.isActive && (
                                    <span className="px-2 py-0.5 bg-green-50 text-green-600 text-[8px] font-black uppercase tracking-widest rounded border border-green-100">
                                      Deployed
                                    </span>
                                  )}
                                  <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[8px] font-black uppercase tracking-widest rounded border border-slate-200">
                                    v{flow.version || 1}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500 line-clamp-1">
                                  {flow.flowDescription ||
                                    flow.description ||
                                    "No description provided"}
                                </p>
                                <div className="mt-3 flex items-center gap-4">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                                      Type:
                                    </span>
                                    <span className="text-[10px] font-bold text-indigo-600 uppercase">
                                      {flow.flowType || "custom"}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 pl-4 border-l border-slate-200">
                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                                      Complexity:
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-700 uppercase">
                                      {flow.steps?.length || 0} Nodes
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 pl-4 border-l border-slate-200">
                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                                      Updated:
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-700 uppercase">
                                      {flow.updatedAt
                                        ? new Date(
                                            flow.updatedAt,
                                          ).toLocaleDateString()
                                        : "N/A"}
                                    </span>
                                  </div>
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
                                  variant="destructive"
                                  onClick={() => handleDeleteFlow(flow._id)}
                                  disabled={isActionLoading(flow._id, "delete")}
                                  title="Delete Flow"
                                  className="rounded-xl bg-red-600 hover:bg-red-700 min-w-[2.5rem]"
                                >
                                  {isActionLoading(flow._id, "delete") ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="px-6 py-4 bg-white">
                            <div className="flex items-center justify-between flex-wrap gap-4">
                              <div className="text-sm text-slate-600">
                                <span className="font-semibold text-slate-700">
                                  Triggers:
                                </span>{" "}
                                {flow.triggers && flow.triggers.length > 0
                                  ? flow.triggers.map((t: any, idx: number) => (
                                      <span
                                        key={idx}
                                        className="inline-block px-2 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium mr-1"
                                      >
                                        {t.triggerType}: &quot;{t.triggerValue}
                                        &quot;
                                      </span>
                                    ))
                                  : flow.trigger?.type || "message"}
                                {flow.trigger?.value && !flow.triggers && (
                                  <span className="inline-block px-2 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium ml-1">
                                    → &quot;{flow.trigger.value}&quot;
                                  </span>
                                )}
                                {flow.triggers && flow.triggers.length > 0 && (
                                  <span className="ml-2 text-xs text-slate-500">
                                    ({flow.triggers.length} trigger
                                    {flow.triggers.length > 1 ? "s" : ""})
                                  </span>
                                )}
                              </div>
                              {/* Single-click flow activation — replaces the old 3-step process */}
                              <div className="flex items-center gap-2">
                                {flow.isActive ? (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-xl text-xs font-bold">
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    Active &amp; Live
                                  </span>
                                ) : (
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      handleSetActiveFlow(flow._id)
                                    }
                                    disabled={isActionLoading(
                                      flow._id,
                                      "set-active",
                                    )}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl min-w-[160px] font-semibold text-[11px] uppercase tracking-wider shadow-md shadow-indigo-900/20"
                                  >
                                    {isActionLoading(flow._id, "set-active") ? (
                                      <>
                                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                        Activating...
                                      </>
                                    ) : (
                                      <>
                                        <Zap className="w-3.5 h-3.5 mr-1.5" />
                                        Set as Active Flow
                                      </>
                                    )}
                                  </Button>
                                )}
                              </div>
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
                {flows.filter((f) => f.isTemplate).length === 0 ? (
                  <Card className="col-span-full">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Workflow className="w-16 h-16 text-gray-300 mb-4" />
                      <h3 className="text-xl font-semibold text-gray-700 mb-2">
                        No Templates Yet
                      </h3>
                      <p className="text-gray-500 mb-6">
                        Create flows and mark them as templates to see them here
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  flows
                    .filter((f) => f.isTemplate)
                    .map((template) => (
                      <Card
                        key={template._id}
                        className="rounded-2xl border-0 shadow-xl hover:shadow-2xl transition-all"
                      >
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
                          <CardTitle className="text-lg font-bold text-gray-900">
                            {template.name || template.flowName}
                          </CardTitle>
                          <CardDescription className="text-sm text-gray-600">
                            {template.description ||
                              template.flowDescription ||
                              "No description"}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm text-gray-600">
                              <span>Nodes:</span>
                              <span className="font-semibold">
                                {template.nodes?.length || 0}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-sm text-gray-600">
                              <span>Edges:</span>
                              <span className="font-semibold">
                                {template.edges?.length || 0}
                              </span>
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
