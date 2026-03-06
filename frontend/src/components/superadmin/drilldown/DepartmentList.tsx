"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Building,
  Plus,
  Download,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Department } from "@/lib/api/department";

interface DepartmentListProps {
  departments: Department[];
  setIsImportModalOpen: (open: boolean) => void;
  exportToCSV: (data: any[], filename: string) => void;
}

export default function DepartmentList({
  departments,
  setIsImportModalOpen,
  exportToCSV,
}: DepartmentListProps) {
  const router = useRouter();

  return (
    <Card className="rounded-2xl border-slate-200 shadow-xl overflow-hidden bg-white">
      <CardHeader className="flex flex-row items-center justify-between border-b bg-slate-50/50 px-6 py-4">
        <div>
          <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-600 flex items-center gap-2">
            <Building className="w-4 h-4 text-indigo-500" />
            Organizational Chart
          </CardTitle>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsImportModalOpen(true)}
            className="bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-100 text-[10px] font-black uppercase tracking-wider"
          >
            <Plus className="w-3.5 h-3.5 mr-2" />
            Import Departments
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportToCSV(departments, "departments")}
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
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Sr. No.
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Department Name
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Hierarchy
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Internal ID
                </th>
                <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {departments.map((d, idx) => (
                <tr
                  key={d._id}
                  className="group hover:bg-slate-50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center justify-center w-7 h-7 bg-slate-100 text-slate-600 font-black text-[10px] rounded-lg group-hover:bg-indigo-100 group-hover:text-indigo-700 transition-colors">
                      {idx + 1}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                      {d.name}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    {d.parentDepartmentId ? (
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-bold border border-slate-200 uppercase">
                          Sub Unit
                        </span>
                        <ChevronRight className="w-3 h-3 text-slate-300" />
                        <span className="text-[10px] font-bold text-slate-400 capitalize">
                          {typeof d.parentDepartmentId === "object"
                            ? (d.parentDepartmentId as any).name
                            : "Main"}
                        </span>
                      </div>
                    ) : (
                      <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[9px] font-black border border-indigo-100 uppercase">
                        Main Dept
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 font-mono text-[10px] text-slate-400 font-bold">
                    {d.departmentId}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        router.push(`/superadmin/department/${d._id}`)
                      }
                      className="text-[10px] font-black uppercase tracking-wider text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                    >
                      Configuration
                      <ArrowLeft className="w-3.5 h-3.5 ml-2 rotate-180" />
                    </Button>
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
