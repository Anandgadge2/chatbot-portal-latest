'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
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
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Building, Users, Shield, Settings, FileText, BarChart2, RefreshCw, Search, Download, Trash2, Edit2, Plus, History, Terminal, ChevronRight, User as UserIcon } from 'lucide-react';
import { Pagination } from '@/components/ui/Pagination';
import RecentActivityPanel from '@/components/dashboard/RecentActivityPanel';
import TerminalLogs from '@/components/dashboard/TerminalLogs';

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
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDepartmentDialog, setShowDepartmentDialog] = useState(false);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [userRoleFilter, setUserRoleFilter] = useState<string>('');
  const [userSearchTerm, setUserSearchTerm] = useState<string>('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>('');
  const [userCompanyFilter, setUserCompanyFilter] = useState<string>('');
  const [deptSearchTerm, setDeptSearchTerm] = useState<string>('');
  const [deptDebouncedSearchTerm, setDeptDebouncedSearchTerm] = useState<string>('');
  const [deptCompanyFilter, setDeptCompanyFilter] = useState<string>('');
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [companySearchTerm, setCompanySearchTerm] = useState<string>('');
  const [companyDebouncedSearchTerm, setCompanyDebouncedSearchTerm] = useState<string>('');
  const [companyStatusFilter, setCompanyStatusFilter] = useState<string>('');
  const [companyTypeFilter, setCompanyTypeFilter] = useState<string>('');
  
  // Pagination State
  const [companyPage, setCompanyPage] = useState(1);
  const [companyPagination, setCompanyPagination] = useState({ total: 0, pages: 1, limit: 10 });
  
  const [departmentPage, setDepartmentPage] = useState(1);
  const [departmentPagination, setDepartmentPagination] = useState({ total: 0, pages: 1, limit: 10 });
  
  const [userPage, setUserPage] = useState(1);
  const [userPagination, setUserPagination] = useState({ total: 0, pages: 1, limit: 10 });
  const [visiblePasswords, setVisiblePasswords] = useState<string[]>([]);

  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

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
      const response = await companyAPI.getAll({ 
        page, 
        limit: companyPagination.limit,
        search: companyDebouncedSearchTerm,
        isActive: companyStatusFilter === '' ? undefined : companyStatusFilter === 'active',
        companyType: companyTypeFilter || undefined
      });
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
  }, [companyPage, companyPagination.limit, companyDebouncedSearchTerm, companyStatusFilter, companyTypeFilter]);

  const fetchDepartments = useCallback(async (page = departmentPage) => {
    try {
      const response = await departmentAPI.getAll({ 
        page, 
        limit: departmentPagination.limit,
        search: deptDebouncedSearchTerm,
        companyId: deptCompanyFilter
      });
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
  }, [departmentPage, departmentPagination.limit, deptDebouncedSearchTerm, deptCompanyFilter]);

  const fetchUsers = useCallback(async (page = userPage) => {
    try {
      const response = await userAPI.getAll({ 
        page, 
        limit: userPagination.limit, 
        role: userRoleFilter,
        search: debouncedSearchTerm,
        companyId: userCompanyFilter
      });
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
  }, [userPage, userPagination.limit, userRoleFilter, debouncedSearchTerm, userCompanyFilter]);

  const fetchStats = async () => {
    // Fetch each stat independently so one 403/failure doesn't block others (e.g. Users tab still loads)
    let companies: Company[] = [];
    let usersList: User[] = [];
    let departmentsList: Department[] = [];
    try {
      const companiesResponse = await companyAPI.getAll({ limit: 1000 });
      if (companiesResponse.success) {
        companies = companiesResponse.data.companies;
        setAllCompanies(companies);
      }
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

  const toggleCompanyStatus = async (company: Company) => {
    try {
      const response = await companyAPI.update(company._id, {
        isActive: !company.isActive
      } as any);
      if (response.success) {
        toast.success(`Company ${!company.isActive ? 'activated' : 'suspended'} successfully`);
        fetchCompanies();
        fetchStats();
      }
    } catch (error: any) {
      toast.error('Failed to update company status');
    }
  };

  const toggleDepartmentStatus = async (dept: Department) => {
    try {
      const response = await departmentAPI.update(dept._id, {
        isActive: !dept.isActive
      });
      if (response.success) {
        toast.success(`Department ${!dept.isActive ? 'activated' : 'deactivated'} successfully`);
        fetchDepartments();
        fetchStats();
      }
    } catch (error: any) {
      toast.error('Failed to update department status');
    }
  };

  const toggleUserStatus = async (u: User) => {
    try {
      const response = await userAPI.update(u._id, {
        isActive: !u.isActive
      } as any);
      if (response.success) {
        toast.success(`User ${!u.isActive ? 'activated' : 'deactivated'} successfully`);
        fetchUsers();
        fetchStats();
      }
    } catch (error: any) {
      toast.error('Failed to update user status');
    }
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
    const handler = setTimeout(() => {
      setCompanyDebouncedSearchTerm(companySearchTerm);
    }, 500);
    return () => clearTimeout(handler);
  }, [companySearchTerm]);

  useEffect(() => {
    if (mounted && user) {
      fetchCompanies(companyPage);
    }
  }, [mounted, user, companyPage, fetchCompanies, companyDebouncedSearchTerm, companyStatusFilter, companyTypeFilter]);

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
  }, [mounted, user, departmentPage, deptDebouncedSearchTerm, deptCompanyFilter, fetchDepartments]);

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
  }, [mounted, user, userPage, userRoleFilter, debouncedSearchTerm, userCompanyFilter, fetchUsers]);

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

  if (!user || user.role !== 'SUPER_ADMIN') {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Header with Gradient */}
      {/* Classic White Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-200">
                  <Shield className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h1 className="text-base font-bold text-slate-900 tracking-tight leading-none">Master Admin</h1>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Control Center</p>
                </div>
              </div>

              <div className="h-8 w-px bg-slate-200 hidden md:block"></div>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full hidden md:block">
                <TabsList className="bg-transparent border-0 h-14 gap-0.5 p-0">
                  {[
                    { val: 'overview', label: 'Overview', icon: BarChart2 },
                    { val: 'companies', label: 'Companies', icon: Building },
                    { val: 'departments', label: 'Departments', icon: Settings },
                    { val: 'users', label: 'Users', icon: Users },
                    { val: 'terminal', label: 'System Logs', icon: Terminal },
                  ].map((t) => (
                    <TabsTrigger
                      key={t.val}
                      value={t.val}
                      className="px-4 h-full rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-indigo-600 text-slate-500 font-bold text-[11px] transition-all hover:text-slate-900"
                    >
                      <t.icon className="w-3.5 h-3.5 mr-2" />
                      {t.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden md:flex flex-col items-end">
                <span className="text-xs font-bold text-slate-900">{user.firstName} {user.lastName}</span>
                <span className="text-[10px] text-slate-500 font-medium">Platform Superadmin</span>
              </div>
              <Button
                onClick={logout}
                variant="outline"
                size="sm"
                className="border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all duration-200 shadow-sm rounded-lg font-bold text-[11px] uppercase tracking-wider"
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 lg:px-6 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          {/* Main Content Areas */}

          <TabsContent value="overview" className="space-y-6 outline-none">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tighter">System Intelligence</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">Real-time Metrics • Active Nodes</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                 <div className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm flex items-center gap-3">
                    <div className="text-[9px] font-black text-slate-400 uppercase leading-none">Security<br/>Status</div>
                    <div className="h-6 w-px bg-slate-100"></div>
                    <div className="flex items-center gap-1.5">
                       <Shield className="w-3.5 h-3.5 text-indigo-600" />
                       <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider">Protected</span>
                    </div>
                 </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Companies */}
              <Card 
                className="group relative overflow-hidden bg-white border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer rounded-2xl"
                onClick={() => setActiveTab('companies')}
              >
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                   <Building className="w-24 h-24 text-blue-600 -mr-8 -mt-8 rotate-12" />
                </div>
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-slate-500 text-[10px] font-black uppercase tracking-widest flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-600">
                        <Building className="w-4 h-4" />
                      </div>
                      Organizations
                    </span>
                    <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-black text-slate-900 tracking-tighter">{stats.companies}</p>
                    <span className="text-[10px] font-bold text-slate-400">Entities</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                       <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(stats.activeCompanies / stats.companies) * 100}%` }} />
                    </div>
                    <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 uppercase">
                      {stats.activeCompanies} Active
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Total Users */}
              <Card 
                className="group relative overflow-hidden bg-white border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer rounded-2xl"
                onClick={() => setActiveTab('users')}
              >
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                   <Users className="w-24 h-24 text-emerald-600 -mr-8 -mt-8 -rotate-12" />
                </div>
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-slate-500 text-[10px] font-black uppercase tracking-widest flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-600">
                        <Users className="w-4 h-4" />
                      </div>
                      Total Users
                    </span>
                    <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-black text-slate-900 tracking-tighter">{stats.users}</p>
                    <span className="text-[10px] font-bold text-slate-400">Total</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                       <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(stats.activeUsers / stats.users) * 100}%` }} />
                    </div>
                    <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 uppercase">
                      {stats.activeUsers} Live
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Departments */}
              <Card 
                className="group relative overflow-hidden bg-white border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer rounded-2xl"
                onClick={() => setActiveTab('departments')}
              >
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                   <Settings className="w-24 h-24 text-purple-600 -mr-8 -mt-8 rotate-45" />
                </div>
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-slate-500 text-[10px] font-black uppercase tracking-widest flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center text-purple-600">
                        <Settings className="w-4 h-4" />
                      </div>
                      Departments   
                    </span>
                    <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-purple-500 group-hover:translate-x-1 transition-all" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-black text-slate-900 tracking-tighter">{stats.departments}</p>
                    <span className="text-[10px] font-bold text-slate-400">Nodes</span>
                  </div>
                  <div className="mt-3">
                    <span className="text-[9px] font-black text-purple-600 bg-purple-50 px-2 py-1 rounded-md border border-purple-100 uppercase tracking-widest">
                       Multi-Company Coverage
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* System Status */}
              <Card className="group relative overflow-hidden bg-slate-900 border-0 shadow-lg rounded-2xl">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                   <Shield className="w-24 h-24 text-emerald-500 -mr-8 -mt-8" />
                </div>
                <CardHeader className="p-4 pb-2 relative z-10">
                  <CardTitle className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
                    <span className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                      Infrastructure
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 relative z-10">
                  <p className="text-2xl font-black text-white tracking-tight uppercase italic">{stats.systemStatus}</p>
                  <div className="mt-4 flex flex-col gap-1">
                     <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Global Runtime</div>
                     <div className="text-[10px] font-bold text-emerald-400 flex items-center gap-1.5">
                        <RefreshCw className="w-3 h-3 animate-spin [animation-duration:4s]" />
                        All clusters responding
                     </div>
                  </div>
                </CardContent>
              </Card>
            </div>

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
                          {user.firstName[0]}{user.lastName[0]}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 leading-none">{user.firstName} {user.lastName}</p>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{user.role}</p>
                        </div>
                      </div>
                      <div className="pt-4 border-t border-slate-100 space-y-3">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="font-bold text-slate-500 uppercase">User ID</span>
                          <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{user.userId}</span>
                        </div>
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="font-bold text-slate-500 uppercase">Email</span>
                          <span className="text-slate-700 font-medium">{user.email}</span>
                        </div>
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="font-bold text-slate-500 uppercase">Access Level</span>
                          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full font-bold">Unrestricted</span>
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
                      <span className="text-xs font-bold text-slate-500 uppercase">API Status</span>
                      <span className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                        Healthy
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 mb-1">
                      <div className="bg-indigo-600 h-1.5 rounded-full w-[98%] shadow-[0_0_8px_rgba(79,70,229,0.3)]" />
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-[10px] font-bold text-slate-400">UPTIME</span>
                      <span className="text-[10px] font-bold text-slate-900 uppercase">99.9%</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Companies Tab */}
          <TabsContent value="companies" className="space-y-4">
            <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
              <CardHeader className="bg-slate-900 border-0 px-5 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center backdrop-blur-md border border-white/20">
                      <Building className="w-4.5 h-4.5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold text-white">Organization Registry</CardTitle>
                      <CardDescription className="text-slate-400 text-[10px] font-medium leading-none mt-1">Manage global corporate entities</CardDescription>
                    </div>
                  </div>
                  <Button 
                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg h-8 shadow-md shadow-indigo-900/20 font-bold text-[10px] uppercase tracking-wider px-4 border-0 transition-all"
                    onClick={() => setShowCreateDialog(true)}
                  >
                    <Plus className="w-3 h-3 mr-1.5" />
                    Add Organization
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/30 flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[280px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Find by name or ID..."
                      value={companySearchTerm}
                      onChange={(e) => {
                        setCompanySearchTerm(e.target.value);
                        setCompanyPage(1);
                      }}
                      className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Status</span>
                    <select
                      value={companyStatusFilter}
                      onChange={(e) => {
                        setCompanyStatusFilter(e.target.value);
                        setCompanyPage(1);
                      }}
                      className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-600 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all cursor-pointer"
                    >
                      <option value="">All Status</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Type</span>
                    <select
                      value={companyTypeFilter}
                      onChange={(e) => {
                        setCompanyTypeFilter(e.target.value);
                        setCompanyPage(1);
                      }}
                      className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-600 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all cursor-pointer"
                    >
                      <option value="">All Types</option>
                      <option value="SOCIETY">Society</option>
                      <option value="GOVERNMENT">Government</option>
                      <option value="CORPORATE">Corporate</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                   <table className="w-full">
                    <thead className="bg-[#fcfdfe] border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-2.5 text-center text-[9px] font-bold text-slate-400 uppercase tracking-widest">#</th>
                        <th className="px-5 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">Organization</th>
                        <th className="px-5 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">ID</th>
                        <th className="px-5 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">Head</th>
                        <th className="px-5 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">Contact</th>
                        <th className="px-5 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">Type</th>
                        <th className="px-5 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                        <th className="px-5 py-2.5 text-right text-[9px] font-bold text-slate-400 uppercase tracking-widest">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {companiesLoading ? (
                        <tr>
                          <td colSpan={8} className="py-20 text-center">
                            <LoadingSpinner text="Refreshing database..." />
                          </td>
                        </tr>
                      ) : companies.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-20 text-center">
                            <div className="flex flex-col items-center justify-center">
                              <Building className="w-12 h-12 text-slate-200 mb-3" />
                              <p className="text-slate-500 font-medium">No organizations matching your criteria</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        companies.map((company, index) => (
                          <tr key={company._id} className="hover:bg-slate-50 transition-colors group">
                            <td className="px-4 py-4 text-center">
                              <span className="text-xs font-bold text-slate-400">
                                {(companyPage - 1) * companyPagination.limit + index + 1}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div 
                                className="cursor-pointer"
                                onClick={() => router.push(`/superadmin/company/${company._id}`)}
                              >
                                <div className="text-sm font-bold text-blue-600 hover:text-blue-800 hover:underline">{company.name}</div>
                                <div className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-tighter">System Entry: {new Date(company.createdAt).toLocaleDateString()}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                               <span className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 border border-slate-200">
                                 {company.companyId}
                               </span>
                            </td>
                            <td className="px-5 py-3 whitespace-nowrap">
                              <div className="text-[11px] font-bold text-slate-700">{(company as any).companyHead?.name || 'Not Assigned'}</div>
                              <div className="text-[9px] font-medium text-slate-400 mt-0.5">{(company as any).companyHead?.email || '-'}</div>
                            </td>
                            <td className="px-5 py-3 whitespace-nowrap">
                              <div className="text-[11px] font-bold text-indigo-600">
                                {(() => {
                                  const phone = (company as any).companyHead?.phone || company.contactPhone;
                                  if (!phone) return '-';
                                  const digitsOnly = phone.replace(/\D/g, '');
                                  return digitsOnly.length >= 10 ? digitsOnly.slice(-10) : digitsOnly;
                                })()}
                              </div>
                            </td>
                            <td className="px-5 py-3 whitespace-nowrap">
                              <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[9px] font-bold border border-indigo-100 uppercase tracking-wider">
                                {company.companyType}
                              </span>
                            </td>
                            <td className="px-5 py-3 whitespace-nowrap">
                              <button 
                                onClick={() => toggleCompanyStatus(company)}
                                className={`px-2 py-0.5 rounded-md text-[9px] font-bold border uppercase tracking-widest transition-all hover:scale-105 active:scale-95 ${
                                company.isActive 
                                  ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100' 
                                  : 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100'
                              }`}>
                                {company.isActive ? 'Active' : 'Suspended'}
                              </button>
                            </td>
                            <td className="px-5 py-3 whitespace-nowrap text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-7 w-7 p-0 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                  onClick={() => handleEditCompany(company)}
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                  onClick={() => handleDeleteCompany(company)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/20">
                  <Pagination
                    currentPage={companyPage}
                    totalPages={companyPagination.pages}
                    totalItems={companyPagination.total}
                    itemsPerPage={companyPagination.limit}
                    onPageChange={setCompanyPage}
                    className="shadow-none"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Departments Tab */}
          <TabsContent value="departments" className="space-y-4">
            <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
              <CardHeader className="bg-slate-900 border-0 px-5 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center backdrop-blur-md border border-white/20">
                      <Settings className="w-4.5 h-4.5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold text-white">Department Ecosystem</CardTitle>
                      <CardDescription className="text-slate-400 text-[10px] font-medium leading-none mt-1">Hierarchical organization structure</CardDescription>
                    </div>
                  </div>
                  <Button 
                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg h-8 shadow-md shadow-indigo-900/20 font-bold text-[10px] uppercase tracking-wider px-4 border-0 transition-all"
                    onClick={() => {
                      setEditingDepartment(null);
                      setShowDepartmentDialog(true);
                    }}
                  >
                    <Plus className="w-3 h-3 mr-1.5" />
                    Add Department
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/30 flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[280px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      placeholder="Find department..."
                      value={deptSearchTerm}
                      onChange={(e) => {
                        setDeptSearchTerm(e.target.value);
                        setDepartmentPage(1);
                      }}
                      className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Filter By Company</span>
                    <select
                      value={deptCompanyFilter}
                      onChange={(e) => {
                        setDeptCompanyFilter(e.target.value);
                        setDepartmentPage(1);
                      }}
                      className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-600 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all cursor-pointer min-w-[150px]"
                    >
                      <option value="">All Companies</option>
                      {allCompanies.map(c => (
                        <option key={c._id} value={c._id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#fcfdfe] border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-2.5 text-center text-[9px] font-bold text-slate-400 uppercase tracking-widest">#</th>
                        <th className="px-5 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">Department</th>
                        <th className="px-5 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">Company</th>
                        <th className="px-5 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">Head</th>
                        <th className="px-5 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                        <th className="px-5 py-2.5 text-right text-[9px] font-bold text-slate-400 uppercase tracking-widest">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {departments.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-20 text-center">
                            <div className="flex flex-col items-center justify-center">
                              <Settings className="w-12 h-12 text-slate-200 mb-3" />
                              <p className="text-slate-500 font-medium">No departments matching your criteria</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        departments.map((department, index) => (
                          <tr key={department._id} className="hover:bg-slate-50 transition-colors group">
                            <td className="px-4 py-4 text-center">
                              <span className="text-xs font-bold text-slate-400">
                                {(departmentPage - 1) * departmentPagination.limit + index + 1}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div 
                                className="cursor-pointer"
                                onClick={() => {
                                  const companyId = typeof department.companyId === 'object' ? department.companyId?._id : department.companyId;
                                  router.push(`/superadmin/department/${department._id}?companyId=${companyId}`);
                                }}
                              >
                                <div className="text-sm font-bold text-blue-600 hover:text-blue-800 hover:underline">{department.name}</div>
                                <div className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-tighter">ID: {department.departmentId}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-xs font-bold text-slate-700">{getCompanyDisplay(department.companyId)}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-xs font-bold text-slate-700 uppercase">{department.contactPerson || 'Not Assigned'}</div>
                              <div className="text-[10px] font-medium text-slate-400 mt-0.5">
                                {(() => {
                                  const phone = department.contactPhone;
                                  if (!phone) return '-';
                                  const digitsOnly = phone.replace(/\D/g, '');
                                  return digitsOnly.length >= 10 ? digitsOnly.slice(-10) : digitsOnly;
                                })()}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <button 
                                onClick={() => toggleDepartmentStatus(department)}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-widest transition-all hover:scale-105 active:scale-95 ${
                                  department.isActive 
                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100' 
                                    : 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100'
                                }`}
                              >
                                {department.isActive ? 'Active' : 'Suspended'}
                              </button>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  onClick={() => handleEditDepartment(department)}
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                  onClick={() => handleDeleteDepartment(department)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/20">
                  <Pagination
                    currentPage={departmentPage}
                    totalPages={departmentPagination.pages}
                    totalItems={departmentPagination.total}
                    itemsPerPage={departmentPagination.limit}
                    onPageChange={setDepartmentPage}
                    className="shadow-none"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
              <CardHeader className="bg-slate-900 border-0 px-5 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center backdrop-blur-md border border-white/20">
                      <Users className="w-4.5 h-4.5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold text-white">Platform Users</CardTitle>
                      <CardDescription className="text-slate-400 text-[10px] font-medium leading-none mt-1">Access control and identity management</CardDescription>
                    </div>
                  </div>
                  <Button 
                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg h-8 shadow-md shadow-indigo-900/20 font-bold text-[10px] uppercase tracking-wider px-4 border-0 transition-all"
                    onClick={() => {
                      setEditingUser(null);
                      setShowUserDialog(true);
                    }}
                  >
                    <Plus className="w-3 h-3 mr-1.5" />
                    Add User
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/30 flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[280px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      placeholder="Find user by name or ID..."
                      value={userSearchTerm}
                      onChange={(e) => {
                        setUserSearchTerm(e.target.value);
                        setUserPage(1);
                      }}
                      className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Company</span>
                    <select
                      value={userCompanyFilter}
                      onChange={(e) => {
                        setUserCompanyFilter(e.target.value);
                        setUserPage(1);
                      }}
                      className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-600 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all cursor-pointer min-w-[120px]"
                    >
                      <option value="">All Companies</option>
                      {allCompanies.map(c => (
                        <option key={c._id} value={c._id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Role</span>
                    <select
                      value={userRoleFilter}
                      onChange={(e) => {
                        setUserRoleFilter(e.target.value);
                        setUserPage(1);
                      }}
                      className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-600 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all cursor-pointer min-w-[120px]"
                    >
                      <option value="">All Roles</option>
                      <option value="SUPER_ADMIN">Super Admin</option>
                      <option value="COMPANY_ADMIN">Company Admin</option>
                      <option value="DEPARTMENT_ADMIN">Department Admin</option>
                      <option value="OPERATOR">Operator</option>
                    </select>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  {(() => {
                    const filtered = users; // Filtering is now done on the backend
                    return filtered.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>{userRoleFilter ? `No users with role ${userRoleFilter}.` : 'No users yet. Add users or ensure you have Company Admins and other roles.'}</p>
                    </div>
                  ) : (
                  <table className="w-full">
                    <thead className="bg-[#fcfdfe] border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-2.5 text-center text-[9px] font-bold text-slate-400 uppercase tracking-widest">#</th>
                        <th className="px-5 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">User</th>
                        <th className="px-5 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">Email</th>
                        <th className="px-5 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">Credentials</th>
                        <th className="px-5 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">Role</th>
                        <th className="px-5 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">Company</th>
                        <th className="px-5 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                        <th className="px-5 py-2.5 text-right text-[9px] font-bold text-slate-400 uppercase tracking-widest">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {filtered.map((u, idx) => (
                      <tr key={u._id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-3 py-4 text-center">
                          <span className="text-[10px] font-bold text-slate-400">
                            {(userPage - 1) * userPagination.limit + idx + 1}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold bg-indigo-600 text-[11px] shadow-md shadow-indigo-100">
                              {(u.firstName?.[0] || '')}{(u.lastName?.[0] || '')}
                            </div>
                            <div className="ml-3">
                              <div className="text-[11px] font-bold text-slate-800 leading-none">{u.firstName} {u.lastName}</div>
                              <div className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-tighter">{u.userId || u._id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-[11px] font-medium text-slate-600">{u.email}</td>
                        <td className="px-6 py-3 whitespace-nowrap">
                           <div className="flex flex-col">
                              <div className="text-[11px] font-bold text-indigo-600 tabular-nums">
                                {(() => {
                                  const phone = u.phone;
                                  if (!phone) return '-';
                                  const digitsOnly = phone.replace(/\D/g, '');
                                  return digitsOnly.length >= 10 ? digitsOnly.slice(-10) : digitsOnly;
                                })()}
                              </div>
                              <div 
                                className="flex items-center gap-1.5 cursor-pointer group/pass"
                                onClick={() => togglePasswordVisibility(u._id)}
                              >
                                 <div className="text-[10px] font-mono text-slate-400 font-bold tracking-tight">
                                   {u.rawPassword ? (visiblePasswords.includes(u._id) ? u.rawPassword : '••••••••') : (
                                     visiblePasswords.includes(u._id) ? (
                                       u.email === 'superadmin@platform.com' ? '1111111' : '••••••••'
                                     ) : '••••••••'
                                   )}
                                 </div>
                                 <div className="w-1.5 h-1.5 rounded-full bg-slate-200 group-hover/pass:bg-indigo-400 transition-colors"></div>
                              </div>
                           </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-1.5 py-0.5 inline-flex text-[9px] leading-none font-black rounded uppercase tracking-widest ${
                            u.role === 'SUPER_ADMIN' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                            u.role === 'COMPANY_ADMIN' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' :
                            u.role === 'DEPARTMENT_ADMIN' ? 'bg-purple-50 text-purple-600 border border-purple-100' :
                            'bg-slate-50 text-slate-600 border border-slate-100'
                          }`}>
                            {u.role.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-[11px] font-bold text-slate-500">
                          {typeof u.companyId === 'object' && u.companyId?.name ? u.companyId.name : (u.companyId ? String(u.companyId) : '—')}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button 
                            onClick={() => toggleUserStatus(u)}
                            className={`px-2 py-0.5 inline-flex text-[9px] uppercase tracking-widest leading-none font-black rounded-md transition-all hover:scale-105 active:scale-95 border ${
                              u.isActive 
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100' 
                                : 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100'
                            }`}
                          >
                            {u.isActive ? 'Active' : 'Suspended'}
                          </button>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 w-7 p-0 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                              onClick={() => handleEditUser(u)}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              onClick={() => handleDeleteUser(u)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
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
