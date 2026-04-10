"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, FileText, Download, UserPlus } from "lucide-react";
import { Grievance } from "@/lib/api/grievance";
import { formatTo10Digits } from "@/lib/utils/phoneUtils";

interface GrievanceListProps {
  grievances: Grievance[];
  filteredGrievances: Grievance[];
  selectedGrievances: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  exportToCSV: (data: any[], filename: string) => void;
  setSelectedGrievance: (g: Grievance) => void;
  setShowGrievanceDetail: (open: boolean) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  onAssign?: (g: Grievance) => void;
}

export default function GrievanceList({
  grievances,
  filteredGrievances,
  selectedGrievances,
  onSelectionChange,
  exportToCSV,
  setSelectedGrievance,
  setShowGrievanceDetail,
  onRefresh,
  refreshing,
  onAssign,
}: GrievanceListProps) {
  const allSelected =
    filteredGrievances.length > 0 &&
    filteredGrievances.every((g) => selectedGrievances.has(g._id));

  const toggleAll = () => {
    const next = new Set(selectedGrievances);
    if (allSelected) {
      filteredGrievances.forEach((g) => next.delete(g._id));
    } else {
      filteredGrievances.forEach((g) => next.add(g._id));
    }
    onSelectionChange(next);
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedGrievances);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectionChange(next);
  };

  return (
    <Card className="rounded-2xl border-slate-200 shadow-xl overflow-hidden bg-white text-left">
      <CardHeader className="flex flex-row items-center justify-between border-b bg-slate-50/50 px-6 py-4">
        <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-600 flex items-center gap-2">
          <FileText className="w-4 h-4 text-amber-500" />
          Grievance Registry
        </CardTitle>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={refreshing}
              className="h-8 w-8 p-0 border-slate-200 text-slate-400 hover:text-amber-600 hover:border-amber-200"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportToCSV(grievances, "grievances")}
            className="text-[10px] font-black uppercase tracking-wider"
          >
            <Download className="w-3.5 h-3.5 mr-2" />
            Export
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 whitespace-nowrap">
                <th className="px-6 py-4 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Sr. No.
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Incident ID
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Complainant
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Current Status
                </th>
                <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredGrievances.map((g, idx) => (
                <tr
                  key={g._id}
                  className={`group hover:bg-slate-50 transition-colors ${
                    selectedGrievances.has(g._id) ? "bg-amber-50/40" : ""
                  }`}
                >
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedGrievances.has(g._id)}
                      onChange={() => toggleOne(g._id)}
                      className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center justify-center w-7 h-7 bg-slate-100 text-slate-600 font-black text-[10px] rounded-lg group-hover:bg-amber-100 group-hover:text-amber-700 transition-colors">
                      {idx + 1}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-black text-indigo-600 text-sm">
                    {g.grievanceId}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <p className="font-bold text-slate-900 leading-none">
                        {g.citizenName}
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">
                        {formatTo10Digits(g.citizenPhone)}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${
                        g.status === "RESOLVED"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                          : "bg-amber-50 text-amber-700 border-amber-100"
                      }`}
                    >
                      {g.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedGrievance(g);
                          setShowGrievanceDetail(true);
                        }}
                        className="text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                      >
                        Review Case
                      </Button>
                      {onAssign && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onAssign(g)}
                          className="text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                        >
                          <UserPlus className="w-3.5 h-3.5 mr-1" />
                          Assign
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
