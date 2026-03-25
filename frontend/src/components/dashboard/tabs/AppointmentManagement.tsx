"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { 
  appointmentAPI, 
  Appointment 
} from "@/lib/api/appointment";
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
  Calendar,
  Clock,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  MapPin,
  Clock3,
  RefreshCw
} from "lucide-react";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import toast from "react-hot-toast";

export default function AppointmentManagement() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await appointmentAPI.getAll({ 
        limit: 100,
        status: statusFilter === "all" ? undefined : statusFilter
      });
      if (res.success) {
        setAppointments(res.data.appointments);
      }
    } catch (error) {
      console.error("Failed to fetch appointments", error);
      toast.error("Failed to load appointments");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter(a => 
      a.appointmentId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.citizenName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.purpose?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [appointments, searchTerm]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING": return "bg-yellow-500/10 text-yellow-600 border-yellow-200";
      case "CONFIRMED": return "bg-indigo-500/10 text-indigo-600 border-indigo-200";
      case "COMPLETED": return "bg-emerald-500/10 text-emerald-600 border-emerald-200";
      case "CANCELLED": return "bg-red-500/10 text-red-600 border-red-200";
      default: return "bg-slate-500/10 text-slate-600 border-slate-200";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter">
            Appointment Desk
          </h2>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-1">
            Managing official visitor schedules and meeting requests
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="border-slate-200 bg-white rounded-xl font-bold text-xs uppercase tracking-wider h-10 shadow-sm transition-all hover:bg-slate-50">
            <Download className="w-4 h-4 mr-2 text-slate-400" />
            Agenda Export
          </Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-5 font-bold text-xs uppercase tracking-wider h-10 shadow-lg shadow-indigo-600/20">
            <Plus className="w-4 h-4 mr-2" />
            New Appointment
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
        {filteredAppointments.length > 0 ? filteredAppointments.map((a) => (
          <Card key={a._id} className="group border-slate-200 shadow-lg shadow-slate-200/50 bg-white/50 backdrop-blur-xl border-t-4 border-t-indigo-500 hover:scale-[1.01] transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center font-black text-indigo-600 shadow-inner">
                    {a.citizenName?.charAt(0) || "U"}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-slate-900 leading-none uppercase tracking-tight">
                      {a.citizenName}
                    </span>
                    <span className="text-[10px] font-black text-slate-400 mt-2 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-widest self-start">
                      ID: {a.appointmentId}
                    </span>
                  </div>
                </div>
                <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${getStatusColor(a.status)}`}>
                  {a.status}
                </span>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-3 text-slate-600 group-hover:text-indigo-600 transition-colors">
                  <Calendar className="w-4 h-4" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">
                    {new Date(a.appointmentDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-slate-600">
                  <Clock3 className="w-4 h-4" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">{a.appointmentTime}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-600">
                  <MapPin className="w-4 h-4" />
                  <span className="text-[11px] font-bold uppercase tracking-wider truncate">
                    {typeof a.departmentId === 'object' ? (a.departmentId as any)?.name : 'Main Headquarters'}
                  </span>
                </div>
              </div>

              <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Purpose: <span className="text-slate-800 ml-1">{a.purpose}</span></span>
                <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200">
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )) : (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-center opacity-40">
             <Calendar className="w-20 h-20 text-slate-300 mb-6" />
             <div className="flex flex-col">
               <span className="text-lg font-black text-slate-900 uppercase tracking-tighter leading-none">Intelligence Agenda Empty</span>
               <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-2">No scheduled data transmissions or meetings detected in current sector</span>
             </div>
             <Button onClick={fetchAppointments} variant="outline" className="mt-8 rounded-xl font-bold uppercase tracking-widest text-[10px]">
               <RefreshCw className="w-3 h-3 mr-2" />
               Re-Sync Schedule
             </Button>
          </div>
        )}
      </div>
    </div>
  );
}
