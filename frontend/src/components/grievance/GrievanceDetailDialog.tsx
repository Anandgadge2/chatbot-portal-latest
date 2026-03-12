"use client";

import React, { useState } from "react";
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
} from "lucide-react";

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

interface GrievanceDetailDialogProps {
  isOpen: boolean;
  grievance: Grievance | null;
  onClose: () => void;
}

const GrievanceDetailDialog: React.FC<GrievanceDetailDialogProps> = ({
  isOpen,
  grievance,
  onClose,
}) => {
  const [fullScreenMedia, setFullScreenMedia] = useState<{
    url: string;
    alt?: string;
    isImage?: boolean;
  } | null>(null);

  if (!isOpen || !grievance) return null;

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

  // Get assigned user info
  const assignedTo =
    grievance.assignedTo && typeof grievance.assignedTo === "object"
      ? `${(grievance.assignedTo as any).firstName} ${(grievance.assignedTo as any).lastName}`
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl bg-white animate-in fade-in zoom-in duration-200 flex flex-col">
        {/* Dark Slate Header — consistent with superadmin theme */}
        <div className="bg-slate-900 p-5 flex items-start justify-between gap-4 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30 flex-shrink-0">
              <FileText className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-white">
                Grievance Details
              </h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="px-2 py-0.5 bg-white/10 rounded-md text-[10px] font-bold text-slate-300 tracking-widest uppercase">
                  {grievance.grievanceId}
                </span>
                <span className="text-slate-500 text-[10px]">•</span>
                <span className="text-slate-400 text-[10px] font-medium">
                  {timeAgo}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Status Badge in header */}
            <div
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wider ${statusConfig.bg} ${statusConfig.border} ${statusConfig.text}`}
            >
              {statusConfig.icon}
              {statusConfig.label}
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* Mobile Status Badge */}
        <div className="sm:hidden px-5 pt-4">
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wider ${statusConfig.bg} ${statusConfig.border} ${statusConfig.text}`}
          >
            {statusConfig.icon}
            {statusConfig.label}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5 custom-scrollbar">
          {/* Quick Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-3 border border-blue-100">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <User className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <span className="text-[10px] font-bold text-blue-600 uppercase">
                  Citizen
                </span>
              </div>
              <p
                className="text-sm font-bold text-gray-900 break-words whitespace-normal"
                title={grievance.citizenName}
              >
                {grievance.citizenName}
              </p>
            </div>



            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-3 border border-emerald-100">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <span className="text-[10px] font-bold text-emerald-600 uppercase">
                  Filed On
                </span>
              </div>
              <p className="text-sm font-bold text-gray-900">
                {formatDate(createdDate)}
              </p>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-3 border border-amber-100">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <span className="text-[10px] font-bold text-amber-600 uppercase">
                  Time
                </span>
              </div>
              <p className="text-sm font-bold text-gray-900">
                {formatISTTime(createdDate)}
              </p>
            </div>
          </div>

          {/* Department Information */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="bg-slate-900 px-5 py-3 border-b border-slate-700">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Building className="w-4 h-4 text-indigo-400" />
                Department Information
              </h3>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl shadow-sm border border-slate-100">
                  <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Building className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                      Main Department
                    </p>
                    <p
                      className="text-sm font-bold text-slate-800 break-words whitespace-normal"
                      title={
                        typeof grievance.departmentId === "object" &&
                        grievance.departmentId
                          ? (grievance.departmentId as any).name
                          : "General"
                      }
                    >
                      {typeof grievance.departmentId === "object" &&
                      grievance.departmentId
                        ? (grievance.departmentId as any).name
                        : "General"}
                    </p>
                  </div>
                </div>

                {grievance.subDepartmentId && (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl shadow-sm border border-slate-100">
                    <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <ArrowRight className="w-5 h-5 text-violet-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                        Sub-Department
                      </p>
                      <p
                        className="text-sm font-bold text-slate-800 break-words whitespace-normal"
                        title={
                          typeof grievance.subDepartmentId === "object" &&
                          grievance.subDepartmentId
                            ? (grievance.subDepartmentId as any).name
                            : ""
                        }
                      >
                        {typeof grievance.subDepartmentId === "object" &&
                        grievance.subDepartmentId
                          ? (grievance.subDepartmentId as any).name
                          : "N/A"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Citizen Information */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="bg-slate-900 px-5 py-3 border-b border-slate-700">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <User className="w-4 h-4 text-blue-400" />
                Citizen Information
              </h3>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                      Full Name
                    </p>
                    <p className="text-sm font-bold text-slate-800 break-words whitespace-normal">
                      {grievance.citizenName}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Phone className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                      Phone Number
                    </p>
                    <p className="text-sm font-bold text-slate-800">
                      {grievance.citizenPhone.replace(/\D/g, '').slice(-10)}
                    </p>
                  </div>
                </div>


              </div>
            </div>
          </div>

          {/* Grievance Description */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="bg-slate-900 px-5 py-3 border-b border-slate-700">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-400" />
                Grievance Description
              </h3>
            </div>
            <div className="p-5">
              <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl p-4 border border-slate-100">
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {grievance.description || "No description provided"}
                </p>
              </div>
            </div>
          </div>

          {/* Location Information */}
          {grievance.location &&
            (grievance.location.address || grievance.location.coordinates) && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="bg-slate-900 px-5 py-3 border-b border-slate-700">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-400" />
                    Location Information
                  </h3>
                </div>
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {grievance.location.address && (
                        <p className="text-sm font-medium text-slate-800 mb-2">
                          {grievance.location.address}
                        </p>
                      )}
                      {grievance.location.coordinates && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-slate-500 font-mono bg-slate-100 px-2 py-1 rounded">
                            {grievance.location.coordinates[1]?.toFixed(6)},{" "}
                            {grievance.location.coordinates[0]?.toFixed(6)}
                          </span>
                          <a
                            href={`https://www.google.com/maps?q=${grievance.location.coordinates[1]},${grievance.location.coordinates[0]}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                            View on Maps
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

          {/* Media/Photos */}
          {grievance.media && grievance.media.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="bg-slate-900 px-5 py-3 border-b border-slate-700">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-pink-400" />
                  Uploaded Media
                  <span className="ml-2 px-2 py-0.5 bg-white/10 text-slate-300 rounded-full text-[10px] font-bold">
                    {grievance.media.length}
                  </span>
                </h3>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {grievance.media.map((media: any, index: number) => {
                    const isImage = isImageMedia(media);
                    return (
                      <div
                        key={index}
                        className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-100"
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
                            className="absolute inset-0 w-full h-full text-left focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-inset rounded-xl"
                            aria-label={`View evidence ${index + 1} in full screen`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={media.url}
                              alt={`Evidence ${index + 1}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer"
                              onError={(e) => {
                                const target = e.currentTarget;
                                target.style.display = "none";
                                const parent = target.parentElement;
                                if (parent) {
                                  parent.innerHTML = `<div class="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-400"><svg xmlns='http://www.w3.org/2000/svg' class='w-8 h-8' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'/></svg><span class='text-xs'>Image unavailable</span></div>`;
                                }
                              }}
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center pointer-events-none">
                              <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-semibold bg-black/60 px-3 py-1.5 rounded-lg transition-all duration-200 flex items-center gap-1.5">
                                <ExternalLink className="w-3.5 h-3.5" />
                                View Full Screen
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
                            className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex flex-col items-center justify-center hover:from-indigo-50 hover:to-blue-100 transition-all duration-200 cursor-pointer border-0 gap-2"
                            aria-label={`View ${getDocumentLabel(media)} document`}
                          >
                            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-200">
                              <FileType className="w-6 h-6 text-indigo-500" />
                            </div>
                            <span className="text-sm font-semibold text-slate-700">
                              {getDocumentLabel(media)}
                            </span>
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <ExternalLink className="w-3 h-3" />
                              Click to open
                            </span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Service Timeline */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="bg-slate-900 px-5 py-3 border-b border-slate-700">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                Service Timeline
              </h3>
            </div>
            <div className="p-5">
              <div className="relative pl-8 space-y-6">
                {/* Vertical Line */}
                <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-gradient-to-b from-emerald-400 via-blue-400 to-slate-200 rounded-full"></div>

                {/* Creation Entry */}
                <div className="relative">
                  <div className="absolute -left-8 top-0 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-200">
                    <Calendar className="w-3 h-3 text-white" />
                  </div>
                  <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl p-4 border border-emerald-100 ml-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
                        Grievance Registered
                      </span>
                      <span className="text-[10px] text-emerald-600 font-medium bg-emerald-100 px-2 py-0.5 rounded-full">
                        {formatDateTime(createdDate)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">
                      Grievance successfully submitted via WhatsApp Chatbot
                    </p>
                  </div>
                </div>

                {/* Dynamic Timeline Entries */}
                {grievance.timeline && grievance.timeline.length > 0
                  ? grievance.timeline.map((event, index) => {
                      if (event.action === "CREATED") return null;

                      let iconBg = "bg-blue-500";
                      let cardBg = "from-blue-50 to-indigo-50";
                      let borderColor = "border-blue-100";
                      let textColor = "text-blue-700";
                      let icon = <RefreshCw className="w-3 h-3 text-white" />;
                      let title = "Activity Logged";
                      let description = "";

                      switch (event.action) {
                        case "ASSIGNED":
                          iconBg = "bg-orange-500";
                          cardBg = "from-orange-50 to-amber-50";
                          borderColor = "border-orange-100";
                          textColor = "text-orange-700";
                          icon = <User className="w-3 h-3 text-white" />;
                          title = "Officer Assigned";
                          description = `Assigned to ${event.details?.toUserName || "an officer"}`;
                          break;
                        case "STATUS_UPDATED":
                          const isResolved =
                            event.details?.toStatus === "RESOLVED" ||
                            event.details?.toStatus === "CLOSED" ||
                            event.details?.toStatus === "REJECTED";
                          iconBg = isResolved
                            ? "bg-emerald-500"
                            : "bg-blue-500";
                          cardBg = isResolved
                            ? "from-emerald-50 to-green-50"
                            : "from-blue-50 to-indigo-50";
                          borderColor = isResolved
                            ? "border-emerald-100"
                            : "border-blue-100";
                          textColor = isResolved
                            ? "text-emerald-700"
                            : "text-blue-700";
                          icon = isResolved ? (
                            <CheckCircle2 className="w-3 h-3 text-white" />
                          ) : (
                            <RefreshCw className="w-3 h-3 text-white" />
                          );
                          title = `Status: ${event.details?.toStatus?.replace("_", " ")}`;
                          description =
                            event.details?.remarks ||
                            "Status updated by administration";
                          break;
                        case "DEPARTMENT_TRANSFER":
                          iconBg = "bg-purple-500";
                          cardBg = "from-purple-50 to-fuchsia-50";
                          borderColor = "border-purple-100";
                          textColor = "text-purple-700";
                          icon = <Building className="w-3 h-3 text-white" />;
                          title = "Department Transferred";
                          description =
                            "Transferred to another department for resolution";
                          break;
                      }

                      const performer =
                        typeof event.performedBy === "object"
                          ? `${event.performedBy.firstName} ${event.performedBy.lastName}`
                          : "System";

                      return (
                        <div key={index} className="relative">
                          <div
                            className={`absolute -left-8 top-0 w-6 h-6 rounded-full ${iconBg} flex items-center justify-center shadow-lg`}
                          >
                            {icon}
                          </div>
                          <div
                            className={`bg-gradient-to-r ${cardBg} rounded-xl p-4 border ${borderColor} ml-2`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span
                                className={`text-xs font-bold ${textColor} uppercase tracking-wide`}
                              >
                                {title}
                              </span>
                              <span className="text-[10px] text-slate-500 font-medium bg-white/50 px-2 py-0.5 rounded-full">
                                {formatDateTime(event.timestamp)}
                              </span>
                            </div>
                            <p className="text-sm text-slate-600">
                              {description}
                            </p>
                            <div className="mt-2 flex items-center gap-2">
                              <span className="text-[10px] text-slate-400">
                                By {performer}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  : grievance.statusHistory?.map((history, index) => {
                      if (index === 0 && history.status === "PENDING")
                        return null;
                      return (
                        <div key={`hist-${index}`} className="relative">
                          <div className="absolute -left-8 top-0 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center shadow-lg">
                            <RefreshCw className="w-3 h-3 text-white" />
                          </div>
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100 ml-2">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">
                                Status: {history.status}
                              </span>
                              <span className="text-[10px] text-slate-500 font-medium">
                                {formatDateTime(history.changedAt)}
                              </span>
                            </div>
                            {history.remarks && (
                              <p className="text-sm text-slate-600 italic">
                                &ldquo;{history.remarks}&rdquo;
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
              </div>
            </div>
          </div>

          {/* Resolution Details */}
          {grievance.resolution && (
            <div className="bg-gradient-to-r from-emerald-500 to-green-600 rounded-2xl p-5 shadow-lg">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white mb-2">
                    Resolution Summary
                  </h3>
                  <p className="text-sm text-white/90 whitespace-pre-wrap">
                    {grievance.resolution}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
          >
            Close
          </button>
        </div>
      </div>

      {/* Full Screen Media Modal — handles both images and documents */}
      {fullScreenMedia && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setFullScreenMedia(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Full screen view: ${fullScreenMedia.alt}`}
        >
          {/* Top bar */}
          <div className="absolute top-0 inset-x-0 h-16 flex items-center justify-between px-5 bg-gradient-to-b from-black/60 to-transparent pointer-events-none z-10">
            <span className="text-white/80 text-sm font-semibold">
              {fullScreenMedia.alt}
            </span>
            <div className="flex items-center gap-2 pointer-events-auto">
              {/* Download button */}
              <a
                href={fullScreenMedia.url}
                download
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/30 text-white text-xs font-semibold rounded-lg transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open / Download
              </a>
              {/* Close button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFullScreenMedia(null);
                }}
                className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/30 flex items-center justify-center text-white transition-all"
                aria-label="Close full screen view"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {fullScreenMedia.isImage ? (
            /* Image viewer */
            <div
              className="relative flex items-center justify-center w-full h-full p-16"
              onClick={(e) => e.stopPropagation()}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fullScreenMedia.url}
                alt={fullScreenMedia.alt || "Full screen media"}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl select-none"
                draggable={false}
                onError={(e) => {
                  e.currentTarget.alt = "Failed to load image";
                }}
              />
            </div>
          ) : (
            /* Document viewer — embed in iframe for PDFs, otherwise open link */
            <div
              className="flex flex-col items-center justify-center gap-6 p-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-24 h-24 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20">
                <FileType className="w-12 h-12 text-white/80" />
              </div>
              <div className="text-center">
                <p className="text-white text-lg font-bold mb-1">
                  {fullScreenMedia.alt}
                </p>
                <p className="text-white/60 text-sm mb-6">
                  Click the button below to open or download this file
                </p>
                <a
                  href={fullScreenMedia.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-500 hover:bg-indigo-400 text-white font-semibold rounded-xl transition-all shadow-lg"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open Document
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GrievanceDetailDialog;
