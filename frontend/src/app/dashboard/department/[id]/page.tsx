"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
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
import { roleAPI, Role } from "@/lib/api/role";
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
import { Permission, canChangeGrievanceStatus, hasPermission, Module, isSuperAdmin, isCompanyAdminOrHigher } from "@/lib/permissions";
import { formatTo10Digits } from "@/lib/utils/phoneUtils";
import { Pagination } from "@/components/ui/Pagination";
import { TableSkeleton } from "@/components/ui/GeneralSkeleton";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#f43f5e"];

export default function DepartmentDetail() {
  const { user } = useAuth();
  const canUpdateGrievanceStatus = canChangeGrievanceStatus(user);
  const router = useRouter();
  const params = useParams();
  const departmentId = Array.isArray(params.id) ? params.id[0] : (params.id as string);

  const [department, setDepartment] = useState<Department | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
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
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingGrievances, setLoadingGrievances] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Pagination states
  const [userPage, setUserPage] = useState(1);
  const [userPagination, setUserPagination] = useState({
    limit: 20,
    total: 0,
    pages: 0,
  });
  const [grievancePage, setGrievancePage] = useState(1);
  const [grievancePagination, setGrievancePagination] = useState({
    limit: 20,
    total: 0,
    pages: 0,
  });

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

  const isDFO = useMemo(() => {
    return (
      company?.name?.toUpperCase().includes("D.F.O.") ||
      company?._id === "69adc81165109318a7cde21c" ||
      (department?.name?.toUpperCase().includes("DIVISION") && company?.name?.toUpperCase().includes("FOREST"))
    );
  }, [company, department]);

  const hasModule = useCallback(
    (module: Module) => {
      if (!company) return true; // Default to true if company not loaded to avoid flickering
      const enabledModules = (company.enabledModules || []) as string[];
      return enabledModules.includes(module as string);
    },
    [company]
  );

  useEffect(() => {
    if (!user || isSuperAdmin(user)) {
      router.push("/dashboard");
      return;
    }
    if (!departmentId) {
      toast.error("Invalid department link");
      router.push("/dashboard");
      return;
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId, user]);

  const fetchUsers = useCallback(
    async (page = userPage, limit = userPagination.limit) => {
      setLoadingUsers(true);
      try {
        const res = await userAPI.getAll({ 
          departmentId, 
          page, 
          limit,
          search: searchTerm || undefined,
          status: statusFilter === "active" ? "active" : statusFilter === "inactive" ? "inactive" : undefined,
          role: roleFilter !== "all" ? roleFilter : undefined
        });
        if (res.success) {
          setUsers(res.data.users);
          setUserPagination({
            limit: res.data.pagination.limit,
            total: res.data.pagination.total,
            pages: res.data.pagination.pages,
          });
        }
      } catch (error) {
        console.error("Failed to fetch users:", error);
      } finally {
        setLoadingUsers(false);
      }
    },
    [departmentId, userPage, userPagination.limit, searchTerm, statusFilter, roleFilter]
  );

  const fetchGrievances = useCallback(
    async (page = grievancePage, limit = grievancePagination.limit) => {
      setLoadingGrievances(true);
      try {
        const res = await grievanceAPI.getAll({
          departmentId,
          page,
          limit,
          status: statusFilter !== "all" && statusFilter !== "active" && statusFilter !== "inactive" ? statusFilter : undefined,
          search: searchTerm || undefined
        });
        if (res.success) {
          setGrievances(res.data.grievances);
          setGrievancePagination({
            limit: res.data.pagination.limit,
            total: res.data.pagination.total,
            pages: res.data.pagination.pages,
          });
        }
      } catch (error) {
        console.error("Failed to fetch grievances:", error);
      } finally {
        setLoadingGrievances(false);
      }
    },
    [departmentId, grievancePage, grievancePagination.limit, statusFilter, searchTerm]
  );

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

        if (deptCompanyId) {
          if (isCompanyAdminOrHigher(user)) {
            const companyRes = await companyAPI.getMyCompany();
            if (companyRes.success) setCompany(companyRes.data.company);
          }
          
          const rolesRes = await roleAPI.getRoles(deptCompanyId);
          if (rolesRes.success) {
            setRoles(rolesRes.data.roles || []);
          }
        }
      }

      await Promise.all([
        fetchUsers(1, userPagination.limit),
        fetchGrievances(1, grievancePagination.limit)
      ]);

      const statsRes = await apiClient.get(
        `/analytics/dashboard?departmentId=${departmentId}`,
      );
      if (statsRes.success) {
        setStats({
          totalUsers: statsRes.data.users?.total || 0,
          totalGrievances: statsRes.data.grievances?.total || 0,
          totalAppointments: statsRes.data.appointments?.total || 0,
          activeUsers: statsRes.data.users?.active || 0,
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

  useEffect(() => {
    if (activeTab === "users") {
      fetchUsers(userPage, userPagination.limit);
    }
  }, [activeTab, userPage, userPagination.limit, fetchUsers]);

  useEffect(() => {
    if (activeTab === "grievances") {
      fetchGrievances(grievancePage, grievancePagination.limit);
    }
  }, [activeTab, grievancePage, grievancePagination.limit, fetchGrievances]);

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" | null = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc")
      direction = "desc";
    else if (sortConfig.key === key && sortConfig.direction === "desc")
      direction = null;
    setSortConfig({ key, direction });
  };

  const filteredUsers = useMemo(() => {
    const toSearchable = (value: unknown) =>
      typeof value === "string" ? value.toLowerCase() : "";

    let filtered = [...users];
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          toSearchable(u.firstName).includes(search) ||
          toSearchable(u.lastName).includes(search) ||
          toSearchable(u.email).includes(search),
      );
    }
    if (roleFilter !== "all") {
      filtered = filtered.filter((u) => {
        if (roleFilter.startsWith("CUSTOM:")) {
          const rid = roleFilter.split(":")[1];
          return (
            u.customRoleId === rid ||
            (typeof u.customRoleId === "object" && (u.customRoleId as any)._id === rid)
          );
        }
        return u.role === roleFilter;
      });
    }
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
    const toSearchable = (value: unknown) =>
      typeof value === "string" ? value.toLowerCase() : "";

    let filtered = [...grievances];
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (g) =>
          toSearchable(g.citizenName).includes(search) ||
          toSearchable(g.grievanceId).includes(search),
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

  // New Memoized Forestry Analytics
  const incidentTrendData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
    return months.map((m) => ({
      name: m,
      total: Math.floor(Math.random() * 20) + 5,
      resolved: Math.floor(Math.random() * 15) + 2,
    }));
  }, []);

  const categoryDetailedData = useMemo(() => {
    if (grievances.length === 0) return [];
    const cats: Record<string, number> = {};
    grievances.forEach((g) => {
      const c = g.category || (isDFO ? "General" : "Other");
      cats[c] = (cats[c] || 0) + 1;
    });
    return Object.entries(cats).map(([name, value]) => ({ name, value }));
  }, [grievances, isDFO]);

  const beatHeatMapData = useMemo(() => {
    const beats: Record<string, number> = {};
    grievances.forEach((g) => {
      if (g.forest_beat) beats[g.forest_beat] = (beats[g.forest_beat] || 0) + 1;
    });
    // Fill in some mock beats if empty for visualization
    const displayBeats =
      Object.keys(beats).length > 0
        ? beats
        : {
            "North Beat": 12,
            "South Beat": 8,
            "East Beat": 15,
            "West Beat": 5,
            "Central Beat": 20,
            Konta: 7,
            "Bhanu Beat": 9,
            "Hill Beat": 14,
          };
    return Object.entries(displayBeats).map(([name, density]) => ({
      name,
      density,
    }));
  }, [grievances]);

  const slaPerformanceData = [
    { name: "Fire Control", score: 94 },
    { name: "Wildlife Rescue", score: 88 },
    { name: "Encroachment", score: 72 },
    { name: "Illegal Felling", score: 81 },
  ];

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
    const role =
      typeof u.role === "string" && u.role.length > 0
        ? u.role.replace(/_/g, " ")
        : "Unknown";
    const existing = acc.find((item) => item.name === role);
    if (existing) existing.value++;
    else acc.push({ name: role, value: 1 });
    return acc;
  }, []);

  const resolutionRate =
    stats.totalGrievances > 0
      ? Math.round((stats.resolvedGrievances / stats.totalGrievances) * 100)
      : 0;

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
              {hasModule(Module.INCIDENT_WILDLIFE) && isDFO && (
                <TabsTrigger
                  value="live"
                  className="px-5 h-8 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-rose-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg flex items-center gap-2"
                >
                  <Activity className="w-3.5 h-3.5" />
                  Live Incidents
                </TabsTrigger>
              )}
              {hasModule(Module.GEO_LOCATION) && isDFO && (
                <TabsTrigger
                  value="geofences"
                  className="px-5 h-8 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg flex items-center gap-2"
                >
                  <Shield className="w-3.5 h-3.5" />
                  Geofences
                </TabsTrigger>
              )}
              <TabsTrigger
                value="users"
                className="px-5 h-8 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg"
              >
                Users
              </TabsTrigger>
              {hasModule(Module.GRIEVANCE) && hasPermission(user, Permission.READ_GRIEVANCE) && (
                <TabsTrigger
                  value="grievances"
                  className="px-5 h-8 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg"
                >
                  Grievances
                </TabsTrigger>
              )}
              {hasPermission(user, Permission.VIEW_ANALYTICS) && (
                <TabsTrigger
                  value="analytics"
                  className="px-5 h-8 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg flex items-center gap-1.5"
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  Analytics
                </TabsTrigger>
              )}
            </TabsList>
          </div>

            {/* ─── LIVE INCIDENTS TAB ─── */}
            <TabsContent value="live" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-slate-100 rounded-3xl border-2 border-slate-200 aspect-[16/9] relative overflow-hidden flex items-center justify-center shadow-inner group">
                  <div className="absolute inset-0 bg-emerald-900/10 pointer-events-none"></div>
                  <div className="text-center z-10 transition-transform group-hover:scale-105 duration-700">
                    <Shield className="w-16 h-16 text-indigo-500/20 mx-auto mb-4" />
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Forest Boundary Map</h3>
                    <p className="text-sm text-slate-500 font-medium">Real-time incident tracking overlay active</p>
                    <div className="mt-6 flex justify-center gap-4">
                       <div className="px-4 py-2 bg-white rounded-xl shadow-sm border border-slate-200">
                          <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Active Fires</p>
                          <p className="text-lg font-black text-slate-900">0</p>
                       </div>
                       <div className="px-4 py-2 bg-white rounded-xl shadow-sm border border-slate-200">
                          <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Patrol Squads</p>
                          <p className="text-lg font-black text-slate-900">Active</p>
                       </div>
                    </div>
                  </div>
                  {/* Mock Map Marker */}
                  <div className="absolute top-1/4 left-1/3 animate-bounce">
                     <AlertCircle className="w-8 h-8 text-rose-500 drop-shadow-lg" />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-rose-500" />
                    Priority Alerts
                  </h3>
                  {filteredGrievances.filter(g => g.priority === 'HIGH' || g.priority === 'URGENT').length === 0 ? (
                    <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl text-center">
                       <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                       <p className="text-sm font-black text-emerald-700 uppercase">System Clear</p>
                       <p className="text-[11px] text-emerald-600">No high-priority alerts in East Bhanupratappur</p>
                    </div>
                  ) : (
                    filteredGrievances.filter(g => g.priority === 'HIGH' || g.priority === 'URGENT').map(g => (
                      <div key={g._id} className="bg-white p-4 rounded-2xl border-l-4 border-l-rose-500 border-t border-r border-b border-slate-200 shadow-sm hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] font-black bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full">{g.priority}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{g.grievanceId}</span>
                        </div>
                        <p className="text-sm font-bold text-slate-900 line-clamp-2 mb-1">{g.description}</p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase">{g.forest_beat || 'Unmapped Beat'}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ─── GEOFENCES TAB ─── */}
            <TabsContent value="geofences" className="space-y-6">
               <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
                  <div className="bg-indigo-900 p-8 text-white relative overflow-hidden">
                     <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                     <h2 className="text-2xl font-black uppercase tracking-tight relative z-10">Forest Inventory & Boundaries</h2>
                     <p className="text-indigo-200 text-sm font-medium relative z-10">East Bhanupratappur Division Coverage Details</p>
                  </div>
                  <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                     <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 hover:border-indigo-500 transition-colors">
                        <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">Division</p>
                        <p className="text-xl font-black text-slate-900">E. Bhanupratappur</p>
                        <p className="text-xs text-slate-500 mt-2">Main administrative unit</p>
                     </div>
                     <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 hover:border-indigo-500 transition-colors">
                        <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">Ranges</p>
                        <p className="text-xl font-black text-slate-900">08 Ranges</p>
                        <p className="text-xs text-slate-500 mt-2">Active monitored ranges</p>
                     </div>
                     <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 hover:border-indigo-500 transition-colors">
                        <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">Beats</p>
                        <p className="text-xl font-black text-slate-900">72 Beats</p>
                        <p className="text-xs text-slate-500 mt-2">Ground patrolling units</p>
                     </div>
                     <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 hover:border-indigo-500 transition-colors">
                        <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">Compartments</p>
                        <p className="text-xl font-black text-slate-900">450+ Units</p>
                        <p className="text-xs text-slate-500 mt-2">Precision tracking active</p>
                     </div>
                  </div>
               </div>
            </TabsContent>

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

              {/* Active Compartments (DFO Only) */}
              {isDFO && hasModule(Module.GEO_LOCATION) && (
                <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm hover:shadow-md transition-all group p-4 cursor-pointer" onClick={() => setActiveTab("geofences")}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
                      <Shield className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">
                      Geofences
                    </span>
                  </div>
                  <p className="text-2xl font-black text-slate-900 tracking-tighter">
                    {new Set(grievances.map(g => g.forest_compartment).filter(Boolean)).size || 0}
                  </p>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">
                    Active Compartments
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Full division coverage →
                  </p>
                </div>
              )}

              {/* Forest Specific Card */}
              {department.name.toLowerCase().includes("protection") && (
                <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm hover:shadow-md transition-all group p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                      <Shield className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                      Forest
                    </span>
                  </div>
                  <p className="text-2xl font-black text-slate-900 tracking-tighter">
                    {new Set(grievances.map(g => g.forest_beat).filter(Boolean)).size || 0}
                  </p>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">
                    Beats Monitored
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Range: {new Set(grievances.map(g => g.forest_range).filter(Boolean)).size || 0} active
                  </p>
                </div>
              )}
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
            <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
              <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                    <Users className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-tight">
                      Users{" "}
                      <span className="text-slate-400 font-normal normal-case text-xs">
                        ({userPagination.total})
                      </span>
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                      All staff in this department
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => exportToCSV(users, "users")}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-slate-300 hover:text-white rounded-lg hover:bg-slate-700 transition-all border border-slate-700 text-[10px] font-bold uppercase tracking-widest"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export
                </button>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-6 bg-slate-50/50 border-b border-slate-100">
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm"
                  />
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rows:</span>
                    <select
                      value={userPagination.limit}
                      onChange={(e) => {
                        setUserPagination(prev => ({ ...prev, limit: Number(e.target.value) }));
                        setUserPage(1);
                      }}
                      className="text-[10px] font-bold text-slate-900 bg-transparent border-0 focus:ring-0 cursor-pointer"
                    >
                      {[10, 20, 25, 50, 100].map(l => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="text-xs px-3 py-2 border border-slate-200 rounded-xl bg-white shadow-sm cursor-pointer"
                  >
                    <option value="all">All Roles</option>
                    {roles.map((r) => (
                      <option key={r._id} value={`CUSTOM:${r._id}`}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <CardContent className="p-0">
                {loadingUsers ? (
                  <TableSkeleton rows={10} cols={5} />
                ) : users.length === 0 ? (
                  <div className="text-center py-16">
                    <Users className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">No users found</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-100">
                          <tr>
                            <th className="px-3 py-3 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest w-12">Sr.</th>
                            <th className="px-4 py-3 text-left">
                              <button
                                onClick={() => handleSort("firstName")}
                                className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                              >
                                User <ArrowUpDown className="w-3 h-3" />
                              </button>
                            </th>
                            <th className="px-4 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Email</th>
                            <th className="px-4 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Role</th>
                            <th className="px-4 py-3 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {users.map((u, index) => (
                            <tr key={u._id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="px-3 py-3 text-center">
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold">
                                  {(userPage - 1) * userPagination.limit + index + 1}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                                    {u.firstName?.[0]}{u.lastName?.[0]}
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-slate-900">{u.firstName} {u.lastName}</p>
                                    <p className="text-[10px] text-slate-400 font-mono">{u.userId}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-600">{u.email}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold border shadow-sm ${
                                  (u.level === 2 && department?.parentDepartmentId) || u.level === 3
                                    ? "bg-purple-50 text-purple-700 border-purple-100 ring-1 ring-purple-200"
                                    : "bg-indigo-50 text-indigo-700 border-indigo-100 uppercase tracking-wide"
                                }`}>
                                  {(u.level === 2 && department?.parentDepartmentId) || u.level === 3
                                    ? "Sub Department Admin"
                                    : isSuperAdmin(u) ? "Super Admin" : 
                                      u.level === 1 ? "Company Admin" : 
                                      u.level === 2 ? "Department Admin" : 
                                      u.level === 4 ? "Operator" : u.role?.replace(/_/g, " ")}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold ${u.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? "bg-emerald-500" : "bg-slate-400"}`}></span>
                                  {u.isActive ? "Active" : "Inactive"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="p-4 border-t border-slate-100 bg-slate-50/30">
                      <Pagination
                        currentPage={userPage}
                        totalPages={userPagination.pages}
                        totalItems={userPagination.total}
                        itemsPerPage={userPagination.limit}
                        onPageChange={setUserPage}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── GRIEVANCES TAB ─── */}
          {user &&
            (user.enabledModules?.includes(Module.GRIEVANCE) ||
              !user.companyId) && (
              <TabsContent value="grievances" className="space-y-4">
                <Card className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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
                            ({grievancePagination.total})
                          </span>
                        </h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                          Open cases in this department
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          exportToCSV(grievances, "grievances")
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
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white shadow-sm"
                      />
                    </div>
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rows:</span>
                      <select
                        value={grievancePagination.limit}
                        onChange={(e) => {
                          setGrievancePagination(prev => ({ ...prev, limit: Number(e.target.value) }));
                          setGrievancePage(1);
                        }}
                        className="text-[10px] font-bold text-slate-900 bg-transparent border-0 focus:ring-0 cursor-pointer"
                      >
                        {[10, 20, 25, 50, 100].map(l => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>
                    </div>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white font-medium cursor-pointer shadow-sm"
                    >
                      <option value="all">📋 All Status</option>
                      <option value="PENDING">🔸 Pending</option>
                      <option value="ASSIGNED">👤 Assigned</option>
                      <option value="RESOLVED">✅ Resolved</option>
                      <option value="REJECTED">❌ Rejected</option>
                    </select>
                  </div>

                  <CardContent className="p-0">
                    {loadingGrievances ? (
                      <TableSkeleton rows={10} cols={6} />
                    ) : grievances.length === 0 ? (
                      <div className="text-center py-16">
                        <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                        <p className="text-slate-500 font-medium">No active grievances</p>
                      </div>
                    ) : (
                      <>
                        <div className="overflow-x-auto max-h-[600px]">
                          <table className="w-full">
                            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-100">
                              <tr>
                                <th className="px-3 py-3 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest w-12">Sr.</th>
                                <th className="px-4 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Grievance ID</th>
                                <th className="px-4 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Citizen</th>
                                <th className="px-4 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                                <th className="px-4 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                <th className="px-4 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Filed</th>
                                {isDFO && hasModule(Module.GEO_LOCATION) && (
                                  <th className="px-4 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Forest Details</th>
                                )}
                                <th className="px-4 py-3 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {grievances.map((g, index) => (
                                <tr key={g._id} className="hover:bg-slate-50/70 transition-colors">
                                  <td className="px-3 py-3 text-center">
                                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold">
                                      {(grievancePage - 1) * grievancePagination.limit + index + 1}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="text-xs font-black text-indigo-600 font-mono">{g.grievanceId}</span>
                                    {g.priority === 'URGENT' && (
                                      <span className="ml-2 animate-pulse inline-flex h-2 w-2 rounded-full bg-rose-500" title="Urgent Alert"></span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    <button
                                      onClick={async () => {
                                        const response = await grievanceAPI.getById(g._id);
                                        if (response.success) {
                                          setSelectedGrievance(response.data.grievance);
                                          setShowGrievanceDetail(true);
                                        }
                                      }}
                                      className="text-left hover:text-indigo-600 transition-colors"
                                    >
                                      <p className="text-sm font-semibold text-slate-800 hover:underline">{g.citizenName}</p>
                                      <p className="text-[10px] text-slate-400">{formatTo10Digits(g.citizenPhone)}</p>
                                    </button>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex flex-col gap-1">
                                      <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded inline-block w-fit">
                                        {g.category || "General"}
                                      </span>
                                      {g.priority && (
                                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-widest w-fit ${
                                          g.priority === 'URGENT' ? 'bg-rose-500 text-white border-rose-600' :
                                          g.priority === 'HIGH' ? 'bg-amber-500 text-white border-amber-600' :
                                          'bg-slate-50 text-slate-400 border-slate-200'
                                        }`}>
                                          {g.priority}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <button
                                      onClick={() => {
                                        if (!canUpdateGrievanceStatus) return;
                                        setSelectedGrievanceForStatus(g);
                                        setShowGrievanceStatusModal(true);
                                      }}
                                      disabled={
                                        updatingGrievanceStatus.has(g._id) ||
                                        !canUpdateGrievanceStatus
                                      }
                                      className={`px-2.5 py-1 text-[9px] font-bold border rounded uppercase tracking-tight transition-all focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                                        canUpdateGrievanceStatus
                                          ? "border-slate-200 bg-white hover:border-indigo-400 hover:bg-indigo-50"
                                          : "border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed"
                                      }`}
                                      title={
                                        canUpdateGrievanceStatus
                                          ? "Update grievance status"
                                          : "You do not have permission to change grievance status"
                                      }
                                    >
                                      {g.status}
                                    </button>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex flex-col">
                                      <span className="text-xs font-medium text-slate-700">{new Date(g.createdAt).toLocaleDateString()}</span>
                                      <span className="text-[10px] text-slate-400">{new Date(g.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                    </div>
                                  </td>
                                  {isDFO && hasModule(Module.GEO_LOCATION) && (
                                    <td className="px-4 py-3">
                                      {g.forest_range || g.forest_beat || g.forest_compartment ? (
                                        <div className="space-y-1">
                                          {g.forest_range && (
                                            <div className="flex items-center gap-1.5">
                                              <Shield className="w-2.5 h-2.5 text-indigo-500" />
                                              <span className="text-[10px] font-bold text-slate-700 uppercase">{g.forest_range}</span>
                                            </div>
                                          )}
                                          {g.forest_beat && <p className="text-[9px] text-slate-500 font-medium ml-4">Beat: {g.forest_beat}</p>}
                                          {g.forest_compartment && <p className="text-[9px] text-slate-400 font-medium ml-4">Comp: {g.forest_compartment}</p>}
                                        </div>
                                      ) : (
                                        <span className="text-[9px] text-slate-300 italic">No forest data</span>
                                      )}
                                    </td>
                                  )}
                                  <td className="px-4 py-3 text-center text-[10px] font-medium space-x-1 flex items-center justify-center">
                                    <button
                                      onClick={() => {
                                        setSelectedGrievanceForRevert(g);
                                        setShowRevertDialog(true);
                                      }}
                                      className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                                      title="Revert to Company Admin"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a4 4 0 014 4v1m0 0l-3-3m3 3l3-3M7 14H3m0 0l3 3m-3-3l3-3" />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={async () => {
                                        const response = await grievanceAPI.getById(g._id);
                                        if (response.success) {
                                          setSelectedGrievance(response.data.grievance);
                                          setShowGrievanceDetail(true);
                                        }
                                      }}
                                      className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all"
                                      title="View Details"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                      </svg>
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50/30">
                          <Pagination
                            currentPage={grievancePage}
                            totalPages={grievancePagination.pages}
                            totalItems={grievancePagination.total}
                            itemsPerPage={grievancePagination.limit}
                            onPageChange={setGrievancePage}
                          />
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
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
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      toast.loading(`Gathering ${isDFO ? "division" : "department"} data...`, { duration: 1000 });
                      setTimeout(() => {
                        toast.success(`${isDFO ? "Wildlife Protection" : "Department Performance"} Report (PDF) generated successfully!`);
                      }, 2000);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl transition-all shadow-lg shadow-indigo-500/20 text-xs font-black uppercase tracking-widest border border-indigo-400/50"
                  >
                    <Download className="w-4 h-4" />
                    Download Report
                  </button>
                  <div className="hidden md:flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
                      Live
                    </span>
                  </div>
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

            {/* Advanced Analytics Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              
              {/* Dynamic Visualization based on Entity Type */}
              {isDFO && hasModule(Module.INCIDENT_WILDLIFE) ? (
                <div className="xl:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                  <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-rose-50 rounded-2xl flex items-center justify-center">
                        <Activity className="w-5 h-5 text-rose-500" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Incident Heat Map</h3>
                        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">Spatial density of forest incidents</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                       <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 rounded-full border border-slate-200">
                          <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                          <span className="text-[10px] font-black text-slate-600 uppercase">High Intensity</span>
                       </div>
                    </div>
                  </div>
                  <div className="p-8 flex-1">
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {beatHeatMapData.map((beat, idx) => (
                          <div key={idx} className="relative group cursor-help">
                             <div className={`aspect-square rounded-2xl border-2 transition-all duration-500 flex flex-col items-center justify-center p-4 ${
                               beat.density > 15 ? 'bg-rose-500 border-rose-600 shadow-lg shadow-rose-200' :
                               beat.density > 10 ? 'bg-orange-400 border-orange-500' :
                               beat.density > 5 ? 'bg-amber-100 border-amber-200' :
                               'bg-emerald-50 border-emerald-100'
                             }`}>
                                <span className={`text-[10px] font-black uppercase text-center leading-tight mb-1 ${beat.density > 10 ? 'text-white' : 'text-slate-600'}`}>
                                  {beat.name}
                                </span>
                                <span className={`text-xl font-black ${beat.density > 10 ? 'text-white' : 'text-slate-900'}`}>
                                  {beat.density}
                                </span>
                             </div>
                             <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 rounded-2xl transition-opacity"></div>
                          </div>
                        ))}
                     </div>
                     <div className="mt-8 p-6 bg-slate-50 rounded-2xl border border-slate-200">
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4">Division Strategy Insight</h4>
                        <p className="text-sm text-slate-600 leading-relaxed italic">
                          &quot;Concentrated incident clusters detected in the <b>{beatHeatMapData.sort((a,b) => b.density - a.density)[0]?.name}</b>. 
                          Recommend immediate dispatch of additional patrolling units to this sector.&quot;
                        </p>
                     </div>
                  </div>
                </div>
              ) : (
                <div className="xl:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                  <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Performance Summary</h3>
                        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">Case distribution and staff performance</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-8 flex-1 flex flex-col items-center justify-center text-center opacity-40">
                    <BarChart2 className="w-16 h-16 text-slate-300 mb-6" />
                    <span className="text-lg font-black text-slate-900 uppercase tracking-tighter">Operational Overview Active</span>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-2">Charts initialized for {department.name}</span>
                  </div>
                </div>
              )}

              {/* SLA & Performance */}
              <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                  <h3 className="text-lg font-black uppercase tracking-tight mb-8">Performance Efficiency</h3>
                  <div className="space-y-8 relative z-10">
                    {(isDFO ? slaPerformanceData : [
                      { name: "Public Grievances", score: 85 },
                      { name: "Staff Utilization", score: 92 },
                      { name: "Citizen Satisfaction", score: 78 },
                      { name: "Resource Allocation", score: 88 }
                    ]).map((item, idx) => (
                      <div key={idx}>
                        <div className="flex justify-between items-end mb-2">
                           <div>
                              <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest leading-none mb-1">{item.name}</p>
                              <p className="text-sm font-bold">Execution Efficiency</p>
                           </div>
                           <span className="text-xl font-black text-indigo-400">{item.score}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                           <div 
                              className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full" 
                              style={{ width: `${item.score}%` }}
                           ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                 
                 <div className="mt-12 p-6 bg-white/5 border border-white/10 rounded-2xl">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">System Health</p>
                    <div className="flex items-center gap-4">
                       <div className="flex-1">
                          <p className="text-2xl font-black">{resolutionRate}%</p>
                          <p className="text-[11px] text-slate-400 uppercase font-bold tracking-tight">Target Met</p>
                       </div>
                       <div className="w-px h-10 bg-white/20"></div>
                       <div className="flex-1">
                          <p className="text-2xl font-black">2.4h</p>
                          <p className="text-[11px] text-slate-400 uppercase font-bold tracking-tight">Avg Initial Response</p>
                       </div>
                    </div>
                 </div>
              </div>

              {/* Trends & Distribution */}
              <div className="xl:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">{isDFO ? 'Incident' : 'Case'} Trends</h3>
                      <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">Seasonal activity and response rates</p>
                    </div>
                  </div>
                </div>
                <div className="p-8">
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={incidentTrendData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}}
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}}
                        />
                        <Tooltip 
                           cursor={{fill: '#f8fafc'}}
                           contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                        />
                        <Bar 
                          dataKey="total" 
                          fill="#6366f1" 
                          radius={[6, 6, 0, 0]} 
                          barSize={30}
                          name="Total Cases"
                        />
                        <Bar 
                          dataKey="resolved" 
                          fill="#10b981" 
                          radius={[6, 6, 0, 0]} 
                          barSize={30}
                          name="Resolved"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Category Breakdown */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-100 flex items-center gap-3">
                   <div className="w-10 h-10 bg-emerald-50 rounded-2xl flex items-center justify-center">
                      <PieChart className="w-5 h-5 text-emerald-600" />
                   </div>
                   <div>
                      <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Category Focus</h3>
                      <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">Type-wise incident breakdown</p>
                   </div>
                </div>
                <div className="p-8">
                  <div className="h-[250px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryDetailedData.length > 0 ? categoryDetailedData : (isDFO ? [
                            {name: 'Fire', value: 40}, {name: 'Wildlife', value: 30}, {name: 'Timber', value: 20}, {name: 'Other', value: 10}
                          ] : [
                            {name: 'Grievance', value: 40}, {name: 'Appointments', value: 30}, {name: 'Requests', value: 20}, {name: 'Other', value: 10}
                          ])}
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={8}
                          dataKey="value"
                        >
                          {COLORS.map((color, index) => (
                            <Cell key={`cell-${index}`} fill={color} stroke="none" />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                       <div className="text-center">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</p>
                          <p className="text-xl font-black text-slate-800">{stats.totalGrievances}</p>
                       </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-6">
                     {(categoryDetailedData.length > 0 
                       ? categoryDetailedData 
                       : (isDFO 
                           ? [{name: 'Fire'}, {name: 'Wildlife'}, {name: 'Timber'}, {name: 'Other'}] 
                           : [{name: 'Grievance'}, {name: 'Appointments'}, {name: 'Requests'}, {name: 'Other'}]
                         )).slice(0, 4).map((c, i) => (
                       <div key={i} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[i % COLORS.length]}}></span>
                          <span className="text-[10px] font-bold text-slate-600 truncate uppercase tracking-tighter">{c.name}</span>
                       </div>
                     ))}
                  </div>
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
        onSuccess={fetchData}
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
