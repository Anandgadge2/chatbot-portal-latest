"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, UserPlus, Phone, Mail, Key } from "lucide-react";
import { TableSkeleton } from "@/components/ui/GeneralSkeleton";

export interface Lead {
  _id: string;
  leadId: string;
  name: string;
  companyName?: string;
  projectType: string;
  projectDescription: string;
  budgetRange: string;
  timeline: string;
  contactInfo: string;
  email?: string;
  status: string;
  createdAt: string;
}

interface LeadListProps {
  leads: Lead[];
  loadingLeads: boolean;
  fetchLeads: () => void;
}

export default function LeadList({ leads, loadingLeads, fetchLeads }: LeadListProps) {
  return (
    <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
      <CardHeader className="bg-slate-900 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
              <UserPlus className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-white uppercase tracking-tight">
                Project Leads
              </CardTitle>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                Manage and track potential business opportunities
              </p>
            </div>
          </div>
          <Button
            onClick={() => fetchLeads()}
            variant="outline"
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 h-8 text-[10px] font-bold uppercase tracking-wider"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 mr-2 ${loadingLeads ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loadingLeads ? (
          <TableSkeleton rows={8} cols={6} />
        ) : leads.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <UserPlus className="w-10 h-10 text-blue-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">
              No leads found
            </h3>
            <p className="text-slate-500 mt-1 max-w-xs mx-auto">
              When customers interact with your lead generation
              flow, they will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Lead Info
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Project
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Budget/Timeline
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.map((lead) => (
                  <tr
                    key={lead._id}
                    className="hover:bg-slate-50/50 transition-colors group"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">
                          {lead.name}
                        </span>
                        <span className="text-xs text-slate-500">
                          {lead.companyName || "Individual"}
                        </span>
                        <span className="text-[10px] text-blue-500 font-mono mt-1">
                          {lead.leadId}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col max-w-[200px]">
                        <span className="text-sm font-semibold text-slate-700">
                          {lead.projectType}
                        </span>
                        <span className="text-xs text-slate-500 truncate">
                          {lead.projectDescription}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-slate-700">
                          Budget: {lead.budgetRange || "N/A"}
                        </span>
                        <span className="text-xs text-slate-500">
                          Timeline: {lead.timeline || "N/A"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm text-slate-700 flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          {lead.contactInfo}
                        </span>
                        {lead.email && (
                          <span className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            {lead.email}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 uppercase">
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 rounded-lg"
                      >
                        <Key className="w-4 h-4 text-slate-400" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
