'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Building, Users, FileText, Calendar, BarChart2, ArrowLeft, Search, ArrowUpDown, Download, RefreshCw, TrendingUp, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { departmentAPI, Department } from '@/lib/api/department';
import { companyAPI, Company } from '@/lib/api/company';
import { userAPI, User } from '@/lib/api/user';
import { apiClient } from '@/lib/api/client';
import { grievanceAPI, Grievance } from '@/lib/api/grievance';
import { appointmentAPI, Appointment } from '@/lib/api/appointment';
import GrievanceDetailDialog from '@/components/grievance/GrievanceDetailDialog';
import AppointmentDetailDialog from '@/components/appointment/AppointmentDetailDialog';
import StatusUpdateModal from '@/components/grievance/StatusUpdateModal';
import toast from 'react-hot-toast';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

export default function DepartmentDetail() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const departmentId = params.id as string;

  const [department, setDepartment] = useState<Department | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  // Appointments removed - only managed by Company Admin
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalGrievances: 0,
    totalAppointments: 0,
    activeUsers: 0,
    pendingGrievances: 0,
    resolvedGrievances: 0
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedGrievance, setSelectedGrievance] = useState<Grievance | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showGrievanceDetail, setShowGrievanceDetail] = useState(false);
  const [showAppointmentDetail, setShowAppointmentDetail] = useState(false);
  const [updatingGrievanceStatus, setUpdatingGrievanceStatus] = useState<Set<string>>(new Set());
  const [showGrievanceStatusModal, setShowGrievanceStatusModal] = useState(false);
  const [selectedGrievanceForStatus, setSelectedGrievanceForStatus] = useState<Grievance | null>(null);

  // Filter & Sort states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | null }>({ key: '', direction: null });

  useEffect(() => {
    if (!user || user.role === 'SUPER_ADMIN') {
      router.push('/dashboard');
      return;
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId, user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch department
      const deptRes = await departmentAPI.getById(departmentId);
      if (deptRes.success) {
        setDepartment(deptRes.data.department);
        const deptCompanyId = typeof deptRes.data.department.companyId === 'object' 
          ? deptRes.data.department.companyId._id 
          : deptRes.data.department.companyId;
        
        // Fetch company
        if (deptCompanyId && user?.role === 'COMPANY_ADMIN') {
          const companyRes = await companyAPI.getMyCompany();
          if (companyRes.success) {
            setCompany(companyRes.data.company);
          }
        }
      }

      // Fetch users for this department
      const usersRes = await userAPI.getAll({ departmentId });
      if (usersRes.success) {
        setUsers(usersRes.data.users);
      }

      // Fetch grievances (filter out resolved - they are on the Resolved Grievances page)
      const grievancesRes = await grievanceAPI.getAll({ departmentId, limit: 100 });
      if (grievancesRes.success) {
        const activeGrievances = grievancesRes.data.grievances.filter(
          (g) => g.status !== 'RESOLVED'
        );
        setGrievances(activeGrievances);
      }

      // Appointments are only managed by Company Admin - not fetching here

      // Calculate stats
      const statsRes = await apiClient.get(`/analytics/dashboard?departmentId=${departmentId}`);
      if (statsRes.success) {
        setStats({
          totalUsers: usersRes.success ? usersRes.data.users.length : 0,
          totalGrievances: statsRes.data.grievances?.total || 0,
          totalAppointments: statsRes.data.appointments?.total || 0,
          activeUsers: usersRes.success ? usersRes.data.users.filter((u: User) => u.isActive).length : 0,
          pendingGrievances: statsRes.data.grievances?.pending || 0,
          resolvedGrievances: statsRes.data.grievances?.resolved || 0
        });
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to load department data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Sort handler
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' | null = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = null;
    }
    setSortConfig({ key, direction });
  };

  // Filtered users
  const filteredUsers = useMemo(() => {
    let filtered = [...users];
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(u => 
        u.firstName?.toLowerCase().includes(search) ||
        u.lastName?.toLowerCase().includes(search) ||
        u.email?.toLowerCase().includes(search)
      );
    }
    if (roleFilter !== 'all') {
      filtered = filtered.filter(u => u.role === roleFilter);
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter(u => statusFilter === 'active' ? u.isActive : !u.isActive);
    }
    if (sortConfig.key && sortConfig.direction) {
      filtered.sort((a: any, b: any) => {
        const aVal = a[sortConfig.key] || '';
        const bVal = b[sortConfig.key] || '';
        if (typeof aVal === 'string') {
          return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      });
    }
    return filtered;
  }, [users, searchTerm, roleFilter, statusFilter, sortConfig]);

  // Filtered grievances
  const filteredGrievances = useMemo(() => {
    let filtered = [...grievances];
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(g => 
        g.citizenName?.toLowerCase().includes(search) ||
        g.grievanceId?.toLowerCase().includes(search)
      );
    }
    if (statusFilter !== 'all' && statusFilter !== 'active') {
      filtered = filtered.filter(g => g.status === statusFilter);
    }
    return filtered;
  }, [grievances, searchTerm, statusFilter]);

  // Appointments are only managed by Company Admin - no filtering needed here

  // Export function
  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      toast.error('No data to export');
      return;
    }
    const headers = Object.keys(data[0]).filter(k => !k.startsWith('_'));
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => JSON.stringify(row[h] || '')).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Export successful!');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoadingSpinner size="xl" text="Loading department details..." />
      </div>
    );
  }

  if (!department) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Department not found</h2>
          <Button onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const grievanceStatusData = [
    { name: 'Pending', value: stats.pendingGrievances, color: '#FFBB28' },
    { name: 'Resolved', value: stats.resolvedGrievances, color: '#00C49F' },
    { name: 'In Progress', value: stats.totalGrievances - stats.pendingGrievances - stats.resolvedGrievances, color: '#0088FE' }
  ].filter(item => item.value > 0);

  const userRoleData = users.reduce((acc: any[], user) => {
    const existing = acc.find(item => item.name === user.role);
    if (existing) {
      existing.value++;
    } else {
      acc.push({ name: user.role, value: 1 });
    }
    return acc;
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-cyan-50/30">
      {/* Header with Gradient */}
      <header className="bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 sticky top-0 z-50 shadow-xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVHJhbnNmb3JtPSJyb3RhdGUoNDUpIj48cGF0aCBkPSJNLTEwIDMwaDYwdjJoLTYweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNhKSIvPjwvc3ZnPg==')] opacity-30"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                onClick={() => router.push('/dashboard')} 
                className="text-white/80 hover:text-white hover:bg-white/10 transition-all -ml-2"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm shadow-lg">
                <Building className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">{department.name}</h1>
                <p className="text-sm text-white/80 mt-0.5">
                  Department Dashboard • <span className="font-semibold">{department.departmentId}</span>
                  {company && ` • ${company.name}`}
                </p>
              </div>
            </div>
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all border border-white/30"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="inline-flex h-12 items-center justify-center rounded-2xl bg-white/80 backdrop-blur-sm p-1.5 shadow-lg border border-slate-200/50 gap-1">
            <TabsTrigger value="overview" className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-teal-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">Overview</TabsTrigger>
            <TabsTrigger value="users" className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-teal-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">Users</TabsTrigger>
            <TabsTrigger value="grievances" className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-teal-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">Grievances</TabsTrigger>
            <TabsTrigger value="analytics" className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-teal-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Total Users - Gradient Blue Card */}
              <Card 
                className="group relative overflow-hidden bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 border-0 shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer rounded-2xl"
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
                  <p className="text-4xl font-bold text-white mb-2">{stats.totalUsers}</p>
                  <p className="text-sm text-white/80 font-medium">
                    <span className="inline-flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      {stats.activeUsers} active
                    </span>
                  </p>
                </CardContent>
              </Card>

              {/* Grievances - Gradient Purple Card */}
              <Card 
                className="group relative overflow-hidden bg-gradient-to-br from-purple-500 via-purple-600 to-fuchsia-700 border-0 shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer rounded-2xl"
                onClick={() => setActiveTab('grievances')}
              >
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVHJhbnNmb3JtPSJyb3RhdGUoNDUpIj48cGF0aCBkPSJNLTEwIDMwaDYwdjJoLTYweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNhKSIvPjwvc3ZnPg==')] opacity-30"></div>
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-[100px]"></div>
                <CardHeader className="pb-2 relative">
                  <CardTitle className="text-white/90 text-sm font-medium flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                        <FileText className="w-4 h-4 text-white" />
                      </div>
                      Active Grievances
                    </span>
                    <svg className="w-5 h-5 text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  <p className="text-4xl font-bold text-white mb-2">{grievances.length}</p>
                  <p className="text-sm text-white/80 font-medium">
                    <span className="inline-flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                      {stats.pendingGrievances} pending
                    </span>
                  </p>
                </CardContent>
              </Card>

              {/* Appointments card removed - Appointments are only for CEO/Company Admin, not for departments */}
            </div>

            {/* Department Details */}
            <Card className="rounded-2xl border-0 shadow-xl overflow-hidden bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-slate-100 to-cyan-50 border-b px-6 py-4">
                <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Building className="w-5 h-5 text-cyan-600" />
                  Department Information
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="p-4 bg-gradient-to-br from-slate-50 to-cyan-50 rounded-xl border border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Department ID</p>
                    <p className="text-lg font-bold text-slate-800">{department.departmentId}</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-slate-50 to-cyan-50 rounded-xl border border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Company</p>
                    <p className="text-lg font-bold text-slate-800">{company?.name || 'N/A'}</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-slate-50 to-cyan-50 rounded-xl border border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Status</p>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${department.isActive !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      Active
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            <Card className="rounded-2xl border-0 shadow-xl overflow-hidden bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 text-white px-6 py-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold text-white">Users ({filteredUsers.length})</CardTitle>
                      <CardDescription className="text-emerald-100">All users in this department</CardDescription>
                    </div>
                  </div>
                  <button onClick={() => exportToCSV(filteredUsers, 'users')} className="flex items-center gap-2 px-4 py-2 bg-white/20 text-white rounded-xl hover:bg-white/30 transition-all border border-white/30">
                    <Download className="w-4 h-4" />
                    Export
                  </button>
                </div>
              </CardHeader>
              
              {/* Filters */}
              <div className="px-6 py-4 bg-white/50 border-b border-slate-200">
                <div className="flex flex-wrap gap-3 items-center">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input type="text" placeholder="Search users..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                  </div>
                  <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="px-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500">
                    <option value="all">All Roles</option>
                    <option value="DEPARTMENT_ADMIN">Department Admin</option>
                    <option value="OPERATOR">Operator</option>
                  </select>
                </div>
              </div>
              
              <CardContent className="p-0">
                {filteredUsers.length === 0 ? (
                  <div className="text-center py-16">
                    <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg">No users found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gradient-to-r from-emerald-50 via-green-50 to-teal-50 border-b border-emerald-100">
                        <tr>
                          <th className="px-3 py-4 text-center text-[11px] font-bold text-emerald-700 uppercase">Sr. No.</th>
                          <th className="px-6 py-4 text-left">
                            <button onClick={() => handleSort('firstName')} className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 uppercase hover:text-emerald-800">
                              User <ArrowUpDown className="w-3.5 h-3.5" />
                            </button>
                          </th>
                          <th className="px-6 py-4 text-left text-[11px] font-bold text-emerald-700 uppercase">Email</th>
                          <th className="px-6 py-4 text-left text-[11px] font-bold text-emerald-700 uppercase">Role</th>
                          <th className="px-6 py-4 text-left text-[11px] font-bold text-emerald-700 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredUsers.map((u, index) => (
                          <tr key={u._id} className="hover:bg-gradient-to-r hover:from-emerald-50/50 hover:to-green-50/50 transition-all">
                            <td className="px-3 py-4 text-center">
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 text-emerald-700 text-xs font-bold">{index + 1}</span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-green-500 rounded-xl flex items-center justify-center text-white font-bold shadow-sm">
                                  {u.firstName?.[0]}{u.lastName?.[0]}
                                </div>
                                <div>
                                  <p className="font-bold text-gray-900">{u.firstName} {u.lastName}</p>
                                  <p className="text-xs text-gray-500">{u.userId}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">{u.email}</td>
                            <td className="px-6 py-4">
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">{u.role}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${u.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                                {u.isActive ? 'Active' : 'Inactive'}
                              </span>
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

          {/* Grievances Tab */}
          <TabsContent value="grievances" className="space-y-6">
            <Card className="rounded-2xl border-0 shadow-xl overflow-hidden bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white px-6 py-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                      <FileText className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold text-white">Active Grievances ({filteredGrievances.length})</CardTitle>
                      <CardDescription className="text-blue-100">All active grievances in this department</CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link href="/resolved-grievances" className="flex items-center gap-2 px-4 py-2 bg-emerald-500/80 text-white rounded-xl hover:bg-emerald-500 transition-all">
                      <CheckCircle className="w-4 h-4" />
                      View Resolved
                    </Link>
                    <button onClick={() => exportToCSV(filteredGrievances, 'grievances')} className="flex items-center gap-2 px-4 py-2 bg-white/20 text-white rounded-xl hover:bg-white/30 transition-all border border-white/30">
                      <Download className="w-4 h-4" />
                      Export
                    </button>
                  </div>
                </div>
              </CardHeader>
              
              {/* Filters */}
              <div className="px-6 py-4 bg-white/50 border-b border-slate-200">
                <div className="flex flex-wrap gap-3 items-center">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input type="text" placeholder="Search grievances..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  </div>
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500">
                    <option value="all">All Status</option>
                    <option value="PENDING">Pending</option>
                    <option value="ASSIGNED">Assigned</option>
                  </select>
                </div>
              </div>
              
              <CardContent className="p-0">
                {filteredGrievances.length === 0 ? (
                  <div className="text-center py-16">
                    <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg">No grievances found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[600px]">
                    <table className="w-full">
                      <thead className="sticky top-0 z-20 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-b border-blue-100">
                        <tr>
                          <th className="px-3 py-4 text-center text-[11px] font-bold text-blue-700 uppercase">Sr. No.</th>
                          <th className="px-4 py-4 text-left text-[11px] font-bold text-blue-700 uppercase">Grievance ID</th>
                          <th className="px-4 py-4 text-left text-[11px] font-bold text-blue-700 uppercase">Citizen</th>
                          <th className="px-4 py-4 text-left text-[11px] font-bold text-blue-700 uppercase">Category</th>
                          <th className="px-4 py-4 text-left text-[11px] font-bold text-blue-700 uppercase">Status</th>
                          <th className="px-4 py-4 text-left text-[11px] font-bold text-blue-700 uppercase">Created</th>
                          <th className="px-4 py-4 text-center text-[11px] font-bold text-blue-700 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredGrievances.map((g, index) => (
                          <tr key={g._id} className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/50 transition-all">
                            <td className="px-3 py-4 text-center">
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 text-xs font-bold">{index + 1}</span>
                            </td>
                            <td className="px-4 py-4"><span className="font-bold text-sm text-blue-700">{g.grievanceId}</span></td>
                            <td className="px-4 py-4">
                              <button onClick={async () => {
                                const response = await grievanceAPI.getById(g._id);
                                if (response.success) { setSelectedGrievance(response.data.grievance); setShowGrievanceDetail(true); }
                              }} className="text-left hover:text-blue-600">
                                <p className="font-semibold text-gray-900 hover:underline">{g.citizenName}</p>
                                <p className="text-xs text-gray-500">{g.citizenPhone}</p>
                              </button>
                            </td>
                            <td className="px-4 py-4"><span className="text-xs font-medium bg-blue-50 text-blue-600 px-2 py-1 rounded">{g.category || 'General'}</span></td>
                            <td className="px-4 py-4">
                              <button
                                onClick={() => {
                                  setSelectedGrievanceForStatus(g);
                                  setShowGrievanceStatusModal(true);
                                }}
                                disabled={updatingGrievanceStatus.has(g._id)}
                                className={`px-3 py-1.5 text-[10px] font-bold border border-gray-200 rounded bg-white hover:border-purple-400 hover:bg-purple-50 focus:outline-none focus:ring-1 focus:ring-purple-500 uppercase tracking-tight transition-all ${
                                  updatingGrievanceStatus.has(g._id) ? 'opacity-50 cursor-wait' : ''
                                }`}
                              >
                                {g.status}
                              </button>
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-600">
                              <div className="flex flex-col">
                                <span className="font-medium text-gray-800">{new Date(g.createdAt).toLocaleDateString()}</span>
                                <span className="text-[10px] text-gray-400">{new Date(g.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <button onClick={async () => {
                                const response = await grievanceAPI.getById(g._id);
                                if (response.success) { setSelectedGrievance(response.data.grievance); setShowGrievanceDetail(true); }
                              }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="View Details">
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
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appointments Tab - Removed for Department Admin */}
          {/* Appointments are only managed by Company Admin */}

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <Card className="rounded-2xl border-0 shadow-xl overflow-hidden bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 text-white px-6 py-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold text-white">Department Analytics</CardTitle>
                    <CardDescription className="text-violet-100">View department statistics and insights</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Grievance Status Chart */}
                  <Card className="rounded-2xl border border-slate-200/50 shadow-md bg-white/80">
                    <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b px-5 py-4">
                      <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        Grievance Status
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-5">
                      {grievanceStatusData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                          <PieChart>
                            <Pie data={grievanceStatusData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                              {grievanceStatusData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-[250px] text-gray-400">
                          <p>No grievance data available</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* User Roles Chart */}
                  <Card className="rounded-2xl border border-slate-200/50 shadow-md bg-white/80">
                    <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b px-5 py-4">
                      <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                        <Users className="w-5 h-5 text-emerald-600" />
                        Users by Role
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-5">
                      {userRoleData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={userRoleData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-[250px] text-gray-400">
                          <p>No user data available</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Dialogs */}
      <GrievanceDetailDialog grievance={selectedGrievance} isOpen={showGrievanceDetail} onClose={() => { setShowGrievanceDetail(false); setSelectedGrievance(null); }} />
      <AppointmentDetailDialog appointment={selectedAppointment} isOpen={showAppointmentDetail} onClose={() => { setShowAppointmentDetail(false); setSelectedAppointment(null); }} />

      <StatusUpdateModal
        isOpen={showGrievanceStatusModal}
        onClose={() => {
          setShowGrievanceStatusModal(false);
          setSelectedGrievanceForStatus(null);
        }}
        itemId={selectedGrievanceForStatus?._id || ''}
        itemType="grievance"
        currentStatus={selectedGrievanceForStatus?.status || ''}
        onSuccess={() => {
          fetchData();
        }}
        grievanceVariant="department-admin"
      />
    </div>
  );
}
