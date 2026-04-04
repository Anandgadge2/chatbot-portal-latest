"use client";

import { formatDistanceToNow } from "date-fns";
import { formatDate, formatDateTime } from "@/lib/utils";
import { formatTo10Digits } from "@/lib/utils/phoneUtils";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Appointment } from "@/lib/api/appointment";
import {
  Calendar,
  User,
  RefreshCw,
  CheckCircle2,
  Clock,
  Building,
  AlertCircle,
  Phone,
  MessageCircle,
  FileText,
  Tag,
  X,
  Target,
} from "lucide-react";

interface AppointmentDetailDialogProps {
  isOpen: boolean;
  appointment: Appointment | null;
  onClose: () => void;
}

const AppointmentDetailDialog: React.FC<AppointmentDetailDialogProps> = ({
  isOpen,
  appointment,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState("overview");

  if (!isOpen || !appointment) return null;

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return {
          bg: "bg-emerald-100",
          text: "text-emerald-700",
          border: "border-emerald-200",
          icon: <CheckCircle2 className="w-4 h-4" />,
          label: "Completed",
          gradient: "from-emerald-500 to-green-600",
        };
      case "CONFIRMED":
        return {
          bg: "bg-blue-100",
          text: "text-blue-700",
          border: "border-blue-200",
          icon: <CheckCircle2 className="w-4 h-4" />,
          label: "Confirmed",
          gradient: "from-blue-500 to-indigo-600",
        };
      case "SCHEDULED":
        return {
          bg: "bg-indigo-100",
          text: "text-indigo-700",
          border: "border-indigo-200",
          icon: <Calendar className="w-4 h-4" />,
          label: "Scheduled",
          gradient: "from-indigo-500 to-purple-600",
        };
      case "REQUESTED":
        return {
          bg: "bg-amber-100",
          text: "text-amber-700",
          border: "border-amber-200",
          icon: <Clock className="w-4 h-4" />,
          label: "Requested",
          gradient: "from-amber-500 to-orange-600",
        };
      case "CANCELLED":
      case "NO_SHOW":
        return {
          bg: "bg-red-100",
          text: "text-red-700",
          border: "border-red-200",
          icon: <AlertCircle className="w-4 h-4" />,
          label: status === "CANCELLED" ? "Cancelled" : "No Show",
          gradient: "from-red-500 to-rose-600",
        };
      default:
        return {
          bg: "bg-gray-100",
          text: "text-gray-700",
          border: "border-gray-200",
          icon: <AlertCircle className="w-4 h-4" />,
          label: status,
          gradient: "from-gray-500 to-slate-600",
        };
    }
  };

  const statusConfig = getStatusConfig(appointment.status);
  const createdDate = new Date(appointment.createdAt);
  const timeAgo = formatDistanceToNow(createdDate, { addSuffix: true });
  const appointmentDate = new Date(appointment.appointmentDate);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-2 sm:p-4">
      <div className="w-full max-w-2xl max-h-[92vh] sm:max-h-[85vh] overflow-hidden rounded-2xl shadow-2xl bg-white border border-slate-200 animate-in fade-in zoom-in duration-200 flex flex-col">
        {/* Modern Header */}
        <div className="bg-slate-900 px-5 py-4 flex items-center justify-between gap-4 flex-shrink-0 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 opacity-50"></div>
          
          <div className="flex items-center gap-3 min-w-0 relative z-10">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${statusConfig.gradient} shadow-lg shadow-black/20`}>
              {statusConfig.icon}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-white uppercase tracking-tight">#{appointment.appointmentId}</h2>
                <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border border-current bg-opacity-10 ${statusConfig.text.replace('text-', 'bg-')} ${statusConfig.text}`}>
                  {statusConfig.label}
                </span>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                Booked {timeAgo} • Created {formatDate(createdDate)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 relative z-10">
             <button
               onClick={onClose}
               className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all border border-white/10 group active:scale-95"
             >
               <X className="w-4 h-4 text-white/70 group-hover:text-white" />
             </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 flex items-center gap-1 overflow-x-auto no-scrollbar">
           {[
             { id: "overview", label: "Appointment Overview", icon: <Calendar className="w-3.5 h-3.5" /> },
             { id: "history", label: "Audit Timeline", icon: <RefreshCw className="w-3.5 h-3.5" /> }
           ].map((tab) => (
             <button
               key={tab.id}
               onClick={() => setActiveTab(tab.id)}
               className={`flex items-center gap-2 px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 -mb-[1px] relative whitespace-nowrap ${
                 activeTab === tab.id 
                   ? "border-indigo-600 text-indigo-600 bg-white shadow-[0_-4px_0_inset_rgba(79,70,229,0.05)]" 
                   : "border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100"
               }`}
             >
               {tab.icon}
               {tab.label}
             </button>
           ))}
        </div>

        {/* Content Shell */}
        <div className="overflow-y-auto flex-1 custom-scrollbar">
           {activeTab === "overview" && (
             <div className="p-6 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* Visual Status Highlight */}
                <div className="flex items-center gap-4 p-5 bg-gradient-to-r from-slate-50 to-indigo-50/30 rounded-2xl border border-slate-100 shadow-sm">
                   <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-[9px] font-black text-indigo-600 uppercase leading-none mb-0.5">{appointmentDate.toLocaleString('default', { month: 'short' })}</span>
                      <span className="text-lg font-black text-slate-800 leading-none">{appointmentDate.getDate()}</span>
                   </div>
                   <div className="min-w-0">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Primary Schedule Instance</p>
                      <h3 className="text-sm font-bold text-slate-800">
                         {formatDate(appointmentDate)} at {formatDateTime(appointmentDate).split('at')[1] || "Scheduled Time"}
                      </h3>
                   </div>
                   <div className="ml-auto hidden sm:block">
                      <div className="px-3 py-1.5 bg-indigo-600 rounded-lg text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-indigo-600/20">
                         <Target className="w-3 h-3" /> {appointment.purpose}
                      </div>
                   </div>
                </div>

                {/* Information Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   {/* Col 1: Citizen */}
                   <div className="space-y-4">
                      <div className="flex items-center gap-2 text-slate-400">
                        <User className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Reporting Entity</span>
                        <div className="flex-1 h-px bg-slate-100"></div>
                      </div>
                      <div className="space-y-3">
                         <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Citizen Identity</span>
                            <span className="text-sm font-bold text-slate-900">{appointment.citizenName}</span>
                         </div>
                         <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Contact Method</span>
                            <div className="flex items-center gap-2">
                               <span className="text-sm font-bold text-slate-900">{formatTo10Digits(appointment.citizenPhone)}</span>
                               <a href={`tel:${appointment.citizenPhone}`} className="p-1.5 rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors">
                                  <Phone className="w-3 h-3" />
                               </a>
                            </div>
                         </div>
                      </div>
                   </div>

                   {/* Col 2: Mapping */}
                   <div className="space-y-4">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Building className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Organizational Node</span>
                        <div className="flex-1 h-px bg-slate-100"></div>
                      </div>
                      <div className="space-y-3">
                         <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Department Node</span>
                            <span className="text-sm font-bold text-slate-900">
                               {typeof appointment.departmentId === "object" && appointment.departmentId ? (appointment.departmentId as any).name : "General Sector"}
                            </span>
                         </div>
                         <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Designated Officer</span>
                            <span className="text-sm font-bold text-slate-600 italic">
                               {appointment.assignedTo && typeof appointment.assignedTo === "object" 
                                 ? `${(appointment.assignedTo as any).firstName} ${(appointment.assignedTo as any).lastName}`
                                 : "Awaiting Personnel Allocation"}
                            </span>
                         </div>
                      </div>
                   </div>
                </div>

                {/* Purpose Block */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                   <div className="flex items-center gap-2 text-slate-400">
                      <Tag className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Appointment Objective / Purpose</span>
                   </div>
                   <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-inner">
                      <p className="text-sm text-slate-600 leading-relaxed font-medium">
                        {appointment.purpose || "The purpose of this appointment was not explicitly defined during booking."}
                      </p>
                   </div>
                </div>
             </div>
           )}

           {activeTab === "history" && (
             <div className="p-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="relative pl-8 space-y-6">
                   <div className="absolute left-[11px] top-4 bottom-4 w-[1.5px] bg-slate-100"></div>

                   {/* Initial Entry */}
                   <div className="relative">
                      <div className="absolute -left-9 top-1 w-8 h-8 rounded-full bg-emerald-50 border-4 border-white ring-1 ring-emerald-100 flex items-center justify-center z-10 shadow-sm">
                         <Calendar className="w-3 h-3 text-emerald-600" />
                      </div>
                      <div className="flex flex-col gap-1 pl-4">
                         <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Booking Origin</span>
                            <span className="text-[9px] font-bold text-slate-400 font-mono">{formatDateTime(appointment.createdAt)}</span>
                         </div>
                         <p className="text-xs text-slate-500 font-medium leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                            Appointment successfully initialized and persisted via automated workflow.
                         </p>
                      </div>
                   </div>

                   {/* Timeline Loop */}
                   {(appointment.timeline || []).filter(e => e.action !== "CREATED").map((event, idx) => {
                      let c = { bg: "bg-indigo-50", ring: "ring-indigo-100", text: "text-indigo-600", i: <RefreshCw className="w-3 h-3" /> };
                      let title = event.action.replace("_", " ");
                      let desc = event.details?.remarks || "";

                      if (event.action === "ASSIGNED") {
                        c = { bg: "bg-orange-50", ring: "ring-orange-100", text: "text-orange-600", i: <User className="w-3 h-3" /> };
                        title = "Personnel Assignment";
                        desc = `Designated specialized officer: ${event.details?.toUserName || "Personnel"}.`;
                      } else if (event.action === "STATUS_UPDATED") {
                        const iR = ["COMPLETED", "CONFIRMED"].includes(event.details?.toStatus);
                        c = { bg: iR ? "bg-emerald-50" : "bg-blue-50", ring: iR ? "ring-emerald-100" : "ring-blue-100", text: iR ? "text-emerald-600" : "text-blue-600", i: iR ? <CheckCircle2 className="w-3 h-3" /> : <RefreshCw className="w-3 h-3" /> };
                        title = `Event State: ${event.details?.toStatus}`;
                      }

                      const perf = typeof event.performedBy === "object" ? `${event.performedBy.firstName} ${event.performedBy.lastName}` : "System Agent";

                      return (
                        <div key={idx} className="relative">
                          <div className={`absolute -left-9 top-1 w-8 h-8 rounded-full ${c.bg} border-4 border-white ring-1 ${c.ring} flex items-center justify-center z-10 shadow-sm`}>
                             <div className={c.text}>{c.i}</div>
                          </div>
                          <div className="flex flex-col gap-1 pl-4">
                             <div className="flex items-center justify-between">
                                <span className={`text-[10px] font-black ${c.text} uppercase tracking-widest`}>{title}</span>
                                <span className="text-[9px] font-bold text-slate-400 font-mono">{formatDateTime(event.timestamp)}</span>
                             </div>
                             <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                               <p className="text-xs text-slate-600 font-medium leading-relaxed">{desc || "Audit trail snapshot recorded."}</p>
                               <div className="mt-2 flex items-center gap-1.5 opacity-60">
                                  <User className="w-2.5 h-2.5 text-slate-400" />
                                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Logged By {perf}</span>
                               </div>
                             </div>
                          </div>
                        </div>
                      );
                   })}
                </div>
             </div>
           )}
        </div>

        {/* Utility Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 flex-shrink-0">
          <Button
            onClick={onClose}
            className="h-9 px-6 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-black/10 transition-all active:scale-95"
          >
            Acknowledge & Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AppointmentDetailDialog;
