"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { 
  RefreshCw, 
  FileText, 
  Clock, 
  CalendarCheck, 
  Building, 
  Zap, 
  ArrowLeft, 
  User as UserIcon, 
  Mail, 
  Phone, 
  Shield, 
  CheckCircle2, 
  CalendarClock 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Permission, Module, hasPermission, hasModule } from "@/lib/permissions";
import { ProtectedButton } from "@/components/ui/ProtectedButton";

interface OverviewTabProps {
  user: any;
  company: any;
  stats: any;
  refreshing: boolean;
  handleRefresh: () => void;
  setActiveTab: (tab: string) => void;
  setGrievanceFilters: (fn: (prev: any) => any) => void;
  setAppointmentFilters: (fn: (prev: any) => any) => void;
  loadingStats: boolean;
  users: any[];
  departments: any[];
  departmentPagination: any;
  grievances: any[];
  appointments: any[];
  formatTo10Digits: (phone?: string) => string;
  setShowAvailabilityCalendar: (show: boolean) => void;
  isCompanyLevel: boolean;
  isDepartmentLevel: boolean;
}

export default function OverviewTab({
  user,
  company,
  stats,
  refreshing,
  handleRefresh,
  setActiveTab,
  setGrievanceFilters,
  setAppointmentFilters,
  loadingStats,
  users,
  departments,
  departmentPagination,
  grievances,
  appointments,
  formatTo10Digits,
  setShowAvailabilityCalendar,
  isCompanyLevel,
  isDepartmentLevel,
}: OverviewTabProps) {
  return (
    <TabsContent value="overview" className="space-y-6">
      {/* Dashboard Headers & Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {/* Statistical KPI Cards */}
        <>
          {/* Total Grievances */}
          {hasPermission(user, Permission.READ_GRIEVANCE) && (
            <Card onClick={() => setActiveTab("grievances")} className="bg-white/50 backdrop-blur-sm border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer">
              <CardHeader className="pb-2 space-y-0 flex flex-row items-center justify-between">
                <CardTitle className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Total Grievances
                </CardTitle>
                <div className="p-1.5 bg-indigo-50 rounded-lg">
                  <FileText className="w-3.5 h-3.5 text-indigo-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-slate-800 tabular-nums">
                  {loadingStats ? "..." : (stats?.grievances?.total || 0)}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                    {stats?.grievances?.last7Days || 0} New
                  </span>
                  <span className="text-[9px] text-slate-400 font-medium">this week</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pending Grievances */}
          {hasPermission(user, Permission.READ_GRIEVANCE) && (
            <Card onClick={() => { setActiveTab("grievances"); setGrievanceFilters((prev: any) => ({ ...prev, status: "PENDING" })); }} className="bg-white/50 backdrop-blur-sm border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-300 border-l-4 border-l-amber-400 cursor-pointer">
              <CardHeader className="pb-2 space-y-0 flex flex-row items-center justify-between">
                <CardTitle className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Overdue Grievances
                </CardTitle>
                <div className="p-1.5 bg-amber-50 rounded-lg">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-amber-600 tabular-nums">
                  {loadingStats ? "..." : (stats?.grievances?.pending || 0)}
                </div>
                <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Requiring Response</p>
              </CardContent>
            </Card>
          )}

          {/* Total Appointments */}
          {hasModule(user, company, Module.APPOINTMENT) && hasPermission(user, Permission.READ_APPOINTMENT) && (
            <Card onClick={() => setActiveTab("appointments")} className="bg-white/50 backdrop-blur-sm border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer">
              <CardHeader className="pb-2 space-y-0 flex flex-row items-center justify-between">
                <CardTitle className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Appointments
                </CardTitle>
                <div className="p-1.5 bg-emerald-50 rounded-lg">
                  <CalendarCheck className="w-3.5 h-3.5 text-emerald-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-slate-800 tabular-nums">
                  {loadingStats ? "..." : (stats?.appointments?.total || 0)}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                    {stats?.appointments?.confirmed || 0} Confirmed
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Departments (Company Level) */}
          {isCompanyLevel && (
            <>
              {stats?.isHierarchicalEnabled ? (
                <>
                  <Card onClick={() => setActiveTab("departments")} className="bg-white/50 backdrop-blur-sm border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer">
                    <CardHeader className="pb-2 space-y-0 flex flex-row items-center justify-between">
                      <CardTitle className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Main Departments
                      </CardTitle>
                      <div className="p-1.5 bg-blue-50 rounded-lg">
                        <Building className="w-3.5 h-3.5 text-blue-500" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-black text-slate-800 tabular-nums">
                        {loadingStats ? "..." : (stats?.mainDepartments || 0)}
                      </div>
                      <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Primary Units</p>
                    </CardContent>
                  </Card>
                  <Card onClick={() => setActiveTab("departments")} className="bg-white/50 backdrop-blur-sm border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer shadow-indigo-100/20">
                    <CardHeader className="pb-2 space-y-0 flex flex-row items-center justify-between">
                      <CardTitle className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                        Sub Departments
                      </CardTitle>
                      <div className="p-1.5 bg-indigo-50 rounded-lg">
                        <Zap className="w-3.5 h-3.5 text-indigo-500" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-black text-indigo-600 tabular-nums">
                        {loadingStats ? "..." : (stats?.subDepartments || 0)}
                      </div>
                      <p className="text-[9px] text-indigo-300 font-bold uppercase mt-1">Specialized Units</p>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card onClick={() => setActiveTab("departments")} className="bg-white/50 backdrop-blur-sm border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer">
                  <CardHeader className="pb-2 space-y-0 flex flex-row items-center justify-between">
                    <CardTitle className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Working Units
                    </CardTitle>
                    <div className="p-1.5 bg-blue-50 rounded-lg">
                      <Building className="w-3.5 h-3.5 text-blue-500" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-black text-slate-800 tabular-nums">
                      {loadingStats ? "..." : (stats?.departments || 0)}
                    </div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Functional Depts</p>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Reverted Grievances (Company Level) */}
          {isCompanyLevel && hasPermission(user, Permission.READ_GRIEVANCE) && (
            <Card onClick={() => { setActiveTab("reverted"); setGrievanceFilters((prev: any) => ({ ...prev, status: "REVERTED" })); }} className="bg-white/50 backdrop-blur-sm border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-300 border-l-4 border-l-rose-400 cursor-pointer">
              <CardHeader className="pb-2 space-y-0 flex flex-row items-center justify-between">
                <CardTitle className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Reverted
                </CardTitle>
                <div className="p-1.5 bg-rose-50 rounded-lg">
                  <ArrowLeft className="w-3.5 h-3.5 text-rose-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-rose-600 tabular-nums">
                  {loadingStats ? "..." : (grievances.filter(g => g.status?.toUpperCase() === "REVERTED").length || 0)}
                </div>
                <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Pending Resolution</p>
              </CardContent>
            </Card>
          )}
        </>
      </div>

      {/* Company Info (for Company Admin) */}
      {isCompanyLevel && company && (
        <Card className="overflow-hidden border border-slate-200 shadow-sm bg-white rounded-xl">
          <div className="bg-slate-900 px-6 py-5">
            <div className="relative flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="h-16 w-16 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20 shadow-lg">
                  <Building className="text-indigo-400 w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white leading-tight">
                    {company.name}
                  </h3>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">
                    Company Profile & Statistics
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="px-4 py-1.5 rounded-lg bg-white/10 border border-white/20 text-indigo-400 text-[10px] font-black uppercase tracking-widest">
                  {company.companyType}
                </span>
              </div>
            </div>
          </div>
          <CardContent className="p-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-100">
              <div className="p-4 hover:bg-slate-50 transition-all duration-200 group">
                <div className="flex items-center text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                  <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center mr-2 shadow-sm">
                    <UserIcon className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  Staff/Users
                </div>
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-black text-slate-900 tracking-tighter leading-none">
                    {stats?.users ?? users.length}
                  </span>
                  <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 uppercase tracking-tighter">
                    Live
                  </span>
                </div>
              </div>
              <div className="p-4 hover:bg-slate-50 transition-all duration-200 group">
                <div className="flex items-center text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                  <div className="w-6 h-6 bg-indigo-100 rounded flex items-center justify-center mr-2 shadow-sm">
                    <Building className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                  Departments
                </div>
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-black text-slate-900 tracking-tighter leading-none">
                    {departmentPagination.total ||
                      stats?.departments ||
                      departments.length}
                  </span>
                  <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 uppercase tracking-tighter">
                    Verified
                  </span>
                </div>
              </div>
              <div className="p-4 hover:bg-slate-50 transition-all duration-200 group">
                <div className="flex items-center text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                  <div className="w-6 h-6 bg-cyan-100 rounded flex items-center justify-center mr-2 shadow-sm">
                    <Mail className="w-3.5 h-3.5 text-cyan-600" />
                  </div>
                  Support Channel
                </div>
                <div className="text-xs font-bold text-slate-700 truncate">
                  {company.contactEmail}
                </div>
              </div>
              <div className="p-4 hover:bg-slate-50 transition-all duration-200 group">
                <div className="flex items-center text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                  <div className="w-6 h-6 bg-emerald-100 rounded flex items-center justify-center mr-2 shadow-sm">
                    <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  Direct Line
                </div>
                <div className="text-xs font-bold text-slate-700">
                  {formatTo10Digits(company.contactPhone)}
                </div>
              </div>
            </div>
            <div className="bg-slate-50/50 p-4 border-t border-slate-100">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
                <div className="flex items-center space-x-4">
                  {hasModule(user, company, Module.GRIEVANCE) &&
                    hasPermission(user, Permission.READ_GRIEVANCE) && (
                      <div className="flex flex-col bg-white border border-slate-200/60 rounded-xl p-3 shadow-sm min-w-[140px]">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                          Grievances
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-black text-slate-900 tracking-tighter">
                            {stats?.grievances?.total || 0}
                          </span>
                          <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                            {stats?.grievances?.pending || 0} Open
                          </span>
                        </div>
                      </div>
                    )}
                  {hasModule(user, company, Module.APPOINTMENT) &&
                    hasPermission(user, Permission.READ_APPOINTMENT) && (
                      <div className="flex flex-col bg-white border border-slate-200/60 rounded-xl p-3 shadow-sm min-w-[140px]">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                          Appointments
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-black text-slate-900 tracking-tighter">
                            {stats?.appointments?.total || 0}
                          </span>
                          <span className="text-[9px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded border border-violet-100">
                            {stats?.appointments?.confirmed || 0} High
                          </span>
                        </div>
                      </div>
                    )}
                </div>
                <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200/60 shadow-sm">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Network Secure
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Department Admin Overview */}
      {isDepartmentLevel && (
        <div className="space-y-6">
          <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-slate-900 px-6 py-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                  <UserIcon className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-white uppercase tracking-tight">
                    My Profile
                  </CardTitle>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                    Your personal information and credentials
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex items-start gap-6">
                <div className="flex-shrink-0">
                  <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white rounded-2xl flex items-center justify-center shadow-xl text-3xl font-bold">
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </div>
                </div>
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-200/60">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Identity</p>
                    <p className="text-sm font-black text-slate-900">{user?.firstName} {user?.lastName}</p>
                  </div>
                  <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-200/60">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Communication</p>
                    <p className="text-xs font-bold text-slate-600 truncate">{user?.email}</p>
                  </div>
                  <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-200/60">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Authorized Role</p>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-600 text-white text-[9px] font-black rounded uppercase tracking-tighter">
                      <Shield className="w-3 h-3" />
                      {user.role}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white mt-6">
            <CardHeader className="bg-slate-900 px-6 py-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                  <Building className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-white uppercase tracking-tight">
                    {user?.departmentId?.name || departments[0]?.name || "My Department"}
                  </CardTitle>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                    Department info and service statistics
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {(() => {
                const currentDepartment = user?.departmentId || departments[0];
                return currentDepartment ? (
                  <div className="space-y-6">
                    <div className="flex items-start gap-6">
                      <div className="flex-shrink-0">
                        <div className="w-16 h-16 bg-slate-100/50 rounded-xl flex items-center justify-center border border-slate-200">
                          <Building className="w-8 h-8 text-slate-400" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold text-slate-800 mb-2">{currentDepartment.name}</h3>
                        <p className="text-slate-600">{currentDepartment.description || "No description provided"}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 text-sm font-mono">{currentDepartment.departmentId}</div>
                      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200"><span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-full w-fit"><CheckCircle2 className="w-3.5 h-3.5" />Active</span></div>
                      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 text-sm font-medium">{currentDepartment.contactPerson || user?.firstName + " " + user?.lastName}</div>
                      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 text-sm font-medium truncate">{currentDepartment.contactEmail || user?.email}</div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                      {hasModule(user, company, Module.GRIEVANCE) && hasPermission(user, Permission.READ_GRIEVANCE) && (
                        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
                          <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Grievances</p><p className="text-2xl font-black mt-1">{stats?.grievances?.total || 0}</p></div>
                          <FileText className="w-8 h-8 text-indigo-100" />
                        </div>
                      )}
                      {hasModule(user, company, Module.APPOINTMENT) && hasPermission(user, Permission.READ_APPOINTMENT) && (
                        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
                          <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bookings</p><p className="text-2xl font-black mt-1">{stats?.appointments?.total || 0}</p></div>
                          <CalendarClock className="w-8 h-8 text-purple-100" />
                        </div>
                      )}
                    </div>
                  </div>
                ) : null;
              })()}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <Card className="border border-slate-200 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="bg-slate-900 px-5 py-4">
          <div className="flex items-center gap-3">
            <Zap className="w-4 h-4 text-indigo-400" />
            <CardTitle className="text-sm font-bold text-white">Quick Actions</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4 flex flex-wrap gap-2">
          {isCompanyLevel && (
            <>
              <ProtectedButton permission={Permission.CREATE_DEPARTMENT} variant="outline" onClick={() => setActiveTab("departments")}>Manage Departments</ProtectedButton>
              <ProtectedButton permission={Permission.CREATE_USER} variant="outline" onClick={() => setActiveTab("users")}>Manage Users</ProtectedButton>
              <ProtectedButton permission={Permission.READ_APPOINTMENT} variant="outline" onClick={() => setShowAvailabilityCalendar(true)}>Manage Availability</ProtectedButton>
            </>
          )}
          {isDepartmentLevel && (
            <ProtectedButton permission={Permission.READ_APPOINTMENT} variant="outline" onClick={() => setShowAvailabilityCalendar(true)}>Dept. Availability</ProtectedButton>
          )}
          <ProtectedButton permission={Permission.VIEW_ANALYTICS} variant="outline" onClick={() => setActiveTab("analytics")}>View Analytics</ProtectedButton>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
