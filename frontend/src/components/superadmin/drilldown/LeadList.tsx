"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, TrendingUp, Download } from "lucide-react";

interface LeadListProps {
  leads: any[];
  exportToCSV: (data: any[], filename: string) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export default function LeadList({
  leads,
  exportToCSV,
  onRefresh,
  refreshing,
}: LeadListProps) {
  return (
    <Card className="rounded-2xl border-slate-200 shadow-xl overflow-hidden bg-white text-left">
      <CardHeader className="flex flex-row items-center justify-between border-b bg-slate-50/50 px-6 py-4">
        <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-600 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-500" />
          Commercial Opportunities
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
            onClick={() => exportToCSV(leads, "leads")}
            className="text-[14px] font-black uppercase tracking-wider"
          >
            <Download className="w-3.5 h-3.5 mr-2" />
            Export
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 whitespace-nowrap">
              <th className="px-6 py-4 text-[14px] font-black uppercase tracking-widest text-slate-500">
                Sr. No.
              </th>
              <th className="px-6 py-4 text-[14px] font-black uppercase tracking-widest text-slate-500">
                Lead Profile
              </th>
              <th className="px-6 py-4 text-[14px] font-black uppercase tracking-widest text-slate-500">
                Project Type
              </th>
              <th className="px-6 py-4 text-right text-[14px] font-black uppercase tracking-widest text-slate-500">
                Lead Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((lead, idx) => (
              <tr
                key={lead._id}
                className="group hover:bg-slate-50 transition-colors"
              >
                <td className="px-6 py-4">
                  <span className="inline-flex items-center justify-center w-7 h-7 bg-slate-100 text-slate-600 font-black text-[14px] rounded-lg group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors">
                    {idx + 1}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <p className="font-bold text-slate-900 leading-none">
                      {lead.name}
                    </p>
                    <p className="text-[14px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">
                      {lead.companyName || lead.contactInfo}
                    </p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[14px] font-black border border-blue-100 uppercase tracking-tighter">
                    {lead.projectType}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="px-2 py-0.5 bg-slate-900 text-white rounded-md text-[15px] font-black uppercase tracking-widest shadow-md">
                    {lead.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
