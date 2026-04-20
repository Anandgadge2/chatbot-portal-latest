"use client";

import {
  useEffect,
  useState,
  useRef,
  Suspense,
  useCallback,
  useMemo,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
import DepartmentHierarchyDialog from "@/components/department/DepartmentHierarchyDialog";
import CreateUserDialog from "@/components/user/CreateUserDialog";
import EditUserDialog from "@/components/user/EditUserDialog";
import ChangePermissionsDialog from "@/components/user/ChangePermissionsDialog";
import UserDetailsDialog from "@/components/user/UserDetailsDialog";
import { ProtectedButton } from "@/components/ui/ProtectedButton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  Permission,
  hasPermission,
  Module,
  isDepartmentAdminOrHigher,
  isCompanyAdminOrHigher,
  isSuperAdmin,
} from "@/lib/permissions";
import toast from "react-hot-toast";
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
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import GrievanceDetailDialog from "@/components/grievance/GrievanceDetailDialog";
import AppointmentDetailDialog from "@/components/appointment/AppointmentDetailDialog";
import AssignmentDialog from "@/components/assignment/AssignmentDialog";
import StatusUpdateModal from "@/components/grievance/StatusUpdateModal";
import RevertGrievanceDialog from "@/components/grievance/RevertGrievanceDialog";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { TableSkeleton } from "@/components/ui/GeneralSkeleton";
import { Pagination } from "@/components/ui/Pagination";
import AvailabilityCalendar from "@/components/availability/AvailabilityCalendar";
import SuperAdminOverview from "@/components/superadmin/SuperAdminOverview";
import WhatsAppConfigTab from "@/components/superadmin/drilldown/tabs/WhatsAppConfigTab";
import EmailConfigTab from "@/components/superadmin/drilldown/tabs/EmailConfigTab";
import ChatbotFlowsTab from "@/components/superadmin/drilldown/tabs/ChatbotFlowsTab";
import RoleManagement from "@/components/roles/RoleManagement";
import NotificationManagement from "@/components/superadmin/drilldown/NotificationManagement";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { DashboardDepartmentFilters } from "@/components/dashboard/DashboardDepartmentFilters";
import { formatTo10Digits, normalizePhoneNumber } from "@/lib/utils/phoneUtils";

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
  ChevronRight,
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
  Flame,
  ShieldAlert,
  ShieldCheck,
  LocateFixed,
  ScanSearch,
  Trees,
  MapPin,
  Settings,
  MessageSquare,
  Bot,
  BellRing,
  Workflow,
  LayoutGrid,
  Menu,
  AlertCircle,
} from "lucide-react";

