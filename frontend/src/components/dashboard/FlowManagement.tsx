"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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

interface FlowManagementProps {
  companyId: string;
}

export default function FlowManagement({ companyId }: FlowManagementProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [flows, setFlows] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"your-flows" | "templates">("your-flows");
  const [loadingAction, setLoadingAction] = useState<{ flowId: string, action: string } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<any>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true); else setLoading(true);
      const flowsRes = await apiClient.get(`/chatbot-flows?companyId=${companyId}`);
      setFlows(Array.isArray(flowsRes.data) ? flowsRes.data : Array.isArray(flowsRes) ? flowsRes : []);
    } catch (error) {
      toast.error("Failed to load chatbot flows");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateFlow = () => {
    router.push(`/superadmin/company/${companyId}/chatbot-flows/create`);
  };

  const handleEditFlow = (flowId: string) => {
    router.push(`/superadmin/company/${companyId}/chatbot-flows/${flowId}/edit`);
  };

  const handleDuplicateFlow = async (flowId: string) => {
    setLoadingAction({ flowId, action: "duplicate" });
    try {
      await apiClient.post(`/chatbot-flows/${flowId}/duplicate`);
      toast.success("Flow duplicated");
      fetchData(true);
    } catch (error) {
      toast.error("Failed to duplicate flow");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSetActiveFlow = async (flowId: string) => {
    setLoadingAction({ flowId, action: "set-active" });
    try {
      await apiClient.post(`/chatbot-flows/${flowId}/set-active-flow`);
      toast.success("Flow activated");
      fetchData(true);
    } catch (error) {
      toast.error("Failed to set active flow");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDeleteFlow = async (flowId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Flow",
      message: "Are you sure you want to delete this chatbot flow?",
        onConfirm: async () => {
        setLoadingAction({ flowId, action: "delete" });
        try {
          await apiClient.delete(`/chatbot-flows/${flowId}`);
          toast.success("Flow deleted");
          fetchData(true);
        } catch (error) {
          toast.error("Failed to delete flow");
        } finally {
          setLoadingAction(null);
          setConfirmDialog((p: any) => ({ ...p, isOpen: false }));
        }
      }
    });
  };

  if (loading) return <div className="p-8 flex justify-center"><LoadingSpinner /></div>;

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center bg-slate-900 p-4 rounded-xl shadow-lg border border-slate-800">
         <div className="flex items-center gap-3">
           <div className="w-10 h-10 bg-indigo-500/20 rounded-lg flex items-center justify-center border border-indigo-500/30">
             <Workflow className="w-5 h-5 text-indigo-400" />
           </div>
           <div>
             <h2 className="text-white font-bold text-lg">Response Pipelines</h2>
             <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">Chatbot Logical Workflows</p>
           </div>
         </div>
         <Button onClick={handleCreateFlow} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
           <Plus className="w-4 h-4 mr-2" /> Create Flow
         </Button>
       </div>

       <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)} className="space-y-4">
         <TabsList className="bg-slate-100 border border-slate-200">
           <TabsTrigger value="your-flows">Operatonal Flows ({flows.filter(f => !f.isTemplate).length})</TabsTrigger>
           <TabsTrigger value="templates">Templates ({flows.filter(f => f.isTemplate).length})</TabsTrigger>
         </TabsList>

         <TabsContent value="your-flows" className="space-y-4">
           {flows.filter(f => !f.isTemplate).map(flow => (
             <Card key={flow._id} className={`border-slate-200 ${flow.isActive ? 'ring-2 ring-green-500' : ''}`}>
               <CardHeader className="flex flex-row items-center justify-between pb-2">
                 <div>
                   <CardTitle className="text-base">{flow.flowName || flow.name}</CardTitle>
                   <CardDescription className="text-xs line-clamp-1">{flow.flowDescription || flow.description}</CardDescription>
                 </div>
                 <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEditFlow(flow._id)}><Edit className="w-3.5 h-3.5" /></Button>
                    <Button variant="outline" size="sm" onClick={() => handleDuplicateFlow(flow._id)}><Copy className="w-3.5 h-3.5" /></Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteFlow(flow._id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                 </div>
               </CardHeader>
               <CardContent className="flex justify-between items-center">
                  <div className="text-xs text-slate-500">
                    Type: <span className="font-bold text-indigo-600 uppercase">{flow.flowType || 'custom'}</span>
                  </div>
                  {!flow.isActive && (
                    <Button size="sm" onClick={() => handleSetActiveFlow(flow._id)} className="bg-indigo-600 text-[10px] h-7">
                      Activate Flow
                    </Button>
                  )}
                  {flow.isActive && (
                    <span className="text-green-600 font-bold text-xs flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Active
                    </span>
                  )}
               </CardContent>
             </Card>
           ))}
         </TabsContent>
       </Tabs>

       {confirmDialog.isOpen && (
         <ConfirmDialog 
          isOpen={confirmDialog.isOpen} 
          title={confirmDialog.title} 
          message={confirmDialog.message} 
          onConfirm={confirmDialog.onConfirm} 
          onCancel={() => setConfirmDialog((p: any) => ({ ...p, isOpen: false }))} 
         />
       )}
    </div>
  );
}
