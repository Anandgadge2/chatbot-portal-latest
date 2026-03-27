import React, { useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  RefreshCw,
  CheckSquare,
  Square,
  AlertTriangle,
  Eye,
  EyeOff,
  Shield,
} from "lucide-react";
import { Pagination } from "@/components/ui/Pagination";
import { User, userAPI } from "@/lib/api/user";
import { Company } from "@/lib/api/company";
import { formatRoleLabel } from "@/lib/utils/roleLabel";
import toast from "react-hot-toast";
import { formatTo10Digits } from "@/lib/utils/phoneUtils";
import { isSuperAdmin } from "@/lib/permissions";

function getRoleLabel(u: User): string {
  if (u.customRoleId && typeof u.customRoleId === "object" && (u.customRoleId as any).name) {
    return (u.customRoleId as any).name;
  }
  
  if (isSuperAdmin(u)) return "Super Admin";
  if (u.level === 1) return "Company Admin";
  if (u.level === 2) return "Department Admin";
  if (u.level === 3) return "Sub Department Admin";
  if (u.level === 4) return "Operator";
  
  return formatRoleLabel(u.role);
}

function getRoleColor(u: User) {
  if (isSuperAdmin(u)) return "bg-amber-50 text-amber-700 border-amber-100";
  if (u.level === 1) return "bg-red-50 text-red-700 border-red-100";
  if (u.level === 2) return "bg-blue-50 text-blue-700 border-blue-100";
  
  return "bg-slate-50 text-slate-700 border-slate-200";
}

interface UserTabContentProps {
  users: User[];
  userSearchTerm: string;
  setUserSearchTerm: (val: string) => void;
  userCompanyFilter: string;
  setUserCompanyFilter: (val: string) => void;
  userRoleFilter: string;
  setUserRoleFilter: (val: string) => void;
  allCompanies: Company[];
  userPage: number;
  setUserPage: (val: number) => void;
  userPagination: { total: number; pages: number; limit: number };
  setUserLimit: (val: number) => void;
  visiblePasswords: string[];
  togglePasswordVisibility: (id: string) => void;
  setShowUserDialog: (val: boolean) => void;
  setEditingUser: (u: User | null) => void;
  handleEditUser: (u: User) => void;
  handleDeleteUser: (u: User) => void;
  toggleUserStatus: (u: User) => void;
  onRefresh?: () => void;
}

