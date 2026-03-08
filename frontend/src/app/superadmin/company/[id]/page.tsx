"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
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
import { companyAPI, Company } from "@/lib/api/company";
import { departmentAPI, Department } from "@/lib/api/department";
import { userAPI, User } from "@/lib/api/user";
import { apiClient } from "@/lib/api/client";
import { grievanceAPI, Grievance } from "@/lib/api/grievance";
import { appointmentAPI, Appointment } from "@/lib/api/appointment";
import GrievanceDetailDialog from "@/components/grievance/GrievanceDetailDialog";
import AppointmentDetailDialog from "@/components/appointment/AppointmentDetailDialog";
import UserDetailsDialog from "@/components/user/UserDetailsDialog";
import StatusUpdateModal from "@/components/grievance/StatusUpdateModal";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import RoleManagement from "@/components/roles/RoleManagement";
import NotificationManagement from "@/components/superadmin/drilldown/NotificationManagement";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import toast from "react-hot-toast";
import dynamic from "next/dynamic";
import {
  Building,
  Users,
  FileText,
  Calendar,
  ArrowLeft,
  Download,
  RefreshCw,
  CheckCircle,
  Clock,
  TrendingUp,
  MessageSquare,
  Mail,
  Workflow,
  Plus,
  ChevronRight,
  Menu,
  X,
  AlertCircle,
  FileSpreadsheet,
  Upload,
  Info,
} from "lucide-react";
import { Module } from "@/lib/permissions";
import BulkImportModal from "@/components/superadmin/drilldown/BulkImportModal";
import StatsOverview from "@/components/superadmin/drilldown/StatsOverview";
import DepartmentList from "@/components/superadmin/drilldown/DepartmentList";
import UserList from "@/components/superadmin/drilldown/UserList";
import GrievanceList from "@/components/superadmin/drilldown/GrievanceList";
import AppointmentList from "@/components/superadmin/drilldown/AppointmentList";
import LeadList from "@/components/superadmin/drilldown/LeadList";

const CompanyAnalytics = dynamic(
  () => import("@/components/superadmin/drilldown/CompanyAnalytics"),
  {
    loading: () => (
      <div className="h-[300px] flex items-center justify-center bg-white border border-slate-200 rounded-2xl animate-pulse text-[10px] font-black uppercase text-slate-400">
        Loading Engine Statistics...
      </div>
    ),
    ssr: false,
  },
);

// BulkImportModal moved to @/components/superadmin/drilldown/BulkImportModal