interface DashboardStats {
  grievances: {
    total: number;
    registeredTotal?: number;
    pending: number;
    assigned?: number;
    inProgress: number;
    reverted: number;
    rejected: number;
    resolved: number;
    last7Days: number;
    last30Days: number;
    resolutionRate: number;
    slaBreached?: number;
    pendingOverdue?: number;
    slaComplianceRate?: number;
    avgResolutionDays?: number;
    byPriority?: Array<{ priority: string; count: number }>;
    daily: Array<{ date: string; count: number }>;
    monthly?: Array<{ month: string; count: number; resolved: number }>;
    byDepartment?: Array<{
      departmentId: string;
      total: number;
      pending: number;
    }>;
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

import dynamic from "next/dynamic";

const TacticalForestMap = dynamic(
  () => import("@/components/dashboard/TacticalForestMap"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-slate-900 animate-pulse flex items-center justify-center text-slate-500 font-black text-xs uppercase tracking-widest">
        Initialising Tactical Grid...
      </div>
    ),
  },
);

const LoadingDots = () => (
  <span className="inline-flex items-center gap-0.5 ml-1">
    <span className="w-1 h-1 bg-current rounded-full animate-bounce [animation-delay:-0.3s]"></span>
    <span className="w-1 h-1 bg-current rounded-full animate-bounce [animation-delay:-0.15s]"></span>
    <span className="w-1 h-1 bg-current rounded-full animate-bounce"></span>
  </span>
);

const COLLECTORATE_JHARSUGUDA_COMPANY_ID = "69ad4c6eb1ad8e405e6c0858";

function DashboardContent() {
  const { user: authUser, loading, logout, refreshUser } = useAuth();
  const user = authUser as any;
  const roleName = (user?.role || "").toString().toLowerCase();
  const explicitLevel =
    typeof user?.level === "number" ? (user.level as number) : undefined;
  const resolvedRoleLevel = useMemo(() => {
    if (user?.isSuperAdmin) return 0;
    if (explicitLevel !== undefined) return explicitLevel;
    if (roleName.includes("company")) return 1;
    if (roleName.includes("department") && !roleName.includes("sub")) return 2;
    if (roleName.includes("sub") && roleName.includes("department")) return 3;
    if (roleName.includes("operator")) return 4;
    return 5;
  }, [user, explicitLevel, roleName]);
  const isCompanyAdminRole = resolvedRoleLevel === 1;
  const isDepartmentAdminRole = resolvedRoleLevel === 2;
  const isSubDepartmentAdminRole = resolvedRoleLevel === 3;
  const isOperatorRole = resolvedRoleLevel >= 4;
  const isLowerHierarchyRole =
    isDepartmentAdminRole || isSubDepartmentAdminRole || isOperatorRole;
  const hasMultiDepartmentMapping =
    Array.isArray(user?.departmentIds) && user.departmentIds.length > 1;
  const isCompanyLevel = user && !user.departmentId && !user.isSuperAdmin;
  const isDepartmentLevel =
    user &&
    (!!user.departmentId ||
      (user?.departmentIds && user.departmentIds.length > 0)) &&
    !user.isSuperAdmin;
  const isSuperAdminUser = useMemo(() => isSuperAdmin(user), [user]);
  const currentUserCompanyId =
    user?.companyId && typeof user.companyId === "object"
      ? (user.companyId as any)._id
      : user?.companyId;
  const isJharsugudaCompany = Boolean(
    currentUserCompanyId === COLLECTORATE_JHARSUGUDA_COMPANY_ID,
  );
  const dashboardBrandTitle = isJharsugudaCompany ? "SAHAJ" : "Control Panel";
  const dashboardBrandSubtitle = isJharsugudaCompany
    ? "Centralised Grivences Command center"
    : "Control Panel";
  const canDeleteGrievance = useMemo(
    () => hasPermission(user, Permission.DELETE_GRIEVANCE),
    [user],
  );
  const canReopenResolvedGrievance = useMemo(() => {
    if (!hasPermission(user, Permission.ASSIGN_GRIEVANCE)) return false;
    if (!hasPermission(user, Permission.REVERT_GRIEVANCE)) return false;

    return isCompanyAdminRole || isSuperAdminUser;
  }, [user, isCompanyAdminRole, isSuperAdminUser]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyIdParam = searchParams.get("companyId");
  const isSuperAdminDrilldown = isSuperAdminUser && !!companyIdParam;
  const targetCompanyId = useMemo(
    () =>
      companyIdParam ||
      (user?.companyId && typeof user.companyId === "object"
        ? (user.companyId as any)._id
        : user?.companyId),
    [companyIdParam, user],
  );
  const isViewingCompany = useMemo(
    () => isCompanyLevel || (isSuperAdminUser && !!companyIdParam),
    [isCompanyLevel, isSuperAdminUser, companyIdParam],
  );
  const canSeeDepartmentsTab = useMemo(() => {
    if (isSuperAdminUser && companyIdParam) return true;
    if (isCompanyAdminRole || isDepartmentAdminRole) return true;
    if (isSubDepartmentAdminRole) return hasMultiDepartmentMapping;
    return false;
  }, [
    isSuperAdminUser,
    companyIdParam,
    isCompanyAdminRole,
    isDepartmentAdminRole,
    isSubDepartmentAdminRole,
    hasMultiDepartmentMapping,
  ]);
  const canSeeUsersTab = useMemo(() => {
    if (isSuperAdminUser && companyIdParam) return true;
    return (
      isCompanyAdminRole || isDepartmentAdminRole || isSubDepartmentAdminRole
    );
  }, [
    isSuperAdminUser,
    companyIdParam,
    isCompanyAdminRole,
    isDepartmentAdminRole,
    isSubDepartmentAdminRole,
  ]);

  const [mounted, setMounted] = useState(false);
  // Get initial tab from URL search params, default based on role
  const getDefaultTab = () => {
    // Priority 1: Check URL Parameters for state restoration
    const tabFromUrl = searchParams.get("tab");
    if (tabFromUrl) return tabFromUrl;

    // Priority 2: Company drilldown defaults
    if (companyIdParam) return "overview";

    // Priority 3: Role-based defaults
    if (!hasPermission(user, Permission.VIEW_ANALYTICS) && !isSuperAdminUser) {
      if (hasPermission(user, Permission.READ_GRIEVANCE)) return "grievances";
      if (hasPermission(user, Permission.READ_APPOINTMENT))
        return "appointments";
      return "overview";
    }
    return "overview";
  };
  const initialTab = getDefaultTab();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [previousTab, setPreviousTab] = useState<string>("overview");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);
  const allDepartmentsRef = useRef<Department[]>([]);
  useEffect(() => {
    allDepartmentsRef.current = allDepartments;
  }, [allDepartments]);
  const normalizedDesignations = useMemo(() => {
    const values = new Set<string>();
    const pushValue = (value: unknown) => {
      if (typeof value !== "string") return;
      const normalized = value.trim();
      if (normalized) values.add(normalized);
    };

    pushValue((user as any)?.designation);
    ((user as any)?.designations || []).forEach((value: unknown) =>
      pushValue(value),
    );

    return Array.from(values);
  }, [user]);
  const assignedDepartmentSummaries = useMemo(() => {
    const departmentMap = new Map<string, Department>();
    [...allDepartments, ...departments].forEach((dept) => {
      if (!dept?._id) return;
      departmentMap.set(String(dept._id), dept);
    });

    const primaryDepartmentId = user?.departmentId
      ? String(
          typeof user.departmentId === "object"
            ? user.departmentId._id
            : user.departmentId,
        )
      : null;

    const mappedDepartmentIds = (user?.departmentIds || [])
      .map((departmentValue: NonNullable<User["departmentIds"]>[number]) =>
        String(
          typeof departmentValue === "object"
            ? departmentValue?._id
            : departmentValue,
        ),
      )
      .filter(Boolean);

    // Use `departmentIds` as the source of all mapped departments.
    // Keep `departmentId` only as a backward-compatible primary marker/fallback.
    const allMappedDepartmentIds = Array.from(
      new Set(
        [primaryDepartmentId, ...mappedDepartmentIds].filter(
          Boolean,
        ) as string[],
      ),
    );

    return allMappedDepartmentIds.map((departmentId) => {
      const mapped = departmentMap.get(departmentId);
      return {
        id: departmentId,
        name: mapped?.name || "Unknown Unit",
        code: mapped?.departmentId || "UNIT",
        isPrimary: departmentId === primaryDepartmentId,
      };
    });
  }, [user, departments, allDepartments]);
  const [deptUserCounts, setDeptUserCounts] = useState<Record<string, number>>(
    {},
  );
  const [deptSearch, setDeptSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);

  // Profile Form States
  const [profileForm, setProfileForm] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    email: user?.email || "",
    phone: formatTo10Digits(user?.phone) || "",
    designations: normalizedDesignations.join(", "),
  });
  const [passwordForm, setPasswordForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileForm({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        phone: formatTo10Digits(user.phone) || "",
        designations: normalizedDesignations.join(", "),
      });
    }
  }, [user, normalizedDesignations]);
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingProfile(true);

    const updatePromise = (async () => {
      const payload = {
        ...profileForm,
        phone: normalizePhoneNumber(profileForm.phone),
        designations: profileForm.designations
          .split(",")
          .map((d) => d.trim())
          .filter(Boolean),
      };
      const response = await apiClient.put("/auth/profile", payload);
      if (response && response.success === false) {
        throw new Error(response.message || 'Failed to update profile');
      }
      await refreshUser();
      return response;
    })();

    toast.promise(
      updatePromise,
      {
        loading: 'Updating profile...',
        success: 'Profile Updated Successfully!',
        error: (err: any) => err.response?.data?.message || 'Failed to update profile',
      },
      {
        style: {
          borderRadius: '12px',
          background: '#0f172a',
          color: '#fff',
          fontWeight: 'bold',
          border: '1px solid #334155',
          fontSize: '14px',
          padding: '12px 24px',
        },
        success: {
          duration: 3000,
          iconTheme: {
            primary: '#10b981',
            secondary: '#fff',
          },
        },
      }
    );

    try {
      await updatePromise;
    } catch (error) {
      console.error("Profile update error:", error);
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedNewPassword = passwordForm.newPassword.trim();
    const trimmedConfirmPassword = passwordForm.confirmPassword.trim();

    if (!trimmedNewPassword || !trimmedConfirmPassword) {
      toast.error("Please enter and confirm your new password", {
        style: { borderRadius: '12px', fontWeight: 'bold' }
      });
      return;
    }

    if (trimmedNewPassword.length < 6) {
      toast.error("Password must be at least 6 characters", {
        style: { borderRadius: '12px', fontWeight: 'bold' }
      });
      return;
    }

    if (trimmedNewPassword !== trimmedConfirmPassword) {
      toast.error("Passwords do not match", {
        style: { borderRadius: '12px', fontWeight: 'bold' }
      });
      return;
    }
    
    setUpdatingPassword(true);
    
    const updatePromise = (async () => {
      const response = await apiClient.put("/auth/profile", {
        password: trimmedNewPassword,
      });
      if (response && response.success === false) {
        throw new Error(response.message || 'Failed to update security');
      }
      return response;
    })();

    toast.promise(
      updatePromise,
      {
        loading: 'Updating password...',
        success: 'Password Updated Successfully!',
        error: (err: any) => err.response?.data?.message || 'Failed to update security',
      },
      {
        style: {
          borderRadius: '12px',
          background: '#0f172a',
          color: '#fff',
          fontWeight: 'bold',
          border: '1px solid #334155',
          fontSize: '14px',
          padding: '12px 24px',
        },
        success: {
          duration: 3000,
        },
      }
    );

    try {
      const response: any = await updatePromise;
      if (response.success || response) {
        setPasswordForm({ newPassword: "", confirmPassword: "" });
      }
    } catch (error: any) {
      console.error("Password update error:", error);
    } finally {
      setUpdatingPassword(false);
    }
  };

  const [company, setCompany] = useState<Company | null>(null);
  const showDepartmentPriorityColumn =
    company?.showDepartmentPriorityColumn !== false;
  const canManageDepartmentPriority =
    isSuperAdminDrilldown ||
    (isCompanyAdminRole && company?.showDepartmentPriorityColumn !== false);
  const canToggleDepartmentPriorityColumn = isSuperAdminDrilldown;
  const isHierarchicalCompany = useMemo(() => {
    const fromStats = stats?.isHierarchicalEnabled;
    if (typeof fromStats === "boolean") return fromStats;
    return !!company?.enabledModules?.includes(Module.HIERARCHICAL_DEPARTMENTS);
  }, [stats?.isHierarchicalEnabled, company]);
  const overdueGrievancesCount = stats?.grievances.pendingOverdue || 0;
  const isDFO = useMemo(() => {
    return (
      company?.name?.toUpperCase().includes("D.F.O.") ||
      company?._id === "69adc81165109318a7cde21c" ||
      (user?.companyId &&
        (typeof user.companyId === "object"
          ? (user.companyId as any)._id
          : user.companyId) === "69adc81165109318a7cde21c")
    );
  }, [company, user]);
  const isCollectorateJharsuguda = useMemo(() => {
    const scopedCompanyId = companyIdParam || company?._id || currentUserCompanyId;
    return scopedCompanyId === COLLECTORATE_JHARSUGUDA_COMPANY_ID;
  }, [companyIdParam, company?._id, currentUserCompanyId]);
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
  const [isMobileTabMenuOpen, setIsMobileTabMenuOpen] = useState(false);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingGrievances, setLoadingGrievances] = useState(false);

  // Sync state with URL manually updated
  // Tab state is handled locally for a pure SPA experience as requested
  // URL parameters like ?tab=... have been removed.
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
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectedDepartments, setSelectedDepartments] = useState<Set<string>>(
    new Set(),
  );
  const [priorityDrafts, setPriorityDrafts] = useState<Record<string, string>>(
    {},
  );
  const [savingPriorityIds, setSavingPriorityIds] = useState<Set<string>>(
    new Set(),
  );
  const [showHierarchyDialog, setShowHierarchyDialog] = useState(false);
  const [selectedDeptForHierarchy, setSelectedDeptForHierarchy] =
    useState<Department | null>(null);
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
    limit: 20,
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
  const [deptFilters, setDeptFilters] = useState({
    type: "",
    status: "",
    mainDeptId: "",
    subDeptId: "",
  });
  const [userFilters, setUserFilters] = useState({
    role: "",
    status: "",
    mainDeptId: "",
    subDeptId: "",
  });
  const [showUserFiltersOnMobile, setShowUserFiltersOnMobile] = useState(false);
  const [showDepartmentFiltersOnMobile, setShowDepartmentFiltersOnMobile] =
    useState(false);
  const [showGrievanceFiltersOnMobile, setShowGrievanceFiltersOnMobile] =
    useState(false);
  const [showAppointmentFiltersOnMobile, setShowAppointmentFiltersOnMobile] =
    useState(false);

  const [overviewFilters, setOverviewFilters] = useState({
    mainDeptId: "",
    subDeptId: "",
  });
  const [analyticsFilters, setAnalyticsFilters] = useState({
    mainDeptId: "",
    subDeptId: "",
  });
  const [grievanceFilters, setGrievanceFilters] = useState({
    status: "",
    department: "",
    mainDeptId: "",
    subDeptId: "",
    assignmentStatus: "",
    overdueStatus: "",
    dateRange: "",
  });

  const getParentDepartmentId = useCallback((dept: any): string | null => {
    if (!dept?.parentDepartmentId) return null;
    const id =
      typeof dept.parentDepartmentId === "object"
        ? dept.parentDepartmentId._id
        : dept.parentDepartmentId;
    return id || null;
  }, []);

  // Search states
  const [grievanceSearch, setGrievanceSearch] = useState("");
  const [appointmentSearch, setAppointmentSearch] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);


  // Helper to check module access - strictly respects company config if viewing a specific company
  const hasModule = useCallback(
    (module: Module) => {
      // If we are viewing a specific company dashboard (either as Company Admin or Super Admin drilldown)
      // we MUST respect the specific company's enabled modules configuration.
      if (isViewingCompany) {
        // If company data is not loaded yet, assume basic modules to prevent layout jumps
        // This ensures the dashboard has a consistent 'Single Structure' as requested.
        if (!company) {
          return [Module.GRIEVANCE, Module.APPOINTMENT].includes(module);
        }

        const enabledModules = (company.enabledModules || []) as string[];
        return enabledModules.includes(module as string);
      }

      // Fallback for regular session view (Global SuperAdmin overview)
      if (isSuperAdminUser) return true;

      const modules = (company?.enabledModules ||
        user?.enabledModules ||
        []) as string[];
      return modules.includes(module as string);
    },
    [user, company, isViewingCompany, isSuperAdminUser],
  );

  const canShowAppointmentsInView = useMemo(() => {
    if (isSuperAdminDrilldown) return false;
    return (
      hasModule(Module.APPOINTMENT) &&
      hasPermission(user, Permission.READ_APPOINTMENT)
    );
  }, [hasModule, isSuperAdminDrilldown, user]);

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

  const navigateToGrievances = useCallback(
    (filters?: Partial<typeof grievanceFilters>) => {
      setActiveTab("grievances");
      setGrievancePage(1);
      if (filters) {
        setGrievanceFilters((prev) => ({
          ...prev,
          ...filters,
        }));
      }
    },
    [],
  );

  const openGrievanceDetail = async (grievanceId: string, initialData?: Grievance) => {
    if (initialData) {
      setSelectedGrievance(initialData);
      setShowGrievanceDetail(true);
      // Background fetch to ensure timeline and other details are fully loaded
      grievanceAPI.getById(grievanceId).then((response) => {
        if (response.success) {
          setSelectedGrievance(response.data.grievance);
        }
      });
      return;
    }

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

  const openAppointmentDetail = async (appointmentId: string, initialData?: Appointment) => {
    if (initialData) {
      setSelectedAppointment(initialData);
      setShowAppointmentDetail(true);
      // Background fetch
      appointmentAPI.getById(appointmentId).then((response) => {
        if (response.success) {
          setSelectedAppointment(response.data.appointment);
        }
      });
      return;
    }

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

  const handleDeleteGrievance = async (grievance: Grievance) => {
    if (!canDeleteGrievance) return;

    if (
      !confirm(
        `Are you sure you want to delete grievance ${grievance.grievanceId}? This action cannot be undone.`,
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await grievanceAPI.delete(grievance._id);
      if (response.success) {
        toast.success(response.message || "Grievance deleted successfully");
        setGrievances((prev) => prev.filter((item) => item._id !== grievance._id));
        setSelectedGrievance((prev) =>
          prev?._id === grievance._id ? null : prev,
        );
        setSelectedGrievances((prev) => {
          const next = new Set(prev);
          next.delete(grievance._id);
          return next;
        });
        fetchGrievances(grievancePage, true);
        fetchDashboardData(true);
      } else {
        toast.error("Failed to delete grievance");
      }
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to delete grievance",
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

  const handleBulkDeleteUsers = async () => {
    if (selectedUsers.size === 0) return;

    if (
      !confirm(
        `Are you sure you want to delete ${selectedUsers.size} user(s)? This action cannot be undone.`,
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await userAPI.deleteBulk(Array.from(selectedUsers));
      if (response.success) {
        toast.success(response.message);
        const deletedIds = Array.from(selectedUsers);
        setUsers((prev) => prev.filter((u) => !deletedIds.includes(u._id)));
        setSelectedUsers(new Set());
        fetchUsers(userPage, true);
        fetchDashboardData(true);
      } else {
        toast.error("Failed to delete users");
      }
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to delete users",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDeleteDepartments = async () => {
    if (selectedDepartments.size === 0) return;

    if (
      !confirm(
        `Are you sure you want to delete ${selectedDepartments.size} department(s)? This action cannot be undone.`,
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await departmentAPI.deleteBulk(
        Array.from(selectedDepartments),
      );
      if (response.success) {
        toast.success(response.message);
        const deletedIds = Array.from(selectedDepartments);
        setDepartments((prev) =>
          prev.filter((d) => !deletedIds.includes(d._id)),
        );
        setSelectedDepartments(new Set());
        fetchDepartments(departmentPage, true);
        fetchDashboardData(true);
      } else {
        toast.error("Failed to delete departments");
      }
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to delete departments",
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
    }
  }, [user, loading, router]);

  // Redirect away from overview if no analytics permission
  useEffect(() => {
    if (
      user &&
      !hasPermission(user, Permission.VIEW_ANALYTICS) &&
      !isSuperAdminUser &&
      activeTab === "overview"
    ) {
      const nextTab = hasPermission(user, Permission.READ_GRIEVANCE)
        ? "grievances"
        : hasPermission(user, Permission.READ_APPOINTMENT)
          ? "appointments"
          : "profile";
      setActiveTab(nextTab);
    }
  }, [user, activeTab, isSuperAdminUser]);

  useEffect(() => {
    if (!user || activeTab !== "appointments") return;

    if (!canShowAppointmentsInView) {
      const fallbackTab = hasPermission(user, Permission.READ_GRIEVANCE)
        ? "grievances"
        : hasPermission(user, Permission.VIEW_ANALYTICS) || isSuperAdminUser
          ? "overview"
          : "profile";
      setActiveTab(fallbackTab);
    }
  }, [activeTab, canShowAppointmentsInView, isSuperAdminUser, user]);

  // Handle browser back/forward navigation persistence
  useEffect(() => {
    // Skip if in SuperAdmin overview mode to avoid conflicts with SuperAdminOverview's own state
    if (isSuperAdminUser && !companyIdParam) return;

    const tabFromUrl = searchParams.get("tab");
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, isSuperAdminUser, companyIdParam]);

  // Sync tab state to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    const currentUrlTab = params.get("tab");

    if (activeTab && activeTab !== "overview" && currentUrlTab !== activeTab) {
      params.set("tab", activeTab);
      router.replace(`${window.location.pathname}?${params.toString()}`, {
        scroll: false,
      });
    } else if (activeTab === "overview" && currentUrlTab) {
      params.delete("tab");
      router.replace(`${window.location.pathname}?${params.toString()}`, {
        scroll: false,
      });
    }
  }, [activeTab, router, searchParams, isSuperAdminUser, companyIdParam]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Track previous counts for real-time notifications
  const [prevGrievanceCount, setPrevGrievanceCount] = useState<number | null>(
    null,
  );
  const [prevAppointmentCount, setPrevAppointmentCount] = useState<
    number | null
  >(null);

  const fetchPerformanceData = useCallback(async () => {
    if (isSuperAdminUser && !companyIdParam) return;
    try {
      const response = await apiClient.get(
        `/analytics/performance${companyIdParam ? "?companyId=" + companyIdParam : ""}`,
      );
      if (response.success) {
        setPerformanceData(response.data);
      }
    } catch (error: any) {
      if (error?.response?.status !== 403) {
        console.error("Failed to fetch performance data:", error);
      }
    }
  }, [companyIdParam, isSuperAdminUser]);

  const forestBeats = useMemo(() => {
    return (departments || []).map((d) => ({
      id: d._id,
      name: d.name,
      range: d.parentDepartmentId
        ? typeof d.parentDepartmentId === "object"
          ? (d.parentDepartmentId as any).name
          : "Main Range"
        : d.name,
      incidents: grievances.filter(
        (g) =>
          (typeof g.departmentId === "object"
            ? (g.departmentId as any)?._id
            : g.departmentId) === d._id,
      ).length,
      status: d.isActive ? "Active" : "Inactive",
    }));
  }, [departments, grievances]);

  const filteredDeptCounts = useMemo(() => {
    let filtered = allDepartments;
    if (deptSearch) {
      const s = deptSearch.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.name.toLowerCase().includes(s) ||
          d.departmentId?.toLowerCase().includes(s),
      );
    }
    if (deptFilters.status) {
      const isActive = deptFilters.status === "active";
      filtered = filtered.filter((d) => d.isActive === isActive);
    }
    if (deptFilters.mainDeptId) {
      filtered = filtered.filter(
        (d) =>
          d._id === deptFilters.mainDeptId ||
          getParentDepartmentId(d) === deptFilters.mainDeptId,
      );
    }
    if (deptFilters.subDeptId) {
      filtered = filtered.filter((d) => d._id === deptFilters.subDeptId);
    }
    const mainCount = filtered.filter((d) => !d.parentDepartmentId).length;
    const subCount = filtered.filter((d) => !!d.parentDepartmentId).length;
    return { mainCount, subCount };
  }, [allDepartments, deptSearch, deptFilters, getParentDepartmentId]);

  const liveIncidents = useMemo(() => {
    return grievances
      .filter((g) => g.status !== "RESOLVED")
      .slice(0, 10)
      .map((g) => ({
        id: g._id,
        title: g.description || g.category || "Incident",
        coordinate: g.location?.coordinates || [20.2721, 81.4967],
        severity: g.priority === "HIGH" ? "CRITICAL" : "MODERATE",
        time: g.createdAt,
        area: (g as any).forest_beat || "Unknown Beat",
      }));
  }, [grievances]);

  const fetchDepartmentData = useCallback(async () => {
    if (isSuperAdminUser && !companyIdParam) return;
    try {
      const deptId =
        analyticsFilters.subDeptId || analyticsFilters.mainDeptId || "";
      const params = new URLSearchParams();
      if (companyIdParam) params.append("companyId", companyIdParam);
      if (deptId) params.append("departmentId", deptId);

      const response = await apiClient.get(
        `/analytics/grievances/by-department?${params.toString()}`,
      );
      if (response.success) {
        setDepartmentData(response.data);
      }
    } catch (error: any) {
      console.error("Failed to fetch department data:", error);
    }
  }, [companyIdParam, isSuperAdminUser, analyticsFilters]);

  const fetchRoles = useCallback(async () => {
    const cid = targetCompanyId;
    if (!cid) {
      setRoles([]);
      return;
    }
    try {
      // First try fetching ONLY company-specific roles
      let response = await roleAPI.getRoles(cid, true);
      let roles = response.data.roles || [];

      // If no company roles exist (new company), fallback to all roles including system ones
      if (roles.length === 0) {
        response = await roleAPI.getRoles(cid, false);
        roles = response.data.roles || [];
      }

      if (response.success) {
        setRoles(roles);
      }
    } catch (error) {
      console.error("Failed to fetch roles:", error);
    }
  }, [targetCompanyId]);

  const fetchDashboardData = useCallback(
    async (
      refresh = false,
      overrideFilters?: { mainDeptId?: string; subDeptId?: string },
    ) => {
      if (isSuperAdminUser && !companyIdParam) return;
      if (!refresh) setLoadingStats(true);
      try {
        const currentFilters =
          overrideFilters ||
          (activeTab === "analytics" ? analyticsFilters : overviewFilters);
        const deptId =
          currentFilters?.subDeptId || currentFilters?.mainDeptId || "";

        const params = new URLSearchParams();
        if (companyIdParam) params.append("companyId", companyIdParam);
        if (deptId) params.append("departmentId", deptId);

        const response = await apiClient.get<{
          success: boolean;
          data: DashboardStats;
        }>(`/analytics/dashboard?${params.toString()}`);

        if (response.success) {
          setStats(response.data);
        }
      } catch (error: any) {
        if (error?.response?.status !== 403) {
          console.error("Failed to fetch dashboard stats:", error);
          toast.error("Failed to load dashboard statistics");
        }
      } finally {
        if (!refresh) setLoadingStats(false);
      }
    },
    [
      companyIdParam,
      isSuperAdminUser,
      activeTab,
      analyticsFilters,
      overviewFilters,
    ],
  );

  const fetchCompany = useCallback(async () => {
    if (!user) return;

    if (isSuperAdminUser && companyIdParam) {
      try {
        const response = await companyAPI.getById(companyIdParam);
        if (response.success) {
          setCompany(response.data.company);
        }
      } catch (error: any) {
        console.log("Company details not available:", error.message);
      }
      return;
    }

    if (user.isSuperAdmin) return;

    try {
      const response = await companyAPI.getMyCompany();
      if (response.success) {
        setCompany(response.data.company);
      }
    } catch (error: any) {
      // CompanyAdmin might not have company associated
      console.log("Company details not available:", error.message);
    }
  }, [user, isSuperAdminUser, companyIdParam]);

  const fetchDepartments = useCallback(
    async (page = departmentPage, isSilent = false) => {
      if (isSuperAdminUser && !companyIdParam) return;
      if (!isSilent) setLoadingDepartments(true);
      try {
        // For company admin, fetch ALL departments (no pagination limit)
        const fetchLimit =
          isCompanyLevel || (isSuperAdminUser && companyIdParam)
            ? 200
            : departmentPagination.limit;
        const response = await departmentAPI.getAll({
          page: page,
          limit: departmentPagination.limit,
          search: (deptSearch || "").trim(),
          type: deptFilters.type || undefined,
          status: deptFilters.status || undefined,
          mainDeptId: deptFilters.mainDeptId || undefined,
          subDeptId: deptFilters.subDeptId || undefined,
          companyId:
            isSuperAdminUser && companyIdParam ? companyIdParam : undefined,
        });
        if (response.success) {
          let filteredDepartments = response.data.departments;

          // For scoped roles, show only mapped departments and child sub-departments.
          if (
            isDepartmentLevel &&
            (user?.departmentId ||
              (user?.departmentIds && user.departmentIds.length > 0))
          ) {
            const mappedIds = new Set<string>();
            const pushId = (value: any) => {
              if (!value) return;
              const normalized =
                typeof value === "object" && value !== null
                  ? value._id || value.toString?.()
                  : value;
              if (normalized) mappedIds.add(String(normalized));
            };
            pushId(user.departmentId);
            (user.departmentIds || []).forEach((d: any) => pushId(d));

            filteredDepartments = filteredDepartments.filter(
              (dept: Department) => {
                const deptId = String(dept._id);
                const parentId = getParentDepartmentId(dept);
                return (
                  mappedIds.has(deptId) ||
                  (parentId ? mappedIds.has(String(parentId)) : false)
                );
              },
            );
          }

          setDepartments(filteredDepartments);
          setDepartmentPagination((prev) => ({
            ...prev,
            total: response.data.pagination.total,
            pages: response.data.pagination.pages,
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
      deptSearch,
      deptFilters,
      isSuperAdminUser,
      isCompanyLevel,
      isDepartmentLevel,
      user,
      companyIdParam,
      getParentDepartmentId,
    ],
  );

  const fetchAllDepartments = useCallback(async () => {
    if (isSuperAdminUser && !companyIdParam) return;
    try {
      const response = await departmentAPI.getAll({
        listAll: true,

        page: 1,
        limit: 200,
        companyId:
          isSuperAdminUser && companyIdParam ? companyIdParam : undefined,
      });
      if (response.success) {
        setAllDepartments(response.data.departments);
      }
    } catch (error) {
      console.error("Failed to fetch all departments:", error);
    }
  }, [isSuperAdminUser, companyIdParam]);

  const handleSaveDepartmentPriority = useCallback(
    async (dept: Department) => {
      if (!canManageDepartmentPriority) {
        toast.error("Only Company Admin can update department priority");
        return;
      }
      if (dept.parentDepartmentId) {
        toast.error("Priority can only be updated for main departments");
        return;
      }
      const rawValue = priorityDrafts[dept._id] ?? String(dept.displayOrder ?? 999);
      const parsed = Number(rawValue);

      if (!Number.isFinite(parsed) || parsed < 0) {
        toast.error("Priority must be a non-negative number");
        return;
      }

      const nextValue = Math.floor(parsed);
      const currentValue =
        typeof dept.displayOrder === "number" ? dept.displayOrder : 999;

      if (nextValue === currentValue) {
        toast("Priority already set");
        return;
      }

      setSavingPriorityIds((prev) => new Set(prev).add(dept._id));
      try {
        const response = await departmentAPI.update(dept._id, {
          displayOrder: nextValue,
        });
        if (response.success) {
          toast.success(`Priority updated for ${dept.name}`);
          setPriorityDrafts((prev) => ({
            ...prev,
            [dept._id]: String(nextValue),
          }));
          fetchDepartments(departmentPage, true);
          fetchAllDepartments();
        } else {
          toast.error("Failed to update priority");
        }
      } catch (error: any) {
        toast.error(error?.message || "Failed to update priority");
      } finally {
        setSavingPriorityIds((prev) => {
          const next = new Set(prev);
          next.delete(dept._id);
          return next;
        });
      }
    },
    [
      canManageDepartmentPriority,
      priorityDrafts,
      fetchDepartments,
      departmentPage,
      fetchAllDepartments,
    ],
  );

  const handleToggleDepartmentPriorityColumn = useCallback(
    async (checked: boolean) => {
      if (!isSuperAdminDrilldown || !companyIdParam) {
        toast.error("Only superadmin can change priority column visibility");
        return;
      }

      try {
        const response = await companyAPI.update(companyIdParam, {
          showDepartmentPriorityColumn: checked,
        });

        if (!response.success) {
          toast.error("Failed to update priority column visibility");
          return;
        }

        setCompany((prev) =>
          prev
            ? {
                ...prev,
                showDepartmentPriorityColumn: checked,
              }
            : prev,
        );
        toast.success(
          checked
            ? "Priority column enabled for company admin"
            : "Priority column hidden from company admin",
        );
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message ||
            error?.message ||
            "Failed to update priority column visibility",
        );
      }
    },
    [companyIdParam, isSuperAdminDrilldown],
  );

  const fetchUsers = useCallback(
    async (page = userPage, isSilent = false) => {
      if (isSuperAdminUser && !companyIdParam) return;
      if (!isSilent) setLoadingUsers(true);
      try {
        const selectedDepartmentId = userFilters.subDeptId
          ? userFilters.subDeptId
          : userFilters.mainDeptId
            ? [
                userFilters.mainDeptId,
                ...allDepartmentsRef.current
                  .filter(
                    (d) => getParentDepartmentId(d) === userFilters.mainDeptId,
                  )
                  .map((d) => d._id),
              ].join(",")
            : undefined;

        // If it's a custom role ID, pass the ID directly.
        // Backend now handles both system role strings and customRoleId ObjectIds.
        const serverRoleFilter = userFilters.role.startsWith("CUSTOM:")
          ? userFilters.role.split(":")[1]
          : userFilters.role || undefined;

        const response = await userAPI.getAll({
          page,
          limit: userPagination.limit,
          search: (userSearch || "").trim(),
          role: serverRoleFilter,
          status: (userFilters.status as "active" | "inactive") || undefined,
          departmentId: selectedDepartmentId,
          companyId:
            isSuperAdminUser && companyIdParam ? companyIdParam : undefined,
        });
        if (response.success) {
          setUsers(response.data.users);
          setUserPagination((prev) => ({
            ...prev,
            total: response.data.pagination.total,
            pages: response.data.pagination.pages,
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
      userSearch,
      userFilters,
      getParentDepartmentId,
      isSuperAdminUser,
      companyIdParam,
    ],
  );

  const fetchGrievances = useCallback(
    async (page = grievancePage, isSilent = false) => {
      if (isSuperAdminUser && !companyIdParam) return;
      if (
        !hasModule(Module.GRIEVANCE) ||
        !hasPermission(user, Permission.READ_GRIEVANCE)
      ) {
        return;
      }

      if (!isSilent) setLoadingGrievances(true);
      try {
        const response = await grievanceAPI.getAll({
          page,
          limit: grievancePagination.limit,
          status: grievanceFilters.status || undefined,
          search: (grievanceSearch || "").trim(),
          departmentId:
            grievanceFilters.subDeptId ||
            grievanceFilters.mainDeptId ||
            grievanceFilters.department ||
            undefined,
          assignedTo:
            grievanceFilters.assignmentStatus === "assigned"
              ? "ANY"
              : grievanceFilters.assignmentStatus === "unassigned"
                ? "NONE"
                : undefined,
          companyId:
            isSuperAdminUser && companyIdParam ? companyIdParam : undefined,
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
    [
      grievancePage,
      grievancePagination.limit,
      user,
      hasModule,
      grievanceFilters,
      grievanceSearch,
      isSuperAdminUser,
      companyIdParam,
    ],
  );

  const fetchAppointments = useCallback(
    async (page = appointmentPage, isSilent = false) => {
      if (isSuperAdminUser && !companyIdParam) return;
      if (!canShowAppointmentsInView) {
        return;
      }

      if (!isSilent) setLoadingAppointments(true);
      try {
        const response = await appointmentAPI.getAll({
          page,
          limit: appointmentPagination.limit,
          search: (appointmentSearch || "").trim(),
          companyId:
            isSuperAdminUser && companyIdParam ? companyIdParam : undefined,
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
    [
      appointmentPage,
      appointmentPagination.limit,
      appointmentSearch,
      canShowAppointmentsInView,
      isSuperAdminUser,
      companyIdParam,
    ],
  );

  const fetchLeads = useCallback(async () => {
    if (!targetCompanyId) return;
    setLoadingLeads(true);
    try {
      const response = await leadAPI.getAll({ companyId: targetCompanyId });
      if (response.success) {
        setLeads(response.data);
      }
    } catch (error: any) {
      if (error.response?.status !== 403) {
        console.error("Failed to fetch leads:", error);
        toast.error("Failed to load leads");
      }
    } finally {
      setLoadingLeads(false);
    }
  }, [targetCompanyId]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (activeTab === "overview") {
        await fetchDashboardData();
      } else if (activeTab === "analytics") {
        await Promise.all([fetchDashboardData()]);
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
    fetchGrievances,
    grievancePage,
    fetchAppointments,
    appointmentPage,
    fetchDepartments,
    fetchUsers,
    userPage,
    fetchLeads,
  ]);

  // 🚀 Performance Optimization: Unified Initial Data Fetch
  useEffect(() => {
    if (!mounted || !user) return;
    if (isSuperAdminUser && !companyIdParam) return;

    const fetchInitialData = async () => {
      const initialPromises: Promise<any>[] = [
        fetchCompany(),
        fetchRoles(),
        fetchAllDepartments(),
      ];

      // Parallelize dashboard stats if on relevant tabs
      if (activeTab === "overview" || activeTab === "analytics") {
        if (
          isSuperAdminUser ||
          hasPermission(user, Permission.VIEW_ANALYTICS)
        ) {
          initialPromises.push(fetchDashboardData());
        }
      }

      await Promise.all(initialPromises);
    };

    fetchInitialData();
  }, [
    mounted,
    user,
    companyIdParam,
    activeTab,
    fetchCompany,
    fetchRoles,
    fetchAllDepartments,
    fetchDashboardData,
    isSuperAdminUser,
    overviewFilters,
    analyticsFilters,
  ]);

  // 3. Global Synchronization Listener
  useEffect(() => {
    const handleGlobalRefresh = (e?: any) => {
      const scope = e?.detail?.scope;
      const isAll = !scope || scope === "ALL";
      const scopes = Array.isArray(scope) ? scope : [scope];

      if (isAll || scopes.includes("DASHBOARD")) fetchDashboardData(true);
      if (isAll || scopes.includes("GRIEVANCES"))
        fetchGrievances(grievancePage, true);
      if (isAll || scopes.includes("APPOINTMENTS"))
        fetchAppointments(appointmentPage, true);
      if (isAll || scopes.includes("DEPARTMENTS")) {
        fetchDepartments(departmentPage, true);
        fetchAllDepartments(); // Update hierarchy data
      }
      if (isAll || scopes.includes("USERS")) fetchUsers(userPage, true);
      if (isAll || scopes.includes("LEADS")) {
        if (isSuperAdminUser || hasModule(Module.LEAD_CAPTURE)) {
          fetchLeads();
        }
      }
    };

    window.addEventListener("REFRESH_PORTAL_DATA", handleGlobalRefresh);
    return () =>
      window.removeEventListener("REFRESH_PORTAL_DATA", handleGlobalRefresh);
  }, [
    fetchDashboardData,
    fetchGrievances,
    grievancePage,
    fetchAppointments,
    appointmentPage,
    fetchDepartments,
    departmentPage,
    fetchAllDepartments,
    fetchUsers,
    userPage,
    fetchLeads,
    isSuperAdminUser,
    hasModule,
  ]);

  // 2. Specialized effects for each paginated module (Gated by activeTab for SPA performance)
  useEffect(() => {
    if (isSuperAdminUser && !companyIdParam) return;

    if (activeTab === "analytics" && mounted && user) {
      fetchDepartmentData();
    }
  }, [
    activeTab,
    mounted,
    user,
    fetchDepartmentData,
    isSuperAdminUser,
    companyIdParam,
    analyticsFilters,
  ]);

  useEffect(() => {
    if (isSuperAdminUser && !companyIdParam) return;

    const shouldFetch =
      activeTab === "departments" ||
      (activeTab === "overview" && isDepartmentLevel);
    if (
      shouldFetch &&
      mounted &&
      user &&
      (isSuperAdminUser ||
        hasPermission(user, Permission.READ_DEPARTMENT) ||
        isDepartmentLevel)
    ) {
      fetchDepartments(departmentPage);
    }
  }, [
    activeTab,
    mounted,
    user,
    departmentPage,
    departmentPagination.limit,
    fetchDepartments,
    isSuperAdminUser,
    isDepartmentLevel,
    companyIdParam,
    deptFilters,
    deptSearch,
  ]);

  useEffect(() => {
    if (isSuperAdminUser && !companyIdParam) return;

    if (
      activeTab === "users" &&
      mounted &&
      user &&
      (isSuperAdminUser || hasPermission(user, Permission.READ_USER))
    ) {
      fetchUsers(userPage);
    }
  }, [
    activeTab,
    mounted,
    user,
    userPage,
    fetchUsers,
    isSuperAdminUser,
    companyIdParam,
    userFilters,
    userSearch,
  ]);

  useEffect(() => {
    if (isSuperAdminUser && !companyIdParam) return;

    if (
      activeTab === "grievances" &&
      mounted &&
      user &&
      (isSuperAdminUser ||
        (hasModule(Module.GRIEVANCE) &&
          hasPermission(user, Permission.READ_GRIEVANCE)))
    ) {
      fetchGrievances(grievancePage);
    }
  }, [
    activeTab,
    mounted,
    user,
    grievancePage,
    fetchGrievances,
    hasModule,
    isSuperAdminUser,
    companyIdParam,
    grievanceFilters,
    grievanceSearch,
  ]);

  useEffect(() => {
    if (isSuperAdminUser && !companyIdParam) return;

    if (
      activeTab === "appointments" &&
      mounted &&
      user &&
      canShowAppointmentsInView
    ) {
      fetchAppointments(appointmentPage);
    }
  }, [
    activeTab,
    mounted,
    user,
    appointmentPage,
    canShowAppointmentsInView,
    fetchAppointments,
    companyIdParam,
    isSuperAdminUser,
  ]);

  useEffect(() => {
    if (isSuperAdminUser && !companyIdParam) return;

    if (
      activeTab === "leads" &&
      mounted &&
      user &&
      hasModule(Module.LEAD_CAPTURE)
    ) {
      fetchLeads();
    }
  }, [
    activeTab,
    mounted,
    user,
    fetchLeads,
    hasModule,
    isSuperAdminUser,
    companyIdParam,
  ]);

  // 3. Polling isolated from initial load triggers
  useEffect(() => {
    // Skip polling if in SuperAdmin overview mode
    if (isSuperAdminUser && !companyIdParam) return;

    if (mounted && user) {
      const pollInterval = setInterval(async () => {
        // 🛡️ Guard against execution after unmount
        if (!mounted) return;

        try {
          // Perform silent, background refreshes of the current active views
          if (
            isSuperAdminUser ||
            (hasModule(Module.GRIEVANCE) &&
              hasPermission(user, Permission.READ_GRIEVANCE))
          ) {
            fetchGrievances(grievancePage, true);
          }

          if (canShowAppointmentsInView) {
            fetchAppointments(appointmentPage, true);
          }

          // Also keep KPI stats fresh
          fetchDashboardData(true);
        } catch (error: any) {
          // 🤫 Background polling errors should be silent
          if (
            error.code === "ERR_NETWORK" ||
            error.message === "Network Error"
          ) {
            return;
          }
          console.error("High-sync polling error:", error);
        }
      }, 15000); // 15 seconds for a near-instant feel without overloading the server

      return () => clearInterval(pollInterval);
    }
  }, [
    mounted,
    user,
    grievancePage,
    appointmentPage,
    canShowAppointmentsInView,
    fetchGrievances,
    fetchAppointments,
    fetchDashboardData,
    hasModule,
    companyIdParam,
    isSuperAdminUser,
  ]);

  useEffect(() => {
    if (mounted && user && activeTab === "analytics") {
      fetchPerformanceData();
      fetchDepartmentData();
    }
  }, [mounted, user, activeTab, fetchPerformanceData, fetchDepartmentData]);

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

    // For lower level users (Operators, Sub-Department etc.), only show items assigned to them
    if (user && !isDepartmentAdminOrHigher(user) && user.id) {
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
          const dept = allDepartments.find((d) => d._id === deptId);
          return (
            deptId === grievanceFilters.mainDeptId ||
            getParentDepartmentId(dept) === grievanceFilters.mainDeptId
          );
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
            (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60),
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
              (now.getTime() - assignedDate.getTime()) / (1000 * 60 * 60),
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
      // Search filter - Instant, case-insensitive, whitespace-resilient
      if (grievanceSearch.trim()) {
        const searchTerms = grievanceSearch
          .toLowerCase()
          .trim()
          .split(/\s+/)
          .filter(Boolean);
        filteredData = filteredData.filter((g: Grievance) => {
          const searchContent = [
            g.grievanceId,
            g.citizenName,
            g.citizenPhone,
            g.category,
            g.description,
            typeof g.assignedTo === "object"
              ? `${(g.assignedTo as any).firstName} ${(g.assignedTo as any).lastName}`
              : g.assignedTo,
            typeof g.assignedTo === "object" ? (g.assignedTo as any).email : "",
          ]
            .join(" ")
            .toLowerCase();

          return searchTerms.every((term) => searchContent.includes(term));
        });
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
      // Search filter - Instant, case-insensitive, whitespace-resilient
      if (appointmentSearch.trim()) {
        const searchTerms = appointmentSearch
          .toLowerCase()
          .trim()
          .split(/\s+/)
          .filter(Boolean);
        filteredData = filteredData.filter((a: Appointment) => {
          const searchContent = [
            a.appointmentId,
            a.citizenName,
            a.citizenPhone,
            a.purpose,
            typeof a.assignedTo === "object"
              ? `${(a.assignedTo as any).firstName} ${(a.assignedTo as any).lastName}`
              : a.assignedTo,
            typeof a.assignedTo === "object" ? (a.assignedTo as any).email : "",
          ]
            .join(" ")
            .toLowerCase();

          return searchTerms.every((term) => searchContent.includes(term));
        });
      }
    }

    // Apply department filters
    if (tab === "departments") {
      // Type filter
      if (deptFilters.type) {
        filteredData = filteredData.filter((d: Department) =>
          deptFilters.type === "main"
            ? !d.parentDepartmentId
            : !!d.parentDepartmentId,
        );
      }
      // Status filter
      if (deptFilters.status) {
        filteredData = filteredData.filter((d: Department) =>
          deptFilters.status === "active" ? d.isActive : !d.isActive,
        );
      }
      // Search filter - Instant, case-insensitive, whitespace-resilient
      if (deptSearch.trim()) {
        const searchTerms = deptSearch
          .toLowerCase()
          .trim()
          .split(/\s+/)
          .filter(Boolean);
        filteredData = filteredData.filter((d: Department) => {
          const searchContent = [
            d.name,
            d.departmentId,
            d.head,
            d.contactPerson,
            (d as any).headName,
          ]
            .join(" ")
            .toLowerCase();

          return searchTerms.every((term) => searchContent.includes(term));
        });
      }
      // Main Department filter (show main + its subs)
      if (deptFilters.mainDeptId) {
        filteredData = filteredData.filter(
          (d: Department) =>
            String(d._id) === String(deptFilters.mainDeptId) ||
            String(getParentDepartmentId(d)) === String(deptFilters.mainDeptId),
        );
      }
      // Specific Sub Department filter
      if (deptFilters.subDeptId) {
        filteredData = filteredData.filter(
          (d: Department) => String(d._id) === String(deptFilters.subDeptId),
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
              u.customRoleId && typeof u.customRoleId === "object"
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
          userFilters.status === "active" ? u.isActive : !u.isActive,
        );
      }
      // Main Department filter
      if (userFilters.mainDeptId) {
        filteredData = filteredData.filter((u: User) => {
          const userDepts = [
            typeof u.departmentId === "object" && u.departmentId
              ? (u.departmentId as any)._id
              : u.departmentId,
            ...(u.departmentIds || []).map((d) =>
              typeof d === "object" && d ? (d as any)._id : d,
            ),
          ]
            .filter(Boolean)
            .map((id) => String(id));

          return userDepts.some((deptId) => {
            const dept = allDepartments.find(
              (d) => String(d._id) === String(deptId),
            );
            return (
              String(deptId) === String(userFilters.mainDeptId) ||
              String(getParentDepartmentId(dept)) ===
                String(userFilters.mainDeptId)
            );
          });
        });
      }
      // Sub Department filter
      if (userFilters.subDeptId) {
        filteredData = filteredData.filter((u: User) => {
          const userDepts = [
            typeof u.departmentId === "object" && u.departmentId
              ? (u.departmentId as any)._id
              : u.departmentId,
            ...(u.departmentIds || []).map((d) =>
              typeof d === "object" && d ? (d as any)._id : d,
            ),
          ]
            .filter(Boolean)
            .map((id) => String(id));

          return userDepts.includes(String(userFilters.subDeptId));
        });
      }
      // Search filter - Instant, case-insensitive, whitespace-resilient
      if (userSearch.trim()) {
        const searchTerms = userSearch
          .toLowerCase()
          .trim()
          .split(/\s+/)
          .filter(Boolean);
        filteredData = filteredData.filter((u: User) => {
          const searchContent = [
            u.firstName,
            u.lastName,
            u.email,
            u.phone,
            u.designation,
            ...((u as any).designations || []),
          ]
            .join(" ")
            .toLowerCase();

          return searchTerms.every((term) => searchContent.includes(term));
        });
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

    // Optimistic Update
    setUsers((prev) =>
      prev.map((u) =>
        u._id === userId ? { ...u, isActive: !currentStatus } : u,
      ),
    );

    try {
      const response = await userAPI.update(userId, {
        isActive: !currentStatus,
      } as any);
      if (response.success) {
        toast.success(
          `User ${!currentStatus ? "activated" : "deactivated"} successfully`,
        );
        // Refresh purely for data integrity, silently
        fetchUsers(userPage, true);
      } else {
        // Rollback on failure
        setUsers((prev) =>
          prev.map((u) =>
            u._id === userId ? { ...u, isActive: currentStatus } : u,
          ),
        );
      }
    } catch (error: any) {
      // Rollback on error
      setUsers((prev) =>
        prev.map((u) =>
          u._id === userId ? { ...u, isActive: currentStatus } : u,
        ),
      );
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to update user status";
      toast.error(errorMessage);
    }
  };

  const allowedTabs = useMemo(() => {
    if (isSuperAdminUser && companyIdParam) {
      return new Set([
        "overview",
        "analytics",
        "grievances",
        "appointments",
        "departments",
        "users",
        "roles",
        "leads",
        "whatsapp",
        "flows",
        "notifications",
        "email",
        "profile",
      ]);
    }
    if (isCompanyAdminRole) {
      return new Set([
        "overview",
        "analytics",
        "grievances",
        "appointments",
        "departments",
        "users",
        "profile",
      ]);
    }
    if (isDepartmentAdminRole) {
      return new Set([
        "overview",
        "analytics",
        "grievances",
        "departments",
        "users",
        "profile",
      ]);
    }
    if (isSubDepartmentAdminRole) {
      return new Set(
        hasMultiDepartmentMapping
          ? [
              "overview",
              "analytics",
              "grievances",
              "departments",
              "users",
              "profile",
            ]
          : ["overview", "analytics", "grievances", "users", "profile"],
      );
    }
    if (isOperatorRole) {
      return new Set(["overview", "grievances", "profile"]);
    }
    return new Set(["overview", "profile"]);
  }, [
    isSuperAdminUser,
    companyIdParam,
    isCompanyAdminRole,
    isDepartmentAdminRole,
    isSubDepartmentAdminRole,
    hasMultiDepartmentMapping,
    isOperatorRole,
  ]);

  useEffect(() => {
    if (activeTab && !allowedTabs.has(activeTab)) {
      setActiveTab("overview");
    }
  }, [activeTab, allowedTabs]);

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <LoadingSpinner text="Initializing Dashboard..." />
      </div>
    );
  }

  if (isSuperAdminUser && !companyIdParam) {
    return <SuperAdminOverview />;
  }

  if (!user) {
    return null;
  }

  const activeUserFilterCount = [
    userFilters.role,
    userFilters.status,
    userFilters.mainDeptId,
    userFilters.subDeptId,
  ].filter(Boolean).length;

  const handleTabChange = (value: string) => {
    if (!allowedTabs.has(value)) {
      return;
    }
    if (activeTab !== value) {
      setPreviousTab(activeTab);

      if (activeTab === "reverted") {
        setGrievanceFilters((prev) => ({ ...prev, status: "" }));
      }
      if (value === "reverted") {
        setGrievanceFilters((prev) => ({
          ...prev,
          status: "REVERTED",
        }));
      }
      if (activeTab === "overview" && value === "grievances") {
        setGrievanceFilters((prev) => ({ ...prev, status: "" }));
      }

      setActiveTab(value);
    }
    setIsMobileTabMenuOpen(false);
  };

  return (
    <div key="final-dashboard-root-v4" className="min-h-screen bg-white">
      {/* Premium Admin Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50 transition-all duration-300 shadow-2xl overflow-hidden">
        {/* Removed blue pattern backdrop */}

        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 relative z-10">
          <div className="flex items-center justify-between min-h-[3.5rem] py-1.5 sm:h-20">
            <div className="flex items-center gap-10 min-w-0 flex-1">
              <div className="flex items-center gap-5 sm:gap-8 group">
                <button
                  type="button"
                  onClick={() => setIsMobileTabMenuOpen(true)}
                  className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20 border border-slate-200 active:scale-95 transition-transform duration-300 md:hidden overflow-hidden"
                  title="Open sidebar"
                >
                  <Image
                    src="/assets/sahaj.png"
                    alt="Sahaj Logo"
                    width={40}
                    height={40}
                    className="object-contain"
                  />
                </button>
                <div className="hidden md:flex w-10 h-10 bg-white rounded-xl items-center justify-center shadow-lg shadow-indigo-900/20 border border-slate-200 group-hover:scale-105 transition-transform duration-300 overflow-hidden">
                  <Image
                    src="/assets/sahaj.png"
                    alt="Sahaj Logo"
                    width={40}
                    height={40}
                    className="object-contain"
                  />
                </div>
                <div className="flex flex-col">
                  <h1 className="text-[12px] sm:text-sm font-black text-white tracking-tight leading-tight uppercase max-w-[45vw] sm:max-w-none whitespace-normal break-words">
                    {isSuperAdminUser && companyIdParam ? (
                      `Viewing: ${company?.name || "..."}`
                    ) : (
                      <>
                        {isCompanyLevel &&
                          (isJharsugudaCompany
                            ? dashboardBrandTitle
                            : company?.name || "...")}
                        {isDepartmentLevel &&
                          (isJharsugudaCompany ? dashboardBrandTitle : "Department")}
                        {!hasPermission(user, Permission.READ_GRIEVANCE) &&
                          !isSuperAdminUser &&
                          "Operations Center"}
                        {hasPermission(user, Permission.READ_GRIEVANCE) &&
                          !isCompanyLevel &&
                          !isSuperAdminUser &&
                          ""}
                      </>
                    )}
                  </h1>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-[0.14em] max-w-[50vw] sm:max-w-none whitespace-normal break-words">
                      {isJharsugudaCompany
                        ? dashboardBrandSubtitle
                        : "Control Panel"}
                    </p>
                    <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span>
                  </div>
                </div>
              </div>

              <div className="h-8 w-px bg-slate-800 hidden lg:block"></div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
              <div className="hidden sm:flex flex-col items-end mr-3 sm:mr-4 lg:mr-0">
                <span className="hidden sm:block text-[10px] font-black text-white leading-none uppercase tracking-tight">
                  {user.firstName} {user.lastName}
                </span>
                {isJharsugudaCompany ? (
                  <span className="text-[10px] sm:text-[11px] font-black text-white uppercase tracking-wide mt-1 max-w-[220px] break-words text-right">
                    {(user.role || "CUSTOM").replace(/_/g, " ")}
                  </span>
                ) : (
                  <span className="text-[9px] font-black text-white/90 uppercase mt-1 bg-white/10 px-1.5 py-0.5 rounded border border-white/20 shadow-sm">
                    {(user.role || "CUSTOM").replace("_", " ")}
                    {user?.companyId?.name && ` (${user.companyId.name})`}
                  </span>
                )}
              </div>

              <div className="w-px h-6 bg-slate-800 hidden lg:block mr-2"></div>

              {isSuperAdminUser && companyIdParam && (
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl border border-slate-700 transition-all duration-300 text-xs font-bold uppercase tracking-wide shadow-xl"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Master Admin
                </Link>
              )}
              <div className="flex items-center gap-2 sm:gap-3">
                <Button
                  onClick={handleRefresh}
                  variant="ghost"
                  disabled={refreshing}
                  className="h-9 w-9 sm:h-10 sm:w-10 p-0 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-all duration-300 border border-transparent hover:border-indigo-500/20 md:hidden flex items-center justify-center"
                  title="Refresh data"
                >
                  <RefreshCw
                    className={cn("w-4.5 h-4.5 sm:w-5 sm:h-5", refreshing && "animate-spin")}
                  />
                </Button>
                <Button
                  onClick={logout}
                  variant="ghost"
                  className="h-9 w-9 sm:h-10 sm:w-10 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all duration-300 border border-transparent hover:border-rose-500/20 flex items-center justify-center"
                  title="Logout Account"
                >
                  <Power className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                </Button>
                {/* Profile Button - Optimized for Visibility */}
                <button
                  onClick={() => handleTabChange("profile")}
                  className="flex h-9 w-9 sm:h-10 sm:w-10 bg-white/20 rounded-xl items-center justify-center border border-white/50 shadow-[0_0_15px_rgba(255,255,255,0.1)] group hover:bg-white/30 transition-all duration-300 active:scale-95"
                  title="Profile"
                >
                  <UserIcon className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-white group-hover:scale-110 transition-transform duration-300" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content wrapper */}
      <main className="max-w-[1600px] mx-auto px-4 lg:px-6 py-2 sm:py-4">
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="space-y-3 sm:space-y-6"
        >
          <div className="flex gap-4">
            <aside className="hidden md:block sticky top-[84px] self-start z-30">
              <div className="group w-[72px] hover:w-[260px] transition-all duration-300 ease-out rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-sm shadow-sm overflow-hidden">
                <div className="p-2 border-b border-slate-100">
                  <Button
                    onClick={handleRefresh}
                    variant="ghost"
                    size="sm"
                    disabled={refreshing}
                    className="w-full justify-center group-hover:justify-start h-10 px-0 group-hover:px-4 rounded-xl text-slate-500 hover:text-slate-900 font-black text-[10px] uppercase tracking-widest transition-all"
                  >
                    <RefreshCw
                      className={cn(
                        "w-4 h-4 shrink-0",
                        refreshing && "animate-spin",
                      )}
                    />
                    <span className="w-0 group-hover:w-auto overflow-hidden group-hover:ml-3 opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap">
                      Refresh Data
                    </span>
                  </Button>
                </div>
                <TabsList className="h-auto bg-transparent p-2 flex flex-col gap-1">
                  {(isSuperAdminUser ||
                    hasPermission(user, Permission.VIEW_ANALYTICS)) && (
                    <TabsTrigger
                      value="overview"
                      className="w-full justify-center group-hover:justify-start h-10 px-0 group-hover:px-4 rounded-xl data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all duration-200"
                    >
                      <LayoutGrid className="w-4 h-4 shrink-0" />
                      <span className="w-0 group-hover:w-auto overflow-hidden group-hover:ml-3 text-xs font-bold uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap">
                        Overview
                      </span>
                    </TabsTrigger>
                  )}
                  {(!isSuperAdminUser ||
                    (isSuperAdminUser && companyIdParam)) && (
                    <TabsTrigger
                      value="analytics"
                      className="w-full justify-center group-hover:justify-start h-10 px-0 group-hover:px-4 rounded-xl data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all duration-200"
                    >
                      <TrendingUp className="w-4 h-4 shrink-0" />
                      <span className="w-0 group-hover:w-auto overflow-hidden group-hover:ml-3 text-xs font-bold uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap">
                        {isDFO ? "Command Center" : "Analytics"}
                      </span>
                    </TabsTrigger>
                  )}
                  {hasPermission(user, Permission.READ_GRIEVANCE) && (
                    <TabsTrigger
                      value="grievances"
                      className="w-full justify-center group-hover:justify-start h-10 px-0 group-hover:px-4 rounded-xl data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all duration-200"
                    >
                      <FileText className="w-4 h-4 shrink-0" />
                      <span className="w-0 group-hover:w-auto overflow-hidden group-hover:ml-3 text-xs font-bold uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap">
                        {isDFO ? "Incidents" : "Grievances"}
                      </span>
                    </TabsTrigger>
                  )}
                  {(isCompanyAdminRole ||
                    (isSuperAdminUser && companyIdParam)) &&
                    canShowAppointmentsInView && (
                      <TabsTrigger
                        value="appointments"
                        className="w-full justify-center group-hover:justify-start h-10 px-0 group-hover:px-4 rounded-xl data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all duration-200"
                      >
                        <CalendarCheck className="w-4 h-4 shrink-0" />
                        <span className="w-0 group-hover:w-auto overflow-hidden group-hover:ml-3 text-xs font-bold uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap">
                          Appointments
                        </span>
                      </TabsTrigger>
                    )}
                  {canSeeDepartmentsTab && (
                    <TabsTrigger
                      value="departments"
                      className="w-full justify-center group-hover:justify-start h-10 px-0 group-hover:px-4 rounded-xl data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all duration-200"
                    >
                      <Building className="w-4 h-4 shrink-0" />
                      <span className="w-0 group-hover:w-auto overflow-hidden group-hover:ml-3 text-xs font-bold uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap">
                        {isDFO ? "Patrol Units" : "Departments"}
                      </span>
                    </TabsTrigger>
                  )}
                  {isDFO && (
                    <>
                      <TabsTrigger
                        value="live-incidents"
                        className="w-full justify-start h-10 rounded-xl data-[state=active]:bg-rose-600 data-[state=active]:text-white"
                      >
                        <LocateFixed className="w-4 h-4 shrink-0" />
                        <span className="ml-3 text-[11px] font-black uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                          Tactical Map
                        </span>
                      </TabsTrigger>
                      <TabsTrigger
                        value="geofences"
                        className="w-full justify-start h-10 rounded-xl data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
                      >
                        <Layers className="w-4 h-4 shrink-0" />
                        <span className="ml-3 text-[11px] font-black uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                          Boundaries
                        </span>
                      </TabsTrigger>
                    </>
                  )}
                  {canSeeUsersTab && (
                    <TabsTrigger
                      value="users"
                      className="w-full justify-center group-hover:justify-start h-10 px-0 group-hover:px-4 rounded-xl data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all duration-200"
                    >
                      <Users className="w-4 h-4 shrink-0" />
                      <span className="w-0 group-hover:w-auto overflow-hidden group-hover:ml-3 text-xs font-bold uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap">
                        Users
                      </span>
                    </TabsTrigger>
                  )}
                  {isSuperAdminUser && companyIdParam && (
                    <TabsTrigger
                      value="roles"
                      className="w-full justify-center group-hover:justify-start h-10 px-0 group-hover:px-4 rounded-xl data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all duration-200"
                    >
                      <Shield className="w-4 h-4 shrink-0" />
                      <span className="w-0 group-hover:w-auto overflow-hidden group-hover:ml-3 text-xs font-bold uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap">
                        Roles
                      </span>
                    </TabsTrigger>
                  )}
                  {hasModule(Module.LEAD_CAPTURE) && isViewingCompany && (
                    <TabsTrigger
                      value="leads"
                      className="w-full justify-center group-hover:justify-start h-10 px-0 group-hover:px-4 rounded-xl data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all duration-200"
                    >
                      <Target className="w-4 h-4 shrink-0" />
                      <span className="w-0 group-hover:w-auto overflow-hidden group-hover:ml-3 text-xs font-bold uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap">
                        Leads
                      </span>
                    </TabsTrigger>
                  )}
                  {isSuperAdminUser && companyIdParam && (
                    <>
                      <div className="h-px bg-slate-100 my-1 mx-2" />
                      <TabsTrigger
                        value="whatsapp"
                        className="w-full justify-center group-hover:justify-start h-10 px-0 group-hover:px-4 rounded-xl data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all duration-200"
                      >
                        <MessageSquare className="w-4 h-4 shrink-0" />
                        <span className="w-0 group-hover:w-auto overflow-hidden group-hover:ml-3 text-xs font-bold uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap">
                          WhatsApp
                        </span>
                      </TabsTrigger>
                      <TabsTrigger
                        value="flows"
                        className="w-full justify-center group-hover:justify-start h-10 px-0 group-hover:px-4 rounded-xl data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all duration-200"
                      >
                        <Workflow className="w-4 h-4 shrink-0" />
                        <span className="w-0 group-hover:w-auto overflow-hidden group-hover:ml-3 text-xs font-bold uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap">
                          Flows
                        </span>
                      </TabsTrigger>
                      <TabsTrigger
                        value="notifications"
                        className="w-full justify-center group-hover:justify-start h-10 px-0 group-hover:px-4 rounded-xl data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all duration-200"
                      >
                        <BellRing className="w-4 h-4 shrink-0" />
                        <span className="w-0 group-hover:w-auto overflow-hidden group-hover:ml-3 text-xs font-bold uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap">
                          Notifications
                        </span>
                      </TabsTrigger>
                      <TabsTrigger
                        value="email"
                        className="w-full justify-center group-hover:justify-start h-10 px-0 group-hover:px-4 rounded-xl data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all duration-200"
                      >
                        <Mail className="w-4 h-4 shrink-0" />
                        <span className="w-0 group-hover:w-auto overflow-hidden group-hover:ml-3 text-xs font-bold uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap">
                          Email
                        </span>
                      </TabsTrigger>
                    </>
                  )}
                </TabsList>
              </div>
            </aside>

            <div className="flex-1 min-w-0">
              {isMobileTabMenuOpen && (
                <div className="md:hidden fixed inset-0 z-[70]">
                  <button
                    type="button"
                    aria-label="Close navigation menu"
                    onClick={() => setIsMobileTabMenuOpen(false)}
                    className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity duration-300"
                  />
                  <div
                    className={cn(
                      "absolute left-0 top-0 h-full w-[85%] max-w-[320px] bg-white shadow-2xl border-r border-slate-200 p-0 flex flex-col transform transition-all duration-500 ease-out overflow-hidden z-[80]",
                      isMobileTabMenuOpen
                        ? "translate-x-0 opacity-100"
                        : "-translate-x-full opacity-0",
                    )}
                  >
                    {/* Sidebar Header with User Profile */}
                    <div className="bg-slate-900 p-4">
                      <div className="flex items-center justify-end mb-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-white"
                          onClick={() => setIsMobileTabMenuOpen(false)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => {
                            handleTabChange("profile");
                            setIsMobileTabMenuOpen(false);
                          }}
                          className="h-12 w-12 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-2xl flex items-center justify-center text-white text-lg font-bold border-2 border-slate-800 shadow-xl hover:scale-105 transition-transform"
                        >
                          {user.firstName[0]}
                          {user.lastName[0]}
                        </button>
                        <div>
                          <h4 className="text-sm font-black text-white leading-tight uppercase tracking-tight">
                            {user.firstName} {user.lastName}
                          </h4>
                          <div className="flex flex-col mt-0.5">
                            {isJharsugudaCompany ? (
                              <span className="text-[10px] font-black text-white uppercase tracking-wide mt-1 whitespace-normal break-words">
                                {(user.role || "CUSTOM").replace(/_/g, " ")}
                              </span>
                            ) : (
                              <>
                                <span className="text-[10px] font-black text-indigo-200 uppercase tracking-wide leading-tight">
                                  {(user.role || "CUSTOM").replace("_", " ")}
                                </span>
                                {user?.companyId?.name && (
                                  <span className="text-[9px] font-bold text-white/60 uppercase tracking-tighter mt-0.5">
                                    ({user.companyId.name})
                                  </span>
                                )}
                              </>
                            )}
                            <div className="flex items-center gap-1.5 mt-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span>
                              <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
                                Online
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Sidebar Links */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                      <div className="px-2 py-3">
                        <h5 className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-4">
                          Main Menu
                        </h5>
                        <div className="space-y-1.5">
                          {(isSuperAdminUser ||
                            hasPermission(user, Permission.VIEW_ANALYTICS)) && (
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => handleTabChange("overview")}
                              className={cn(
                                "w-full justify-start text-xs font-bold uppercase tracking-wide h-11 rounded-xl transition-all duration-200",
                                activeTab === "overview"
                                  ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
                                  : "text-slate-600 hover:bg-slate-100/50 hover:text-slate-900",
                              )}
                            >
                              <LayoutGrid className="w-4 h-4 mr-3" />
                              Overview
                            </Button>
                          )}
                          {(!isSuperAdminUser ||
                            (isSuperAdminUser && companyIdParam)) && (
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => handleTabChange("analytics")}
                              className={cn(
                                "w-full justify-start text-xs font-bold uppercase tracking-wide h-11 rounded-xl transition-all duration-200",
                                activeTab === "analytics"
                                  ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
                                  : "text-slate-600 hover:bg-slate-100/50 hover:text-slate-900",
                              )}
                            >
                              <TrendingUp className="w-4 h-4 mr-3" />
                              {isDFO ? "Command Center" : "Analytics"}
                            </Button>
                          )}
                          {hasPermission(user, Permission.READ_GRIEVANCE) && (
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => handleTabChange("grievances")}
                              className={cn(
                                "w-full justify-start text-xs font-bold uppercase tracking-wide h-11 rounded-xl transition-all duration-200",
                                activeTab === "grievances"
                                  ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
                                  : "text-slate-600 hover:bg-slate-100/50 hover:text-slate-900",
                              )}
                            >
                              <FileText className="w-4 h-4 mr-3" />
                              {isDFO ? "Incidents" : "Grievances"}
                            </Button>
                          )}
                          {(isCompanyAdminRole ||
                            (isSuperAdminUser && companyIdParam)) &&
                            canShowAppointmentsInView && (
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => handleTabChange("appointments")}
                                className={cn(
                                  "w-full justify-start text-xs font-bold uppercase tracking-wide h-11 rounded-xl transition-all duration-200",
                                  activeTab === "appointments"
                                    ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
                                    : "text-slate-600 hover:bg-slate-100/50 hover:text-slate-900",
                                )}
                              >
                                <CalendarCheck className="w-4 h-4 mr-3" />
                                Appointments
                              </Button>
                            )}
                          {canSeeDepartmentsTab && (
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => handleTabChange("departments")}
                              className={cn(
                                "w-full justify-start text-xs font-bold uppercase tracking-wide h-11 rounded-xl transition-all duration-200",
                                activeTab === "departments"
                                  ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
                                  : "text-slate-600 hover:bg-slate-100/50 hover:text-slate-900",
                              )}
                            >
                              <Building className="w-4 h-4 mr-3" />
                              {isDFO ? "Patrol Units" : "Departments"}
                            </Button>
                          )}
                          {canSeeUsersTab && (
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => handleTabChange("users")}
                              className={cn(
                                "w-full justify-start text-xs font-bold uppercase tracking-wide h-11 rounded-xl transition-all duration-200",
                                activeTab === "users"
                                  ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
                                  : "text-slate-600 hover:bg-slate-100/50 hover:text-slate-900",
                              )}
                            >
                              <Users className="w-4 h-4 mr-3" />
                              Users
                            </Button>
                          )}

                          {isSuperAdminUser && companyIdParam && (
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => handleTabChange("roles")}
                              className={cn(
                                "w-full justify-start text-xs font-bold uppercase tracking-wide h-11 rounded-xl transition-all duration-200",
                                activeTab === "roles"
                                  ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
                                  : "text-slate-600 hover:bg-slate-100/50 hover:text-slate-900",
                              )}
                            >
                              <Shield className="w-4 h-4 mr-3" />
                              Roles
                            </Button>
                          )}

                          {hasModule(Module.LEAD_CAPTURE) &&
                            isViewingCompany && (
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => handleTabChange("leads")}
                                className={cn(
                                  "w-full justify-start text-xs font-bold uppercase tracking-wide h-11 rounded-xl transition-all duration-200",
                                  activeTab === "leads"
                                    ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
                                    : "text-slate-600 hover:bg-slate-100/50 hover:text-slate-900",
                                )}
                              >
                                <Target className="w-4 h-4 mr-3" />
                                Leads
                              </Button>
                            )}

                          {isSuperAdminUser && companyIdParam && (
                            <>
                              <div className="h-px bg-slate-100 my-2 mx-2"></div>
                              <h5 className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-2 px-2">
                                Configuration
                              </h5>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => handleTabChange("whatsapp")}
                                className={cn(
                                  "w-full justify-start text-xs font-bold uppercase tracking-wide h-11 rounded-xl transition-all duration-200",
                                  activeTab === "whatsapp"
                                    ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
                                    : "text-slate-600 hover:bg-slate-100/50 hover:text-slate-900",
                                )}
                              >
                                <MessageSquare className="w-4 h-4 mr-3" />
                                WhatsApp
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => handleTabChange("flows")}
                                className={cn(
                                  "w-full justify-start text-xs font-bold uppercase tracking-wide h-11 rounded-xl transition-all duration-200",
                                  activeTab === "flows"
                                    ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
                                    : "text-slate-600 hover:bg-slate-100/50 hover:text-slate-900",
                                )}
                              >
                                <Workflow className="w-4 h-4 mr-3" />
                                Flows
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => handleTabChange("notifications")}
                                className={cn(
                                  "w-full justify-start text-xs font-bold uppercase tracking-wide h-11 rounded-xl transition-all duration-200",
                                  activeTab === "notifications"
                                    ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
                                    : "text-slate-600 hover:bg-slate-100/50 hover:text-slate-900",
                                )}
                              >
                                <BellRing className="w-4 h-4 mr-3" />
                                Notifications
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => handleTabChange("email")}
                                className={cn(
                                  "w-full justify-start text-xs font-bold uppercase tracking-wide h-11 rounded-xl transition-all duration-200",
                                  activeTab === "email"
                                    ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
                                    : "text-slate-600 hover:bg-slate-100/50 hover:text-slate-900",
                                )}
                              >
                                <Mail className="w-4 h-4 mr-3" />
                                Email
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Sidebar Footer */}
                    <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                      <Button
                        onClick={logout}
                        variant="ghost"
                        className="w-full justify-start text-xs font-bold uppercase tracking-wide h-11 rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-all duration-200"
                      >
                        <Power className="w-4 h-4 mr-3" />
                        Logout Account
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-4 sm:space-y-6">
                {/* Dashboard Headers & Quick Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-4">
                  {/* Total Grievances */}
                  {hasPermission(user, Permission.READ_GRIEVANCE) && (
                    <Card
                      onClick={() => {
                        setActiveTab("grievances");
                        setGrievanceFilters(prev => ({ ...prev, status: "" }));
                      }}
                      className="min-h-[6.5rem] sm:min-h-[8.5rem] cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-t-[3px] border-indigo-500 bg-slate-50/50 px-3 py-2.5">
                        <CardTitle className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-400">
                          Total Grievances
                        </CardTitle>
                        <FileText className="h-3 w-3 text-indigo-500" />
                      </CardHeader>
                      <CardContent className="px-3 py-2.5">
                        <div className="text-xl sm:text-2xl font-black text-slate-800 tabular-nums">
                          {loadingStats ? <LoadingDots /> : (stats?.grievances.registeredTotal || 0)}
                        </div>
                        <div className="mt-1 flex items-center gap-1">
                          <span className="text-[8px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                            {stats?.grievances.last7Days || 0} New
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Overdue Grievances */}
                  {hasPermission(user, Permission.READ_GRIEVANCE) && (
                    <Card
                      onClick={() => {
                        setActiveTab("grievances");
                        setGrievanceFilters((prev) => ({
                          ...prev,
                          status: "PENDING",
                          overdueStatus: "overdue",
                        }));
                      }}
                      className="min-h-[6.5rem] sm:min-h-[8.5rem] cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-t-[3px] border-amber-500 bg-slate-50/50 px-3 py-2.5">
                        <CardTitle className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-400">
                          Overdue
                        </CardTitle>
                        <Clock className="h-3 w-3 text-amber-500" />
                      </CardHeader>
                      <CardContent className="px-3 py-2.5">
                        <div className="text-xl sm:text-2xl font-black text-amber-600 tabular-nums">
                          {loadingStats ? <LoadingDots /> : overdueGrievancesCount}
                        </div>
                        <p className="mt-1 text-[8px] font-bold uppercase text-slate-400">Delayed</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Pending Grievances */}
                  {hasPermission(user, Permission.READ_GRIEVANCE) && (
                    <Card
                      onClick={() => {
                        setActiveTab("grievances");
                        setGrievanceFilters((prev) => ({ ...prev, status: "PENDING" }));
                      }}
                      className="min-h-[6.5rem] sm:min-h-[8.5rem] cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-t-[3px] border-blue-500 bg-slate-50/50 px-3 py-2.5">
                        <CardTitle className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-400">
                          Pending
                        </CardTitle>
                        <AlertCircle className="h-3 w-3 text-blue-500" />
                      </CardHeader>
                      <CardContent className="px-3 py-2.5">
                        <div className="text-xl sm:text-2xl font-black text-blue-600 tabular-nums">
                          {loadingStats ? <LoadingDots /> : (stats?.grievances.pending || 0)}
                        </div>
                        <p className="mt-1 text-[8px] font-bold uppercase text-slate-400">Waiting</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Reverted Grievances */}
                  {hasPermission(user, Permission.READ_GRIEVANCE) && (
                    <Card
                      onClick={() => {
                        setActiveTab("grievances");
                        setGrievanceFilters((prev) => ({ ...prev, status: "REVERTED" }));
                      }}
                      className="min-h-[6.5rem] sm:min-h-[8.5rem] cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-t-[3px] border-sky-500 bg-slate-50/50 px-3 py-2.5">
                        <CardTitle className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-400">
                          Reverted
                        </CardTitle>
                        <ArrowLeft className="h-3 w-3 text-sky-500" />
                      </CardHeader>
                      <CardContent className="px-3 py-2.5">
                        <div className="text-xl sm:text-2xl font-black text-sky-600 tabular-nums">
                          {loadingStats ? <LoadingDots /> : (stats?.grievances.reverted || 0)}
                        </div>
                        <p className="mt-1 text-[8px] font-bold uppercase text-slate-400">Reassigned</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Resolved Grievances */}
                  {hasPermission(user, Permission.READ_GRIEVANCE) && (
                    <Card
                      onClick={() => {
                        setActiveTab("grievances");
                        setGrievanceFilters((prev) => ({ ...prev, status: "RESOLVED" }));
                      }}
                      className="min-h-[6.5rem] sm:min-h-[8.5rem] cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-t-[3px] border-emerald-500 bg-slate-50/50 px-3 py-2.5">
                        <CardTitle className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-400">
                          Resolved
                        </CardTitle>
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      </CardHeader>
                      <CardContent className="px-3 py-2.5">
                        <div className="text-xl sm:text-2xl font-black text-emerald-600 tabular-nums">
                          {loadingStats ? <LoadingDots /> : (stats?.grievances.resolved || 0)}
                        </div>
                        <p className="mt-1 text-[8px] font-bold uppercase text-slate-400">Completed</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Rejected Grievances */}
                  {hasPermission(user, Permission.READ_GRIEVANCE) && (
                    <Card
                      onClick={() => {
                        setActiveTab("grievances");
                        setGrievanceFilters((prev) => ({ ...prev, status: "REJECTED" }));
                      }}
                      className="min-h-[6.5rem] sm:min-h-[8.5rem] cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-t-[3px] border-rose-500 bg-slate-50/50 px-3 py-2.5">
                        <CardTitle className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-400">
                          Rejected
                        </CardTitle>
                        <XCircle className="h-3 w-3 text-rose-500" />
                      </CardHeader>
                      <CardContent className="px-3 py-2.5">
                        <div className="text-xl sm:text-2xl font-black text-rose-600 tabular-nums">
                          {loadingStats ? <LoadingDots /> : (stats?.grievances.rejected || 0)}
                        </div>
                        <p className="mt-1 text-[8px] font-bold uppercase text-slate-400">Declined</p>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Company Info (for Company Admin) - Beautified Modern Design */}
                {isViewingCompany && (
                  <Card className="overflow-hidden border border-slate-200 shadow-sm bg-white rounded-xl">
                    <div className="bg-slate-900 px-6 py-2">
                      <div className="relative flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="h-16 w-16 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20 shadow-lg">
                            <Building className="text-white w-8 h-8" />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-white leading-tight">
                              {company?.name || <LoadingDots />}
                            </h3>
                            <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mt-1">
                              Company Profile & Statistics
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="px-1.5 sm:px-3 py-1 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 text-white text-[9px] sm:text-[11px] font-black uppercase tracking-wider shadow-sm truncate max-w-[80px] sm:max-w-none inline-flex items-center">
                            {company?.companyType || <LoadingDots />}
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
                              {loadingStats ? (
                                <LoadingDots />
                              ) : (
                                (stats?.users ?? users.length)
                              )}
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
                              {loadingStats ? (
                                <LoadingDots />
                              ) : (
                                departmentPagination.total ||
                                stats?.departments ||
                                departments.length
                              )}
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
                            {company?.contactEmail || <LoadingDots />}
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
                            {company ? (
                              formatTo10Digits(company.contactPhone)
                            ) : (
                              <LoadingDots />
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Department Admin - Profile & Department Info in Overview */}
                {isDepartmentLevel && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-md font-black text-white shadow-md flex-shrink-0">
                          {user?.firstName?.[0]}
                          {user?.lastName?.[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                            Identity
                          </p>
                          <h2 className="text-[11px] font-black text-slate-900 uppercase truncate leading-none">
                            {user?.firstName} {user?.lastName}
                          </h2>
                        </div>
                      </div>

                      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Mail className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                            Contact
                          </p>
                          <h2 className="text-[10px] font-bold text-slate-600 truncate leading-none">
                            {user?.email}
                          </h2>
                        </div>
                      </div>

                      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Shield className="w-5 h-5 text-white" />
                        </div>
                        <div className="min-w-0 overflow-hidden">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">
                            Authorization
                          </p>
                          <div className="flex flex-wrap gap-1">
                            <span className="px-1.5 py-0.5 bg-indigo-600 text-white text-[8px] font-black rounded uppercase leading-none">
                              {user.role?.replace(/_/g, " ")}
                            </span>
                            {normalizedDesignations.map(
                              (designation, index) => (
                                <span
                                  key={index}
                                  className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[8px] font-black rounded uppercase border border-slate-200 leading-none"
                                >
                                  {designation}
                                </span>
                              ),
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 pt-3">
                      <div className="flex items-center justify-between ml-1">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-slate-400/60" />
                          Active Department Assignments
                        </h4>
                        {assignedDepartmentSummaries.length > 1 && (
                          <span className="text-[8px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 uppercase tracking-tight">
                            {assignedDepartmentSummaries.length} Units
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {assignedDepartmentSummaries.length > 0 ? (
                          assignedDepartmentSummaries.map((dept, idx) => {
                            const statsForDept =
                              stats?.grievances?.byDepartment?.find(
                                (departmentStat) =>
                                  departmentStat.departmentId === dept.id,
                              );

                            return (
                              <div
                                key={dept.id || `dept-assignment-${idx}`}
                                className="bg-white border border-slate-200 rounded-[18px] p-3 sm:p-4 flex items-center gap-3 hover:shadow-md hover:border-indigo-200 transition-all duration-300 cursor-default group shadow-sm relative overflow-hidden"
                              >
                                <div className="absolute inset-0 bg-gradient-to-r from-indigo-50/0 to-indigo-50/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                                <div className="h-10 w-10 shrink-0 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center shadow-inner group-hover:bg-indigo-600 group-hover:border-indigo-500 transition-all duration-300 relative z-10">
                                  <Building className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
                                </div>

                                <div className="flex-1 min-w-0 relative z-10">
                                  <h5 className="text-[11px] font-black text-slate-900 uppercase leading-tight truncate group-hover:text-indigo-600 transition-colors mb-1">
                                    {dept.name}
                                  </h5>

                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-50 border border-slate-100 rounded-md">
                                      <Terminal className="w-2.5 h-2.5 text-slate-400" />
                                      <span className="text-[8px] font-black text-slate-500 uppercase tracking-tight">
                                        {dept.code || "UNIT"}
                                      </span>
                                    </div>

                                    {dept.isPrimary && (
                                      <div className="px-1.5 py-0.5 bg-indigo-50 border border-indigo-100 rounded-md">
                                        <span className="text-[8px] font-black text-indigo-600 uppercase tracking-tight">
                                          Primary
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="text-right pl-3 border-l border-slate-100 shrink-0 relative z-10">
                                  <div className="text-xl font-black text-slate-900 tracking-tighter leading-none group-hover:text-indigo-600 transition-colors">
                                    {statsForDept?.total || 0}
                                  </div>
                                  <div className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                                    Grievances
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="col-span-full p-6 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center text-slate-400 bg-slate-50/30">
                            <Building2 className="w-8 h-8 mb-2 opacity-20" />
                            <p className="text-[9px] font-black uppercase tracking-widest">
                              No assigned units
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Quick Actions */}

                <Card className="border border-slate-200 shadow-sm rounded-xl overflow-hidden">
                  <CardContent className="p-4 space-y-2">
                    {isViewingCompany && (
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
              {(!isSuperAdminUser || (isSuperAdminUser && companyIdParam)) && (
                <TabsContent value="analytics" className="space-y-4">
                  {/* Header Banner */}

                  {/* 🌲 DFO Forest Insights (Specialized Tiles) */}
                  {company?.name?.toUpperCase().includes("BHANUPRATAPPUR") && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                      <div className="group relative bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl p-4 shadow-lg shadow-orange-500/20 overflow-hidden text-white">
                        <div className="relative z-10">
                          <div className="flex items-center justify-between mb-2">
                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
                              <Zap className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-[10px] bg-white/20 px-2 py-1 rounded-full font-bold uppercase tracking-wider">
                              High Alert
                            </span>
                          </div>
                          <h4 className="text-white/80 text-xs font-bold uppercase tracking-wide">
                            Active Wildfires
                          </h4>
                          <p className="text-3xl font-black tracking-tighter mt-1">
                            {stats?.grievances.byPriority?.find(
                              (p) => p.priority === "HIGH",
                            )?.count || 0}
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
                            <span className="text-[10px] bg-white/20 px-2 py-1 rounded-full font-bold uppercase tracking-wider">
                              Secured
                            </span>
                          </div>
                          <h4 className="text-white/80 text-xs font-bold uppercase tracking-wide">
                            Wildlife Incidents
                          </h4>
                          <p className="text-3xl font-black tracking-tighter mt-1">
                            {grievances.filter(
                              (g) =>
                                g.category?.toLowerCase().includes("animal") ||
                                g.category?.toLowerCase().includes("wildlife"),
                            ).length || 0}
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
                            <span className="text-[10px] bg-white/20 px-2 py-1 rounded-full font-bold uppercase tracking-wider">
                              Monitored
                            </span>
                          </div>
                          <h4 className="text-white/80 text-xs font-bold uppercase tracking-wide">
                            Total Patrol Areas
                          </h4>
                          <p className="text-3xl font-black tracking-tighter mt-1">
                            {stats?.departments || 0}
                          </p>
                        </div>
                        <div className="absolute -right-4 -bottom-4 opacity-20 transform group-hover:scale-110 transition-transform">
                          <Shield className="w-24 h-24" />
                        </div>
                      </div>

                      <div className="group relative bg-white rounded-2xl p-4 border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-center">
                        <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wide mb-1">
                          Encroachment Alerts
                        </h4>
                        <div className="flex items-baseline gap-2">
                          <p className="text-3xl font-black text-slate-900 tracking-tighter">
                            0
                          </p>
                          <span className="text-emerald-500 text-[10px] font-bold">
                            Stable
                          </span>
                        </div>
                        <div className="mt-2 w-full bg-slate-100 rounded-full h-1">
                          <div
                            className="bg-emerald-500 h-1 rounded-full"
                            style={{ width: "0%" }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* KPI Cards - Refined Design */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
                    {/* Analytics KPI Row - 6 Specific Cards */}
                    {hasModule(Module.GRIEVANCE) && (
                      <>
                        {/* 1. Inbound Grievances */}
                        <div
                          onClick={() => setActiveTab("grievances")}
                          className="group relative bg-white/70 backdrop-blur-md rounded-xl border border-slate-200/60 p-3 sm:p-4 transition-all duration-500 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1 cursor-pointer overflow-hidden min-h-[7rem] sm:min-h-[9.5rem]"
                        >
                          <div className="absolute -right-4 -top-4 w-20 h-20 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-full transition-transform group-hover:scale-150 duration-700"></div>
                          <div className="relative">
                            <div className="flex items-center justify-between mb-2">
                              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 border border-indigo-100/50 shadow-sm group-hover:rotate-6 transition-transform">
                                <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                              </div>
                              <div className="text-right">
                                <div className="text-[8px] sm:text-[9px] font-black text-indigo-600 bg-indigo-50/80 px-1.5 sm:px-2 py-1 rounded-lg uppercase tracking-tight border border-indigo-100/30">
                                  {(
                                    stats?.grievances.resolutionRate || 0
                                  ).toFixed(1)}
                                  %
                                </div>
                              </div>
                            </div>
                            <h4 className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                              Inbound Grievances
                            </h4>
                            <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tighter group-hover:text-indigo-600 transition-colors leading-none">
                              {stats?.grievances.total || 0}
                            </p>
                          </div>
                        </div>

                        {/* 2. Overdue Grievances */}
                        <div
                          onClick={() => {
                            setActiveTab("grievances");
                            setGrievanceFilters((prev) => ({
                              ...prev,
                              status: "PENDING",
                              overdueStatus: "overdue",
                            }));
                          }}
                          className="group relative bg-white/70 backdrop-blur-md rounded-xl border border-slate-200/60 p-3 sm:p-4 transition-all duration-500 hover:shadow-xl hover:shadow-amber-500/10 hover:-translate-y-1 cursor-pointer overflow-hidden min-h-[7rem] sm:min-h-[9.5rem]"
                        >
                          <div className="absolute -right-4 -top-4 w-20 h-20 bg-gradient-to-br from-amber-500/10 to-transparent rounded-full transition-transform group-hover:scale-150 duration-700"></div>
                          <div className="relative">
                            <div className="flex items-center justify-between mb-2">
                              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600 border border-amber-100/50 shadow-sm group-hover:-rotate-6 transition-transform">
                                <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                              </div>
                              <span className="text-[8px] sm:text-[9px] font-black bg-rose-50 text-rose-600 px-1.5 sm:px-2 py-1 rounded-lg uppercase tracking-tight border border-rose-100/30">
                                {stats?.highPriorityPending || 0} Urgent
                              </span>
                            </div>
                            <h4 className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                              Overdue Grievances
                            </h4>
                            <p className="text-xl sm:text-2xl font-black text-amber-600 tracking-tighter leading-none">
                              {overdueGrievancesCount}
                            </p>
                          </div>
                        </div>

                        {/* 3. Total Resolved */}
                        <div
                          onClick={() => {
                            setActiveTab("grievances");
                            setGrievanceFilters((prev) => ({
                              ...prev,
                              status: "RESOLVED",
                            }));
                          }}
                          className="group relative bg-white/70 backdrop-blur-md rounded-xl border border-slate-200/60 p-3 sm:p-4 transition-all duration-500 hover:shadow-xl hover:shadow-emerald-500/10 hover:-translate-y-1 cursor-pointer overflow-hidden min-h-[7rem] sm:min-h-[9.5rem]"
                        >
                          <div className="absolute -right-4 -top-4 w-20 h-20 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-full transition-transform group-hover:scale-150 duration-700"></div>
                          <div className="relative">
                            <div className="flex items-center justify-between mb-2">
                              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 border border-emerald-100/50 shadow-sm transition-all group-hover:bg-emerald-600 group-hover:text-white">
                                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
                              </div>
                              <div className="flex items-center gap-1 text-[8px] sm:text-[9px] font-black text-emerald-600 bg-emerald-50 px-1.5 sm:px-2 py-1 rounded-lg uppercase tracking-tight">
                                Success
                              </div>
                            </div>
                            <h4 className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                              Total Resolved
                            </h4>
                            <p className="text-xl sm:text-2xl font-black text-emerald-600 tracking-tighter leading-none">
                              {stats?.grievances.resolved || 0}
                            </p>
                          </div>
                        </div>

                        {/* 4. Rejected Grievances */}
                        <div
                          onClick={() => {
                            setActiveTab("grievances");
                            setGrievanceFilters((prev) => ({
                              ...prev,
                              status: "REJECTED",
                            }));
                          }}
                          className="group relative bg-white/70 backdrop-blur-md rounded-xl border border-slate-200/60 p-3 sm:p-4 transition-all duration-500 hover:shadow-xl hover:shadow-rose-500/10 hover:-translate-y-1 cursor-pointer overflow-hidden min-h-[7rem] sm:min-h-[9.5rem]"
                        >
                          <div className="absolute -right-4 -top-4 w-20 h-20 bg-gradient-to-br from-rose-500/10 to-transparent rounded-full transition-transform group-hover:scale-150 duration-700"></div>
                          <div className="relative">
                            <div className="flex items-center justify-between mb-2">
                              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-rose-50 rounded-lg flex items-center justify-center text-rose-600 border border-rose-100/50 shadow-sm transition-all group-hover:bg-rose-600 group-hover:text-white">
                                <XCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                              </div>
                              <div className="flex items-center gap-1 text-[8px] sm:text-[9px] font-black text-rose-600 bg-rose-50 px-1.5 sm:px-2 py-1 rounded-lg uppercase tracking-tight">
                                Declined
                              </div>
                            </div>
                            <h4 className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                              Rejected Grievances
                            </h4>
                            <p className="text-xl sm:text-2xl font-black text-rose-600 tracking-tighter leading-none">
                              {stats?.grievances.rejected || 0}
                            </p>
                          </div>
                        </div>

                        {isViewingCompany &&
                          isCompanyAdminRole &&
                          isCollectorateJharsuguda && (
                            <div
                              onClick={() => {
                                setActiveTab("grievances");
                                setGrievanceFilters((prev) => ({
                                  ...prev,
                                  status: "REVERTED",
                                }));
                              }}
                              className="group relative bg-white/70 backdrop-blur-md rounded-xl border border-slate-200/60 p-3 sm:p-4 transition-all duration-500 hover:shadow-xl hover:shadow-sky-500/10 hover:-translate-y-1 cursor-pointer overflow-hidden min-h-[7rem] sm:min-h-[9.5rem]"
                            >
                              <div className="absolute -right-4 -top-4 w-20 h-20 bg-gradient-to-br from-sky-500/10 to-transparent rounded-full transition-transform group-hover:scale-150 duration-700"></div>
                              <div className="relative">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-sky-50 rounded-lg flex items-center justify-center text-sky-600 border border-sky-100/50 shadow-sm transition-all group-hover:bg-sky-600 group-hover:text-white">
                                    <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                                  </div>
                                  <div className="flex items-center gap-1 text-[8px] sm:text-[9px] font-black text-sky-600 bg-sky-50 px-1.5 sm:px-2 py-1 rounded-lg uppercase tracking-tight">
                                    Reassigned
                                  </div>
                                </div>
                                <h4 className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                  Reverted Grievances
                                </h4>
                                <p className="text-xl sm:text-2xl font-black text-sky-600 tracking-tighter leading-none">
                                  {stats?.grievances.reverted || 0}
                                </p>
                              </div>
                            </div>
                          )}
                      </>
                    )}

                    {canShowAppointmentsInView && isViewingCompany && (
                      <>
                        {/* 4. Total Appointments */}
                        <div
                          onClick={() => setActiveTab("appointments")}
                          className="group relative bg-white/70 backdrop-blur-md rounded-xl border border-slate-200/60 p-3 sm:p-4 transition-all duration-500 hover:shadow-xl hover:shadow-purple-500/10 hover:-translate-y-1 cursor-pointer overflow-hidden min-h-[7rem] sm:min-h-[9.5rem]"
                        >
                          <div className="absolute -right-4 -top-4 w-20 h-20 bg-gradient-to-br from-purple-500/10 to-transparent rounded-full transition-transform group-hover:scale-150 duration-700"></div>
                          <div className="relative">
                            <div className="flex items-center justify-between mb-2">
                              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600 border border-purple-100/50 shadow-sm transition-all group-hover:rotate-12">
                                <CalendarCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                              </div>
                              <div className="text-[8px] sm:text-[9px] font-black text-purple-600 bg-purple-50 px-1.5 sm:px-2 py-1 rounded-lg uppercase tracking-tight">
                                Total
                              </div>
                            </div>
                            <h4 className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                              Total Appointments
                            </h4>
                            <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tighter leading-none">
                              {stats?.appointments.total || 0}
                            </p>
                          </div>
                        </div>

                        {/* 5. Pending Appointments */}
                        <div
                          onClick={() => setActiveTab("appointments")}
                          className="group relative bg-white/70 backdrop-blur-md rounded-xl border border-slate-200/60 p-3 sm:p-4 transition-all duration-500 hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1 cursor-pointer overflow-hidden min-h-[7rem] sm:min-h-[9.5rem]"
                        >
                          <div className="absolute -right-4 -top-4 w-20 h-20 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full transition-transform group-hover:scale-150 duration-700"></div>
                          <div className="relative">
                            <div className="flex items-center justify-between mb-2">
                              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 border border-blue-100/50 shadow-sm transition-all group-hover:rotate-6">
                                <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                              </div>
                              <div className="text-[8px] sm:text-[9px] font-black text-blue-600 bg-blue-50 px-1.5 sm:px-2 py-1 rounded-lg uppercase tracking-tight">
                                Pending
                              </div>
                            </div>
                            <h4 className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                              Pending Appointments
                            </h4>
                            <p className="text-xl sm:text-2xl font-black text-blue-600 tracking-tighter leading-none">
                              {stats?.appointments.pending || 0}
                            </p>
                          </div>
                        </div>

                        {/* 6. Completed Appointments */}
                        <div
                          onClick={() => setActiveTab("appointments")}
                          className="group relative bg-white/70 backdrop-blur-md rounded-xl border border-slate-200/60 p-3 sm:p-4 transition-all duration-500 hover:shadow-xl hover:shadow-emerald-500/10 hover:-translate-y-1 cursor-pointer overflow-hidden min-h-[7rem] sm:min-h-[9.5rem]"
                        >
                          <div className="absolute -right-4 -top-4 w-20 h-20 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-full transition-transform group-hover:scale-150 duration-700"></div>
                          <div className="relative">
                            <div className="flex items-center justify-between mb-2">
                              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 border border-emerald-100/50 shadow-sm transition-all group-hover:rotate-6">
                                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                              </div>
                              <div className="text-[8px] sm:text-[9px] font-black text-emerald-600 bg-emerald-50 px-1.5 sm:px-2 py-1 rounded-lg uppercase tracking-tight">
                                Done
                              </div>
                            </div>
                            <h4 className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                              Completed Appointments
                            </h4>
                            <p className="text-xl sm:text-2xl font-black text-emerald-600 tracking-tighter leading-none">
                              {stats?.appointments.completed || 0}
                            </p>
                          </div>
                        </div>
                      </>
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
                                {isDFO
                                  ? "Operational Response Trend"
                                  : "Grievance Trend"}
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
                                data={stats.grievances.daily
                                  .slice(-7)
                                  .map((d) => ({
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
                                Grievance Operational Status
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
                                value:
                                  stats?.grievances.assigned ||
                                  stats?.grievances.inProgress ||
                                  0,
                                color: "#6366f1",
                                subText: "Active resolution",
                              },
                              {
                                name: "Resolved",
                                value: stats?.grievances.resolved || 0,
                                color: "#10b981",
                                subText: "Completed cases",
                              },
                              {
                                name: "Rejected",
                                value: stats?.grievances.rejected || 0,
                                color: "#ef4444",
                                subText: "Closed without resolution",
                              },
                              {
                                name: "Reverted",
                                value: stats?.grievances.reverted || 0,
                                color: "#0ea5e9",
                                subText: "Reassigned cases",
                              },
                            ].filter((d) => d.value > 0);
                            return chart.length > 0 ? (
                              <>
                                <div className="relative h-[120px]">
                                  <ResponsiveContainer
                                    width="100%"
                                    height="100%"
                                  >
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
                                          boxShadow:
                                            "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
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
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                                      Total
                                    </span>
                                  </div>
                                </div>
                                <div className="space-y-1.5 mt-3">
                                  {chart.map((d, i) => (
                                    <div
                                      key={i}
                                      className="group flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                                      role="button"
                                      tabIndex={0}
                                      aria-label={`Open ${d.name} grievances`}
                                      onClick={() =>
                                        navigateToGrievances({
                                          status: d.name.toUpperCase(),
                                        })
                                      }
                                      onKeyDown={(e) => {
                                        if (
                                          e.key === "Enter" ||
                                          e.key === " "
                                        ) {
                                          e.preventDefault();
                                          navigateToGrievances({
                                            status: d.name.toUpperCase(),
                                          });
                                        }
                                      }}
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
                                          <p className="text-[8px] text-slate-400 group-hover:text-slate-500 transition-colors mt-0.5">
                                            {d.subText}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-[11px] font-black text-slate-900 leading-none">
                                          {d.value}
                                        </p>
                                        <p className="text-[8px] font-bold text-slate-400 mt-0.5">
                                          {(
                                            (d.value /
                                              (stats?.grievances
                                                .registeredTotal ||
                                                stats?.grievances.total ||
                                                1)) *
                                            100
                                          ).toFixed(0)}
                                          %
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
                    {hasModule(Module.GRIEVANCE) && isViewingCompany && (
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[320px]">
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
                          <ResponsiveContainer width="100%" height={240}>
                            <BarChart
                              data={departmentData
                                .filter(
                                  (d: any) =>
                                    d.departmentName &&
                                    d.departmentName.trim() !== "" &&
                                    d.departmentName !== "Unnamed Department",
                                )
                                .slice(0, 5)}
                              layout="vertical"
                              margin={{
                                left: 20,
                                right: 40,
                                top: 10,
                                bottom: 10,
                              }}
                            >
                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="#f1f5f9"
                                horizontal={false}
                              />
                              <XAxis type="number" hide />
                              <YAxis
                                dataKey="departmentName"
                                type="category"
                                interval={0}
                                tick={{
                                  fontSize: 9,
                                  fontWeight: "bold",
                                  fill: "#64748b",
                                }}
                                width={140}
                              />
                              <Tooltip
                                cursor={{ fill: "#f8fafc" }}
                                contentStyle={{
                                  borderRadius: "12px",
                                  border: "none",
                                  boxShadow:
                                    "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                                  fontSize: "10px",
                                }}
                              />
                              <Bar
                                dataKey="count"
                                fill="#ef4444"
                                radius={[0, 4, 4, 0]}
                                barSize={16}
                                name="Total Grievances"
                                className="cursor-pointer"
                                onClick={(data: any) => {
                                  const departmentId = data?.departmentId || data?._id || "";
                                  const parentId = data?.parentDepartmentId || "";
                                  
                                  const filters: Partial<typeof grievanceFilters> = {
                                    status: "",
                                  };

                                  if (departmentId) {
                                    if (parentId) {
                                      // 🏢 Sub-Department: Filter by parent AND self
                                      filters.mainDeptId = parentId;
                                      filters.subDeptId = departmentId;
                                    } else {
                                      // 🏢 Main Department: Filter by self only
                                      filters.mainDeptId = departmentId;
                                      filters.subDeptId = "";
                                    }
                                    filters.department = "";
                                  }

                                  navigateToGrievances(filters);
                                }}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* Appointments by Status - Company Admin only */}
                    {canShowAppointmentsInView && isViewingCompany && (
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
                                  <BarChart
                                    data={apptData}
                                    layout="vertical"
                                    margin={{
                                      left: 0,
                                      right: 0,
                                      top: 0,
                                      bottom: 0,
                                    }}
                                  >
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
                    {/* Staff by Role Distribution - Visible only to Company Admins & Higher */}
                    {(isCompanyAdminRole || isSuperAdminUser) && (
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
                              {isViewingCompany
                                ? "Across all departments"
                                : "In your department"}
                            </p>
                          </div>
                        </div>
                        <div className="p-4 flex-1 flex flex-col justify-between">
                          {(() => {
                            const roleDataRaw = stats?.usersByRole || [];
                            const localRoleMap: Record<string, number> = {};

                            if (roleDataRaw.length === 0 || isDepartmentLevel) {
                              // Extract all department IDs the current user is mapped to
                              const myDeptIds = new Set(
                                [
                                  user?.departmentId,
                                  ...(user?.departmentIds || []),
                                ]
                                  .filter(Boolean)
                                  .map((d) =>
                                    String(
                                      typeof d === "object" ? d._id || d : d,
                                    ),
                                  ),
                              );

                              const filteredForStats = isViewingCompany
                                ? users
                                : users.filter((u) => {
                                    const uDeptId = String(
                                      typeof u.departmentId === "object"
                                        ? u.departmentId?._id || u.departmentId
                                        : u.departmentId,
                                    );
                                    const uDeptIds = (
                                      u.departmentIds || []
                                    ).map((d: any) =>
                                      String(
                                        typeof d === "object" ? d?._id || d : d,
                                      ),
                                    );
                                    const uIdMatch =
                                      uDeptId && myDeptIds.has(uDeptId);
                                    const uIdsMatch = uDeptIds.some(
                                      (id: string) => myDeptIds.has(id),
                                    );
                                    return uIdMatch || uIdsMatch;
                                  });

                              filteredForStats.forEach((u) => {
                                let roleName = "";
                                if (
                                  typeof u.customRoleId === "object" &&
                                  u.customRoleId?.name
                                ) {
                                  roleName = u.customRoleId.name;
                                } else {
                                  roleName =
                                    u.role?.replace(/_/g, " ") || "Unknown";
                                }
                                const normalizedRole = roleName.toUpperCase();
                                localRoleMap[normalizedRole] =
                                  (localRoleMap[normalizedRole] || 0) + 1;
                              });
                            }

                            const roleColors = [
                              "#6366f1",
                              "#10b981",
                              "#f59e0b",
                              "#f43f5e",
                              "#8b5cf6",
                            ];

                            const roleData = (
                              roleDataRaw.length > 0
                                ? roleDataRaw.map((r, i) => ({
                                    name: r.name.toUpperCase(),
                                    value: r.count,
                                    color: roleColors[i % roleColors.length],
                                  }))
                                : Object.entries(localRoleMap).map(
                                    ([name, value], i) => ({
                                      name,
                                      value,
                                      color: roleColors[i % roleColors.length],
                                    }),
                                  )
                            ).filter((r) => {
                              const uLevel = user?.level ?? 4;
                              if (uLevel <= 1) return true; // Company Admin+: Full access
                              if (uLevel === 2) {
                                // Dept Admin: Dept Admin + Sub-Dept Admin + Operator
                                return (
                                  !r.name.includes("COMPANY") &&
                                  !r.name.includes("SUPER")
                                );
                              }
                              if (uLevel === 3) {
                                // Sub-Dept Admin: Sub-Dept Admin + Operator
                                return (
                                  (r.name.includes("SUB") ||
                                    r.name.includes("OPERATOR")) &&
                                  !r.name.includes("COMPANY")
                                );
                              }
                              return false;
                            });

                            const totalStaffCount = roleData.reduce(
                              (acc, curr) => acc + curr.value,
                              0,
                            );

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
                    )}
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
                              <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest">
                                Action Zones
                              </span>
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
                                    i === 12 ||
                                    i === 25 ||
                                    i === 26 ||
                                    i === 44 ||
                                    i === 37
                                      ? "bg-rose-500 animate-pulse"
                                      : i === 18 || i === 33 || i === 50
                                        ? "bg-orange-500 opacity-60"
                                        : "bg-indigo-900/30"
                                  }`}
                                />
                              ))}
                            </div>

                            {/* Active Markers */}
                            <div className="absolute inset-0 p-4">
                              {(liveIncidents || [])
                                .slice(0, 5)
                                .map((inc, i) => (
                                  <div
                                    key={i}
                                    className="absolute w-4 h-4"
                                    style={{
                                      left: `${20 + i * 15}%`,
                                      top: `${30 + i * 10}%`,
                                    }}
                                  >
                                    <div
                                      className={`w-full h-full rounded-full ${inc.severity === "CRITICAL" ? "bg-rose-500" : "bg-orange-500"} animate-ping opacity-40`}
                                    />
                                    <div
                                      className={`absolute inset-0 w-2 h-2 m-auto rounded-full ${inc.severity === "CRITICAL" ? "bg-rose-600" : "bg-orange-600"} border border-white/40 shadow-lg`}
                                    />
                                  </div>
                                ))}
                            </div>

                            <div className="absolute bottom-4 left-4 right-4 bg-slate-900/90 backdrop-blur-xl border border-white/10 p-3 rounded-lg shadow-2xl">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-black text-white uppercase tracking-widest">
                                  Active Incident Summary
                                </span>
                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                                  Bhanupratappur East
                                </span>
                              </div>
                              <div className="flex gap-4">
                                <div className="flex-1">
                                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-tighter">
                                    High Risk Areas
                                  </p>
                                  <p className="text-sm font-black text-rose-400">
                                    Range A, Sector 4
                                  </p>
                                </div>
                                <div className="w-px h-8 bg-slate-800" />
                                <div className="flex-1">
                                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-tighter">
                                    Current Trend
                                  </p>
                                  <p className="text-sm font-black text-emerald-400">
                                    Down 12%{" "}
                                    <span className="text-[8px] font-mono text-slate-500 uppercase ml-1">
                                      v/s last wk
                                    </span>
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-3 mt-4">
                            <div className="bg-slate-800/30 border border-slate-800 p-3 rounded-xl">
                              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">
                                Response Time
                              </p>
                              <p className="text-xl font-black text-white tabular-nums">
                                24
                                <span className="text-[10px] lowercase text-slate-400 ml-0.5">
                                  min
                                </span>
                              </p>
                            </div>
                            <div className="bg-slate-800/30 border border-slate-800 p-3 rounded-xl">
                              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">
                                Patrol Coverage
                              </p>
                              <p className="text-xl font-black text-white tabular-nums">
                                92
                                <span className="text-[10px] text-slate-400 ml-0.5">
                                  %
                                </span>
                              </p>
                            </div>
                            <div className="bg-slate-800/30 border border-slate-800 p-3 rounded-xl">
                              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">
                                Forest Integrity
                              </p>
                              <p className="text-xl font-black text-emerald-400 tabular-nums">
                                8/10
                              </p>
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
                              margin={{
                                top: 10,
                                right: 10,
                                left: 10,
                                bottom: 20,
                              }}
                            >
                              <CartesianGrid
                                strokeDasharray="3 3"
                                vertical={false}
                                stroke="#f1f5f9"
                              />
                              <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{
                                  fontSize: 10,
                                  fill: "#64748b",
                                  fontWeight: 700,
                                }}
                              />
                              <YAxis hide />
                              <Tooltip
                                cursor={{ fill: "#f8fafc" }}
                                content={({ active, payload, label }) => {
                                  if (active && payload && payload.length) {
                                    return (
                                      <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-2xl">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                          {label}
                                        </p>
                                        <p className="text-sm font-black text-white">
                                          Efficiency: 94%
                                        </p>
                                        <p className="text-[10px] text-emerald-400 font-bold mt-1">
                                          Above target
                                        </p>
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
                                    fill={
                                      index % 2 === 0 ? "#6366f1" : "#10b981"
                                    }
                                    fillOpacity={0.8}
                                  />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>

                          <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200/60">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                Division Productivity
                              </span>
                              <span className="text-xs font-black text-emerald-600">
                                +8.4%
                              </span>
                            </div>
                            <div className="space-y-3">
                              {(forestBeats || [])
                                .slice(0, 3)
                                .map((beat, i) => (
                                  <div
                                    key={i}
                                    className="flex items-center justify-between"
                                  >
                                    <span className="text-[11px] font-bold text-slate-700">
                                      {beat.name}
                                    </span>
                                    <div className="flex items-center gap-3">
                                      <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-indigo-500 rounded-full"
                                          style={{ width: `${80 + i * 5}%` }}
                                        />
                                      </div>
                                      <span className="text-[10px] font-black text-slate-900 tabular-nums">
                                        {80 + i * 5}%
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
                          {liveIncidents.length > 0 ? (
                            liveIncidents.map((incident) => (
                              <div
                                key={incident.id}
                                className="p-3 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all cursor-pointer group"
                                onClick={() =>
                                  openGrievanceDetail(incident.id, incident as any)
                                }
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span
                                    className={`text-xs font-bold uppercase tracking-wide ${incident.severity === "CRITICAL" ? "text-rose-500" : "text-amber-500"}`}
                                  >
                                    {incident.severity}
                                  </span>
                                  <span className="text-[9px] text-slate-400 font-medium">
                                    {new Date(incident.time).toLocaleTimeString(
                                      [],
                                      { hour: "2-digit", minute: "2-digit" },
                                    )}
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
                            ))
                          ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50 space-y-2">
                              <ShieldAlert className="w-8 h-8" />
                              <p className="text-xs font-bold uppercase">
                                No active threats detected
                              </p>
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
                              <span className="text-xs font-bold uppercase tracking-wide">
                                Fire Hazard
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]"></span>
                              <span className="text-xs font-bold uppercase tracking-wide">
                                Wildlife Move
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.8)]"></span>
                              <span className="text-xs font-bold uppercase tracking-wide">
                                Active Patrol
                              </span>
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
                          <h3 className="text-white/80 text-xs font-bold uppercase tracking-wide mb-1">
                            Total Protected Area
                          </h3>
                          <p className="text-3xl font-black tracking-tighter">
                            14,250{" "}
                            <span className="text-lg font-medium opacity-60">
                              HECTARE
                            </span>
                          </p>
                          <div className="mt-4 flex items-center gap-2 bg-white/10 w-fit px-3 py-1 rounded-full border border-white/5">
                            <span className="text-[10px] font-bold">
                              42 Active Geofences
                            </span>
                          </div>
                        </div>
                        <Layers className="absolute -right-8 -bottom-8 w-48 h-48 opacity-10 rotate-12" />
                      </Card>

                      <Card className="p-6 bg-white rounded-2xl shadow-sm border border-slate-100">
                        <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-4">
                          <ShieldAlert className="w-6 h-6 text-indigo-600" />
                        </div>
                        <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wide mb-1">
                          Boundary Violations
                        </h3>
                        <p className="text-3xl font-black tracking-tighter text-slate-900">
                          12{" "}
                          <span className="text-lg font-medium opacity-40 text-rose-500">
                            ↑ 4%
                          </span>
                        </p>
                        <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-tight">
                          Last 30 Days Activity
                        </p>
                      </Card>

                      <Card className="p-6 bg-white rounded-2xl shadow-sm border border-slate-100">
                        <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mb-4">
                          <Trees className="w-6 h-6 text-emerald-600" />
                        </div>
                        <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wide mb-1">
                          Operational Ranges
                        </h3>
                        <p className="text-3xl font-black tracking-tighter text-slate-900">
                          {stats?.mainDepartments || 4}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-tight">
                          Verified Forest Borders
                        </p>
                      </Card>
                    </div>

                    <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden bg-white">
                      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                            Forest Boundary Inventory
                          </h3>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                            Hierarchy of Ranges and Beats
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => {
                              toast.promise(
                                new Promise((resolve) =>
                                  setTimeout(resolve, 2000),
                                ),
                                {
                                  loading: "Processing KMZ Boundaries...",
                                  success:
                                    "Forest boundaries synchronized with Satellite Data",
                                  error: "Failed to sync boundaries",
                                },
                              );
                            }}
                            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 border-0"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Sync KMZ Data
                          </Button>
                          <button className="flex items-center gap-2 bg-[#52c798] text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-[#45b687] shadow-lg shadow-[#52c798]/20 transition-all">
                            <ScanSearch className="w-4 h-4" />
                            Verify Bounds
                          </button>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                              <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                Forest Range
                              </th>
                              <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                Beats Under Range
                              </th>
                              <th className="px-6 py-4 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                Total Area (Ha)
                              </th>
                              <th className="px-6 py-4 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                Incident Hotspots
                              </th>
                              <th className="px-6 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                Integrity Status
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {forestBeats.slice(0, 10).map((beat, i) => (
                              <tr
                                key={i}
                                className="hover:bg-slate-50/50 transition-colors group"
                              >
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-700">
                                      <Trees className="w-4 h-4" />
                                    </div>
                                    <span className="text-sm font-bold text-slate-800">
                                      {beat.range}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex flex-col">
                                    <span className="text-xs font-bold text-slate-700">
                                      {beat.name}
                                    </span>
                                    <span className="text-[9px] text-slate-400 font-mono uppercase mt-0.5">
                                      ID: {beat.id.slice(-8)}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <span className="text-sm font-black text-slate-700">
                                    {(400 + i * 120).toLocaleString()}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <div className="inline-flex items-center gap-2 border border-slate-200 px-3 py-1 rounded-full bg-white shadow-sm">
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${beat.incidents > 5 ? "bg-rose-500 animate-pulse" : "bg-amber-500"}`}
                                    ></span>
                                    <span className="text-[10px] font-black text-slate-700">
                                      {beat.incidents} ACTS
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <span
                                    className={`text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-lg ${beat.status === "Active" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}
                                  >
                                    {beat.status === "Active"
                                      ? "VERIFIED"
                                      : "MAINTENANCE"}
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

              {/* Departments Tab - For Company Admin & Superadmin Drilldown */}
              {canSeeDepartmentsTab && (
                <TabsContent value="departments" className="space-y-4">
                  <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
                    {/* Header */}
                    {/* <CardHeader className="bg-slate-900 px-4 sm:px-6 py-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                        <Building className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-bold text-white flex items-center gap-2 flex-wrap">
                          {isDFO ? "Forest Ranges" : "Departments"}
                          <span className="text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full ml-2">
                            {departmentPagination.total} total
                          </span>
                        </CardTitle>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                          Manage all departments in your company
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                    </div>

                  </div>
                </CardHeader> */}

                    <CardContent className="p-0">
                      <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-200 space-y-4">
                        {/* Top Action Bar */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          {/* Search */}
                          <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                              type="text"
                              placeholder="Search..."
                              value={deptSearch}
                              onChange={(e) => setDeptSearch(e.target.value)}
                              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm text-sm placeholder:text-slate-400 font-medium transition-all"
                            />
                          </div>

                          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                            {isSuperAdminUser &&
                              selectedDepartments.size > 0 && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={handleBulkDeleteDepartments}
                                  disabled={isDeleting}
                                  className="h-10 text-[10px] font-black uppercase bg-red-600 hover:bg-red-700 text-white rounded-xl border border-red-700 shadow-sm transition-all px-4"
                                >
                                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                                  Delete ({selectedDepartments.size})
                                </Button>
                              )}
                            {(isSuperAdminUser ||
                              (hasPermission(
                                user,
                                Permission.CREATE_DEPARTMENT,
                              ) &&
                                !isSubDepartmentAdminRole &&
                                !isOperatorRole)) && (
                              <Button
                                type="button"
                                onClick={() => setShowDepartmentDialog(true)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white border-0 h-9 text-[10px] sm:text-[11px] font-black uppercase tracking-widest rounded-xl px-4 sm:px-6 shadow-md transition-all active:scale-95 whitespace-nowrap"
                              >
                                <Building className="w-4 h-4 mr-2" />
                                Add Department
                              </Button>
                            )}
                            {!(
                              isDepartmentAdminRole ||
                              isSubDepartmentAdminRole ||
                              isOperatorRole
                            ) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setShowDepartmentFiltersOnMobile(
                                    (prev) => !prev,
                                  )
                                }
                                className="md:hidden border-slate-200 hover:bg-slate-50 rounded-xl whitespace-nowrap"
                                title="Toggle filters"
                              >
                                <Filter className="w-4 h-4 mr-1.5" />
                                Filters
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => fetchDepartments(1, false)}
                              disabled={isRefreshing}
                              className="border-slate-200 hover:bg-slate-50 rounded-xl font-bold text-[11px] uppercase tracking-wider whitespace-nowrap"
                              title="Refresh data"
                            >
                              <RefreshCw
                                className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? "animate-spin" : ""}`}
                              />
                              Refresh
                            </Button>
                            {isViewingCompany && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  exportToCSV(departments, "departments", [
                                    { key: "departmentId", label: "ID" },
                                    { key: "name", label: "Name" },
                                    { key: "isActive", label: "Status" },
                                  ])
                                }
                                className="border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-bold text-[11px] uppercase tracking-wider whitespace-nowrap"
                                title="Export to CSV"
                              >
                                <Download className="w-3.5 h-3.5 mr-1.5" />
                                Export
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Filters Row */}
                        <div
                          className={cn(
                            "gap-3 md:items-center",
                            showDepartmentFiltersOnMobile
                              ? "flex flex-col space-y-2 p-3 bg-slate-50/50 rounded-2xl border border-slate-200/60 mt-1"
                              : "hidden md:flex md:flex-row md:items-center md:flex-nowrap",
                          )}
                        >
                          {!(
                            isDepartmentAdminRole ||
                            isSubDepartmentAdminRole ||
                            isOperatorRole
                          ) && (
                            <>
                              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl shadow-sm border border-slate-200">
                                <Filter className="w-4 h-4 text-indigo-500" />
                                <span className="text-sm font-semibold text-slate-700">
                                  Filters
                                </span>
                              </div>

                              <div className="flex w-full flex-col sm:flex-row sm:items-center gap-2 sm:flex-nowrap flex-1 pb-1 sm:pb-0">
                                <select
                                  value={deptFilters.type}
                                  onChange={(e) =>
                                    setDeptFilters((prev) => ({
                                      ...prev,
                                      type: e.target.value,
                                    }))
                                  }
                                  className="w-full md:w-auto text-xs px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm hover:border-indigo-300 transition-colors cursor-pointer min-w-[130px] font-medium"
                                  title="Filter by department type"
                                >
                                  <option value="">🏢 All Types</option>
                                  <option value="main">Main Dept</option>
                                  <option value="sub">Sub Dept</option>
                                </select>

                                <select
                                  value={deptFilters.status}
                                  onChange={(e) =>
                                    setDeptFilters((prev) => ({
                                      ...prev,
                                      status: e.target.value,
                                    }))
                                  }
                                  className="w-full md:w-auto text-xs px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm hover:border-indigo-300 transition-colors cursor-pointer min-w-[130px] font-medium"
                                  title="Filter by status"
                                >
                                  <option value="">📊 All Status</option>
                                  <option value="active">Active</option>
                                  <option value="inactive">Inactive</option>
                                </select>

                                <DashboardDepartmentFilters
                                  allDepartments={allDepartments}
                                  getParentDepartmentId={getParentDepartmentId}
                                  onFiltersChange={(filters) => {
                                    setDeptFilters((prev) => ({
                                      ...prev,
                                      mainDeptId: filters.mainDeptId,
                                      subDeptId: filters.subDeptId,
                                    }));
                                    setDepartmentPage(1);
                                  }}
                                  currentFilters={deptFilters}
                                  className="w-full md:w-auto"
                                />

                                {(deptFilters.type ||
                                  deptFilters.status ||
                                  deptFilters.mainDeptId ||
                                  deptFilters.subDeptId ||
                                  deptSearch.trim()) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setDeptSearch("");
                                      setDeptFilters({
                                        type: "",
                                        status: "",
                                        mainDeptId: "",
                                        subDeptId: "",
                                      });
                                    }}
                                    className="h-8 px-3 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl border border-red-200"
                                    title="Clear all filters"
                                  >
                                    <X className="w-3.5 h-3.5 mr-1.5" />
                                    Clear
                                  </Button>
                                )}
                                {canToggleDepartmentPriorityColumn && (
                                  <div className="flex items-center gap-2 h-8 px-3 rounded-xl border border-slate-200 bg-white shadow-sm">
                                    <Settings className="w-3.5 h-3.5 text-slate-500" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 whitespace-nowrap">
                                      Priority Column
                                    </span>
                                    <Switch
                                      checked={showDepartmentPriorityColumn}
                                      onCheckedChange={
                                        handleToggleDepartmentPriorityColumn
                                      }
                                      aria-label="Toggle priority column visibility for company admin"
                                    />
                                  </div>
                                )}
                              </div>
                            </>
                          )}

                          {/* Pagination Limit & Count */}
                          <div className="flex items-center gap-3 ml-0 md:ml-auto shrink-0 w-full md:w-auto justify-between md:justify-start">
                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl shadow-sm border border-slate-200">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Rows:
                              </span>
                              <select
                                value={departmentPagination.limit}
                                onChange={(e) =>
                                  setDepartmentPagination((prev) => ({
                                    ...prev,
                                    limit: Number(e.target.value),
                                  }))
                                }
                                className="text-[10px] font-bold text-slate-900 bg-transparent border-0 focus:ring-0 cursor-pointer p-0"
                              >
                                {[10, 20, 25, 50, 100].map((l) => (
                                  <option key={l} value={l}>
                                    {l}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <span className="text-[10px] font-bold text-slate-700 bg-white px-3 py-2 rounded-xl shadow-sm border border-slate-200 whitespace-nowrap">
                              Showing{" "}
                              <span className="text-indigo-600 font-black">
                                {departments.length}
                              </span>{" "}
                              of {departmentPagination.total}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/20">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {!isDepartmentAdminRole && (
                            <>
                              <span className="px-2 py-1 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg">
                                {filteredDeptCounts.mainCount} Main
                              </span>
                              <span className="px-2 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg">
                                {filteredDeptCounts.subCount} Sub
                              </span>
                            </>
                          )}
                          {isSuperAdminUser && selectedDepartments.size > 0 && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={handleBulkDeleteDepartments}
                              disabled={isDeleting}
                              className="text-[9px] font-black h-7 px-3 bg-red-600 hover:bg-red-700 text-white rounded-lg border border-red-700 shadow-sm transition-all animate-in zoom-in duration-200"
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              Delete ({selectedDepartments.size})
                            </Button>
                          )}
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
                                  {isSuperAdminUser && (
                                    <th className="px-3 py-3 text-center border-b border-slate-100">
                                      <input
                                        type="checkbox"
                                        checked={
                                          selectedDepartments.size > 0 &&
                                          selectedDepartments.size ===
                                            getSortedData(
                                              departments,
                                              "departments",
                                            ).length
                                        }
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setSelectedDepartments(
                                              new Set(
                                                getSortedData(
                                                  departments,
                                                  "departments",
                                                ).map((d) => d._id),
                                              ),
                                            );
                                          } else {
                                            setSelectedDepartments(new Set());
                                          }
                                        }}
                                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                                      />
                                    </th>
                                  )}
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
                                  {/* <th className="px-4 py-3 text-left border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                    Dept ID
                                  </th> */}
                                  <th className="px-4 py-3 text-center border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                    Type
                                  </th>
                                  <th className="px-4 py-3 text-center border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                    Users
                                  </th>
                                  {showDepartmentPriorityColumn && (
                                    <th className="px-4 py-3 text-center border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                      Priority
                                    </th>
                                  )}
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
                                {getSortedData(departments, "departments").map(
                                  (dept, index) => {
                                    const isMain = !dept.parentDepartmentId;
                                    const userCount =
                                      dept.userCount ||
                                      deptUserCounts[dept._id] ||
                                      0;
                                    const parentName = (() => {
                                      if (
                                        typeof dept.parentDepartmentId ===
                                          "object" &&
                                        dept.parentDepartmentId?.name
                                      ) {
                                        return dept.parentDepartmentId.name;
                                      }
                                      if (
                                        typeof dept.parentDepartmentId ===
                                        "string"
                                      ) {
                                        const parent = allDepartments.find(
                                          (d) =>
                                            d._id === dept.parentDepartmentId,
                                        );
                                        if (parent) return parent.name;
                                      }
                                      return null;
                                    })();
                                    return (
                                      <tr
                                        key={dept._id}
                                        className="hover:bg-indigo-50/30 transition-all duration-150 group/row"
                                      >
                                        {/* Checkbox */}
                                        {isSuperAdminUser && (
                                          <td className="px-3 py-4 text-center">
                                            <input
                                              type="checkbox"
                                              checked={selectedDepartments.has(
                                                dept._id,
                                              )}
                                              onChange={() => {
                                                const next = new Set(
                                                  selectedDepartments,
                                                );
                                                if (next.has(dept._id))
                                                  next.delete(dept._id);
                                                else next.add(dept._id);
                                                setSelectedDepartments(next);
                                              }}
                                              className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                                            />
                                          </td>
                                        )}

                                        {/* # */}
                                        <td className="px-3 py-4 text-center">
                                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-500 text-[10px] font-black group-hover/row:bg-indigo-100 group-hover/row:text-indigo-700 transition-colors">
                                            {(departmentPage - 1) *
                                              departmentPagination.limit +
                                              index +
                                              1}
                                          </span>
                                        </td>

                                        {/* Department Name */}
                                        <td className="px-3 py-3 sm:px-4 sm:py-4">
                                          <div className="flex items-center gap-2.5">
                                            <div
                                              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                                isMain
                                                  ? "bg-indigo-50 text-indigo-600 border border-indigo-100"
                                                  : "bg-slate-100 text-slate-500 border border-slate-200"
                                              }`}
                                            >
                                              <Building className="w-3 h-3" />
                                            </div>
                                            <div>
                                              <div className="text-[13px] sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                                                {dept.name}
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
                                        {/* <td className="px-4 py-4 whitespace-nowrap">
                                          <span className="inline-flex items-center text-[10px] font-bold bg-slate-50 text-slate-600 px-2 py-0.5 rounded border border-slate-200 uppercase tracking-tighter shadow-sm">
                                            {dept.departmentId}
                                          </span>
                                        </td> */}

                                        {/* Type */}
                                        <td className="px-4 py-4 text-center whitespace-normal">
                                          {isMain ? (
                                            <button
                                              onClick={() => {
                                                setSelectedDeptForHierarchy(
                                                  dept,
                                                );
                                                setShowHierarchyDialog(true);
                                              }}
                                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100 hover:border-indigo-300 transition-all cursor-pointer active:scale-95"
                                              title="View Hierarchy Tree"
                                            >
                                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                              Main
                                            </button>
                                          ) : (
                                            <button
                                              onClick={() => {
                                                setSelectedDeptForHierarchy(
                                                  dept,
                                                );
                                                setShowHierarchyDialog(true);
                                              }}
                                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 hover:border-slate-300 transition-all cursor-pointer active:scale-95"
                                              title="View Hierarchy Tree"
                                            >
                                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                              Sub
                                            </button>
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
                                                  : "No users assigned"
                                              }
                                            >
                                              <Users
                                                className={`w-3 h-3 mr-1.5 ${userCount > 0 ? "text-emerald-500" : "text-slate-400"}`}
                                              />
                                              {userCount}
                                            </button>
                                          </div>
                                        </td>

                                        {/* Priority */}
                                        {showDepartmentPriorityColumn && (
                                          <td className="px-4 py-4 text-center">
                                            {isMain ? (
                                              canManageDepartmentPriority ? (
                                                <div className="flex items-center justify-center gap-1.5">
                                                  <input
                                                    type="number"
                                                    min={0}
                                                    step={1}
                                                    value={
                                                      priorityDrafts[dept._id] ??
                                                      String(
                                                        dept.displayOrder ?? 999,
                                                      )
                                                    }
                                                    onChange={(e) =>
                                                      setPriorityDrafts((prev) => ({
                                                        ...prev,
                                                        [dept._id]: e.target.value,
                                                      }))
                                                    }
                                                    className="w-16 h-8 rounded-lg border border-slate-300 px-2 text-center text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                                                    title="Lower number appears first in chatbot list"
                                                  />
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 px-2 text-[10px] font-black text-indigo-600 hover:bg-indigo-50 disabled:opacity-60"
                                                    onClick={() =>
                                                      handleSaveDepartmentPriority(
                                                        dept,
                                                      )
                                                    }
                                                    disabled={savingPriorityIds.has(
                                                      dept._id,
                                                    )}
                                                    title="Save priority"
                                                  >
                                                    {savingPriorityIds.has(
                                                      dept._id,
                                                    )
                                                      ? "Saving..."
                                                      : "Save"}
                                                  </Button>
                                                </div>
                                              ) : (
                                                <span className="inline-flex items-center justify-center min-w-[42px] h-8 rounded-lg border border-amber-200 bg-amber-50 px-2 text-xs font-black text-amber-700">
                                                  {typeof dept.displayOrder ===
                                                  "number"
                                                    ? dept.displayOrder
                                                    : 999}
                                                </span>
                                              )
                                            ) : (
                                              <span className="text-[10px] font-bold text-slate-300">
                                                -
                                              </span>
                                            )}
                                          </td>
                                        )}

                                        {/* Head / Contact */}
                                        <td className="px-4 py-4 whitespace-normal break-words">
                                          <div className="flex flex-col gap-1 min-w-[120px]">
                                            <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-tight">
                                              <UserIcon className="w-3 h-3 text-slate-400 shrink-0" />
                                              {dept.head ||
                                                (dept as any).headName ||
                                                dept.contactPerson || (
                                                  <span className="text-slate-300 font-medium">
                                                    Not assigned
                                                  </span>
                                                )}
                                            </div>
                                            {(dept.headEmail ||
                                              dept.contactEmail) && (
                                              <div className="text-[10px] text-indigo-500 flex items-center gap-1.5 font-bold hover:underline cursor-pointer transition-colors px-1 break-all">
                                                <Mail className="w-3 h-3 text-indigo-300 shrink-0" />
                                                {dept.headEmail ||
                                                  dept.contactEmail}
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
                                                            isActive:
                                                              !dept.isActive,
                                                          },
                                                        );
                                                      if (response.success) {
                                                        toast.success(
                                                          `Department ${!dept.isActive ? "activated" : "deactivated"} successfully`,
                                                        );
                                                        fetchDepartments(
                                                          1,
                                                          true,
                                                        );
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
                                              {dept.isActive
                                                ? "Active"
                                                : "Inactive"}
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
                                              title="Edit Department"
                                            >
                                              <Edit2 className="w-3.5 h-3.5" />
                                            </Button>

                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-8 w-8 p-0 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                                              onClick={() => {
                                                setSelectedDeptForUsers({
                                                  id: dept._id,
                                                  name: dept.name,
                                                });
                                                setShowDeptUsersDialog(true);
                                              }}
                                              title="Manage Department Personnel"
                                            >
                                              <Users className="w-3.5 h-3.5" />
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
                                                        setDepartments((prev) =>
                                                          prev.filter(
                                                            (d) =>
                                                              d._id !==
                                                              dept._id,
                                                          ),
                                                        );
                                                        fetchDepartments(
                                                          1,
                                                          false,
                                                        );
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
                                  },
                                )}
                              </tbody>
                            </table>
                          </div>

                          {/* Footer info & Pagination */}
                          <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              Showing{" "}
                              {(departmentPage - 1) *
                                departmentPagination.limit +
                                1}{" "}
                              to{" "}
                              {Math.min(
                                departmentPage * departmentPagination.limit,
                                departmentPagination.total,
                              )}{" "}
                              of {departmentPagination.total} departments
                            </div>
                            {departmentPagination.pages > 1 && (
                              <Pagination
                                currentPage={departmentPage}
                                totalPages={departmentPagination.pages}
                                totalItems={departmentPagination.total}
                                itemsPerPage={departmentPagination.limit}
                                onPageChange={(p) => setDepartmentPage(p)}
                              />
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              {/* Leads Tab Content */}
              {hasModule(Module.LEAD_CAPTURE) && isViewingCompany && (
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
                        {isViewingCompany && (
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
                        )}
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
                                      {lead.status
                                        ?.toLowerCase()
                                        .replace("_", " ")}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-sm text-slate-500">
                                    {new Date(
                                      lead.createdAt,
                                    ).toLocaleDateString()}
                                    <div className="text-xs text-slate-400">
                                      {new Date(
                                        lead.createdAt,
                                      ).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
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
              {canSeeUsersTab && (
                <TabsContent value="users" className="space-y-6">
                  <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
                    {/* <CardHeader className="bg-slate-900 px-4 sm:px-6 py-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                        <Users className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-bold text-white flex flex-wrap items-center gap-2">
                          User Management
                          <span className="text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full ml-2">
                            {userPagination.total} total
                          </span>
                        </CardTitle>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                          {isViewingCompany
                            ? "Manage users in your company"
                            : "Manage users in your department"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                    </div>
                  </div>
                </CardHeader> */}
                    <CardContent className="p-0">
                      <>
                        <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-200 space-y-4">
                          {/* Top Action Bar */}
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            {/* Search */}
                            <div className="relative flex-1 max-w-md">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <input
                                type="text"
                                placeholder="Search..."
                                value={userSearch}
                                onChange={(e) => {
                                  setUserSearch(e.target.value);
                                  setUserPage(1);
                                }}
                                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm text-sm placeholder:text-slate-400 font-medium transition-all"
                              />
                            </div>

                            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                              {isSuperAdminUser && selectedUsers.size > 0 && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={handleBulkDeleteUsers}
                                  disabled={isDeleting}
                                  className="h-10 text-[10px] font-black uppercase bg-red-600 hover:bg-red-700 text-white rounded-xl border border-red-700 shadow-sm transition-all px-4"
                                >
                                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                                  Delete ({selectedUsers.size})
                                </Button>
                              )}

                              {(isSuperAdminUser ||
                                hasPermission(
                                  user,
                                  Permission.CREATE_USER,
                                )) && (
                                <Button
                                  type="button"
                                  onClick={() => setShowUserDialog(true)}
                                  className="bg-indigo-600 hover:bg-indigo-700 text-white border-0 h-9 text-[10px] sm:text-[11px] font-black uppercase tracking-widest rounded-xl px-4 sm:px-6 shadow-md transition-all active:scale-95 whitespace-nowrap"
                                >
                                  <UserPlus className="w-4 h-4 mr-2" />
                                  Add User
                                </Button>
                              )}
                              {!(
                                isDepartmentAdminRole ||
                                isSubDepartmentAdminRole ||
                                isOperatorRole
                              ) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setShowUserFiltersOnMobile((prev) => !prev)
                                  }
                                  className="md:hidden border-slate-200 hover:bg-slate-50 rounded-xl whitespace-nowrap"
                                  title="Toggle filters"
                                >
                                  <Filter className="w-4 h-4 mr-1.5" />
                                  Filters
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => fetchUsers(1, false)}
                                disabled={isRefreshing}
                                className="border-slate-200 hover:bg-slate-50 rounded-xl font-bold text-[11px] uppercase tracking-wider whitespace-nowrap"
                                title="Refresh data"
                              >
                                <RefreshCw
                                  className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? "animate-spin" : ""}`}
                                />
                                Refresh
                              </Button>
                              {isViewingCompany && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    exportToCSV(users, "users", [
                                      { key: "firstName", label: "First Name" },
                                      { key: "lastName", label: "Last Name" },
                                      { key: "email", label: "Email" },
                                      { key: "phone", label: "Phone" },
                                      { key: "role", label: "Role" },
                                    ])
                                  }
                                  className="border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-bold text-[11px] uppercase tracking-wider whitespace-nowrap"
                                  title="Export to CSV"
                                >
                                  <Download className="w-3.5 h-3.5 mr-1.5" />
                                  Export
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Filters Row */}
                          <div
                            className={cn(
                              "gap-4 md:items-center",
                              showUserFiltersOnMobile
                                ? "flex flex-col space-y-3 p-4 bg-slate-100/50 rounded-2xl border border-slate-200/60 mt-2 shadow-inner"
                                : "hidden md:flex md:flex-row md:flex-wrap",
                            )}
                          >
                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl shadow-sm border border-slate-200">
                              <Filter className="w-4 h-4 text-indigo-500" />
                              <span className="text-sm font-semibold text-slate-700">
                                Filters
                              </span>
                            </div>

                            <div className="flex w-full flex-col md:flex-row md:items-center gap-3 flex-wrap flex-1 pb-1 md:pb-0">
                              <select
                                value={userFilters.role}
                                onChange={(e) => {
                                  setUserFilters((prev) => ({
                                    ...prev,
                                    role: e.target.value,
                                  }));
                                  setUserPage(1);
                                }}
                                className="w-full md:w-auto text-xs px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm hover:border-indigo-300 transition-colors cursor-pointer min-w-[130px] font-medium"
                                title="Filter by role"
                              >
                                <option value="">👤 All Roles</option>
                                {roles.map((role: any) => (
                                  <option
                                    key={role._id}
                                    value={`CUSTOM:${role._id}`}
                                  >
                                    {role.name}
                                  </option>
                                ))}
                                {isSuperAdminUser && (
                                  <option value="SUPER_ADMIN">
                                    Super Admin
                                  </option>
                                )}
                              </select>

                              <select
                                value={userFilters.status}
                                onChange={(e) => {
                                  setUserFilters((prev) => ({
                                    ...prev,
                                    status: e.target.value,
                                  }));
                                  setUserPage(1);
                                }}
                                className="w-full md:w-auto text-xs px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm hover:border-indigo-300 transition-colors cursor-pointer min-w-[130px] font-medium"
                                title="Filter by status"
                              >
                                <option value="">📊 All Status</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                              </select>

                              <DashboardDepartmentFilters
                                allDepartments={allDepartments}
                                getParentDepartmentId={getParentDepartmentId}
                                onFiltersChange={(filters) => {
                                  setUserFilters((prev) => ({
                                    ...prev,
                                    mainDeptId: filters.mainDeptId,
                                    subDeptId: filters.subDeptId,
                                  }));
                                  setUserPage(1);
                                }}
                                currentFilters={userFilters}
                                className="w-full md:w-auto"
                              />

                              {(userFilters.role ||
                                userFilters.status ||
                                userFilters.mainDeptId ||
                                userFilters.subDeptId ||
                                userSearch.trim()) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setUserSearch("");
                                    setUserFilters({
                                      role: "",
                                      status: "",
                                      mainDeptId: "",
                                      subDeptId: "",
                                    });
                                    setUserPage(1);
                                  }}
                                  className="h-8 px-3 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl border border-red-200"
                                  title="Clear all filters"
                                >
                                  <X className="w-3.5 h-3.5 mr-1.5" />
                                  Clear
                                </Button>
                              )}
                            </div>

                            {/* Pagination Limit & Count */}
                            <div className="flex items-center gap-3 ml-0 md:ml-auto shrink-0 w-full md:w-auto justify-between md:justify-start">
                              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl shadow-sm border border-slate-200">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                  Rows:
                                </span>
                                <select
                                  value={userPagination.limit}
                                  onChange={(e) =>
                                    setUserPagination((prev) => ({
                                      ...prev,
                                      limit: Number(e.target.value),
                                    }))
                                  }
                                  className="text-[10px] font-bold text-slate-900 bg-transparent border-0 focus:ring-0 cursor-pointer p-0"
                                >
                                  {[10, 20, 25, 50, 100].map((l) => (
                                    <option key={l} value={l}>
                                      {l}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <span className="text-[10px] font-bold text-slate-700 bg-white px-3 py-2 rounded-xl shadow-sm border border-slate-200">
                                Total{" "}
                                <span className="text-indigo-600 font-black">
                                  {userPagination.total}
                                </span>{" "}
                                Users
                              </span>
                            </div>
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
                          <div
                            key="users-master-wrapper-final"
                            className="overflow-hidden"
                          >
                            <div className="overflow-x-auto custom-scrollbar">
                              <table className="w-full min-w-[980px] relative border-collapse table-auto">
                                <thead className="bg-[#fcfdfe] border-b border-slate-200">
                                  <tr>
                                    {isSuperAdminUser && (
                                      <th className="px-3 py-3 text-center">
                                        <input
                                          type="checkbox"
                                          checked={
                                            selectedUsers.size > 0 &&
                                            selectedUsers.size ===
                                              getSortedData(users, "users")
                                                .length
                                          }
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setSelectedUsers(
                                                new Set(
                                                  getSortedData(
                                                    users,
                                                    "users",
                                                  ).map((u) => u._id),
                                                ),
                                              );
                                            } else {
                                              setSelectedUsers(new Set());
                                            }
                                          }}
                                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                                        />
                                      </th>
                                    )}
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
                                        onClick={() =>
                                          handleSort("email", "users")
                                        }
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
                                        onClick={() =>
                                          handleSort("role", "users")
                                        }
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
                                        {/* Checkbox */}
                                        {isSuperAdminUser && (
                                          <td className="px-3 py-4 text-center">
                                            <input
                                              type="checkbox"
                                              checked={selectedUsers.has(u._id)}
                                              onChange={() => {
                                                const next = new Set(
                                                  selectedUsers,
                                                );
                                                if (next.has(u._id))
                                                  next.delete(u._id);
                                                else next.add(u._id);
                                                setSelectedUsers(next);
                                              }}
                                              className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                                            />
                                          </td>
                                        )}

                                        {/* Sr */}
                                        <td className="px-3 py-5 text-center">
                                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 text-emerald-700 text-xs font-bold shadow-sm">
                                            {(userPage - 1) *
                                              userPagination.limit +
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
                                                      await userAPI.getById(
                                                        u._id,
                                                      );
                                                    if (response.success) {
                                                      setSelectedUserForDetails(
                                                        response.data.user,
                                                      );
                                                      setShowUserDetailsDialog(
                                                        true,
                                                      );
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
                                              <div className="mt-1 flex flex-wrap gap-1">
                                                {/* Unified Multi-Designation Badges */}
                                                {(() => {
                                                  const list =
                                                    u.designations || [];
                                                  if (list.length === 0)
                                                    return null;

                                                  return list.map(
                                                    (d: string, i: number) => (
                                                      <span
                                                        key={i}
                                                        className="bg-slate-100 text-slate-700 border-slate-300 text-[8.5px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-tight shadow-sm border transition-all"
                                                      >
                                                        {d}
                                                      </span>
                                                    ),
                                                  );
                                                })()}
                                                <span className="text-[8px] font-black bg-slate-50 text-slate-400 px-1.5 py-0.5 rounded-md border border-slate-100 uppercase tracking-widest w-fit">
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
                                            {isSuperAdminUser &&
                                              u.notificationSettings && (
                                                <div className="flex items-center gap-2 mt-2">
                                                  <div
                                                    title={`Email Notifications: ${u.notificationSettings.email ? "Enabled" : "Disabled"}`}
                                                    className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter border flex items-center gap-1 ${
                                                      u.notificationSettings
                                                        .email
                                                        ? "bg-blue-50 text-blue-600 border-blue-100"
                                                        : "bg-slate-50 text-slate-300 border-slate-100"
                                                    }`}
                                                  >
                                                    <Mail
                                                      className={`w-2.5 h-2.5 ${u.notificationSettings.email ? "text-blue-500" : "text-slate-300"}`}
                                                    />
                                                    Email
                                                  </div>
                                                  <div
                                                    title={`WhatsApp Notifications: ${u.notificationSettings.whatsapp ? "Enabled" : "Disabled"}`}
                                                    className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter border flex items-center gap-1 ${
                                                      u.notificationSettings
                                                        .whatsapp
                                                        ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                                                        : "bg-slate-50 text-slate-300 border-slate-100"
                                                    }`}
                                                  >
                                                    <TrendingUp
                                                      className={`w-2.5 h-2.5 ${u.notificationSettings.whatsapp ? "text-emerald-500" : "text-slate-300"}`}
                                                    />
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
                                                  u.level === 1
                                                    ? "bg-slate-100 text-slate-700 border-slate-300 ring-1 ring-slate-200 shadow-slate-900/5"
                                                    : typeof u.customRoleId ===
                                                          "object" &&
                                                        u.customRoleId
                                                      ? "bg-slate-50 text-slate-600 border-slate-200 ring-1 ring-slate-100 shadow-slate-900/5"
                                                      : (u.level === 2 &&
                                                            typeof u.departmentId ===
                                                              "object" &&
                                                            (
                                                              u.departmentId as any
                                                            )
                                                              ?.parentDepartmentId) ||
                                                          u.level === 3
                                                        ? "bg-slate-50 text-slate-500 border-slate-200"
                                                        : "bg-slate-50 text-slate-500 border-slate-200"
                                                }`}
                                              >
                                                <Shield className="w-2.5 h-2.5 mr-1 opacity-60" />
                                                {typeof u.customRoleId ===
                                                  "object" && u.customRoleId
                                                  ? (u.customRoleId as any).name
                                                  : (u.level === 2 &&
                                                        typeof u.departmentId ===
                                                          "object" &&
                                                        (u.departmentId as any)
                                                          ?.parentDepartmentId) ||
                                                      u.level === 3
                                                    ? "Sub Department Admin"
                                                    : isSuperAdmin(u)
                                                      ? "Super Admin"
                                                      : u.level === 1
                                                        ? "Company Admin"
                                                        : u.level === 2
                                                          ? "Department Admin"
                                                          : u.level === 4
                                                            ? "Operator"
                                                            : u.level === 5
                                                              ? "Analytics Viewer"
                                                              : (
                                                                  u.role || ""
                                                                ).replace(
                                                                  /_/g,
                                                                  " ",
                                                                )}
                                              </span>
                                            </div>
                                            <div className="flex flex-col gap-1.5 min-w-[150px]">
                                              {(() => {
                                                const deptList = (
                                                  u.departmentIds || []
                                                ).map((d: any) => {
                                                  const id =
                                                    typeof d === "object"
                                                      ? d._id
                                                      : d;
                                                  const name =
                                                    typeof d === "object"
                                                      ? d.name
                                                      : allDepartments.find(
                                                          (dept: any) =>
                                                            dept._id === id,
                                                        )?.name || id;
                                                  return { id, name };
                                                });

                                                if (deptList.length === 0)
                                                  return (
                                                    <div className="flex items-center text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">
                                                      <Building className="w-3.5 h-3.5 mr-1.5 opacity-50" />
                                                      All Company Access
                                                    </div>
                                                  );

                                                return (
                                                  <div className="space-y-1">
                                                    {deptList.map(
                                                      (d: any, i: number) => (
                                                        <div
                                                          key={i}
                                                          className="flex items-start text-[10px] font-black uppercase tracking-tight leading-tight text-indigo-700 transition-colors"
                                                        >
                                                          <Building className="w-2.5 h-2.5 mr-1 mt-0.5 opacity-60" />
                                                          {d.name}
                                                        </div>
                                                      ),
                                                    )}
                                                  </div>
                                                );
                                              })()}
                                            </div>
                                            {/* Show permissions summary for custom roles */}
                                            {typeof u.customRoleId ===
                                              "object" &&
                                              u.customRoleId &&
                                              (u.customRoleId as any)
                                                .permissions?.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-0.5">
                                                  {(
                                                    u.customRoleId as any
                                                  ).permissions
                                                    .slice(0, 3)
                                                    .map(
                                                      (p: any, i: number) => (
                                                        <span
                                                          key={i}
                                                          className="text-[8px] font-black text-indigo-400 bg-indigo-50/50 px-1 py-px rounded uppercase tracking-tighter border border-indigo-100/50"
                                                        >
                                                          {p.module?.replace(
                                                            /_/g,
                                                            " ",
                                                          )}
                                                        </span>
                                                      ),
                                                    )}
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
                                                {u.isActive
                                                  ? "Active"
                                                  : "Inactive"}
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
                                                disabled={
                                                  user && u._id === user.id
                                                }
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
                                                {u.isActive
                                                  ? "Active"
                                                  : "Inactive"}
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
                                                disabled={
                                                  user && u._id === user.id
                                                }
                                                onClick={() => {
                                                  // Prevent self-deletion
                                                  if (
                                                    user &&
                                                    u._id === user.id
                                                  ) {
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
                                                          await userAPI.delete(
                                                            u._id,
                                                          );
                                                        if (response.success) {
                                                          toast.success(
                                                            "User deleted successfully",
                                                          );
                                                          setUsers((prev) =>
                                                            prev.filter(
                                                              (user) =>
                                                                user._id !==
                                                                u._id,
                                                            ),
                                                          );
                                                          fetchUsers(
                                                            userPage,
                                                            true,
                                                          );
                                                          fetchDashboardData(
                                                            true,
                                                          );
                                                        }
                                                      } catch (error: any) {
                                                        const errorMessage =
                                                          error.response?.data
                                                            ?.message ||
                                                          error.message ||
                                                          "Failed to delete user";
                                                        toast.error(
                                                          errorMessage,
                                                        );
                                                      } finally {
                                                        setConfirmDialog(
                                                          (p) => ({
                                                            ...p,
                                                            isOpen: false,
                                                          }),
                                                        );
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

                            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              {isSuperAdminUser && selectedUsers.size > 0 && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={handleBulkDeleteUsers}
                                  disabled={isDeleting}
                                  className="text-[9px] font-black h-7 px-3 bg-red-600 hover:bg-red-700 text-white rounded-lg border border-red-700 shadow-sm transition-all animate-in zoom-in duration-200"
                                >
                                  <Trash2 className="w-3 h-3 mr-1" />
                                  Delete ({selectedUsers.size})
                                </Button>
                              )}

                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg whitespace-nowrap">
                                Showing{" "}
                                <span className="text-indigo-600">
                                  {getSortedData(users, "users").length}
                                </span>{" "}
                                Records
                              </span>
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
                      </>
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              {/* Grievances Tab - Sophisticated Professional Inbox */}
              {hasModule(Module.GRIEVANCE) &&
                (isViewingCompany || isDepartmentLevel) && (
                  <TabsContent value="grievances" className="space-y-4">
                    <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
                      {/* <CardHeader className="bg-slate-900 px-6 py-2">
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
                  </CardHeader> */}

                      {/* Grievance Filters */}
                      <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-200">
                        {/* Search and Actions Bar */}
                        <div className="flex items-center justify-between gap-4 mb-3">
                          <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                              type="text"
                              placeholder="Search..."
                              value={grievanceSearch}
                              onChange={(e) => {
                                setGrievanceSearch(e.target.value);
                                setGrievancePage(1);
                              }}
                              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm text-sm placeholder:text-slate-400"
                            />
                          </div>
                          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setShowGrievanceFiltersOnMobile((prev) => !prev)
                              }
                              className="md:hidden border-slate-200 hover:bg-slate-50 rounded-xl whitespace-nowrap"
                              title="Toggle filters"
                            >
                              <Filter className="w-4 h-4 mr-1.5" />
                              Filters
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleRefreshData}
                              disabled={isRefreshing}
                              className="border-slate-200 hover:bg-slate-50 rounded-xl whitespace-nowrap"
                              title="Refresh data"
                            >
                              <RefreshCw
                                className={`w-4 h-4 mr-1.5 ${isRefreshing ? "animate-spin" : ""}`}
                              />
                              Refresh
                            </Button>
                            {isViewingCompany && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  exportToCSV(
                                    getSortedData(grievances, "grievances"),
                                    "grievances",
                                    [
                                      { key: "grievanceId", label: "ID" },
                                      {
                                        key: "citizenName",
                                        label: "Citizen Name",
                                      },
                                      { key: "citizenPhone", label: "Phone" },
                                      { key: "category", label: "Category" },
                                      { key: "status", label: "Status" },
                                      { key: "createdAt", label: "Created At" },
                                    ],
                                  )
                                }
                                className="border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl whitespace-nowrap"
                                title="Export to CSV"
                              >
                                <FileDown className="w-4 h-4 mr-1.5" />
                                Export
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Filters Row */}
                        <div
                          className={cn(
                            "items-center gap-3 flex-wrap",
                            showGrievanceFiltersOnMobile
                              ? "flex"
                              : "hidden md:flex",
                          )}
                        >
                          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl shadow-sm border border-slate-200">
                            <Filter className="w-4 h-4 text-indigo-500" />
                            <span className="text-sm font-semibold text-slate-700">
                              Filters
                            </span>
                          </div>

                          {/* Status Filter */}
                          <select
                            value={grievanceFilters.status}
                            onChange={(e) => {
                              setGrievanceFilters((prev) => ({
                                ...prev,
                                status: e.target.value,
                              }));
                              setGrievancePage(1);
                            }}
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

                          <DashboardDepartmentFilters
                            allDepartments={allDepartments}
                            getParentDepartmentId={getParentDepartmentId}
                            onFiltersChange={(filters) => {
                              setGrievanceFilters((prev) => ({
                                ...prev,
                                mainDeptId: filters.mainDeptId,
                                subDeptId: filters.subDeptId,
                                department: "", // reset old filter
                              }));
                              setGrievancePage(1);
                            }}
                            currentFilters={grievanceFilters}
                            className="w-full md:w-auto"
                          />

                          {/* Assignment Status Filter */}
                          <select
                            value={grievanceFilters.assignmentStatus}
                            onChange={(e) => {
                              setGrievanceFilters((prev) => ({
                                ...prev,
                                assignmentStatus: e.target.value,
                              }));
                              setGrievancePage(1);
                            }}
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
                            onChange={(e) => {
                              setGrievanceFilters((prev) => ({
                                ...prev,
                                overdueStatus: e.target.value,
                              }));
                              setGrievancePage(1);
                            }}
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
                            onChange={(e) => {
                              setGrievanceFilters((prev) => ({
                                ...prev,
                                dateRange: e.target.value,
                              }));
                              setGrievancePage(1);
                            }}
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

                          {isSuperAdminDrilldown &&
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

                          {/* Redundant Bulk Delete Button removed (consolidated above) */}

                          {/* Rows per page Selector */}
                          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              Rows:
                            </span>
                            <select
                              value={grievancePagination.limit}
                              onChange={(e) =>
                                setGrievancePagination((prev) => ({
                                  ...prev,
                                  limit: Number(e.target.value),
                                }))
                              }
                              className="text-[10px] font-bold text-slate-900 bg-transparent border-0 focus:ring-0 cursor-pointer"
                            >
                              {[10, 20, 25, 50, 100].map((l) => (
                                <option key={l} value={l}>
                                  {l}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Results count */}
                          <span className="text-xs text-slate-500 ml-auto bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-200">
                            Showing{" "}
                            <span className="font-semibold text-indigo-600">
                              {getSortedData(grievances, "grievances").length}
                            </span>{" "}
                            of {grievances.length} grievances
                          </span>
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
                                    {isSuperAdminUser && (
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
                                          handleSort(
                                            "grievanceId",
                                            "grievances",
                                          )
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
                                          handleSort(
                                            "citizenName",
                                            "grievances",
                                          )
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
                                        {isSuperAdminUser && (
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
                                                  newSelected.add(
                                                    grievance._id,
                                                  );
                                                } else {
                                                  newSelected.delete(
                                                    grievance._id,
                                                  );
                                                }
                                                setSelectedGrievances(
                                                  newSelected,
                                                );
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
                                            onClick={() =>
                                              openGrievanceDetail(grievance._id)
                                            }
                                            className="font-bold text-sm text-blue-700 hover:text-blue-800 hover:underline"
                                          >
                                            {grievance.grievanceId}
                                          </button>
                                        </td>
                                        <td className="px-4 py-4">
                                          <div className="flex flex-col">
                                            <button
                                              onClick={() =>
                                                openGrievanceDetail(
                                                  grievance._id,
                                                  grievance,
                                                )
                                              }
                                              className="text-gray-900 font-bold text-sm text-left hover:text-blue-600 hover:underline"
                                            >
                                              {grievance.citizenName}
                                            </button>
                                            <div className="flex items-center text-xs text-gray-500 font-medium">
                                              <Phone className="w-3 h-3 mr-1.5" />
                                              {formatTo10Digits(
                                                grievance.citizenPhone,
                                              )}
                                            </div>
                                          </div>
                                        </td>
                                        <td className="px-4 py-4">
                                          <div className="flex flex-col">
                                            <span className="text-xs font-semibold text-gray-700">
                                              {typeof grievance.departmentId ===
                                                "object" &&
                                              grievance.departmentId
                                                ? grievance.subDepartmentId &&
                                                  typeof grievance.subDepartmentId ===
                                                    "object"
                                                  ? `${(grievance.departmentId as any).name} - ${(grievance.subDepartmentId as any).name}`
                                                  : (
                                                      grievance.departmentId as any
                                                    ).name
                                                : "Collector & DM"}
                                            </span>
                                            <span className="text-[10px] text-orange-400 uppercase">
                                              {grievance.category}
                                            </span>
                                          </div>
                                        </td>
                                        <td className="px-4 py-4">
                                          <div className="flex flex-col">
                                            {grievance.assignedTo ? (
                                              <>
                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                  <span className="text-xs font-semibold text-indigo-700">
                                                    {typeof grievance.assignedTo ===
                                                      "object" &&
                                                    grievance.assignedTo !==
                                                      null
                                                      ? `${(grievance.assignedTo as any).firstName} ${(grievance.assignedTo as any).lastName}`
                                                      : users.find(
                                                            (u) =>
                                                              u._id ===
                                                                grievance.assignedTo ||
                                                              u.userId ===
                                                                grievance.assignedTo,
                                                          )?.firstName
                                                        ? (() => {
                                                            const found =
                                                              users.find(
                                                                (u) =>
                                                                  u._id ===
                                                                    grievance.assignedTo ||
                                                                  u.userId ===
                                                                    grievance.assignedTo,
                                                              );
                                                            return `${found?.firstName} ${found?.lastName}`;
                                                          })()
                                                        : grievance.assignedTo}
                                                  </span>
                                                  {typeof grievance.assignedTo ===
                                                    "object" &&
                                                    (
                                                      grievance.assignedTo as any
                                                    ).designation && (
                                                      <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full font-medium">
                                                        {
                                                          (
                                                            grievance.assignedTo as any
                                                          ).designation
                                                        }
                                                      </span>
                                                    )}
                                                </div>
                                                {grievance.assignedAt && (
                                                  <span className="text-[10px] text-slate-400 font-medium">
                                                    Assigned:{" "}
                                                    {new Date(
                                                      grievance.assignedAt,
                                                    ).toLocaleDateString()}
                                                  </span>
                                                )}
                                              </>
                                            ) : (
                                              <div className="flex items-center gap-1.5 text-slate-400 italic">
                                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                                <span className="text-[11px]">
                                                  Unassigned
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        </td>
                                        <td className="px-4 py-4">
                                          <button
                                            /* onClick={() => {
                                              // Status updates now open from the Actions column.
                                            }} */
                                            disabled={
                                              grievance.status === "RESOLVED" ||
                                              grievance.status === "CLOSED" ||
                                              grievance.status === "REJECTED" ||
                                              updatingGrievanceStatus.has(
                                                grievance._id,
                                              )
                                            }
                                            className={`px-3 py-1.5 text-[10px] font-bold border border-gray-200 rounded bg-white uppercase tracking-tight transition-all cursor-default ${
                                              updatingGrievanceStatus.has(
                                                grievance._id,
                                              )
                                                ? "opacity-50 cursor-wait"
                                                : ""
                                            } ${
                                              grievance.status === "RESOLVED" ||
                                              grievance.status === "CLOSED" ||
                                              grievance.status === "REJECTED"
                                                ? "opacity-60"
                                                : ""
                                            }`}
                                          >
                                            {grievance.status}
                                          </button>
                                        </td>
                                        <td className="px-4 py-4">
                                          {(() => {
                                            const createdDate = new Date(
                                              grievance.createdAt,
                                            );
                                            const now = new Date();
                                            const hoursDiff = Math.floor(
                                              (now.getTime() -
                                                createdDate.getTime()) /
                                                (1000 * 60 * 60),
                                            );

                                            let isOverdue = false;
                                            let slaHours = 0;

                                            if (
                                              grievance.status === "PENDING"
                                            ) {
                                              slaHours = 24;
                                              isOverdue = hoursDiff > slaHours;
                                            } else if (
                                              grievance.status === "ASSIGNED"
                                            ) {
                                              slaHours = 120;
                                              const assignedDate =
                                                grievance.assignedAt
                                                  ? new Date(
                                                      grievance.assignedAt,
                                                    )
                                                  : createdDate;
                                              const hoursFromAssigned =
                                                Math.floor(
                                                  (now.getTime() -
                                                    assignedDate.getTime()) /
                                                    (1000 * 60 * 60),
                                                );
                                              isOverdue =
                                                hoursFromAssigned > slaHours;
                                            }

                                            if (
                                              grievance.status === "RESOLVED"
                                            ) {
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
                                            {hasPermission(
                                              user,
                                              Permission.ASSIGN_GRIEVANCE,
                                            ) &&
                                              (canReopenResolvedGrievance ||
                                                (grievance.status !==
                                                  "RESOLVED" &&
                                                  grievance.status !==
                                                    "CLOSED" &&
                                                  grievance.status !==
                                                    "REJECTED")) && (
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
                                            {hasPermission(
                                              user,
                                              Permission.REVERT_GRIEVANCE,
                                            ) &&
                                              isLowerHierarchyRole &&
                                              ["PENDING", "ASSIGNED", "RESOLVED"].includes(
                                                grievance.status,
                                              ) && (
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={() => {
                                                    setSelectedGrievanceForRevert(
                                                      grievance,
                                                    );
                                                    setShowGrievanceRevertDialog(
                                                      true,
                                                    );
                                                  }}
                                                  title="Request Reassignment"
                                                  className="h-8 w-8 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
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
                                                      d="M3 10h10a4 4 0 014 4v1m0 0l-3-3m3 3l3-3M7 14H3m0 0l3 3m-3-3l3-3"
                                                    />
                                                  </svg>
                                                </Button>
                                              )}
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() =>
                                                openGrievanceDetail(
                                                  grievance._id,
                                                  grievance,
                                                )
                                              }
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
                                            {canDeleteGrievance && (
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                  handleDeleteGrievance(grievance)
                                                }
                                                disabled={isDeleting}
                                                title="Delete grievance"
                                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
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
              {isCompanyLevel &&
                hasPermission(user, Permission.READ_GRIEVANCE) && (
                  <TabsContent value="reverted" className="space-y-6">
                    <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
                      <CardHeader className="bg-slate-900 px-6 py-2">
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
                                Grievances requiring reassignment after being
                                reverted
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
                              onChange={(e) =>
                                setGrievanceSearch(e.target.value)
                              }
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
                              <RefreshCw
                                className={`w-4 h-4 mr-1.5 ${isRefreshing ? "animate-spin" : ""}`}
                              />
                              Refresh
                            </Button>
                          </div>
                        </div>

                        {/* Filter Dropdowns */}
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                            <Filter className="w-3.5 h-3.5 text-rose-500" />
                            <span className="text-xs font-bold text-slate-600">
                              Filters
                            </span>
                          </div>

                          <select
                            value={grievanceFilters.mainDeptId}
                            onChange={(e) =>
                              setGrievanceFilters((prev) => ({
                                ...prev,
                                mainDeptId: e.target.value,
                                subDeptId: "",
                              }))
                            }
                            className="text-xs px-4 py-2 border border-slate-200 rounded-xl bg-white shadow-sm hover:border-rose-300 transition-colors cursor-pointer min-w-[170px]"
                          >
                            <option value="">🏢 Origin Department</option>
                            {departments
                              .filter((d) => !d.parentDepartmentId)
                              .map((d) => (
                                <option key={d._id} value={d._id}>
                                  {d.name}
                                </option>
                              ))}
                          </select>

                          <select
                            value={grievanceFilters.dateRange}
                            onChange={(e) =>
                              setGrievanceFilters((prev) => ({
                                ...prev,
                                dateRange: e.target.value,
                              }))
                            }
                            className="text-xs px-4 py-2 border border-slate-200 rounded-xl bg-white shadow-sm hover:border-rose-300 transition-colors cursor-pointer"
                          >
                            <option value="">📅 All Dates</option>
                            <option value="today">Today</option>
                            <option value="week">Last 7 Days</option>
                            <option value="month">Last 30 Days</option>
                          </select>

                          {(grievanceSearch ||
                            grievanceFilters.mainDeptId ||
                            grievanceFilters.dateRange) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setGrievanceSearch("");
                                setGrievanceFilters((prev) => ({
                                  ...prev,
                                  mainDeptId: "",
                                  subDeptId: "",
                                  dateRange: "",
                                }));
                              }}
                              className="text-xs h-8 px-3 text-red-600 hover:bg-red-50 rounded-xl border border-red-100"
                            >
                              <X className="w-3 h-3 mr-1" /> Clear
                            </Button>
                          )}

                          <div className="ml-auto text-xs font-black text-slate-400 uppercase tracking-widest bg-slate-100/50 px-3 py-1.5 rounded-lg">
                            Showing:{" "}
                            <span className="text-slate-900">
                              {getSortedData(grievances, "reverted").length}{" "}
                              reverted cases
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="p-0">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="border-b border-slate-100 bg-slate-50/30">
                                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-12">
                                  #
                                </th>
                                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                  Grievance Id
                                </th>
                                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking_widest">
                                  Citizen Details
                                </th>
                                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                  Description & Remarks
                                </th>
                                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                  Dept & Category
                                </th>
                                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking_widest">
                                  Status
                                </th>
                                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                                  Reassign
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {getSortedData(grievances, "reverted").length >
                              0 ? (
                                getSortedData(grievances, "reverted").map(
                                  (grievance, index) => {
                                    const latestRevertRemark =
                                      grievance.statusHistory
                                        ?.filter(
                                          (h: any) => h.status === "REVERTED",
                                        )
                                        .sort(
                                          (a: any, b: any) =>
                                            new Date(b.changedAt).getTime() -
                                            new Date(a.changedAt).getTime(),
                                        )[0]?.remarks;

                                    return (
                                      <tr
                                        key={grievance._id}
                                        className="border-b border-slate-50 hover:bg-slate-50/80 transition-all group"
                                      >
                                        <td className="px-4 py-5 text-center">
                                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-700 text-[10px] font-black group-hover:bg-rose-100 group-hover:text-rose-700 transition-colors shadow-sm">
                                            {index + 1}
                                          </span>
                                        </td>
                                        <td className="px-4 py-5 font-bold text-sm">
                                          <button
                                            onClick={() =>
                                              openGrievanceDetail(grievance._id)
                                            }
                                            className="text-blue-700 hover:text-blue-900 flex items-center gap-1.5 group/id"
                                          >
                                            {grievance.grievanceId}
                                            <ExternalLink className="w-3 h-3 opacity-0 group-hover/id:opacity-100 transition-opacity" />
                                          </button>
                                          <div className="text-[10px] text-slate-400 font-medium mt-1">
                                            {new Date(
                                              grievance.createdAt,
                                            ).toLocaleDateString()}
                                          </div>
                                        </td>
                                        <td className="px-4 py-5">
                                          <div className="flex flex-col">
                                            <button
                                              onClick={() =>
                                                openGrievanceDetail(
                                                  grievance._id,
                                                  grievance,
                                                )
                                              }
                                              className="text-slate-900 font-bold text-sm text-left hover:text-indigo-600 transition-colors"
                                            >
                                              {grievance.citizenName}
                                            </button>
                                            <div className="flex items-center text-[11px] text-slate-500 font-medium mt-0.5">
                                              <Phone className="w-3 h-3 mr-1.5 text-slate-400" />
                                              {formatTo10Digits(
                                                grievance.citizenPhone,
                                              )}
                                            </div>
                                          </div>
                                        </td>
                                        <td className="px-4 py-5 max-w-[250px]">
                                          <div className="flex flex-col gap-1.5">
                                            <div
                                              className="text-xs text-slate-600 line-clamp-1 italic"
                                              title={grievance.description}
                                            >
                                              &quot;{grievance.description}
                                              &quot;
                                            </div>
                                            {latestRevertRemark && (
                                              <div className="bg-rose-50 border border-rose-100 rounded-lg p-2">
                                                <p className="text-[10px] font-black text-rose-500 uppercase tracking-tighter mb-0.5 flex items-center gap-1">
                                                  <Undo2 className="w-2.5 h-2.5" />{" "}
                                                  Revert Remark
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
                                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mb-0.5">
                                                Original Dept
                                              </span>
                                              <span className="text-xs font-semibold text-slate-700">
                                                {grievance.departmentId &&
                                                typeof grievance.departmentId ===
                                                  "object"
                                                  ? (
                                                      grievance.departmentId as any
                                                    ).name
                                                  : "Collector & DM"}
                                              </span>
                                            </div>

                                            {(() => {
                                              const revertEntry =
                                                grievance.timeline
                                                  ?.filter(
                                                    (t: any) =>
                                                      t.action ===
                                                      "REVERTED_TO_COMPANY_ADMIN",
                                                  )
                                                  .sort(
                                                    (a: any, b: any) =>
                                                      new Date(
                                                        b.timestamp,
                                                      ).getTime() -
                                                      new Date(
                                                        a.timestamp,
                                                      ).getTime(),
                                                  )[0];

                                              const suggestedDeptId =
                                                revertEntry?.details
                                                  ?.suggestedDepartmentId;
                                              const suggestedSubDeptId =
                                                revertEntry?.details
                                                  ?.suggestedSubDepartmentId;

                                              if (
                                                suggestedDeptId ||
                                                suggestedSubDeptId
                                              ) {
                                                const suggestedDept =
                                                  departments.find(
                                                    (d) =>
                                                      d._id ===
                                                      (suggestedSubDeptId ||
                                                        suggestedDeptId),
                                                  );
                                                return (
                                                  <div className="mt-2 group/suggested">
                                                    <div className="flex items-center gap-1 text-[9px] text-rose-500 font-black uppercase tracking-widest mb-1 opacity-70">
                                                      <ArrowRightCircle className="w-2.5 h-2.5" />{" "}
                                                      Proposed Destination
                                                    </div>
                                                    <div className="flex items-center gap-2 bg-rose-50/50 border border-rose-100 rounded-lg p-2 transition-all group-hover/suggested:bg-rose-50">
                                                      <div className="w-6 h-6 bg-rose-100 rounded-md flex items-center justify-center text-rose-600">
                                                        <Building2 className="w-3.5 h-3.5" />
                                                      </div>
                                                      <div className="flex flex-col">
                                                        <span className="text-xs font-bold text-slate-900 leading-none">
                                                          {suggestedDept?.name ||
                                                            "Target Department"}
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
                                                setSelectedGrievanceForAssignment(
                                                  grievance,
                                                );
                                                setShowGrievanceAssignment(
                                                  true,
                                                );
                                              }}
                                              className="h-8 w-8 p-0 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg shadow-none border-0 transition-all"
                                              title="Assign to New Official"
                                            >
                                              <UserPlus className="w-3.5 h-3.5" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() =>
                                                openGrievanceDetail(
                                                  grievance._id,
                                                  grievance,
                                                )
                                              }
                                              className="h-8 w-8 p-0 text-slate-400 hover:bg-slate-50 hover:text-slate-900 rounded-lg shadow-none border-0 transition-all"
                                              title="View Case Details"
                                            >
                                              <Eye className="w-3.5 h-3.5" />
                                            </Button>
                                            {canDeleteGrievance && (
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                  handleDeleteGrievance(grievance)
                                                }
                                                disabled={isDeleting}
                                                className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg shadow-none border-0 transition-all"
                                                title="Delete grievance"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </Button>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  },
                                )
                              ) : (
                                <tr>
                                  <td
                                    colSpan={7}
                                    className="px-4 py-24 text-center"
                                  >
                                    <div className="flex flex-col items-center justify-center">
                                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                                        <Inbox className="w-8 h-8 text-slate-200" />
                                      </div>
                                      <h3 className="text-slate-900 font-bold">
                                        No Reverted Items
                                      </h3>
                                      <p className="text-slate-400 text-xs mt-1 max-w-[200px] mx-auto leading-relaxed">
                                        All reverted grievances have been
                                        addressed or none exist currently.
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

              {/* Appointments Tab - Modern Specialized Calendar Integration */}
              {canShowAppointmentsInView &&
                (isViewingCompany || isDepartmentLevel) && (
                  <TabsContent value="appointments" className="space-y-4">
                    <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
                      {/* <CardHeader className="bg-slate-900 px-6 py-2">
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
                      
                    </div>
                  </CardHeader> */}

                      {/* Appointment Filters */}
                      <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-purple-50/30 border-b border-slate-200">
                        {/* Search and Actions Bar */}
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                          <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                              type="text"
                              placeholder="Search..."
                              value={appointmentSearch}
                              onChange={(e) =>
                                setAppointmentSearch(e.target.value)
                              }
                              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white shadow-sm text-sm placeholder:text-slate-400"
                            />
                          </div>
                          <div className="flex items-center gap-2 flex-wrap md:flex-nowrap">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setShowAppointmentFiltersOnMobile(
                                  (prev) => !prev,
                                )
                              }
                              className="md:hidden border-slate-200 hover:bg-slate-50 rounded-xl"
                              title="Toggle filters"
                            >
                              <Filter className="w-4 h-4 mr-1.5" />
                              Filters
                            </Button>
                            <div className="flex items-center gap-2">
                              {(isViewingCompany || isDepartmentLevel) && (
                                <Button
                                  onClick={() =>
                                    setShowAvailabilityCalendar(true)
                                  }
                                  className="bg-indigo-600 hover:bg-indigo-700 text-white border-0 h-9 text-[10px] font-bold uppercase tracking-widest rounded-lg px-4 shadow-md whitespace-nowrap"
                                  title="Configure when appointments can be scheduled"
                                >
                                  <CalendarClock className="w-3.5 h-3.5 mr-1.5" />
                                  Availability
                                </Button>
                              )}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleRefreshData}
                              disabled={isRefreshing}
                              className="border-slate-200 hover:bg-slate-50 rounded-xl whitespace-nowrap"
                              title="Refresh data"
                            >
                              <RefreshCw
                                className={`w-4 h-4 mr-1.5 ${isRefreshing ? "animate-spin" : ""}`}
                              />
                              Refresh
                            </Button>
                            {isViewingCompany && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  exportToCSV(
                                    getSortedData(appointments, "appointments"),
                                    "appointments",
                                    [
                                      { key: "appointmentId", label: "ID" },
                                      {
                                        key: "citizenName",
                                        label: "Citizen Name",
                                      },
                                      { key: "citizenPhone", label: "Phone" },
                                      { key: "purpose", label: "Purpose" },
                                      { key: "appointmentDate", label: "Date" },
                                      { key: "appointmentTime", label: "Time" },
                                      { key: "status", label: "Status" },
                                    ],
                                  )
                                }
                                className="border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl whitespace-nowrap"
                                title="Export to CSV"
                              >
                                <FileDown className="w-4 h-4 mr-1.5" />
                                Export
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Filters Row */}
                        <div
                          className={cn(
                            "gap-3 md:items-center",
                            showAppointmentFiltersOnMobile
                              ? "flex flex-col md:flex-row"
                              : "hidden md:flex md:flex-row",
                          )}
                        >
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
                            className="w-full md:w-auto text-xs px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white shadow-sm hover:border-purple-300 transition-colors cursor-pointer"
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
                            className="w-full md:w-auto text-xs px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white shadow-sm hover:border-purple-300 transition-colors cursor-pointer"
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

                          {isSuperAdminUser &&
                            selectedAppointments.size > 0 && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleBulkDeleteAppointments}
                                disabled={isDeleting}
                                className="text-xs h-8 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl border border-red-700 shadow-sm mr-2"
                                title={`Delete ${selectedAppointments.size} selected appointment(s)`}
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                                Delete ({selectedAppointments.size})
                              </Button>
                            )}

                          {/* Results count */}
                          <div className="flex items-center gap-4 ml-0 md:ml-auto w-full md:w-auto justify-between md:justify-start">
                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Rows:
                              </span>
                              <select
                                value={appointmentPagination.limit}
                                onChange={(e) =>
                                  setAppointmentPagination((prev) => ({
                                    ...prev,
                                    limit: Number(e.target.value),
                                  }))
                                }
                                className="text-[10px] font-bold text-slate-900 bg-transparent border-0 focus:ring-0 cursor-pointer"
                              >
                                {[10, 20, 25, 50, 100].map((l) => (
                                  <option key={l} value={l}>
                                    {l}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <span className="text-xs text-slate-500 bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-200">
                              Showing{" "}
                              <span className="font-semibold text-purple-600">
                                {
                                  getSortedData(appointments, "appointments")
                                    .length
                                }
                              </span>{" "}
                              of {appointments.length} appointments
                            </span>
                          </div>
                        </div>
                      </div>

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

              {isSuperAdminUser && companyIdParam && (
                <CompanyProvider companyId={companyIdParam}>
                  <TabsContent value="roles" className="space-y-4">
                    <RoleManagement companyId={companyIdParam} />
                  </TabsContent>

                  <TabsContent value="whatsapp" className="space-y-4">
                    <WhatsAppConfigTab companyId={companyIdParam} />
                  </TabsContent>

                  <TabsContent value="flows" className="space-y-4">
                    <ChatbotFlowsTab companyId={companyIdParam} />
                  </TabsContent>

                  <TabsContent value="notifications" className="space-y-4">
                    <NotificationManagement companyId={companyIdParam} />
                  </TabsContent>

                  <TabsContent value="email" className="space-y-4">
                    <EmailConfigTab companyId={companyIdParam} />
                  </TabsContent>
                </CompanyProvider>
              )}
              <TabsContent value="profile" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <Card className="border-slate-200 shadow-sm overflow-hidden">
                      <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-indigo-200">
                            {user.firstName[0]}
                            {user.lastName[0]}
                          </div>
                          <div>
                            <CardTitle className="text-lg font-black uppercase tracking-tight text-slate-900">
                              Personal Information
                            </CardTitle>
                            <CardDescription className="text-[10px] font-bold uppercase tracking-tighter text-slate-500">
                              Update your account details and contact
                              information
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <form
                          onSubmit={handleUpdateProfile}
                          className="space-y-4"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold uppercase tracking-wide text-slate-500 ml-1">
                                First Name
                              </label>
                              <input
                                type="text"
                                value={profileForm.firstName}
                                onChange={(e) =>
                                  setProfileForm({
                                    ...profileForm,
                                    firstName: e.target.value,
                                  })
                                }
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                                required
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold uppercase tracking-wide text-slate-500 ml-1">
                                Last Name
                              </label>
                              <input
                                type="text"
                                value={profileForm.lastName}
                                onChange={(e) =>
                                  setProfileForm({
                                    ...profileForm,
                                    lastName: e.target.value,
                                  })
                                }
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                                required
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold uppercase tracking-wide text-slate-500 ml-1">
                                Designations (Comma separated)
                              </label>
                              <input
                                type="text"
                                value={profileForm.designations}
                                onChange={(e) =>
                                  setProfileForm({
                                    ...profileForm,
                                    designations: e.target.value,
                                  })
                                }
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                                placeholder="e.g. Senior Manager"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold uppercase tracking-wide text-slate-500 ml-1">
                                Email Address
                              </label>
                              <input
                                type="email"
                                value={profileForm.email}
                                onChange={(e) =>
                                  setProfileForm({
                                    ...profileForm,
                                    email: e.target.value,
                                  })
                                }
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                              />
                            </div>
                            <div className="space-y-1.5 md:col-span-2">
                              <label className="text-xs font-bold uppercase tracking-wide text-slate-500 ml-1">
                                Phone Number
                              </label>
                              <input
                                type="tel"
                                value={profileForm.phone}
                                onChange={(e) =>
                                  setProfileForm({
                                    ...profileForm,
                                    phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                                  })
                                }
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                                required
                              />
                            </div>
                          </div>
                          <div className="pt-4 flex justify-end">
                            <Button
                              type="submit"
                              disabled={updatingProfile}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-70"
                            >
                              {updatingProfile ? (
                                <>
                                  <RefreshCw className="w-3 h-3 mr-2 animate-spin" />
                                  Updating...
                                </>
                              ) : (
                                "Save Changes"
                              )}
                            </Button>
                          </div>
                        </form>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-6">
                    <Card className="border-slate-200 shadow-sm overflow-hidden">
                      <CardHeader className="bg-rose-50/50 border-b border-rose-100 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-rose-500/10 rounded-xl flex items-center justify-center text-rose-600">
                            <Lock className="w-5 h-5" />
                          </div>
                          <div>
                            <CardTitle className="text-md font-black uppercase tracking-tight text-slate-900">
                              Security
                            </CardTitle>
                            <CardDescription className="text-[9px] font-bold uppercase tracking-tighter text-slate-500">
                              Update your account password
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-6 space-y-4">
                        <form
                          onSubmit={handleUpdatePassword}
                          className="space-y-4"
                        >
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wide text-slate-500 ml-1">
                              New Password
                            </label>
                            <input
                              type="password"
                              value={passwordForm.newPassword}
                              onChange={(e) =>
                                setPasswordForm({
                                  ...passwordForm,
                                  newPassword: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all outline-none"
                              placeholder="********"
                              required
                              minLength={6}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wide text-slate-500 ml-1">
                              Confirm New Password
                            </label>
                            <input
                              type="password"
                              value={passwordForm.confirmPassword}
                              onChange={(e) =>
                                setPasswordForm({
                                  ...passwordForm,
                                  confirmPassword: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all outline-none"
                              placeholder="********"
                              required
                              minLength={6}
                            />
                          </div>
                          <Button
                            type="submit"
                            disabled={updatingPassword}
                            className="w-full bg-rose-600 hover:bg-rose-700 text-white py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-rose-100 transition-all active:scale-95 disabled:opacity-70"
                          >
                            {updatingPassword ? (
                              <>
                                <RefreshCw className="w-3 h-3 mr-2 animate-spin" />
                                Security Patching...
                              </>
                            ) : (
                              "Update Password"
                            )}
                          </Button>
                        </form>
                        <div className="p-4 bg-amber-50 rounded-xl border border-amber-100/50">
                          <div className="flex gap-3">
                            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
                            <p className="text-[10px] text-amber-700 font-bold leading-relaxed">
                              Changing your password will require you to log in
                              again on all other devices.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>
            </div>
          </div>
        </Tabs>

        {/* Dialogs */}
        {(isViewingCompany || isDepartmentLevel) && (
          <div key="dashboard-dialogs-root">
            {(isViewingCompany || isDepartmentLevel) && (
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
                defaultCompanyId={
                  isSuperAdminUser ? companyIdParam || undefined : undefined
                }
                onEditUser={(u) => {
                  setEditingUser(u);
                  setShowEditUserDialog(true);
                  setShowDepartmentDialog(false);
                }}
                showPriorityField={
                  showDepartmentPriorityColumn
                }
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
              defaultCompanyId={
                isSuperAdminUser ? companyIdParam || undefined : undefined
              }
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
          </div>
        )}

        {/* Detail Dialogs */}
        <GrievanceDetailDialog
          isOpen={showGrievanceDetail}
          grievance={selectedGrievance}
          onClose={() => {
            setShowGrievanceDetail(false);
            setSelectedGrievance(null);
          }}
          onSuccess={() => {
            fetchGrievances(grievancePage, true);
            fetchDashboardData(true);
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
              const response = await grievanceAPI.revert(
                selectedGrievanceForRevert._id,
                payload,
              );
              if (response.success) {
                toast.success(
                  "Grievance reverted to company admin for reassignment",
                );
                fetchGrievances(grievancePage, true);
                fetchDashboardData(true);
                setShowGrievanceRevertDialog(false);
                setSelectedGrievanceForRevert(null);
              }
            } catch (error: any) {
              const errorMessage =
                error.response?.data?.message ||
                error.message ||
                "Failed to revert grievance";
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
            onAssign={async (
              userId: string,
              departmentId?: string,
              note?: string,
            ) => {
              if (!selectedGrievanceForAssignment) return;
              await grievanceAPI.assign(
                selectedGrievanceForAssignment._id,
                userId,
                departmentId,
                note,
              );
              fetchGrievances(grievancePage, true);
              fetchDashboardData(true);
            }}
            itemType="grievance"
            itemId={selectedGrievanceForAssignment?._id || ""}
            companyId={
              typeof user.companyId === "object" && user.companyId !== null
                ? user.companyId._id
                : user.companyId || ""
            }
            currentAssignee={selectedGrievanceForAssignment?.assignedTo}
            currentDepartmentId={(() => {
              if (!selectedGrievanceForAssignment) return null;
              if (selectedGrievanceForAssignment.status === "REVERTED") {
                const revertEntry = selectedGrievanceForAssignment.timeline
                  ?.filter((t: any) => t.action === "REVERTED_TO_COMPANY_ADMIN")
                  .sort(
                    (a: any, b: any) =>
                      new Date(b.timestamp).getTime() -
                      new Date(a.timestamp).getTime(),
                  )[0];

                if (revertEntry?.details?.suggestedDepartmentId) {
                  return revertEntry.details.suggestedDepartmentId;
                }
              }

              const dept = selectedGrievanceForAssignment.departmentId;
              return dept && typeof dept === "object"
                ? (dept as any)._id
                : dept;
            })()}
            currentSubDepartmentId={(() => {
              if (!selectedGrievanceForAssignment) return null;
              if (selectedGrievanceForAssignment.status === "REVERTED") {
                const revertEntry = selectedGrievanceForAssignment.timeline
                  ?.filter((t: any) => t.action === "REVERTED_TO_COMPANY_ADMIN")
                  .sort(
                    (a: any, b: any) =>
                      new Date(b.timestamp).getTime() -
                      new Date(a.timestamp).getTime(),
                  )[0];

                if (revertEntry?.details?.suggestedSubDepartmentId) {
                  return revertEntry.details.suggestedSubDepartmentId;
                }
              }

              const subDept = selectedGrievanceForAssignment.subDepartmentId;
              return subDept && typeof subDept === "object"
                ? (subDept as any)._id
                : subDept;
            })()}
            userRole={user.role}
            canReassignCurrent={isCompanyAdminRole}
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
            onAssign={async (
              userId: string,
              departmentId?: string,
              _note?: string,
            ) => {
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

        {/* Availability Calendar */}
        <AvailabilityCalendar
          isOpen={showAvailabilityCalendar}
          onClose={() => setShowAvailabilityCalendar(false)}
          departmentId={
            !isCompanyAdminOrHigher(user) && user?.departmentId
              ? typeof user.departmentId === "object"
                ? (user.departmentId as any)._id
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
          itemId={
            showAppointmentStatusModal
              ? selectedAppointmentForStatus?._id || ""
              : ""
          }
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
          itemId={
            showGrievanceStatusModal
              ? selectedGrievanceForStatus?._id || ""
              : ""
          }
          itemType="grievance"
          currentStatus={selectedGrievanceForStatus?.status || ""}
          onSuccess={() => {
            fetchGrievances(grievancePage, true);
            fetchDashboardData(true);
          }}
          grievanceVariant={
            !isDepartmentAdminOrHigher(user) ? "operator" : "department-admin"
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
          companyId={targetCompanyId}
          onUserClick={(u) => {
            setSelectedUserForDetails(u);
            setShowUserDetailsDialog(true);
          }}
          onEditUser={(u) => {
            setEditingUser(u);
            setShowEditUserDialog(true);
            setShowDeptUsersDialog(false);
          }}
          onCreateNewUser={() => {
            setShowUserDialog(true);
            setShowDeptUsersDialog(false);
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

        <DepartmentHierarchyDialog
          isOpen={showHierarchyDialog}
          onClose={() => {
            setShowHierarchyDialog(false);
            setSelectedDeptForHierarchy(null);
          }}
          department={selectedDeptForHierarchy}
          allDepartments={allDepartments}
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
