"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle,
  Building,
  Users,
  FileText,
  Calendar,
  BarChart2,
  ArrowLeft,
  Search,
  ArrowUpDown,
  Download,
  RefreshCw,
  TrendingUp,
  Clock,
  Shield,
  AlertCircle,
  Activity,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { departmentAPI, Department } from "@/lib/api/department";
import { companyAPI, Company } from "@/lib/api/company";
import { userAPI, User } from "@/lib/api/user";
import { apiClient } from "@/lib/api/client";
import { grievanceAPI, Grievance } from "@/lib/api/grievance";
import { appointmentAPI, Appointment } from "@/lib/api/appointment";
import GrievanceDetailDialog from "@/components/grievance/GrievanceDetailDialog";
import AppointmentDetailDialog from "@/components/appointment/AppointmentDetailDialog";
import StatusUpdateModal from "@/components/grievance/StatusUpdateModal";
import RevertGrievanceDialog from "@/components/grievance/RevertGrievanceDialog";
import toast from "react-hot-toast";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Module } from "@/lib/permissions";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#f43f5e"];

export default function DepartmentDetail() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const departmentId = params.id as string;

  const [department, setDepartment] = useState<Department | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalGrievances: 0,
    totalAppointments: 0,
    activeUsers: 0,
    pendingGrievances: 0,
    resolvedGrievances: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedGrievance, setSelectedGrievance] = useState<Grievance | null>(
    null,
  );
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null);
  const [showGrievanceDetail, setShowGrievanceDetail] = useState(false);
  const [showAppointmentDetail, setShowAppointmentDetail] = useState(false);
  const [updatingGrievanceStatus, setUpdatingGrievanceStatus] = useState<
    Set<string>
  >(new Set());
  const [showGrievanceStatusModal, setShowGrievanceStatusModal] =
    useState(false);
  const [selectedGrievanceForStatus, setSelectedGrievanceForStatus] =
    useState<Grievance | null>(null);
  const [showRevertDialog, setShowRevertDialog] = useState(false);
  const [selectedGrievanceForRevert, setSelectedGrievanceForRevert] =
    useState<Grievance | null>(null);

  // Filter & Sort states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc" | null;
  }>({ key: "", direction: null });

  useEffect(() => {
    if (!user || user.role === "SUPER_ADMIN") {
      router.push("/dashboard");
      return;
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId, user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const deptRes = await departmentAPI.getById(departmentId);
      if (deptRes.success) {
        setDepartment(deptRes.data.department);
        const deptCompanyId =
          typeof deptRes.data.department.companyId === "object"
            ? deptRes.data.department.companyId?._id
            : deptRes.data.department.companyId;

        if (deptCompanyId && user?.role === "COMPANY_ADMIN") {
          const companyRes = await companyAPI.getMyCompany();
          if (companyRes.success) setCompany(companyRes.data.company);
        }
      }

      const usersRes = await userAPI.getAll({ departmentId });
      if (usersRes.success) setUsers(usersRes.data.users);

      const grievancesRes = await grievanceAPI.getAll({
        departmentId,
        limit: 100,
      });
      if (grievancesRes.success) {
        const activeGrievances = grievancesRes.data.grievances.filter(
          (g) => g.status !== "RESOLVED",
        );
        setGrievances(activeGrievances);
      }

      const statsRes = await apiClient.get(
        `/analytics/dashboard?departmentId=${departmentId}`,
      );
      if (statsRes.success) {
        setStats({
          totalUsers: usersRes.success ? usersRes.data.users.length : 0,
          totalGrievances: statsRes.data.grievances?.total || 0,
          totalAppointments: statsRes.data.appointments?.total || 0,
          activeUsers: usersRes.success
            ? usersRes.data.users.filter((u: User) => u.isActive).length
            : 0,
          pendingGrievances: statsRes.data.grievances?.pending || 0,
          resolvedGrievances: statsRes.data.grievances?.resolved || 0,
        });
      }
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Failed to load department data",
      );
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" | null = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc")
      direction = "desc";
    else if (sortConfig.key === key && sortConfig.direction === "desc")
      direction = null;
    setSortConfig({ key, direction });
  };

  const filteredUsers = useMemo(() => {
    let filtered = [...users];
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.firstName?.toLowerCase().includes(search) ||
          u.lastName?.toLowerCase().includes(search) ||
          u.email?.toLowerCase().includes(search),
      );
    }
    if (roleFilter !== "all")
      filtered = filtered.filter((u) => u.role === roleFilter);
    if (statusFilter !== "all")
      filtered = filtered.filter((u) =>
        statusFilter === "active" ? u.isActive : !u.isActive,
      );
    if (sortConfig.key && sortConfig.direction) {
      filtered.sort((a: any, b: any) => {
        const aVal = a[sortConfig.key] || "";
        const bVal = b[sortConfig.key] || "";
        if (typeof aVal === "string") {
          return sortConfig.direction === "asc"
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      });
    }
    return filtered;
  }, [users, searchTerm, roleFilter, statusFilter, sortConfig]);

  const filteredGrievances = useMemo(() => {
    let filtered = [...grievances];
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (g) =>
          g.citizenName?.toLowerCase().includes(search) ||
          g.grievanceId?.toLowerCase().includes(search),
      );
    }
    if (statusFilter !== "all" && statusFilter !== "active") {
      filtered = filtered.filter((g) => g.status === statusFilter);
    }
    return filtered;
  }, [grievances, searchTerm, statusFilter]);

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      toast.error("No data to export");
      return;
    }
    const headers = Object.keys(data[0]).filter((k) => !k.startsWith("_"));
    const csvContent = [
      headers.join(","),
      ...data.map((row) =>
        headers.map((h) => JSON.stringify(row[h] || "")).join(","),
      ),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export successful!");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoadingSpinner text="Loading department details..." />
      </div>
    );
  }

  if (!department) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Department not found</h2>
          <Button onClick={() => router.push("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Chart data
  const grievanceStatusData = [
    { name: "Pending", value: stats.pendingGrievances, color: "#f59e0b" },
    { name: "Resolved", value: stats.resolvedGrievances, color: "#10b981" },
    {
      name: "In Progress",
      value: Math.max(
        0,
        stats.totalGrievances -
          stats.pendingGrievances -
          stats.resolvedGrievances,
      ),
      color: "#6366f1",
    },
  ].filter((item) => item.value > 0);

  const userRoleData = users.reduce((acc: any[], u) => {
    const role = u.role?.replace(/_/g, " ") || "Unknown";
    const existing = acc.find((item) => item.name === role);
    if (existing) existing.value++;
    else acc.push({ name: role, value: 1 });
    return acc;
  }, []);

  const resolutionRate =
    stats.totalGrievances > 0
      ? Math.round((stats.resolvedGrievances / stats.totalGrievances) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header — matches main dashboard theme */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50 shadow-2xl overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        ></div>

        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 relative z-10">
          <div className="flex items-center justify-between h-16">
            {/* Left: Back + Dept Info */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                onClick={() => router.push("/dashboard")}
                className="h-9 px-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all border border-transparent hover:border-slate-700 text-[11px] font-bold uppercase tracking-widest"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                Back
              </Button>

              <div className="w-px h-6 bg-slate-800"></div>

              <div className="w-9 h-9 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                <Building className="w-4 h-4 text-indigo-400" />
              </div>

              <div>
                <h1 className="text-sm font-black text-white tracking-tight leading-none uppercase">
                  {department.name}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[9px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded">
                    {department.departmentId}
                  </span>
                  {company && (
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">
                      · {company.name}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Refresh */}
            <button
              onClick={fetchData}
              className="h-9 flex items-center gap-2 px-3 bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all border border-slate-700 hover:border-slate-600 text-[11px] font-bold uppercase tracking-widest"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 lg:px-6 py-4">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          {/* Tab Navigation — matches main dashboard style */}
          <div className="mb-4 sticky top-[64px] z-40 bg-slate-50/95 backdrop-blur-sm py-4 -mx-4 px-4 lg:mx-0 lg:px-0">
            <TabsList className="bg-slate-200/50 p-1 border border-slate-300/50 h-10 shadow-sm overflow-x-auto no-scrollbar max-w-full">
              <TabsTrigger
                value="overview"
                className="px-5 h-8 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="users"
                className="px-5 h-8 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg"
              >
                Users
              </TabsTrigger>
              {user &&
                (user.enabledModules?.includes(Module.GRIEVANCE) ||
                  !user.companyId) && (
                  <TabsTrigger
                    value="grievances"
                    className="px-5 h-8 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg"
                  >
                    Grievances
                  </TabsTrigger>
                )}
              <TabsTrigger
                value="analytics"
                className="px-5 h-8 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg flex items-center gap-1.5"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                Analytics
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ─── OVERVIEW TAB ─── */}
          <TabsContent value="overview" className="space-y-6">
            {/* KPI Cards — compact, matching main dashboard style */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Total Users */}
              <div
                className="bg-white rounded-xl border border-slate-200/60 shadow-sm hover:shadow-md transition-all cursor-pointer group p-4"
                onClick={() => setActiveTab("users")}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                    <Users className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                    {stats.activeUsers} active
                  </span>
                </div>
                <p className="text-2xl font-black text-slate-900 tracking-tighter">
                  {stats.totalUsers}
                </p>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">
                  Total Staff
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Click to view →
                </p>
              </div>

              {/* Active Grievances */}
              {user &&
                (user.enabledModules?.includes(Module.GRIEVANCE) ||
                  !user.companyId) && (
                  <div
                    className="bg-white rounded-xl border border-slate-200/60 shadow-sm hover:shadow-md transition-all cursor-pointer group p-4"
                    onClick={() => setActiveTab("grievances")}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                        <FileText className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
                        {stats.pendingGrievances} pending
                      </span>
                    </div>
                    <p className="text-2xl font-black text-slate-900 tracking-tighter">
                      {grievances.length}
                    </p>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">
                      Active Grievances
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Total: {stats.totalGrievances}
                    </p>
                  </div>
                )}

              {/* Resolution Rate */}
              <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm hover:shadow-md transition-all group p-4 cursor-pointer" onClick={() => { setActiveTab("grievances"); setStatusFilter("RESOLVED"); }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${resolutionRate >= 70 ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}
                  >
                    {resolutionRate >= 70 ? "Good" : "Needs Work"}
                  </span>
                </div>
                <p
                  className={`text-2xl font-black tracking-tighter ${resolutionRate >= 70 ? "text-emerald-600" : "text-amber-600"}`}
                >
                  {resolutionRate}%
                </p>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">
                  Resolution Rate
                </p>
                <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${resolutionRate}%` }}
                  ></div>
                </div>
              </div>

              {/* Resolved */}
              <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm hover:shadow-md transition-all group p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 bg-teal-50 rounded-lg flex items-center justify-center text-teal-600 group-hover:scale-110 transition-transform">
                    <Shield className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-600">
                    Done
                  </span>
                </div>
                <p className="text-2xl font-black text-teal-600 tracking-tighter">
                  {stats.resolvedGrievances}
                </p>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">
                  Resolved
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  of {stats.totalGrievances} total
                </p>
              </div>
            </div>

            {/* Department Info Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-900 px-6 py-4 flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center border border-indigo-500/30">
                  <Building className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-tight">
                    Department Information
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                    Registry details and status
                  </p>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-200/60">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Department ID
                    </p>
                    <p className="text-sm font-mono font-bold text-slate-800 bg-white px-2 py-1 rounded border border-slate-200 inline-block">
                      {department.departmentId}
                    </p>
                  </div>
                  <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-200/60">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Company
                    </p>
                    <p className="text-sm font-bold text-slate-800">
                      {company?.name || "N/A"}
                    </p>
                  </div>
                  <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-200/60">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      Status
                    </p>
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${department.isActive !== false ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-white/80"></span>
                      {department.isActive !== false ? "Active" : "Inactive"}
                    </span>
                  </div>
                  {department.description && (
                    <div className="md:col-span-3 bg-slate-50/50 rounded-xl p-4 border border-slate-200/60">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        Description
                      </p>
                      <p className="text-sm text-slate-700">
                        {department.description}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ─── USERS TAB ─── */}
          <TabsContent value="users" className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Header */}
              <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                    <Users className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-tight">
                      Users{" "}
                      <span className="text-slate-400 font-normal normal-case text-xs">
                        ({filteredUsers.length})
                      </span>
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                      All staff in this department
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => exportToCSV(filteredUsers, "users")}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-slate-300 hover:text-white rounded-lg hover:bg-slate-700 transition-all border border-slate-700 text-[10px] font-bold uppercase tracking-widest"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export
                </button>
              </div>

              {/* Filters */}
              <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                  />
                </div>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white font-medium"
                >
                  <option value="all">All Roles</option>
                  <option value="DEPARTMENT_ADMIN">Dept Admin</option>
                  <option value="OPERATOR">Operator</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white font-medium"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {/* Table */}
              {filteredUsers.length === 0 ? (
                <div className="text-center py-16">
                  <Users className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">No users found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-3 py-3 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest w-12">
                          Sr.
                        </th>
                        <th className="px-4 py-3 text-left">
                          <button
                            onClick={() => handleSort("firstName")}
                            className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                          >
                            User <ArrowUpDown className="w-3 h-3" />
                          </button>
                        </th>
                        <th className="px-4 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          Email
                        </th>
                        <th className="px-4 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          Role
                        </th>
                        <th className="px-4 py-3 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredUsers.map((u, index) => (
                        <tr
                          key={u._id}
                          className="hover:bg-slate-50/70 transition-colors"
                        >
                          <td className="px-3 py-3 text-center">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold">
                              {index + 1}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                                {u.firstName?.[0]}
                                {u.lastName?.[0]}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-900">
                                  {u.firstName} {u.lastName}
                                </p>
                                <p className="text-[10px] text-slate-400 font-mono">
                                  {u.userId}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {u.email}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[9px] font-bold border shadow-sm ${
                                (u.role === "DEPARTMENT_ADMIN" && department?.parentDepartmentId) || u.role === "SUB_DEPARTMENT_ADMIN"
                                  ? "bg-purple-50 text-purple-700 border-purple-100 ring-1 ring-purple-200"
                                  : "bg-indigo-50 text-indigo-700 border-indigo-100 uppercase tracking-wide"
                              }`}
                            >
                              {(u.role === "DEPARTMENT_ADMIN" && department?.parentDepartmentId) || u.role === "SUB_DEPARTMENT_ADMIN"
                                ? "Sub Department Admin"
                                : u.role?.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold ${u.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${u.isActive ? "bg-emerald-500" : "bg-slate-400"}`}
                              ></span>
                              {u.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ─── GRIEVANCES TAB ─── */}
          {user &&
            (user.enabledModules?.includes(Module.GRIEVANCE) ||
              !user.companyId) && (
              <TabsContent value="grievances" className="space-y-4">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  {/* Header */}
                  <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                        <FileText className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white uppercase tracking-tight">
                          Active Grievances{" "}
                          <span className="text-slate-400 font-normal normal-case text-xs">
                            ({filteredGrievances.length})
                          </span>
                        </h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                          Open cases in this department
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href="/resolved-grievances"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all text-[10px] font-bold uppercase tracking-widest"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        View Resolved
                      </Link>
                      <button
                        onClick={() =>
                          exportToCSV(filteredGrievances, "grievances")
                        }
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-slate-300 hover:text-white rounded-lg hover:bg-slate-700 transition-all border border-slate-700 text-[10px] font-bold uppercase tracking-widest"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Export
                      </button>
                    </div>
                  </div>

                  {/* Filters */}
                  <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-3 items-center">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                      <input
                        type="text"
                        placeholder="Search by ID, name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                      />
                    </div>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white font-medium"
                    >
                      <option value="all">All Status</option>
                      <option value="PENDING">Pending</option>
                      <option value="ASSIGNED">Assigned</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="REVERTED">Reverted</option>
                    </select>
                  </div>

                  {/* Table */}
                  {filteredGrievances.length === 0 ? (
                    <div className="text-center py-16">
                      <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                      <p className="text-slate-500 font-medium">
                        No active grievances
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-[600px]">
                      <table className="w-full">
                        <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-100">
                          <tr>
                            <th className="px-3 py-3 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest w-12">
                              Sr.
                            </th>
                            <th className="px-4 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">
                              Grievance ID
                            </th>
                            <th className="px-4 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">
                              Citizen
                            </th>
                            <th className="px-4 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">
                              Category
                            </th>
                            <th className="px-4 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">
                              Status
                            </th>
                            <th className="px-4 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">
                              Filed
                            </th>
                            <th className="px-4 py-3 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredGrievances.map((g, index) => (
                            <tr
                              key={g._id}
                              className="hover:bg-slate-50/70 transition-colors"
                            >
                              <td className="px-3 py-3 text-center">
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold">
                                  {index + 1}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-xs font-black text-indigo-600 font-mono">
                                  {g.grievanceId}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={async () => {
                                    const response = await grievanceAPI.getById(
                                      g._id,
                                    );
                                    if (response.success) {
                                      setSelectedGrievance(
                                        response.data.grievance,
                                      );
                                      setShowGrievanceDetail(true);
                                    }
                                  }}
                                  className="text-left hover:text-indigo-600 transition-colors"
                                >
                                  <p className="text-sm font-semibold text-slate-800 hover:underline">
                                    {g.citizenName}
                                  </p>
                                  <p className="text-[10px] text-slate-400">
                                    {g.citizenPhone}
                                  </p>
                                </button>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded">
                                  {g.category || "General"}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => {
                                    setSelectedGrievanceForStatus(g);
                                    setShowGrievanceStatusModal(true);
                                  }}
                                  disabled={updatingGrievanceStatus.has(g._id)}
                                  className="px-2.5 py-1 text-[9px] font-bold border border-slate-200 rounded bg-white hover:border-indigo-400 hover:bg-indigo-50 focus:outline-none focus:ring-1 focus:ring-indigo-500 uppercase tracking-tight transition-all"
                                >
                                  {g.status}
                                </button>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-col">
                                  <span className="text-xs font-medium text-slate-700">
                                    {new Date(g.createdAt).toLocaleDateString()}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    {new Date(g.createdAt).toLocaleTimeString(
                                      [],
                                      { hour: "2-digit", minute: "2-digit" },
                                    )}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => {
                                    setSelectedGrievanceForRevert(g);
                                    setShowRevertDialog(true);
                                  }}
                                  className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-all mr-1"
                                  title="Revert to Company Admin"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a4 4 0 014 4v1m0 0l-3-3m3 3l3-3M7 14H3m0 0l3 3m-3-3l3-3" />
                                  </svg>
                                </button>
                                <button
                                  onClick={async () => {
                                    const response = await grievanceAPI.getById(
                                      g._id,
                                    );
                                    if (response.success) {
                                      setSelectedGrievance(
                                        response.data.grievance,
                                      );
                                      setShowGrievanceDetail(true);
                                    }
                                  }}
                                  className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all"
                                  title="View Details"
                                >
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                    />
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                    />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </TabsContent>
            )}

          {/* ─── ANALYTICS TAB ─── */}
          <TabsContent value="analytics" className="space-y-6">
            {/* Analytics Header Banner */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 border border-slate-800 shadow-xl">
              <div
                className="absolute inset-0 opacity-[0.04]"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                }}
              ></div>
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                    <BarChart2 className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      Department Analytics
                    </h2>
                    <p className="text-slate-400 text-xs mt-0.5">
                      {department.name} · {stats.totalUsers} staff ·{" "}
                      {stats.totalGrievances} total grievances
                    </p>
                  </div>
                </div>
                <div className="hidden md:flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
                    Live
                  </span>
                </div>
              </div>
            </div>

            {/* Analytics KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 cursor-pointer" onClick={() => setActiveTab("grievances")}>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                    <FileText className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-50 text-slate-500">
                    {stats.totalGrievances} total
                  </span>
                </div>
                <p className="text-2xl font-black text-slate-900 tracking-tighter">
                  {grievances.length}
                </p>
                <p className="text-xs font-semibold text-slate-500 mt-1">
                  Active Cases
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 cursor-pointer" onClick={() => { setActiveTab("grievances"); setStatusFilter("PENDING"); }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                    <Clock className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
                    Action
                  </span>
                </div>
                <p className="text-2xl font-black text-amber-600 tracking-tighter">
                  {stats.pendingGrievances}
                </p>
                <p className="text-xs font-semibold text-slate-500 mt-1">
                  Pending
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 cursor-pointer" onClick={() => { setActiveTab("grievances"); setStatusFilter("RESOLVED"); }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                    {resolutionRate}%
                  </span>
                </div>
                <p className="text-2xl font-black text-emerald-600 tracking-tighter">
                  {stats.resolvedGrievances}
                </p>
                <p className="text-xs font-semibold text-slate-500 mt-1">
                  Resolved
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 cursor-pointer" onClick={() => setActiveTab("users")}>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                    <Users className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                    {stats.activeUsers} active
                  </span>
                </div>
                <p className="text-2xl font-black text-slate-900 tracking-tighter">
                  {stats.totalUsers}
                </p>
                <p className="text-xs font-semibold text-slate-500 mt-1">
                  Total Staff
                </p>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Grievance Status Donut */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                    <Activity className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      Grievance Status Distribution
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      Current status breakdown
                    </p>
                  </div>
                </div>
                <div className="p-5">
                  {grievanceStatusData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={grievanceStatusData}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={80}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {grievanceStatusData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              borderRadius: "12px",
                              border: "1px solid #e2e8f0",
                              fontSize: "12px",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-2 mt-2">
                        {grievanceStatusData.map((d, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: d.color }}
                              ></span>
                              <span className="text-xs text-slate-600">
                                {d.name}
                              </span>
                            </div>
                            <span className="text-xs font-bold text-slate-800">
                              {d.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="h-[220px] flex flex-col items-center justify-center text-slate-400">
                      <FileText className="w-10 h-10 mb-2 opacity-30" />
                      <p className="text-sm">No grievance data available</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Staff by Role */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                    <Users className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      Staff by Role
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      Team composition breakdown
                    </p>
                  </div>
                </div>
                <div className="p-5">
                  {userRoleData.length > 0 ? (
                    <div className="space-y-3">
                      {userRoleData.map((r: any, i: number) => (
                        <div key={i}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-slate-700 capitalize">
                              {r.name}
                            </span>
                            <span className="text-xs font-bold text-slate-900">
                              {r.value}
                            </span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${(r.value / users.length) * 100}%`,
                                backgroundColor: COLORS[i % COLORS.length],
                              }}
                            ></div>
                          </div>
                        </div>
                      ))}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs text-slate-500">
                          Total Staff
                        </span>
                        <span className="text-sm font-black text-slate-900">
                          {users.length}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="h-[220px] flex flex-col items-center justify-center text-slate-400">
                      <Users className="w-10 h-10 mb-2 opacity-30" />
                      <p className="text-sm">No user data available</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Dialogs */}
      <GrievanceDetailDialog
        grievance={selectedGrievance}
        isOpen={showGrievanceDetail}
        onClose={() => {
          setShowGrievanceDetail(false);
          setSelectedGrievance(null);
        }}
      />
      <AppointmentDetailDialog
        appointment={selectedAppointment}
        isOpen={showAppointmentDetail}
        onClose={() => {
          setShowAppointmentDetail(false);
          setSelectedAppointment(null);
        }}
      />
      <RevertGrievanceDialog
        isOpen={showRevertDialog}
        grievanceId={selectedGrievanceForRevert?.grievanceId}
        onClose={() => {
          setShowRevertDialog(false);
          setSelectedGrievanceForRevert(null);
        }}
        onSubmit={async (payload) => {
          if (!selectedGrievanceForRevert) return;
          await grievanceAPI.revert(selectedGrievanceForRevert._id, payload);
          toast.success('Grievance reverted to company admin for reassignment');
          await fetchData();
        }}
      />
      <StatusUpdateModal
        isOpen={showGrievanceStatusModal}
        onClose={() => {
          setShowGrievanceStatusModal(false);
          setSelectedGrievanceForStatus(null);
        }}
        itemId={selectedGrievanceForStatus?._id || ""}
        itemType="grievance"
        currentStatus={selectedGrievanceForStatus?.status || ""}
        onSuccess={() => {
          fetchData();
        }}
        grievanceVariant="department-admin"
      />
    </div>
  );
}
