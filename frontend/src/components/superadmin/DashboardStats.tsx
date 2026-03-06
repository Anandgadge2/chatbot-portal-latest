import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building,
  Users,
  Settings,
  Activity,
  ChevronRight,
} from "lucide-react";

interface DashboardStatsProps {
  stats: {
    companies: number;
    users: number;
    departments: number;
    activeCompanies: number;
    activeUsers: number;
    totalSessions: number;
  };
  setActiveTab: (tab: string) => void;
}

const DashboardStats: React.FC<DashboardStatsProps> = ({
  stats,
  setActiveTab,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Companies */}
      <Card
        className="group relative overflow-hidden bg-white border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer rounded-2xl"
        onClick={() => setActiveTab("companies")}
      >
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <Building className="w-24 h-24 text-blue-600 -mr-8 -mt-8 rotate-12" />
        </div>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-slate-500 text-[10px] font-black uppercase tracking-widest flex items-center justify-between">
            <span className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-600">
                <Building className="w-4 h-4" />
              </div>
              Organizations
            </span>
            <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-black text-slate-900 tracking-tighter">
              {stats.companies}
            </p>
            <span className="text-[10px] font-bold text-slate-400">
              Entities
            </span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{
                  width: `${stats.companies > 0 ? (stats.activeCompanies / stats.companies) * 100 : 0}%`,
                }}
              />
            </div>
            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 uppercase">
              {stats.activeCompanies} Active
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Total Users */}
      <Card
        className="group relative overflow-hidden bg-white border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer rounded-2xl"
        onClick={() => setActiveTab("users")}
      >
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <Users className="w-24 h-24 text-emerald-600 -mr-8 -mt-8 -rotate-12" />
        </div>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-slate-500 text-[10px] font-black uppercase tracking-widest flex items-center justify-between">
            <span className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-600">
                <Users className="w-4 h-4" />
              </div>
              Total Users
            </span>
            <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-black text-slate-900 tracking-tighter">
              {stats.users}
            </p>
            <span className="text-[10px] font-bold text-slate-400">Total</span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{
                  width: `${stats.users > 0 ? (stats.activeUsers / stats.users) * 100 : 0}%`,
                }}
              />
            </div>
            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 uppercase">
              {stats.activeUsers} Live
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Departments */}
      <Card
        className="group relative overflow-hidden bg-white border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer rounded-2xl"
        onClick={() => setActiveTab("departments")}
      >
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <Settings className="w-24 h-24 text-purple-600 -mr-8 -mt-8 rotate-45" />
        </div>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-slate-500 text-[10px] font-black uppercase tracking-widest flex items-center justify-between">
            <span className="flex items-center gap-2">
              <div className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center text-purple-600">
                <Settings className="w-4 h-4" />
              </div>
              Departments
            </span>
            <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-purple-500 group-hover:translate-x-1 transition-all" />
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <p className="text-3xl font-black text-slate-900 tracking-tighter">
            {stats.departments}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div>
            <span className="text-[10px] font-black text-purple-600 uppercase">
              Units Monitored
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Activity */}
      <Card className="group relative overflow-hidden bg-white border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 rounded-2xl">
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <Activity className="w-24 h-24 text-amber-600 -mr-8 -mt-8 -rotate-12" />
        </div>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-slate-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center text-amber-600">
              <Activity className="w-4 h-4" />
            </div>
            Real-time Flow
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <p className="text-3xl font-black text-slate-900 tracking-tighter">
            {stats.totalSessions}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-1.5 h-3 bg-amber-200 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.1}s` }}
                ></div>
              ))}
            </div>
            <span className="text-[10px] font-black text-amber-600 uppercase">
              Active Sessions
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardStats;
