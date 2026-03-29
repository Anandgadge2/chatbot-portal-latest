"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyContext } from "@/contexts/CompanyContext";
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
import { userAPI, User } from "@/lib/api/user";
import { apiClient } from "@/lib/api/client";
import { grievanceAPI, Grievance } from "@/lib/api/grievance";
import { appointmentAPI, Appointment } from "@/lib/api/appointment";
import GrievanceDetailDialog from "@/components/grievance/GrievanceDetailDialog";
import AppointmentDetailDialog from "@/components/appointment/AppointmentDetailDialog";
import UserDetailsDialog from "@/components/user/UserDetailsDialog";
import StatusUpdateModal from "@/components/grievance/StatusUpdateModal";
import AssignmentModal from "@/components/grievance/AssignmentModal";
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
  Eye,
  ChevronRight,
  Menu,
  X,
  AlertCircle,
  FileSpreadsheet,
  Upload,
  Info,
  Search,
  Trash2,
} from "lucide-react";
import { Module } from "@/lib/permissions";
import BulkImportModal from "@/components/superadmin/drilldown/BulkImportModal";
import StatsOverview from "@/components/superadmin/drilldown/StatsOverview";
import DepartmentList from "@/components/superadmin/drilldown/DepartmentList";
import UserList from "@/components/superadmin/drilldown/UserList";
import GrievanceList from "@/components/superadmin/drilldown/GrievanceList";
import AppointmentList from "@/components/superadmin/drilldown/AppointmentList";
import LeadTable from "@/components/superadmin/drilldown/LeadTable";
import { Pagination } from "@/components/ui/Pagination";
import { useWhatsappConfig } from "@/lib/query/useWhatsappConfig";
import WhatsAppConfigTab from "@/components/superadmin/drilldown/tabs/WhatsAppConfigTab";
import EmailConfigTab from "@/components/superadmin/drilldown/tabs/EmailConfigTab";
import ChatbotFlowsTab from "@/components/superadmin/drilldown/tabs/ChatbotFlowsTab";
import { useFlows } from "@/lib/query/useFlows";
import FlowSimulator from "@/components/flow-builder/FlowSimulator";

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
const PAGE_SIZE = 10;

