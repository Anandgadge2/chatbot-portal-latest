"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import toast from "react-hot-toast";
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
import CreateCompanyDialog from "@/components/company/CreateCompanyDialog";
import CreateDepartmentDialog from "@/components/department/CreateDepartmentDialog";
import CreateUserDialog from "@/components/user/CreateUserDialog";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { Pagination } from "@/components/ui/Pagination";
import RecentActivityPanel from "@/components/dashboard/RecentActivityPanel";
import TerminalLogs from "@/components/dashboard/TerminalLogs";
import RoleManagement from "@/components/roles/RoleManagement";
import ModuleManagement from "@/components/superadmin/ModuleManagement";
import DashboardStats from "@/components/superadmin/DashboardStats";
import CompanyTabContent from "@/components/superadmin/CompanyTabContent";
import DepartmentTabContent from "@/components/superadmin/DepartmentTabContent";
import UserTabContent from "@/components/superadmin/UserTabContent";
import {
  Shield,
  RefreshCw,
  Plus,
  Menu,
  X,
  BarChart2,
  Building,
  Settings,
  Users,
  Box,
  Terminal,
  User as UserIcon,
} from "lucide-react";

// Helper function to get company display text
const getCompanyDisplay = (
  companyId: string | { _id: string; name: string; companyId: string },
): string => {
  if (typeof companyId === "object" && companyId !== null) {
    return `${companyId.name} (${companyId.companyId})`;
  }
  return companyId;
};

