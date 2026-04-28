"use client";

import { User } from "@/lib/api/user";
import {
  X,
  User as UserIcon,
  Mail,
  Phone,
  Shield,
  Building,
  Clock,
  ExternalLink,
  CheckCircle,
  XCircle
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { formatTo10Digits } from "@/lib/utils/phoneUtils";
import { getUserRoleLabel } from "@/lib/utils/userUtils";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";

interface UserDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  /** If provided, replaces the Close button with Select & Proceed */
  onAssign?: (user: User) => void;
  isAssigning?: boolean;
}

export default function UserDetailsDialog({
  isOpen,
  onClose,
  user,
  onAssign,
  isAssigning
}: UserDetailsDialogProps) {
  if (!user) return null;

  const designationList = [
    ...(user.designation ? [user.designation] : []),
    ...(user.designations || []),
  ].filter((value, index, list) => value && list.indexOf(value) === index);

  const departmentList = (() => {
    const uniqueDepts = new Map<string, { name: string; isPrimary: boolean }>();

    if (user.departmentId) {
      const id =
        typeof user.departmentId === "object"
          ? user.departmentId._id
          : String(user.departmentId);
      const name =
        typeof user.departmentId === "object"
          ? user.departmentId.name
          : String(user.departmentId);
      uniqueDepts.set(id, { name, isPrimary: true });
    }

    user.departmentIds?.forEach((dept) => {
      const id = typeof dept === "object" ? dept._id : String(dept);
      const name = typeof dept === "object" ? dept.name : String(dept);
      if (!uniqueDepts.has(id)) {
        uniqueDepts.set(id, { name, isPrimary: false });
      }
    });

    return Array.from(uniqueDepts.values());
  })();

  const createdDate = user?.createdAt || "";
  let timeAgo = "Unknown";
  try {
    const dateObj = new Date(createdDate);
    if (createdDate && !isNaN(dateObj.getTime())) {
      timeAgo = formatDistanceToNow(dateObj, {
        addSuffix: true,
      });
    }
  } catch (e) {
    console.error("Error formatting date:", e);
  }
  const updatedDate = user?.updatedAt || null;
  const roleName = getUserRoleLabel(user);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent hideClose className="w-[96vw] max-w-xl max-h-[92vh] sm:max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0 rounded-2xl sm:rounded-[1.5rem] border-0 shadow-2xl bg-white">
        {/* Header — Matching AssignmentDialog Theme but More Compact */}
        <DialogHeader className="relative space-y-0 border-b-0 p-0 text-left">
          <div className="relative overflow-hidden rounded-t-2xl sm:rounded-t-[1.5rem] bg-gradient-to-r from-[#1aa6ea] via-[#0d9ee3] to-[#2bb4ef] px-4 py-3 sm:px-5 sm:py-4">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.2),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.16),transparent_28%)]" />
            
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/30 bg-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-md">
                  <UserIcon className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-base font-black tracking-tight text-white uppercase leading-tight sm:text-lg">
                    User Profile
                  </DialogTitle>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span className="px-1.5 py-px bg-white/16 rounded-md text-[9px] font-black text-white border border-white/35 backdrop-blur-sm uppercase tracking-wider">
                      {user.userId || `USER${user._id.substring(0, 8).toUpperCase()}`}
                    </span>
                    <span className="text-white/60 text-[10px] font-bold">•</span>
                    <span className="text-white/80 text-[9px] font-bold uppercase tracking-widest">
                      {timeAgo}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/35 bg-white/12 transition-all duration-200 hover:bg-white/20"
              >
                <X className="h-3.5 w-3.5 text-white" />
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* Content Area — More Compact Grid */}
        <div className="flex-1 overflow-y-auto bg-slate-50 p-3 sm:p-4 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Identity Column */}
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
                <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] mb-3 flex items-center gap-2">
                  <UserIcon className="w-3 h-3 text-indigo-500" />
                  Identity Details
                </h3>
                
                <div className="space-y-3">
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Full Name</p>
                    <p className="text-[13px] font-bold text-slate-800 flex items-center gap-1.5">
                      {user.firstName} {user.lastName}
                      {user.isActive ? (
                        <CheckCircle className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <XCircle className="w-3 h-3 text-red-500" />
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Contact Channels</p>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-indigo-600">
                        <Mail className="w-3 h-3" />
                        <p className="text-xs font-bold break-all">{user.email}</p>
                      </div>
                      <div className="flex items-center gap-2 text-slate-700">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <p className="text-xs font-bold">{formatTo10Digits(user.phone || "") || "No Phone"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
                <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] mb-3 flex items-center gap-2">
                  <Clock className="w-3 h-3 text-amber-500" />
                  Account Timeline
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Member Since</p>
                    <p className="text-[11px] font-bold text-slate-700">{formatDate(createdDate)}</p>
                  </div>
                  {updatedDate && (
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Last Activity</p>
                      <p className="text-[11px] font-bold text-slate-700">{formatDate(updatedDate)}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Role & Access Column */}
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 h-full flex flex-col">
                <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] mb-3 flex items-center gap-2">
                  <Shield className="w-3 h-3 text-purple-500" />
                  Role & Mapping
                </h3>

                <div className="space-y-4 flex-1">
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Primary Role</p>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-100 rounded-full text-[9px] font-black uppercase tracking-wider shadow-sm">
                      <Shield className="w-2.5 h-2.5" />
                      {roleName}
                    </span>
                  </div>

                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Designations</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(() => {
                        if (designationList.length === 0) return <span className="text-[9px] text-slate-400 font-bold uppercase italic">None Assigned</span>;
                        
                        return designationList.map((d, index) => (
                          <span key={index} className="px-2 py-0.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-md text-[8.5px] font-bold uppercase tracking-tight">
                            {d}
                          </span>
                        ));
                      })()}
                    </div>
                  </div>

                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Organizational Units</p>
                    <div className="space-y-1.5">
                      {(() => {
                        if (departmentList.length === 0) return <p className="text-[9px] text-slate-400 font-bold uppercase italic">No units mapped</p>;

                        return departmentList.map((dept, idx) => (
                          <div key={idx} className={`p-2 rounded-lg border flex items-center justify-between group transition-all ${dept.isPrimary ? "bg-indigo-50/50 border-indigo-100 ring-1 ring-indigo-500/10" : "bg-white border-slate-200"}`}>
                            <div className="flex items-center gap-2 min-w-0">
                              <Building className={`w-3 h-3 flex-shrink-0 ${dept.isPrimary ? "text-indigo-500" : "text-slate-400"}`} />
                              <span className={`text-[10px] font-bold break-words whitespace-normal ${dept.isPrimary ? "text-indigo-900" : "text-slate-700"}`}>
                                {dept.name}
                              </span>
                            </div>
                            {dept.isPrimary && (
                              <span className="text-[7px] font-black uppercase text-indigo-500 bg-indigo-100 px-1 py-0.5 rounded-md flex-shrink-0 ml-2">Primary</span>
                            )}
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer — Matching AssignmentDialog styling */}
        <div className="px-5 py-3 bg-white border-t border-slate-100 flex items-center justify-between gap-3">
          <div className="hidden sm:block">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              Status: <span className={user.isActive ? "text-emerald-500" : "text-red-500"}>{user.isActive ? "Active" : "Inactive"}</span>
            </p>
          </div>
          <div className="flex gap-2.5 flex-1 sm:flex-initial min-w-[180px]">
            {onAssign ? (
              <>
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={isAssigning}
                  className="flex-1 h-9 rounded-xl border-slate-200 text-slate-600 font-bold uppercase text-[9px] tracking-widest transition-all hover:bg-slate-50"
                >
                  Back
                </Button>
                <Button
                  onClick={() => onAssign(user)}
                  disabled={isAssigning}
                  className="flex-[2] h-9 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black rounded-xl shadow-lg shadow-indigo-200 uppercase text-[9px] tracking-widest active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  {isAssigning ? (
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <ExternalLink className="w-3 h-3" />
                  )}
                  {isAssigning ? "Wait..." : "Select User"}
                </Button>
              </>
            ) : (
              <Button
                onClick={onClose}
                className="w-full h-9 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl uppercase text-[10px] tracking-widest transition-all active:scale-[0.98] shadow-lg shadow-slate-200"
              >
                Close Profile
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
