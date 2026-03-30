"use client";

import { useEffect, useState } from "react";
import { User, userAPI } from "@/lib/api/user";
import {
  X,
  User as UserIcon,
  Mail,
  Phone,
  Shield,
  Building,
  Search,
  Users,
  Edit2,
} from "lucide-react";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { toast } from "react-hot-toast";
import { formatTo10Digits } from "@/lib/utils/phoneUtils";

interface DepartmentUsersDialogProps {
  isOpen: boolean;
  onClose: () => void;
  departmentId: string | null;
  departmentName: string | null;
  onUserClick: (user: User) => void;
  onEditUser?: (user: User) => void;
}

export default function DepartmentUsersDialog({
  isOpen,
  onClose,
  departmentId,
  departmentName,
  onUserClick,
  onEditUser,
}: DepartmentUsersDialogProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const response = await userAPI.getAll({
          departmentId: departmentId!,
          limit: 100, // Show up to 100 users for this department
        });
        if (response.success) {
          setUsers(response.data.users);
        }
      } catch (error) {
        console.error("Failed to fetch department users:", error);
        toast.error("Failed to load users for this department");
      } finally {
        setLoading(false);
      }
    };

    if (isOpen && departmentId) {
      fetchUsers();
    }
  }, [isOpen, departmentId]);

  if (!isOpen) return null;

  const filteredUsers = users.filter(
    (u) =>
      u.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.userId?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl bg-white animate-in fade-in zoom-in duration-200 flex flex-col border border-slate-200">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-5 relative overflow-hidden flex-shrink-0">
          <div className="absolute inset-0 bg-white/5 opacity-5 pointer-events-none">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            ></div>
          </div>

          <div className="relative flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center border border-emerald-500/30">
                <Users className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white tracking-tight">
                  Department Personnel
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Building className="w-3 h-3" />
                   {departmentName || "General Department"}
                  </span>
                  <span className="text-slate-600 font-bold">•</span>
                  <span className="px-2 py-0.5 bg-emerald-500/10 rounded-full text-[10px] font-black text-emerald-400 border border-emerald-500/20 uppercase tracking-widest">
                    {users.length} Total Users
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all border border-white/10 group"
            >
              <X className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Filter users by name, email or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
            />
          </div>
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {loading ? (
            <div className="h-48 flex flex-col items-center justify-center gap-4">
              <LoadingSpinner />
              <p className="text-slate-400 text-sm font-medium animate-pulse">
                Fetching department personnel...
              </p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-slate-900 font-bold">No users found</h3>
              <p className="text-slate-500 text-sm max-w-xs mt-1">
                {searchTerm
                  ? `No matching users found for "${searchTerm}"`
                  : "This department doesn't have any users assigned yet."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredUsers.map((user) => (
                <div
                  key={user._id}
                  onClick={() => onUserClick(user)}
                  className="p-4 bg-white border border-slate-200 rounded-2xl hover:border-indigo-200 hover:shadow-md transition-all group cursor-pointer"
                  title="Click to view full profile"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center group-hover:bg-indigo-50 transition-colors">
                      <UserIcon className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                          {user.firstName} {user.lastName}
                        </h4>
                        {onEditUser && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditUser(user);
                            }}
                            className="p-1.5 rounded-lg bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all opacity-0 group-hover:opacity-100"
                            title="Edit User Detail"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 mt-1">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Mail className="w-3 h-3" />
                          <span className="truncate">{user.email}</span>
                        </div>
                        {user.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Phone className="w-3 h-3" />
                            <span>{formatTo10Digits(user.phone)}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 mt-2">
                          <span className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-black text-slate-500 border border-slate-200 uppercase tracking-widest">
                            {user.userId || "NO ID"}
                          </span>
                          <span className="px-2 py-0.5 bg-indigo-50 rounded text-[9px] font-black text-indigo-600 border border-indigo-100 uppercase tracking-widest">
                            {(user.role || "Operator").replace(/_/g, " ")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Showing {filteredUsers.length} of {users.length} users
            </span>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-lg hover:shadow-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
