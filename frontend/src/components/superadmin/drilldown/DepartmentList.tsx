"use client";

import React, { useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Building,
  Upload,
  Download,
  ChevronRight,
  ArrowLeft,
  Trash2,
  CheckSquare,
  Square,
  AlertTriangle,
  RefreshCw,
  Search,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Department, departmentAPI } from "@/lib/api/department";
import toast from "react-hot-toast";

interface DepartmentListProps {
  departments: Department[];
  deptUserCounts?: Record<string, number>;
  setIsImportModalOpen: (open: boolean) => void;
  exportToCSV: (data: any[], filename: string) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  showPriorityColumn?: boolean;
  onTogglePriorityColumn?: (value: boolean) => void;
  priorityToggleSaving?: boolean;
  canEditPriority?: boolean;
  priorityDrafts?: Record<string, string>;
  savingPriorityIds?: Set<string>;
  onPriorityDraftChange?: (departmentId: string, value: string) => void;
  onSavePriority?: (department: Department) => void;
}

export default function DepartmentList({
  departments,
  deptUserCounts = {},
  setIsImportModalOpen,
  exportToCSV,
  onRefresh,
  refreshing,
  showPriorityColumn = true,
  onTogglePriorityColumn,
  priorityToggleSaving = false,
  canEditPriority = false,
  priorityDrafts = {},
  savingPriorityIds = new Set(),
  onPriorityDraftChange,
  onSavePriority,
}: DepartmentListProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredDepartments = departments.filter((d) =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.departmentId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const allSelected = filteredDepartments.length > 0 && selectedIds.size === filteredDepartments.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredDepartments.map((d) => d._id)));
    }
  }, [allSelected, filteredDepartments]);

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
    let ok = 0;
    let fail = 0;
    for (const id of Array.from(selectedIds)) {
      try {
        const res = await departmentAPI.delete(id);
        if (res.success) ok++;
        else fail++;
      } catch {
        fail++;
      }
    }
    setBulkDeleting(false);
    setSelectedIds(new Set());
    if (ok > 0) toast.success(`${ok} department(s) deleted`);
    if (fail > 0) toast.error(`${fail} department(s) could not be deleted`);
    onRefresh?.();
  };

  return (
    <Card className="rounded-2xl border-slate-200 shadow-xl overflow-hidden bg-white text-left">
      <CardHeader className="flex flex-row items-center justify-between border-b bg-slate-50/50 px-6 py-4">
        <div>
          <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-600 flex items-center gap-2">
            <Building className="w-4 h-4 text-indigo-500" />
            Organizational Chart
          </CardTitle>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={refreshing}
              className="h-8 w-8 p-0 border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsImportModalOpen(true)}
            className="bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-100 text-[14px] font-black uppercase tracking-wider"
            title="Upload Excel to create hierarchy"
          >
            <Upload className="w-3.5 h-3.5 mr-2" />
            Import
          </Button>
        </div>
      </CardHeader>

      {/* Search Bar */}
      <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/30">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search departments by name or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all bg-white"
          />
        </div>
      </div>

      {/* Bulk action bar */}
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
              className="h-7 text-[14px] font-bold uppercase tracking-wider border-indigo-200 text-indigo-600 hover:bg-indigo-100"
            >
              Deselect All
            </Button>
            {showConfirm ? (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                <span className="text-[14px] text-red-700 font-bold">Delete {selectedIds.size} depts?</span>
                <Button
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="h-6 px-2.5 text-[14px] bg-red-600 hover:bg-red-700 text-white rounded-md font-bold"
                >
                  {bulkDeleting ? "Deleting..." : "Confirm"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowConfirm(false)}
                  className="h-6 px-2 text-[14px] text-slate-500"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={() => setShowConfirm(true)}
                className="h-7 px-3 text-[14px] font-bold uppercase bg-red-600 hover:bg-red-700 text-white rounded-lg gap-1.5"
              >
                <Trash2 className="w-3 h-3" />
                Delete Selected
              </Button>
            )}
          </div>
        </div>
      )}

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 whitespace-nowrap">
                {/* Checkbox */}
                <th className="pl-6 pr-2 py-4 w-10">
                  <button
                    onClick={toggleAll}
                    className="text-slate-400 hover:text-indigo-600 transition-colors"
                    title={allSelected ? "Deselect all" : "Select all"}
                  >
                    {allSelected ? (
                      <CheckSquare className="w-4 h-4 text-indigo-600" />
                    ) : someSelected ? (
                      <div className="w-4 h-4 border-2 border-slate-300 rounded flex items-center justify-center bg-white">
                        <div className="w-2 h-0.5 bg-slate-400 rounded-full" />
                      </div>
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-4 text-[14px] font-black uppercase tracking-widest text-slate-500">Sr. No.</th>
                <th className="px-6 py-4 text-[14px] font-black uppercase tracking-widest text-slate-500">Department Name</th>
                <th className="px-6 py-4 text-[14px] font-black uppercase tracking-widest text-slate-500 text-center">Type</th>
                <th className="px-6 py-4 text-[14px] font-black uppercase tracking-widest text-slate-500 text-center">Users</th>
                <th className="px-6 py-4 text-[14px] font-black uppercase tracking-widest text-slate-500 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <span>Priority</span>
                    {onTogglePriorityColumn && (
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={showPriorityColumn}
                          onCheckedChange={onTogglePriorityColumn}
                          disabled={priorityToggleSaving}
                          aria-label="Toggle company admin priority column visibility"
                        />
                        <span className="text-[15px] font-bold normal-case tracking-normal text-slate-400">
                          {showPriorityColumn ? "Visible to company admin" : "Hidden from company admin"}
                        </span>
                      </div>
                    )}
                  </div>
                </th>
                <th className="px-6 py-4 text-[14px] font-black uppercase tracking-widest text-slate-500">Hierarchy</th>
                <th className="px-6 py-4 text-[14px] font-black uppercase tracking-widest text-slate-500">Internal ID</th>
                <th className="px-6 py-4 text-right text-[14px] font-black uppercase tracking-widest text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDepartments.map((d, idx) => {
                const isSelected = selectedIds.has(d._id);
                const userCount = deptUserCounts[d._id] || 0;
                const isMain = !d.parentDepartmentId;
                return (
                  <tr
                    key={d._id}
                    className={`group hover:bg-slate-50 transition-colors ${isSelected ? "bg-indigo-50/40" : ""}`}
                  >
                    <td className="pl-6 pr-2 py-4">
                      <button
                        onClick={() => toggleOne(d._id)}
                        className="text-slate-400 hover:text-indigo-600 transition-colors"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center justify-center w-7 h-7 bg-slate-100 text-slate-600 font-black text-[14px] rounded-lg group-hover:bg-indigo-100 group-hover:text-indigo-700 transition-colors">
                        {idx + 1}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {d.name}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[15px] font-black uppercase tracking-widest border ${
                        isMain ? "bg-indigo-50 text-indigo-700 border-indigo-100" : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}>
                        {isMain ? "Main Department" : "Sub Department"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-black ${
                        userCount > 0 ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-slate-50 text-slate-400 border border-slate-100"
                      }`}>
                        {userCount}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {isMain ? (
                        canEditPriority ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={
                                priorityDrafts[d._id] ??
                                String(d.displayOrder ?? 999)
                              }
                              onChange={(e) =>
                                onPriorityDraftChange?.(d._id, e.target.value)
                              }
                              className="w-16 h-8 rounded-lg border border-slate-300 px-2 text-center text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                              title="Lower number appears first in chatbot list"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-[14px] font-black text-indigo-600 hover:bg-indigo-50 disabled:opacity-60"
                              onClick={() => onSavePriority?.(d)}
                              disabled={savingPriorityIds.has(d._id)}
                              title="Save priority"
                            >
                              {savingPriorityIds.has(d._id)
                                ? "Saving..."
                                : "Save"}
                            </Button>
                          </div>
                        ) : (
                          <span className="inline-flex items-center justify-center min-w-[42px] h-8 rounded-lg border border-amber-200 bg-amber-50 px-2 text-xs font-black text-amber-700">
                            {typeof d.displayOrder === "number"
                              ? d.displayOrder
                              : 999}
                          </span>
                        )
                      ) : (
                        <span className="text-[14px] font-bold text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {d.parentDepartmentId ? (
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[15px] font-bold border border-slate-200 uppercase">
                            Sub Unit
                          </span>
                          <ChevronRight className="w-3 h-3 text-slate-300" />
                          <span className="text-[14px] font-bold text-slate-400 capitalize">
                            {typeof d.parentDepartmentId === "object"
                              ? (d.parentDepartmentId as any).name
                              : "Main"}
                          </span>
                        </div>
                      ) : (
                        <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[15px] font-black border border-indigo-100 uppercase">
                          Main Dept
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-[14px] text-slate-400 font-bold">
                      {d.departmentId}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/superadmin/department/${d._id}`)}
                        className="text-[14px] font-black uppercase tracking-wider text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                      >
                        Configuration
                        <ArrowLeft className="w-3.5 h-3.5 ml-2 rotate-180" />
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
