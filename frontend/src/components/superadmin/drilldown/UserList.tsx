"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Download } from "lucide-react";
import { User, userAPI } from "@/lib/api/user";
import { formatRoleLabel } from "@/lib/utils/roleLabel";
import { RefreshCw, CheckSquare, Square, Trash2, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";

interface UserListProps {
  users: User[];
  filteredUsers: User[];
  exportToCSV: (data: any[], filename: string) => void;
  setSelectedUserForDetails: (user: User) => void;
  setShowUserDetailsDialog: (open: boolean) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export default function UserList({
  users,
  filteredUsers,
  exportToCSV,
  setSelectedUserForDetails,
  setShowUserDetailsDialog,
  onRefresh,
  refreshing,
}: UserListProps) {
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
    let successCount = 0;
    let failCount = 0;
    for (const id of Array.from(selectedIds)) {
      try {
        const res = await userAPI.delete(id);
        if (res.success) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }
    setBulkDeleting(false);
    setSelectedIds(new Set());
    if (successCount > 0) toast.success(`${successCount} user(s) deleted successfully`);
    if (failCount > 0) toast.error(`${failCount} user(s) could not be deleted`);
    onRefresh?.();
  };
  return (
    <Card className="rounded-2xl border-slate-200 shadow-xl overflow-hidden bg-white">
      <CardHeader className="flex flex-row items-center justify-between border-b bg-slate-50/50 px-6 py-4">
        <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-600 flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-500" />
          Team Directory
        </CardTitle>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={refreshing}
              className="h-8 w-8 p-0 border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportToCSV(users, "users")}
            className="text-[10px] font-black uppercase tracking-wider"
          >
            <Download className="w-3.5 h-3.5 mr-2" />
            Export
          </Button>
        </div>
      </CardHeader>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="px-6 py-2.5 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-black text-indigo-700">{selectedIds.size} selected</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              className="h-7 text-[10px] font-bold uppercase tracking-wider border-indigo-200 text-indigo-600 hover:bg-indigo-100"
            >
              Deselect All
            </Button>
            {showBulkConfirm ? (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                <span className="text-[10px] text-red-700 font-bold">Delete {selectedIds.size} users?</span>
                <Button
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="h-6 px-2.5 text-[10px] bg-red-600 hover:bg-red-700 text-white rounded-md font-bold"
                >
                  {bulkDeleting ? "Deleting..." : "Confirm"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowBulkConfirm(false)}
                  className="h-6 px-2 text-[10px] text-slate-500"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={() => setShowBulkConfirm(true)}
                className="h-7 px-3 text-[10px] font-bold uppercase bg-red-600 hover:bg-red-700 text-white rounded-lg gap-1.5"
              >
                <Trash2 className="w-3 h-3" />
                Delete Selected
              </Button>
            )}
          </div>
        </div>
      )}
      <CardContent className="p-0 text-left">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 whitespace-nowrap">
                <th className="pl-6 pr-2 py-4 w-10">
                  <button
                    onClick={toggleAll}
                    className="text-slate-400 hover:text-blue-600 transition-colors"
                    title={allSelected ? "Deselect all" : "Select all"}
                  >
                    {allSelected ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : someSelected ? (
                      <div className="w-4 h-4 border-2 border-slate-300 rounded flex items-center justify-center bg-white">
                        <div className="w-2 h-0.5 bg-slate-400 rounded-full" />
                      </div>
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Sr. No.
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Identity
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Privileges
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Status
                </th>
                <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((u, idx) => {
                const roleLabel =
                  typeof u.customRoleId === "object" && u.customRoleId
                    ? (u.customRoleId as any).name
                    : formatRoleLabel(u.role);

                return (
                  <tr
                    key={u._id}
                    className={`group hover:bg-slate-50 transition-colors ${selectedIds.has(u._id) ? "bg-blue-50/40" : ""}`}
                  >
                    <td className="pl-6 pr-2 py-4">
                      <button
                        onClick={() => toggleOne(u._id)}
                        className="text-slate-400 hover:text-blue-600 transition-colors"
                      >
                        {selectedIds.has(u._id) ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center justify-center w-7 h-7 bg-slate-100 text-slate-600 font-black text-[10px] rounded-lg group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors">
                        {idx + 1}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <p className="font-black text-slate-900 leading-none">
                          {u.fullName || `${u.firstName} ${u.lastName}`}
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">
                          {u.email}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${
                          u.role === "SUPER_ADMIN"
                            ? "bg-red-50 text-red-700 border-red-100"
                            : "bg-indigo-50 text-indigo-700 border-indigo-100"
                        }`}
                      >
                        {u.role === "SUPER_ADMIN" ? "Super Admin" : roleLabel}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${
                          u.isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${u.isActive ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`}
                        ></span>
                        {u.isActive ? "Verified" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedUserForDetails(u);
                          setShowUserDetailsDialog(true);
                        }}
                        className="text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                      >
                        Details
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