const UserTabContent: React.FC<UserTabContentProps> = ({
  users,
  userSearchTerm,
  setUserSearchTerm,
  userCompanyFilter,
  setUserCompanyFilter,
  userRoleFilter,
  setUserRoleFilter,
  allCompanies,
  userPage,
  setUserPage,
  userPagination,
  setUserLimit,
  visiblePasswords,
  togglePasswordVisibility,
  setShowUserDialog,
  setEditingUser,
  handleEditUser,
  handleDeleteUser,
  toggleUserStatus,
  onRefresh,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const allSelected = users.length > 0 && selectedIds.size === users.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleAll = useCallback(() => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(users.map((u) => u._id)));
  }, [allSelected, users]);

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    setShowConfirm(false);
    let ok = 0, fail = 0;
    for (const id of Array.from(selectedIds)) {
      try {
        const res = await userAPI.delete(id);
        if (res.success) ok++;
        else fail++;
      } catch { fail++; }
    }
    setBulkDeleting(false);
    setSelectedIds(new Set());
    if (ok > 0) toast.success(`${ok} user(s) deleted`);
    if (fail > 0) toast.error(`${fail} user(s) could not be deleted`);
    onRefresh?.();
  };

  return (
    <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
      <CardHeader className="bg-slate-900 border-0 px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center backdrop-blur-md border border-white/20">
              <Users className="w-4 h-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-white">Platform Users</CardTitle>
              <CardDescription className="text-slate-400 text-[10px] font-medium leading-none mt-1">
                Access control and identity management
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg"
                title="Refresh"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            )}
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg h-8 shadow-md font-bold text-[10px] uppercase tracking-wider px-4 border-0 transition-all"
              onClick={() => { setEditingUser(null); setShowUserDialog(true); }}
            >
              <Plus className="w-3 h-3 mr-1.5" />
              Add User
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Filters */}
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/30 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Rows</span>
            <select
              value={userPagination.limit}
              onChange={(e) => { setUserLimit(Number(e.target.value)); setUserPage(1); }}
              className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-600 outline-none transition-all cursor-pointer"
            >
              {[10, 20, 25, 50, 100].map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
          <div className="h-6 w-px bg-slate-200 hidden md:block mx-1"></div>
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              placeholder="Find user by name or ID..."
              value={userSearchTerm}
              onChange={(e) => { setUserSearchTerm(e.target.value); setUserPage(1); }}
              className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Company</span>
            <select
              value={userCompanyFilter}
              onChange={(e) => { setUserCompanyFilter(e.target.value); setUserPage(1); }}
              className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-600 outline-none cursor-pointer min-w-[120px]"
            >
              <option value="">All Companies</option>
              {allCompanies.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Role</span>
            <select
              value={userRoleFilter}
              onChange={(e) => { setUserRoleFilter(e.target.value); setUserPage(1); }}
              className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-600 outline-none cursor-pointer min-w-[140px]"
            >
              <option value="">All Roles</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
          </div>
        </div>

        {/* Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <div className="px-5 py-2.5 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-black text-indigo-700">{selectedIds.size} selected</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}
                className="h-7 text-[10px] font-bold uppercase tracking-wider border-indigo-200 text-indigo-600 hover:bg-indigo-100">
                Deselect All
              </Button>
              {showConfirm ? (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                  <span className="text-[10px] text-red-700 font-bold">Delete {selectedIds.size} users?</span>
                  <Button size="sm" onClick={handleBulkDelete} disabled={bulkDeleting}
                    className="h-6 px-2.5 text-[10px] bg-red-600 hover:bg-red-700 text-white rounded-md font-bold">
                    {bulkDeleting ? "Deleting..." : "Confirm"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowConfirm(false)}
                    className="h-6 px-2 text-[10px] text-slate-500">Cancel</Button>
                </div>
              ) : (
                <Button size="sm" onClick={() => setShowConfirm(true)}
                  className="h-7 px-3 text-[10px] font-bold uppercase tracking-wider bg-red-600 hover:bg-red-700 text-white rounded-lg gap-1.5">
                  <Trash2 className="w-3 h-3" /> Delete Selected
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          {users.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>{userRoleFilter ? `No users with role ${userRoleFilter}.` : "No users found."}</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-[#fcfdfe] border-b border-slate-100">
                <tr>
                  <th className="pl-4 pr-2 py-2.5 w-10">
                    <button onClick={toggleAll} className="text-slate-400 hover:text-indigo-600 transition-colors">
                      {allSelected ? <CheckSquare className="w-4 h-4 text-indigo-600" /> :
                        someSelected ? (
                          <div className="w-4 h-4 border-2 border-slate-300 rounded flex items-center justify-center bg-white">
                            <div className="w-2 h-0.5 bg-slate-400 rounded-full" />
                          </div>
                        ) : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-center text-[9px] font-bold text-slate-400 uppercase tracking-widest">#</th>
                  <th className="px-4 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">User</th>
                  <th className="px-4 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">Email</th>
                  <th className="px-4 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">Credentials</th>
                  <th className="px-4 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">Role</th>
                  <th className="px-4 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">Company</th>
                  <th className="px-4 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-4 py-2.5 text-right text-[9px] font-bold text-slate-400 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {users.map((u, idx) => {
                  const isSelected = selectedIds.has(u._id);
                  const roleLabel = getRoleLabel(u);
                  const roleColor = getRoleColor(u);
                  return (
                    <tr key={u._id} className={`hover:bg-slate-50 transition-colors group ${isSelected ? "bg-indigo-50/40" : ""}`}>
                      {/* Checkbox */}
                      <td className="pl-4 pr-2 py-4">
                        <button onClick={() => toggleOne(u._id)} className="text-slate-400 hover:text-indigo-600 transition-colors">
                          {isSelected ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="px-3 py-4 text-center">
                        <span className="text-[10px] font-bold text-slate-400">
                          {(userPage - 1) * userPagination.limit + idx + 1}
                        </span>
                      </td>
                      {/* User */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold bg-indigo-600 text-[11px] shadow-md shadow-indigo-100 shrink-0">
                            {u.firstName?.[0]}{u.lastName?.[0]}
                          </div>
                          <div>
                            <div className="text-[11px] font-bold text-slate-800 leading-none">{u.firstName} {u.lastName}</div>
                            <div className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-tighter">{u.userId || u._id}</div>
                          </div>
                        </div>
                      </td>
                      {/* Email */}
                      <td className="px-4 py-4 whitespace-nowrap text-[11px] font-medium text-slate-600">{u.email}</td>
                      {/* Credentials */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <div className="text-[11px] font-bold text-indigo-600 tabular-nums">
                            {formatTo10Digits(u.phone || "")}
                          </div>
                          <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => togglePasswordVisibility(u._id)}>
                            <span className="text-[10px] font-mono text-slate-400 font-bold tracking-tight">
                              {u.rawPassword
                                ? visiblePasswords.includes(u._id) ? u.rawPassword : "••••••••"
                                : "••••••••"}
                            </span>
                            <button className="text-slate-300 hover:text-indigo-400 transition-colors">
                              {visiblePasswords.includes(u._id) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                          </div>
                        </div>
                      </td>
                      {/* Role */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] leading-none font-black rounded uppercase tracking-widest border ${roleColor}`}>
                          <Shield className="w-2.5 h-2.5" />
                          {roleLabel}
                        </span>
                      </td>
                      {/* Company */}
                      <td className="px-4 py-4 whitespace-nowrap text-[11px] font-bold text-slate-500">
                        {typeof u.companyId === "object" && u.companyId?.name ? u.companyId.name : u.companyId ? String(u.companyId) : "—"}
                      </td>
                      {/* Status */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <button
                          onClick={() => toggleUserStatus(u)}
                          className={`px-2 py-0.5 inline-flex text-[9px] uppercase tracking-widest font-black rounded-md transition-all border ${
                            u.isActive ? "bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100"
                          }`}
                        >
                          {u.isActive ? "Active" : "Suspended"}
                        </button>
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1 transition-opacity">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" onClick={() => handleEditUser(u)}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50" onClick={() => handleDeleteUser(u)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <Pagination
          currentPage={userPage}
          totalPages={userPagination.pages}
          totalItems={userPagination.total}
          itemsPerPage={userPagination.limit}
          onPageChange={setUserPage}
          className="shadow-none border-t border-slate-100 rounded-none bg-slate-50/30"
        />
      </CardContent>
    </Card>
  );
};

export default UserTabContent;
