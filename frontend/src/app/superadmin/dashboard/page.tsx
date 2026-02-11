'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { companyAPI, Company } from '@/lib/api/company';
import { departmentAPI, Department } from '@/lib/api/department';
import { userAPI, User } from '@/lib/api/user';
import { apiClient } from '@/lib/api/client';
import CreateCompanyDialog from '@/components/company/CreateCompanyDialog';
import CreateDepartmentDialog from '@/components/department/CreateDepartmentDialog';
import CreateUserDialog from '@/components/user/CreateUserDialog';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import toast from 'react-hot-toast';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Building, Users, Shield, Settings, FileText, BarChart2, RefreshCw, Search, Download } from 'lucide-react';
import { Pagination } from '@/components/ui/Pagination';

const CHART_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

// Helper function to get company display text
const getCompanyDisplay = (companyId: string | { _id: string; name: string; companyId: string }): string => {
  if (typeof companyId === 'object' && companyId !== null) {
    return `${companyId.name} (${companyId.companyId})`;
  }
  return companyId;
};


export default function SuperAdminDashboard() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
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
    systemStatus: 'operational'
  });
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDepartmentDialog, setShowDepartmentDialog] = useState(false);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [userRoleFilter, setUserRoleFilter] = useState<string>('');
  
  // Pagination State
  const [companyPage, setCompanyPage] = useState(1);
  const [companyPagination, setCompanyPagination] = useState({ total: 0, pages: 1, limit: 10 });
  
  const [departmentPage, setDepartmentPage] = useState(1);
  const [departmentPagination, setDepartmentPagination] = useState({ total: 0, pages: 1, limit: 10 });
  
  const [userPage, setUserPage] = useState(1);
  const [userPagination, setUserPagination] = useState({ total: 0, pages: 1, limit: 10 });

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'danger'
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/superadmin-login');
    } else if (!loading && user && user.role !== 'SUPER_ADMIN') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const fetchCompanies = useCallback(async (page = companyPage) => {
    setCompaniesLoading(true);
    try {
      const response = await companyAPI.getAll({ page, limit: companyPagination.limit });
      if (response.success) {
        setCompanies(response.data.companies);
        setCompanyPagination(prev => ({
          ...prev,
          total: response.data.pagination.total,
          pages: response.data.pagination.pages
        }));
      }
    } catch (error: any) {
      toast.error('Failed to fetch companies');
    } finally {
      setCompaniesLoading(false);
    }
  }, [companyPage, companyPagination.limit]);

  const fetchDepartments = useCallback(async (page = departmentPage) => {
    try {
      const response = await departmentAPI.getAll({ page, limit: departmentPagination.limit });
      if (response.success) {
        setDepartments(response.data.departments);
        setDepartmentPagination(prev => ({
          ...prev,
          total: response.data.pagination.total,
          pages: response.data.pagination.pages
        }));
      }
    } catch (error: any) {
      toast.error('Failed to fetch departments');
    }
  }, [departmentPage, departmentPagination.limit]);

  const fetchUsers = useCallback(async (page = userPage) => {
    try {
      const response = await userAPI.getAll({ page, limit: userPagination.limit, role: userRoleFilter });
      if (response.success) {
        setUsers(response.data.users);
        setUserPagination(prev => ({
          ...prev,
          total: response.data.pagination.total,
          pages: response.data.pagination.pages
        }));
      }
    } catch (error: any) {
      toast.error('Failed to fetch users');
    }
  }, [userPage, userPagination.limit, userRoleFilter]);

  const fetchStats = async () => {
    // Fetch each stat independently so one 403/failure doesn't block others (e.g. Users tab still loads)
    let companies: Company[] = [];
    let usersList: User[] = [];
    let departmentsList: Department[] = [];
    try {
      const companiesResponse = await companyAPI.getAll({ limit: 1000 });
      if (companiesResponse.success) companies = companiesResponse.data.companies;
    } catch (e) {
      console.warn('Stats: companies fetch failed', e);
    }
    try {
      const usersResponse = await userAPI.getAll({ limit: 1000 });
      if (usersResponse.success) usersList = usersResponse.data.users;
    } catch (e) {
      console.warn('Stats: users fetch failed', e);
    }
    try {
      const departmentsResponse = await departmentAPI.getAll({ limit: 1000 });
      if (departmentsResponse.success) departmentsList = departmentsResponse.data.departments;
    } catch (e) {
      console.warn('Stats: departments fetch failed', e);
    }

    const activeCompanies = companies.filter(c => c.isActive).length;
    const activeUsers = usersList.filter(u => u.isActive).length;

    setStats({
      companies: companies.length,
      users: usersList.length,
      departments: departmentsList.length,
      activeCompanies,
      activeUsers,
      totalSessions: Math.floor(Math.random() * 100) + 50, // Mock data for now
      systemStatus: 'operational'
    });
  };

  const fetchAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const response = await apiClient.get('/analytics/dashboard');
      if (response.success) {
        setAnalyticsData(response.data);
      }
    } catch (error: any) {
      console.error('Failed to fetch analytics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const handleDeleteCompany = (company: Company) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Company',
      message: `Are you sure you want to delete "${company.name}"? This action cannot be undone and will delete all associated departments, users, grievances, and appointments.`,
      onConfirm: async () => {
        try {
          const response = await companyAPI.delete(company._id);
          if (response.success) {
            toast.success('Company deleted successfully');
            fetchCompanies();
            setConfirmDialog({ ...confirmDialog, isOpen: false });
          } else {
            toast.error('Failed to delete company');
          }
        } catch (error: any) {
          toast.error(error?.response?.data?.message || error?.message || 'Failed to delete company');
        }
      },
      variant: 'danger'
    });
  };

  const handleDeleteDepartment = (department: Department) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Department',
      message: `Are you sure you want to delete "${department.name}"? This action cannot be undone and will delete all associated users, grievances, and appointments.`,
      onConfirm: async () => {
        try {
          const response = await departmentAPI.delete(department._id);
          if (response.success) {
            toast.success('Department deleted successfully');
            fetchDepartments();
            setConfirmDialog({ ...confirmDialog, isOpen: false });
          } else {
            toast.error('Failed to delete department');
          }
        } catch (error: any) {
          toast.error(error?.response?.data?.message || error?.message || 'Failed to delete department');
        }
      },
      variant: 'danger'
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

  const handleDeleteUser = (u: User) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete User',
      message: `Are you sure you want to delete ${u.firstName} ${u.lastName}? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          const response = await userAPI.delete(u._id);
          if (response.success) {
            toast.success('User deleted successfully');
            fetchUsers();
            setConfirmDialog({ ...confirmDialog, isOpen: false });
          } else {
            toast.error('Failed to delete user');
          }
        } catch (error: any) {
          toast.error(error?.response?.data?.message || error?.message || 'Failed to delete user');
        }
      },
      variant: 'danger'
    });
  };

  useEffect(() => {
    if (mounted && user) {
      fetchCompanies(companyPage);
    }
  }, [mounted, user, companyPage, fetchCompanies]);

  useEffect(() => {
    if (mounted && user) {
      fetchDepartments(departmentPage);
    }
  }, [mounted, user, departmentPage, fetchDepartments]);

  useEffect(() => {
    if (mounted && user) {
      fetchUsers(userPage);
    }
  }, [mounted, user, userPage, userRoleFilter, fetchUsers]);

  useEffect(() => {
    if (mounted && user) {
      fetchStats();
      fetchAnalytics();
    }
  }, [mounted, user]);

  useEffect(() => {
    if (activeTab === 'analytics' && mounted && user) {
      fetchAnalytics();
    }
  }, [activeTab, mounted, user]);

  if (loading || !mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'SUPER_ADMIN') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50/30">
      {/* Header with Gradient */}
      <header className="bg-gradient-to-r from-amber-600 via-orange-500 to-red-500 sticky top-0 z-50 shadow-xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVHJhbnNmb3JtPSJyb3RhdGUoNDUpIj48cGF0aCBkPSJNLTEwIDMwaDYwdjJoLTYweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNhKSIvPjwvc3ZnPg==')] opacity-30"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm shadow-lg">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">SuperAdmin Dashboard</h1>
                <p className="text-sm text-white/80 mt-0.5">
                  Welcome back, <span className="font-semibold text-white">{user.firstName} {user.lastName}</span>
                </p>
              </div>
            </div>
            <Button
              onClick={logout}
              variant="outline"
              className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:border-white/50 backdrop-blur-sm transition-all duration-200"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="inline-flex h-12 items-center justify-center rounded-2xl bg-white/80 backdrop-blur-sm p-1.5 shadow-lg border border-slate-200/50 gap-1">
            <TabsTrigger value="overview" className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">Overview</TabsTrigger>
            <TabsTrigger value="companies" className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">Companies</TabsTrigger>
            <TabsTrigger value="departments" className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">Departments</TabsTrigger>
            <TabsTrigger value="users" className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">Users</TabsTrigger>
            <TabsTrigger value="analytics" className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">Analytics</TabsTrigger>
            <TabsTrigger value="audit" className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">Audit Logs</TabsTrigger>
            <TabsTrigger value="settings" className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">Settings</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Total Companies - Gradient Blue Card */}
              <Card 
                className="group relative overflow-hidden bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 border-0 shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer rounded-2xl"
                onClick={() => setActiveTab('companies')}
              >
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVHJhbnNmb3JtPSJyb3RhdGUoNDUpIj48cGF0aCBkPSJNLTEwIDMwaDYwdjJoLTYweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNhKSIvPjwvc3ZnPg==')] opacity-30"></div>
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-[100px]"></div>
                <CardHeader className="pb-2 relative">
                  <CardTitle className="text-white/90 text-sm font-medium flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                        <Building className="w-4 h-4 text-white" />
                      </div>
                      Total Companies
                    </span>
                    <svg className="w-5 h-5 text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  <p className="text-4xl font-bold text-white mb-2">{stats.companies}</p>
                  <p className="text-sm text-white/80 font-medium">
                    <span className="inline-flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      {stats.activeCompanies} active
                    </span>
                  </p>
                </CardContent>
              </Card>

              {/* Total Users - Gradient Emerald Card */}
              <Card 
                className="group relative overflow-hidden bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 border-0 shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer rounded-2xl"
                onClick={() => setActiveTab('users')}
              >
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVHJhbnNmb3JtPSJyb3RhdGUoNDUpIj48cGF0aCBkPSJNLTEwIDMwaDYwdjJoLTYweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNhKSIvPjwvc3ZnPg==')] opacity-30"></div>
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-[100px]"></div>
                <CardHeader className="pb-2 relative">
                  <CardTitle className="text-white/90 text-sm font-medium flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                        <Users className="w-4 h-4 text-white" />
                      </div>
                      Total Users
                    </span>
                    <svg className="w-5 h-5 text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  <p className="text-4xl font-bold text-white mb-2">{stats.users}</p>
                  <p className="text-sm text-white/80 font-medium">
                    <span className="inline-flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-300 animate-pulse"></span>
                      {stats.activeUsers} active
                    </span>
                  </p>
                </CardContent>
              </Card>

              {/* Departments - Gradient Purple Card */}
              <Card 
                className="group relative overflow-hidden bg-gradient-to-br from-purple-500 via-purple-600 to-fuchsia-700 border-0 shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer rounded-2xl"
                onClick={() => setActiveTab('departments')}
              >
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVHJhbnNmb3JtPSJyb3RhdGUoNDUpIj48cGF0aCBkPSJNLTEwIDMwaDYwdjJoLTYweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNhKSIvPjwvc3ZnPg==')] opacity-30"></div>
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-[100px]"></div>
                <CardHeader className="pb-2 relative">
                  <CardTitle className="text-white/90 text-sm font-medium flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      Departments
                    </span>
                    <svg className="w-5 h-5 text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  <p className="text-4xl font-bold text-white mb-2">{stats.departments}</p>
                  <p className="text-sm text-white/80 font-medium">
                    <span className="inline-flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                      Total departments
                    </span>
                  </p>
                </CardContent>
              </Card>

              {/* System Status - Gradient Amber Card */}
              <Card className="group relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 border-0 shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 rounded-2xl">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVHJhbnNmb3JtPSJyb3RhdGUoNDUpIj48cGF0aCBkPSJNLTEwIDMwaDYwdjJoLTYweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNhKSIvPjwvc3ZnPg==')] opacity-30"></div>
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-[100px]"></div>
                <CardHeader className="pb-2 relative">
                  <CardTitle className="text-white/90 text-sm font-medium flex items-center gap-2">
                    <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                      <Settings className="w-4 h-4 text-white" />
                    </div>
                    System Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  <p className="text-2xl font-bold text-white mb-2">✓ Operational</p>
                  <p className="text-sm text-white/80 font-medium">
                    <span className="inline-flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse"></span>
                      All systems running
                    </span>
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions and Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border border-slate-200 shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-slate-900 text-lg font-semibold">Quick Actions</CardTitle>
                  <CardDescription className="text-slate-500">Manage your platform</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    className="w-full justify-start" 
                    variant="outline"
                    onClick={() => setActiveTab('companies')}
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    Manage Companies
                  </Button>
                  <Button 
                    className="w-full justify-start" 
                    variant="outline"
                    onClick={() => setActiveTab('users')}
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    Manage Users
                  </Button>
                  <Button 
                    className="w-full justify-start" 
                    variant="outline"
                    onClick={() => setActiveTab('settings')}
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    System Settings
                  </Button>
                  <Button 
                    className="w-full justify-start" 
                    variant="outline"
                    onClick={() => setActiveTab('audit')}
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    View Audit Logs
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Latest platform events</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">SuperAdmin account created</p>
                        <p className="text-xs text-gray-500">Just now</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">System initialized</p>
                        <p className="text-xs text-gray-500">Today</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* User Info */}
            <Card>
              <CardHeader>
                <CardTitle>Your Account Information</CardTitle>
                <CardDescription>SuperAdmin account details</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">User ID</p>
                    <p className="text-lg font-semibold">{user.userId}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Email</p>
                    <p className="text-lg font-semibold">{user.email}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Full Name</p>
                    <p className="text-lg font-semibold">{user.firstName} {user.lastName}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Role</p>
                    <p className="text-lg font-semibold">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                        {user.role}
                      </span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Companies Tab */}
          <TabsContent value="companies" className="space-y-6">
            <Card className="rounded-2xl border-0 shadow-xl overflow-hidden bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white px-6 py-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                      <Building className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold text-white">Company Management</CardTitle>
                      <CardDescription className="text-white/80 mt-0.5">Manage all companies in the platform</CardDescription>
                    </div>
                  </div>
                  <Button 
                    className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm transition-all duration-200 rounded-xl px-5"
                    onClick={() => setShowCreateDialog(true)}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Company
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {companiesLoading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading companies...</p>
                  </div>
                ) : companies.length === 0 ? (
                  <div className="text-center py-12">
                    <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No companies yet</h3>
                    <p className="text-gray-500 mb-4">Get started by creating your first company</p>
                    <Button variant="outline" onClick={() => setShowCreateDialog(true)}>Create Company</Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {companies.map((company) => (
                      <div key={company._id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 cursor-pointer" onClick={() => router.push(`/superadmin/company/${company._id}`)}>
                            <h4 className="font-semibold text-lg text-blue-600 hover:text-blue-800 hover:underline">{company.name}</h4>
                            <p className="text-sm text-gray-500">ID: {company.companyId}</p>
                            <p className="text-sm text-gray-500">{company.contactEmail} • {company.contactPhone}</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              company.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {company.isActive ? 'Active' : 'Inactive'}
                            </span>
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {company.companyType}
                            </span>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-blue-600 hover:text-blue-900"
                              onClick={() => handleEditCompany(company)}
                            >
                              Edit
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-red-600 hover:text-red-900"
                              onClick={() => handleDeleteCompany(company)}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <Pagination
                      currentPage={companyPage}
                      totalPages={companyPagination.pages}
                      totalItems={companyPagination.total}
                      itemsPerPage={companyPagination.limit}
                      onPageChange={setCompanyPage}
                      className="mt-6 shadow-none border-t border-slate-100 rounded-none bg-slate-50/30"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Departments Tab */}
          <TabsContent value="departments" className="space-y-6">
            <Card className="rounded-2xl border-0 shadow-xl overflow-hidden bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 text-white px-6 py-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold text-white">Department Management</CardTitle>
                      <CardDescription className="text-white/80 mt-0.5">Manage all departments across companies</CardDescription>
                    </div>
                  </div>
                  <Button 
                    className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm transition-all duration-200 rounded-xl px-5"
                    onClick={() => setShowDepartmentDialog(true)}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Department
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-purple-50 via-fuchsia-50 to-pink-50 border-b border-purple-100">
                      <tr>
                        <th className="px-3 py-4 text-center text-xs font-bold text-purple-700 uppercase tracking-wider">Sr. No.</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-purple-700 uppercase tracking-wider">Department</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-purple-700 uppercase tracking-wider">Company</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-purple-700 uppercase tracking-wider">Contact</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-purple-700 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-purple-700 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {departments.map((department, index) => (
                        <tr key={department._id} className="hover:bg-gradient-to-r hover:from-purple-50/50 hover:to-pink-50/50 transition-all duration-200">
                          <td className="px-3 py-4 text-center">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-purple-100 text-purple-700 text-xs font-bold">
                              {(departmentPage - 1) * departmentPagination.limit + index + 1}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div 
                              className="cursor-pointer"
                              onClick={() => {
                                const companyId = typeof department.companyId === 'object' ? department.companyId._id : department.companyId;
                                router.push(`/superadmin/department/${department._id}?companyId=${companyId}`);
                              }}
                            >
                              <div className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline">{department.name}</div>
                              <div className="text-sm text-gray-500">{department.departmentId}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {getCompanyDisplay(department.companyId)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {department.contactPerson || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              Active
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-blue-600 hover:text-blue-900 mr-2"
                              onClick={() => handleEditDepartment(department)}
                            >
                              Edit
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-red-600 hover:text-red-900"
                              onClick={() => handleDeleteDepartment(department)}
                            >
                              Delete
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Pagination
                  currentPage={departmentPage}
                  totalPages={departmentPagination.pages}
                  totalItems={departmentPagination.total}
                  itemsPerPage={departmentPagination.limit}
                  onPageChange={setDepartmentPage}
                  className="mt-6 shadow-none border-t border-slate-100 rounded-none bg-slate-50/30"
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            <Card className="rounded-2xl border-0 shadow-xl overflow-hidden bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white px-6 py-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold text-white">User Management</CardTitle>
                      <CardDescription className="text-white/80 mt-0.5">Manage all users across the platform</CardDescription>
                    </div>
                  </div>
                  <Button 
                    className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm transition-all duration-200 rounded-xl px-5"
                    onClick={() => {
                      setEditingUser(null);
                      setShowUserDialog(true);
                    }}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add User
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="p-4 border-b border-emerald-100 flex items-center gap-4">
                  <label className="text-sm font-medium text-emerald-800">Filter by role:</label>
                  <select
                    value={userRoleFilter}
                    onChange={(e) => setUserRoleFilter(e.target.value)}
                    className="rounded-lg border border-emerald-200 px-3 py-2 text-sm bg-white"
                  >
                    <option value="">All users</option>
                    <option value="COMPANY_ADMIN">Company Admin only</option>
                    <option value="SUPER_ADMIN">Super Admin only</option>
                    <option value="DEPARTMENT_ADMIN">Department Admin only</option>
                    <option value="OPERATOR">Operator only</option>
                  </select>
                </div>
                <div className="overflow-hidden">
                  {(() => {
                    const filtered = userRoleFilter ? users.filter(u => u.role === userRoleFilter) : users;
                    return filtered.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>{userRoleFilter ? `No users with role ${userRoleFilter}.` : 'No users yet. Add users or ensure you have Company Admins and other roles.'}</p>
                    </div>
                  ) : (
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 border-b border-emerald-100">
                      <tr>
                        <th className="px-3 py-4 text-center text-xs font-bold text-emerald-700 uppercase tracking-wider">Sr. No.</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-emerald-700 uppercase tracking-wider">User</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-emerald-700 uppercase tracking-wider">Email</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-emerald-700 uppercase tracking-wider">Role</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-emerald-700 uppercase tracking-wider">Company</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-emerald-700 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-emerald-700 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {filtered.map((u, idx) => (
                      <tr key={u._id} className="hover:bg-gradient-to-r hover:from-emerald-50/50 hover:to-cyan-50/50 transition-all duration-200">
                        <td className="px-3 py-4 text-center">
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                            {(userPage - 1) * userPagination.limit + idx + 1}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold bg-gradient-to-br from-emerald-500 to-teal-600">
                              {(u.firstName?.[0] || '')}{(u.lastName?.[0] || '')}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{u.firstName} {u.lastName}</div>
                              <div className="text-sm text-gray-500">{u.userId || u._id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{u.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            u.role === 'SUPER_ADMIN' ? 'bg-yellow-100 text-yellow-800' :
                            u.role === 'COMPANY_ADMIN' ? 'bg-blue-100 text-blue-800' :
                            u.role === 'DEPARTMENT_ADMIN' ? 'bg-purple-100 text-purple-800' :
                            'bg-slate-100 text-slate-800'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {typeof u.companyId === 'object' && u.companyId?.name ? u.companyId.name : (u.companyId ? String(u.companyId) : '—')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${u.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {u.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-blue-600 hover:text-blue-900 mr-2"
                            onClick={() => handleEditUser(u)}
                          >
                            Edit
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-600 hover:text-red-900"
                            onClick={() => handleDeleteUser(u)}
                          >
                            Delete
                          </Button>
                        </td>
                      </tr>
                      ))}
                    </tbody>
                  </table>
                  );
                  })()}
                </div>

                <Pagination
                  currentPage={userPage}
                  totalPages={userPagination.pages}
                  totalItems={userPagination.total}
                  itemsPerPage={userPagination.limit}
                  onPageChange={setUserPage}
                  className="mt-6 shadow-none border-t border-slate-100 rounded-none bg-slate-50/30"
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            {loadingAnalytics ? (
              <div className="text-center py-16">
                <LoadingSpinner size="lg" text="Loading analytics..." />
              </div>
            ) : analyticsData ? (
              <div className="space-y-8 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                {/* System Overview Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Companies Distribution</CardTitle>
                      <CardDescription>Active vs Inactive companies</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Active', value: stats.activeCompanies },
                              { name: 'Inactive', value: stats.companies - stats.activeCompanies }
                            ].filter(item => item.value > 0)}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {[
                              { name: 'Active', value: stats.activeCompanies },
                              { name: 'Inactive', value: stats.companies - stats.activeCompanies }
                            ].filter(item => item.value > 0).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow animate-in fade-in-0 slide-in-from-right-4 duration-500">
                    <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                      <CardTitle className="text-slate-900">Users Distribution</CardTitle>
                      <CardDescription className="text-slate-600">Active vs Inactive users</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Active', value: stats.activeUsers },
                              { name: 'Inactive', value: stats.users - stats.activeUsers }
                            ].filter(item => item.value > 0)}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {[
                              { name: 'Active', value: stats.activeUsers },
                              { name: 'Inactive', value: stats.users - stats.activeUsers }
                            ].filter(item => item.value > 0).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                {/* Grievance & Appointment Analytics */}
                {analyticsData.grievances && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-300">
                      <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                        <CardTitle className="text-slate-900">Grievance Status Distribution</CardTitle>
                        <CardDescription className="text-slate-600">System-wide grievance status</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={[
                            { name: 'Total', value: analyticsData.grievances.total },
                            { name: 'Pending', value: analyticsData.grievances.pending },
                            { name: 'In Progress', value: analyticsData.grievances.inProgress },
                            { name: 'Resolved', value: analyticsData.grievances.resolved }
                          ]}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="value" fill="#8884d8" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-300">
                      <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                        <CardTitle className="text-slate-900">Appointment Status Distribution</CardTitle>
                        <CardDescription className="text-slate-600">System-wide appointment status</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={[
                            { name: 'Total', value: analyticsData.appointments.total },
                            { name: 'Pending', value: analyticsData.appointments.pending },
                            { name: 'Confirmed', value: analyticsData.appointments.confirmed },
                            { name: 'Completed', value: analyticsData.appointments.completed }
                          ]}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="value" fill="#00C49F" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Time Series Charts */}
                {analyticsData.grievances?.daily && analyticsData.grievances.daily.length > 0 && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-300">
                      <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                        <CardTitle className="text-slate-900">Grievance Trends (Last 7 Days)</CardTitle>
                        <CardDescription className="text-slate-600">Daily grievance creation</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <AreaChart data={analyticsData.grievances.daily}>
                            <defs>
                              <linearGradient id="colorGrievances" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Area type="monotone" dataKey="count" stroke="#8884d8" fillOpacity={1} fill="url(#colorGrievances)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-300">
                      <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                        <CardTitle className="text-slate-900">Appointment Trends (Last 7 Days)</CardTitle>
                        <CardDescription className="text-slate-600">Daily appointment creation</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <AreaChart data={analyticsData.appointments?.daily || []}>
                            <defs>
                              <linearGradient id="colorAppointments" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#00C49F" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#00C49F" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Area type="monotone" dataKey="count" stroke="#00C49F" fillOpacity={1} fill="url(#colorAppointments)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Performance Metrics */}
                {analyticsData.grievances && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105 cursor-pointer">
                      <CardHeader className="bg-gradient-to-br from-green-50 to-emerald-50 border-b border-green-100">
                        <CardTitle className="text-sm font-semibold text-green-800">Resolution Rate</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-green-700">
                          {analyticsData.grievances.resolutionRate || 0}%
                        </div>
                        <p className="text-xs text-green-600 mt-1">
                          {analyticsData.grievances.resolved} of {analyticsData.grievances.total} resolved
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                      <CardHeader>
                        <CardTitle className="text-sm font-medium text-blue-800">Completion Rate</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-blue-700">
                          {analyticsData.appointments?.completionRate || 0}%
                        </div>
                        <p className="text-xs text-blue-600 mt-1">
                          {analyticsData.appointments?.completed || 0} of {analyticsData.appointments?.total || 0} completed
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                      <CardHeader>
                        <CardTitle className="text-sm font-medium text-purple-800">Last 7 Days</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-purple-700">
                          {analyticsData.grievances.last7Days || 0}
                        </div>
                        <p className="text-xs text-purple-600 mt-1">New grievances</p>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                      <CardHeader>
                        <CardTitle className="text-sm font-medium text-orange-800">Last 7 Days</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-orange-700">
                          {analyticsData.appointments?.last7Days || 0}
                        </div>
                        <p className="text-xs text-orange-600 mt-1">New appointments</p>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500">No analytics data available</p>
              </div>
            )}
          </TabsContent>

          {/* Audit Logs Tab */}
          <TabsContent value="audit" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Audit Logs</CardTitle>
                <CardDescription>Track all system activities and changes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start space-x-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">User Created</p>
                      <p className="text-sm text-gray-500">SuperAdmin account was created</p>
                      <p className="text-xs text-gray-400 mt-1">Just now • By System</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">System Initialized</p>
                      <p className="text-sm text-gray-500">Platform setup completed</p>
                      <p className="text-xs text-gray-400 mt-1">Today • By System</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>System Configuration</CardTitle>
                  <CardDescription>Configure platform settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Email Notifications</p>
                      <p className="text-sm text-gray-500">Send email alerts to users</p>
                    </div>
                    <Button variant="outline" size="sm">Configure</Button>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">WhatsApp Integration</p>
                      <p className="text-sm text-gray-500">Manage WhatsApp API settings</p>
                    </div>
                    <Button variant="outline" size="sm">Configure</Button>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Security Settings</p>
                      <p className="text-sm text-gray-500">Password policies and 2FA</p>
                    </div>
                    <Button variant="outline" size="sm">Configure</Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Database & Storage</CardTitle>
                  <CardDescription>Manage data and backups</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Database Backup</p>
                      <p className="text-sm text-gray-500">Last backup: Never</p>
                    </div>
                    <Button variant="outline" size="sm">Backup Now</Button>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Storage Usage</p>
                      <p className="text-sm text-gray-500">0 MB / 10 GB used</p>
                    </div>
                    <Button variant="outline" size="sm">View Details</Button>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Data Export</p>
                      <p className="text-sm text-gray-500">Export all platform data</p>
                    </div>
                    <Button variant="outline" size="sm">Export</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
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