export default function CompanyDrillDown() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;

  const [company, setCompany] = useState<Company | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalDepartments: 0,
    totalGrievances: 0,
    totalAppointments: 0,
    activeUsers: 0,
    pendingGrievances: 0,
    resolvedGrievances: 0,
  });
  const [deptUserCounts, setDeptUserCounts] = useState<Record<string, number>>({});
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedGrievance, setSelectedGrievance] = useState<Grievance | null>(
    null,
  );
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null);
  const [showGrievanceDetail, setShowGrievanceDetail] = useState(false);
  const [showAppointmentDetail, setShowAppointmentDetail] = useState(false);
  const [selectedUserForDetails, setSelectedUserForDetails] =
    useState<User | null>(null);
  const [showUserDetailsDialog, setShowUserDetailsDialog] = useState(false);
  const [showGrievanceStatusModal, setShowGrievanceStatusModal] =
    useState(false);
  const [selectedGrievanceForStatus, setSelectedGrievanceForStatus] =
    useState<Grievance | null>(null);
  const [whatsappConfig, setWhatsappConfig] = useState<any>(null);

  const [isDeleting, setIsDeleting] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

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
  }, [companyId, user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 🚀 Optimization: parallelize data fetching
      const [
        companyRes,
        deptRes,
        usersRes,
        analyticsRes,
        grievancesRes,
        appointmentsRes,
        waRes,
      ] = await Promise.all([
        companyAPI.getById(companyId),
        departmentAPI.getAll({ companyId, limit: 15 }),
        userAPI.getAll({ companyId, limit: 15 }),
        apiClient.get(`/analytics/dashboard?companyId=${companyId}`),
        grievanceAPI.getAll({ companyId, limit: 15 }),
        appointmentAPI.getAll({ companyId, limit: 15 }),
        apiClient.get(`/whatsapp-config/company/${companyId}`).catch(() => ({ success: false })),
      ]);

      if (waRes.success) setWhatsappConfig(waRes.data);

      if (companyRes.success) {
        setCompany(companyRes.data.company);
        if (
          companyRes.data.company.enabledModules?.includes(Module.LEAD_CAPTURE)
        ) {
          fetchLeads(companyId);
        }
      }

      if (deptRes.success) setDepartments(deptRes.data.departments || []);
      if (usersRes.success) setUsers(usersRes.data.users || []);
      if (grievancesRes.success)
        setGrievances(grievancesRes.data.grievances || []);
      if (appointmentsRes.success)
        setAppointments(appointmentsRes.data.appointments || []);

      // Use the analytics response for the most accurate and efficient counts
      if (analyticsRes.success) {
        const {
          grievances,
          appointments,
          users: totalUsers,
          activeUsers,
          departments: totalDepts,
        } = analyticsRes.data;
        setStats({
          totalUsers: totalUsers || 0,
          totalDepartments: totalDepts || 0,
          totalGrievances: grievances?.total || 0,
          totalAppointments: appointments?.total || 0,
          activeUsers: activeUsers || 0,
          pendingGrievances: grievances?.pending || 0,
          resolvedGrievances: grievances?.resolved || 0,
        });
      } else {
        // Fallback calculation if analytics fails
        setStats({
          totalUsers: usersRes.success
            ? usersRes.data.pagination?.total || usersRes.data.users?.length
            : 0,
          totalDepartments: deptRes.success
            ? deptRes.data.pagination?.total || deptRes.data.departments?.length
            : 0,
          totalGrievances: grievancesRes.success
            ? grievancesRes.data.pagination?.total ||
              grievancesRes.data.grievances?.length
            : 0,
          totalAppointments: appointmentsRes.success
            ? appointmentsRes.data.pagination?.total ||
              appointmentsRes.data.appointments?.length
            : 0,
          activeUsers: 0,
          pendingGrievances: 0,
          resolvedGrievances: 0,
        });
      }

      // Fetch all users for this company to calculate accurate department counts (Super Admin view)
      try {
        const companyUsersRes = await userAPI.getAll({ companyId, limit: 1000 });
        if (companyUsersRes.success) {
          const counts: Record<string, number> = {};
          for (const u of companyUsersRes.data.users) {
            const dId = typeof u.departmentId === "object" && u.departmentId
              ? (u.departmentId as any)._id || (u.departmentId as any).toString()
              : u.departmentId;
            if (dId) counts[dId] = (counts[dId] || 0) + 1;
          }
          setDeptUserCounts(counts);
        }
      } catch (err) {
        console.error("Failed to fetch all users for department counts", err);
      }
    } catch (error: any) {
      toast.error("Failed to load company data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeads = async (companyId: string) => {
    setLoadingLeads(true);
    try {
      const response = await apiClient.get(`/leads/company/${companyId}`);
      if (response.success) {
        setLeads(response.data || []);
      }
    } catch (error: any) {
      console.error("Failed to fetch leads:", error);
    } finally {
      setLoadingLeads(false);
    }
  };

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" | null = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    } else if (sortConfig.key === key && sortConfig.direction === "desc") {
      direction = null;
    }
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
          u.email?.toLowerCase().includes(search) ||
          u.userId?.toLowerCase().includes(search),
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
          g.grievanceId?.toLowerCase().includes(search) ||
          g.citizenPhone?.includes(search),
      );
    }
    if (statusFilter !== "all")
      filtered = filtered.filter((g) => g.status === statusFilter);
    return filtered;
  }, [grievances, searchTerm, statusFilter]);

  const filteredAppointments = useMemo(() => {
    let filtered = [...appointments];
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.citizenName?.toLowerCase().includes(search) ||
          a.appointmentId?.toLowerCase().includes(search) ||
          a.citizenPhone?.includes(search),
      );
    }
    if (statusFilter !== "all")
      filtered = filtered.filter((a) => a.status === statusFilter);
    return filtered;
  }, [appointments, searchTerm, statusFilter]);

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
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
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (!loading && !company)
    return (
      <div className="flex min-h-screen items-center justify-center text-center">
        <h2 className="text-2xl font-bold mb-4">Company not found</h2>
        <Button onClick={() => router.push("/superadmin/dashboard")}>
          Back
        </Button>
      </div>
    );

  const grievanceStatusData = [
    { name: "Pending", value: stats.pendingGrievances, color: "#FFBB28" },
    { name: "Resolved", value: stats.resolvedGrievances, color: "#00C49F" },
    {
      name: "Active",
      value:
        stats.totalGrievances -
        stats.pendingGrievances -
        stats.resolvedGrievances,
      color: "#0088FE",
    },
  ].filter((item) => item.value > 0);

  const userRoleData = users.reduce((acc: any[], u) => {
    const existing = acc.find((item) => item.name === u.role);
    if (existing) existing.value++;
    else acc.push({ name: u.role, value: 1 });
    return acc;
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50 shadow-xl transition-all h-20">
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        ></div>
        <div className="max-w-[1600px] mx-auto px-4 lg:px-8 h-full flex items-center justify-between relative">
          <div className="flex items-center gap-3 lg:gap-6">
            <Button
              variant="ghost"
              onClick={() => router.push("/superadmin/dashboard")}
              className="hidden md:flex bg-white bg-opacity-10 hover:bg-opacity-20 text-white h-11 px-4 rounded-xl border border-white border-opacity-10 transition-all group"
            >
              <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
              <span className="text-xs font-bold uppercase tracking-tight">
                Dashboard
              </span>
            </Button>
            <div className="w-10 h-10 lg:w-11 lg:h-11 bg-white bg-opacity-10 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white border-opacity-10 shadow-lg">
              <Building className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
            </div>
            <div className="max-w-[150px] sm:max-w-none">
              <h1 className="text-sm lg:text-xl font-black text-white tracking-tight uppercase leading-none truncate">
                {company?.name || "Matrix Node"}
              </h1>
              <div className="flex items-center gap-2 mt-1 lg:mt-2">
                <span className="bg-indigo-500 bg-opacity-20 text-indigo-300 px-1.5 py-0.5 rounded text-[8px] lg:text-[9px] border border-indigo-500 border-opacity-20 font-black uppercase tracking-widest">
                  {company?.companyId || companyId || "..."}
                </span>
                <span className="hidden sm:inline text-[9px] lg:text-[10px] text-slate-400 font-bold uppercase tracking-widest opacity-60">
                  • Super Admin Portal
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 lg:gap-4">
            {!loading && (
              <div className="hidden md:flex bg-white/5 p-1 rounded-2xl border border-white/10 backdrop-blur-sm">
                <Button
                  variant="ghost"
                  className="h-9 px-4 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-wider"
                  onClick={() =>
                    router.push(
                      `/superadmin/company/${companyId}/whatsapp-config`,
                    )
                  }
                >
                  <MessageSquare className="w-3.5 h-3.5 mr-2 text-indigo-400" />
                  WhatsApp
                </Button>
                <Button
                  variant="ghost"
                  className="h-9 px-4 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-wider"
                  onClick={() =>
                    router.push(`/superadmin/company/${companyId}/email-config`)
                  }
                >
                  <Mail className="w-3.5 h-3.5 mr-2 text-blue-400" />
                  Email
                </Button>
                <Button
                  variant="ghost"
                  className="h-9 px-5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all hover:scale-105"
                  onClick={() =>
                    router.push(`/superadmin/company/${companyId}/chatbot-flows`)
                  }
                >
                  <Workflow className="w-3.5 h-3.5 mr-2" />
                  Flows
                </Button>
              </div>
            )}
            <div className="hidden md:block h-11 w-px bg-slate-700/50 mx-2"></div>
            <Button
              variant="ghost"
              onClick={fetchData}
              disabled={loading}
              className="hidden sm:flex h-11 w-11 p-0 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 border border-transparent hover:border-white/10 items-center justify-center"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-white bg-white/10 rounded-lg"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu Overlay for Company Portal */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-20 left-0 w-full bg-slate-900 border-b border-slate-800 z-50 animate-in slide-in-from-top-4 duration-300 shadow-2xl">
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="ghost"
                  className="w-full h-12 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center"
                  onClick={() =>
                    router.push(
                      `/superadmin/company/${companyId}/whatsapp-config`,
                    )
                  }
                >
                  <MessageSquare className="w-4 h-4 mr-2 text-indigo-400" />
                  WhatsApp
                </Button>
                <Button
                  variant="ghost"
                  className="w-full h-12 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center"
                  onClick={() =>
                    router.push(`/superadmin/company/${companyId}/email-config`)
                  }
                >
                  <Mail className="w-4 h-4 mr-2 text-blue-400" />
                  Email
                </Button>
              </div>
              <Button
                variant="ghost"
                className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center justify-center shadow-lg shadow-indigo-600/20"
                onClick={() =>
                  router.push(`/superadmin/company/${companyId}/chatbot-flows`)
                }
              >
                <Workflow className="w-4 h-4 mr-2" />
                Flow Management
              </Button>
              <div className="pt-3 border-t border-slate-800 flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() => router.push("/superadmin/dashboard")}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white h-12 rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-widest"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Dashboard
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    fetchData();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-12 h-12 bg-white/5 text-slate-400 rounded-xl flex items-center justify-center"
                >
                  <RefreshCw className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </header>
      {loading && !company ? (
        <div className="flex-1 flex items-center justify-center p-20 min-h-[60vh]">
          <LoadingSpinner text="Synchronizing neural dashboard..." />
        </div>
      ) : (
        <main className="max-w-[1600px] mx-auto w-full px-4 py-8 overflow-hidden">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList className="bg-slate-100 p-1 lg:p-1.5 rounded-2xl h-auto gap-1 lg:gap-1.5 border border-slate-200/60 shadow-inner w-full flex overflow-x-auto no-scrollbar justify-start sm:justify-center">
            <TabsTrigger
              value="overview"
              className="px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-all"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="departments"
              className="px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-all"
            >
              Departments
            </TabsTrigger>
            <TabsTrigger
              value="users"
              className="px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-all"
            >
              Users
            </TabsTrigger>
            {(!company ||
              company.enabledModules?.includes(Module.GRIEVANCE)) && (
              <TabsTrigger
                value="grievances"
                className="px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-all"
              >
                Grievances
              </TabsTrigger>
            )}
            {(!company ||
              company.enabledModules?.includes(Module.APPOINTMENT)) && (
              <TabsTrigger
                value="appointments"
                className="px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-all"
              >
                Appointments
              </TabsTrigger>
            )}
            {(!company ||
              company.enabledModules?.includes(Module.LEAD_CAPTURE)) && (
              <TabsTrigger
                value="leads"
                className="px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-all"
              >
                Project Leads
              </TabsTrigger>
            )}
            <TabsTrigger
              value="analytics"
              className="px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-all"
            >
              Analytics
            </TabsTrigger>
            <TabsTrigger
              value="roles"
              className="px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-all"
            >
              Roles
            </TabsTrigger>
            <TabsTrigger
              value="notifications"
              className="px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-all border border-transparent data-[state=active]:border-indigo-100"
            >
              Notifications
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <StatsOverview stats={stats} setActiveTab={setActiveTab} />
          </TabsContent>

          <TabsContent value="departments" className="mt-0">
            <DepartmentList
              departments={departments}
              deptUserCounts={deptUserCounts}
              setIsImportModalOpen={setIsImportModalOpen}
              exportToCSV={exportToCSV}
              onRefresh={fetchData}
              refreshing={loading}
            />
          </TabsContent>

          <TabsContent value="users" className="mt-0">
            <UserList 
              users={users}
              filteredUsers={filteredUsers}
              exportToCSV={exportToCSV}
              setSelectedUserForDetails={setSelectedUserForDetails}
              setShowUserDetailsDialog={setShowUserDetailsDialog}
              onRefresh={fetchData}
              refreshing={loading}
            />
          </TabsContent>

          <TabsContent value="grievances" className="mt-0">
            <GrievanceList 
              grievances={grievances}
              filteredGrievances={filteredGrievances}
              exportToCSV={exportToCSV}
              setSelectedGrievance={setSelectedGrievance}
              setShowGrievanceDetail={setShowGrievanceDetail}
              onRefresh={fetchData}
              refreshing={loading}
            />
          </TabsContent>

          <TabsContent value="appointments" className="mt-0">
            <AppointmentList 
              appointments={appointments}
              filteredAppointments={filteredAppointments}
              exportToCSV={exportToCSV}
              setSelectedAppointment={setSelectedAppointment}
              setShowAppointmentDetail={setShowAppointmentDetail}
              onRefresh={fetchData}
              refreshing={loading}
            />
          </TabsContent>

          <TabsContent value="leads" className="mt-0">
            <LeadList 
              leads={leads} 
              exportToCSV={exportToCSV} 
              onRefresh={() => fetchLeads(companyId)}
              refreshing={loadingLeads}
            />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <CompanyAnalytics
              grievanceStatusData={grievanceStatusData}
              userRoleData={userRoleData}
            />
          </TabsContent>

          <TabsContent value="roles" className="mt-0">
            <RoleManagement companyId={companyId} />
          </TabsContent>

          <TabsContent value="notifications" className="mt-0">
            <NotificationManagement companyId={companyId} />
          </TabsContent>
        </Tabs>
      </main>
      )}

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
      <UserDetailsDialog
        isOpen={showUserDetailsDialog}
        user={selectedUserForDetails}
        onClose={() => {
          setShowUserDetailsDialog(false);
          setSelectedUserForDetails(null);
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
        onSuccess={fetchData}
        grievanceVariant="department-admin"
      />

      <BulkImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        companyId={companyId}
        onSuccess={fetchData}
      />
    </div>
  );
}
