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
  };
  setActiveTab: (tab: string) => void;
}

const DashboardStats: React.FC<DashboardStatsProps> = ({
  stats,
  setActiveTab,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {/* Total Companies */}
      <Card
        className="group relative overflow-hidden bg-white border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer rounded-2xl"
        onClick={() => setActiveTab("companies")}
      >
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <Building className="w-24 h-24 text-blue-600 -mr-8 -mt-8 rotate-12" />
        </div>
        <CardHeader className="p-3 sm:p-4 pb-1 sm:pb-2">
          <CardTitle className="text-slate-500 text-[11px] sm:text-[14px] font-black uppercase tracking-widest flex items-center justify-between">
            <span className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-600">
                <Building className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              Organizations
            </span>
            <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 pt-0">
          <div className="flex items-baseline gap-1.5 sm:gap-2">
            <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tighter leading-none">
              {stats.companies}
            </p>
            <span className="text-[11px] sm:text-[14px] font-bold text-slate-400 uppercase tracking-tight">
              Entities
            </span>
          </div>
          <div className="mt-2.5 sm:mt-3 flex items-center gap-2">
            <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{
                  width: `${stats.companies > 0 ? (stats.activeCompanies / stats.companies) * 100 : 0}%`,
                }}
              />
            </div>
            <span className="text-[10px] sm:text-[14px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-100 uppercase tracking-tighter">
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
        <CardHeader className="p-3 sm:p-4 pb-1 sm:pb-2">
          <CardTitle className="text-slate-500 text-[11px] sm:text-[14px] font-black uppercase tracking-widest flex items-center justify-between">
            <span className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-600">
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              Total Users
            </span>
            <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 pt-0">
          <div className="flex items-baseline gap-1.5 sm:gap-2">
            <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tighter leading-none">
              {stats.users}
            </p>
            <span className="text-[11px] sm:text-[14px] font-bold text-slate-400 uppercase tracking-tight">Total</span>
          </div>
          <div className="mt-2.5 sm:mt-3 flex items-center gap-2">
            <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{
                  width: `${stats.users > 0 ? (stats.activeUsers / stats.users) * 100 : 0}%`,
                }}
              />
            </div>
            <span className="text-[10px] sm:text-[14px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-100 uppercase tracking-tighter">
              {stats.activeUsers} Live
            </span>
          </div>
        </CardContent>
      </Card>




    </div>
  );
};

export default DashboardStats;
