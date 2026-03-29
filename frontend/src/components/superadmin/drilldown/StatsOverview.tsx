"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  Building,
  FileText,
  Calendar,
  Workflow,
  Clock,
  CheckCircle,
  TrendingUp,
} from "lucide-react";

import { Module } from "@/lib/permissions";

interface StatsOverviewProps {
  stats: any;
  company: any;
  setActiveTab: (tab: string) => void;
}

export default function StatsOverview({
  stats,
  company,
  setActiveTab,
}: StatsOverviewProps) {
  const isGrievanceEnabled = !company || company?.enabledModules?.includes(Module.GRIEVANCE);
  const isAppointmentEnabled = !company || company?.enabledModules?.includes(Module.APPOINTMENT);
  const isLeadEnabled = !company || company?.enabledModules?.includes(Module.LEAD_CAPTURE);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card
        onClick={() => setActiveTab("users")}
        className="group cursor-pointer hover:shadow-2xl transition-all duration-300 border-slate-200 hover:border-blue-300 bg-white overflow-hidden relative"
      >
        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-bl-full group-hover:bg-blue-500/10 transition-colors"></div>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 relative">
          <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Total Users
          </CardTitle>
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Users className="w-4 h-4 text-blue-600" />
          </div>
        </CardHeader>
        <CardContent className="relative">
          <div className="text-3xl font-black text-slate-900 leading-none">
            {stats.totalUsers}
          </div>
          <div className="flex items-center gap-2 mt-4">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest">
              {stats.activeUsers} Active Now
            </p>
          </div>
        </CardContent>
      </Card>

      <Card
        onClick={() => setActiveTab("departments")}
        className="group cursor-pointer hover:shadow-2xl transition-all duration-300 border-slate-200 hover:border-indigo-300 bg-white overflow-hidden relative"
      >
        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full group-hover:bg-indigo-500/10 transition-colors"></div>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 relative">
          <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Total Departments
          </CardTitle>
          <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Building className="w-4 h-4 text-indigo-600" />
          </div>
        </CardHeader>
        <CardContent className="relative">
          <div className="text-3xl font-black text-slate-900 leading-none">
            {stats.totalDepartments}
          </div>
          <p className="text-[10px] text-slate-400 font-bold mt-4 uppercase tracking-widest flex items-center gap-1.5">
            <Workflow className="w-3 h-3" /> Organizational Departments
          </p>
        </CardContent>
      </Card>

      {isGrievanceEnabled && (
      <Card
        onClick={() => setActiveTab("grievances")}
        className="group cursor-pointer hover:shadow-2xl transition-all duration-300 border-slate-200 hover:border-amber-300 bg-white overflow-hidden relative"
      >
        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-bl-full group-hover:bg-amber-500/10 transition-colors"></div>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 relative">
          <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Grievances
          </CardTitle>
          <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <FileText className="w-4 h-4 text-amber-600" />
          </div>
        </CardHeader>
        <CardContent className="relative">
          <div className="text-3xl font-black text-slate-900 leading-none">
            {stats.totalGrievances}
          </div>
          <div className="flex items-center gap-3 mt-4">
            <div className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
              <Clock className="w-3 h-3 text-amber-600" />
              <span className="text-[9px] text-amber-600 font-black uppercase tracking-tighter">
                {stats.pendingGrievances} Pending
              </span>
            </div>
            <div className="flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
              <CheckCircle className="w-3 h-3 text-emerald-600" />
              <span className="text-[9px] text-emerald-600 font-black uppercase tracking-tighter">
                {stats.resolvedGrievances} Solved
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      {isAppointmentEnabled && (
      <Card
        onClick={() => setActiveTab("appointments")}
        className="group cursor-pointer hover:shadow-2xl transition-all duration-300 border-slate-200 hover:border-emerald-300 bg-white overflow-hidden relative"
      >
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full group-hover:bg-emerald-500/10 transition-colors"></div>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 relative">
          <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Appointments
          </CardTitle>
          <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Calendar className="w-4 h-4 text-emerald-600" />
          </div>
        </CardHeader>
        <CardContent className="relative">
          <div className="text-3xl font-black text-slate-900 leading-none">
            {stats.totalAppointments}
          </div>
          <p className="text-[10px] text-slate-400 font-bold mt-4 uppercase tracking-widest flex items-center gap-1.5">
            <TrendingUp className="w-3 h-3" /> Scheduled Engagement
          </p>
        </CardContent>
      </Card>
      )}

      {isLeadEnabled && (
        <Card
          onClick={() => setActiveTab("leads")}
          className="group cursor-pointer hover:shadow-2xl transition-all duration-300 border-slate-200 hover:border-indigo-300 bg-white overflow-hidden relative"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full group-hover:bg-indigo-500/10 transition-colors"></div>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 relative">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Project Leads
            </CardTitle>
            <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Building className="w-4 h-4 text-indigo-600" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-black text-slate-900 leading-none">
              {stats.totalLeads || 0}
            </div>
            <p className="text-[10px] text-slate-400 font-bold mt-4 uppercase tracking-widest flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3" /> Potential Leads
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
