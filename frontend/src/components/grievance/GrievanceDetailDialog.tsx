"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Grievance } from "@/lib/api/grievance";
import { formatDistanceToNow } from "date-fns";
import { formatDateTime, formatDate } from "@/lib/utils";
import { formatTo10Digits } from "@/lib/utils/phoneUtils";
import {
  Calendar,
  User,
  RefreshCw,
  CheckCircle2,
  Clock,
  Building,
  Phone,
  MapPin,
  FileText,
  Tag,
  AlertCircle,
  X,
  ExternalLink,
  Image as ImageIcon,
  UserCheck,
  FileType,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { canChangeGrievanceStatus, isDepartmentAdminOrHigher } from "@/lib/permissions";
import StatusUpdateForm from "./StatusUpdateForm";

// Helper: treat as image if type is image or URL looks like an image
const isImageMedia = (media: { type?: string; url?: string }) => {
  if (media.type === "image") return true;
  if (media.type === "document") return false;

  const url = media.url || "";
  if (/\.(jpe?g|png|gif|webp|bmp|svg)(\?|$)/i.test(url)) return true;
  if (/\/image\/upload\//i.test(url)) {
    if (/\.(pdf|docx?|xlsx?|txt|csv)$/i.test(url) || /\/raw\/upload\//i.test(url)) return false;
    return true;
  }
  return url.includes("image") && !url.includes("raw") && !url.includes("pdf");
};

const getDocumentLabel = (media: { url: string; type?: string }) => {
  const url = (media.url || "").toLowerCase();
  if (url.endsWith(".pdf") || url.includes("/pdf")) return "PDF Document";
  if (url.endsWith(".doc") || url.endsWith(".docx") || url.includes("/msword")) return "Word Document";
  if (url.endsWith(".xlsx") || url.endsWith(".xls")) return "Excel Spreadsheet";
  if (url.endsWith(".txt")) return "Text File";
  return media.type === "document" ? "Document" : "File";
};

interface GrievanceDetailDialogProps {
  isOpen: boolean;
  grievance: Grievance | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const GrievanceDetailDialog: React.FC<GrievanceDetailDialogProps> = ({
  isOpen,
  grievance,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const canUpdateStatus = canChangeGrievanceStatus(user);
  const [fullScreenMedia, setFullScreenMedia] = useState<{
    url: string;
    alt?: string;
    isImage?: boolean;
  } | null>(null);

  if (!isOpen || !grievance) return null;

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "RESOLVED":
        return { bg: "bg-emerald-100", text: "text-emerald-700", icon: <CheckCircle2 className="w-4 h-4" />, label: "Resolved", gradient: "from-emerald-500 to-green-600" };
      case "CLOSED":
        return { bg: "bg-slate-100", text: "text-slate-700", icon: <CheckCircle2 className="w-4 h-4" />, label: "Closed", gradient: "from-slate-500 to-gray-600" };
      case "REJECTED":
        return { bg: "bg-rose-100", text: "text-rose-700", icon: <AlertCircle className="w-4 h-4" />, label: "Rejected", gradient: "from-rose-500 to-red-600" };
      case "IN_PROGRESS":
      case "ASSIGNED":
        return { bg: "bg-blue-100", text: "text-blue-700", icon: <RefreshCw className="w-4 h-4" />, label: status === "ASSIGNED" ? "Assigned" : "In Progress", gradient: "from-blue-500 to-indigo-600" };
      case "PENDING":
        return { bg: "bg-amber-100", text: "text-amber-700", icon: <Clock className="w-4 h-4" />, label: "Pending", gradient: "from-amber-500 to-orange-600" };
      default:
        return { bg: "bg-gray-100", text: "text-gray-700", icon: <AlertCircle className="w-4 h-4" />, label: status, gradient: "from-gray-500 to-slate-600" };
    }
  };

  const statusConfig = getStatusConfig(grievance.status);
  const createdDate = new Date(grievance.createdAt);
  const timeAgo = formatDistanceToNow(createdDate, { addSuffix: true });

  const assignedTo =
    grievance.assignedTo && typeof grievance.assignedTo === "object"
      ? `${(grievance.assignedTo as any).firstName} ${(grievance.assignedTo as any).lastName}`
      : null;

  const citizenMedia = (grievance.media || []).filter((m) => !m.uploadedBy);
  const officerMedia = (grievance.media || []).filter((m) => m.uploadedBy);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-500/10 backdrop-blur-[2px] p-2 sm:p-4">
      <div className="w-full max-w-4xl max-h-[94vh] sm:max-h-[92vh] overflow-hidden rounded-2xl shadow-2xl bg-white border border-slate-200 animate-in fade-in zoom-in duration-200 flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 px-5 py-4 flex items-center justify-between gap-4 flex-shrink-0 relative overflow-hidden border-b border-slate-800">
          <div className="absolute inset-0 bg-gradient-to-r from-gray-500/10 to-slate-500/10 opacity-50"></div>
          
          <div className="flex items-center gap-3 min-w-0 relative z-10">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${statusConfig.gradient} shadow-lg shadow-black/20`}>
              {statusConfig.icon}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white uppercase tracking-tight">#{grievance.grievanceId}</h2>
                <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border border-current bg-opacity-10 ${statusConfig.text.replace('text-', 'bg-')} ${statusConfig.text}`}>
                  {statusConfig.label}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mt-0.5">
                Submitted {timeAgo} • {formatDate(createdDate)}
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

        {/* Main Content Area — Single Scrollable Page */}
        <div className="overflow-y-auto flex-1 custom-scrollbar p-6 space-y-8">
          
          {/* Section 1: Core Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-400">
                <User className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase tracking-widest">Reporting Citizen</span>
                <div className="flex-1 h-px bg-slate-100"></div>
              </div>
              <div className="grid grid-cols-1 gap-y-3">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase mb-0.5">Full Name</span>
                  <span className="text-sm font-bold text-slate-900">{grievance.citizenName}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase mb-0.5">Contact Detail</span>
                  <div className="flex items-center gap-2">
                     <span className="text-sm font-bold text-slate-900">{formatTo10Digits(grievance.citizenPhone)}</span>
                     <a href={`tel:${grievance.citizenPhone}`} className="p-1.5 rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors">
                        <Phone className="w-3 h-3" />
                     </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-400">
                <Building className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase tracking-widest">Organizational Mapping</span>
                <div className="flex-1 h-px bg-slate-100"></div>
              </div>
              <div className="grid grid-cols-1 gap-y-3">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase mb-0.5">Assigned Department</span>
                  <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    {typeof grievance.departmentId === "object" && grievance.departmentId ? (grievance.departmentId as any).name : "General"}
                    {grievance.subDepartmentId && <span className="text-slate-300 mx-1">/</span>}
                    {typeof grievance.subDepartmentId === "object" && grievance.subDepartmentId && (
                      <span className="text-indigo-600">{(grievance.subDepartmentId as any).name}</span>
                    )}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase mb-0.5">Monitoring Officer</span>
                  <div className="flex items-center gap-2">
                     <span className="text-sm font-bold text-slate-900 italic">
                       {assignedTo || "Unassigned"}
                     </span>
                     {assignedTo && <UserCheck className="w-3.5 h-3.5 text-blue-500" />}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Description & Location */}
          <div className="space-y-6 pt-4 border-t border-slate-100">
            <div className="space-y-3">
               <div className="flex items-center gap-2 text-slate-400">
                  <Tag className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Incident Description</span>
               </div>
               <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap font-medium">
                    {grievance.description || "No description provided."}
                  </p>
               </div>
            </div>

            {grievance.location && (grievance.location.address || grievance.location.coordinates) && (
              <div className="flex items-start gap-4 p-4 bg-slate-900 rounded-xl border border-slate-800 shadow-lg">
                <div className="w-10 h-10 bg-slate-800/50 rounded-lg flex items-center justify-center border border-slate-700/50 flex-shrink-0">
                  <MapPin className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Geospatial context</p>
                  <p className="text-[11px] font-bold text-white mb-2">{grievance.location.address || "Coordinate-only location"}</p>
                  {grievance.location.coordinates && (
                    <div className="flex items-center gap-3">
                       <code className="text-[10px] text-indigo-400 bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-900/50 font-mono">
                         {grievance.location.coordinates[1]?.toFixed(6)}, {grievance.location.coordinates[0]?.toFixed(6)}
                       </code>
                       <a href={`https://www.google.com/maps?q=${grievance.location.coordinates[1]},${grievance.location.coordinates[0]}`} target="_blank" rel="noopener noreferrer" className="text-[10px] font-black text-white bg-slate-800 hover:bg-slate-900 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all"> 
                          <ExternalLink className="w-3 h-3" /> Maps
                       </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Media Assets */}
          {(citizenMedia.length > 0 || officerMedia.length > 0) && (
            <div className="space-y-6 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2 text-slate-400">
                <ImageIcon className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase tracking-widest">Media Artifacts</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[...citizenMedia, ...officerMedia].map((media: any, index: number) => {
                  const isImage = isImageMedia(media);
                  return (
                    <div key={index} className="group relative aspect-video rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shadow-sm">
                      {isImage ? (
                        <button type="button" onClick={() => setFullScreenMedia({ url: media.url, alt: `Media ${index+1}`, isImage: true })} className="block w-full h-full relative">
                           <Image src={media.url} alt={`Media ${index + 1}`} fill className="object-cover group-hover:scale-105 transition-transform duration-500" unoptimized />
                        </button>
                      ) : (
                        <button type="button" onClick={() => setFullScreenMedia({ url: media.url, alt: getDocumentLabel(media), isImage: false })} className="w-full h-full flex flex-col items-center justify-center gap-1.5 hover:bg-slate-100 transition-colors">
                           <FileType className="w-5 h-5 text-indigo-500" />
                           <span className="text-[9px] font-bold text-slate-700 px-2 text-center line-clamp-1">{getDocumentLabel(media)}</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 4: Timeline */}
          <div className="space-y-6 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 text-slate-400">
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="text-[10px] font-black uppercase tracking-widest">Grievance Timeline</span>
            </div>
            <div className="relative pl-6 space-y-6">
              <div className="absolute left-[9px] top-2 bottom-2 w-[1.5px] bg-slate-100"></div>
              {(grievance.timeline || []).map((event, idx) => (
                <div key={idx} className="relative">
                  <div className="absolute -left-7 top-0.5 w-4 h-4 rounded-full bg-white border-2 border-slate-200 z-10"></div>
                  <div className="flex flex-col gap-1 pl-2">
                    <div className="flex items-center justify-between">
                       <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">{event.action.replace("_", " ")}</span>
                       <span className="text-[9px] font-bold text-slate-400 font-mono">{formatDateTime(event.timestamp)}</span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">{event.details?.remarks || event.details?.note || "Activity logged."}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 5: Status Update Form (Action Area) */}
          {canUpdateStatus && (
            <div className="pt-8 border-t-2 border-indigo-50">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/20">
                  <RefreshCw className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-tight">Administrative Actions</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Submit update and notify citizen</p>
                </div>
              </div>
              <StatusUpdateForm
                itemId={grievance._id}
                itemType="grievance"
                currentStatus={grievance.status}
                onSuccess={() => {
                  if (onSuccess) onSuccess();
                  onClose();
                }}
                onCancel={onClose}
                grievanceVariant={!isDepartmentAdminOrHigher(user) ? "operator" : "department-admin"}
                showCancelButton={false}
              />
            </div>
          )}
        </div>
      </div>

      {/* Full Screen Media Modal */}
      {fullScreenMedia && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/98 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setFullScreenMedia(null)}>
          <div className="absolute top-6 right-6 z-[210] flex items-center gap-3">
             <button onClick={() => setFullScreenMedia(null)} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all backdrop-blur-md border border-white/10"> <X className="w-5 h-5" /> </button>
          </div>
          <div className="relative w-full h-full flex items-center justify-center p-4 sm:p-12" onClick={e => e.stopPropagation()}>
            {fullScreenMedia.isImage ? (
              <div className="relative w-full h-full max-w-5xl max-h-screen">
                <Image src={fullScreenMedia.url} alt={fullScreenMedia.alt || "Proof"} fill className="object-contain" unoptimized />
              </div>
            ) : (
              <div className="bg-white p-8 rounded-2xl max-w-lg w-full text-center shadow-2xl relative">
                <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner ring-1 ring-indigo-100">
                  <FileType className="w-10 h-10 text-indigo-500" />
                </div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4">{fullScreenMedia.alt}</h3>
                <div className="flex flex-col gap-3">
                  <Button asChild className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-indigo-600/20">
                    <a href={fullScreenMedia.url} target="_blank" rel="noopener noreferrer">Download Document</a>
                  </Button>
                  <button onClick={() => setFullScreenMedia(null)} className="h-11 w-full text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-all">Go Back</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GrievanceDetailDialog;
