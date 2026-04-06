"use client";

import { useEffect, useState, useCallback } from "react";
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
  Plus,
  RefreshCw,
} from "lucide-react";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { toast } from "react-hot-toast";
import { formatTo10Digits } from "@/lib/utils/phoneUtils";
import { getUserRoleLabel } from "@/lib/utils/userUtils";

interface DepartmentUsersDialogProps {
  isOpen: boolean;
  onClose: () => void;
  departmentId: string | null;
  departmentName: string | null;
  onUserClick: (user: User) => void;
  onEditUser?: (user: User) => void;
  onCreateNewUser?: () => void;
  companyId?: string | null;
}

export default function DepartmentUsersDialog({
  isOpen,
  onClose,
  departmentId,
  departmentName,
  onUserClick,
  onEditUser,
  onCreateNewUser,
  companyId,
}: DepartmentUsersDialogProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddExisting, setShowAddExisting] = useState(false);
  const [allCompanyUsers, setAllCompanyUsers] = useState<User[]>([]);
  const [loadingAllUsers, setLoadingAllUsers] = useState(false);
  const [assigningUser, setAssigningUser] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!departmentId) return;
    setLoading(true);
    try {
      const response = await userAPI.getAll({
        departmentId: departmentId,
        limit: 100,
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
  }, [departmentId]);

  const fetchAllCompanyUsers = useCallback(async () => {
    if (!companyId) return;
    setLoadingAllUsers(true);
    try {
      const response = await userAPI.getAll({
        companyId: companyId,
        limit: 500,
      });
      if (response.success) {
        // Filter out users already in this department
        const existingIds = users.map((u) => u._id);
        const filtered = response.data.users.filter(
          (u: User) => !existingIds.includes(u._id),
        );
        setAllCompanyUsers(filtered);
      }
    } catch (error) {
      console.error("Failed to fetch all company users:", error);
    } finally {
      setLoadingAllUsers(false);
    }
  }, [companyId, users]);

  useEffect(() => {
    if (isOpen && departmentId) {
      fetchUsers();
    }
  }, [isOpen, departmentId, fetchUsers]);

  useEffect(() => {
    if (showAddExisting) {
      fetchAllCompanyUsers();
    }
  }, [showAddExisting, fetchAllCompanyUsers]);

  const handleAssignUser = async (userToAssign: User) => {
    setAssigningUser(userToAssign._id);
    try {
      // Update user's departmentIds to include this one
      const currentDeptIds = userToAssign.departmentIds?.map((d: any) =>
        typeof d === "object" ? d._id : d,
      ) || [];
      if (!currentDeptIds.includes(departmentId)) {
        const newDeptIds = [...currentDeptIds, departmentId];
        const response = await userAPI.update(userToAssign._id, {
          departmentIds: newDeptIds,
        });
        if (response.success) {
          toast.success(`${userToAssign.firstName} assigned to department`);
          fetchUsers();
          setShowAddExisting(false);
        }
      } else {
        toast.error("User is already in this department");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to assign user");
    } finally {
      setAssigningUser(null);
    }
  };

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
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-white/10 rounded-xl p-1 border border-white/10 mr-2">
                <button
                  onClick={() => setShowAddExisting(!showAddExisting)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all flex items-center gap-1.5 ${
                    showAddExisting
                      ? "bg-indigo-500 text-white shadow-lg"
                      : "text-slate-300 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Users className="w-3 h-3" />
                  Add User
                </button>
                <div className="w-px h-3 bg-white/10 mx-1" />
                <button
                  onClick={onCreateNewUser}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tight text-slate-300 hover:text-emerald-400 hover:bg-white/5 transition-all flex items-center gap-1.5"
                >
                  <Plus className="w-3 h-3" />
                  Create New
                </button>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all border border-white/10 group"
              >
                <X className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
              </button>
            </div>
          </div>
        </div>

        {/* Add User Dropdown (Conditional) */}
        {showAddExisting && (
          <div className="px-6 py-4 bg-indigo-50 border-b border-indigo-100 animate-in slide-in-from-top duration-300">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-indigo-900 uppercase tracking-widest">
                  Assign Existing Personnel
                </h3>
                <span className="text-[10px] text-indigo-500 font-bold">
                  {allCompanyUsers.length} Users Available
                </span>
              </div>
              <div className="max-h-48 overflow-y-auto custom-scrollbar bg-white rounded-xl border border-indigo-100 shadow-inner">
                {loadingAllUsers ? (
                  <div className="p-4 flex items-center justify-center">
                    <LoadingSpinner />
                  </div>
                ) : allCompanyUsers.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs font-medium">
                    No other users found in this company
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {allCompanyUsers.map((u) => (
                      <div
                        key={u._id}
                        className="p-3 hover:bg-indigo-50/50 transition-colors flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                            <UserIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900 leading-tight">
                              {u.firstName} {u.lastName}
                            </p>
                            <p className="text-[10px] text-slate-500 font-medium">
                              {u.email}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleAssignUser(u)}
                          disabled={assigningUser === u._id}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-[10px] font-black uppercase tracking-tight rounded-lg transition-all shadow-md active:scale-95"
                        >
                          {assigningUser === u._id ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            "Assign"
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

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
                            {getUserRoleLabel(user)}
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