export default function SuperAdminDashboard() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState({
    companies: 0,
    users: 0,
    departments: 0,
    activeCompanies: 0,
    activeUsers: 0,
    totalSessions: 0,
    systemStatus: "operational",
  });
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(
    null,
  );
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDepartmentDialog, setShowDepartmentDialog] = useState(false);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [userRoleFilter, setUserRoleFilter] = useState<string>("");
  const [userSearchTerm, setUserSearchTerm] = useState<string>("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>("");
  const [userCompanyFilter, setUserCompanyFilter] = useState<string>("");
  const [deptSearchTerm, setDeptSearchTerm] = useState<string>("");
  const [deptDebouncedSearchTerm, setDeptDebouncedSearchTerm] =
    useState<string>("");
  const [deptCompanyFilter, setDeptCompanyFilter] = useState<string>("");
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [companySearchTerm, setCompanySearchTerm] = useState<string>("");
  const [companyDebouncedSearchTerm, setCompanyDebouncedSearchTerm] =
    useState<string>("");
  const [companyStatusFilter, setCompanyStatusFilter] = useState<string>("");
  const [companyTypeFilter, setCompanyTypeFilter] = useState<string>("");

  // Pagination State
  const [companyPage, setCompanyPage] = useState(1);
  const [companyPagination, setCompanyPagination] = useState({
    total: 0,
    pages: 1,
    limit: 10,
  });

  const [departmentPage, setDepartmentPage] = useState(1);
  const [departmentPagination, setDepartmentPagination] = useState({
    total: 0,
    pages: 1,
    limit: 10,
  });

  const [userPage, setUserPage] = useState(1);
  const [userPagination, setUserPagination] = useState({
    total: 0,
    pages: 1,
    limit: 10,
  });
  const [visiblePasswords, setVisiblePasswords] = useState<string[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedRoleCompanyId, setSelectedRoleCompanyId] =
    useState<string>("");
  const [navigatingCompanyId, setNavigatingCompanyId] = useState<string | null>(
    null,
  );

  const fetchAllInitialData = useCallback(async () => {
    // Initial fetch for companies dropdown and stats
    try {
      const [statsRes, companiesRes] = await Promise.all([
        apiClient.get("/dashboard/superadmin"),
        companyAPI.getAll({ limit: 100 }), // Fetch more for dropdowns
      ]);

      if (statsRes.success) {
        const { stats: s } = statsRes.data;
        setStats({
          companies: s.companies,
          users: s.users,
          departments: s.departments,
          activeCompanies: s.activeCompanies,
          activeUsers: s.activeUsers,
          totalSessions: Math.floor(Math.random() * 100) + 50,
          systemStatus: "operational",
        });
      }

      if (companiesRes.success) {
        setAllCompanies(companiesRes.data.companies);
      }
    } catch (e) {
      console.error("Error fetching initial data", e);
    }
  }, []);

  useEffect(() => {
    if (mounted && user && user.role === "SUPER_ADMIN") {
      fetchAllInitialData();
    }
  }, [mounted, user, fetchAllInitialData]);

  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const handleOpenCompanyDashboard = (companyId: string) => {
    if (navigatingCompanyId) return;
    setNavigatingCompanyId(companyId);
    router.push(`/superadmin/company/${companyId}`);
  };

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

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    } else if (!loading && user && user.role !== "SUPER_ADMIN") {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  const fetchCompanies = useCallback(
    async (page = companyPage) => {
      setCompaniesLoading(true);
      try {
        const response = await companyAPI.getAll({
          page,
          limit: companyPagination.limit,
          search: companyDebouncedSearchTerm,
          isActive:
            companyStatusFilter === ""
              ? undefined
              : companyStatusFilter === "active",
          companyType: companyTypeFilter || undefined,
        });
        if (response.success) {
          setCompanies(response.data.companies);
          setCompanyPagination((prev) => ({
            ...prev,
            total: response.data.pagination.total,
            pages: response.data.pagination.pages,
          }));
        }
      } catch (error: any) {
        toast.error("Failed to fetch companies");
      } finally {
        setCompaniesLoading(false);
      }
    },
    [
      companyPage,
      companyPagination.limit,
      companyDebouncedSearchTerm,
      companyStatusFilter,
      companyTypeFilter,
    ],
  );

  const fetchDepartments = useCallback(
    async (page = departmentPage) => {
      try {
        const response = await departmentAPI.getAll({
          page,
          limit: departmentPagination.limit,
          search: deptDebouncedSearchTerm,
          companyId: deptCompanyFilter,
        });
        if (response.success) {
          setDepartments(response.data.departments);
          setDepartmentPagination((prev) => ({
            ...prev,
            total: response.data.pagination.total,
            pages: response.data.pagination.pages,
          }));
        }
      } catch (error: any) {
        toast.error("Failed to fetch departments");
      }
    },
    [
      departmentPage,
      departmentPagination.limit,
      deptDebouncedSearchTerm,
      deptCompanyFilter,
    ],
  );

  const fetchUsers = useCallback(
    async (page = userPage) => {
      try {
        const response = await userAPI.getAll({
          page,
          limit: userPagination.limit,
          role: userRoleFilter,
          search: debouncedSearchTerm,
          companyId: userCompanyFilter,
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
        toast.error("Failed to fetch users");
      }
    },
    [
      userPage,
      userPagination.limit,
      userRoleFilter,
      debouncedSearchTerm,
      userCompanyFilter,
    ],
  );

  const fetchStats = async () => {
    try {
      // 🚀 Optimization: Use the dedicated dashboard aggregation endpoint
      // This performs atomic counts on the DB instead of fetching 1000s of records
      const response = await apiClient.get("/dashboard/superadmin");

      if (response.success && response.data.stats) {
        const { stats } = response.data;
        setStats({
          companies: stats.companies,
          users: stats.users,
          departments: stats.departments,
          activeCompanies: stats.activeCompanies,
          activeUsers: stats.activeUsers,
          totalSessions: Math.floor(Math.random() * 100) + 50, // Mock data
          systemStatus: "operational",
        });
      }
    } catch (e) {
      console.error("Critical error in fetchStats", e);
    }
  };

  const handleDeleteCompany = (company: Company) => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Company",
      message: `Are you sure you want to delete "${company.name}"? This action cannot be undone and will delete all associated departments, users, grievances, and appointments.`,
      onConfirm: async () => {
        try {
          const response = await companyAPI.delete(company._id);
          if (response.success) {
            toast.success("Company deleted successfully");
            fetchCompanies();
            setConfirmDialog({ ...confirmDialog, isOpen: false });
          } else {
            toast.error("Failed to delete company");
          }
        } catch (error: any) {
          toast.error(
            error?.response?.data?.message ||
              error?.message ||
              "Failed to delete company",
          );
        }
      },
      variant: "danger",
    });
  };

  const handleDeleteDepartment = (department: Department) => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Department",
      message: `Are you sure you want to delete "${department.name}"? This action cannot be undone and will delete all associated users, grievances, and appointments.`,
      onConfirm: async () => {
        try {
          const response = await departmentAPI.delete(department._id);
          if (response.success) {
            toast.success("Department deleted successfully");
            fetchDepartments();
            setConfirmDialog({ ...confirmDialog, isOpen: false });
          } else {
            toast.error("Failed to delete department");
          }
        } catch (error: any) {
          toast.error(
            error?.response?.data?.message ||
              error?.message ||
              "Failed to delete department",
          );
        }
      },
      variant: "danger",
    });
  };

  const handleEditDepartment = (department: Department) => {
    setEditingDepartment(department);
    setShowDepartmentDialog(true);
  };

  const handleEditCompany = (company: Company) => {
    setEditingCompany(company);
    setShowCreateDialog(true);
  };

  const handleEditUser = (u: User) => {
    setEditingUser(u);
    setShowUserDialog(true);
  };

  const toggleCompanyStatus = async (company: Company) => {
    try {
      const response = await companyAPI.update(company._id, {
        isActive: !company.isActive,
      } as any);
      if (response.success) {
        toast.success(
          `Company ${!company.isActive ? "activated" : "suspended"} successfully`,
        );
        fetchCompanies();
        fetchStats();
      }
    } catch (error: any) {
      toast.error("Failed to update company status");
    }
  };

  const toggleDepartmentStatus = async (dept: Department) => {
    try {
      const response = await departmentAPI.update(dept._id, {
        isActive: !dept.isActive,
      });
      if (response.success) {
        toast.success(
          `Department ${!dept.isActive ? "activated" : "deactivated"} successfully`,
        );
        fetchDepartments();
        fetchStats();
      }
    } catch (error: any) {
      toast.error("Failed to update department status");
    }
  };

  const toggleUserStatus = async (u: User) => {
    try {
      const response = await userAPI.update(u._id, {
        isActive: !u.isActive,
      } as any);
      if (response.success) {
        toast.success(
          `User ${!u.isActive ? "activated" : "deactivated"} successfully`,
        );
        fetchUsers();
        fetchStats();
      }
    } catch (error: any) {
      toast.error("Failed to update user status");
    }
  };

  const handleDeleteUser = (u: User) => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete User",
      message: `Are you sure you want to delete ${u.firstName} ${u.lastName}? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          const response = await userAPI.delete(u._id);
          if (response.success) {
            toast.success("User deleted successfully");
            fetchUsers();
            setConfirmDialog({ ...confirmDialog, isOpen: false });
          } else {
            toast.error("Failed to delete user");
          }
        } catch (error: any) {
          toast.error(
            error?.response?.data?.message ||
              error?.message ||
              "Failed to delete user",
          );
        }
      },
      variant: "danger",
    });
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      setCompanyDebouncedSearchTerm(companySearchTerm);
    }, 500);
    return () => clearTimeout(handler);
  }, [companySearchTerm]);

  useEffect(() => {
    if (mounted && user) {
      fetchCompanies(companyPage);
    }
  }, [
    mounted,
    user,
    companyPage,
    fetchCompanies,
    companyDebouncedSearchTerm,
    companyStatusFilter,
    companyTypeFilter,
  ]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDeptDebouncedSearchTerm(deptSearchTerm);
    }, 500);
    return () => clearTimeout(handler);
  }, [deptSearchTerm]);

  useEffect(() => {
    if (mounted && user) {
      fetchDepartments(departmentPage);
    }
  }, [
    mounted,
    user,
    departmentPage,
    deptDebouncedSearchTerm,
    deptCompanyFilter,
    fetchDepartments,
  ]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(userSearchTerm);
    }, 500);
    return () => clearTimeout(handler);
  }, [userSearchTerm]);

  useEffect(() => {
    if (mounted && user) {
      fetchUsers(userPage);
    }
  }, [
    mounted,
    user,
    userPage,
    userRoleFilter,
    debouncedSearchTerm,
    userCompanyFilter,
    fetchUsers,
  ]);

  useEffect(() => {
    if (mounted && user) {
      fetchStats();
    }
  }, [mounted, user]);

  if (loading || !mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoadingSpinner text="Loading Dashboard..." />
      </div>
    );
  }

  if (!user || user.role !== "SUPER_ADMIN") {
    return null;
  }
  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {navigatingCompanyId && (
        <div className="fixed inset-0 z-[70] bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center">
          <div className="bg-white border border-slate-200 rounded-xl px-6 py-5 shadow-2xl">
            <LoadingSpinner text="Opening company dashboard..." />
          </div>
        </div>
      )}
      {/* Header with Gradient */}
      {/* Classic White Header */}
      {/* Header with Dark Slate Theme */}
      <header className="bg-slate-900 sticky top-0 z-50 shadow-2xl border-b border-slate-800">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVHJhbnNmb3JtPSJyb3RhdGUoNDUpIj48cGF0aCBkPSJNLTEwIDMwaDYwdjJoLTYweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNhKSIvPjwvc3ZnPg==')] opacity-10 pointer-events-none"></div>
        <div className="relative max-w-[1600px] mx-auto px-4 lg:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 xl:w-10 xl:h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/20 shadow-inner">
                  <Shield className="w-4.5 h-4.5 xl:w-5 xl:h-5 text-indigo-400" />
                </div>
                <div>
                  <h1 className="text-base xl:text-lg font-bold text-white uppercase">
                    Master Admin
                  </h1>
                </div>
              </div>

              <div className="h-10 w-px bg-slate-800 hidden md:block"></div>

              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="h-full hidden md:block"
              >
                <TabsList className="bg-transparent border-0 h-16 gap-1 p-0">
                  {[
                    { val: "overview", label: "Overview", icon: BarChart2 },
                    { val: "companies", label: "Companies", icon: Building },
                    {
                      val: "departments",
                      label: "Departments",
                      icon: Settings,
                    },
                    { val: "users", label: "Users", icon: Users },
                    { val: "roles", label: "Roles", icon: Shield },
                    { val: "features", label: "Features", icon: Box },
                    { val: "terminal", label: "System Logs", icon: Terminal },
                  ].map((t) => (
                    <TabsTrigger
                      key={t.val}
                      value={t.val}
                      className="px-5 h-full rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:bg-white/5 data-[state=active]:text-white data-[state=active]:shadow-none text-slate-400 font-black text-[10px] uppercase tracking-widest transition-all hover:text-white hover:bg-white/5"
                    >
                      <t.icon className="w-3.5 h-3.5 mr-2" />
                      {t.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            <div className="flex items-center gap-5">
              <div className="hidden lg:flex flex-col items-end border-r border-slate-800 pr-5">
                <span className="text-[11px] font-black text-white uppercase tracking-wider">
                  {user.firstName} {user.lastName}
                </span>
              </div>
              <Button
                onClick={logout}
                variant="ghost"
                size="sm"
                className="hidden md:flex h-10 px-6 bg-white/5 hover:bg-red-500 text-white rounded-xl transition-all border border-white/10 font-bold text-[11px] uppercase tracking-wider"
              >
                LOGOUT
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
        </div>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-16 left-0 w-full bg-slate-900 border-b border-slate-800 z-50 animate-in slide-in-from-top-4 duration-300">
            <div className="p-4 space-y-2">
              {[
                { val: "overview", label: "Overview", icon: BarChart2 },
                { val: "companies", label: "Companies", icon: Building },
                { val: "departments", label: "Departments", icon: Settings },
                { val: "users", label: "Users", icon: Users },
                { val: "roles", label: "Roles", icon: Shield },
                { val: "features", label: "Features", icon: Box },
                { val: "terminal", label: "System Logs", icon: Terminal },
              ].map((t) => (
                <button
                  key={t.val}
                  onClick={() => {
                    setActiveTab(t.val);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all ${
                    activeTab === t.val
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <t.icon className="w-4 h-4" />
                  {t.label}
                </button>
              ))}
              <div className="pt-4 border-t border-slate-800">
                <Button
                  onClick={logout}
                  variant="destructive"
                  className="w-full rounded-xl font-bold uppercase tracking-widest text-xs"
                >
                  Logout Session
                </Button>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-[1600px] mx-auto px-4 lg:px-6 py-4">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          {/* Main Content Areas */}

          <TabsContent value="overview" className="space-y-6 outline-none">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tighter">
                  System Intelligence
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <div className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm flex items-center gap-3">
                  <div className="text-[9px] font-black text-slate-400 uppercase leading-none">
                    Security
                    <br />
                    Status
                  </div>
                  <div className="h-6 w-px bg-slate-100"></div>
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider">
                      Protected
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <DashboardStats stats={stats} setActiveTab={setActiveTab} />

            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Recent Activity (Taking more space) */}
              <div className="lg:col-span-2">
                <RecentActivityPanel />
              </div>

              {/* Right Column: Account Info and Stats Summary */}
              <div className="space-y-6">
                <Card className="border border-slate-200 shadow-sm overflow-hidden bg-white">
                  <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-4">
                    <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <UserIcon className="w-4 h-4 text-blue-600" />
                      Session Profile
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5">
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-primary to-blue-600 rounded-full flex items-center justify-center text-white font-black text-lg shadow-md">
                          {user.firstName[0]}
                          {user.lastName[0]}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 leading-none">
                            {user.firstName} {user.lastName}
                          </p>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                            {user.role}
                          </p>
                        </div>
                      </div>
                      <div className="pt-4 border-t border-slate-100 space-y-3">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="font-bold text-slate-500 uppercase">
                            User ID
                          </span>
                          <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                            {user.userId}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="font-bold text-slate-500 uppercase">
                            Email
                          </span>
                          <span className="text-slate-700 font-medium">
                            {user.email}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="font-bold text-slate-500 uppercase">
                            Access Level
                          </span>
                          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full font-bold">
                            Unrestricted
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-slate-200 shadow-sm overflow-hidden bg-white">
                  <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-4">
                    <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-emerald-600" />
                      System Health
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold text-slate-500 uppercase">
                        API Status
                      </span>
                      <span className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                        Healthy
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 mb-1">
                      <div className="bg-indigo-600 h-1.5 rounded-full w-[98%] shadow-[0_0_8px_rgba(79,70,229,0.3)]" />
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-[10px] font-bold text-slate-400">
                        UPTIME
                      </span>
                      <span className="text-[10px] font-bold text-slate-900 uppercase">
                        99.9%
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="companies" className="space-y-4">
            <CompanyTabContent
              companies={companies}
              companiesLoading={companiesLoading}
              companySearchTerm={companySearchTerm}
              setCompanySearchTerm={setCompanySearchTerm}
              companyStatusFilter={companyStatusFilter}
              setCompanyStatusFilter={setCompanyStatusFilter}
              companyTypeFilter={companyTypeFilter}
              setCompanyTypeFilter={setCompanyTypeFilter}
              companyPage={companyPage}
              setCompanyPage={setCompanyPage}
              companyPagination={companyPagination}
              navigatingCompanyId={navigatingCompanyId}
              setShowCreateDialog={setShowCreateDialog}
              handleOpenCompanyDashboard={handleOpenCompanyDashboard}
              handleEditCompany={handleEditCompany}
              handleDeleteCompany={handleDeleteCompany}
              toggleCompanyStatus={toggleCompanyStatus}
            />
          </TabsContent>

          <TabsContent value="departments" className="space-y-4">
            <DepartmentTabContent
              departments={departments}
              deptSearchTerm={deptSearchTerm}
              setDeptSearchTerm={setDeptSearchTerm}
              deptCompanyFilter={deptCompanyFilter}
              setDeptCompanyFilter={setDeptCompanyFilter}
              allCompanies={allCompanies}
              departmentPage={departmentPage}
              setDepartmentPage={setDepartmentPage}
              departmentPagination={departmentPagination}
              setEditingDepartment={setEditingDepartment}
              setShowDepartmentDialog={setShowDepartmentDialog}
              handleEditDepartment={handleEditDepartment}
              handleDeleteDepartment={handleDeleteDepartment}
              toggleDepartmentStatus={toggleDepartmentStatus}
              getCompanyDisplay={getCompanyDisplay}
              router={router}
            />
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <UserTabContent
              users={users}
              userSearchTerm={userSearchTerm}
              setUserSearchTerm={setUserSearchTerm}
              userCompanyFilter={userCompanyFilter}
              setUserCompanyFilter={setUserCompanyFilter}
              userRoleFilter={userRoleFilter}
              setUserRoleFilter={setUserRoleFilter}
              allCompanies={allCompanies}
              userPage={userPage}
              setUserPage={setUserPage}
              userPagination={userPagination}
              visiblePasswords={visiblePasswords}
              togglePasswordVisibility={togglePasswordVisibility}
              setShowUserDialog={setShowUserDialog}
              setEditingUser={setEditingUser}
              handleEditUser={handleEditUser}
              handleDeleteUser={handleDeleteUser}
              toggleUserStatus={toggleUserStatus}
            />
          </TabsContent>
          <TabsContent value="roles" className="space-y-4 outline-none">
            <Card className="border-0 shadow-xl rounded-2xl overflow-hidden bg-white">
              <CardHeader className="bg-slate-50 border-b border-slate-100 p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-black text-slate-800 tracking-tight uppercase">
                      Role Governance
                    </CardTitle>
                    <CardDescription className="text-slate-500 font-medium">
                      Manage access control across the network
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                      Select
                      <br />
                      Entity
                    </span>
                    <select
                      className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 shadow-sm min-w-[200px]"
                      value={selectedRoleCompanyId}
                      onChange={(e) => setSelectedRoleCompanyId(e.target.value)}
                    >
                      <option value="">Select Company...</option>
                      {allCompanies.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {selectedRoleCompanyId ? (
                  <RoleManagement companyId={selectedRoleCompanyId} />
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center">
                      <Shield className="w-8 h-8 text-slate-300" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-400 uppercase tracking-tight">
                        No Entity Selected
                      </h3>
                      <p className="text-slate-400 text-sm max-w-[280px] font-medium">
                        Please select a company from the dropdown above to
                        manage its roles and permissions.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="features" className="space-y-6 outline-none">
            <ModuleManagement />
          </TabsContent>

          <TabsContent value="terminal" className="space-y-4 outline-none">
            <TerminalLogs />
          </TabsContent>
        </Tabs>
        <CreateCompanyDialog
          isOpen={showCreateDialog}
          onClose={() => {
            setShowCreateDialog(false);
            setEditingCompany(null);
          }}
          onCompanyCreated={() => {
            fetchCompanies();
            setEditingCompany(null);
          }}
          editingCompany={editingCompany}
        />
        <CreateDepartmentDialog
          isOpen={showDepartmentDialog}
          onClose={() => {
            setShowDepartmentDialog(false);
            setEditingDepartment(null);
          }}
          onDepartmentCreated={() => {
            fetchDepartments();
            setEditingDepartment(null);
          }}
          editingDepartment={editingDepartment}
        />
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
          variant={confirmDialog.variant}
        />
        <CreateUserDialog
          isOpen={showUserDialog}
          onClose={() => {
            setShowUserDialog(false);
            setEditingUser(null);
          }}
          onUserCreated={fetchUsers}
          editingUser={editingUser}
        />
      </main>
    </div>
  );
}
