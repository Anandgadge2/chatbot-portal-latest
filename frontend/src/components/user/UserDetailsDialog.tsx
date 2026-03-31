"use client";

import { User } from "@/lib/api/user";
import {
  X,
  User as UserIcon,
  Mail,
  Phone,
  Shield,
  Building,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { formatTo10Digits } from "@/lib/utils/phoneUtils";

interface UserDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

export default function UserDetailsDialog({
  isOpen,
  onClose,
  user,
}: UserDetailsDialogProps) {
  if (!isOpen || !user) return null;

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

  // Get role color
  const getRoleColor = (role: string) => {
    switch (role) {
      case "SUPER_ADMIN":
        return "from-red-500 to-rose-600";
      default:
        return "from-slate-500 to-slate-600";
    }
  };


  const roleName = user.customRoleId
    ? typeof user.customRoleId === "object"
      ? (user.customRoleId as any).name
      : "Custom Role"
    : (user.role || "CUSTOM").replace(/_/g, " ");

  const roleGradient = getRoleColor(user.role || "");

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl bg-white animate-in fade-in zoom-in duration-200 flex flex-col">
        {/* Dark Slate Header */}
        <div className="bg-slate-900 p-5 relative overflow-hidden flex-shrink-0 border-b border-slate-800">
          {/* Subtle Background Pattern */}
          <div className="absolute inset-0 bg-white bg-opacity-5">
            <div
              className="absolute inset-0 opacity-[0.05]"
              style={{
                backgroundImage:
                  "radial-gradient(#ffffff 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            ></div>
          </div>

          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-12 h-12 bg-white bg-opacity-10 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white border-opacity-10 shadow-lg flex-shrink-0">
                  <UserIcon className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-white uppercase tracking-tight">
                    User Profile Details
                  </h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="px-2 py-0.5 bg-indigo-500 bg-opacity-20 rounded-md text-[10px] font-black text-indigo-300 border border-indigo-500 border-opacity-20 uppercase tracking-widest">
                      {user.userId ||
                        `USER${user._id.substring(0, 8).toUpperCase()}`}
                    </span>
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-tighter">
                      •
                    </span>
                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                      {timeAgo}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-lg bg-white bg-opacity-10 hover:bg-opacity-20 flex items-center justify-center transition-all border border-white border-opacity-10 backdrop-blur-sm flex-shrink-0"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5 custom-scrollbar">
          {/* Quick Info Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <UserIcon className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-xs font-bold text-blue-600 uppercase">
                  Name
                </span>
              </div>
              <p
                className="text-base font-bold text-gray-900 break-words whitespace-normal"
                title={`${user.firstName} ${user.lastName}`}
              >
                {user.firstName} {user.lastName}
              </p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Shield className="w-4 h-4 text-purple-600" />
                </div>
                <span className="text-xs font-bold text-purple-600 uppercase">
                  Role
                </span>
              </div>
              <p
                className="text-base font-bold text-gray-900 break-words whitespace-normal"
                title={roleName}
              >
                {roleName}
              </p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-4 h-4 text-green-600" />
                </div>
                <span className="text-xs font-bold text-green-600 uppercase">
                  Created
                </span>
              </div>
              <p className="text-base font-bold text-gray-900">
                {formatDate(createdDate)}
              </p>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  {user.isActive ? (
                    <CheckCircle className="w-4 h-4 text-amber-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-amber-600" />
                  )}
                </div>
                <span className="text-xs font-bold text-amber-600 uppercase">
                  Status
                </span>
              </div>
              <p className="text-base font-bold text-gray-900">
                {user.isActive ? "Active" : "Inactive"}
              </p>
            </div>
          </div>

          {/* User Information Section */}
          <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl p-5 border border-slate-200">
            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <UserIcon className="w-4 h-4 text-blue-600" />
              </div>
              User Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <UserIcon className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-semibold text-slate-500 uppercase">
                    Full Name
                  </span>
                </div>
                <p className="text-sm font-bold text-gray-900 break-words whitespace-normal">
                  {user.firstName} {user.lastName}
                </p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-semibold text-slate-500 uppercase">
                    Email Address
                  </span>
                </div>
                <p className="text-sm font-bold text-gray-900 break-all">
                  {user.email}
                </p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <Phone className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-semibold text-slate-500 uppercase">
                    Phone Number
                  </span>
                </div>
                <p className="text-sm font-bold text-gray-900 break-all">{formatTo10Digits(user.phone || "")}</p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-semibold text-slate-500 uppercase">
                    Designation(s)
                  </span>
                </div>
                        <div className="flex flex-wrap gap-2">
                          {(() => {
                            const uniqueDesignations = new Set<string>();
                            if (user.designation) uniqueDesignations.add(user.designation);
                            user.designations?.forEach(d => uniqueDesignations.add(d));
                            
                            const list = Array.from(uniqueDesignations);
                            if (list.length === 0) return <span className="text-xs text-slate-400 italic font-medium">No designations assigned</span>;
                            
                            return list.map((d, index) => (
                              <span 
                                key={index} 
                                className={`px-2.5 py-1 text-[10px] font-bold rounded-lg uppercase tracking-wider border shadow-sm transition-all ${
                                  d === user.designation 
                                    ? "bg-slate-100 text-slate-700 border-slate-300 ring-1 ring-slate-200" 
                                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                                }`}
                              >
                                {d}
                              </span>
                            ));
                          })()}
                        </div>
              </div>


              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-semibold text-slate-500 uppercase">
                    Role & Permissions
                  </span>
                </div>
                <p className="text-sm font-bold text-gray-900 break-words whitespace-normal">{roleName}</p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-slate-200 col-span-1 md:col-span-2">
                <div className="flex items-center gap-2 mb-3">
                  <Building className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-black text-slate-500 uppercase tracking-widest">
                    Mapped Organizational Units
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    const uniqueDepts = new Map();
                    // Add primary
                    if (user.departmentId) {
                      const id = typeof user.departmentId === 'object' ? user.departmentId._id : user.departmentId;
                      const name = typeof user.departmentId === 'object' ? user.departmentId.name : (user.departmentId as any).name || id;
                      uniqueDepts.set(id, { name, isPrimary: true });
                    }
                    // Add multiples
                    user.departmentIds?.forEach(dept => {
                      const id = typeof dept === 'object' ? dept._id : dept;
                      if (!uniqueDepts.has(id)) {
                        const name = typeof dept === 'object' ? dept.name : (dept as any).name || id;
                        uniqueDepts.set(id, { name, isPrimary: false });
                      }
                    });

                    const deptList = Array.from(uniqueDepts.values());
                    if (deptList.length === 0) return <span className="text-xs text-slate-400 italic">No departments mapped</span>;

                    return deptList.map((dept, idx) => (
                      <div key={idx} className={`px-3 py-1.5 border rounded-lg flex flex-col ${dept.isPrimary ? "bg-indigo-600 border-indigo-700 shadow-sm" : "bg-white border-slate-200"}`}>
                        <span className={`text-sm font-bold ${dept.isPrimary ? "text-white" : "text-slate-800"}`}>
                          {dept.name}
                        </span>
                        <span className={`text-[8px] font-black uppercase tracking-widest mt-0.5 ${dept.isPrimary ? "text-indigo-200" : "text-slate-400"}`}>
                          {dept.isPrimary ? "Primary Unit" : "Secondary Mapping"}
                        </span>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-semibold text-slate-500 uppercase">
                    Created At
                  </span>
                </div>
                <p className="text-sm font-bold text-gray-900">
                  {formatDateTime(createdDate)}
                </p>
              </div>

              {updatedDate && (
                <div className="bg-white rounded-lg p-4 border border-slate-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-semibold text-slate-500 uppercase">
                      Last Updated
                    </span>
                  </div>
                  <p className="text-sm font-bold text-gray-900">
                    {formatDateTime(updatedDate)}
                  </p>
                </div>
              )}

              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  {user.isActive ? (
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span className="text-xs font-semibold text-slate-500 uppercase">
                    Account Status
                  </span>
                </div>
                <p
                  className={`text-sm font-bold ${user.isActive ? "text-emerald-600" : "text-red-600"}`}
                >
                  {user.isActive ? "Active" : "Inactive"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-5 py-4 bg-gradient-to-r from-slate-50 to-white border-t border-slate-200">
          <button
            onClick={onClose}
            className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}