import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { User, userAPI } from "@/lib/api/user";
import { formatRoleLabel } from "@/lib/utils/roleLabel";
import { isSuperAdmin } from "@/lib/permissions";
import { Users, Search, Download, ArrowUpDown, RefreshCw, CheckSquare, Square, Trash2, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";

interface DeptUserListProps {
  filteredUsers: User[];
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  roleFilter: string;
  setRoleFilter: (val: string) => void;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  handleSort: (key: string) => void;
  exportToCSV: (data: any[], filename: string) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}

const DeptUserList: React.FC<DeptUserListProps> = ({
  filteredUsers,
  searchTerm,
  setSearchTerm,
  roleFilter,
  setRoleFilter,
  statusFilter,
  setStatusFilter,
  handleSort,
  exportToCSV,
  onRefresh,
  refreshing,
}) => {
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = React.useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = React.useState(false);

  const allSelected = filteredUsers.length > 0 && selectedIds.size === filteredUsers.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleAll = React.useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredUsers.map((u) => u._id)));
    }
  }, [allSelected, filteredUsers]);

  const toggleOne = React.useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    setShowBulkConfirm(false);
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
    if (ok > 0) toast.success(`${ok} user(s) removed`);
    if (fail > 0) toast.error(`${fail} user(s) could not be removed`);
    onRefresh?.();
  };
  return (
    <Card className="rounded-2xl border-0 shadow-xl overflow-hidden bg-white/80 backdrop-blur-sm">
      <CardHeader className="bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 text-white px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-white">
                Users ({filteredUsers.length})
              </CardTitle>
              <CardDescription className="text-emerald-100 font-medium">
                Team directory and synchronization status
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={refreshing}
                className="p-2.5 bg-white/20 text-white rounded-xl hover:bg-white/30 transition-all border border-white/30 disabled:opacity-50"
                title="Refresh Team Data"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              </button>
            )}
            <button
              onClick={() => exportToCSV(filteredUsers, "users")}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 text-white rounded-xl hover:bg-white/30 transition-all border border-white/30"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>
      </CardHeader>

      {/* Filters */}
      <div className="px-6 py-4 bg-white/50 border-b border-slate-200">
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full sm:w-auto px-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Roles</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto px-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="px-6 py-2.5 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            <CheckSquare className="w-5 h-5 text-emerald-600" />
            <span className="text-sm font-black text-emerald-900 uppercase tracking-tighter">
              {selectedIds.size} selection(s) active
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="h-8 px-4 text-[10px] font-bold uppercase tracking-widest border border-emerald-200 text-emerald-700 hover:bg-emerald-100 rounded-xl transition-all"
            >
              Clear
            </button>
            {showBulkConfirm ? (
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-1.5 shadow-sm">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span className="text-[10px] text-red-700 font-black uppercase tracking-widest">Perform Mass Removal?</span>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="h-7 px-4 text-[10px] bg-red-600 hover:bg-red-700 text-white rounded-lg font-black uppercase tracking-widest shadow-lg shadow-red-200 disabled:opacity-50"
                >
                  {bulkDeleting ? "Executing..." : "Confirm"}
                </button>
                <button
                  onClick={() => setShowBulkConfirm(false)}
                  className="h-7 px-3 text-[10px] text-slate-500 font-bold uppercase"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowBulkConfirm(true)}
                className="h-8 px-4 text-[10px] font-black uppercase tracking-widest bg-red-600 hover:bg-red-700 text-white rounded-xl flex items-center gap-2 shadow-lg shadow-red-200 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Mass Delete
              </button>
            )}
          </div>
        </div>
      )}

      <CardContent className="p-0">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No users found</p>
          </div>
        ) : (
          <>
            <div className="md:hidden space-y-3 p-4">
              {filteredUsers.map((u, index) => (
                <div
                  key={u._id}
                  className={`rounded-xl border border-emerald-100 p-4 space-y-3 bg-gradient-to-r from-emerald-50/60 to-green-50/60 ${selectedIds.has(u._id) ? "ring-2 ring-emerald-400" : ""}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <button
                      onClick={() => toggleOne(u._id)}
                      className="text-emerald-400 hover:text-emerald-600 transition-colors"
                    >
                      {selectedIds.has(u._id) ? (
                        <CheckSquare className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 text-emerald-700 text-xs font-bold">
                      {index + 1}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-green-500 rounded-xl flex items-center justify-center text-white font-bold shadow-sm">
                      {u.firstName?.[0]}
                      {u.lastName?.[0]}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">
                        {u.firstName} {u.lastName}
                      </p>
                      <p className="text-xs text-gray-500">{u.userId}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 break-all">{u.email}</p>
                  <div className="flex items-center justify-between gap-3">
                    {(() => {
                      const roleLabel =
                        typeof u.customRoleId === "object" && u.customRoleId
                          ? (u.customRoleId as any).name
                          : formatRoleLabel(u.role);

                      return (
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                            isSuperAdmin(u)
                              ? "bg-red-50 text-red-700 border-red-100"
                              : "bg-emerald-50 text-emerald-700 border-emerald-100"
                          }`}
                        >
                          {isSuperAdmin(u) ? "Super Admin" : roleLabel}
                        </span>
                      );
                    })()}
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${u.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}
                    >
                      {u.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-emerald-50 via-green-50 to-teal-50 border-b border-emerald-100">
                <tr>
                  <th className="pl-6 pr-2 py-4 w-10">
                    <button
                      onClick={toggleAll}
                      className="text-emerald-400 hover:text-emerald-600 transition-colors"
                      title={allSelected ? "Deselect all" : "Select all"}
                    >
                      {allSelected ? (
                        <CheckSquare className="w-5 h-5 text-emerald-600" />
                      ) : someSelected ? (
                        <div className="w-5 h-5 border-2 border-emerald-300 rounded-lg flex items-center justify-center bg-white">
                          <div className="w-2.5 h-0.5 bg-emerald-400 rounded-full" />
                        </div>
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 py-4 text-center text-[11px] font-bold text-emerald-700 uppercase">
                    Sr. No.
                  </th>
                  <th className="px-6 py-4 text-left">
                    <button
                      onClick={() => handleSort("firstName")}
                      className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 uppercase hover:text-emerald-800"
                    >
                      User <ArrowUpDown className="w-3.5 h-3.5" />
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-emerald-700 uppercase">
                    Email
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-emerald-700 uppercase">
                    Role
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-emerald-700 uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u, index) => (
                  <tr
                    key={u._id}
                    className={`hover:bg-gradient-to-r hover:from-emerald-50/50 hover:to-green-50/50 transition-all ${selectedIds.has(u._id) ? "bg-emerald-50/60" : ""}`}
                  >
                    <td className="pl-6 pr-2 py-4">
                      <button
                        onClick={() => toggleOne(u._id)}
                        className="text-emerald-400 hover:text-emerald-600 transition-colors"
                      >
                        {selectedIds.has(u._id) ? (
                          <CheckSquare className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                    </td>
                    <td className="px-3 py-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 text-emerald-700 text-xs font-bold">
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-green-500 rounded-xl flex items-center justify-center text-white font-bold shadow-sm">
                          {u.firstName?.[0]}
                          {u.lastName?.[0]}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">
                            {u.firstName} {u.lastName}
                          </p>
                          <p className="text-xs text-gray-500">{u.userId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {u.email}
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const roleLabel =
                          typeof u.customRoleId === "object" && u.customRoleId
                            ? (u.customRoleId as any).name
                            : formatRoleLabel(u.role);

                        return (
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                              isSuperAdmin(u)
                                ? "bg-red-50 text-red-700 border-red-100"
                                : "bg-emerald-50 text-emerald-700 border-emerald-100"
                            }`}
                          >
                            {isSuperAdmin(u) ? "Super Admin" : roleLabel}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${u.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}
                      >
                        {u.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default DeptUserList;
