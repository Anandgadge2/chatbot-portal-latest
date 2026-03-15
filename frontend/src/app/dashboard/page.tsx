"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
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
import WhatsAppConfig from "@/components/dashboard/WhatsAppConfig";
import EmailConfig from "@/components/dashboard/EmailConfig";
import FlowManagement from "@/components/dashboard/FlowManagement";
import NotificationManagement from "@/components/superadmin/drilldown/NotificationManagement";

import OverviewTab from "@/components/dashboard/OverviewTab";
import AnalyticsTab from "@/components/dashboard/AnalyticsTab";
import UserTab from "@/components/dashboard/UserTab";
import DepartmentTab from "@/components/dashboard/DepartmentTab";
import GrievanceTab from "@/components/dashboard/GrievanceTab";
import AppointmentTab from "@/components/dashboard/AppointmentTab";
import LeadsTab from "@/components/dashboard/LeadsTab";
import ProfileTab from "@/components/dashboard/ProfileTab";
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
  MessageSquare,
  Workflow,
  Settings,
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

function DashboardContent() {
  const { user, loading, logout } = useAuth();
  const searchParams = useSearchParams();
  const masqueradeId = searchParams.get("companyId");
  const isCompanyLevel = !!((user && !user.departmentId && user.role !== "SUPER_ADMIN") || (user?.role === "SUPER_ADMIN" && masqueradeId));
  const isDepartmentLevel = !!(user && !!user.departmentId && user.role !== "SUPER_ADMIN");
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const router = useRouter();
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
    if (user?.role === "SUPER_ADMIN" && masqueradeId) {
       apiClient.setMasqueradeCompany(masqueradeId);
    } else {
       apiClient.setMasqueradeCompany(null);
    }
  }, [user, masqueradeId]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    } else if (!loading && user && user.role === "SUPER_ADMIN" && !masqueradeId) {
      router.push("/superadmin/dashboard");
    }
  }, [user, loading, router, masqueradeId]);

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
      const response = await apiClient.get("/analytics/category");
      if (response.success) {
        setCategoryData(response.data);
      }
    } catch (error: any) {
      console.error("Failed to fetch category data:", error);
    }
  }, []);

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
    if (mounted && user && (user.role !== "SUPER_ADMIN" || masqueradeId)) {
      fetchDashboardData();
      if (user.companyId || (isSuperAdmin && masqueradeId)) {
        fetchCompany();
        fetchRoles();
      }
    }
  }, [mounted, user, fetchDashboardData, fetchCompany, fetchRoles, masqueradeId, isSuperAdmin]);

  // 2. Specialized effects for each paginated module
  useEffect(() => {
    if (mounted && user && (user.role !== "SUPER_ADMIN" || masqueradeId)) {
      fetchDepartments(departmentPage);
    }
  }, [mounted, user, departmentPage, fetchDepartments, masqueradeId]);

  useEffect(() => {
    if (mounted && user && (user.role !== "SUPER_ADMIN" || masqueradeId)) {
      fetchUsers(userPage);
    }
  }, [mounted, user, userPage, fetchUsers, masqueradeId]);

  useEffect(() => {
    if (mounted && user && (user.role !== "SUPER_ADMIN" || masqueradeId) && hasModule(Module.GRIEVANCE) && hasPermission(user, Permission.READ_GRIEVANCE)) {
      fetchGrievances(grievancePage);
    }
  }, [mounted, user, grievancePage, fetchGrievances, hasModule, masqueradeId]);

  useEffect(() => {
    if (mounted && user && (user.role !== "SUPER_ADMIN" || masqueradeId) && hasModule(Module.APPOINTMENT) && hasPermission(user, Permission.READ_APPOINTMENT)) {
      fetchAppointments(appointmentPage);
    }
  }, [mounted, user, appointmentPage, fetchAppointments, hasModule, masqueradeId]);

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
            const uRoleId = typeof u.customRoleId === "object" ? (u.customRoleId as any)._id : u.customRoleId;
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

  if (!user || (user.role === "SUPER_ADMIN" && !masqueradeId)) {
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
                  Analytics
                </TabsTrigger>
              )}

                {hasPermission(user, Permission.READ_GRIEVANCE) && (
                  <TabsTrigger
                    value="grievances"
                    className="px-5 h-8 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg"
                  >
                    Grievances
                  </TabsTrigger>
                )}

              {isCompanyLevel && hasPermission(user, Permission.READ_GRIEVANCE) && (
                <TabsTrigger
                  value="reverted"
                  className="px-5 h-8 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg flex items-center"
                >
                  <Undo2 className="w-3.5 h-3.5 mr-1.5" />
                  Reverted
                </TabsTrigger>
              )}



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
                  Departments
                </TabsTrigger>
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

              {isSuperAdmin && masqueradeId && (
                <>
                  <TabsTrigger
                    value="whatsapp"
                    className="px-5 h-8 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg flex items-center gap-1.5"
                  >
                    <MessageSquare className="w-3 h-3" />
                    WhatsApp
                  </TabsTrigger>
                  <TabsTrigger
                    value="email"
                    className="px-5 h-8 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg flex items-center gap-1.5"
                  >
                    <Mail className="w-3 h-3" />
                    Email
                  </TabsTrigger>
                  <TabsTrigger
                    value="flows"
                    className="px-5 h-8 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg flex items-center gap-1.5"
                  >
                    <Workflow className="w-3 h-3" />
                    Flows
                  </TabsTrigger>
                  <TabsTrigger
                    value="notifications"
                    className="px-5 h-8 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg flex items-center gap-1.5"
                  >
                    <Bell className="w-3 h-3" />
                    Notifs
                  </TabsTrigger>
                </>
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

          <OverviewTab
            user={user as any}
            company={company}
            stats={stats}
            refreshing={refreshing}
            handleRefresh={handleRefresh}
            setActiveTab={setActiveTab}
            setGrievanceFilters={setGrievanceFilters}
            setAppointmentFilters={setAppointmentFilters}
            loadingStats={loadingStats}
            users={users}
            departments={departments}
            departmentPagination={departmentPagination}
            grievances={grievances}
            appointments={appointments}
            formatTo10Digits={formatTo10Digits}
            setShowAvailabilityCalendar={setShowAvailabilityCalendar}
            isCompanyLevel={isCompanyLevel}
            isDepartmentLevel={isDepartmentLevel}
          />

          {!isSuperAdmin && (
            <AnalyticsTab
            user={user as any}
              company={company}
              stats={stats}
              loadingStats={loadingStats}
              isCompanyLevel={isCompanyLevel}
              isDepartmentLevel={isDepartmentLevel}
              setActiveTab={setActiveTab}
              setGrievanceFilters={setGrievanceFilters}
              setAppointmentFilters={setAppointmentFilters}
              appointments={appointments}
              users={users}
              departments={departments}
              departmentData={departmentData}
              router={router}
            />
          )}

          <DepartmentTab
            isCompanyLevel={isCompanyLevel}
            departments={departments}
            fetchDepartments={fetchDepartments}
            setShowDepartmentDialog={setShowDepartmentDialog}
            deptSearch={deptSearch}
            setDeptSearch={setDeptSearch}
            deptFilters={deptFilters}
            setDeptFilters={setDeptFilters}
            loadingDepartments={loadingDepartments}
            handleSort={handleSort}
            sortConfig={sortConfig}
            getSortedData={getSortedData}
            navigatingToDepartment={navigatingToDepartment}
            setNavigatingToDepartment={setNavigatingToDepartment}
            setSelectedDepartmentId={setSelectedDepartmentId}
            router={router}
            deptUserCounts={deptUserCounts}
            setSelectedDeptForUsers={setSelectedDeptForUsers}
            setShowDeptUsersDialog={setShowDeptUsersDialog}
            setConfirmDialog={setConfirmDialog}
            setEditingDepartment={setEditingDepartment}
          />

          <UserTab
            user={user as any}
            users={users}
            roles={roles}
            departments={departments}
            isCompanyLevel={isCompanyLevel}
            isDepartmentLevel={isDepartmentLevel}
            isSuperAdmin={isSuperAdmin}
            userSearch={userSearch}
            setUserSearch={setUserSearch}
            userFilters={userFilters}
            setUserFilters={setUserFilters}
            showUserFiltersOnMobile={showUserFiltersOnMobile}
            setShowUserFiltersOnMobile={setShowUserFiltersOnMobile}
            activeUserFilterCount={activeUserFilterCount}
            loadingUsers={loadingUsers}
            userPage={userPage}
            setUserPage={setUserPage}
            userPagination={userPagination}
            setShowUserDialog={setShowUserDialog}
            setSelectedUserForDetails={setSelectedUserForDetails}
            setShowUserDetailsDialog={setShowUserDetailsDialog}
            setEditingUser={setEditingUser}
            setShowEditUserDialog={setShowEditUserDialog}
            setShowChangePermissionsDialog={setShowChangePermissionsDialog}
            handleSort={handleSort}
            sortConfig={sortConfig}
            fetchDashboardData={fetchDashboardData}
            handleToggleUserStatus={handleToggleUserStatus}
            setConfirmDialog={setConfirmDialog}
            formatTo10Digits={formatTo10Digits}
            getParentDepartmentId={getParentDepartmentId}
            setUsers={setUsers}
            fetchUsers={fetchUsers}
            getSortedData={getSortedData}
          />
          {/* Grievance Tab */}
          {hasModule(Module.GRIEVANCE) && (
            <GrievanceTab
              grievances={grievances}
              loadingGrievances={loadingGrievances}
              grievanceFilters={grievanceFilters}
              setGrievanceFilters={setGrievanceFilters}
              grievanceSearch={grievanceSearch}
              setGrievanceSearch={setGrievanceSearch}
              handleRefreshData={handleRefreshData}
              isRefreshing={isRefreshing}
              selectedGrievances={selectedGrievances}
              setSelectedGrievances={setSelectedGrievances}
              handleBulkDeleteGrievances={handleBulkDeleteGrievances}
              isDeleting={isDeleting}
              sortConfig={sortConfig}
              handleSort={handleSort}
              grievancePage={grievancePage}
              setGrievancePage={setGrievancePage}
              grievancePagination={grievancePagination}
              openGrievanceDetail={openGrievanceDetail}
              setSelectedGrievanceForStatus={setSelectedGrievanceForStatus}
              setShowGrievanceStatusModal={setShowGrievanceStatusModal}
              updatingGrievanceStatus={updatingGrievanceStatus}
              setSelectedGrievanceForAssignment={setSelectedGrievanceForAssignment}
              setShowGrievanceAssignment={setShowGrievanceAssignment}
              setSelectedGrievanceForRevert={setSelectedGrievanceForRevert}
              setShowGrievanceRevertDialog={setShowGrievanceRevertDialog}
              departments={departments}
              users={users}
              user={user as any}
              isCompanyLevel={isCompanyLevel}
              getSortedData={getSortedData}
              formatTo10Digits={formatTo10Digits}
              getParentDepartmentId={getParentDepartmentId}
              exportToCSV={exportToCSV}
            />
          )}

          {/* Appointments Tab */}
          {user &&
            (user.enabledModules?.includes(Module.APPOINTMENT) ||
              !user.companyId) &&
            (isCompanyLevel || isDepartmentLevel) && (
              <AppointmentTab
                appointments={appointments}
                loadingAppointments={loadingAppointments}
                appointmentFilters={appointmentFilters}
                setAppointmentFilters={setAppointmentFilters}
                appointmentSearch={appointmentSearch}
                setAppointmentSearch={setAppointmentSearch}
                handleRefreshData={handleRefreshData}
                isRefreshing={isRefreshing}
                selectedAppointments={selectedAppointments}
                setSelectedAppointments={setSelectedAppointments}
                handleBulkDeleteAppointments={handleBulkDeleteAppointments}
                isDeleting={isDeleting}
                sortConfig={sortConfig}
                handleSort={handleSort}
                appointmentPage={appointmentPage}
                setAppointmentPage={setAppointmentPage}
                appointmentPagination={appointmentPagination}
                openAppointmentDetail={openAppointmentDetail}
                setSelectedAppointmentForStatus={setSelectedAppointmentForStatus}
                setShowAppointmentStatusModal={setShowAppointmentStatusModal}
                updatingAppointmentStatus={updatingAppointmentStatus}
                setShowAvailabilityCalendar={setShowAvailabilityCalendar}
                isCompanyLevel={isCompanyLevel}
                isDepartmentLevel={isDepartmentLevel}
                user={user as any}
                getSortedData={getSortedData}
                exportToCSV={exportToCSV}
              />
            )}

          {hasModule(Module.LEAD_CAPTURE) && (isCompanyLevel || isSuperAdmin) && (
            <LeadsTab
              leads={leads}
              loadingLeads={loadingLeads}
              fetchLeads={() => fetchLeads()}
            />
          )}

          <ProfileTab
            user={user as any}
            departments={departments}
            grievances={grievances}
            appointments={appointments}
          />

          {isSuperAdmin && masqueradeId && (
            <>
              <TabsContent value="whatsapp" className="space-y-6">
                <WhatsAppConfig companyId={masqueradeId} />
              </TabsContent>
              <TabsContent value="email" className="space-y-6">
                <EmailConfig companyId={masqueradeId} />
              </TabsContent>
              <TabsContent value="flows" className="space-y-6">
                <FlowManagement companyId={masqueradeId} />
              </TabsContent>
              <TabsContent value="notifications" className="space-y-6">
                <NotificationManagement companyId={masqueradeId} />
              </TabsContent>
            </>
          )}
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