function CompanyDrillDownContent() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const companyId = (params.id || params.companyId) as string;
  const { company, isLoading: companyLoading } = useCompanyContext();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "overview");

  // Sync tab to URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", activeTab);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }, [activeTab]);
  useWhatsappConfig(companyId || undefined);
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
  const [leadsPage, setLeadsPage] = useState(1);
  const [leadsTotal, setLeadsTotal] = useState(0);
  const { data: flows } = useFlows(companyId);
  const activeFlow = useMemo(() => flows?.find((f: any) => f.isActive), [flows]);
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [customRoles, setCustomRoles] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingLeads, setLoadingLeads] = useState(false);
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
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [grievanceToAssign, setGrievanceToAssign] = useState<Grievance | null>(null);

  const [isDeleting, setIsDeleting] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedAppointments, setSelectedAppointments] = useState<Set<string>>(
    new Set(),
  );

  // Filter & Sort states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc" | null;
  }>({ key: "", direction: null });

  useEffect(() => {
    if (!user?.isSuperAdmin) {
      router.push("/dashboard");
      return;
    }
    if (companyId) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        deptRes,
        usersRes,
        analyticsRes,
      ] = await Promise.all([
        departmentAPI.getAll({ companyId, limit: 25 }),
        userAPI.getAll({ companyId, limit: 25 }),
        apiClient.get(`/analytics/dashboard?companyId=${companyId}`),
      ]);

      if (deptRes.success) setDepartments(deptRes.data.departments || []);
      if (usersRes.success) setUsers(usersRes.data.users || []);

      const { roleAPI } = await import("@/lib/api/role");
      const roleRes = await roleAPI.getRoles(companyId);
      if (roleRes.success) {
        setCustomRoles((roleRes.data.roles || []).filter((r: any) => r.level > 0));
      }

      if (analyticsRes.success) {
        const {
          grievances,
          appointments,
          users: totalUsers,
          activeUsers,
          departments: totalDepts,
          deptCounts = [],
        } = analyticsRes.data;
        const counts: Record<string, number> = {};
        for (const d of deptCounts) {
          const deptId =
            typeof d?._id === "object" && d?._id !== null
              ? d._id.toString()
              : d?._id;
          if (deptId) counts[deptId] = d.count ?? 0;
        }
        setDeptUserCounts(counts);
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
        setStats({
          totalUsers: usersRes.success
            ? usersRes.data.pagination?.total || usersRes.data.users?.length
            : 0,
          totalDepartments: deptRes.success
            ? deptRes.data.pagination?.total || deptRes.data.departments?.length
            : 0,
          totalGrievances: grievances.length,
          totalAppointments: appointments.length,
          activeUsers: 0,
          pendingGrievances: 0,
          resolvedGrievances: 0,
        });
      }
    } catch (error: any) {
      toast.error("Failed to load company data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeads = async (companyId: string, page = 1) => {
    setLoadingLeads(true);
    try {
      const response = await apiClient.get(
        `/leads/company/${companyId}?page=${page}&limit=${PAGE_SIZE}`,
      );
      if (response.success) {
        setLeads(response.data || []);
        setLeadsTotal(response.pagination?.total || response.data?.length || 0);
      }
    } catch (error: any) {
      console.error("Failed to fetch leads:", error);
    } finally {
      setLoadingLeads(false);
    }
  };

  const fetchGrievances = async () => {
    try {
      const response = await grievanceAPI.getAll({ companyId, limit: 25 });
      if (response.success) {
        setGrievances(response.data.grievances || []);
      }
    } catch (error) {
      console.error("Failed to fetch grievances:", error);
    }
  };

  const fetchAppointments = async () => {
    try {
      const response = await appointmentAPI.getAll({ companyId, limit: 100 });
      if (response.success) {
        setAppointments(response.data.appointments || []);
      }
    } catch (error) {
      console.error("Failed to fetch appointments:", error);
    }
  };

  const handleBulkDeleteAppointments = async () => {
    if (selectedAppointments.size === 0) return;

    if (
      !confirm(
        `Are you sure you want to delete ${selectedAppointments.size} appointment(s)? This action cannot be undone.`,
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await appointmentAPI.deleteBulk(
        Array.from(selectedAppointments),
      );
      if (response.success) {
        toast.success(response.message);
        setAppointments((prev) =>
          prev.filter((a) => !selectedAppointments.has(a._id)),
        );
        setSelectedAppointments(new Set());
        fetchData();
      } else {
        toast.error("Failed to delete appointments");
      }
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to delete appointments",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    if (!company?.enabledModules?.includes(Module.LEAD_CAPTURE)) return;
    if (activeTab !== "overview" && activeTab !== "leads") return;
    fetchLeads(companyId, leadsPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, companyId, leadsPage, company?.enabledModules]);

  useEffect(() => {
    if (!company?.enabledModules?.includes(Module.GRIEVANCE)) return;
    if (activeTab !== "overview" && activeTab !== "grievances") return;
    fetchGrievances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, companyId, company?.enabledModules]);

  useEffect(() => {
    if (!company?.enabledModules?.includes(Module.APPOINTMENT)) return;
    if (activeTab !== "overview" && activeTab !== "appointments") return;
    fetchAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, companyId, company?.enabledModules]);

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
    if (roleFilter !== "all" && roleFilter !== "") {
      filtered = filtered.filter((u) => {
        const uRoleId = typeof u.customRoleId === "object" ? (u.customRoleId as any)?._id : u.customRoleId;
        return uRoleId === roleFilter || u.role === roleFilter;
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

  if (!loading && !companyLoading && !company)
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
              onClick={() => router.push("/dashboard")}
              className="hidden md:flex bg-white bg-opacity-10 hover:bg-opacity-20 text-white h-11 px-4 rounded-xl border border-white border-opacity-10 transition-all group"
            >
              <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
              <span className="text-xs font-bold uppercase tracking-tight">
                Back to Dashboard
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
                  • System Management
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 lg:gap-4">
            <div className="hidden md:block h-11 w-px bg-slate-700/50 mx-2"></div>
            <Button
              variant="ghost"
              onClick={fetchData}
              disabled={loading}
              className="hidden sm:flex h-11 w-11 p-0 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 border border-transparent hover:border-white/10 items-center justify-center"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
            </Button>
            {activeFlow && (
              <Button
                onClick={() => setSimulatorOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white h-11 px-6 rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-900/20 border border-emerald-500/30 flex items-center justify-center transition-all group active:scale-95"
              >
                <Eye className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                Simulate Live Bot
              </Button>
            )}
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
              <div className="pt-3 border-t border-slate-800 flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() => router.push("/dashboard")}
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
      {loading || companyLoading ? (
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

            <TabsTrigger
              value="whatsapp"
              className="px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-all"
            >
              WhatsApp
            </TabsTrigger>
            <TabsTrigger
              value="email"
              className="px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-all"
            >
              Email
            </TabsTrigger>
            <TabsTrigger
              value="flows"
              className="px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-all"
            >
              Flows
            </TabsTrigger>
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
            <StatsOverview stats={stats} company={company} setActiveTab={setActiveTab} />
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="relative flex-1 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <input 
                  type="text"
                  placeholder="Search by name, email or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold"
                />
              </div>
              <div className="flex items-center gap-3">
                <select 
                  className="h-10 px-4 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all cursor-pointer appearance-none relative min-w-[180px]" 
                  value={roleFilter} 
                  onChange={(e) => setRoleFilter(e.target.value)}
                  style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'currentColor\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '0.75rem' }}
                >
                  <option value="all">Company Tiers (All)</option>
                  {customRoles.map(r => (
                    <option key={r._id} value={r._id}>{r.name}</option>
                  ))}
                </select>
                <select 
                  className="h-10 px-4 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all cursor-pointer appearance-none relative" 
                  value={statusFilter} 
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'currentColor\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '0.75rem' }}
                >
                  <option value="all">All Status</option>
                  <option value="active">Verified (Active)</option>
                  <option value="inactive">Revoked (Inactive)</option>
                </select>
              </div>
            </div>
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
          {(!company ||
            company.enabledModules?.includes(Module.GRIEVANCE)) && (
            <TabsContent value="grievances" className="mt-0">
              <GrievanceList 
                grievances={grievances}
                filteredGrievances={filteredGrievances}
                exportToCSV={exportToCSV}
                setSelectedGrievance={setSelectedGrievance}
                setShowGrievanceDetail={setShowGrievanceDetail}
                onRefresh={fetchGrievances}
                refreshing={loading}
                onAssign={(g) => {
                  setGrievanceToAssign(g);
                  setIsAssignModalOpen(true);
                }}
              />
            </TabsContent>
          )}

          {(!company ||
            company.enabledModules?.includes(Module.APPOINTMENT)) && (
            <TabsContent value="appointments" className="mt-0">
              {selectedAppointments.size > 0 && (
                <div className="flex items-center justify-between mb-4 bg-red-50 p-4 rounded-2xl border border-red-100 animate-in slide-in-from-top-2">
                  <p className="text-xs font-black text-red-600 uppercase tracking-widest">
                    {selectedAppointments.size} item(s) selected for termination
                  </p>
                  <Button
                    onClick={handleBulkDeleteAppointments}
                    disabled={isDeleting}
                    variant="destructive"
                    className="h-9 px-6 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-red-900/20"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {isDeleting ? "Deleting..." : "Execute Bulk Delete"}
                  </Button>
                </div>
              )}
              <AppointmentList
                appointments={appointments}
                filteredAppointments={filteredAppointments}
                selectedAppointments={selectedAppointments}
                onSelectionChange={setSelectedAppointments}
                exportToCSV={exportToCSV}
                setSelectedAppointment={setSelectedAppointment}
                setShowAppointmentDetail={setShowAppointmentDetail}
                onRefresh={fetchData}
                refreshing={loading}
              />
            </TabsContent>
          )}

          {(!company ||
            company.enabledModules?.includes(Module.LEAD_CAPTURE)) && (
            <TabsContent value="leads" className="mt-0 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">
                  Lead Management Engine
                </h3>
                <div className="flex items-center gap-2">
                   <Button variant="outline" size="sm" onClick={() => exportToCSV(leads, 'leads')} className="text-[10px] font-black uppercase tracking-tighter">
                      Export Leads
                   </Button>
                </div>
              </div>
              <LeadTable
                leads={leads}
                exportToCSV={exportToCSV}
                onRefresh={fetchData}
                refreshing={loading}
              />
              <Pagination
                currentPage={leadsPage}
                totalPages={Math.max(1, Math.ceil(leadsTotal / PAGE_SIZE))}
                totalItems={leadsTotal}
                itemsPerPage={PAGE_SIZE}
                onPageChange={(page) => {
                  setLeadsPage(page);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            </TabsContent>
          )}

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

          <TabsContent value="whatsapp" className="space-y-4 pt-4 animate-in fade-in slide-in-from-bottom-2">
             <WhatsAppConfigTab companyId={companyId} />
          </TabsContent>

          <TabsContent value="email" className="space-y-4 pt-4 animate-in fade-in slide-in-from-bottom-2">
             <EmailConfigTab companyId={companyId} />
          </TabsContent>

          <TabsContent value="flows" className="space-y-4 pt-4 animate-in fade-in slide-in-from-bottom-2">
             <ChatbotFlowsTab companyId={companyId} />
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

      {simulatorOpen && activeFlow && (
        <FlowSimulator
          nodes={activeFlow.nodes || []}
          edges={activeFlow.edges || []}
          flowName={activeFlow.flowName || activeFlow.name || "Live Bot Simulation"}
          onClose={() => setSimulatorOpen(false)}
        />
      )}
      <AssignmentModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        itemId={grievanceToAssign?._id || ""}
        itemType="grievance"
        currentAssignee={
          typeof grievanceToAssign?.assignedTo === "object"
            ? (grievanceToAssign.assignedTo as any)?._id
            : grievanceToAssign?.assignedTo
        }
        onSuccess={() => {
          fetchGrievances();
          fetchData();
        }}
      />
    </div>
  );
}

export default function CompanyDrillDown() {
  return (
    <Suspense fallback={<LoadingSpinner text="Initializing Sector Node..." />}>
      <CompanyDrillDownContent />
    </Suspense>
  );
}
