"use client";

import { 
  BarChart2, 
  Activity, 
  FileText, 
  Clock, 
  CheckCircle2, 
  Zap, 
  CalendarClock, 
  TrendingUp, 
  Users, 
  AlertCircle,
  PieChart as PieChartIcon,
  CalendarCheck,
  Building
} from "lucide-react";
import { TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Module, hasModule } from "@/lib/permissions";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar 
} from "recharts";

interface AnalyticsTabProps {
  user: any;
  company: any;
  stats: any;
  loadingStats: boolean;
  isCompanyLevel: boolean;
  isDepartmentLevel: boolean;
  setActiveTab: (tab: string) => void;
  setGrievanceFilters: (fn: (prev: any) => any) => void;
  setAppointmentFilters: (fn: (prev: any) => any) => void;
  appointments: any[];
  users: any[];
  departments: any[];
  departmentData: any[];
  router: any;
}

export default function AnalyticsTab({
  user,
  company,
  stats,
  loadingStats,
  isCompanyLevel,
  isDepartmentLevel,
  setActiveTab,
  setGrievanceFilters,
  setAppointmentFilters,
  appointments,
  users,
  departments,
  departmentData,
  router
}: AnalyticsTabProps) {
  return (
    <TabsContent value="analytics" className="space-y-4">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-4 border border-slate-800 shadow-lg mb-4">
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        ></div>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30 backdrop-blur-md shadow-inner">
              <BarChart2 className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2 tracking-tight">
                <Activity className="w-5 h-5 text-indigo-400 animate-pulse" />
                {isCompanyLevel
                  ? "Operational Intelligence Dashboard"
                  : isDepartmentLevel
                    ? "Departmental Analytics Hub"
                    : "Operations Analytics Center"}
              </h2>
              <p className="text-slate-300 text-xs mt-1 font-medium opacity-80 leading-relaxed">
                {isCompanyLevel
                  ? stats?.isHierarchicalEnabled 
                    ? `Comprehensive analysis across ${stats?.mainDepartments || 0} main departments, ${stats?.subDepartments || 0} sub-divisions and ${stats?.users || users.length} personnel`
                    : `Visualizing operational health across ${stats?.departments || departments.length} departments and ${stats?.users || users.length} personnel`
                  : `Monitoring real-time performance for your assigned department and ${users.length} staff`}
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                Live Metrics
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div
        className={cn(
          "grid gap-4",
          stats?.isHierarchicalEnabled && isCompanyLevel 
            ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" 
            : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5"
        )}
      >
        {hasModule(user, company, Module.GRIEVANCE) && (
          <div 
            onClick={() => setActiveTab("grievances")} 
            className="group relative bg-white/70 backdrop-blur-md rounded-xl border border-slate-200/60 p-4 transition-all duration-500 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1 cursor-pointer overflow-hidden"
          >
            <div className="absolute -right-4 -top-4 w-20 h-20 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-full transition-transform group-hover:scale-150 duration-700"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 border border-indigo-100/50 shadow-sm group-hover:rotate-6 transition-transform">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="text-right">
                  <div className="text-[9px] font-black text-indigo-600 bg-indigo-50/80 px-2 py-1 rounded-lg uppercase tracking-tight border border-indigo-100/30">
                    {(stats?.grievances.resolutionRate || 0).toFixed(1)}% Resolved
                  </div>
                </div>
              </div>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Inbound Grievances</h4>
              <p className="text-2xl font-black text-slate-900 tracking-tighter group-hover:text-indigo-600 transition-colors">
                {stats?.grievances.total || 0}
              </p>
            </div>
          </div>
        )}

        {hasModule(user, company, Module.GRIEVANCE) && (
          <div 
            onClick={() => { setActiveTab("grievances"); setGrievanceFilters((prev: any) => ({ ...prev, status: "PENDING" })); }} 
            className="group relative bg-white/70 backdrop-blur-md rounded-xl border border-slate-200/60 p-4 transition-all duration-500 hover:shadow-xl hover:shadow-amber-500/10 hover:-translate-y-1 cursor-pointer overflow-hidden"
          >
            <div className="absolute -right-4 -top-4 w-20 h-20 bg-gradient-to-br from-amber-500/10 to-transparent rounded-full transition-transform group-hover:scale-150 duration-700"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600 border border-amber-100/50 shadow-sm group-hover:-rotate-6 transition-transform">
                  <Clock className="w-5 h-5" />
                </div>
                <span className="text-[9px] font-black bg-rose-50 text-rose-600 px-2 py-1 rounded-lg uppercase tracking-tight border border-rose-100/30">
                  {stats?.highPriorityPending || 0} Urgent
                </span>
              </div>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Overdue cases</h4>
              <p className="text-2xl font-black text-amber-600 tracking-tighter">
                {stats?.grievances.pending || 0}
              </p>
            </div>
          </div>
        )}

        {hasModule(user, company, Module.GRIEVANCE) && (
          <div 
            onClick={() => { setActiveTab("grievances"); setGrievanceFilters((prev: any) => ({ ...prev, status: "RESOLVED" })); }} 
            className="group relative bg-white/70 backdrop-blur-md rounded-xl border border-slate-200/60 p-4 transition-all duration-500 hover:shadow-xl hover:shadow-emerald-500/10 hover:-translate-y-1 cursor-pointer overflow-hidden"
          >
            <div className="absolute -right-4 -top-4 w-20 h-20 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-full transition-transform group-hover:scale-150 duration-700"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 border border-emerald-100/50 shadow-sm transition-all group-hover:bg-emerald-600 group-hover:text-white">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="flex items-center gap-1 text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg uppercase tracking-tight">
                   <Zap className="w-2 h-2 fill-emerald-500" /> +{stats?.resolvedToday || 0}
                </div>
              </div>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Resolved</h4>
              <p className="text-2xl font-black text-emerald-600 tracking-tighter">
                {stats?.grievances.resolved || 0}
              </p>
            </div>
          </div>
        )}

        {hasModule(user, company, Module.APPOINTMENT) && isCompanyLevel && (
          <div 
            onClick={() => { setActiveTab("appointments"); setAppointmentFilters((prev: any) => ({ ...prev, status: "SCHEDULED" })); }} 
            className="group relative bg-white/70 backdrop-blur-md rounded-xl border border-slate-200/60 p-4 transition-all duration-500 hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1 cursor-pointer overflow-hidden"
          >
            <div className="absolute -right-4 -top-4 w-20 h-20 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full transition-transform group-hover:scale-150 duration-700"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 border border-blue-100/50 shadow-sm transition-all group-hover:-rotate-6">
                  <CalendarClock className="w-5 h-5" />
                </div>
                <div className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg uppercase tracking-tight">
                  Upcoming
                </div>
              </div>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pending Appts</h4>
              <p className="text-2xl font-black text-slate-900 tracking-tighter">
                {appointments?.filter((a: any) => a.status === "SCHEDULED").length || 0}
              </p>
            </div>
          </div>
        )}

        {hasModule(user, company, Module.APPOINTMENT) && isCompanyLevel && (
          <div 
            onClick={() => setActiveTab("appointments")} 
            className="group relative bg-white/70 backdrop-blur-md rounded-xl border border-slate-200/60 p-4 transition-all duration-500 hover:shadow-xl hover:shadow-purple-500/10 hover:-translate-y-1 cursor-pointer overflow-hidden"
          >
            <div className="absolute -right-4 -top-4 w-20 h-20 bg-gradient-to-br from-purple-500/10 to-transparent rounded-full transition-transform group-hover:scale-150 duration-700"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600 border border-purple-100/50 shadow-sm transition-all group-hover:rotate-12">
                  <CalendarCheck className="w-5 h-5" />
                </div>
                <div className="text-[9px] font-black text-purple-600 bg-purple-50 px-2 py-1 rounded-lg uppercase tracking-tight">
                  {(stats?.appointments.completionRate || 0).toFixed(0)}%
                </div>
              </div>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Appointments</h4>
              <p className="text-2xl font-black text-slate-900 tracking-tighter">
                {stats?.appointments.total || 0}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Grievance Trend */}
        {hasModule(user, company, Module.GRIEVANCE) && (
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Grievance Trend
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Last 7 days activity
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 flex-1">
              {stats?.grievances.daily &&
              stats.grievances.daily.length > 0 ? (
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart
                    data={stats.grievances.daily.slice(-7).map((d: any) => ({
                      name: new Date(d.date).toLocaleDateString(
                        "en-IN",
                        { weekday: "short" },
                      ),
                      count: d.count,
                    }))}
                  >
                    <defs>
                      <linearGradient
                        id="grievanceGrad"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#6366f1"
                          stopOpacity={0.15}
                        />
                        <stop
                          offset="95%"
                          stopColor="#6366f1"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#f1f5f9"
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      tickMargin={4}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      allowDecimals={false}
                      width={30}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid #e2e8f0",
                        fontSize: "12px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#grievanceGrad)"
                      name="Grievances"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[140px] flex flex-col items-center justify-center text-slate-400 border border-dashed rounded-lg border-slate-200">
                  <TrendingUp className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-sm">No trend data</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Grievance Status Donut */}
        {hasModule(user, company, Module.GRIEVANCE) && (
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-purple-50 rounded-xl flex items-center justify-center border border-purple-100/50">
                  <PieChartIcon className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-[12px] font-black text-slate-800 uppercase tracking-tight leading-none">
                    Operational Status
                  </h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5">
                    Real-time efficiency
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 flex-1 flex flex-col justify-between">
              {(() => {
                const chart = [
                  {
                    name: "Pending",
                    value: stats?.grievances.pending || 0,
                    color: "#f59e0b",
                    subText: "Awaiting assignment",
                  },
                  {
                    name: "In Progress",
                    value: stats?.grievances.assigned || stats?.grievances.inProgress || 0,
                    color: "#6366f1",
                    subText: "Active resolution",
                  },
                  {
                    name: "Resolved",
                    value: stats?.grievances.resolved || 0,
                    color: "#10b981",
                    subText: "Completed cases",
                  },
                ].filter((d) => d.value > 0);
                return chart.length > 0 ? (
                  <>
                    <div className="relative h-[120px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chart}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={55}
                            paddingAngle={6}
                            dataKey="value"
                            strokeWidth={0}
                          >
                            {chart.map((entry, i) => (
                              <Cell 
                                key={i} 
                                fill={entry.color} 
                                className="outline-none hover:opacity-80 transition-opacity"
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              borderRadius: "16px",
                              border: "none",
                              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                              fontSize: "10px",
                              fontWeight: "bold",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-xl font-black text-slate-900 tracking-tighter">
                          {stats?.grievances.total || 0}
                        </span>
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Total</span>
                      </div>
                    </div>
                    <div className="space-y-1.5 mt-3">
                      {chart.map((d, i) => (
                        <div
                          key={i}
                          className="group flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full shadow-sm"
                              style={{ backgroundColor: d.color }}
                            ></span>
                            <div>
                              <p className="text-[10px] font-black text-slate-700 uppercase tracking-tighter leading-none">
                                {d.name}
                              </p>
                              <p className="text-[8px] text-slate-400 group-hover:text-slate-500 transition-colors mt-0.5">{d.subText}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] font-black text-slate-900 leading-none">
                              {d.value}
                            </p>
                            <p className="text-[8px] font-bold text-slate-400 mt-0.5">
                              {((d.value / (stats?.grievances.total || 1)) * 100).toFixed(0)}%
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="h-[120px] flex items-center justify-center text-slate-400 text-sm border border-dashed rounded-lg border-slate-200">
                    No data
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* High Grievance Departments */}
        {isCompanyLevel && departmentData && departmentData.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-rose-50 rounded-xl flex items-center justify-center border border-rose-100/50">
                  <Building className="w-4 h-4 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                    High Grievance Departments
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                    Grievance Distribution
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 flex-1">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart
                  data={departmentData.slice(0, 5)}
                  layout="vertical"
                  margin={{ left: 10, right: 30, top: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="departmentName"
                    type="category"
                    tick={{ fontSize: 9, fontWeight: "bold", fill: "#64748b" }}
                    width={80}
                  />
                  <Tooltip
                    cursor={{ fill: "#f8fafc" }}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "none",
                      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                      fontSize: "10px"
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill="#ef4444"
                    radius={[0, 4, 4, 0]}
                    barSize={16}
                    name="Total Grievances"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Appointments by Status */}
        {hasModule(user, company, Module.APPOINTMENT) && isCompanyLevel && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
              <div className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center">
                <CalendarCheck className="w-4 h-4 text-violet-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  Appointment Overview
                </h3>
                <p className="text-[10px] text-slate-400">
                  Status distribution
                </p>
              </div>
            </div>
            <div className="p-4 flex-1 flex flex-col justify-between">
              {(() => {
                const apptData = [
                  {
                    name: "Pending",
                    value: stats?.appointments.pending || 0,
                    color: "#f59e0b",
                  },
                  {
                    name: "Confirmed",
                    value: stats?.appointments.confirmed || 0,
                    color: "#6366f1",
                  },
                  {
                    name: "Completed",
                    value: stats?.appointments.completed || 0,
                    color: "#10b981",
                  },
                  {
                    name: "Cancelled",
                    value: stats?.appointments.cancelled || 0,
                    color: "#f43f5e",
                  },
                ].filter((d) => d.value > 0);
                return apptData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={120}>
                      <BarChart data={apptData} layout="vertical" margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#f1f5f9"
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 10, fill: "#94a3b8" }}
                          allowDecimals={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fontSize: 10, fill: "#94a3b8" }}
                          width={60}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "12px",
                            border: "1px solid #e2e8f0",
                            fontSize: "10px",
                          }}
                        />
                        <Bar
                          dataKey="value"
                          radius={[0, 4, 4, 0]}
                          name="Count"
                          barSize={16}
                        >
                          {apptData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-100">
                      <div className="text-center">
                        <p className="text-xl font-black text-slate-900 leading-none">
                          {stats?.appointments.last7Days || 0}
                        </p>
                        <p className="text-[9px] text-slate-500 font-semibold uppercase mt-1">
                          Last 7 days
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-black text-emerald-600 leading-none">
                          {(
                            stats?.appointments.completionRate || 0
                          ).toFixed(0)}
                          %
                        </p>
                        <p className="text-[9px] text-slate-500 font-semibold uppercase mt-1">
                          Completion Rate
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="h-[120px] flex items-center justify-center text-slate-400 text-sm border border-dashed rounded-lg border-slate-200">
                    No appointment data
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Staff by Role */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Staff by Role
              </h3>
              <p className="text-[10px] text-slate-400">
                {isCompanyLevel
                  ? "Across all departments"
                  : "In your department"}
              </p>
            </div>
          </div>
          <div className="p-4 flex-1 flex flex-col justify-between">
            {(() => {
              const roleDataRaw = stats?.usersByRole || [];
              const localRoleMap: Record<string, number> = {};
              
              if (roleDataRaw.length === 0) {
                users.forEach((u: any) => {
                  let roleName = "";
                  if (typeof u.customRoleId === "object" && u.customRoleId?.name) {
                    roleName = u.customRoleId.name;
                  } else {
                    roleName = u.role?.replace(/_/g, " ") || "Unknown";
                  }
                  const normalizedRole = roleName.toUpperCase();
                  localRoleMap[normalizedRole] = (localRoleMap[normalizedRole] || 0) + 1;
                });
              }

              const roleColors = ["#6366f1", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6"];
              
              const roleData = roleDataRaw.length > 0 
                ? roleDataRaw.map((r: any, i: number) => ({
                    name: r.name.toUpperCase(),
                    value: r.count,
                    color: roleColors[i % roleColors.length],
                  }))
                : Object.entries(localRoleMap).map(([name, value], i) => ({
                    name,
                    value,
                    color: roleColors[i % roleColors.length],
                  }));

              const totalStaffCount = stats?.users || users.length;

              if (roleData.length === 0) {
                return (
                  <div className="h-[120px] flex items-center justify-center text-slate-400 text-sm border border-dashed rounded-lg border-slate-200">
                    No staff data available
                  </div>
                );
              }

              return (
                <div className="space-y-2 mt-1">
                  {roleData.map((r: any, i: number) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">
                          {r.name}
                        </span>
                        <span className="text-[11px] font-black text-slate-900 leading-none">
                          {r.value}
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${totalStaffCount > 0 ? (r.value / totalStaffCount) * 100 : 0}%`,
                            backgroundColor: r.color,
                          }}
                        ></div>
                      </div>
                    </div>
                  ))}
                  <div className="pt-2 mt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">
                      Total Staff
                    </span>
                    <span className="text-[12px] font-black text-slate-900 tabular-nums leading-none">
                      {totalStaffCount}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </TabsContent>
  );
}
