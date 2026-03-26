"use client";

import { useEffect, useState, Suspense, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
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
import { apiClient } from "@/lib/api/client";
import { companyAPI, Company } from "@/lib/api/company";
import { departmentAPI, Department } from "@/lib/api/department";
import { userAPI, User } from "@/lib/api/user";
import { grievanceAPI, Grievance } from "@/lib/api/grievance";
import { appointmentAPI, Appointment } from "@/lib/api/appointment";
import { leadAPI, Lead } from "@/lib/api/lead";
import { roleAPI, Role } from "@/lib/api/role";
import CreateDepartmentDialog from "@/components/department/CreateDepartmentDialog";
import DepartmentUsersDialog from "@/components/department/DepartmentUsersDialog";
import CreateUserDialog from "@/components/user/CreateUserDialog";
import EditUserDialog from "@/components/user/EditUserDialog";
import ChangePermissionsDialog from "@/components/user/ChangePermissionsDialog";
import UserDetailsDialog from "@/components/user/UserDetailsDialog";
import { ProtectedButton } from "@/components/ui/ProtectedButton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Permission, hasPermission, Module } from "@/lib/permissions";
import toast from "react-hot-toast";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import GrievanceDetailDialog from "@/components/grievance/GrievanceDetailDialog";
import AppointmentDetailDialog from "@/components/appointment/AppointmentDetailDialog";
import AssignmentDialog from "@/components/assignment/AssignmentDialog";
import StatusUpdateModal from "@/components/grievance/StatusUpdateModal";
import RevertGrievanceDialog from "@/components/grievance/RevertGrievanceDialog";
import MetricInfoDialog, {
  MetricInfo,
} from "@/components/analytics/MetricInfoDialog";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { StatsSkeleton, TableSkeleton } from "@/components/ui/GeneralSkeleton";
import { Pagination } from "@/components/ui/Pagination";
import AvailabilityCalendar from "@/components/availability/AvailabilityCalendar";

import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { formatTo10Digits } from "@/lib/utils/phoneUtils";

import {
  ArrowUpDown,
  ArrowLeft,
  ArrowRight,
  Phone,
  UserPlus,
  UserCog,
  Key,
  UserMinus,
  ChevronUp,
  ChevronDown,
  User as UserIcon,
  Users,
  Mail,
  Shield,
  Building,
  Target,
  CheckCircle,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Edit2,
  Trash2,
  Lock,
  Unlock,
  Filter,
  X,
  CalendarClock,
  FileDown,
  FileText,
  BarChart2,
  TrendingUp,
  Clock,
  CalendarCheck,
  PieChart as PieChartIcon,
  Power,
  Terminal,
  Activity,
  Zap,
  LayoutDashboard,
  Search,
  RefreshCw,
  Download,
  Calendar,
  Bell,
  Undo2,
  ExternalLink,
  Inbox,
  Eye,
  ArrowRightCircle,
  Building2,
  Layers,
  Map,
  Flame,
  ShieldAlert,
  LocateFixed,
  ScanSearch,
  Trees,
  MapPin,
} from "lucide-react";

interface DashboardStats {
  grievances: {
    total: number;
    pending: number;
    assigned?: number;
    inProgress: number;
    resolved: number;
    last7Days: number;
    last30Days: number;
    resolutionRate: number;
    slaBreached?: number;
    slaComplianceRate?: number;
    avgResolutionDays?: number;
    byPriority?: Array<{ priority: string; count: number }>;
    daily: Array<{ date: string; count: number }>;
    monthly?: Array<{ month: string; count: number; resolved: number }>;
  };
  appointments: {
    total: number;
    pending: number;
    confirmed: number;
    completed: number;
    cancelled?: number;
    last7Days: number;
    last30Days: number;
    completionRate: number;
    byDepartment?: Array<{
      departmentId: string;
      departmentName: string;
      count: number;
      completed: number;
    }>;
    daily: Array<{ date: string; count: number }>;
    monthly?: Array<{ month: string; count: number; completed: number }>;
  };
  departments: number;
  mainDepartments?: number;
  subDepartments?: number;
  users: number;
  activeUsers: number;
  resolvedToday?: number;
  highPriorityPending?: number;
  isHierarchicalEnabled?: boolean;
  usersByRole?: Array<{ name: string; count: number }>;
}

import dynamic from 'next/dynamic';

const TacticalForestMap = dynamic(() => import('@/components/dashboard/TacticalForestMap'), { 
  ssr: false,
  loading: () => <div className="w-full h-full bg-slate-900 animate-pulse flex items-center justify-center text-slate-500 font-black text-xs uppercase tracking-widest">Initialising Tactical Grid...</div>
});

function DashboardContent() {
  const { user, loading, logout } = useAuth();
  const isCompanyLevel = user && !user.departmentId && user.role !== "SUPER_ADMIN";
  const isDepartmentLevel = user && !!user.departmentId && user.role !== "SUPER_ADMIN";
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  // Get initial tab from URL search params, default based on role
  const getDefaultTab = () => {
    if (!hasPermission(user, Permission.VIEW_ANALYTICS) && !isSuperAdmin) {
      if (hasPermission(user, Permission.READ_GRIEVANCE)) return "grievances";
      return "profile";
    }
    return "overview";
  };
  const initialTab = searchParams?.get("tab") || getDefaultTab();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [previousTab, setPreviousTab] = useState<string>("overview");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptUserCounts, setDeptUserCounts] = useState<Record<string, number>>(
    {},
  );
  const [deptSearch, setDeptSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const isDFO = useMemo(() => {
    return company?.name?.toUpperCase().includes("D.F.O.") || 
           company?._id === "69adc81165109318a7cde21c" ||
           user?.companyId === "69adc81165109318a7cde21c";
  }, [company, user]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [showDepartmentDialog, setShowDepartmentDialog] = useState(false);
  const [showDeptUsersDialog, setShowDeptUsersDialog] = useState(false);
  const [selectedDeptForUsers, setSelectedDeptForUsers] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showEditUserDialog, setShowEditUserDialog] = useState(false);
  const [showChangePermissionsDialog, setShowChangePermissionsDialog] =
    useState(false);
  const [selectedUserForDetails, setSelectedUserForDetails] =
    useState<User | null>(null);
  const [showUserDetailsDialog, setShowUserDetailsDialog] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(
    null,
  );
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: "danger" | "warning" | "info";
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    variant: "danger",
  });
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingGrievances, setLoadingGrievances] = useState(false);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [updatingGrievanceStatus, setUpdatingGrievanceStatus] = useState<
    Set<string>
  >(new Set());
  const [updatingAppointmentStatus, setUpdatingAppointmentStatus] = useState<
    Set<string>
  >(new Set());
  const [navigatingToDepartment, setNavigatingToDepartment] = useState<
    string | null
  >(null);
  const [performanceData, setPerformanceData] = useState<any>(null);
  const [hourlyData, setHourlyData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [departmentData, setDepartmentData] = useState<any[]>([]);
  const [selectedGrievance, setSelectedGrievance] = useState<Grievance | null>(
    null,
  );
  const [showGrievanceDetail, setShowGrievanceDetail] = useState(false);
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null);
  const [showAppointmentDetail, setShowAppointmentDetail] = useState(false);
  const [showAppointmentStatusModal, setShowAppointmentStatusModal] =
    useState(false);
  const [selectedAppointmentForStatus, setSelectedAppointmentForStatus] =
    useState<Appointment | null>(null);
  const [showGrievanceStatusModal, setShowGrievanceStatusModal] =
    useState(false);
  const [selectedGrievanceForStatus, setSelectedGrievanceForStatus] =
    useState<Grievance | null>(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<
    string | null
  >(null);

  // Selection state for bulk delete (Super Admin only)
  const [selectedGrievances, setSelectedGrievances] = useState<Set<string>>(
    new Set(),
  );
  const [selectedAppointments, setSelectedAppointments] = useState<Set<string>>(
    new Set(),
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [showGrievanceAssignment, setShowGrievanceAssignment] = useState(false);
  const [selectedGrievanceForAssignment, setSelectedGrievanceForAssignment] =
    useState<Grievance | null>(null);
  const [showGrievanceRevertDialog, setShowGrievanceRevertDialog] =
    useState(false);
  const [selectedGrievanceForRevert, setSelectedGrievanceForRevert] =
    useState<Grievance | null>(null);
  const [showAppointmentAssignment, setShowAppointmentAssignment] =
    useState(false);
  const [
    selectedAppointmentForAssignment,
    setSelectedAppointmentForAssignment,
  ] = useState<Appointment | null>(null);
  const [showMetricDialog, setShowMetricDialog] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<MetricInfo | null>(null);
  const [showAvailabilityCalendar, setShowAvailabilityCalendar] =
    useState(false);

  // Pagination State
  const [grievancePage, setGrievancePage] = useState(1);
  const [grievancePagination, setGrievancePagination] = useState({
    total: 0,
    pages: 1,
    limit: 20,
  });

  const [appointmentPage, setAppointmentPage] = useState(1);
  const [appointmentPagination, setAppointmentPagination] = useState({
    total: 0,
    pages: 1,
    limit: 20,
  });

  const [departmentPage, setDepartmentPage] = useState(1);
  const [departmentPagination, setDepartmentPagination] = useState({
    total: 0,
    pages: 1,
    limit: 50,
  });

  const [userPage, setUserPage] = useState(1);
  const [userPagination, setUserPagination] = useState({
    total: 0,
    pages: 1,
    limit: 20,
  });

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc" | null;
    tab: string;
  }>({
    key: "",
    direction: null,
    tab: "grievances",
  });

  // Filters for other tabs
  const [deptFilters, setDeptFilters] = useState({ type: "", status: "", mainDeptId: "" });
  const [userFilters, setUserFilters] = useState({ role: "", status: "", mainDeptId: "", subDeptId: "" });
  const [showUserFiltersOnMobile, setShowUserFiltersOnMobile] = useState(false);

  const [grievanceFilters, setGrievanceFilters] = useState({
    status: "",
    department: "",
    mainDeptId: "",
    subDeptId: "",
    assignmentStatus: "",
    overdueStatus: "",
    dateRange: "",
  });

  const getParentDepartmentId = useCallback((dept: any): string | undefined => {
    if (!dept?.parentDepartmentId) return undefined;
    return typeof dept.parentDepartmentId === "object"
      ? dept.parentDepartmentId._id
      : dept.parentDepartmentId;
  }, []);

  // Search states
  const [grievanceSearch, setGrievanceSearch] = useState("");
  const [appointmentSearch, setAppointmentSearch] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Helper to check module access - prioritizes latest company config over user session
  const hasModule = useCallback(
    (module: Module) => {
      if (user?.role === "SUPER_ADMIN") return true;
      const modules = company?.enabledModules || user?.enabledModules || [];
      return modules.includes(module);
    },
    [user, company],
  );

  // Export functions
  const exportToCSV = (
    data: any[],
    filename: string,
    columns: { key: string; label: string }[],
  ) => {
    const headers = columns.map((col) => col.label).join(",");
    const rows = data.map((item) =>
      columns
        .map((col) => {
          let value = item[col.key];
          if (typeof value === "object" && value !== null) {
            value = value.name || value.firstName || value._id || "";
          }
          if (typeof value === "string" && value.includes(",")) {
            value = `"${value}"`;
          }
          return value || "";
        })
        .join(","),
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success(`Exported ${data.length} records to CSV`);
  };

  const handleRefreshData = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        fetchGrievances(),
        fetchAppointments(),
        fetchDashboardData(),
      ]);
      toast.success("Data refreshed successfully");
    } catch (error) {
      toast.error("Failed to refresh data");
    } finally {
      setIsRefreshing(false);
    }
  };

  const openGrievanceDetail = async (grievanceId: string) => {
    try {
      const response = await grievanceAPI.getById(grievanceId);
      if (response.success) {
        setSelectedGrievance(response.data.grievance);
        setShowGrievanceDetail(true);
      }
    } catch (error: any) {
      toast.error("Failed to load grievance details");
    }
  };

  const openAppointmentDetail = async (appointmentId: string) => {
    try {
      const response = await appointmentAPI.getById(appointmentId);
      if (response.success) {
        setSelectedAppointment(response.data.appointment);
        setShowAppointmentDetail(true);
      }
    } catch (error: any) {
      toast.error("Failed to load details");
    }
  };

  // Bulk delete handlers (Super Admin only)
  const handleBulkDeleteGrievances = async () => {
    if (selectedGrievances.size === 0) return;

    if (
      !confirm(
        `Are you sure you want to delete ${selectedGrievances.size} grievance(s)? This action cannot be undone.`,
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await grievanceAPI.deleteBulk(
        Array.from(selectedGrievances),
      );
      if (response.success) {
        toast.success(response.message);
        const deletedIds = Array.from(selectedGrievances);
        setGrievances((prev) =>
          prev.filter((g) => !deletedIds.includes(g._id)),
        );
        setSelectedGrievances(new Set());
        fetchGrievances(grievancePage, true);
        fetchDashboardData(true);
      } else {
        toast.error("Failed to delete grievances");
      }
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to delete grievances",
      );
    } finally {
      setIsDeleting(false);
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
        const deletedIds = Array.from(selectedAppointments);
        setAppointments((prev) =>
          prev.filter((a) => !deletedIds.includes(a._id)),
        );
        setSelectedAppointments(new Set());
        fetchAppointments(appointmentPage, true);
        fetchDashboardData(true);
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

  // Appointments Filters
  const [appointmentFilters, setAppointmentFilters] = useState({
    status: "",
    department: "",
    assignmentStatus: "",
    dateFilter: "",
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    } else if (!loading && user && user.role === "SUPER_ADMIN") {
      router.push("/superadmin/dashboard");
    }
  }, [user, loading, router]);

  // Redirect away from overview if no analytics permission
  useEffect(() => {
    if (user && !hasPermission(user, Permission.VIEW_ANALYTICS) && !isSuperAdmin && activeTab === "overview") {
      const nextTab = hasPermission(user, Permission.READ_GRIEVANCE) ? "grievances" : "profile";
      setActiveTab(nextTab);
    }
  }, [user, activeTab, isSuperAdmin]);

  // Update URL when tab changes to persist state
  useEffect(() => {
    if (mounted && activeTab) {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", activeTab);
      window.history.replaceState({}, "", url.toString());
    }
  }, [activeTab, mounted]);

  // Track previous counts for real-time notifications
  const [prevGrievanceCount, setPrevGrievanceCount] = useState<number | null>(
    null,
  );
  const [prevAppointmentCount, setPrevAppointmentCount] = useState<
    number | null
  >(null);

  const fetchPerformanceData = useCallback(async () => {
    try {
      const response = await apiClient.get("/analytics/performance");
      if (response.success) {
        setPerformanceData(response.data);
      }
    } catch (error: any) {
      console.error("Failed to fetch performance data:", error);
    }
  }, []);

  const fetchHourlyData = useCallback(async () => {
    try {
      const response = await apiClient.get("/analytics/hourly?days=7");
      if (response.success) {
        setHourlyData(response.data);
      }
    } catch (error: any) {
      console.error("Failed to fetch hourly data:", error);
    }
  }, []);

  const fetchCategoryData = useCallback(async () => {
    try {
      const response = await apiClient.get("/analytics/categories");
      if (response.success) {
        setCategoryData(response.data);
      }
    } catch (error: any) {
      console.error("Failed to fetch category data:", error);
    }
  }, []);

  const forestBeats = useMemo(() => {
    return (departments || []).map(d => ({
      id: d._id,
      name: d.name,
      range: d.parentDepartmentId ? 
        (typeof d.parentDepartmentId === 'object' ? (d.parentDepartmentId as any).name : 'Main Range') 
        : d.name,
      incidents: grievances.filter(g => 
        (typeof g.departmentId === 'object' ? (g.departmentId as any)?._id : g.departmentId) === d._id
      ).length,
      status: d.isActive ? 'Active' : 'Inactive'
    }));
  }, [departments, grievances]);

  const liveIncidents = useMemo(() => {
    return grievances
      .filter(g => g.status !== 'RESOLVED')
      .slice(0, 10)
      .map(g => ({
        id: g._id,
        title: g.description || g.category || 'Incident',
        coordinate: g.location?.coordinates || [20.2721, 81.4967],
        severity: g.priority === 'HIGH' ? 'CRITICAL' : 'MODERATE',
        time: g.createdAt,
        area: (g as any).forest_beat || 'Unknown Beat'
      }));
  }, [grievances]);

  const fetchDepartmentData = useCallback(async () => {
    try {
      const response = await apiClient.get("/analytics/grievances/by-department");
      if (response.success) {
        setDepartmentData(response.data);
      }
    } catch (error: any) {
      console.error("Failed to fetch department data:", error);
    }
  }, []);

  const fetchRoles = useCallback(async () => {
    const cid = user?.companyId ? (typeof user.companyId === 'object' ? (user.companyId as any)._id : user.companyId) : null;
    if (!cid) {
      setRoles([]);
      return;
    }
    try {
      const response = await roleAPI.getRoles(cid);
      if (response.success) {
        setRoles(response.data.roles || []);
      }
    } catch (error) {
      console.error("Failed to fetch roles:", error);
    }
  }, [user]);

  const fetchDashboardData = useCallback(async (refresh = false) => {
    if (!refresh) setLoadingStats(true);
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: DashboardStats;
      }>("/analytics/dashboard");
      if (response.success) {
        setStats(response.data);
      }
    } catch (error: any) {
      console.error("Failed to fetch dashboard stats:", error);
      toast.error("Failed to load dashboard statistics");
    } finally {
      if (!refresh) setLoadingStats(false);
    }
  }, []);

  const fetchCompany = useCallback(async () => {
    if (!user || user.role === "SUPER_ADMIN") return;

    try {
      const response = await companyAPI.getMyCompany();
      if (response.success) {
        setCompany(response.data.company);
      }
    } catch (error: any) {
      // CompanyAdmin might not have company associated
      console.log("Company details not available:", error.message);
    }
  }, [user]);

  const fetchDepartments = useCallback(
    async (page = departmentPage, isSilent = false) => {
      if (!isSilent) setLoadingDepartments(true);
      try {
        // For company admin, fetch ALL departments (no pagination limit)
        const fetchLimit = isCompanyLevel ? 1000 : departmentPagination.limit;
        const response = await departmentAPI.getAll({
          page: isCompanyLevel ? 1 : page,
          limit: fetchLimit,
        });
        if (response.success) {
          let filteredDepartments = response.data.departments;

          // For department admin, only show their own department
          if (isDepartmentLevel && user?.departmentId) {
            const userDeptId =
              typeof user.departmentId === "object" &&
              user.departmentId !== null
                ? (user.departmentId as any)._id ||
                  (user.departmentId as any).toString()
                : user.departmentId;

            filteredDepartments = filteredDepartments.filter(
              (dept: Department) => {
                const deptId = dept._id?.toString() || dept._id;
                const userDeptIdStr = userDeptId?.toString() || userDeptId;
                return deptId === userDeptIdStr;
              },
            );
          }

          setDepartments(filteredDepartments);
          setDepartmentPagination((prev) => ({
            ...prev,
            total: isCompanyLevel
              ? filteredDepartments.length
              : response.data.pagination.total,
            pages: isCompanyLevel ? 1 : response.data.pagination.pages,
          }));

          // Set user counts from enriched data
          const counts: Record<string, number> = {};
          filteredDepartments.forEach((dept: any) => {
            counts[dept._id] = dept.userCount || 0;
          });
          setDeptUserCounts(counts);
        }
      } catch (error: any) {
        console.error("Failed to fetch departments:", error);
        toast.error("Failed to load departments");
      } finally {
        if (!isSilent) setLoadingDepartments(false);
      }
    },
    [
      departmentPage,
      departmentPagination.limit,
      isDepartmentLevel,
      isCompanyLevel,
      user?.departmentId,
    ],
  );

  const fetchUsers = useCallback(
    async (page = userPage, isSilent = false) => {
      if (!isSilent) setLoadingUsers(true);
      try {
        const selectedDepartmentId = userFilters.subDeptId
          ? userFilters.subDeptId
          : userFilters.mainDeptId
            ? [
                userFilters.mainDeptId,
                ...departments
                  .filter((d) => getParentDepartmentId(d) === userFilters.mainDeptId)
                  .map((d) => d._id),
              ].join(',')
            : undefined;

        const serverRoleFilter = userFilters.role.startsWith('CUSTOM:')
          ? undefined
          : userFilters.role || undefined;

        const response = await userAPI.getAll({
          page,
          limit: userPagination.limit,
          search: userSearch,
          role: serverRoleFilter,
          status: (userFilters.status as 'active' | 'inactive') || undefined,
          departmentId: selectedDepartmentId,
        });
        if (response.success) {
          let filteredUsers = response.data.users;

          // Filter users by department for department admins
          if (isDepartmentLevel && user?.departmentId) {
            const userDeptId =
              typeof user.departmentId === "object" &&
              user.departmentId !== null
                ? user.departmentId._id
                : user.departmentId;

            filteredUsers = filteredUsers.filter((u: any) => {
              const uDeptId =
                typeof u.departmentId === "object" && u.departmentId !== null
                  ? u.departmentId._id
                  : u.departmentId;
              return uDeptId === userDeptId;
            });
          }

          // For custom roles, keep frontend-side filtering (API only supports system role key)
          if (userFilters.role?.startsWith('CUSTOM:')) {
            const roleId = userFilters.role.split(':')[1];
            filteredUsers = filteredUsers.filter((u: any) => {
              const uRoleId =
                typeof u.customRoleId === 'object' && u.customRoleId !== null
                  ? u.customRoleId._id
                  : u.customRoleId;
              return uRoleId === roleId;
            });
          }

          setUsers(filteredUsers);
          setUserPagination((prev) => ({
            ...prev,
            total: userFilters.role?.startsWith('CUSTOM:')
              ? filteredUsers.length
              : response.data.pagination.total,
            pages: userFilters.role?.startsWith('CUSTOM:')
              ? Math.max(1, Math.ceil(filteredUsers.length / userPagination.limit))
              : response.data.pagination.pages,
          }));
        }
      } catch (error: any) {
        console.error("Failed to fetch users:", error);
        toast.error("Failed to load users");
      } finally {
        if (!isSilent) setLoadingUsers(false);
      }
    },
    [
      userPage,
      userPagination.limit,
      isDepartmentLevel,
      user?.departmentId,
      userSearch,
      userFilters,
      departments,
      getParentDepartmentId,
    ],
  );

  // Reset user page when search changes
  useEffect(() => {
    setUserPage(1);
  }, [userSearch, userFilters]);

  useEffect(() => {
    setGrievancePage(1);
  }, [grievanceFilters, grievanceSearch]);


  const fetchGrievances = useCallback(
    async (page = grievancePage, isSilent = false) => {
      if (!hasModule(Module.GRIEVANCE) || !hasPermission(user, Permission.READ_GRIEVANCE)) {
        return;
      }

      if (!isSilent) setLoadingGrievances(true);
      try {
        const response = await grievanceAPI.getAll({
          page,
          limit: grievancePagination.limit,
          status: grievanceFilters.status || undefined,
          departmentId: (grievanceFilters.subDeptId || grievanceFilters.mainDeptId || grievanceFilters.department) || undefined,
          assignedTo: grievanceFilters.assignmentStatus === "assigned" ? "ANY" : grievanceFilters.assignmentStatus === "unassigned" ? "NONE" : undefined,
        });
        if (response.success) {
          setGrievances(response.data.grievances);
          setGrievancePagination((prev) => ({
            ...prev,
            total: response.data.pagination.total,
            pages: response.data.pagination.pages,
          }));
        }
      } catch (error: any) {
        if (error.response?.status !== 403) {
          console.error("Failed to fetch grievances:", error);
          toast.error("Failed to load grievances");
        }
      } finally {
        if (!isSilent) setLoadingGrievances(false);
      }
    },
    [grievancePage, grievancePagination.limit, user, hasModule, grievanceFilters],
  );

  const fetchAppointments = useCallback(
    async (page = appointmentPage, isSilent = false) => {
      if (!hasModule(Module.APPOINTMENT) || !hasPermission(user, Permission.READ_APPOINTMENT)) {
        return;
      }
      
      if (!isSilent) setLoadingAppointments(true);
      try {
        const response = await appointmentAPI.getAll({
          page,
          limit: appointmentPagination.limit,
        });
        if (response.success) {
          setAppointments(response.data.appointments);
          setAppointmentPagination((prev) => ({
            ...prev,
            total: response.data.pagination.total,
            pages: response.data.pagination.pages,
          }));
        }
      } catch (error: any) {
        if (error.response?.status !== 403) {
          console.error("Failed to fetch appointments:", error);
          toast.error("Failed to load appointments");
        }
      } finally {
        if (!isSilent) setLoadingAppointments(false);
      }
    },
    [appointmentPage, appointmentPagination.limit, user, hasModule],
  );

  const fetchLeads = useCallback(async () => {
    if (!user?.companyId) return;
    setLoadingLeads(true);
    try {
      const companyId =
        typeof user.companyId === "object"
          ? user.companyId._id
          : user.companyId;
      const response = await leadAPI.getAll({ companyId });
      if (response.success) {
        setLeads(response.data);
      }
    } catch (error: any) {
      console.error("Failed to fetch leads:", error);
      toast.error("Failed to load leads");
    } finally {
      setLoadingLeads(false);
    }
  }, [user?.companyId]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (activeTab === "overview") {
        await fetchDashboardData();
      } else if (activeTab === "analytics") {
        await Promise.all([
          fetchHourlyData(),
          fetchCategoryData(),
          fetchDashboardData(),
        ]);
      } else if (activeTab === "grievances" || activeTab === "reverted") {
        await fetchGrievances(grievancePage);
      } else if (activeTab === "appointments") {
        await fetchAppointments(appointmentPage);
      } else if (activeTab === "departments") {
        await fetchDepartments();
      } else if (activeTab === "users") {
        await fetchUsers(userPage);
      } else if (activeTab === "leads") {
        await fetchLeads();
      }
      toast.success("Data refreshed");
    } catch (error) {
      toast.error("Failed to refresh data");
    } finally {
      setRefreshing(false);
    }
  }, [
    activeTab,
    fetchDashboardData,
    fetchHourlyData,
    fetchCategoryData,
    fetchGrievances,
    grievancePage,
    fetchAppointments,
    appointmentPage,
    fetchDepartments,
    fetchUsers,
    userPage,
    fetchLeads,
  ]);

  // 1. Initial Dashboard Stats & Page-independent data
  useEffect(() => {
    if (mounted && user && user.role !== "SUPER_ADMIN") {
      fetchDashboardData();
      if (user.companyId) {
        fetchCompany();
        fetchRoles();
      }
    }
  }, [mounted, user, fetchDashboardData, fetchCompany, fetchRoles]);

  // 2. Specialized effects for each paginated module
  useEffect(() => {
    if (mounted && user && user.role !== "SUPER_ADMIN") {
      fetchDepartments(departmentPage);
    }
  }, [mounted, user, departmentPage, fetchDepartments]);

  useEffect(() => {
    if (mounted && user && user.role !== "SUPER_ADMIN") {
      fetchUsers(userPage);
    }
  }, [mounted, user, userPage, fetchUsers]);

  useEffect(() => {
    if (mounted && user && user.role !== "SUPER_ADMIN" && hasModule(Module.GRIEVANCE) && hasPermission(user, Permission.READ_GRIEVANCE)) {
      fetchGrievances(grievancePage);
    }
  }, [mounted, user, grievancePage, fetchGrievances, hasModule]);

  useEffect(() => {
    if (mounted && user && user.role !== "SUPER_ADMIN" && hasModule(Module.APPOINTMENT) && hasPermission(user, Permission.READ_APPOINTMENT)) {
      fetchAppointments(appointmentPage);
    }
  }, [mounted, user, appointmentPage, fetchAppointments, hasModule]);

  useEffect(() => {
    if (mounted && user && hasModule(Module.LEAD_CAPTURE)) {
      fetchLeads();
    }
  }, [mounted, user, fetchLeads, hasModule]);

  // 3. Polling isolated from initial load triggers
  useEffect(() => {
    if (mounted && user && user.role !== "SUPER_ADMIN") {
      const pollInterval = setInterval(async () => {
        try {
          const promises = [];
          
          if (hasModule(Module.GRIEVANCE) && hasPermission(user, Permission.READ_GRIEVANCE)) {
            promises.push(grievanceAPI.getAll({ page: 1, limit: 10 }));
          } else {
            promises.push(Promise.resolve({ success: false, data: null }));
          }
          
          if (hasModule(Module.APPOINTMENT) && hasPermission(user, Permission.READ_APPOINTMENT)) {
            promises.push(appointmentAPI.getAll({ page: 1, limit: 10 }));
          } else {
            promises.push(Promise.resolve({ success: false, data: null }));
          }

          const [grievanceRes, appointmentRes] = await Promise.all(promises) as any;

          if (grievanceRes.success && prevGrievanceCount !== null) {
            const newCount = grievanceRes.data.pagination.total;
            if (newCount > prevGrievanceCount) {
              toast.success(
                `📋 New grievance received! (${newCount - prevGrievanceCount} new)`,
                { duration: 2000 },
              );
              fetchDashboardData();
            }
            setPrevGrievanceCount(newCount);
            if (grievancePage === 1) {
              setGrievances(grievanceRes.data.grievances);
              setGrievancePagination((prev) => ({
                ...prev,
                total: grievanceRes.data.pagination.total,
                pages: grievanceRes.data.pagination.pages,
              }));
            }
          } else if (grievanceRes.success) {
            setPrevGrievanceCount(grievanceRes.data.pagination.total);
          }

          if (appointmentRes.success && prevAppointmentCount !== null) {
            const newCount = appointmentRes.data.pagination.total;
            if (newCount > prevAppointmentCount) {
              toast.success(
                `📅 New appointment scheduled! (${newCount - prevAppointmentCount} new)`,
                { duration: 4000 },
              );
              fetchDashboardData();
            }
            setPrevAppointmentCount(newCount);
            if (appointmentPage === 1) {
              setAppointments(appointmentRes.data.appointments);
              setAppointmentPagination((prev) => ({
                ...prev,
                total: appointmentRes.data.pagination.total,
                pages: appointmentRes.data.pagination.pages,
              }));
            }
          } else if (appointmentRes.success) {
            setPrevAppointmentCount(appointmentRes.data.pagination.total);
          }
        } catch (error) {
          console.error("Polling error:", error);
        }
      }, 60000);

      return () => clearInterval(pollInterval);
    }
  }, [
    mounted,
    user,
    grievancePage,
    appointmentPage,
    fetchDashboardData,
    prevGrievanceCount,
    prevAppointmentCount,
    hasModule,
  ]);

  useEffect(() => {
    if (mounted && user && activeTab === "analytics") {
      fetchPerformanceData();
      fetchHourlyData();
      fetchCategoryData();
      fetchDepartmentData();
    }
  }, [
    mounted,
    user,
    activeTab,
    fetchPerformanceData,
    fetchHourlyData,
    fetchCategoryData,
    fetchDepartmentData,
  ]);

  const handleSort = (key: string, tab: string) => {
    let direction: "asc" | "desc" | null = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    } else if (sortConfig.key === key && sortConfig.direction === "desc") {
      direction = null;
    }
    setSortConfig({ key, direction, tab });
  };

  const getSortedData = (data: any[], tab: string) => {
    let filteredData = data;

    // For operators, only show items assigned to them
    if (user?.role === "OPERATOR" && user.id) {
      if (tab === "grievances" || tab === "appointments") {
        filteredData = data.filter((item) => {
          const assignedToId = item.assignedTo?._id || item.assignedTo;
          return assignedToId === user.id;
        });
      }
    }

    // Apply grievance filters
    if (tab === "grievances" || tab === "reverted") {
      // Status filter
      if (grievanceFilters.status) {
        filteredData = filteredData.filter(
          (g: Grievance) =>
            g.status?.toUpperCase() === grievanceFilters.status.toUpperCase(),
        );
      }
      // Department filter
      if (grievanceFilters.department) {
        filteredData = filteredData.filter((g: Grievance) => {
          const deptId =
            typeof g.departmentId === "object" && g.departmentId
              ? (g.departmentId as any)._id
              : g.departmentId;
          return deptId === grievanceFilters.department;
        });
      }
      // Main Department filter
      if (grievanceFilters.mainDeptId) {
        filteredData = filteredData.filter((g: Grievance) => {
          const deptId =
            typeof g.departmentId === "object" && g.departmentId
              ? (g.departmentId as any)._id
              : g.departmentId;
          const subDeptId =
            typeof g.subDepartmentId === "object" && g.subDepartmentId
              ? (g.subDepartmentId as any)._id
              : g.subDepartmentId;
          
          // Show if main department matches OR if it belongs to a sub-department of the selected main
          const dept = departments.find(d => d._id === deptId);
          return deptId === grievanceFilters.mainDeptId || getParentDepartmentId(dept) === grievanceFilters.mainDeptId;
        });
      }
      // Sub Department filter
      if (grievanceFilters.subDeptId) {
        filteredData = filteredData.filter((g: Grievance) => {
          const subDeptId =
            typeof g.subDepartmentId === "object" && g.subDepartmentId
              ? (g.subDepartmentId as any)._id
              : g.subDepartmentId;
          return subDeptId === grievanceFilters.subDeptId;
        });
      }
      // Assignment status filter
      if (grievanceFilters.assignmentStatus) {
        if (grievanceFilters.assignmentStatus === "assigned") {
          filteredData = filteredData.filter((g: Grievance) => g.assignedTo);
        } else if (grievanceFilters.assignmentStatus === "unassigned") {
          filteredData = filteredData.filter((g: Grievance) => !g.assignedTo);
        }
      }
      // Overdue status filter
      if (grievanceFilters.overdueStatus) {
        const now = new Date();
        filteredData = filteredData.filter((g: Grievance) => {
          const createdDate = new Date(g.createdAt);
          const hoursDiff = Math.floor(
            (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60)
          );

          let isOverdue = false;
          let slaHours = 0;

          if (g.status === "PENDING") {
            slaHours = 24;
            isOverdue = hoursDiff > slaHours;
          } else if (g.status === "ASSIGNED") {
            slaHours = 120;
            const assignedDate = g.assignedAt
              ? new Date(g.assignedAt)
              : createdDate;
            const hoursFromAssigned = Math.floor(
              (now.getTime() - assignedDate.getTime()) / (1000 * 60 * 60)
            );
            isOverdue = hoursFromAssigned > slaHours;
          }

          if (
            g.status === "RESOLVED" ||
            g.status === "CLOSED" ||
            g.status === "REJECTED"
          ) {
            isOverdue = false;
          }

          return grievanceFilters.overdueStatus === "overdue"
            ? isOverdue
            : !isOverdue;
        });
      }
      // Date range filter
      if (grievanceFilters.dateRange) {
        const now = new Date();
        filteredData = filteredData.filter((g: Grievance) => {
          const createdAt = new Date(g.createdAt);
          const daysDiff =
            (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
          switch (grievanceFilters.dateRange) {
            case "today":
              return daysDiff < 1;
            case "week":
              return daysDiff <= 7;
            case "month":
              return daysDiff <= 30;
            default:
              return true;
          }
        });
      }
      // Search filter
      if (grievanceSearch.trim()) {
        const search = grievanceSearch.toLowerCase().trim();
        filteredData = filteredData.filter(
          (g: Grievance) =>
            g.grievanceId?.toLowerCase().includes(search) ||
            g.citizenName?.toLowerCase().includes(search) ||
            g.citizenPhone?.includes(search) ||
            g.category?.toLowerCase().includes(search) ||
            g.description?.toLowerCase().includes(search),
        );
      }
    }

    // Apply appointment filters
    if (tab === "appointments") {
      // Status filter
      if (appointmentFilters.status) {
        filteredData = filteredData.filter(
          (a: Appointment) =>
            a.status?.toUpperCase() === appointmentFilters.status.toUpperCase(),
        );
      }
      // Department filter - Removed (Appointments are CEO-only, no departments)
      // Assignment status filter
      if (appointmentFilters.assignmentStatus) {
        if (appointmentFilters.assignmentStatus === "assigned") {
          filteredData = filteredData.filter((a: Appointment) => a.assignedTo);
        } else if (appointmentFilters.assignmentStatus === "unassigned") {
          filteredData = filteredData.filter((a: Appointment) => !a.assignedTo);
        }
      }
      // Date filter
      if (appointmentFilters.dateFilter) {
        const now = new Date();
        const today = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
        );
        filteredData = filteredData.filter((a: Appointment) => {
          const appointmentDate = new Date(a.appointmentDate);
          const appointmentDayStart = new Date(
            appointmentDate.getFullYear(),
            appointmentDate.getMonth(),
            appointmentDate.getDate(),
          );
          switch (appointmentFilters.dateFilter) {
            case "today":
              return appointmentDayStart.getTime() === today.getTime();
            case "week":
              const weekStart = new Date(today);
              weekStart.setDate(today.getDate() - today.getDay());
              const weekEnd = new Date(weekStart);
              weekEnd.setDate(weekStart.getDate() + 6);
              return (
                appointmentDayStart >= weekStart &&
                appointmentDayStart <= weekEnd
              );
            case "month":
              return (
                appointmentDate.getMonth() === now.getMonth() &&
                appointmentDate.getFullYear() === now.getFullYear()
              );
            case "upcoming":
              return appointmentDayStart >= today;
            default:
              return true;
          }
        });
      }
      // Search filter
      if (appointmentSearch.trim()) {
        const search = appointmentSearch.toLowerCase().trim();
        filteredData = filteredData.filter(
          (a: Appointment) =>
            a.appointmentId?.toLowerCase().includes(search) ||
            a.citizenName?.toLowerCase().includes(search) ||
            a.citizenPhone?.includes(search) ||
            a.purpose?.toLowerCase().includes(search),
        );
      }
    }

    // Apply department filters
    if (tab === "departments") {
      // Type filter
      if (deptFilters.type) {
        filteredData = filteredData.filter((d: Department) => 
          deptFilters.type === "main" ? !d.parentDepartmentId : !!d.parentDepartmentId
        );
      }
      // Status filter
      if (deptFilters.status) {
        filteredData = filteredData.filter((d: Department) => 
          deptFilters.status === "active" ? d.isActive : !d.isActive
        );
      }
      // Search filter
      if (deptSearch.trim()) {
        const search = deptSearch.toLowerCase().trim();
        filteredData = filteredData.filter(
          (d: Department) =>
            d.name.toLowerCase().includes(search) ||
            d.departmentId?.toLowerCase().includes(search)
        );
      }
      // Main Department filter (show main + its subs)
      if (deptFilters.mainDeptId) {
        filteredData = filteredData.filter((d: Department) => 
          d._id === deptFilters.mainDeptId || getParentDepartmentId(d) === deptFilters.mainDeptId
        );
      }
    }

    // Apply user filters
    if (tab === "users") {
      // Role filter
      if (userFilters.role) {
        filteredData = filteredData.filter((u: User) => {
          if (userFilters.role.startsWith("CUSTOM:")) {
            const roleId = userFilters.role.split(":")[1];
            const uRoleId =
              typeof u.customRoleId === "object" && u.customRoleId !== null
                ? (u.customRoleId as any)._id
                : u.customRoleId;
            return uRoleId === roleId;
          }
          return u.role === userFilters.role;
        });
      }
      // Status filter
      if (userFilters.status) {
        filteredData = filteredData.filter((u: User) => 
          userFilters.status === "active" ? u.isActive : !u.isActive
        );
      }
      // Main Department filter
      if (userFilters.mainDeptId) {
        filteredData = filteredData.filter((u: User) => {
          const deptId = typeof u.departmentId === "object" && u.departmentId ? (u.departmentId as any)._id : u.departmentId;
          const dept = departments.find(d => d._id === deptId);
          return deptId === userFilters.mainDeptId || getParentDepartmentId(dept) === userFilters.mainDeptId;
        });
      }
      // Sub Department filter
      if (userFilters.subDeptId) {
        filteredData = filteredData.filter((u: User) => {
          const deptId = typeof u.departmentId === "object" && u.departmentId ? (u.departmentId as any)._id : u.departmentId;
          return deptId === userFilters.subDeptId;
        });
      }
      // Search filter
      if (userSearch.trim()) {
        const search = userSearch.toLowerCase().trim();
        filteredData = filteredData.filter(
          (u: User) =>
            u.firstName?.toLowerCase().includes(search) ||
            u.lastName?.toLowerCase().includes(search) ||
            u.email?.toLowerCase().includes(search) ||
            u.phone?.includes(search)
        );
      }
    }

    if (sortConfig.tab !== tab || !sortConfig.key || !sortConfig.direction) {
      return filteredData;
    }

    return [...filteredData].sort((a, b) => {
      let aValue: any = a[sortConfig.key];
      let bValue: any = b[sortConfig.key];

      // Handle nested objects (like department name)
      if (sortConfig.key.includes(".")) {
        const parts = sortConfig.key.split(".");
        aValue = parts.reduce((obj, key) => obj?.[key], a);
        bValue = parts.reduce((obj, key) => obj?.[key], b);
      }

      // String comparison
      if (typeof aValue === "string") {
        return sortConfig.direction === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      // Date or number comparison
      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  };

  const handleToggleUserStatus = async (
    userId: string,
    currentStatus: boolean,
  ) => {
    // Prevent self-deactivation
    if (user && userId === user.id) {
      toast.error("You cannot deactivate yourself");
      return;
    }

    try {
      const response = await userAPI.update(userId, {
        isActive: !currentStatus,
      } as any);
      if (response.success) {
        toast.success(
          `User ${!currentStatus ? "activated" : "deactivated"} successfully`,
        );
        setUsers((prev) =>
          prev.map((u) =>
            u._id === userId ? { ...u, isActive: !currentStatus } : u,
          ),
        );
        fetchUsers(userPage, true);
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to update user status";
      toast.error(errorMessage);
    }
  };

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <LoadingSpinner text="Initializing Dashboard..." />
      </div>
    );
  }

  if (!user || user.role === "SUPER_ADMIN") {
    return null;
  }

  const activeUserFilterCount = [
    userFilters.role,
    userFilters.status,
    userFilters.mainDeptId,
    userFilters.subDeptId,
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header with Gradient */}
      {/* Classic White Header */}
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
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-3 group">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/40 border border-indigo-500/30 group-hover:scale-105 transition-transform duration-300">
                  <LayoutDashboard className="w-5 h-5 text-white" />
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-sm font-black text-white tracking-tight leading-none uppercase">
                    {isCompanyLevel && (company?.name || "Company Level")}
                    {isDepartmentLevel && "Department"}
                    {!hasPermission(user, Permission.VIEW_ANALYTICS) && !isSuperAdmin && "Operations Center"}
                    {hasPermission(user, Permission.VIEW_ANALYTICS) && !isCompanyLevel && !isSuperAdmin && " Portal"}
                  </h1>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                      Control Panel
                    </p>
                    <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span>
                  </div>
                </div>
              </div>

              <div className="h-8 w-px bg-slate-800 hidden lg:block"></div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden lg:flex flex-col items-end mr-2">
                <span className="text-[10px] font-black text-white leading-none uppercase tracking-tight">
                  {user.firstName} {user.lastName}
                </span>
                <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-tighter mt-1 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                  {(user.role || "CUSTOM").replace("_", " ")}
                </span>
              </div>

              <div className="w-px h-6 bg-slate-800 hidden lg:block mr-2"></div>

              <Button
                onClick={logout}
                variant="ghost"
                size="sm"
                className="h-10 w-10 p-0 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all border border-transparent hover:border-slate-700 shadow-sm"
                title="Logout System"
              >
                <Power className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Content wrapper */}
      <main className="max-w-[1600px] mx-auto px-4 lg:px-6 py-4">
        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            if (activeTab !== value) {
              setPreviousTab(activeTab);
              
              // Clear 'REVERTED' status filter when leaving the specialized Reverted tab
              if (activeTab === "reverted") {
                setGrievanceFilters(prev => ({ ...prev, status: "" }));
              }
            }
            if (value === "reverted") {
              setGrievanceFilters((prev) => ({ ...prev, status: "REVERTED" }));
            }
            // Also reset filters if going specifically to grievances from overview
            if (activeTab === "overview" && value === "grievances") {
              setGrievanceFilters(prev => ({ ...prev, status: "" }));
            }
            setActiveTab(value);
          }}
          className="space-y-4 sm:space-y-6"
        >
          <div className="mb-4 sticky top-[64px] z-40 bg-slate-50/95 backdrop-blur-sm py-3 -mx-4 px-4 sm:mx-0 sm:px-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <TabsList className="w-full sm:w-auto bg-slate-200/50 p-1 border border-slate-300/50 h-10 shadow-sm overflow-x-auto no-scrollbar max-w-full">
              {hasPermission(user, Permission.VIEW_ANALYTICS) && (
                <TabsTrigger
                  value="overview"
                  className="px-5 h-8 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg"
                >
                  Overview
                </TabsTrigger>
              )}

              {/* Analytics Tab - Professional Monitoring */}
              {!isSuperAdmin && (
                <TabsTrigger
                  value="analytics"
                  className="px-5 h-8 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg flex items-center"
                >
                  <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
                  {isDFO ? 'Command Center' : 'Analytics'}
                </TabsTrigger>
              )}


              {hasPermission(user, Permission.READ_GRIEVANCE) && (
                <TabsTrigger
                  value="grievances"
                  className="px-5 h-8 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg"
                >
                  {isDFO ? 'Incidents' : 'Grievances'}
                </TabsTrigger>
              )}

              {/* {isCompanyLevel && hasPermission(user, Permission.READ_GRIEVANCE) && (
                <TabsTrigger
                  value="reverted"
                  className="px-5 h-8 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg flex items-center"
                >
                  <Undo2 className="w-3.5 h-3.5 mr-1.5" />
                  {isDFO ? 'Review Required' : 'Reverted'}
                </TabsTrigger>
              )} */}

              {(isCompanyLevel || isDepartmentLevel) && hasModule(Module.APPOINTMENT) &&
                hasPermission(user, Permission.READ_APPOINTMENT) && (
                  <TabsTrigger
                    value="appointments"
                    className="px-5 h-8 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg"
                  >
                    Appointments
                  </TabsTrigger>
                )}

              {isCompanyLevel && (
                <TabsTrigger
                  value="departments"
                  className="px-5 h-8 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg"
                >
                  {isDFO ? "Patrol Units" : "Departments"}
                </TabsTrigger>
              )}

              {isDFO && (
                <>
                  <TabsTrigger
                    value="live-incidents"
                    className="px-5 h-8 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-rose-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300 rounded-lg flex items-center"
                  >
                    <LocateFixed className="w-3.5 h-3.5 mr-1.5" />
                    Tactical Map
                  </TabsTrigger>
                  <TabsTrigger
                    value="geofences"
                    className="px-5 h-8 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300 rounded-lg flex items-center"
                  >
                    <Layers className="w-3.5 h-3.5 mr-1.5" />
                    Boundaries
                  </TabsTrigger>
                </>
              )}

              {(isCompanyLevel || isDepartmentLevel) && (
                <TabsTrigger
                  value="users"
                  className="px-5 h-8 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg"
                >
                  Users
                </TabsTrigger>
              )}

              {hasModule(Module.LEAD_CAPTURE) && isCompanyLevel && (
                <TabsTrigger
                  value="leads"
                  className="px-5 h-8 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg"
                >
                  Leads
                </TabsTrigger>
              )}

              {!hasPermission(user, Permission.VIEW_ANALYTICS) && !isSuperAdmin && (
                <TabsTrigger
                  value="profile"
                  className="px-5 h-8 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg"
                >
                  My Profile
                </TabsTrigger>
              )}
            </TabsList>
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="sm"
              disabled={refreshing}
              className="h-10 w-full sm:w-auto px-4 bg-white border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-all rounded-xl shadow-sm font-bold text-[11px] uppercase tracking-widest gap-2 flex"
            >
              <RefreshCw
                className={cn("w-3.5 h-3.5", refreshing && "animate-spin")}
              />
              <span className="hidden sm:inline">Refresh Data</span>
            </Button>
          </div>

          {/* Overview Tab */}
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
                        {isDFO ? "Total Incidents" : "Total Grievances"}
                      </CardTitle>
                      <div className="p-1.5 bg-indigo-50 rounded-lg">
                        <FileText className="w-3.5 h-3.5 text-indigo-500" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-black text-slate-800 tabular-nums">
                        {loadingStats ? "..." : (stats?.grievances.total || 0)}
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                          {stats?.grievances.last7Days || 0} New
                        </span>
                        <span className="text-[9px] text-slate-400 font-medium">this week</span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Pending Grievances */}
                {hasPermission(user, Permission.READ_GRIEVANCE) && (
                  <Card onClick={() => { setActiveTab("grievances"); setGrievanceFilters((prev) => ({ ...prev, status: "PENDING" })); }} className="bg-white/50 backdrop-blur-sm border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-300 border-l-4 border-l-amber-400 cursor-pointer">
                    <CardHeader className="pb-2 space-y-0 flex flex-row items-center justify-between">
                      <CardTitle className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {isDFO ? "Critical Alerts" : "Overdue Grievances"}
                      </CardTitle>
                      <div className="p-1.5 bg-amber-50 rounded-lg">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-black text-amber-600 tabular-nums">
                        {loadingStats ? "..." : (stats?.grievances.pending || 0)}
                      </div>
                      <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Requiring Response</p>
                    </CardContent>
                  </Card>
                )}

                {/* Total Appointments */}
                {hasModule(Module.APPOINTMENT) && hasPermission(user, Permission.READ_APPOINTMENT) && (
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
                        {loadingStats ? "..." : (stats?.appointments.total || 0)}
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                          {stats?.appointments.confirmed || 0} Confirmed
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
                              {isDFO ? "Forest Ranges" : "Main Departments"}
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
                              {isDFO ? "Forest Beats" : "Sub Departments"}
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
                  <Card onClick={() => { setActiveTab("reverted"); setGrievanceFilters((prev) => ({ ...prev, status: "REVERTED" })); }} className="bg-white/50 backdrop-blur-sm border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-300 border-l-4 border-l-rose-400 cursor-pointer">
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

            {/* Company Info (for Company Admin) - Beautified Modern Design */}
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
                        {hasModule(Module.GRIEVANCE) &&
                          hasPermission(user, Permission.READ_GRIEVANCE) && (
                            <div className="flex flex-col bg-white border border-slate-200/60 rounded-xl p-3 shadow-sm min-w-[140px]">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                                {isDFO ? "Incident Reports" : "Grievances"}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-xl font-black text-slate-900 tracking-tighter">
                                  {stats?.grievances.total || 0}
                                </span>
                                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                                  {stats?.grievances.pending || 0} Open
                                </span>
                              </div>
                            </div>
                          )}
                        {hasModule(Module.APPOINTMENT) &&
                          hasPermission(user, Permission.READ_APPOINTMENT) && (
                            <div className="flex flex-col bg-white border border-slate-200/60 rounded-xl p-3 shadow-sm min-w-[140px]">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                                Appointments
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-xl font-black text-slate-900 tracking-tighter">
                                  {stats?.appointments.total || 0}
                                </span>
                                <span className="text-[9px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded border border-violet-100">
                                  {stats?.appointments.confirmed || 0} High
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

            {/* Department Admin - Profile & Department Info in Overview */}
            {isDepartmentLevel && (
              <div className="space-y-6">
                {/* Department Admin Profile Card */}
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
                      {/* Profile Avatar */}
                      <div className="flex-shrink-0">
                        <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white rounded-2xl flex items-center justify-center shadow-xl text-3xl font-bold">
                          {user?.firstName?.[0]}
                          {user?.lastName?.[0]}
                        </div>
                      </div>
                      {/* Profile Details */}
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-200/60">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                            Identity
                          </p>
                          <p className="text-sm font-black text-slate-900">
                            {user?.firstName} {user?.lastName}
                          </p>
                        </div>
                        <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-200/60">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                            Communication
                          </p>
                          <p className="text-xs font-bold text-slate-600 truncate">
                            {user?.email}
                          </p>
                        </div>
                        <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-200/60">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                            Authorized Role
                          </p>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-600 text-white text-[9px] font-black rounded uppercase tracking-tighter">
                            <Shield className="w-3 h-3" />
                            {user.role}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* My Department Card - with Department Name in Header */}
                <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white mt-6">
                  <CardHeader className="bg-slate-900 px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                        <Building className="w-5 h-5 text-indigo-400" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-bold text-white uppercase tracking-tight">
                          {(() => {
                            // Try to get department from user object first (if populated)
                            if (
                              user?.departmentId &&
                              typeof user.departmentId === "object" &&
                              (user.departmentId as any).name
                            ) {
                              return (user.departmentId as any).name;
                            }
                            // Otherwise use from departments array
                            return departments.length > 0
                              ? departments[0].name
                              : "My Department";
                          })()}
                        </CardTitle>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                          Your department information and service statistics
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    {(() => {
                      // Get the department - prefer from user object if populated, otherwise from departments array
                      let currentDepartment: Department | null = null;
                      if (
                        user?.departmentId &&
                        typeof user.departmentId === "object" &&
                        (user.departmentId as any).name
                      ) {
                        currentDepartment = user.departmentId as any;
                      } else if (departments.length > 0) {
                        currentDepartment = departments[0];
                      }
                      return currentDepartment ? (
                        <div className="space-y-6">
                          {/* Department Header */}
                          <div className="flex items-start gap-6">
                            <div className="flex-shrink-0">
                              <div className="w-16 h-16 bg-slate-100/50 rounded-xl flex items-center justify-center border border-slate-200">
                                <Building className="w-8 h-8 text-slate-400" />
                              </div>
                            </div>
                            <div className="flex-1">
                              <h3 className="text-2xl font-bold text-slate-800 mb-2">
                                {currentDepartment.name}
                              </h3>
                              <p className="text-slate-600">
                                {currentDepartment.description ||
                                  "No description provided"}
                              </p>
                            </div>
                          </div>

                          {/* Department Details Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                                Department ID
                              </p>
                              <p className="text-sm font-mono bg-white px-2 py-1 rounded border border-slate-200 inline-block">
                                {currentDepartment.departmentId}
                              </p>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                                Status
                              </p>
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-full">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Active
                              </span>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                                Contact Person
                              </p>
                              <p className="text-sm font-medium text-slate-700">
                                {currentDepartment.contactPerson ||
                                  user?.firstName + " " + user?.lastName}
                              </p>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                                Contact Email
                              </p>
                              <p className="text-sm font-medium text-slate-700 truncate">
                                {currentDepartment.contactEmail || user?.email}
                              </p>
                            </div>
                          </div>

                          {/* Department Stats */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                            {hasModule(Module.GRIEVANCE) &&
                              hasPermission(
                                user,
                                Permission.READ_GRIEVANCE,
                              ) && (
                                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm group hover:shadow-md transition-all">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
                                        {/* Inundations changed to Grievances for clarity, or kept if preferred */}
                                        Grievances
                                      </p>
                                      <p className="text-2xl font-black text-slate-900 tracking-tighter mt-1">
                                        {stats?.grievances.total || 0}
                                      </p>
                                    </div>
                                    <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                                      <FileText className="w-5 h-5" />
                                    </div>
                                  </div>
                                </div>
                              )}
                            {hasModule(Module.APPOINTMENT) &&
                              hasPermission(
                                user,
                                Permission.READ_APPOINTMENT,
                              ) && (
                                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm group hover:shadow-md transition-all">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
                                        Bookings
                                      </p>
                                      <p className="text-2xl font-black text-slate-900 tracking-tighter mt-1">
                                        {stats?.appointments.total || 0}
                                      </p>
                                    </div>
                                    <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
                                      <CalendarClock className="w-5 h-5" />
                                    </div>
                                  </div>
                                </div>
                              )}

                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <Building className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                          <p className="text-slate-500 text-lg">
                            No department information available
                          </p>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Quick Actions */}
            <Card className="border border-slate-200 shadow-sm rounded-xl overflow-hidden">
              <CardHeader className="bg-slate-900 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center border border-indigo-500/30">
                    <Zap className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-white">
                      Quick Actions
                    </CardTitle>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                      Common tasks and operations
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                {isCompanyLevel && (
                  <>
                    <ProtectedButton
                      permission={Permission.CREATE_DEPARTMENT}
                      className="w-full justify-start"
                      variant="outline"
                      onClick={() => setActiveTab("departments")}
                    >
                      <svg
                        className="w-5 h-5 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        />
                      </svg>
                      Manage Departments
                    </ProtectedButton>
                    <ProtectedButton
                      permission={Permission.CREATE_USER}
                      className="w-full justify-start"
                      variant="outline"
                      onClick={() => setActiveTab("users")}
                    >
                      <svg
                        className="w-5 h-5 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                        />
                      </svg>
                      Manage Users
                    </ProtectedButton>
                    <ProtectedButton
                      permission={Permission.READ_APPOINTMENT}
                      className="w-full justify-start hover:border-indigo-200 hover:text-indigo-600 transition-all"
                      variant="outline"
                      onClick={() => setShowAvailabilityCalendar(true)}
                    >
                      <CalendarCheck className="w-5 h-5 mr-3" />
                      Manage Availability
                    </ProtectedButton>
                  </>
                )}
                {isDepartmentLevel && (
                  <ProtectedButton
                    permission={Permission.READ_APPOINTMENT}
                    className="w-full justify-start hover:border-indigo-200 hover:text-indigo-600 transition-all font-bold"
                    variant="outline"
                    onClick={() => setShowAvailabilityCalendar(true)}
                  >
                    <CalendarClock className="w-5 h-5 mr-3" />
                    Dept. Availability
                  </ProtectedButton>
                )}
                <ProtectedButton
                  permission={Permission.VIEW_ANALYTICS}
                  className="w-full justify-start"
                  variant="outline"
                  onClick={() => setActiveTab("analytics")}
                >
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                  View Analytics
                </ProtectedButton>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Page - Role-Aware Real Analytics */}
          {!isSuperAdmin && (
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
                        {isDFO ? "Forest Intelligence & Analytics" : "Operational Intelligence Dashboard"}
                      </h2>
                      <p className="text-slate-300 text-xs mt-1 font-medium opacity-80 leading-relaxed">
                        {isDFO 
                          ? `Monitoring ${stats?.departments || 0} forest beats and divisions across Bhanupratappur East`
                          : `Visualizing operational health across ${stats?.departments || departments.length} departments and ${stats?.users || users.length} personnel`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {isDFO && (
                      <Button
                        onClick={() => {
                          toast.loading("Generating Division Report...", { duration: 1500 });
                          setTimeout(() => toast.success("Forest Protection Report (PDF) ready for download"), 2000);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-400/30 shadow-lg shadow-indigo-500/20 h-9 font-black text-[10px] uppercase tracking-widest gap-2"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download Report
                      </Button>
                    )}
                    <div className="hidden md:flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl backdrop-blur-sm">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
                      <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                        Live Metrics
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 🌲 DFO Forest Insights (Specialized Tiles) */}
              {company?.name?.toUpperCase().includes('BHANUPRATAPPUR') && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div className="group relative bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl p-4 shadow-lg shadow-orange-500/20 overflow-hidden text-white">
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
                          <Zap className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-[10px] bg-white/20 px-2 py-1 rounded-full font-bold uppercase tracking-wider">High Alert</span>
                      </div>
                      <h4 className="text-white/80 text-[10px] font-black uppercase tracking-widest">Active Wildfires</h4>
                      <p className="text-3xl font-black tracking-tighter mt-1">
                        {stats?.grievances.byPriority?.find(p => p.priority === 'HIGH')?.count || 0}
                      </p>
                    </div>
                    <div className="absolute -right-4 -bottom-4 opacity-20 transform group-hover:scale-110 transition-transform">
                      <Zap className="w-24 h-24" />
                    </div>
                  </div>

                  <div className="group relative bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-4 shadow-lg shadow-emerald-500/20 overflow-hidden text-white">
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
                          <Target className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-[10px] bg-white/20 px-2 py-1 rounded-full font-bold uppercase tracking-wider">Secured</span>
                      </div>
                      <h4 className="text-white/80 text-[10px] font-black uppercase tracking-widest">Wildlife Incidents</h4>
                      <p className="text-3xl font-black tracking-tighter mt-1">
                        {grievances.filter(g => g.category?.toLowerCase().includes('animal') || g.category?.toLowerCase().includes('wildlife')).length || 0}
                      </p>
                    </div>
                    <div className="absolute -right-4 -bottom-4 opacity-20 transform group-hover:scale-110 transition-transform">
                      <Target className="w-24 h-24" />
                    </div>
                  </div>

                  <div className="group relative bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-4 shadow-lg shadow-blue-500/20 overflow-hidden text-white">
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
                          <Shield className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-[10px] bg-white/20 px-2 py-1 rounded-full font-bold uppercase tracking-wider">Monitored</span>
                      </div>
                      <h4 className="text-white/80 text-[10px] font-black uppercase tracking-widest">Total Patrol Areas</h4>
                      <p className="text-3xl font-black tracking-tighter mt-1">
                        {stats?.departments || 0}
                      </p>
                    </div>
                    <div className="absolute -right-4 -bottom-4 opacity-20 transform group-hover:scale-110 transition-transform">
                      <Shield className="w-24 h-24" />
                    </div>
                  </div>

                  <div className="group relative bg-white rounded-2xl p-4 border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-center">
                    <h4 className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Encroachment Alerts</h4>
                    <div className="flex items-baseline gap-2">
                      <p className="text-3xl font-black text-slate-900 tracking-tighter">0</p>
                      <span className="text-emerald-500 text-[10px] font-bold">Stable</span>
                    </div>
                    <div className="mt-2 w-full bg-slate-100 rounded-full h-1">
                      <div className="bg-emerald-500 h-1 rounded-full" style={{ width: '0%' }}></div>
                    </div>
                  </div>
                </div>
              )}

              {/* KPI Cards - Refined Design */}
              <div
                className={cn(
                  "grid gap-4",
                  stats?.isHierarchicalEnabled && isCompanyLevel 
                    ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" 
                    : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5"
                )}
              >
                {/* Total Grievances - Enhanced */}
                {hasModule(Module.GRIEVANCE) && (
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
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        {isDFO ? "Incident Reporting Trend" : "Inbound Grievances"}
                      </h4>
                      <p className="text-2xl font-black text-slate-900 tracking-tighter group-hover:text-indigo-600 transition-colors">
                        {stats?.grievances.total || 0}
                      </p>
                    </div>
                  </div>
                )}

                {/* Actions Needed - Optimized */}
                {hasModule(Module.GRIEVANCE) && (
                  <div 
                    onClick={() => { setActiveTab("grievances"); setGrievanceFilters((prev) => ({ ...prev, status: "PENDING" })); }} 
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
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        {isDFO ? "Active Critical Cases" : "Overdue cases"}
                      </h4>
                      <p className="text-2xl font-black text-amber-600 tracking-tighter">
                        {stats?.grievances.pending || 0}
                      </p>
                    </div>
                  </div>
                )}

                {/* Resolved Page Content - Success Gradient */}
                {hasModule(Module.GRIEVANCE) && (
                  <div 
                    onClick={() => { setActiveTab("grievances"); setGrievanceFilters((prev) => ({ ...prev, status: "RESOLVED" })); }} 
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

                {/* Pending Appointments - Modern Card */}
                {hasModule(Module.APPOINTMENT) && isCompanyLevel && (
                  <div 
                    onClick={() => { setActiveTab("appointments"); setAppointmentFilters((prev) => ({ ...prev, status: "SCHEDULED" })); }} 
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
                        {appointments?.filter((a) => a.status === "SCHEDULED").length || 0}
                      </p>
                    </div>
                  </div>
                )}

                {/* Appointments - Modern Card */}
                {hasModule(Module.APPOINTMENT) && isCompanyLevel && (
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
                {hasModule(Module.GRIEVANCE) && (
                  <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
                          <TrendingUp className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-800">
                            {isDFO ? "Operational Response Trend" : "Grievance Trend"}
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
                            data={stats.grievances.daily.slice(-7).map((d) => ({
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

                {/* Grievance Status Donut - Updated Palette */}
                {hasModule(Module.GRIEVANCE) && (
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

                {/* Appointments by Status - Company Admin only */}
                {hasModule(Module.APPOINTMENT) && isCompanyLevel && (
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
                        users.forEach((u) => {
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
                        ? roleDataRaw.map((r, i) => ({
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
                          {roleData.map((r, i) => (
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

              {isDFO && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                  {/* Spatial Density Heatmap */}
                  <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col min-h-[400px]">
                    <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 backdrop-blur-md">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20">
                          <Activity className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                          <h3 className="text-[13px] font-black text-white uppercase tracking-tight">
                            Incident Density Heatmap
                          </h3>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5">
                            Spatial analysis of forest violations
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 border border-rose-500/20 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
                          <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest">Action Zones</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 p-6 flex flex-col">
                      <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800/50 relative overflow-hidden group">
                        {/* Mock Heatmap Visualization */}
                        <div className="absolute inset-0 grid grid-cols-8 grid-rows-8 gap-0.5 opacity-20">
                          {Array.from({ length: 64 }).map((_, i) => (
                            <div 
                              key={i} 
                              className={`w-full h-full transition-all duration-1000 ${
                                i === 12 || i === 25 || i === 26 || i === 44 || i === 37 
                                  ? 'bg-rose-500 animate-pulse' 
                                  : i === 18 || i === 33 || i === 50
                                    ? 'bg-orange-500 opacity-60'
                                    : 'bg-indigo-900/30'
                              }`}
                            />
                          ))}
                        </div>
                        
                        {/* Active Markers */}
                        <div className="absolute inset-0 p-4">
                          {(liveIncidents || []).slice(0, 5).map((inc, i) => (
                            <div 
                              key={i} 
                              className="absolute w-4 h-4"
                              style={{ 
                                left: `${20 + (i * 15)}%`, 
                                top: `${30 + (i * 10)}%` 
                              }}
                            >
                              <div className={`w-full h-full rounded-full ${inc.severity === 'CRITICAL' ? 'bg-rose-500' : 'bg-orange-500'} animate-ping opacity-40`} />
                              <div className={`absolute inset-0 w-2 h-2 m-auto rounded-full ${inc.severity === 'CRITICAL' ? 'bg-rose-600' : 'bg-orange-600'} border border-white/40 shadow-lg`} />
                            </div>
                          ))}
                        </div>

                        <div className="absolute bottom-4 left-4 right-4 bg-slate-900/90 backdrop-blur-xl border border-white/10 p-3 rounded-lg shadow-2xl">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">Active Incident Summary</span>
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Bhanupratappur East</span>
                          </div>
                          <div className="flex gap-4">
                            <div className="flex-1">
                              <p className="text-[10px] text-slate-500 font-black uppercase tracking-tighter">High Risk Areas</p>
                              <p className="text-sm font-black text-rose-400">Range A, Sector 4</p>
                            </div>
                            <div className="w-px h-8 bg-slate-800" />
                            <div className="flex-1">
                              <p className="text-[10px] text-slate-500 font-black uppercase tracking-tighter">Current Trend</p>
                              <p className="text-sm font-black text-emerald-400">Down 12% <span className="text-[8px] font-mono text-slate-500 uppercase ml-1">v/s last wk</span></p>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3 mt-4">
                        <div className="bg-slate-800/30 border border-slate-800 p-3 rounded-xl">
                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Response Time</p>
                          <p className="text-xl font-black text-white tabular-nums">24<span className="text-[10px] lowercase text-slate-400 ml-0.5">min</span></p>
                        </div>
                        <div className="bg-slate-800/30 border border-slate-800 p-3 rounded-xl">
                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Patrol Coverage</p>
                          <p className="text-xl font-black text-white tabular-nums">92<span className="text-[10px] text-slate-400 ml-0.5">%</span></p>
                        </div>
                        <div className="bg-slate-800/30 border border-slate-800 p-3 rounded-xl">
                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Forest Integrity</p>
                          <p className="text-xl font-black text-emerald-400 tabular-nums">8/10</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Response Performance Analysis */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center border border-emerald-100/50">
                          <Target className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <h3 className="text-[13px] font-black text-slate-800 uppercase tracking-tight">
                            Efficiency Analysis
                          </h3>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5">
                            SLA Performance across divisions
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="p-6 flex-1">
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart
                          data={(forestBeats || []).slice(0, 6)}
                          margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }} 
                          />
                          <YAxis hide />
                          <Tooltip 
                            cursor={{ fill: '#f8fafc' }}
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-2xl">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                                    <p className="text-sm font-black text-white">Efficiency: 94%</p>
                                    <p className="text-[10px] text-emerald-400 font-bold mt-1">Above target</p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar 
                            dataKey="incidents" 
                            radius={[6, 6, 0, 0]} 
                            barSize={32}
                          >
                            {(forestBeats || []).map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={index % 2 === 0 ? '#6366f1' : '#10b981'} 
                                fillOpacity={0.8}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      
                      <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200/60">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Division Productivity</span>
                          <span className="text-xs font-black text-emerald-600">+8.4%</span>
                        </div>
                        <div className="space-y-3">
                          {(forestBeats || []).slice(0, 3).map((beat, i) => (
                            <div key={i} className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-slate-700">{beat.name}</span>
                              <div className="flex items-center gap-3">
                                <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-indigo-500 rounded-full" 
                                    style={{ width: `${80 + (i * 5)}%` }}
                                  />
                                </div>
                                <span className="text-[10px] font-black text-slate-900 tabular-nums">
                                  {80 + (i * 5)}%
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Department Table - Company Admin only */}
              {/*   {isCompanyLevel && departments.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-teal-50 rounded-lg flex items-center justify-center">
                        <Building className="w-4 h-4 text-teal-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">
                          Department Health Monitor
                        </h3>
                        <p className="text-[10px] text-slate-400">
                          Per-department status and metrics
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold bg-teal-50 text-teal-600 px-2 py-1 rounded-lg">
                      {departments.length} departments
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Department
                          </th>
                          <th className="px-4 py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Status
                          </th>
                          <th className="px-4 py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Staff
                          </th>
                          <th className="px-4 py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Type
                          </th>
                          <th className="px-4 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {departments.map((dept, i) => {
                          const deptUsers = users.filter((u) => {
                            const uDeptId =
                              typeof u.departmentId === "object" &&
                              u.departmentId
                                ? (u.departmentId as any)._id
                                : u.departmentId;
                            return uDeptId === dept._id;
                          });
                          return (
                            <tr
                              key={dept._id}
                              className="hover:bg-slate-50/70 transition-colors"
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-600 font-bold text-sm flex-shrink-0">
                                    {dept.name[0]}
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-slate-800">
                                      {dept.name}
                                    </p>
                                    <p className="text-[10px] text-slate-400 font-mono">
                                      {dept.departmentId}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${dept.isActive !== false ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${dept.isActive !== false ? "bg-emerald-500" : "bg-red-500"}`}
                                  ></span>
                                  {dept.isActive !== false
                                    ? "Active"
                                    : "Inactive"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="text-sm font-black text-slate-800">
                                  {deptUsers.length}
                                </span>
                                <span className="text-[10px] text-slate-400 ml-1">
                                  staff
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${dept.parentDepartmentId ? "bg-purple-50 text-purple-600" : "bg-blue-50 text-blue-600"}`}
                                >
                                  {dept.parentDepartmentId
                                    ? "Sub-dept"
                                    : "Main"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  onClick={() =>
                                    router.push(
                                      `/dashboard/department/${dept._id}`,
                                    )
                                  }
                                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-lg transition-all"
                                >
                                  View →
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )} */}


            </TabsContent>
          )}

          {isDFO && (
            <>
              {/* 🗺️ Live Incidents Map Tab */}
              <TabsContent value="live-incidents" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                  {/* Left Panel: Incident Feed */}
                  <Card className="lg:col-span-1 rounded-2xl border-slate-200 shadow-sm bg-white overflow-hidden flex flex-col h-[600px]">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                      <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                        <Flame className="w-4 h-4 text-rose-500 animate-pulse" />
                        Live Incident Feed
                      </h3>
                      <span className="bg-rose-100 text-rose-600 text-[10px] font-black px-2 py-0.5 rounded-full">
                        {liveIncidents.length} NEW
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                      {liveIncidents.length > 0 ? liveIncidents.map((incident) => (
                        <div 
                          key={incident.id}
                          className="p-3 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all cursor-pointer group"
                          onClick={() => openGrievanceDetail(incident.id)}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-[10px] font-black uppercase tracking-widest ${incident.severity === 'CRITICAL' ? 'text-rose-500' : 'text-amber-500'}`}>
                              {incident.severity}
                            </span>
                            <span className="text-[9px] text-slate-400 font-medium">
                              {new Date(incident.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <h4 className="text-[12px] font-bold text-slate-800 leading-snug group-hover:text-indigo-600 truncate">
                            {incident.title}
                          </h4>
                          <div className="flex items-center gap-1.5 mt-2">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span className="text-[10px] text-slate-500 font-bold uppercase truncate">
                              {incident.area}
                            </span>
                          </div>
                        </div>
                      )) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50 space-y-2">
                          <ShieldAlert className="w-8 h-8" />
                          <p className="text-xs font-bold uppercase">No active threats detected</p>
                        </div>
                      )}
                    </div>
                  </Card>

                  {/* Right Panel: Spatial Density Map */}
                  <Card className="lg:col-span-3 rounded-2xl border-slate-200 shadow-sm bg-slate-900 overflow-hidden relative h-[600px]">
                    {/* Tactical Map View with Interactive Leaflet Integration */}
                    <div className="absolute inset-0 z-0">
                      <TacticalForestMap incidents={liveIncidents} />
                    </div>


                    <div className="absolute bottom-6 right-6 z-10">
                      <div className="bg-black/60 backdrop-blur-xl border border-white/10 px-4 py-3 rounded-2xl text-white shadow-2xl flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)]"></span>
                          <span className="text-[10px] font-black uppercase tracking-widest">Fire Hazard</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]"></span>
                          <span className="text-[10px] font-black uppercase tracking-widest">Wildlife Move</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.8)]"></span>
                          <span className="text-[10px] font-black uppercase tracking-widest">Active Patrol</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              </TabsContent>

              {/* 🛡️ Geofences Boundary Tab */}
              <TabsContent value="geofences" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Summary Stats */}
                  <Card className="p-6 bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl shadow-lg border-0 overflow-hidden relative">
                    <div className="relative z-10">
                      <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-4 backdrop-blur-md">
                        <Layers className="w-6 h-6 text-white" />
                      </div>
                      <h3 className="text-white/80 text-[10px] font-black uppercase tracking-widest mb-1">Total Protected Area</h3>
                      <p className="text-3xl font-black tracking-tighter">14,250 <span className="text-lg font-medium opacity-60">HECTARE</span></p>
                      <div className="mt-4 flex items-center gap-2 bg-white/10 w-fit px-3 py-1 rounded-full border border-white/5">
                        <span className="text-[10px] font-bold">42 Active Geofences</span>
                      </div>
                    </div>
                    <Layers className="absolute -right-8 -bottom-8 w-48 h-48 opacity-10 rotate-12" />
                  </Card>

                  <Card className="p-6 bg-white rounded-2xl shadow-sm border border-slate-100">
                    <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-4">
                      <ShieldAlert className="w-6 h-6 text-indigo-600" />
                    </div>
                    <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Boundary Violations</h3>
                    <p className="text-3xl font-black tracking-tighter text-slate-900">12 <span className="text-lg font-medium opacity-40 text-rose-500">↑ 4%</span></p>
                    <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-tight">Last 30 Days Activity</p>
                  </Card>

                  <Card className="p-6 bg-white rounded-2xl shadow-sm border border-slate-100">
                    <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mb-4">
                      <Trees className="w-6 h-6 text-emerald-600" />
                    </div>
                    <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Operational Ranges</h3>
                    <p className="text-3xl font-black tracking-tighter text-slate-900">{stats?.mainDepartments || 4}</p>
                    <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-tight">Verified Forest Borders</p>
                  </Card>
                </div>

                <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden bg-white">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Forest Boundary Inventory</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Hierarchy of Ranges and Beats</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        onClick={() => {
                          toast.promise(new Promise(resolve => setTimeout(resolve, 2000)), {
                            loading: 'Processing KMZ Boundaries...',
                            success: 'Forest boundaries synchronized with Satellite Data',
                            error: 'Failed to sync boundaries',
                          });
                        }}
                        className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 border-0"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Sync KMZ Data
                      </Button>
                      <button className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all">
                        <ScanSearch className="w-4 h-4" />
                        Verify Bounds
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Forest Range</th>
                          <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Beats Under Range</th>
                          <th className="px-6 py-4 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Area (Ha)</th>
                          <th className="px-6 py-4 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">Incident Hotspots</th>
                          <th className="px-6 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">Integrity Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {forestBeats.slice(0, 10).map((beat, i) => (
                          <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-700">
                                  <Trees className="w-4 h-4" />
                                </div>
                                <span className="text-sm font-bold text-slate-800">{beat.range}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-700">{beat.name}</span>
                                <span className="text-[9px] text-slate-400 font-mono uppercase mt-0.5">ID: {beat.id.slice(-8)}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="text-sm font-black text-slate-700">{(400 + (i * 120)).toLocaleString()}</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="inline-flex items-center gap-2 border border-slate-200 px-3 py-1 rounded-full bg-white shadow-sm">
                                <span className={`w-1.5 h-1.5 rounded-full ${beat.incidents > 5 ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'}`}></span>
                                <span className="text-[10px] font-black text-slate-700">{beat.incidents} ACTS</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${beat.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                {beat.status === 'Active' ? 'VERIFIED' : 'MAINTENANCE'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </TabsContent>
            </>
          )}

          {/* Departments Tab - Only for Company Admin */}
          {isCompanyLevel && (
            <TabsContent value="departments" className="space-y-4">
              <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
                {/* Header */}
                <CardHeader className="bg-slate-900 px-4 sm:px-6 py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                        <Building className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                          Department Management
                          <span className="text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                            {departments.length} total
                          </span>
                        </CardTitle>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                          Manage all departments in your company
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => fetchDepartments(1, false)}
                        className="h-8 w-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all border border-white/10"
                        title="Refresh departments"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      <ProtectedButton
                        permission={Permission.CREATE_DEPARTMENT}
                        onClick={() => setShowDepartmentDialog(true)}
                        className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white border-0 h-8 text-[10px] font-bold uppercase tracking-widest rounded-lg px-4 shadow-md"
                      >
                        <Building className="w-3.5 h-3.5 mr-1.5" />
                        Add Department
                      </ProtectedButton>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  {/* Search bar */}
                  <div className="px-3 sm:px-5 py-3 border-b border-slate-100 bg-slate-50/40 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
                    <div className="relative w-full sm:flex-1 sm:min-w-[240px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search departments by name or ID..."
                        value={deptSearch}
                        onChange={(e) => setDeptSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm"
                      />
                    </div>
                    {/* Dept Filters */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 w-full">
                       <select
                        value={deptFilters.type}
                        onChange={(e) => setDeptFilters(prev => ({ ...prev, type: e.target.value }))}
                        className="w-full text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500/10 outline-none cursor-pointer hover:border-indigo-200 transition-all"
                      >
                        <option value="">All Types</option>
                        <option value="main">Main Depts</option>
                        <option value="sub">Sub Depts</option>
                      </select>
                      <select
                        value={deptFilters.status}
                        onChange={(e) => setDeptFilters(prev => ({ ...prev, status: e.target.value }))}
                        className="w-full text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500/10 outline-none cursor-pointer hover:border-indigo-200 transition-all"
                      >
                        <option value="">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                      <select
                        value={deptFilters.mainDeptId}
                        onChange={(e) => setDeptFilters(prev => ({ ...prev, mainDeptId: e.target.value }))}
                        className="w-full text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500/10 outline-none cursor-pointer hover:border-indigo-200 transition-all sm:min-w-[150px]"
                      >
                        <option value="">Filter by Main Dept</option>
                        {departments.filter(d => !d.parentDepartmentId).map(dept => (
                           <option key={dept._id} value={dept._id}>{dept.name}</option>
                        ))}
                      </select>
                      {(deptFilters.type || deptFilters.status || deptFilters.mainDeptId) && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setDeptFilters({ type: "", status: "", mainDeptId: "" })}
                          className="h-7 text-[9px] font-bold text-red-500 hover:text-red-600 hover:bg-red-50 uppercase tracking-tighter"
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <span className="px-2 py-1 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg">
                        {
                          departments.filter((d) => !d.parentDepartmentId)
                            .length
                        }{" "}
                        Main
                      </span>
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg">
                        {
                          departments.filter((d) => !!d.parentDepartmentId)
                            .length
                        }{" "}
                        Sub
                      </span>
                    </div>
                  </div>

                  {loadingDepartments ? (
                    <TableSkeleton rows={8} cols={5} />
                  ) : departments.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="w-20 h-20 bg-gradient-to-br from-cyan-100 to-teal-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Building className="w-10 h-10 text-cyan-500" />
                      </div>
                      <p className="text-gray-500 text-lg font-medium">
                        No departments found
                      </p>
                      <p className="text-gray-400 text-sm mt-1">
                        Add a department to get started
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <div className="max-h-[640px] overflow-y-auto">
                        <table className="w-full relative border-collapse min-w-[900px]">
                          <thead className="sticky top-0 z-20 bg-[#fcfdfe] border-b border-slate-200">
                            <tr>
                              <th className="px-3 py-3 text-center text-[9px] font-black text-slate-400 border-b border-slate-100 uppercase tracking-widest w-12">
                                Sr.
                              </th>
                              <th className="px-4 py-3 text-left border-b border-slate-100">
                                <button
                                  onClick={() =>
                                    handleSort("name", "departments")
                                  }
                                  className="group flex items-center space-x-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                                >
                                  <span>Department Name</span>
                                  <ArrowUpDown
                                    className={`w-3 h-3 transition-colors ${sortConfig.key === "name" ? "text-indigo-500" : "text-slate-300 group-hover:text-slate-400"}`}
                                  />
                                </button>
                              </th>
                              <th className="px-4 py-3 text-left border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                Dept ID
                              </th>
                              <th className="px-4 py-3 text-center border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                Type
                              </th>
                              <th className="px-4 py-3 text-center border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                Users
                              </th>
                              <th className="px-4 py-3 text-left border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                Head / Contact
                              </th>
                              <th className="px-4 py-3 text-center border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                Status
                              </th>
                              <th className="px-4 py-3 text-right border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {getSortedData(departments, "departments").map((dept, index) => {
                              const isMain = !dept.parentDepartmentId;
                              const userCount = dept.userCount || deptUserCounts[dept._id] || 0;
                              const parentName =
                                typeof dept.parentDepartmentId === "object" &&
                                dept.parentDepartmentId
                                  ? (dept.parentDepartmentId as any).name
                                  : null;
                              return (
                                <tr
                                  key={dept._id}
                                  className="hover:bg-indigo-50/30 transition-all duration-150 group/row"
                                >
                                  {/* # */}
                                  <td className="px-3 py-4 text-center">
                                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-500 text-[10px] font-black group-hover/row:bg-indigo-100 group-hover/row:text-indigo-700 transition-colors">
                                      {index + 1}
                                    </span>
                                  </td>

                                  {/* Department Name */}
                                  <td className="px-4 py-4">
                                    <div className="flex items-center gap-3">
                                      <div
                                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                          isMain
                                            ? "bg-indigo-50 text-indigo-600 border border-indigo-100"
                                            : "bg-slate-100 text-slate-500 border border-slate-200"
                                        }`}
                                      >
                                        <Building className="w-3.5 h-3.5" />
                                      </div>
                                      <div>
                                        <div
                                          className="text-sm font-bold text-slate-900 group-hover/row:text-indigo-600 cursor-pointer hover:underline transition-colors flex items-center gap-1.5"
                                          onClick={() => {
                                            setNavigatingToDepartment(dept._id);
                                            setSelectedDepartmentId(dept._id);
                                            router.push(
                                              `/dashboard/department/${dept._id}`,
                                            );
                                          }}
                                        >
                                          {navigatingToDepartment ===
                                          dept._id ? (
                                            <>
                                              <LoadingSpinner />
                                              <span className="ml-2">
                                                Loading...
                                              </span>
                                            </>
                                          ) : (
                                            dept.name
                                          )}
                                        </div>
                                        {!isMain && parentName && (
                                          <p className="text-[10px] text-slate-400 mt-0.5">
                                            ↳ {parentName}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </td>

                                  {/* Dept ID */}
                                  <td className="px-4 py-4 whitespace-normal break-all">
                                    <span className="text-[10px] font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200 uppercase">
                                      {dept.departmentId}
                                    </span>
                                  </td>

                                  {/* Type */}
                                  <td className="px-4 py-4 text-center whitespace-normal">
                                    {isMain ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100">
                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                        Main
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                        Sub
                                      </span>
                                    )}
                                  </td>

                                  {/* User Count */}
                                  <td className="px-4 py-4 text-center">
                                    <div className="inline-flex items-center justify-center">
                                      <button
                                        className={`min-w-[32px] h-8 px-2 rounded-xl flex items-center justify-center text-xs font-black transition-all shadow-sm border ${
                                          userCount > 0
                                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:scale-105 active:scale-95"
                                            : "bg-slate-50 text-slate-400 border-slate-200"
                                        }`}
                                        onClick={() => {
                                          if (userCount > 0) {
                                            setSelectedDeptForUsers({
                                              id: dept._id,
                                              name: dept.name,
                                            });
                                            setShowDeptUsersDialog(true);
                                          }
                                        }}
                                        title={
                                          userCount > 0
                                            ? "Click to view personnel"
                                            : "No users in this department"
                                        }
                                      >
                                        <Users className={`w-3 h-3 mr-1.5 ${userCount > 0 ? "text-emerald-500" : "text-slate-300"}`} />
                                        {userCount}
                                      </button>
                                    </div>
                                  </td>

                                  {/* Head / Contact */}
                                  <td className="px-4 py-4 whitespace-normal break-words">
                                    <div className="flex flex-col gap-1 min-w-[120px]">
                                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-tight">
                                        <UserIcon className="w-3 h-3 text-slate-400 shrink-0" />
                                        {dept.head || (dept as any).headName || dept.contactPerson || (
                                          <span className="text-slate-300 font-medium">
                                            Not assigned
                                          </span>
                                        )}
                                      </div>
                                      {(dept.headEmail || dept.contactEmail) && (
                                        <div className="text-[10px] text-indigo-500 flex items-center gap-1.5 font-bold hover:underline cursor-pointer transition-colors px-1 break-all">
                                          <Mail className="w-3 h-3 text-indigo-300 shrink-0" />
                                          {dept.headEmail || dept.contactEmail}
                                        </div>
                                      )}
                                    </div>
                                  </td>

                                  {/* Status */}
                                  <td className="px-4 py-4 text-center whitespace-normal">
                                    <div className="flex items-center justify-center gap-2">
                                      <button
                                        onClick={() => {
                                          setConfirmDialog({
                                            isOpen: true,
                                            title: dept.isActive
                                              ? "Deactivate Department"
                                              : "Activate Department",
                                            message: dept.isActive
                                              ? `Are you sure you want to deactivate "${dept.name}"?`
                                              : `Are you sure you want to activate "${dept.name}"?`,
                                            onConfirm: async () => {
                                              try {
                                                const response =
                                                  await departmentAPI.update(
                                                    dept._id,
                                                    {
                                                      isActive: !dept.isActive,
                                                    },
                                                  );
                                                if (response.success) {
                                                  toast.success(
                                                    `Department ${!dept.isActive ? "activated" : "deactivated"} successfully`,
                                                  );
                                                  fetchDepartments(1, true);
                                                }
                                              } catch (error: any) {
                                                toast.error(
                                                  error.message ||
                                                    "Failed to update department status",
                                                );
                                              } finally {
                                                setConfirmDialog((p) => ({
                                                  ...p,
                                                  isOpen: false,
                                                }));
                                              }
                                            },
                                            variant: dept.isActive
                                              ? "warning"
                                              : "default",
                                          } as any);
                                        }}
                                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                                          dept.isActive
                                            ? "bg-emerald-500"
                                            : "bg-gray-300"
                                        }`}
                                      >
                                        <span
                                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                                            dept.isActive
                                              ? "translate-x-[18px]"
                                              : "translate-x-0.5"
                                          }`}
                                        />
                                      </button>
                                      <span
                                        className={`text-[9px] font-black uppercase tracking-wider ${
                                          dept.isActive
                                            ? "text-emerald-600"
                                            : "text-gray-400"
                                        }`}
                                      >
                                        {dept.isActive ? "Active" : "Inactive"}
                                      </span>
                                    </div>
                                  </td>

                                  {/* Actions */}
                                  <td className="px-4 py-4 whitespace-normal text-right">
                                    <div className="flex justify-end items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                        onClick={() => {
                                          setEditingDepartment(dept);
                                          setShowDepartmentDialog(true);
                                        }}
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                        onClick={() => {
                                          setConfirmDialog({
                                            isOpen: true,
                                            title: "Delete Department",
                                            message: `Are you sure you want to delete "${dept.name}"? This action cannot be undone.`,
                                            onConfirm: async () => {
                                              try {
                                                const response =
                                                  await departmentAPI.delete(
                                                    dept._id,
                                                  );
                                                if (response.success) {
                                                  toast.success(
                                                    "Department deleted successfully",
                                                  );
                                                  fetchDepartments(1, false);
                                                }
                                              } catch (error: any) {
                                                toast.error(
                                                  error.message ||
                                                    "Failed to delete department",
                                                );
                                              } finally {
                                                setConfirmDialog((p) => ({
                                                  ...p,
                                                  isOpen: false,
                                                }));
                                              }
                                            },
                                            variant: "danger",
                                          } as any);
                                        }}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Footer info */}
                      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <span>
                          Showing{" "}
                          {
                            departments.filter(
                              (d) =>
                                !deptSearch ||
                                d.name
                                  .toLowerCase()
                                  .includes(deptSearch.toLowerCase()) ||
                                d.departmentId
                                  ?.toLowerCase()
                                  .includes(deptSearch.toLowerCase()),
                            ).length
                          }{" "}
                          of {departments.length} departments
                        </span>
                        <span>
                          {departments.filter((d) => d.isActive).length} active
                          · {departments.filter((d) => !d.isActive).length}{" "}
                          inactive
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Leads Tab Content */}
          {hasModule(Module.LEAD_CAPTURE) && isCompanyLevel && (
            <TabsContent value="leads" className="space-y-6">
              <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
                <CardHeader className="bg-slate-900 px-4 sm:px-6 py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                        <UserPlus className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-bold text-white">
                          Project Leads{" "}
                          {leads.length > 0 && `(${leads.length})`}
                        </CardTitle>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                          Leads captured from chatbot interactions
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        exportToCSV(leads, "leads", [
                          { key: "leadId", label: "Lead ID" },
                          { key: "name", label: "Name" },
                          { key: "companyName", label: "Company" },
                          { key: "contactInfo", label: "Phone" },
                          { key: "projectType", label: "Project Type" },
                          { key: "budgetRange", label: "Budget" },
                          { key: "status", label: "Status" },
                        ])
                      }
                      className="flex items-center gap-2 px-4 h-8 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all border border-white/20 text-[10px] font-bold uppercase tracking-wider"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export CSV
                    </button>
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  {loadingLeads ? (
                    <div className="p-8 text-center text-slate-500">
                      Loading leads...
                    </div>
                  ) : leads.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                        <UserPlus className="w-8 h-8 text-slate-400" />
                      </div>
                      <p className="text-lg font-medium text-slate-700">
                        No leads found
                      </p>
                      <p className="text-sm text-slate-500 mt-1">
                        Leads captured from the chatbot will appear here.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                              Lead ID
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                              Contact Details
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                              Project Info
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                              Date
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {leads.map((lead) => (
                            <tr
                              key={lead._id}
                              className="hover:bg-slate-50/50 transition-colors"
                            >
                              <td className="px-6 py-4">
                                <span className="font-mono text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded">
                                  {lead.leadId}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col">
                                  <span className="font-semibold text-slate-900">
                                    {lead.name}
                                  </span>
                                  {lead.companyName && (
                                    <span className="text-xs text-slate-500">
                                      {lead.companyName}
                                    </span>
                                  )}
                                  <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                                    <Phone className="w-3 h-3" />
                                    {lead.contactInfo}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col gap-1">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 w-fit">
                                    {lead.projectType}
                                  </span>
                                  {lead.budgetRange && (
                                    <span className="text-xs text-slate-500">
                                      Budget: {lead.budgetRange}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                                  ${
                                    lead.status === "NEW"
                                      ? "bg-blue-100 text-blue-800"
                                      : lead.status === "CONTACTED"
                                        ? "bg-yellow-100 text-yellow-800"
                                        : lead.status === "QUALIFIED"
                                          ? "bg-green-100 text-green-800"
                                          : "bg-slate-100 text-slate-800"
                                  }`}
                                >
                                  {lead.status?.toLowerCase().replace("_", " ")}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-500">
                                {new Date(lead.createdAt).toLocaleDateString()}
                                <div className="text-xs text-slate-400">
                                  {new Date(lead.createdAt).toLocaleTimeString(
                                    [],
                                    { hour: "2-digit", minute: "2-digit" },
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Users Tab Content (existing) */}
          {(isCompanyLevel || isDepartmentLevel) && (
            <TabsContent value="users" className="space-y-6">
              <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
                <CardHeader className="bg-slate-900 px-4 sm:px-6 py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                        <Users className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-bold text-white">
                          User Management
                        </CardTitle>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                          {isCompanyLevel
                            ? "Manage users in your company"
                            : "Manage users in your department"}
                        </p>
                      </div>
                    </div>
                    {hasPermission(user, Permission.CREATE_USER) && (
                      <Button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowUserDialog(true);
                        }}
                        className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white border-0 h-8 text-[10px] font-bold uppercase tracking-widest rounded-lg px-4 shadow-md"
                      >
                        <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                        Add User
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {/* Search and Filters for Users */}
                  <div className="px-3 sm:px-5 py-3 border-b border-slate-100 bg-slate-50/40 flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                      <div className="relative w-full sm:flex-1 sm:min-w-[240px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search users by name, email, phone or ID..."
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm"
                        />
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowUserFiltersOnMobile((prev) => !prev)}
                          className="sm:hidden h-8 flex-1 text-[10px] font-bold uppercase tracking-wider border-slate-200 text-slate-700"
                        >
                          <Filter className="w-3.5 h-3.5 mr-1.5" />
                          Filters {activeUserFilterCount > 0 ? `(${activeUserFilterCount})` : ""}
                        </Button>
                        {(userFilters.role || userFilters.status || userFilters.mainDeptId || userFilters.subDeptId || userSearch.trim()) && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setUserSearch("");
                              setUserFilters({ role: "", status: "", mainDeptId: "", subDeptId: "" });
                            }}
                            className="h-8 px-3 sm:px-2 text-[10px] font-bold text-red-500 hover:text-red-600 hover:bg-red-50 uppercase tracking-tighter"
                          >
                            Clear All
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* User Filters */}
                    <div className={`${showUserFiltersOnMobile ? "grid" : "hidden"} sm:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-2 w-full`}>
                      <select
                        value={userFilters.role}
                        onChange={(e) => setUserFilters(prev => ({ ...prev, role: e.target.value }))}
                        className="w-full h-9 text-[10px] font-bold uppercase tracking-wider px-3 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500/10 outline-none cursor-pointer hover:border-indigo-200 transition-all"
                        aria-label="Filter users by role"
                      >
                        <option value="">All Roles</option>
                        {roles.map(r => (
                          <option key={r._id} value={`CUSTOM:${r._id}`}>{r.name}</option>
                        ))}
                        {isSuperAdmin && <option value="SUPER_ADMIN">Super Admin</option>}
                      </select>
                      <select
                        value={userFilters.status}
                        onChange={(e) => setUserFilters(prev => ({ ...prev, status: e.target.value }))}
                        className="w-full h-9 text-[10px] font-bold uppercase tracking-wider px-3 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500/10 outline-none cursor-pointer hover:border-indigo-200 transition-all"
                        aria-label="Filter users by status"
                      >
                        <option value="">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                      <select
                        value={userFilters.mainDeptId}
                        onChange={(e) => setUserFilters(prev => ({ ...prev, mainDeptId: e.target.value, subDeptId: "" }))}
                        className="w-full h-9 text-[10px] font-bold uppercase tracking-wider px-3 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500/10 outline-none cursor-pointer hover:border-indigo-200 transition-all"
                        aria-label="Filter users by main department"
                      >
                        <option value="">Main Dept</option>
                        {departments.filter(d => !d.parentDepartmentId).map(dept => (
                          <option key={dept._id} value={dept._id}>{dept.name}</option>
                        ))}
                      </select>
                      <select
                        value={userFilters.subDeptId}
                        onChange={(e) => setUserFilters(prev => ({ ...prev, subDeptId: e.target.value }))}
                        className="w-full h-9 text-[10px] font-bold uppercase tracking-wider px-3 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500/10 outline-none cursor-pointer hover:border-indigo-200 transition-all disabled:bg-slate-100 disabled:text-slate-400"
                        disabled={!userFilters.mainDeptId}
                        aria-label="Filter users by sub department"
                      >
                        <option value="">Sub Dept</option>
                        {userFilters.mainDeptId && departments.filter(d => getParentDepartmentId(d) === userFilters.mainDeptId).map(dept => (
                          <option key={dept._id} value={dept._id}>{dept.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {loadingUsers ? (
                    <TableSkeleton rows={8} cols={6} />
                  ) : users.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="w-20 h-20 bg-gradient-to-br from-emerald-100 to-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Users className="w-10 h-10 text-emerald-500" />
                      </div>
                      <p className="text-slate-500 text-lg font-medium">
                        No users found
                      </p>
                      <p className="text-slate-400 text-sm mt-1">
                        Add a user to get started
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-hidden">
                      <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full min-w-[980px] relative border-collapse table-auto">
                          <thead className="bg-[#fcfdfe] border-b border-slate-200">
                            <tr>
                              <th className="px-3 py-3 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest w-[5%]">
                                Sr.
                              </th>
                              <th className="px-6 py-3 text-left w-[25%]">
                                <button
                                  onClick={() =>
                                    handleSort("firstName", "users")
                                  }
                                  className="group flex items-center space-x-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                                >
                                  <span>User Info</span>
                                  <ArrowUpDown
                                    className={`w-3 h-3 transition-colors ${sortConfig.key === "firstName" ? "text-indigo-500" : "text-slate-300 group-hover:text-slate-400"}`}
                                  />
                                </button>
                              </th>
                              <th className="px-5 py-3 text-left">
                                <button
                                  onClick={() => handleSort("email", "users")}
                                  className="group flex items-center space-x-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                                >
                                  <span>Contact Information</span>
                                  <ArrowUpDown
                                    className={`w-3 h-3 transition-colors ${sortConfig.key === "email" ? "text-indigo-500" : "text-slate-300 group-hover:text-slate-400"}`}
                                  />
                                </button>
                              </th>
                              <th className="px-6 py-3 text-left">
                                <button
                                  onClick={() => handleSort("role", "users")}
                                  className="group flex items-center space-x-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                                >
                                  <span>Role &amp; Dept</span>
                                  <ArrowUpDown
                                    className={`w-3 h-3 transition-colors ${sortConfig.key === "role" ? "text-indigo-500" : "text-slate-300 group-hover:text-slate-400"}`}
                                  />
                                </button>
                              </th>
                              <th className="px-6 py-3 text-left">
                                <button
                                  onClick={() =>
                                    handleSort("isActive", "users")
                                  }
                                  className="group flex items-center space-x-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                                >
                                  <span>Status &amp; Access</span>
                                  <ArrowUpDown
                                    className={`w-3 h-3 transition-colors ${sortConfig.key === "isActive" ? "text-indigo-500" : "text-slate-300 group-hover:text-slate-400"}`}
                                  />
                                </button>
                              </th>
                              <th className="px-6 py-3 text-right text-[9px] font-black text-slate-400 border-b border-slate-100 uppercase tracking-widest">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {getSortedData(users, "users").map(
                              (u: User, index: number) => (
                                <tr
                                  key={u._id}
                                  className="hover:bg-gradient-to-r hover:from-emerald-50/50 hover:to-green-50/50 transition-all duration-200 group/row"
                                >
                                  <td className="px-3 py-5 text-center">
                                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 text-emerald-700 text-xs font-bold shadow-sm">
                                      {(userPage - 1) * userPagination.limit +
                                        index +
                                        1}
                                    </span>
                                  </td>
                                  <td className="px-4 py-5">
                                    <div className="flex items-center">
                                      <div className="relative">
                                        <div className="flex-shrink-0 h-12 w-12 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-full flex items-center justify-center text-white text-base font-bold shadow-sm border-2 border-white ring-1 ring-gray-100">
                                          {u.firstName[0]}
                                          {u.lastName[0]}
                                        </div>
                                        <div
                                          className={`absolute bottom-0 right-0 h-3.5 w-3.5 border-2 border-white rounded-full shadow-sm ${u.isActive ? "bg-green-500" : "bg-gray-300"}`}
                                        ></div>
                                      </div>
                                      <div className="ml-3 min-w-0">
                                        <button
                                          onClick={async () => {
                                            try {
                                              const response =
                                                await userAPI.getById(u._id);
                                              if (response.success) {
                                                setSelectedUserForDetails(
                                                  response.data.user,
                                                );
                                                setShowUserDetailsDialog(true);
                                              }
                                            } catch (error: any) {
                                              toast.error(
                                                "Failed to load user details",
                                              );
                                            }
                                          }}
                                          className="text-sm font-bold text-slate-900 leading-snug hover:text-blue-600 hover:underline text-left whitespace-normal block w-full"
                                        >
                                          {u.firstName} {u.lastName}
                                        </button>
                                        <div className="mt-1 flex flex-col gap-1">
                                          {u.designation && (
                                            <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50/80 px-2 py-0.5 rounded-md border border-indigo-100/50 uppercase tracking-wider w-fit shadow-sm">
                                              {u.designation}
                                            </span>
                                          )}
                                          <span className="text-[8px] font-black bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 uppercase tracking-widest w-fit">
                                            ID: {u.userId}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-5">
                                    <div className="flex flex-col space-y-1.5">
                                      <div className="flex items-center text-sm text-blue-600 font-medium break-all">
                                        <Mail className="w-3.5 h-3.5 mr-2 text-blue-400 shrink-0" />
                                        {u.email}
                                      </div>
                                      {u.phone && (
                                        <div className="flex items-center text-xs text-gray-500">
                                          <Phone className="w-3.5 h-3.5 mr-2 text-gray-400" />
                                          {formatTo10Digits(u.phone)}
                                        </div>
                                      )}
                                  {isSuperAdmin && u.notificationSettings && (
                                    <div className="flex items-center gap-2 mt-2">
                                      <div 
                                        title={`Email Notifications: ${u.notificationSettings.email ? 'Enabled' : 'Disabled'}`}
                                        className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter border flex items-center gap-1 ${
                                          u.notificationSettings.email 
                                            ? 'bg-blue-50 text-blue-600 border-blue-100' 
                                            : 'bg-slate-50 text-slate-300 border-slate-100'
                                        }`}
                                      >
                                        <Mail className={`w-2.5 h-2.5 ${u.notificationSettings.email ? 'text-blue-500' : 'text-slate-300'}`} />
                                        Email
                                      </div>
                                      <div 
                                        title={`WhatsApp Notifications: ${u.notificationSettings.whatsapp ? 'Enabled' : 'Disabled'}`}
                                        className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter border flex items-center gap-1 ${
                                          u.notificationSettings.whatsapp 
                                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                                            : 'bg-slate-50 text-slate-300 border-slate-100'
                                        }`}
                                      >
                                        <TrendingUp className={`w-2.5 h-2.5 ${u.notificationSettings.whatsapp ? 'text-emerald-500' : 'text-slate-300'}`} />
                                        WhatsApp
                                      </div>
                                    </div>
                                  )}
                                </div>
                                  </td>
                                  <td className="px-4 py-5">
                                    <div className="flex flex-col space-y-2">
                                      <div className="flex">
                                        <span
                                          className={`px-2.5 py-0.5 inline-flex items-center text-[10px] font-bold rounded-full border shadow-sm ${
                                            u.role === "COMPANY_ADMIN"
                                              ? "bg-red-50 text-red-700 border-red-100 ring-1 ring-red-200"
                                              : typeof u.customRoleId ===
                                                    "object" && u.customRoleId
                                                ? "bg-indigo-50 text-indigo-700 border-indigo-100 ring-1 ring-indigo-200"
                                                : (u.role ===
                                                      "DEPARTMENT_ADMIN" &&
                                                      typeof u.departmentId ===
                                                        "object" &&
                                                      (u.departmentId as any)
                                                        ?.parentDepartmentId) ||
                                                    u.role ===
                                                      "SUB_DEPARTMENT_ADMIN"
                                                  ? "bg-purple-50 text-purple-700 border-purple-100 ring-1 ring-purple-200 shadow-purple-900/5"
                                                  : u.role ===
                                                      "DEPARTMENT_ADMIN"
                                                    ? "bg-blue-50 text-blue-700 border-blue-100 ring-1 ring-blue-200"
                                                    : u.role === "OPERATOR"
                                                      ? "bg-emerald-50 text-emerald-700 border-emerald-100 ring-1 ring-emerald-200"
                                                      : "bg-slate-50 text-slate-700 border-slate-200"
                                          }`}
                                        >
                                          <Shield className="w-2.5 h-2.5 mr-1" />
                                          {typeof u.customRoleId === "object" &&
                                          u.customRoleId
                                            ? (u.customRoleId as any).name
                                            : (u.role === "DEPARTMENT_ADMIN" &&
                                                  typeof u.departmentId ===
                                                    "object" &&
                                                  (u.departmentId as any)
                                                    ?.parentDepartmentId) ||
                                                u.role ===
                                                  "SUB_DEPARTMENT_ADMIN"
                                              ? "Sub Department Admin"
                                              : u.role === "SUPER_ADMIN"
                                                ? "Super Admin"
                                                : u.role === "COMPANY_ADMIN"
                                                  ? "Company Admin"
                                                  : u.role ===
                                                      "DEPARTMENT_ADMIN"
                                                    ? "Department Admin"
                                                    : u.role === "OPERATOR"
                                                      ? "Operator"
                                                      : u.role ===
                                                          "ANALYTICS_VIEWER"
                                                        ? "Analytics Viewer"
                                                        : (
                                                            u.role || ""
                                                          ).replace(/_/g, " ")}
                                        </span>
                                      </div>
                                      <div className="flex flex-col gap-1">
                                        <div className="flex items-start text-[11px] text-slate-600 font-bold group-hover/row:text-indigo-900 transition-colors whitespace-normal break-words">
                                          <Building className="w-3.5 h-3.5 mr-1.5 text-slate-400 group-hover/row:text-indigo-400 transition-colors shrink-0 mt-0.5" />
                                          {typeof u.departmentId === "object" &&
                                          u.departmentId
                                            ? u.departmentId.name
                                            : "All Company Access"}
                                        </div>
                                        {/* Show permissions summary for custom roles */}
                                        {typeof u.customRoleId === "object" &&
                                          u.customRoleId &&
                                          (u.customRoleId as any).permissions
                                            ?.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-0.5">
                                              {(
                                                u.customRoleId as any
                                              ).permissions
                                                .slice(0, 3)
                                                .map((p: any, i: number) => (
                                                  <span
                                                    key={i}
                                                    className="text-[8px] font-black text-indigo-400 bg-indigo-50/50 px-1 py-px rounded uppercase tracking-tighter border border-indigo-100/50"
                                                  >
                                                    {p.module?.replace(
                                                      /_/g,
                                                      " ",
                                                    )}
                                                  </span>
                                                ))}
                                              {(u.customRoleId as any)
                                                .permissions.length > 3 && (
                                                <span className="text-[8px] font-black text-slate-300">
                                                  +
                                                  {(u.customRoleId as any)
                                                    .permissions.length -
                                                    3}{" "}
                                                  more
                                                </span>
                                              )}
                                            </div>
                                          )}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-5">
                                    <div className="flex flex-col space-y-2.5">
                                      <div className="flex items-center">
                                        <div
                                          className={`h-2 w-2 rounded-full mr-2 ${u.isActive ? "bg-green-500 animate-pulse" : "bg-gray-300"}`}
                                        ></div>
                                        <span
                                          className={`text-xs font-bold ${u.isActive ? "text-green-700" : "text-gray-500"}`}
                                        >
                                          {u.isActive ? "Active" : "Inactive"}
                                        </span>
                                      </div>
                                      <div className="flex items-center">
                                        <button
                                          onClick={() =>
                                            handleToggleUserStatus(
                                              u._id,
                                              u.isActive,
                                            )
                                          }
                                          disabled={user && u._id === user.id}
                                          className={`relative inline-flex h-5 w-10 flex-shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                                            user && u._id === user.id
                                              ? "bg-gray-300 cursor-not-allowed opacity-50"
                                              : u.isActive
                                                ? "bg-green-500 cursor-pointer"
                                                : "bg-red-400 cursor-pointer"
                                          }`}
                                          title={
                                            user && u._id === user.id
                                              ? "You cannot deactivate yourself"
                                              : "Toggle user status"
                                          }
                                        >
                                          <span className="sr-only">
                                            Toggle user status
                                          </span>
                                          <span
                                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${u.isActive ? "translate-x-5" : "translate-x-1"}`}
                                          />
                                        </button>
                                        {/* Show only one action label - the current status */}
                                        <span
                                          className={`ml-2 text-[10px] font-bold uppercase tracking-wider ${
                                            u.isActive
                                              ? "text-green-600"
                                              : "text-gray-400"
                                          }`}
                                        >
                                          {u.isActive ? "Active" : "Inactive"}
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-5 whitespace-normal text-right">
                                    <div className="flex justify-end items-center gap-1.5">
                                      {hasPermission(
                                        user,
                                        Permission.UPDATE_USER,
                                      ) && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-8 w-8 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors flex-shrink-0"
                                          title="Edit User"
                                          onClick={() => {
                                            setEditingUser(u);
                                            setShowEditUserDialog(true);
                                          }}
                                        >
                                          <Edit2 className="w-4 h-4" />
                                        </Button>
                                      )}
                                      {hasPermission(
                                        user,
                                        Permission.UPDATE_USER,
                                      ) && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-8 w-8 p-0 text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors flex-shrink-0"
                                          title="Change Permissions"
                                          onClick={() => {
                                            setEditingUser(u);
                                            setShowChangePermissionsDialog(
                                              true,
                                            );
                                          }}
                                        >
                                          <Shield className="w-4 h-4" />
                                        </Button>
                                      )}
                                      {hasPermission(
                                        user,
                                        Permission.DELETE_USER,
                                      ) && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className={`h-8 w-8 p-0 transition-colors flex-shrink-0 ${
                                            user && u._id === user.id
                                              ? "text-slate-300 cursor-not-allowed"
                                              : "text-slate-400 hover:text-red-600 hover:bg-red-50"
                                          }`}
                                          title={
                                            user && u._id === user.id
                                              ? "You cannot delete yourself"
                                              : "Delete User"
                                          }
                                          disabled={user && u._id === user.id}
                                          onClick={() => {
                                            // Prevent self-deletion
                                            if (user && u._id === user.id) {
                                              toast.error(
                                                "You cannot delete yourself",
                                              );
                                              return;
                                            }

                                            setConfirmDialog({
                                              isOpen: true,
                                              title: "Delete User",
                                              message: `Are you sure you want to delete ${u.firstName} ${u.lastName}? This action cannot be undone.`,
                                              onConfirm: async () => {
                                                try {
                                                  const response =
                                                    await userAPI.delete(u._id);
                                                  if (response.success) {
                                                    toast.success(
                                                      "User deleted successfully",
                                                    );
                                                    setUsers((prev) =>
                                                      prev.filter(
                                                        (user) =>
                                                          user._id !== u._id,
                                                      ),
                                                    );
                                                    fetchUsers(userPage, true);
                                                    fetchDashboardData(true);
                                                  }
                                                } catch (error: any) {
                                                  const errorMessage =
                                                    error.response?.data
                                                      ?.message ||
                                                    error.message ||
                                                    "Failed to delete user";
                                                  toast.error(errorMessage);
                                                } finally {
                                                  setConfirmDialog((p) => ({
                                                    ...p,
                                                    isOpen: false,
                                                  }));
                                                }
                                              },
                                            } as any);
                                          }}
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                      </div>

                      <Pagination
                        currentPage={userPage}
                        totalPages={userPagination.pages}
                        totalItems={userPagination.total}
                        itemsPerPage={userPagination.limit}
                        onPageChange={setUserPage}
                        className="mt-6 shadow-none border-t border-slate-100 rounded-none bg-slate-50/30"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Grievances Tab */}
          {user &&
            (user.enabledModules?.includes(Module.GRIEVANCE) ||
              !user.companyId) && (
              <TabsContent value="grievances" className="space-y-6">
                {/* Back Button - Show when coming from overview (not for operators) */}
                {/* {previousTab === "overview" && hasPermission(user, Permission.VIEW_ANALYTICS) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setActiveTab(previousTab);
                      setGrievanceFilters((prev) => ({ ...prev, status: "" }));
                    }}
                    className="mb-4 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Overview
                  </Button>
                )} */}
                <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
                  <CardHeader className="bg-slate-900 px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                          <FileText className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                          <CardTitle className="text-base font-bold text-white">
                            {grievanceFilters.status === "REJECTED"
                                ? "Rejected Grievances"
                                : grievanceFilters.status === "CLOSED"
                                  ? "Closed Grievances"
                                  : grievanceFilters.status === "REVERTED"
                                    ? "Reverted Grievances"
                                    : "Active Grievances"}
                          </CardTitle>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                            {grievanceFilters.status === "REJECTED"
                                ? "View all rejected grievances"
                                : grievanceFilters.status === "CLOSED"
                                  ? "View all closed grievances"
                                  : grievanceFilters.status === "REVERTED"
                                    ? "Reverted by departments and pending reassignment"
                                    : "View and manage grievances"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  {/* Grievance Filters */}
                  <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-200">
                    {/* Search and Actions Bar */}
                    <div className="flex items-center justify-between gap-4 mb-3">
                      <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search by ID, name, phone, or category..."
                          value={grievanceSearch}
                          onChange={(e) => setGrievanceSearch(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm text-sm placeholder:text-slate-400"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRefreshData}
                          disabled={isRefreshing}
                          className="border-slate-200 hover:bg-slate-50 rounded-xl"
                          title="Refresh data"
                        >
                          <RefreshCw
                            className={`w-4 h-4 mr-1.5 ${isRefreshing ? "animate-spin" : ""}`}
                          />
                          Refresh
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            exportToCSV(
                              getSortedData(grievances, "grievances"),
                              "grievances",
                              [
                                { key: "grievanceId", label: "ID" },
                                { key: "citizenName", label: "Citizen Name" },
                                { key: "citizenPhone", label: "Phone" },
                                { key: "category", label: "Category" },
                                { key: "status", label: "Status" },
                                { key: "createdAt", label: "Created At" },
                              ],
                            )
                          }
                          className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-xl"
                          title="Export to CSV"
                        >
                          <FileDown className="w-4 h-4 mr-1.5" />
                          Export
                        </Button>
                      </div>
                    </div>

                    {/* Filters Row */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl shadow-sm border border-slate-200">
                        <Filter className="w-4 h-4 text-indigo-500" />
                        <span className="text-sm font-semibold text-slate-700">
                          Filters
                        </span>
                      </div>

                      {/* Status Filter */}
                      <select
                        value={grievanceFilters.status}
                        onChange={(e) =>
                          setGrievanceFilters((prev) => ({
                            ...prev,
                            status: e.target.value,
                          }))
                        }
                        className="text-xs px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm hover:border-indigo-300 transition-colors cursor-pointer"
                        title="Filter by grievance status"
                      >
                        <option value="">📋 All Status</option>
                        <option value="PENDING">🔸 Pending</option>
                        <option value="ASSIGNED">👤 Assigned</option>
                        <option value="RESOLVED">✅ Resolved</option>
                        <option value="REJECTED">❌ Rejected</option>
                        {isCompanyLevel && (
                          <>
                            <option value="CLOSED">🔒 Closed</option>
                            <option value="REVERTED">↩️ Reverted</option>
                          </>
                        )}
                      </select>

                      {isCompanyLevel && (
                        <>
                          {/* Main Department Filter */}
                          <select
                            value={grievanceFilters.mainDeptId}
                            onChange={(e) =>
                              setGrievanceFilters((prev) => ({
                                ...prev,
                                mainDeptId: e.target.value,
                                subDeptId: "",
                                department: "", // reset old filter
                              }))
                            }
                            className="text-xs px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm hover:border-indigo-300 transition-colors cursor-pointer min-w-[150px]"
                            title="Filter by main department"
                          >
                            <option value="">🏢 Main Dept</option>
                            {departments.filter(d => !d.parentDepartmentId).map((dept) => (
                              <option key={dept._id} value={dept._id}>
                                {dept.name}
                              </option>
                            ))}
                          </select>

                          {/* Sub Department Filter */}
                          <select
                            value={grievanceFilters.subDeptId}
                            onChange={(e) =>
                              setGrievanceFilters((prev) => ({
                                ...prev,
                                subDeptId: e.target.value,
                              }))
                            }
                            className="text-xs px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm hover:border-indigo-300 transition-colors cursor-pointer min-w-[150px]"
                            title="Filter by sub department"
                            disabled={!grievanceFilters.mainDeptId}
                          >
                            <option value="">🏢 Sub Dept</option>
                            {grievanceFilters.mainDeptId && departments.filter(d => getParentDepartmentId(d) === grievanceFilters.mainDeptId).map((dept) => (
                              <option key={dept._id} value={dept._id}>
                                {dept.name}
                              </option>
                            ))}
                          </select>
                        </>
                      )}

                      {/* Assignment Status Filter */}
                      <select
                        value={grievanceFilters.assignmentStatus}
                        onChange={(e) =>
                          setGrievanceFilters((prev) => ({
                            ...prev,
                            assignmentStatus: e.target.value,
                          }))
                        }
                        className="text-xs px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm hover:border-indigo-300 transition-colors cursor-pointer"
                        title="Filter by assignment status"
                      >
                        <option value="">👥 All Assignments</option>
                        <option value="assigned">✓ Assigned</option>
                        <option value="unassigned">○ Unassigned</option>
                      </select>

                      {/* Overdue Status Filter */}
                      <select
                        value={grievanceFilters.overdueStatus}
                        onChange={(e) =>
                          setGrievanceFilters((prev) => ({
                            ...prev,
                            overdueStatus: e.target.value,
                          }))
                        }
                        className="text-xs px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm hover:border-indigo-300 transition-colors cursor-pointer"
                        title="Filter by overdue status"
                      >
                        <option value="">⏱️ All Overdue Status</option>
                        <option value="overdue">🔴 Overdue</option>
                        <option value="ontrack">🟢 On Track</option>
                      </select>

                      {/* Date Range Filter */}
                      <select
                        value={grievanceFilters.dateRange}
                        onChange={(e) =>
                          setGrievanceFilters((prev) => ({
                            ...prev,
                            dateRange: e.target.value,
                          }))
                        }
                        className="text-xs px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm hover:border-indigo-300 transition-colors cursor-pointer"
                        title="Filter by date range"
                      >
                        <option value="">📅 All Time</option>
                        <option value="today">Today</option>
                        <option value="week">Last 7 Days</option>
                        <option value="month">Last 30 Days</option>
                      </select>

                      {/* Clear Filters */}
                      {(grievanceFilters.status ||
                        grievanceFilters.department ||
                        grievanceFilters.mainDeptId ||
                        grievanceFilters.subDeptId ||
                        grievanceFilters.assignmentStatus ||
                        grievanceFilters.overdueStatus ||
                        grievanceFilters.dateRange) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setGrievanceFilters({
                              status: "",
                              department: "",
                              mainDeptId: "",
                              subDeptId: "",
                              assignmentStatus: "",
                              overdueStatus: "",
                              dateRange: "",
                            })
                          }
                          className="text-xs h-8 px-3 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl border border-red-200"
                          title="Clear all filters"
                        >
                          <X className="w-3 h-3 mr-1" />
                          Clear
                        </Button>
                      )}

                      {/* Results count */}
                      <span className="text-xs text-slate-500 ml-auto bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-200">
                        Showing{" "}
                        <span className="font-semibold text-indigo-600">
                          {getSortedData(grievances, "grievances").length}
                        </span>{" "}
                        of {grievances.length} grievances
                      </span>

                      {/* Bulk Delete Button (Super Admin only) */}
                      {user?.role === "SUPER_ADMIN" &&
                        selectedGrievances.size > 0 && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleBulkDeleteGrievances}
                            disabled={isDeleting}
                            className="text-xs h-8 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl border border-red-700 shadow-sm"
                            title={`Delete ${selectedGrievances.size} selected grievance(s)`}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                            Delete ({selectedGrievances.size})
                          </Button>
                        )}
                    </div>
                  </div>

                  <CardContent className="p-0">
                    {loadingGrievances ? (
                      <TableSkeleton rows={8} cols={6} />
                    ) : grievances.length === 0 ? (
                      <div className="text-center py-16 bg-gradient-to-b from-slate-50 to-white rounded-2xl border border-slate-200">
                        <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                          <svg
                            className="w-8 h-8 text-indigo-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                        </div>
                        <p className="text-slate-600 font-medium">
                          No grievances found
                        </p>
                        <p className="text-slate-400 text-sm mt-1">
                          New grievances will appear here
                        </p>
                      </div>
                    ) : (
                      <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-lg bg-white">
                        <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                          <table className="w-full relative border-collapse">
                            <thead className="sticky top-0 z-20 bg-[#fcfdfe] border-b border-slate-200">
                              <tr className="whitespace-nowrap">
                                {user?.role === "SUPER_ADMIN" && (
                                  <th className="px-3 py-4 text-center">
                                    <input
                                      type="checkbox"
                                      checked={
                                        selectedGrievances.size > 0 &&
                                        selectedGrievances.size ===
                                          getSortedData(
                                            grievances,
                                            "grievances",
                                          ).length
                                      }
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedGrievances(
                                            new Set(
                                              getSortedData(
                                                grievances,
                                                "grievances",
                                              ).map((g) => g._id),
                                            ),
                                          );
                                        } else {
                                          setSelectedGrievances(new Set());
                                        }
                                      }}
                                      className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                                      title="Select All"
                                    />
                                  </th>
                                )}
                                <th className="px-3 py-3 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                  Sr.
                                </th>
                                <th className="px-4 py-3 text-left">
                                  <button
                                    onClick={() =>
                                      handleSort("grievanceId", "grievances")
                                    }
                                    className="group flex items-center space-x-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                                  >
                                    <span>Grievance No</span>
                                    <ArrowUpDown
                                      className={`w-3 h-3 transition-colors ${sortConfig.key === "grievanceId" ? "text-indigo-500" : "text-slate-300 group-hover:text-slate-400"}`}
                                    />
                                  </button>
                                </th>
                                <th className="px-4 py-3 text-left">
                                  <button
                                    onClick={() =>
                                      handleSort("citizenName", "grievances")
                                    }
                                    className="group flex items-center space-x-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                                  >
                                    <span>Citizen</span>
                                    <ArrowUpDown
                                      className={`w-3 h-3 transition-colors ${sortConfig.key === "citizenName" ? "text-indigo-500" : "text-slate-300 group-hover:text-slate-400"}`}
                                    />
                                  </button>
                                </th>
                                <th className="px-4 py-3 text-left">
                                  <button
                                    onClick={() =>
                                      handleSort("category", "grievances")
                                    }
                                    className="group flex items-center space-x-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                                  >
                                    <span>Dept &amp; Category</span>
                                    <ArrowUpDown
                                      className={`w-3 h-3 transition-colors ${sortConfig.key === "category" ? "text-indigo-500" : "text-slate-300 group-hover:text-slate-400"}`}
                                    />
                                  </button>
                                </th>
                                <th className="px-4 py-3 text-left">
                                  <button
                                    onClick={() =>
                                      handleSort("assignedTo", "grievances")
                                    }
                                    className="group flex items-center space-x-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                                  >
                                    <span>Assigned Official</span>
                                    <ArrowUpDown
                                      className={`w-3 h-3 transition-colors ${sortConfig.key === "assignedTo" ? "text-indigo-500" : "text-slate-300 group-hover:text-slate-400"}`}
                                    />
                                  </button>
                                </th>
                                <th className="px-4 py-3 text-left">
                                  <button
                                    onClick={() =>
                                      handleSort("status", "grievances")
                                    }
                                    className="group flex items-center space-x-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                                  >
                                    <span>Status</span>
                                    <ArrowUpDown
                                      className={`w-3 h-3 transition-colors ${sortConfig.key === "status" ? "text-indigo-500" : "text-slate-300 group-hover:text-slate-400"}`}
                                    />
                                  </button>
                                </th>
                                <th className="px-4 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                  SLA Status
                                </th>
                                <th className="px-4 py-3 text-left">
                                  <button
                                    onClick={() =>
                                      handleSort("createdAt", "grievances")
                                    }
                                    className="group flex items-center space-x-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                                  >
                                    <span>Raised On</span>
                                    <ArrowUpDown
                                      className={`w-3 h-3 transition-colors ${sortConfig.key === "createdAt" ? "text-indigo-500" : "text-slate-300 group-hover:text-slate-400"}`}
                                    />
                                  </button>
                                </th>
                                <th className="px-4 py-3 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                  Actions
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {getSortedData(grievances, "grievances").map(
                                (grievance, index) => (
                                  <tr
                                    key={grievance._id}
                                    className="hover:bg-gradient-to-r hover:from-indigo-50/50 hover:to-purple-50/50 transition-all duration-200 group/row"
                                  >
                                    {user?.role === "SUPER_ADMIN" && (
                                      <td className="px-3 py-4 text-center">
                                        <input
                                          type="checkbox"
                                          checked={selectedGrievances.has(
                                            grievance._id,
                                          )}
                                          onChange={(e) => {
                                            const newSelected = new Set(
                                              selectedGrievances,
                                            );
                                            if (e.target.checked) {
                                              newSelected.add(grievance._id);
                                            } else {
                                              newSelected.delete(grievance._id);
                                            }
                                            setSelectedGrievances(newSelected);
                                          }}
                                          className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                                        />
                                      </td>
                                    )}
                                    <td className="px-3 py-4 text-center">
                                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
                                        {(grievancePage - 1) *
                                          grievancePagination.limit +
                                          index +
                                          1}
                                      </span>
                                    </td>
                                    <td className="px-4 py-4">
                                      <button
                                        onClick={() => openGrievanceDetail(grievance._id)}
                                        className="font-bold text-sm text-blue-700 hover:text-blue-800 hover:underline"
                                      >
                                        {grievance.grievanceId}
                                      </button>
                                    </td>
                                    <td className="px-4 py-4">
                                      <div className="flex flex-col">
                                        <button
                                          onClick={() => openGrievanceDetail(grievance._id)}
                                          className="text-gray-900 font-bold text-sm text-left hover:text-blue-600 hover:underline"
                                        >
                                          {grievance.citizenName}
                                        </button>
                                        <div className="flex items-center text-xs text-gray-500 font-medium">
                                          <Phone className="w-3 h-3 mr-1.5" />
                                          {formatTo10Digits(grievance.citizenPhone)}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-4">
                                      <div className="flex flex-col">
                                        <span className="text-xs font-semibold text-gray-700">
                                          {typeof grievance.departmentId ===
                                            "object" && grievance.departmentId
                                            ? grievance.subDepartmentId &&
                                              typeof grievance.subDepartmentId ===
                                                "object"
                                              ? `${(grievance.departmentId as any).name} - ${(grievance.subDepartmentId as any).name}`
                                              : (grievance.departmentId as any)
                                                  .name
                                            : "General"}
                                        </span>
                                        <span className="text-[10px] text-orange-400 uppercase">
                                          {grievance.category}
                                        </span>
                                      </div>
                                    </td>
                                    {/* Assigned With Column */}
                                    <td className="px-4 py-4">
                                      <div className="flex flex-col">
                                        {grievance.assignedTo ? (
                                          <>
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                              <span className="text-xs font-semibold text-indigo-700">
                                                {typeof grievance.assignedTo === "object" && grievance.assignedTo !== null
                                                  ? `${(grievance.assignedTo as any).firstName} ${(grievance.assignedTo as any).lastName}`
                                                  : // Fallback: try to find in users list if it's just an ID
                                                    users.find(u => u._id === grievance.assignedTo || u.userId === grievance.assignedTo)?.firstName 
                                                    ? (() => {
                                                        const found = users.find(u => u._id === grievance.assignedTo || u.userId === grievance.assignedTo);
                                                        return `${found?.firstName} ${found?.lastName}`;
                                                      })()
                                                    : grievance.assignedTo}
                                              </span>
                                              {typeof grievance.assignedTo === "object" && (grievance.assignedTo as any).designation && (
                                                <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full font-medium">
                                                  {(grievance.assignedTo as any).designation}
                                                </span>
                                              )}
                                            </div>
                                            {grievance.assignedAt && (
                                              <span className="text-[10px] text-slate-400 font-medium">
                                                Assigned: {new Date(grievance.assignedAt).toLocaleDateString()}
                                              </span>
                                            )}
                                          </>
                                        ) : (
                                          <div className="flex items-center gap-1.5 text-slate-400 italic">
                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                            <span className="text-[11px]">Unassigned</span>
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-4">
                                      <button
                                        onClick={() => {
                                          setSelectedGrievanceForStatus(
                                            grievance,
                                          );
                                          setShowGrievanceStatusModal(true);
                                        }}
                                        disabled={
                                          grievance.status === "RESOLVED" ||
                                          grievance.status === "CLOSED" ||
                                          grievance.status === "REJECTED" ||
                                          updatingGrievanceStatus.has(
                                            grievance._id,
                                          )
                                        }
                                        className={`px-3 py-1.5 text-[10px] font-bold border border-gray-200 rounded bg-white hover:border-purple-400 hover:bg-purple-50 focus:outline-none focus:ring-1 focus:ring-purple-500 uppercase tracking-tight transition-all ${
                                          updatingGrievanceStatus.has(
                                            grievance._id,
                                          )
                                            ? "opacity-50 cursor-wait"
                                            : ""
                                        } ${
                                          grievance.status === "RESOLVED" ||
                                          grievance.status === "CLOSED" ||
                                          grievance.status === "REJECTED"
                                            ? "opacity-60 cursor-not-allowed"
                                            : ""
                                        }`}
                                      >
                                        {grievance.status}
                                      </button>
                                    </td>
                                    {/* Overdue Status Column */}
                                    <td className="px-4 py-4">
                                      {(() => {
                                        // Calculate overdue status based on SLA
                                        const createdDate = new Date(
                                          grievance.createdAt,
                                        );
                                        const now = new Date();
                                        const hoursDiff = Math.floor(
                                          (now.getTime() -
                                            createdDate.getTime()) /
                                            (1000 * 60 * 60),
                                        );

                                        // SLA: PENDING should be assigned within 24h, ASSIGNED should be resolved within 120h (5 days)
                                        let isOverdue = false;
                                        let slaHours = 0;

                                        if (grievance.status === "PENDING") {
                                          slaHours = 24;
                                          isOverdue = hoursDiff > slaHours;
                                        } else if (
                                          grievance.status === "ASSIGNED"
                                        ) {
                                          slaHours = 120;
                                          const assignedDate =
                                            grievance.assignedAt
                                              ? new Date(grievance.assignedAt)
                                              : createdDate;
                                          const hoursFromAssigned = Math.floor(
                                            (now.getTime() -
                                              assignedDate.getTime()) /
                                              (1000 * 60 * 60),
                                          );
                                          isOverdue =
                                            hoursFromAssigned > slaHours;
                                        }

                                        if (grievance.status === "RESOLVED") {
                                          return (
                                            <span className="px-2 py-1 text-[10px] font-bold bg-green-100 text-green-700 rounded">
                                              COMPLETED
                                            </span>
                                          );
                                        }

                                        return isOverdue ? (
                                          <span className="px-2 py-1 text-[10px] font-bold bg-red-100 text-red-700 rounded animate-pulse">
                                            OVERDUE
                                          </span>
                                        ) : (
                                          <span className="px-2 py-1 text-[10px] font-bold bg-green-100 text-green-700 rounded">
                                            ON TRACK
                                          </span>
                                        );
                                      })()}
                                    </td>
                                    <td className="px-4 py-4 text-xs text-gray-600">
                                      <div className="flex flex-col">
                                        <span className="font-medium">
                                          {new Date(
                                            grievance.createdAt,
                                          ).toLocaleDateString()}
                                        </span>
                                        <span className="text-[10px] text-gray-400">
                                          {new Date(
                                            grievance.createdAt,
                                          ).toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          })}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-4">
                                      <div className="flex items-center justify-center space-x-1">
                                        {hasPermission(user, Permission.ASSIGN_GRIEVANCE) &&
                                          (isCompanyLevel ||
                                            (grievance.status !== "RESOLVED" &&
                                              grievance.status !== "CLOSED" &&
                                              grievance.status !== "REJECTED")) && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => {
                                                setSelectedGrievanceForAssignment(
                                                  grievance,
                                                );
                                                setShowGrievanceAssignment(
                                                  true,
                                                );
                                              }}
                                              title="Assign/Reassign Official"
                                              className="h-8 w-8 p-0 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
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
                                                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                                />
                                              </svg>
                                            </Button>
                                          )}
                                        {isDepartmentLevel &&
                                          grievance.status !== "RESOLVED" &&
                                          grievance.status !== "REJECTED" &&
                                          grievance.status !== "CLOSED" && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => {
                                                setSelectedGrievanceForRevert(grievance);
                                                setShowGrievanceRevertDialog(true);
                                              }}
                                              title="Revert to Company Admin"
                                              className="h-8 w-8 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                            >
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a4 4 0 014 4v1m0 0l-3-3m3 3l3-3M7 14H3m0 0l3 3m-3-3l3-3" />
                                              </svg>
                                            </Button>
                                          )}
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => openGrievanceDetail(grievance._id)}
                                          title="View"
                                          className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
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
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                ),
                              )}
                            </tbody>
                          </table>
                        </div>

                        <Pagination
                          currentPage={grievancePage}
                          totalPages={grievancePagination.pages}
                          totalItems={grievancePagination.total}
                          itemsPerPage={grievancePagination.limit}
                          onPageChange={setGrievancePage}
                          className="mt-6 shadow-none border-t border-slate-100 rounded-none bg-slate-50/30"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}




          {/* Reverted Grievances Tab - for Company Admin */}
          {isCompanyLevel && hasPermission(user, Permission.READ_GRIEVANCE) && (
            <TabsContent value="reverted" className="space-y-6">
              <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
                <CardHeader className="bg-slate-900 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-rose-500/20 rounded-xl flex items-center justify-center border border-rose-500/30">
                        <Undo2 className="w-5 h-5 text-rose-400" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-bold text-white">
                          Reverted Grievances
                        </CardTitle>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                          Grievances requiring reassignment after being reverted
                        </p>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-200">
                  {/* Search and Quick Filters */}
                  <div className="flex items-center justify-between gap-4 mb-3">
                    <div className="relative flex-1 max-w-md">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search reverted grievances..."
                        value={grievanceSearch}
                        onChange={(e) => setGrievanceSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-white shadow-sm text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefreshData}
                        className="border-slate-200 hover:bg-slate-50 rounded-xl"
                      >
                        <RefreshCw className={`w-4 h-4 mr-1.5 ${isRefreshing ? "animate-spin" : ""}`} />
                        Refresh
                      </Button>
                    </div>
                  </div>

                  {/* Filter Dropdowns */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                      <Filter className="w-3.5 h-3.5 text-rose-500" />
                      <span className="text-xs font-bold text-slate-600">Filters</span>
                    </div>

                    <select
                      value={grievanceFilters.mainDeptId}
                      onChange={(e) => setGrievanceFilters(prev => ({ ...prev, mainDeptId: e.target.value, subDeptId: "" }))}
                      className="text-xs px-4 py-2 border border-slate-200 rounded-xl bg-white shadow-sm hover:border-rose-300 transition-colors cursor-pointer min-w-[170px]"
                    >
                      <option value="">🏢 Origin Department</option>
                      {departments.filter(d => !d.parentDepartmentId).map(d => (
                        <option key={d._id} value={d._id}>{d.name}</option>
                      ))}
                    </select>

                    <select
                      value={grievanceFilters.dateRange}
                      onChange={(e) => setGrievanceFilters(prev => ({ ...prev, dateRange: e.target.value }))}
                      className="text-xs px-4 py-2 border border-slate-200 rounded-xl bg-white shadow-sm hover:border-rose-300 transition-colors cursor-pointer"
                    >
                      <option value="">📅 All Dates</option>
                      <option value="today">Today</option>
                      <option value="week">Last 7 Days</option>
                      <option value="month">Last 30 Days</option>
                    </select>

                    {(grievanceSearch || grievanceFilters.mainDeptId || grievanceFilters.dateRange) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setGrievanceSearch("");
                          setGrievanceFilters(prev => ({ ...prev, mainDeptId: "", subDeptId: "", dateRange: "" }));
                        }}
                        className="text-xs h-8 px-3 text-red-600 hover:bg-red-50 rounded-xl border border-red-100"
                      >
                        <X className="w-3 h-3 mr-1" /> Clear
                      </Button>
                    )}

                    <div className="ml-auto text-xs font-black text-slate-400 uppercase tracking-widest bg-slate-100/50 px-3 py-1.5 rounded-lg">
                      Showing: <span className="text-slate-900">{getSortedData(grievances, "reverted").length} reverted cases</span>
                    </div>
                  </div>
                </div>

                <div className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/30">
                          <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-12">#</th>
                          <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Grievance Id</th>
                          <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking_widest">Citizen Details</th>
                          <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Description & Remarks</th>
                          <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Dept & Category</th>
                          <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking_widest">Status</th>
                          <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Reassign</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getSortedData(grievances, "reverted").length > 0 ? (
                          getSortedData(grievances, "reverted").map((grievance, index) => {
                            const latestRevertRemark = grievance.statusHistory
                                ?.filter((h: any) => h.status === 'REVERTED')
                                .sort((a: any, b: any) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())[0]?.remarks;

                            return (
                              <tr key={grievance._id} className="border-b border-slate-50 hover:bg-slate-50/80 transition-all group">
                                <td className="px-4 py-5 text-center">
                                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-700 text-[10px] font-black group-hover:bg-rose-100 group-hover:text-rose-700 transition-colors shadow-sm">
                                    {index + 1}
                                  </span>
                                </td>
                                <td className="px-4 py-5 font-bold text-sm">
                                  <button
                                    onClick={() => openGrievanceDetail(grievance._id)}
                                    className="text-blue-700 hover:text-blue-900 flex items-center gap-1.5 group/id"
                                  >
                                    {grievance.grievanceId}
                                    <ExternalLink className="w-3 h-3 opacity-0 group-hover/id:opacity-100 transition-opacity" />
                                  </button>
                                  <div className="text-[10px] text-slate-400 font-medium mt-1">
                                    {new Date(grievance.createdAt).toLocaleDateString()}
                                  </div>
                                </td>
                                <td className="px-4 py-5">
                                  <div className="flex flex-col">
                                    <button
                                      onClick={() => openGrievanceDetail(grievance._id)}
                                      className="text-slate-900 font-bold text-sm text-left hover:text-indigo-600 transition-colors"
                                    >
                                      {grievance.citizenName}
                                    </button>
                                    <div className="flex items-center text-[11px] text-slate-500 font-medium mt-0.5">
                                      <Phone className="w-3 h-3 mr-1.5 text-slate-400" />
                                      {formatTo10Digits(grievance.citizenPhone)}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-5 max-w-[250px]">
                                  <div className="flex flex-col gap-1.5">
                                    <div className="text-xs text-slate-600 line-clamp-1 italic" title={grievance.description}>
                                      &quot;{grievance.description}&quot;
                                    </div>
                                    {latestRevertRemark && (
                                      <div className="bg-rose-50 border border-rose-100 rounded-lg p-2">
                                        <p className="text-[10px] font-black text-rose-500 uppercase tracking-tighter mb-0.5 flex items-center gap-1">
                                          <Undo2 className="w-2.5 h-2.5" /> Revert Remark
                                        </p>
                                        <p className="text-[11px] text-rose-700 font-bold leading-tight">
                                          {latestRevertRemark}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-5">
                                  <div className="flex flex-col gap-1">
                                    <div className="flex flex-col">
                                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mb-0.5">Original Dept</span>
                                      <span className="text-xs font-semibold text-slate-700">
                                        {grievance.departmentId && typeof grievance.departmentId === "object" ? (grievance.departmentId as any).name : "General"}
                                      </span>
                                    </div>
                                    
                                    {(() => {
                                      const revertEntry = grievance.timeline
                                        ?.filter((t: any) => t.action === "REVERTED_TO_COMPANY_ADMIN")
                                        .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
                                      
                                      const suggestedDeptId = revertEntry?.details?.suggestedDepartmentId;
                                      const suggestedSubDeptId = revertEntry?.details?.suggestedSubDepartmentId;
                                      
                                      if (suggestedDeptId || suggestedSubDeptId) {
                                        const suggestedDept = departments.find(d => d._id === (suggestedSubDeptId || suggestedDeptId));
                                        return (
                                          <div className="mt-2 group/suggested">
                                            <div className="flex items-center gap-1 text-[9px] text-rose-500 font-black uppercase tracking-widest mb-1 opacity-70">
                                              <ArrowRightCircle className="w-2.5 h-2.5" /> Proposed Destination
                                            </div>
                                            <div className="flex items-center gap-2 bg-rose-50/50 border border-rose-100 rounded-lg p-2 transition-all group-hover/suggested:bg-rose-50">
                                              <div className="w-6 h-6 bg-rose-100 rounded-md flex items-center justify-center text-rose-600">
                                                <Building2 className="w-3.5 h-3.5" />
                                              </div>
                                              <div className="flex flex-col">
                                                <span className="text-xs font-bold text-slate-900 leading-none">
                                                  {suggestedDept?.name || "Target Department"}
                                                </span>
                                                <span className="text-[9px] font-bold text-rose-500 uppercase mt-0.5 tracking-tighter">
                                                  Recommended by Admin
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      }
                                      return null;
                                    })()}
                                    
                                    <span className="text-[10px] text-orange-500 font-bold uppercase tracking-tight mt-1">
                                      {grievance.category}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-5">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-rose-50 text-rose-600 border border-rose-100 uppercase tracking-wider">
                                    REVERTED
                                  </span>
                                </td>
                                <td className="px-4 py-5">
                                  <div className="flex justify-center gap-1.5">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedGrievanceForAssignment(grievance);
                                        setShowGrievanceAssignment(true);
                                      }}
                                      className="h-8 w-8 p-0 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg shadow-none border-0 transition-all"
                                      title="Assign to New Official"
                                    >
                                      <UserPlus className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openGrievanceDetail(grievance._id)}
                                      className="h-8 w-8 p-0 text-slate-400 hover:bg-slate-50 hover:text-slate-900 rounded-lg shadow-none border-0 transition-all"
                                      title="View Case Details"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={7} className="px-4 py-24 text-center">
                              <div className="flex flex-col items-center justify-center">
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                                  <Inbox className="w-8 h-8 text-slate-200" />
                                </div>
                                <h3 className="text-slate-900 font-bold">No Reverted Items</h3>
                                <p className="text-slate-400 text-xs mt-1 max-w-[200px] mx-auto leading-relaxed">
                                  All reverted grievances have been addressed or none exist currently.
                                </p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Card>
            </TabsContent>
          )}

          {/* Appointments Tab - show if module active or SuperAdmin */}
          {user &&
            (user.enabledModules?.includes(Module.APPOINTMENT) ||
              !user.companyId) &&
            (isCompanyLevel || isDepartmentLevel) && (
              <TabsContent value="appointments" className="space-y-6">
                <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
                  <CardHeader className="bg-slate-900 px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                          <Calendar className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                          <CardTitle className="text-base font-bold text-white">
                            Appointments
                          </CardTitle>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                            View and manage all scheduled appointments
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">

                        {(isCompanyLevel || isDepartmentLevel) && (
                          <Button
                            onClick={() => setShowAvailabilityCalendar(true)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white border-0 h-8 text-[10px] font-bold uppercase tracking-widest rounded-lg px-4 shadow-md"
                            title="Configure when appointments can be scheduled"
                          >
                            <CalendarClock className="w-3.5 h-3.5 mr-1.5" />
                            Availability
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  {/* Appointment Filters */}
                  <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-purple-50/30 border-b border-slate-200">
                    {/* Search and Actions Bar */}
                    <div className="flex items-center justify-between gap-4 mb-3">
                      <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search by ID, name, phone, or purpose..."
                          value={appointmentSearch}
                          onChange={(e) => setAppointmentSearch(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white shadow-sm text-sm placeholder:text-slate-400"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRefreshData}
                          disabled={isRefreshing}
                          className="border-slate-200 hover:bg-slate-50 rounded-xl"
                          title="Refresh data"
                        >
                          <RefreshCw
                            className={`w-4 h-4 mr-1.5 ${isRefreshing ? "animate-spin" : ""}`}
                          />
                          Refresh
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            exportToCSV(
                              getSortedData(appointments, "appointments"),
                              "appointments",
                              [
                                { key: "appointmentId", label: "ID" },
                                { key: "citizenName", label: "Citizen Name" },
                                { key: "citizenPhone", label: "Phone" },
                                { key: "purpose", label: "Purpose" },
                                { key: "appointmentDate", label: "Date" },
                                { key: "appointmentTime", label: "Time" },
                                { key: "status", label: "Status" },
                              ],
                            )
                          }
                          className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-xl"
                          title="Export to CSV"
                        >
                          <FileDown className="w-4 h-4 mr-1.5" />
                          Export
                        </Button>
                      </div>
                    </div>

                    {/* Filters Row */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl shadow-sm border border-slate-200">
                        <Filter className="w-4 h-4 text-purple-500" />
                        <span className="text-sm font-semibold text-slate-700">
                          Filters
                        </span>
                      </div>

                      {/* Status Filter */}
                      <select
                        value={appointmentFilters.status}
                        onChange={(e) =>
                          setAppointmentFilters((prev) => ({
                            ...prev,
                            status: e.target.value,
                          }))
                        }
                        className="text-xs px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white shadow-sm hover:border-purple-300 transition-colors cursor-pointer"
                        title="Filter by appointment status"
                      >
                        <option value="">📋 All Status</option>
                        <option value="SCHEDULED">📅 Scheduled</option>
                        <option value="CONFIRMED">✅ Confirmed</option>
                        <option value="COMPLETED">✅ Completed</option>
                        <option value="CANCELLED">❌ Cancelled</option>
                      </select>

                      {/* Department Filter - Removed (Appointments are CEO-only, no departments) */}
                      {/* Assignment Status Filter - Removed (Appointments are CEO-only, no assignment needed) */}

                      {/* Date Filter */}
                      <select
                        value={appointmentFilters.dateFilter}
                        onChange={(e) =>
                          setAppointmentFilters((prev) => ({
                            ...prev,
                            dateFilter: e.target.value,
                          }))
                        }
                        className="text-xs px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white shadow-sm hover:border-purple-300 transition-colors cursor-pointer"
                        title="Filter by date"
                      >
                        <option value="">📅 All Time</option>
                        <option value="today">Today</option>
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                        <option value="upcoming">Upcoming</option>
                      </select>

                      {/* Clear Filters */}
                      {(appointmentFilters.status ||
                        appointmentFilters.dateFilter) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setAppointmentFilters({
                              status: "",
                              department: "",
                              assignmentStatus: "",
                              dateFilter: "",
                            })
                          }
                          className="text-xs h-8 px-3 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl border border-red-200"
                          title="Clear all filters"
                        >
                          <X className="w-3 h-3 mr-1" />
                          Clear
                        </Button>
                      )}

                      {/* Results count */}
                      <span className="text-xs text-slate-500 ml-auto bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-200">
                        Showing{" "}
                        <span className="font-semibold text-purple-600">
                          {getSortedData(appointments, "appointments").length}
                        </span>{" "}
                        of {appointments.length} appointments
                      </span>

                      {/* Bulk Delete Button (Super Admin only) */}
                      {user?.role === "SUPER_ADMIN" &&
                        selectedAppointments.size > 0 && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleBulkDeleteAppointments}
                            disabled={isDeleting}
                            className="text-xs h-8 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl border border-red-700 shadow-sm"
                            title={`Delete ${selectedAppointments.size} selected appointment(s)`}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                            Delete ({selectedAppointments.size})
                          </Button>
                        )}
                    </div>
                  </div>

                  <CardContent className="p-0">
                    {loadingAppointments ? (
                      <TableSkeleton rows={8} cols={6} />
                    ) : appointments.length === 0 ? (
                      <div className="text-center py-16 bg-gradient-to-b from-slate-50 to-white rounded-2xl border border-slate-200">
                        <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                          <svg
                            className="w-8 h-8 text-purple-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                        </div>
                        <p className="text-slate-600 font-medium">
                          No appointments found
                        </p>
                        <p className="text-slate-400 text-sm mt-1">
                          New appointments will appear here
                        </p>
                      </div>
                    ) : (
                      <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-lg bg-white">
                        <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                          <table className="w-full relative border-collapse">
                            <thead className="sticky top-0 z-20 bg-[#fcfdfe] border-b border-slate-200">
                              <tr className="whitespace-nowrap">
                                {user?.role === "SUPER_ADMIN" && (
                                  <th className="px-3 py-4 text-center">
                                    <input
                                      type="checkbox"
                                      checked={
                                        selectedAppointments.size > 0 &&
                                        selectedAppointments.size ===
                                          getSortedData(
                                            appointments,
                                            "appointments",
                                          ).length
                                      }
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedAppointments(
                                            new Set(
                                              getSortedData(
                                                appointments,
                                                "appointments",
                                              ).map((a) => a._id),
                                            ),
                                          );
                                        } else {
                                          setSelectedAppointments(new Set());
                                        }
                                      }}
                                      className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                                      title="Select All"
                                    />
                                  </th>
                                )}
                                <th className="px-3 py-3 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                  Sr.
                                </th>
                                <th className="px-4 py-3 text-left">
                                  <button
                                    onClick={() =>
                                      handleSort(
                                        "appointmentId",
                                        "appointments",
                                      )
                                    }
                                    className="group flex items-center space-x-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                                  >
                                    <span>App ID</span>
                                    <ArrowUpDown
                                      className={`w-3 h-3 transition-colors ${sortConfig.key === "appointmentId" ? "text-indigo-500" : "text-slate-300 group-hover:text-slate-400"}`}
                                    />
                                  </button>
                                </th>
                                <th className="px-4 py-3 text-left">
                                  <button
                                    onClick={() =>
                                      handleSort("citizenName", "appointments")
                                    }
                                    className="group flex items-center space-x-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                                  >
                                    <span>Citizen</span>
                                    <ArrowUpDown
                                      className={`w-3 h-3 transition-colors ${sortConfig.key === "citizenName" ? "text-indigo-500" : "text-slate-300 group-hover:text-slate-400"}`}
                                    />
                                  </button>
                                </th>
                                <th className="px-4 py-3 text-left">
                                  <button
                                    onClick={() =>
                                      handleSort("purpose", "appointments")
                                    }
                                    className="group flex items-center space-x-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                                  >
                                    <span>Purpose</span>
                                    <ArrowUpDown
                                      className={`w-3 h-3 transition-colors ${sortConfig.key === "purpose" ? "text-indigo-500" : "text-slate-300 group-hover:text-slate-400"}`}
                                    />
                                  </button>
                                </th>
                                <th className="px-4 py-3 text-left">
                                  <button
                                    onClick={() =>
                                      handleSort(
                                        "appointmentDate",
                                        "appointments",
                                      )
                                    }
                                    className="group flex items-center space-x-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                                  >
                                    <span>Scheduled At</span>
                                    <ArrowUpDown
                                      className={`w-3 h-3 transition-colors ${sortConfig.key === "appointmentDate" ? "text-indigo-500" : "text-slate-300 group-hover:text-slate-400"}`}
                                    />
                                  </button>
                                </th>
                                <th className="px-4 py-3 text-left">
                                  <button
                                    onClick={() =>
                                      handleSort("status", "appointments")
                                    }
                                    className="group flex items-center space-x-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                                  >
                                    <span>Status</span>
                                    <ArrowUpDown
                                      className={`w-3 h-3 transition-colors ${sortConfig.key === "status" ? "text-indigo-500" : "text-slate-300 group-hover:text-slate-400"}`}
                                    />
                                  </button>
                                </th>
                                <th className="px-4 py-3 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                  Actions
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {getSortedData(appointments, "appointments").map(
                                (appointment, index) => (
                                  <tr
                                    key={appointment._id}
                                    className="hover:bg-gradient-to-r hover:from-purple-50/50 hover:to-pink-50/50 transition-all duration-200 group/row"
                                  >
                                    <td className="px-3 py-4 text-center">
                                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-purple-100 text-purple-700 text-xs font-bold">
                                        {(appointmentPage - 1) *
                                          appointmentPagination.limit +
                                          index +
                                          1}
                                      </span>
                                    </td>
                                    <td className="px-4 py-4">
                                      <button
                                        onClick={() => openAppointmentDetail(appointment._id)}
                                        className="font-bold text-sm text-purple-700 hover:text-purple-800 hover:underline"
                                      >
                                        {appointment.appointmentId}
                                      </button>
                                    </td>
                                    <td className="px-4 py-4">
                                      <div className="flex flex-col">
                                        <button
                                          onClick={() => openAppointmentDetail(appointment._id)}
                                          className="text-gray-900 font-bold text-sm text-left hover:text-purple-600 hover:underline whitespace-normal break-words"
                                        >
                                          {appointment.citizenName}
                                        </button>
                                        <div className="flex items-center text-xs text-gray-500 font-medium">
                                          <Phone className="w-3 h-3 mr-1.5" />
                                          {formatTo10Digits(appointment.citizenPhone)}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-4">
                                      <div className="flex flex-col max-w-[150px]">
                                        <span className="text-[12px] text-gray-500 whitespace-normal break-words italic">
                                          {appointment.purpose}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-4">
                                      <div className="flex items-start gap-2">
                                        <div className="flex flex-col items-center justify-center w-12 h-12 bg-gradient-to-br from-purple-100 to-fuchsia-100 rounded-xl border border-purple-200/50 shadow-sm">
                                          <span className="text-[10px] font-bold text-purple-600 uppercase">
                                            {new Date(
                                              appointment.appointmentDate,
                                            ).toLocaleDateString("en-US", {
                                              month: "short",
                                            })}
                                          </span>
                                          <span className="text-lg font-black text-purple-700 leading-tight">
                                            {new Date(
                                              appointment.appointmentDate,
                                            ).getDate()}
                                          </span>
                                        </div>
                                        <div className="flex flex-col justify-center">
                                          <span className="text-xs font-semibold text-gray-800">
                                            {new Date(
                                              appointment.appointmentDate,
                                            ).toLocaleDateString("en-US", {
                                              weekday: "long",
                                            })}
                                          </span>
                                          <span className="text-[11px] text-gray-500">
                                            {new Date(
                                              appointment.appointmentDate,
                                            ).getFullYear()}
                                          </span>
                                          <div className="flex items-center gap-1 mt-1">
                                            <Clock className="w-3 h-3 text-amber-500" />
                                            <span className="text-xs font-bold text-amber-600">
                                              {appointment.appointmentTime
                                                ? (() => {
                                                    const [hours, minutes] =
                                                      appointment.appointmentTime.split(
                                                        ":",
                                                      );
                                                    const hour = parseInt(
                                                      hours,
                                                      10,
                                                    );
                                                    const period =
                                                      hour >= 12 ? "PM" : "AM";
                                                    const displayHour =
                                                      hour > 12
                                                        ? hour - 12
                                                        : hour === 0
                                                          ? 12
                                                          : hour;
                                                    return `${displayHour}:${minutes || "00"} ${period}`;
                                                  })()
                                                : "TBD"}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-4">
                                      <div className="relative flex items-center gap-2">
                                        <button
                                          onClick={() => {
                                            setSelectedAppointmentForStatus(
                                              appointment,
                                            );
                                            setShowAppointmentStatusModal(true);
                                          }}
                                          className={`px-3 py-1.5 text-[10px] font-bold border border-gray-200 rounded bg-white hover:border-purple-400 hover:bg-purple-50 focus:outline-none focus:ring-1 focus:ring-purple-500 uppercase tracking-tight transition-all ${
                                            updatingAppointmentStatus.has(
                                              appointment._id,
                                            )
                                              ? "opacity-50 cursor-wait"
                                              : ""
                                          }`}
                                          disabled={updatingAppointmentStatus.has(
                                            appointment._id,
                                          )}
                                        >
                                          {appointment.status}
                                        </button>
                                        {updatingAppointmentStatus.has(
                                          appointment._id,
                                        ) && (
                                          <RefreshCw className="w-3.5 h-3.5 text-purple-600 animate-spin flex-shrink-0" />
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-4">
                                      <div className="flex items-center justify-center gap-1">
                                        {/* Assign button removed - Appointments are for CEO only, no assignment needed */}
                                        <button
                                          onClick={() => openAppointmentDetail(appointment._id)}
                                          title="View Details"
                                          className="p-2 rounded-lg text-purple-600 hover:text-purple-700 hover:bg-purple-50 border border-transparent hover:border-purple-200 transition-all duration-200"
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
                                      </div>
                                    </td>
                                  </tr>
                                ),
                              )}
                            </tbody>
                          </table>
                        </div>

                        <Pagination
                          currentPage={appointmentPage}
                          totalPages={appointmentPagination.pages}
                          totalItems={appointmentPagination.total}
                          itemsPerPage={appointmentPagination.limit}
                          onPageChange={setAppointmentPage}
                          className="mt-6 shadow-none border-t border-slate-100 rounded-none bg-slate-50/30"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}

          {/* Project Leads Tab - NEW for PugArch and others with LEAD_CAPTURE */}
          {user &&
            (user.enabledModules?.includes(Module.LEAD_CAPTURE) ||
              !user.companyId) &&
            isCompanyLevel && (
              <TabsContent value="leads" className="space-y-6">
                <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
                  <CardHeader className="bg-slate-900 px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                          <UserPlus className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                          <CardTitle className="text-base font-bold text-white uppercase tracking-tight">
                            Project Leads
                          </CardTitle>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                            Manage and track potential business opportunities
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={() => fetchLeads()}
                        variant="outline"
                        className="bg-white/10 hover:bg-white/20 text-white border-white/20 h-8 text-[10px] font-bold uppercase tracking-wider"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 mr-2 ${loadingLeads ? "animate-spin" : ""}`}
                        />
                        Refresh
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {loadingLeads ? (
                      <TableSkeleton rows={8} cols={6} />
                    ) : leads.length === 0 ? (
                      <div className="text-center py-20">
                        <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                          <UserPlus className="w-10 h-10 text-blue-500" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">
                          No leads found
                        </h3>
                        <p className="text-slate-500 mt-1 max-w-xs mx-auto">
                          When customers interact with your lead generation
                          flow, they will appear here.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-slate-50/50 border-b border-slate-100">
                            <tr>
                              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Lead Info
                              </th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Project
                              </th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Budget/Timeline
                              </th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Contact
                              </th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Status
                              </th>
                              <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {leads.map((lead) => (
                              <tr
                                key={lead._id}
                                className="hover:bg-slate-50/50 transition-colors group"
                              >
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex flex-col">
                                    <span className="font-bold text-slate-900">
                                      {lead.name}
                                    </span>
                                    <span className="text-xs text-slate-500">
                                      {lead.companyName || "Individual"}
                                    </span>
                                    <span className="text-[10px] text-blue-500 font-mono mt-1">
                                      {lead.leadId}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex flex-col max-w-[200px]">
                                    <span className="text-sm font-semibold text-slate-700">
                                      {lead.projectType}
                                    </span>
                                    <span className="text-xs text-slate-500 truncate">
                                      {lead.projectDescription}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex flex-col">
                                    <span className="text-xs font-medium text-slate-700">
                                      Budget: {lead.budgetRange || "N/A"}
                                    </span>
                                    <span className="text-xs text-slate-500">
                                      Timeline: {lead.timeline || "N/A"}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex flex-col">
                                    <span className="text-sm text-slate-700 flex items-center gap-1.5">
                                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                                      {lead.contactInfo}
                                    </span>
                                    {lead.email && (
                                      <span className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                                        {lead.email}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 uppercase">
                                    {lead.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-right whitespace-nowrap">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 rounded-lg"
                                  >
                                    <Key className="w-4 h-4 text-slate-400" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}


          <TabsContent value="profile" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="bg-slate-900 px-6 py-4 border-b border-slate-800">
                    <h3 className="text-white text-sm font-bold uppercase tracking-tight flex items-center gap-2">
                      <UserIcon className="w-4 h-4 text-indigo-400" />
                      Official Identity
                    </h3>
                  </div>
                  <div className="p-6">
                    <div className="flex flex-col items-center text-center">
                      <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl mb-4">
                        <span className="text-3xl font-bold text-white uppercase">
                          {user?.firstName?.[0]}
                          {user?.lastName?.[0]}
                        </span>
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-1">
                        {user?.firstName} {user?.lastName}
                      </h3>
                      <span className="px-3 py-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-bold rounded-full uppercase tracking-wide mb-4">
                        {user?.role?.replace("_", " ")}
                      </span>

                      <div className="w-full space-y-3 mt-4 text-left">
                        <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Mail className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                              Email
                            </p>
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {user?.email}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <Phone className="w-5 h-5 text-green-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                              Phone
                            </p>
                            <p className="text-sm font-medium text-gray-900">
                              {user?.phone || "Not provided"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <Building className="w-5 h-5 text-purple-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                              Department
                            </p>
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {typeof user?.departmentId === "object" &&
                              user?.departmentId
                                ? (user.departmentId as any).name
                                : departments.find(
                                    (d) => d._id === user?.departmentId,
                                  )?.name || "Not assigned"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                            <Shield className="w-5 h-5 text-amber-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                              User ID
                            </p>
                            <p className="text-xs font-mono text-gray-600 truncate">
                              {user?.id}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Performance Statistics */}
              <div className="lg:col-span-2 space-y-6">
                {/* Stats Overview */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="relative overflow-hidden bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 rounded-2xl p-5 text-white shadow-lg">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
                    <div className="relative z-10">
                      <p className="text-sm font-medium text-white/80">
                        Assigned Grievances
                      </p>
                      <p className="text-3xl font-black mt-1">
                        {
                          grievances.filter((g) => {
                            const assignedId =
                              typeof g.assignedTo === "object" && g.assignedTo
                                ? (g.assignedTo as any)._id
                                : g.assignedTo;
                            return assignedId === user?.id;
                          }).length
                        }
                      </p>
                    </div>
                  </div>

                  <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 via-green-500 to-teal-500 rounded-2xl p-5 text-white shadow-lg">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
                    <div className="relative z-10">
                      <p className="text-sm font-medium text-white/80">
                        Resolved Grievances
                      </p>
                      <p className="text-3xl font-black mt-1">
                        {
                          grievances.filter((g) => {
                            const assignedId =
                              typeof g.assignedTo === "object" && g.assignedTo
                                ? (g.assignedTo as any)._id
                                : g.assignedTo;
                            return (
                              assignedId === user?.id && g.status === "RESOLVED"
                            );
                          }).length
                        }
                      </p>
                    </div>
                  </div>

                  <div className="relative overflow-hidden bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-500 rounded-2xl p-5 text-white shadow-lg">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
                    <div className="relative z-10">
                      <p className="text-sm font-medium text-white/80">
                        Assigned Appointments
                      </p>
                      <p className="text-3xl font-black mt-1">
                        {
                          appointments.filter((a) => {
                            const assignedId =
                              typeof a.assignedTo === "object" && a.assignedTo
                                ? (a.assignedTo as any)._id
                                : a.assignedTo;
                            return assignedId === user?.id;
                          }).length
                        }
                      </p>
                    </div>
                  </div>

                  <div className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 rounded-2xl p-5 text-white shadow-lg">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
                    <div className="relative z-10">
                      <p className="text-sm font-medium text-white/80">
                        Completed Appointments
                      </p>
                      <p className="text-3xl font-black mt-1">
                        {
                          appointments.filter((a) => {
                            const assignedId =
                              typeof a.assignedTo === "object" && a.assignedTo
                                ? (a.assignedTo as any)._id
                                : a.assignedTo;
                            return (
                              assignedId === user?.id &&
                              a.status === "COMPLETED"
                            );
                          }).length
                        }
                      </p>
                    </div>
                  </div>
                </div>

                {/* Detailed Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Grievances Breakdown */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-100 shadow-lg">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-md">
                        <FileText className="w-5 h-5 text-white" />
                      </div>
                      <h4 className="text-lg font-bold text-gray-900">
                        Grievances Breakdown
                      </h4>
                    </div>

                    <div className="space-y-3">
                      {(() => {
                        const myGrievances = grievances.filter((g) => {
                          const assignedId =
                            typeof g.assignedTo === "object" && g.assignedTo
                              ? (g.assignedTo as any)._id
                              : g.assignedTo;
                          return assignedId === user?.id;
                        });
                        const pending = myGrievances.filter(
                          (g) => g.status === "PENDING",
                        ).length;
                        const assigned = myGrievances.filter(
                          (g) => g.status === "ASSIGNED",
                        ).length;
                        const resolved = myGrievances.filter(
                          (g) => g.status === "RESOLVED",
                        ).length;
                        const total = myGrievances.length;

                        return (
                          <>
                            <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-gray-100">
                              <span className="text-sm text-gray-600 flex items-center gap-2">
                                <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                                Pending
                              </span>
                              <span className="font-bold text-gray-900">
                                {pending}
                              </span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-gray-100">
                              <span className="text-sm text-gray-600 flex items-center gap-2">
                                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                In Progress
                              </span>
                              <span className="font-bold text-gray-900">
                                {assigned}
                              </span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-gray-100">
                              <span className="text-sm text-gray-600 flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                Resolved
                              </span>
                              <span className="font-bold text-gray-900">
                                {resolved}
                              </span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl text-white mt-2">
                              <span className="text-sm font-medium">
                                Resolution Rate
                              </span>
                              <span className="font-bold text-lg">
                                {total > 0
                                  ? ((resolved / total) * 100).toFixed(1)
                                  : "0.0"}
                                %
                              </span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Appointments Breakdown */}
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-5 border border-purple-100 shadow-lg">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center shadow-md">
                        <CalendarClock className="w-5 h-5 text-white" />
                      </div>
                      <h4 className="text-lg font-bold text-gray-900">
                        Appointments Breakdown
                      </h4>
                    </div>

                    <div className="space-y-3">
                      {(() => {
                        const myAppointments = appointments.filter((a) => {
                          const assignedId =
                            typeof a.assignedTo === "object" && a.assignedTo
                              ? (a.assignedTo as any)._id
                              : a.assignedTo;
                          return assignedId === user?.id;
                        });
                        const scheduled = myAppointments.filter(
                          (a) => a.status === "SCHEDULED",
                        ).length;
                        const completed = myAppointments.filter(
                          (a) => a.status === "COMPLETED",
                        ).length;
                        const cancelled = myAppointments.filter(
                          (a) => a.status === "CANCELLED",
                        ).length;
                        const total = myAppointments.length;

                        return (
                          <>
                            <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-gray-100">
                              <span className="text-sm text-gray-600 flex items-center gap-2">
                                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                Scheduled
                              </span>
                              <span className="font-bold text-gray-900">
                                {scheduled}
                              </span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-gray-100">
                              <span className="text-sm text-gray-600 flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                Completed
                              </span>
                              <span className="font-bold text-gray-900">
                                {completed}
                              </span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-gray-100">
                              <span className="text-sm text-gray-600 flex items-center gap-2">
                                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                                Cancelled
                              </span>
                              <span className="font-bold text-gray-900">
                                {cancelled}
                              </span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-gradient-to-r from-purple-500 to-fuchsia-500 rounded-xl text-white mt-2">
                              <span className="text-sm font-medium">
                                Completion Rate
                              </span>
                              <span className="font-bold text-lg">
                                {total > 0
                                  ? ((completed / total) * 100).toFixed(1)
                                  : "0.0"}
                                %
                              </span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Performance Summary */}
                <div className="bg-gradient-to-r from-slate-50 via-gray-50 to-slate-50 rounded-2xl p-5 border border-slate-200 shadow-lg">
                  <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-indigo-600" />
                    Performance Summary
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {(() => {
                      const myGrievances = grievances.filter((g) => {
                        const assignedId =
                          typeof g.assignedTo === "object" && g.assignedTo
                            ? (g.assignedTo as any)._id
                            : g.assignedTo;
                        return assignedId === user?.id;
                      });
                      const myAppointments = appointments.filter((a) => {
                        const assignedId =
                          typeof a.assignedTo === "object" && a.assignedTo
                            ? (a.assignedTo as any)._id
                            : a.assignedTo;
                        return assignedId === user?.id;
                      });
                      const totalTasks =
                        myGrievances.length + myAppointments.length;
                      const completedTasks =
                        myGrievances.filter((g) => g.status === "RESOLVED")
                          .length +
                        myAppointments.filter((a) => a.status === "COMPLETED")
                          .length;
                      const pendingTasks =
                        totalTasks -
                        completedTasks -
                        myAppointments.filter((a) => a.status === "CANCELLED")
                          .length;

                      return (
                        <>
                          <div className="text-center p-4 bg-white rounded-xl border border-gray-100">
                            <p className="text-3xl font-black text-indigo-600">
                              {totalTasks}
                            </p>
                            <p className="text-xs font-medium text-gray-500 uppercase mt-1">
                              Total Tasks
                            </p>
                          </div>
                          <div className="text-center p-4 bg-white rounded-xl border border-gray-100">
                            <p className="text-3xl font-black text-emerald-600">
                              {completedTasks}
                            </p>
                            <p className="text-xs font-medium text-gray-500 uppercase mt-1">
                              Completed
                            </p>
                          </div>
                          <div className="text-center p-4 bg-white rounded-xl border border-gray-100">
                            <p className="text-3xl font-black text-amber-600">
                              {pendingTasks}
                            </p>
                            <p className="text-xs font-medium text-gray-500 uppercase mt-1">
                              Pending
                            </p>
                          </div>
                          <div className="text-center p-4 bg-white rounded-xl border border-gray-100">
                            <p className="text-3xl font-black text-purple-600">
                              {totalTasks > 0
                                ? ((completedTasks / totalTasks) * 100).toFixed(
                                    0,
                                  )
                                : "0"}
                              %
                            </p>
                            <p className="text-xs font-medium text-gray-500 uppercase mt-1">
                              Efficiency
                            </p>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        {(isCompanyLevel || isDepartmentLevel) && (
          <>
            {isCompanyLevel && (
              <CreateDepartmentDialog
                isOpen={showDepartmentDialog}
                onClose={() => {
                  setShowDepartmentDialog(false);
                  setEditingDepartment(null);
                }}
                onDepartmentCreated={() => {
                  fetchDepartments(departmentPage, true);
                  fetchDashboardData(true);
                  setEditingDepartment(null);
                }}
                editingDepartment={editingDepartment}
              />
            )}
            <ConfirmDialog
              isOpen={confirmDialog.isOpen}
              title={confirmDialog.title}
              message={confirmDialog.message}
              onConfirm={confirmDialog.onConfirm}
              onCancel={() =>
                setConfirmDialog({ ...confirmDialog, isOpen: false })
              }
              variant={confirmDialog.variant}
            />
            <CreateUserDialog
              isOpen={showUserDialog}
              onClose={() => setShowUserDialog(false)}
              onUserCreated={() => {
                fetchUsers(userPage, true);
                fetchDashboardData(true);
              }}
            />
            <EditUserDialog
              isOpen={showEditUserDialog}
              onClose={() => {
                setShowEditUserDialog(false);
                setEditingUser(null);
              }}
              onUserUpdated={() => {
                fetchUsers(userPage, true);
                fetchDashboardData(true);
              }}
              user={editingUser}
            />
            <ChangePermissionsDialog
              isOpen={showChangePermissionsDialog}
              onClose={() => {
                setShowChangePermissionsDialog(false);
                setEditingUser(null);
              }}
              onPermissionsUpdated={() => {
                fetchUsers(userPage, true);
                fetchDashboardData(true);
              }}
              user={editingUser}
            />
          </>
        )}

        {/* Detail Dialogs */}
        <GrievanceDetailDialog
          isOpen={showGrievanceDetail}
          grievance={selectedGrievance}
          onClose={() => {
            setShowGrievanceDetail(false);
            setSelectedGrievance(null);
          }}
        />

        <AppointmentDetailDialog
          isOpen={showAppointmentDetail}
          appointment={selectedAppointment}
          onClose={() => {
            setShowAppointmentDetail(false);
            setSelectedAppointment(null);
          }}
        />

        <RevertGrievanceDialog
          isOpen={showGrievanceRevertDialog}
          grievanceId={selectedGrievanceForRevert?.grievanceId}
          onClose={() => {
            setShowGrievanceRevertDialog(false);
            setSelectedGrievanceForRevert(null);
          }}
          onSubmit={async (payload) => {
            if (!selectedGrievanceForRevert) return;
            try {
              const response = await grievanceAPI.revert(selectedGrievanceForRevert._id, payload);
              if (response.success) {
                toast.success("Grievance reverted to company admin for reassignment");
                fetchGrievances(grievancePage, true);
                fetchDashboardData(true);
                setShowGrievanceRevertDialog(false);
                setSelectedGrievanceForRevert(null);
              }
            } catch (error: any) {
              const errorMessage = error.response?.data?.message || error.message || "Failed to revert grievance";
              toast.error(errorMessage);
            }
          }}
        />

        {/* Assignment Dialogs */}
        {selectedGrievanceForAssignment && user?.companyId && (
          <AssignmentDialog
            isOpen={showGrievanceAssignment}
            onClose={() => {
              setShowGrievanceAssignment(false);
              setSelectedGrievanceForAssignment(null);
            }}
            onAssign={async (userId: string, departmentId?: string) => {
              await grievanceAPI.assign(
                selectedGrievanceForAssignment._id,
                userId,
                departmentId,
              );
              fetchGrievances(grievancePage, true);
              fetchDashboardData(true);
            }}
            itemType="grievance"
            itemId={selectedGrievanceForAssignment._id}
            companyId={
              typeof user.companyId === "object" && user.companyId !== null
                ? user.companyId._id
                : user.companyId || ""
            }
            currentAssignee={selectedGrievanceForAssignment.assignedTo}
            currentDepartmentId={
              (() => {
                if (selectedGrievanceForAssignment.status === "REVERTED") {
                  const revertEntry = selectedGrievanceForAssignment.timeline
                    ?.filter((t: any) => t.action === "REVERTED_TO_COMPANY_ADMIN")
                    .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
                  
                  if (revertEntry?.details?.suggestedDepartmentId) {
                    return revertEntry.details.suggestedDepartmentId;
                  }
                }
                
                return selectedGrievanceForAssignment.departmentId &&
                  typeof selectedGrievanceForAssignment.departmentId === "object"
                  ? (selectedGrievanceForAssignment.departmentId as any)._id
                  : selectedGrievanceForAssignment.departmentId;
              })()
            }
            currentSubDepartmentId={
              (() => {
                if (selectedGrievanceForAssignment.status === "REVERTED") {
                  const revertEntry = selectedGrievanceForAssignment.timeline
                    ?.filter((t: any) => t.action === "REVERTED_TO_COMPANY_ADMIN")
                    .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
                  
                  if (revertEntry?.details?.suggestedSubDepartmentId) {
                    return revertEntry.details.suggestedSubDepartmentId;
                  }
                }

                return selectedGrievanceForAssignment.subDepartmentId &&
                  typeof selectedGrievanceForAssignment.subDepartmentId === "object"
                  ? (selectedGrievanceForAssignment.subDepartmentId as any)._id
                  : selectedGrievanceForAssignment.subDepartmentId;
              })()
            }
            userRole={user.role}
            userDepartmentId={
              typeof user.departmentId === "object" &&
              user.departmentId !== null
                ? user.departmentId._id
                : user.departmentId
            }
            currentUserId={user.id}
          />
        )}

        {selectedAppointmentForAssignment && user?.companyId && (
          <AssignmentDialog
            isOpen={showAppointmentAssignment}
            onClose={() => {
              setShowAppointmentAssignment(false);
              setSelectedAppointmentForAssignment(null);
            }}
            onAssign={async (userId: string, departmentId?: string) => {
              await appointmentAPI.assign(
                selectedAppointmentForAssignment._id,
                userId,
                departmentId,
              );
              fetchAppointments(appointmentPage, true);
              fetchDashboardData(true);
            }}
            itemType="appointment"
            itemId={selectedAppointmentForAssignment._id}
            companyId={
              typeof user.companyId === "object" && user.companyId !== null
                ? user.companyId._id
                : user.companyId || ""
            }
            currentAssignee={selectedAppointmentForAssignment.assignedTo}
            currentDepartmentId={
              selectedAppointmentForAssignment.departmentId &&
              typeof selectedAppointmentForAssignment.departmentId === "object"
                ? selectedAppointmentForAssignment.departmentId._id
                : selectedAppointmentForAssignment.departmentId
            }
            userRole={user.role}
            userDepartmentId={
              typeof user.departmentId === "object" &&
              user.departmentId !== null
                ? user.departmentId._id
                : user.departmentId
            }
            currentUserId={user.id}
          />
        )}

        {/* Metric Info Dialog */}
        <MetricInfoDialog
          isOpen={showMetricDialog}
          onClose={() => setShowMetricDialog(false)}
          metric={selectedMetric}
        />

        {/* Availability Calendar */}
        <AvailabilityCalendar
          isOpen={showAvailabilityCalendar}
          onClose={() => setShowAvailabilityCalendar(false)}
          departmentId={
            user?.role === "DEPARTMENT_ADMIN" && user?.departmentId
              ? typeof user.departmentId === "object"
                ? user.departmentId._id
                : user.departmentId
              : undefined
          }
        />

        {/* Appointment Status Update Modal */}
        <StatusUpdateModal
          isOpen={showAppointmentStatusModal}
          onClose={() => {
            setShowAppointmentStatusModal(false);
            setSelectedAppointmentForStatus(null);
          }}
          itemId={showAppointmentStatusModal ? (selectedAppointmentForStatus?._id || "") : ""}
          itemType="appointment"
          currentStatus={selectedAppointmentForStatus?.status || ""}
          initialDate={selectedAppointmentForStatus?.appointmentDate}
          initialTime={selectedAppointmentForStatus?.appointmentTime}
          onSuccess={() => {
            fetchAppointments(appointmentPage, true);
            fetchDashboardData(true);
            setShowAppointmentStatusModal(false);
            setSelectedAppointmentForStatus(null);
          }}
        />

        <StatusUpdateModal
          isOpen={showGrievanceStatusModal}
          onClose={() => {
            setShowGrievanceStatusModal(false);
            setSelectedGrievanceForStatus(null);
          }}
          itemId={showGrievanceStatusModal ? (selectedGrievanceForStatus?._id || "") : ""}
          itemType="grievance"
          currentStatus={selectedGrievanceForStatus?.status || ""}
          onSuccess={() => {
            fetchGrievances(grievancePage, true);
            fetchDashboardData(true);
          }}
          grievanceVariant={
            user?.role === "OPERATOR" ? "operator" : "department-admin"
          }
        />

        {/* Department Users Dialog */}
        <DepartmentUsersDialog
          isOpen={showDeptUsersDialog}
          onClose={() => {
            setShowDeptUsersDialog(false);
            setSelectedDeptForUsers(null);
          }}
          departmentId={selectedDeptForUsers?.id || null}
          departmentName={selectedDeptForUsers?.name || null}
          onUserClick={(u) => {
            setSelectedUserForDetails(u);
            setShowUserDetailsDialog(true);
          }}
        />

        {/* User Details Dialog (Moved here to ensure it appears on top of other dialogs) */}
        <UserDetailsDialog
          isOpen={showUserDetailsDialog}
          onClose={() => {
            setShowUserDetailsDialog(false);
            setSelectedUserForDetails(null);
          }}
          user={selectedUserForDetails}
        />
      </main>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <LoadingSpinner />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
