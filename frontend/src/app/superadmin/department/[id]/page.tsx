"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
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
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import toast from "react-hot-toast";
import {
  Building,
  Users,
  FileText,
  Calendar,
  ArrowLeft,
  BarChart2,
  Search,
  ArrowUpDown,
  Download,
  RefreshCw,
  TrendingUp,
  Clock,
  LayoutDashboard,
} from "lucide-react";
import dynamic from "next/dynamic";
import DeptStatsOverview from "@/components/superadmin/drilldown/DeptStatsOverview";
import DeptUserList from "@/components/superadmin/drilldown/DeptUserList";
import DeptGrievanceList from "@/components/superadmin/drilldown/DeptGrievanceList";
import DeptAppointmentList from "@/components/superadmin/drilldown/DeptAppointmentList";

const DeptAnalytics = dynamic(
  () => import("@/components/superadmin/drilldown/DeptAnalytics"),
  {
    loading: () => (
      <div className="h-[300px] flex items-center justify-center bg-white border border-slate-200 rounded-2xl animate-pulse text-[10px] font-black uppercase text-slate-400">
        Loading Analytics...
      </div>
    ),
    ssr: false,
  },
);

export default function DepartmentDrillDown() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const departmentId = params.id as string;
  const companyId = searchParams.get("companyId");

  const [department, setDepartment] = useState<Department | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
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

  // Filter & Sort states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc" | null;
  }>({ key: "", direction: null });

  useEffect(() => {
    if (user?.role !== "SUPER_ADMIN") {
      router.push("/superadmin/dashboard");
      return;
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId, companyId, user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 🚀 Optimization: parallelize data fetching
      const [deptRes, usersRes, grievancesRes, appointmentsRes, statsRes] =
        await Promise.all([
          departmentAPI.getById(departmentId),
          userAPI.getAll({ departmentId }),
          grievanceAPI.getAll({ departmentId, limit: 100 }),
          appointmentAPI.getAll({ departmentId, limit: 100 }),
          apiClient.get(`/analytics/dashboard?departmentId=${departmentId}`),
        ]);

      if (deptRes.success) {
        setDepartment(deptRes.data.department);
        const deptCompanyId =
          typeof deptRes.data.department.companyId === "object"
            ? deptRes.data.department.companyId?._id
            : deptRes.data.department.companyId;

        if (deptCompanyId) {
          companyAPI.getById(deptCompanyId).then((res) => {
            if (res.success) setCompany(res.data.company);
          });
        }
      }

      if (usersRes.success) setUsers(usersRes.data.users);
      if (grievancesRes.success) setGrievances(grievancesRes.data.grievances);
      if (appointmentsRes.success)
        setAppointments(appointmentsRes.data.appointments);

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

  // Sort handler
  const handleSort = (key: string) => {
    let direction: "asc" | "desc" | null = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    } else if (sortConfig.key === key && sortConfig.direction === "desc") {
      direction = null;
    }
    setSortConfig({ key, direction });
  };

  // Filtered users
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
    if (roleFilter !== "all") {
      filtered = filtered.filter((u) => u.role === roleFilter);
    }
    if (statusFilter !== "all") {
      filtered = filtered.filter((u) =>
        statusFilter === "active" ? u.isActive : !u.isActive,
      );
    }
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

  // Filtered grievances
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
    if (statusFilter !== "all") {
      filtered = filtered.filter((g) => g.status === statusFilter);
    }
    return filtered;
  }, [grievances, searchTerm, statusFilter]);

  // Filtered appointments
  const filteredAppointments = useMemo(() => {
    let filtered = [...appointments];
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.citizenName?.toLowerCase().includes(search) ||
          a.appointmentId?.toLowerCase().includes(search),
      );
    }
    if (statusFilter !== "all") {
      filtered = filtered.filter((a) => a.status === statusFilter);
    }
    return filtered;
  }, [appointments, searchTerm, statusFilter]);

  // Export function
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
          <Button onClick={() => router.push("/superadmin/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const grievanceStatusData = [
    { name: "Pending", value: stats.pendingGrievances, color: "#FFBB28" },
    { name: "Resolved", value: stats.resolvedGrievances, color: "#00C49F" },
    {
      name: "In Progress",
      value:
        stats.totalGrievances -
        stats.pendingGrievances -
        stats.resolvedGrievances,
      color: "#0088FE",
    },
  ].filter((item) => item.value > 0);

  const userRoleData = users.reduce((acc: any[], user) => {
    const roleForMap = user.role || "CUSTOM";
    const existing = acc.find((item) => item.name === roleForMap);
    if (existing) existing.value++;
    else acc.push({ name: roleForMap, value: 1 });
    return acc;
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Premium Admin Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50 transition-all duration-300 shadow-2xl overflow-hidden">
        {/* Subtle Background Pattern */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          ></div>
        </div>

        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 relative z-10">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-6">
              <Button
                variant="ghost"
                onClick={() =>
                  companyId
                    ? router.push(`/superadmin/company/${companyId}`)
                    : router.push("/superadmin/dashboard")
                }
                className="text-slate-400 hover:text-white hover:bg-white/10 transition-all -ml-2 h-10 w-10 p-0 rounded-xl border border-transparent hover:border-slate-800"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>

              <div className="w-10 h-10 bg-indigo-600/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                <Building className="w-5 h-5 text-indigo-400" />
              </div>

              <div>
                <h1 className="text-xl font-bold text-white tracking-tight leading-none uppercase">
                  {department?.name}
                </h1>
                <div className="flex items-center gap-2 mt-1.5">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    Department Management Portal
                  </p>
                  {company && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-indigo-500"></span>
                      <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">
                        {company.name}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden lg:flex flex-col items-end border-r border-slate-800 pr-4 mr-1">
                <span className="text-[11px] font-black text-white uppercase tracking-wider">
                  Sync Active
                </span>
                <span className="text-[9px] text-emerald-400 font-black uppercase tracking-[0.2em] mt-0.5">
                  Live Connection
                </span>
              </div>
              <Button
                onClick={fetchData}
                variant="ghost"
                size="sm"
                className="h-10 px-4 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 font-bold text-[11px] uppercase tracking-wider"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto w-full px-4 py-4">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <div className="mb-4 sticky top-[64px] z-40 bg-slate-50/95 backdrop-blur-sm py-4 -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="bg-slate-200/50 p-1 border border-slate-300/50 h-10 shadow-sm overflow-x-auto no-scrollbar max-w-full">
              <TabsTrigger
                value="overview"
                className="px-6 h-8 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="users"
                className="px-6 h-8 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg"
              >
                Users
              </TabsTrigger>
              <TabsTrigger
                value="grievances"
                className="px-6 h-8 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg"
              >
                Grievances
              </TabsTrigger>
              <TabsTrigger
                value="appointments"
                className="px-6 h-8 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg"
              >
                Appointments
              </TabsTrigger>
              <TabsTrigger
                value="analytics"
                className="px-6 h-8 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg flex items-center"
              >
                <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
                Analytics
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <DeptStatsOverview stats={stats} setActiveTab={setActiveTab} />

            {/* Department Details */}
            <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
              <CardHeader className="bg-slate-900 px-6 py-4">
                <CardTitle className="text-base font-bold text-white uppercase tracking-tight flex items-center gap-2">
                  <Building className="w-4 h-4 text-indigo-400" />
                  Department Infrastructure Status
                </CardTitle>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                  Core department settings and identity
                </p>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="p-4 bg-gradient-to-br from-slate-50 to-purple-50 rounded-xl border border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                      Department ID
                    </p>
                    <p className="text-lg font-bold text-slate-800">
                      {department.departmentId}
                    </p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-slate-50 to-purple-50 rounded-xl border border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                      Company
                    </p>
                    <p className="text-lg font-bold text-slate-800">
                      {company?.name || "N/A"}
                    </p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-slate-50 to-purple-50 rounded-xl border border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                      Status
                    </p>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${department.isActive !== false ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
                    >
                      Active
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            <DeptUserList
              filteredUsers={filteredUsers}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              roleFilter={roleFilter}
              setRoleFilter={setRoleFilter}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              handleSort={handleSort}
              exportToCSV={exportToCSV}
              onRefresh={fetchData}
              refreshing={loading}
            />
          </TabsContent>

          {/* Grievances Tab */}
          <TabsContent value="grievances" className="space-y-6">
            <DeptGrievanceList
              filteredGrievances={filteredGrievances}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              setSelectedGrievance={setSelectedGrievance}
               setShowGrievanceDetail={setShowGrievanceDetail}
               exportToCSV={exportToCSV}
               onRefresh={fetchData}
               refreshing={loading}
             />
          </TabsContent>

          {/* Appointments Tab */}
          <TabsContent value="appointments" className="space-y-6">
            <DeptAppointmentList
              filteredAppointments={filteredAppointments}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              setSelectedAppointment={setSelectedAppointment}
               setShowAppointmentDetail={setShowAppointmentDetail}
               exportToCSV={exportToCSV}
               onRefresh={fetchData}
               refreshing={loading}
             />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <DeptAnalytics
              grievanceStatusData={grievanceStatusData}
              userRoleData={userRoleData}
            />
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
    </div>
  );
}
