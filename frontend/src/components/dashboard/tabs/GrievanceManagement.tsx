"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { 
  grievanceAPI, 
  Grievance 
} from "@/lib/api/grievance";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  Filter, 
  Plus, 
  MoreVertical, 
  ChevronRight, 
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  MessageSquare,
  ShieldAlert,
  Inbox,
  RefreshCw
} from "lucide-react";
import StatusUpdateModal from "@/components/grievance/StatusUpdateModal";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import toast from "react-hot-toast";
import { canChangeGrievanceStatus } from "@/lib/permissions";

export default function GrievanceManagement() {
  const { user } = useAuth();
  const canUpdateGrievanceStatus = canChangeGrievanceStatus(user);
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  const [selectedGrievance, setSelectedGrievance] = useState<Grievance | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);

  const fetchGrievances = useCallback(async () => {
    setLoading(true);
    try {
      const res = await grievanceAPI.getAll({ 
        limit: 100,
        status: statusFilter === "all" ? undefined : statusFilter
      });
      if (res.success) {
        setGrievances(res.data.grievances);
      }
    } catch (error) {
      console.error("Failed to fetch grievances", error);
      toast.error("Failed to load grievances");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchGrievances();
  }, [fetchGrievances]);

  const filteredGrievances = useMemo(() => {
    return grievances.filter(g => 
      g.grievanceId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.citizenName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.category?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [grievances, searchTerm]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING": return "bg-yellow-500/10 text-yellow-600 border-yellow-200";
      case "ASSIGNED": return "bg-blue-500/10 text-blue-600 border-blue-200";
      case "IN_PROGRESS": return "bg-indigo-500/10 text-indigo-600 border-indigo-200";
      case "RESOLVED": return "bg-emerald-500/10 text-emerald-600 border-emerald-200";
      case "REJECTED": return "bg-red-500/10 text-red-600 border-red-200";
      case "REVERTED": return "bg-sky-500/10 text-sky-600 border-sky-200";
      default: return "bg-indigo-500/10 text-indigo-600 border-indigo-200";
    }
  };

  const handleStatusUpdate = (grievance: Grievance) => {
    if (!canUpdateGrievanceStatus) return;
    setSelectedGrievance(grievance);
    setShowStatusModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter">
            Grievance Intelligence
          </h2>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-1">
            Monitoring active citizen requests and incidents
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="border-slate-200 bg-white rounded-xl font-bold text-xs uppercase tracking-wider h-10 shadow-sm transition-all hover:bg-slate-50">
            <Download className="w-4 h-4 mr-2 text-slate-400" />
            Export Data
          </Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-5 font-bold text-xs uppercase tracking-wider h-10 shadow-lg shadow-indigo-600/20">
            <Plus className="w-4 h-4 mr-2" />
            New Entry
          </Button>
        </div>
      </div>

      <Card className="border-slate-200 shadow-xl shadow-slate-200/50 bg-white/50 backdrop-blur-xl border-t-4 border-t-indigo-500 overflow-hidden">
        <CardHeader className="bg-white/80 border-b border-slate-100 p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 transition-colors group-focus-within:text-indigo-500" />
              <input 
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400"
              />
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-200">
                {["all", "PENDING", "ASSIGNED", "IN_PROGRESS", "REVERTED", "RESOLVED", "REJECTED"].map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-4 py-2 rounded-xl text-[14px] font-black uppercase tracking-widest transition-all ${
                      statusFilter === s 
                        ? "bg-white text-indigo-600 shadow-md shadow-indigo-600/5 border border-indigo-100" 
                        : "text-slate-400 hover:text-slate-600 hover:bg-white/50"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <Button variant="ghost" className="rounded-2xl w-11 h-11 p-0 bg-slate-50 hover:bg-slate-100 border border-slate-200">
                <Filter className="w-4.5 h-4.5 text-slate-500" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[14px] font-black text-slate-400 uppercase tracking-widest">Incident ID</th>
                  <th className="px-6 py-4 text-[14px] font-black text-slate-400 uppercase tracking-widest">Citizen</th>
                  <th className="px-6 py-4 text-[14px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                  <th className="px-6 py-4 text-[14px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-[14px] font-black text-slate-400 uppercase tracking-widest">Created At</th>
                  <th className="px-6 py-4 text-[14px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredGrievances.length > 0 ? filteredGrievances.map((g, idx) => (
                  <tr key={g._id} className="group border-b border-slate-50 hover:bg-indigo-50/30 transition-all">
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded-lg">
                        {g.grievanceId}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center font-black text-xs text-slate-600">
                          {g.citizenName?.charAt(0) || "U"}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900 leading-none">{g.citizenName}</span>
                          <span className="text-[15px] font-bold text-slate-500 mt-1">{g.citizenPhone}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-slate-700">{g.category}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1.5 rounded-full text-[14px] font-black uppercase tracking-widest border ${getStatusColor(g.status)}`}>
                        {g.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[15px] font-bold text-slate-500 uppercase tracking-wider">
                        {new Date(g.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                        {canUpdateGrievanceStatus && (
                          <Button
                            onClick={() => handleStatusUpdate(g)}
                            size="sm"
                            className="h-8 rounded-lg bg-white border border-slate-200 text-indigo-600 font-bold text-[14px] items-center px-4 hover:shadow-lg transition-all"
                          >
                            <Clock className="w-3 h-3 mr-2" />
                            UPDATE STATUS
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg hover:bg-indigo-100">
                          <ChevronRight className="w-4 h-4 text-indigo-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      {loading ? (
                        <div className="flex flex-col items-center justify-center gap-4">
                          <LoadingSpinner text="Scanning Datastream..." />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-6 opacity-40">
                          <Inbox className="w-16 h-16 text-slate-300" />
                          <div className="flex flex-col">
                            <span className="text-lg font-black text-slate-900 uppercase tracking-tighter">No Active Signals Found</span>
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Adjust your parameters or initiate a system-wide scan</span>
                          </div>
                          <Button onClick={fetchGrievances} variant="outline" className="rounded-xl font-bold uppercase tracking-widest text-[14px]">
                            <RefreshCw className="w-3 h-3 mr-2" />
                            Retune Receiver
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <StatusUpdateModal 
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        itemId={selectedGrievance?._id || ""}
        itemType="grievance"
        currentStatus={selectedGrievance?.status || ""}
        onSuccess={fetchGrievances}
      />
    </div>
  );
}
