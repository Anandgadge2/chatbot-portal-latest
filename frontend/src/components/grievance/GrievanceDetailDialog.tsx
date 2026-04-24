"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Grievance } from "@/lib/api/grievance";
import { formatDistanceToNow } from "date-fns";
import { formatDateTime, formatDate, formatISTTime } from "@/lib/utils";
import { formatTo10Digits } from "@/lib/utils/phoneUtils";
import {
  Calendar,
  User,
  RefreshCw,
  CheckCircle2,
  Clock,
  Building,
  Phone,
  MessageCircle,
  MapPin,
  FileText,
  Tag,
  AlertCircle,
  X,
  ExternalLink,
  Image as ImageIcon,
  UserCheck,
  ArrowRight,
  FileType,
  Settings,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  canChangeGrievanceStatus,
  isDepartmentAdminOrHigher,
} from "@/lib/permissions";
import StatusUpdateForm from "./StatusUpdateForm";

const GrievanceMapDialog = dynamic(() => import("./GrievanceMapDialog"), {
  ssr: false,
  loading: () => <div className="h-[60vh] w-full bg-slate-900 animate-pulse flex items-center justify-center text-slate-500 font-bold uppercase tracking-widest text-xs">Loading Map...</div>
});

// Helper: treat as image if type is image or URL looks like an image
// Cloudinary image URLs contain /image/upload/ in the path
const isImageMedia = (media: { type?: string; url?: string }) => {
  if (media.type === "image") return true;
  if (media.type === "document") return false;

  const url = media.url || "";
  // Strict extension check
  if (/\.(jpe?g|png|gif|webp|bmp|svg)(\?|$)/i.test(url)) return true;

  // Cloudinary specific detection
  if (/\/image\/upload\//i.test(url)) {
    // If it has document extensions or /raw/, it's not an image
    if (
      /\.(pdf|docx?|xlsx?|txt|csv)$/i.test(url) ||
      /\/raw\/upload\//i.test(url)
    ) {
      return false;
    }
    return true;
  }

  return url.includes("image") && !url.includes("raw") && !url.includes("pdf");
};

const getDocumentLabel = (media: { url: string; type?: string }) => {
  const url = (media.url || "").toLowerCase();
  if (url.endsWith(".pdf") || url.includes("/pdf")) return "PDF Document";
  if (url.endsWith(".doc") || url.endsWith(".docx") || url.includes("/msword"))
    return "Word Document";
  if (url.endsWith(".xlsx") || url.endsWith(".xls")) return "Excel Spreadsheet";
  if (url.endsWith(".txt")) return "Text File";
  return media.type === "document" ? "Document" : "File";
};

const getLatLongFromCoordinates = (coordinates?: any, address?: string) => {
  // Try standard GeoJSON [lng, lat] array
  if (Array.isArray(coordinates) && coordinates.length >= 2) {
    const first = Number(coordinates[0]);
    const second = Number(coordinates[1]);
    if (Number.isFinite(first) && Number.isFinite(second)) {
      if (Math.abs(first) <= 180 && Math.abs(second) <= 90) {
        return { lat: second, lng: first };
      }
      if (Math.abs(first) <= 90 && Math.abs(second) <= 180) {
        return { lat: first, lng: second };
      }
    }
  }

  // Fallback: Parse from address string if it contains "Lat: ..., Long: ..."
  if (typeof address === "string") {
    const latMatch = address.match(/Lat:\s*([0-9.-]+)/i);
    const lngMatch = address.match(/Long:\s*([0-9.-]+)/i);
    if (latMatch && lngMatch) {
      const lat = parseFloat(latMatch[1]);
      const lng = parseFloat(lngMatch[1]);
      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng };
      }
    }
  }

  return null;
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

  const [activeTab, setActiveTab] = useState("overview");
  const [isMapOpen, setIsMapOpen] = useState(false);

  if (!isOpen || !grievance) return null;
  const grievanceLatLng = getLatLongFromCoordinates(
    grievance.location?.coordinates,
    grievance.location?.address
  );

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "RESOLVED":
        return {
          bg: "bg-emerald-100",
          text: "text-emerald-700",
          border: "border-emerald-200",
          icon: <CheckCircle2 className="w-4 h-4" />,
          label: "Resolved",
          gradient: "from-emerald-500 to-green-600",
        };
      case "CLOSED":
        return {
          bg: "bg-slate-100",
          text: "text-slate-700",
          border: "border-slate-200",
          icon: <CheckCircle2 className="w-4 h-4" />,
          label: "Closed",
          gradient: "from-slate-500 to-gray-600",
        };
      case "REJECTED":
        return {
          bg: "bg-rose-100",
          text: "text-rose-700",
          border: "border-rose-200",
          icon: <AlertCircle className="w-4 h-4" />,
          label: "Rejected",
          gradient: "from-rose-500 to-red-600",
        };
      case "IN_PROGRESS":
      case "ASSIGNED":
        return {
          bg: "bg-blue-100",
          text: "text-blue-700",
          border: "border-blue-200",
          icon: <RefreshCw className="w-4 h-4" />,
          label: status === "ASSIGNED" ? "Assigned" : "In Progress",
          gradient: "from-blue-500 to-indigo-600",
        };
      case "PENDING":
        return {
          bg: "bg-amber-100",
          text: "text-amber-700",
          border: "border-amber-200",
          icon: <Clock className="w-4 h-4" />,
          label: "Pending",
          gradient: "from-amber-500 to-orange-600",
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

  const statusConfig = getStatusConfig(grievance.status);
  const createdDate = new Date(grievance.createdAt);
  const timeAgo = formatDistanceToNow(createdDate, { addSuffix: true });
  const latestTransferContext = [...(grievance.timeline || [])]
    .reverse()
    .find((event: any) => {
      const note = String(event?.details?.note || "").trim();
      return (
        !!note &&
        (event.action === "DEPARTMENT_TRANSFER" || event.action === "ASSIGNED")
      );
    });
  const latestTransferNote = String(
    latestTransferContext?.details?.note || "",
  ).trim();
  const latestTransferActor =
    typeof latestTransferContext?.performedBy === "object" &&
    latestTransferContext?.performedBy
      ? `${latestTransferContext.performedBy.firstName} ${latestTransferContext.performedBy.lastName}`
      : "";
  const latestTransferTarget = [
    latestTransferContext?.details?.toDepartmentName,
    latestTransferContext?.details?.toSubDepartmentName
      ? `(${latestTransferContext.details.toSubDepartmentName})`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Get assigned user info
  const assignedTo =
    grievance.assignedTo && typeof grievance.assignedTo === "object"
      ? `${(grievance.assignedTo as any).firstName} ${(grievance.assignedTo as any).lastName}`
      : null;

  // Split media into Citizen vs Officer
  const citizenMedia = (grievance.media || []).filter((m) => !m.uploadedBy);
  const officerMedia = (grievance.media || []).filter((m) => m.uploadedBy);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-500/10 backdrop-blur-[2px] p-2 sm:p-4">
      <div className="w-full max-w-4xl max-h-[94vh] sm:max-h-[92vh] overflow-hidden rounded-2xl shadow-2xl bg-white border border-slate-200 animate-in fade-in zoom-in duration-200 flex flex-col">
        {/* Header — matching the new overview theme */}
        <div className="bg-slate-900 px-5 py-4 flex items-center justify-between gap-4 flex-shrink-0 relative overflow-hidden border-b border-slate-800">
          <div className="absolute inset-0 bg-gradient-to-r from-gray-500/10 to-slate-500/10 opacity-50"></div>

          <div className="flex items-center gap-3 min-w-0 relative z-10">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${statusConfig.gradient} shadow-lg shadow-black/20`}
            >
              {statusConfig.icon}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white uppercase tracking-tight">
                  #{grievance.grievanceId}
                </h2>
                <span
                  className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border border-current bg-opacity-10 ${statusConfig.text.replace("text-", "bg-")} ${statusConfig.text}`}
                >
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

        {/* Tab Navigation */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 flex items-stretch gap-1 overflow-x-auto no-scrollbar flex-shrink-0 min-h-[3.25rem]">
          {[
            {
              id: "overview",
              label: "Overview",
              icon: <FileText className="w-3.5 h-3.5" />,
            },
            {
              id: "media",
              label: "Media Assets",
              icon: <ImageIcon className="w-3.5 h-3.5" />,
              count: grievance.media?.length,
            },
            ...(canUpdateStatus
              ? [
                  {
                    id: "actions",
                    label: "Actions",
                    icon: <Settings className="w-3.5 h-3.5" />,
                  },
                ]
              : []),
            {
              id: "timeline",
              label: "History & Resolution",
              icon: <RefreshCw className="w-3.5 h-3.5" />,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 text-[11px] font-black uppercase tracking-widest transition-all border-b-2 -mb-[1px] relative whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-blue-500 text-slate-800 bg-white ring-1 ring-blue-500/10 shadow-sm"
                  : "border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[8px] font-black ${activeTab === tab.id ? "bg-indigo-100 text-indigo-600" : "bg-slate-200 text-slate-500"}`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Main Content Area */}
        <div className="overflow-y-auto flex-1 custom-scrollbar">
          {activeTab === "overview" && (
            <div className="p-6 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Resolution Summary (Pinned if exists) */}
              {grievance.resolution && (
                <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-2xl p-5 shadow-lg shadow-emerald-500/10 border border-emerald-400/20 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <CheckCircle2 className="w-20 h-20 text-white" />
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-white text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Final Resolution
                      Summary
                    </h3>
                    <p className="text-sm font-medium text-white leading-relaxed whitespace-pre-wrap">
                      {grievance.resolution}
                    </p>
                  </div>
                </div>
              )}

              {latestTransferNote && (
                <div className="rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 to-cyan-50 p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                      <ArrowRight className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-sky-700">
                        Transfer Context
                      </h3>
                      <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-relaxed text-slate-700">
                        {latestTransferNote}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-500">
                        {latestTransferActor && (
                          <span>Shared by {latestTransferActor}</span>
                        )}
                        {latestTransferTarget && (
                          <span>Sent to {latestTransferTarget}</span>
                        )}
                        <button
                          type="button"
                          onClick={() => setActiveTab("timeline")}
                          className="text-sky-700 transition-colors hover:text-sky-800"
                        >
                          View full routing history
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Data Grid: Citizen & Dept (Redesigned for density) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                {/* Citizen Information Group */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-slate-400">
                    <User className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      Reporting Citizen
                    </span>
                    <div className="flex-1 h-px bg-slate-100"></div>
                  </div>

                  <div className="grid grid-cols-1 gap-y-3">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase mb-0.5">
                        Full Name
                      </span>
                      <span className="text-sm font-bold text-slate-900">
                        {grievance.citizenName}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase mb-0.5">
                        Contact Detail
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {formatTo10Digits(grievance.citizenPhone)}
                        </span>
                        <a
                          href={`tel:${grievance.citizenPhone}`}
                          className="p-1.5 rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                        >
                          <Phone className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Assignment Group */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Building className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      Organizational Mapping
                    </span>
                    <div className="flex-1 h-px bg-slate-100"></div>
                  </div>

                  <div className="grid grid-cols-1 gap-y-3">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase mb-0.5">
                        Assigned Department
                      </span>
                      <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                        {typeof grievance.departmentId === "object" &&
                        grievance.departmentId
                          ? (grievance.departmentId as any).name
                          : "General / Non-Categorized"}
                        {grievance.subDepartmentId && (
                          <span className="text-slate-300 mx-1">/</span>
                        )}
                        {typeof grievance.subDepartmentId === "object" &&
                          grievance.subDepartmentId && (
                            <span className="text-indigo-600">
                              {(grievance.subDepartmentId as any).name}
                            </span>
                          )}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase mb-0.5">
                        Monitoring Officer
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 italic">
                          {assignedTo ||
                            "Unassigned / Pending Officer Allocation"}
                        </span>
                        {assignedTo && (
                          <UserCheck className="w-3.5 h-3.5 text-blue-500" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Full Width Info: Description & Location */}
              <div className="space-y-6 pt-2 border-t border-slate-100">
                {/* Description Block */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Tag className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      Description
                    </span>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-inner overflow-visible">
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-wrap break-words font-medium">
                      {(grievance as any).grievanceSummary ||
                        grievance.description ||
                        "The reporter provided no written description for this incident."}
                    </p>
                  </div>
                </div>

                {/* Location Block (Enhanced) */}
                {grievance.location &&
                  (grievance.location.address ||
                    grievance.location.coordinates) && (
                    <div className="flex flex-col gap-4 p-5 bg-[#00AEEF] rounded-2xl border border-[#0096ce] shadow-xl relative overflow-hidden group">
                      {/* Background Decoration */}
                      <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                        <MapPin className="w-24 h-24 text-white" />
                      </div>
                      
                      <div className="flex items-start gap-4 relative z-10">
                        <div className="w-12 h-12 bg-[#004a66]/30 rounded-xl flex items-center justify-center border border-white/20 flex-shrink-0 backdrop-blur-sm">
                          <MapPin className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-black text-white/80 uppercase tracking-[0.2em] mb-1.5 flex items-center gap-2">
                            Geospatial context
                          </p>
                          <p className="text-[13px] font-black text-white mb-3 tracking-tight leading-snug">
                            {grievance.location.address ||
                              "Coordinate-only location provided by device"}
                          </p>
                          
                          {grievanceLatLng && (
                            <div className="flex flex-wrap items-center gap-4">
                              <div className="flex items-center gap-2 px-3 py-1.5 bg-black/20 rounded-lg border border-white/10 backdrop-blur-sm">
                                <span className="text-[10px] font-bold text-white/90">
                                  Lat: {grievanceLatLng.lat.toFixed(7)}
                                </span>
                                <span className="w-px h-3 bg-white/20"></span>
                                <span className="text-[10px] font-bold text-white/90">
                                  Long: {grievanceLatLng.lng.toFixed(7)}
                                </span>
                              </div>
                              
                              <button
                                onClick={() => setIsMapOpen(true)}
                                className="text-[10px] font-black text-[#00AEEF] bg-white hover:bg-slate-50 px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-lg active:scale-95 uppercase tracking-widest"
                              >
                                <ExternalLink className="w-3 h-3" />
                                View Map
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Map Modal Integration */}
                      {grievanceLatLng && (
                        <GrievanceMapDialog
                          isOpen={isMapOpen}
                          onClose={() => setIsMapOpen(false)}
                          lat={grievanceLatLng.lat}
                          lng={grievanceLatLng.lng}
                          address={grievance.location.address}
                          grievanceId={grievance.grievanceId}
                        />
                      )}
                    </div>
                  )}
              </div>
            </div>
          )}

          {activeTab === "media" && (
            <div className="p-6 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Grid View for Media */}
              <div className="space-y-6">
                {citizenMedia.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <ImageIcon className="w-3.5 h-3.5" /> Citizen Evidence
                        Folder
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        {citizenMedia.length} Files
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {citizenMedia.map((media: any, index: number) => {
                        const isImage = isImageMedia(media);
                        return (
                          <div
                            key={`c-${index}`}
                            className="group relative aspect-video rounded-xl overflow-hidden border border-slate-200 bg-slate-50 hover:border-indigo-300 transition-all shadow-sm"
                          >
                            {isImage ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setFullScreenMedia({
                                    url: media.url,
                                    alt: `Evidence ${index + 1}`,
                                    isImage: true,
                                  })
                                }
                                className="block w-full h-full relative"
                              >
                                <Image
                                  src={media.url}
                                  alt={`Evidence ${index + 1}`}
                                  fill
                                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                                  unoptimized
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                  <span className="bg-white/90 backdrop-blur-sm text-[8px] font-black text-slate-900 px-2 py-1 rounded-lg uppercase tracking-tight shadow-lg">
                                    Enlarge
                                  </span>
                                </div>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setFullScreenMedia({
                                    url: media.url,
                                    alt: getDocumentLabel(media),
                                    isImage: false,
                                  })
                                }
                                className="w-full h-full flex flex-col items-center justify-center gap-1.5 hover:bg-slate-100 transition-colors"
                              >
                                <FileType className="w-5 h-5 text-indigo-500" />
                                <span className="text-[9px] font-bold text-slate-700 px-2 text-center line-clamp-1">
                                  {getDocumentLabel(media)}
                                </span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {officerMedia.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-1 border-b border-emerald-100">
                      <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                        <UserCheck className="w-3.5 h-3.5" /> Officer
                        Documentation Proof
                      </span>
                      <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        {officerMedia.length} Files
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {officerMedia.map((media: any, index: number) => {
                        const isImage = isImageMedia(media);
                        const oName =
                          typeof media.uploadedBy === "object"
                            ? `${media.uploadedBy.firstName}`
                            : "Officer";
                        return (
                          <div
                            key={`o-${index}`}
                            className="group relative aspect-video rounded-xl overflow-hidden border border-emerald-200 bg-emerald-50/30 hover:border-emerald-400 transition-all shadow-sm"
                          >
                            {isImage ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setFullScreenMedia({
                                    url: media.url,
                                    alt: `Officer Doc ${index + 1}`,
                                    isImage: true,
                                  })
                                }
                                className="block w-full h-full relative"
                              >
                                <Image
                                  src={media.url}
                                  alt={`Officer Doc ${index + 1}`}
                                  fill
                                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                                  unoptimized
                                />
                                <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/60 to-transparent">
                                  <p className="text-[7px] text-white font-black uppercase tracking-widest line-clamp-1">
                                    By {oName}
                                  </p>
                                </div>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setFullScreenMedia({
                                    url: media.url,
                                    alt: getDocumentLabel(media),
                                    isImage: false,
                                  })
                                }
                                className="w-full h-full flex flex-col items-center justify-center gap-1.5 hover:bg-emerald-100 transition-colors"
                              >
                                <FileType className="w-5 h-5 text-emerald-600" />
                                <span className="text-[9px] font-bold text-emerald-800 px-2 text-center line-clamp-1">
                                  {getDocumentLabel(media)}
                                </span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {(!grievance.media || grievance.media.length === 0) && (
                  <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                    <ImageIcon className="w-10 h-10 text-slate-300 mb-3" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      No Media Artifacts Found
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "timeline" && (
            <div className="p-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="relative pl-8 space-y-6">
                {/* Cohesive Modern Timeline Line */}
                <div className="absolute left-[11px] top-4 bottom-4 w-[1.5px] bg-slate-100"></div>

                {/* Registration Event (Root) */}
                <div className="relative">
                  <div className="absolute -left-9 top-1 w-8 h-8 rounded-full bg-emerald-50 border-4 border-white ring-1 ring-emerald-100 flex items-center justify-center z-10">
                    <Calendar className="w-3 h-3 text-emerald-600" />
                  </div>
                  <div className="flex flex-col gap-1 pl-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                        Grievance Registered
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 font-mono">
                        {formatDateTime(createdDate)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      Securely received via WhatsApp Chatbot and acknowledged in
                      the system repository.
                    </p>
                  </div>
                </div>

                {/* Iterative Timeline Log */}
                {(grievance.timeline || [])
                  .filter((e) => e.action !== "CREATED")
                  .map((event, idx) => {
                    let c = {
                      bg: "bg-indigo-50",
                      ring: "ring-indigo-100",
                      text: "text-indigo-600",
                      i: <RefreshCw className="w-3 h-3" />,
                    };
                    let title = event.action.replace("_", " ");
                    let desc = event.details?.remarks || "";

                    if (event.action === "ASSIGNED") {
                      c = {
                        bg: "bg-orange-50",
                        ring: "ring-orange-100",
                        text: "text-orange-600",
                        i: <UserCheck className="w-3 h-3" />,
                      };
                      title = "Personnel Allocation";
                      const assignLines = [
                        event.details?.grievanceId
                          ? `Grievance ID: ${event.details.grievanceId}`
                          : "",
                        `Assigned to ${event.details?.toUserName || "a specialized officer"} for investigation.`,
                        event.details?.note
                          ? `Note: ${event.details.note}`
                          : "",
                      ].filter(Boolean);
                      desc = assignLines.join("\n");
                    } else if (event.action === "STATUS_UPDATED") {
                      const iR = ["RESOLVED", "CLOSED"].includes(
                        event.details?.toStatus,
                      );
                      c = {
                        bg: iR ? "bg-emerald-50" : "bg-blue-50",
                        ring: iR ? "ring-emerald-100" : "ring-blue-100",
                        text: iR ? "text-emerald-600" : "text-blue-600",
                        i: iR ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <RefreshCw className="w-3 h-3" />
                        ),
                      };
                      title = `Milestone: ${event.details?.toStatus}`;
                    } else if (event.action === "DEPARTMENT_TRANSFER") {
                      c = {
                        bg: "bg-purple-50",
                        ring: "ring-purple-100",
                        text: "text-purple-600",
                        i: <Building className="w-3 h-3" />,
                      };
                      title = "Cross-Department Routing";
                      const targetLabel = [
                        event.details?.toDepartmentName || "relevant authority",
                        event.details?.toSubDepartmentName
                          ? `(${event.details.toSubDepartmentName})`
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ");
                      const transferLines = [
                        event.details?.grievanceId
                          ? `Grievance ID: ${event.details.grievanceId}`
                          : "",
                        `Re-routed to ${targetLabel} for cross-unit resolution.`,
                        event.details?.note
                          ? `Note: ${event.details.note}`
                          : "",
                      ].filter(Boolean);
                      desc = transferLines.join("\n");
                    }

                    const perf =
                      typeof event.performedBy === "object"
                        ? `${event.performedBy.firstName} ${event.performedBy.lastName}`
                        : "Automated System";

                    return (
                      <div key={idx} className="relative">
                        <div
                          className={`absolute -left-9 top-1 w-8 h-8 rounded-full ${c.bg} border-4 border-white ring-1 ${c.ring} flex items-center justify-center z-10 shadow-sm`}
                        >
                          <div className={c.text}>{c.i}</div>
                        </div>
                        <div className="flex flex-col gap-1 pl-4">
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-[10px] font-black ${c.text} uppercase tracking-widest`}
                            >
                              {title}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400 font-mono">
                              {formatDateTime(event.timestamp)}
                            </span>
                          </div>
                          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                            <p className="whitespace-pre-line text-xs text-slate-600 font-medium leading-relaxed">
                              {desc ||
                                "Status update logged without additional remarks."}
                            </p>
                            <div className="mt-2 flex items-center gap-1.5 opacity-60">
                              <User className="w-2.5 h-2.5 text-slate-400" />
                              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                                Actioned By {perf}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {activeTab === "actions" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 h-full">
              <StatusUpdateForm
                itemId={grievance._id}
                itemType="grievance"
                currentStatus={grievance.status}
                onSuccess={() => {
                  if (onSuccess) onSuccess();
                  setActiveTab("timeline");
                }}
                onCancel={onClose}
                grievanceVariant={
                  !isDepartmentAdminOrHigher(user)
                    ? "operator"
                    : "department-admin"
                }
                showCancelButton={false}
              />
            </div>
          )}
        </div>
      </div>

      {/* Full Screen Media Modal — preserved logic with updated theme */}
      {fullScreenMedia && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/98 backdrop-blur-md animate-in fade-in duration-300"
          onClick={() => setFullScreenMedia(null)}
        >
          <div className="absolute top-6 right-6 z-[210] flex items-center gap-3">
            <a
              href={fullScreenMedia.url}
              download
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-white text-[10px] font-black uppercase tracking-widest transition-all backdrop-blur-md border border-white/10"
            >
              Download Source
            </a>
            <button
              onClick={() => setFullScreenMedia(null)}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all backdrop-blur-md border border-white/10"
            >
              {" "}
              <X className="w-5 h-5" />{" "}
            </button>
          </div>

          <div
            className="relative w-full h-full flex items-center justify-center p-4 sm:p-12"
            onClick={(e) => e.stopPropagation()}
          >
            {fullScreenMedia.isImage ? (
              <div className="relative w-full h-full max-w-5xl max-h-screen">
                <Image
                  src={fullScreenMedia.url}
                  alt={fullScreenMedia.alt || "Proof"}
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
            ) : (
              <div className="bg-white p-8 rounded-2xl max-w-lg w-full text-center shadow-2xl relative">
                <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner ring-1 ring-indigo-100">
                  <FileType className="w-10 h-10 text-indigo-500" />
                </div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4">
                  {fullScreenMedia.alt}
                </h3>
                <div className="flex flex-col gap-3">
                  <Button
                    asChild
                    className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-indigo-600/20"
                  >
                    <a
                      href={fullScreenMedia.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Download Document
                    </a>
                  </Button>
                  <button
                    onClick={() => setFullScreenMedia(null)}
                    className="h-11 w-full text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-all"
                  >
                    Go Back
                  </button>
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
