'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { companyAPI, Company } from '@/lib/api/company';
import { departmentAPI, Department } from '@/lib/api/department';
import { userAPI, User } from '@/lib/api/user';
import { apiClient } from '@/lib/api/client';
import { grievanceAPI, Grievance } from '@/lib/api/grievance';
import { appointmentAPI, Appointment } from '@/lib/api/appointment';
import GrievanceDetailDialog from '@/components/grievance/GrievanceDetailDialog';
import AppointmentDetailDialog from '@/components/appointment/AppointmentDetailDialog';
import UserDetailsDialog from '@/components/user/UserDetailsDialog';
import StatusUpdateModal from '@/components/grievance/StatusUpdateModal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Building, Users, FileText, Calendar, ArrowLeft, BarChart2, Search, Filter, ArrowUpDown, Download, RefreshCw, CheckCircle, Clock, TrendingUp, Trash2, MessageSquare, Mail, Settings, Workflow } from 'lucide-react';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

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
    resolvedGrievances: 0
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedGrievance, setSelectedGrievance] = useState<Grievance | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showGrievanceDetail, setShowGrievanceDetail] = useState(false);
  const [showAppointmentDetail, setShowAppointmentDetail] = useState(false);
  const [selectedUserForDetails, setSelectedUserForDetails] = useState<User | null>(null);
  const [showUserDetailsDialog, setShowUserDetailsDialog] = useState(false);
  const [showGrievanceStatusModal, setShowGrievanceStatusModal] = useState(false);
  const [selectedGrievanceForStatus, setSelectedGrievanceForStatus] = useState<Grievance | null>(null);
  const [whatsappConfig, setWhatsappConfig] = useState<any>(null);
  
  // Selection state for bulk delete (Super Admin only)
  const [selectedGrievances, setSelectedGrievances] = useState<Set<string>>(new Set());
  const [selectedAppointments, setSelectedAppointments] = useState<Set<string>>(new Set());
  const [selectedDepartments, setSelectedDepartments] = useState<Set<string>>(new Set());
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter & Sort states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | null }>({ key: '', direction: null });

  useEffect(() => {
    if (user?.role !== 'SUPER_ADMIN') {
      router.push('/superadmin/dashboard');
      return;
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch company
      const companyRes = await companyAPI.getById(companyId);
      if (companyRes.success) {
        setCompany(companyRes.data.company);
      }

      // Fetch departments for this company
      const deptRes = await departmentAPI.getAll({ companyId });
      if (deptRes.success) {
        setDepartments(deptRes.data.departments);
      }

      // Fetch users for this company
      const usersRes = await userAPI.getAll({ companyId });
      if (usersRes.success) {
        setUsers(usersRes.data.users);
      }

      // Fetch grievances
      const grievancesRes = await grievanceAPI.getAll({ companyId, limit: 100 });
      if (grievancesRes.success) {
        setGrievances(grievancesRes.data.grievances);
      }

      // Fetch appointments
      const appointmentsRes = await appointmentAPI.getAll({ companyId, limit: 100 });
      if (appointmentsRes.success) {
        setAppointments(appointmentsRes.data.appointments);
      }

      // Fetch WhatsApp config
      try {
        const configRes = await apiClient.get(`/whatsapp-config/company/${companyId}`);
        if (configRes.success && configRes.data) {
          setWhatsappConfig(configRes.data);
        } else if (configRes.data) {
          setWhatsappConfig(configRes.data);
        }
      } catch (configError: any) {
        // WhatsApp config not found is OK - just don't show it
        if (configError.response?.status !== 404) {
          console.error('Failed to load WhatsApp config:', configError);
        }
      }

      // Calculate stats
      setStats({
        totalUsers: usersRes.success ? usersRes.data.users.length : 0,
        totalDepartments: deptRes.success ? deptRes.data.departments.length : 0,
        totalGrievances: grievancesRes.success ? grievancesRes.data.grievances.length : 0,
        totalAppointments: appointmentsRes.success ? appointmentsRes.data.appointments.length : 0,
        activeUsers: usersRes.success ? usersRes.data.users.filter((u: User) => u.isActive).length : 0,
        pendingGrievances: grievancesRes.success ? grievancesRes.data.grievances.filter((g: Grievance) => g.status === 'PENDING').length : 0,
        resolvedGrievances: grievancesRes.success ? grievancesRes.data.grievances.filter((g: Grievance) => g.status === 'RESOLVED').length : 0
      });
    } catch (error: any) {
      toast.error('Failed to load company data');
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

  // Filtered and sorted users
  const filteredUsers = useMemo(() => {
    let filtered = [...users];
    
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(u => 
        u.firstName?.toLowerCase().includes(search) ||
        u.lastName?.toLowerCase().includes(search) ||
        u.email?.toLowerCase().includes(search) ||
        u.userId?.toLowerCase().includes(search)
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
        g.grievanceId?.toLowerCase().includes(search) ||
        g.citizenPhone?.includes(search)
      );
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(g => g.status === statusFilter);
    }
    
    return filtered;
  }, [grievances, searchTerm, statusFilter]);

  // Filtered appointments
  const filteredAppointments = useMemo(() => {
    let filtered = [...appointments];
    
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(a => 
        a.citizenName?.toLowerCase().includes(search) ||
        a.appointmentId?.toLowerCase().includes(search) ||
        a.citizenPhone?.includes(search)
      );
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(a => a.status === statusFilter);
    }
    
    return filtered;
  }, [appointments, searchTerm, statusFilter]);

  // Export function
  // Bulk delete handlers
  const handleBulkDeleteGrievances = async () => {
    if (selectedGrievances.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedGrievances.size} grievance(s)? This action cannot be undone.`)) return;
    setIsDeleting(true);
    try {
      const response = await grievanceAPI.deleteBulk(Array.from(selectedGrievances));
      if (response.success) {
        toast.success(response.message);
        setSelectedGrievances(new Set());
        fetchData();
      } else {
        toast.error('Failed to delete grievances');
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Failed to delete grievances');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDeleteAppointments = async () => {
    if (selectedAppointments.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedAppointments.size} appointment(s)? This action cannot be undone.`)) return;
    setIsDeleting(true);
    try {
      const response = await appointmentAPI.deleteBulk(Array.from(selectedAppointments));
      if (response.success) {
        toast.success(response.message);
        setSelectedAppointments(new Set());
        fetchData();
      } else {
        toast.error('Failed to delete appointments');
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Failed to delete appointments');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDeleteDepartments = async () => {
    if (selectedDepartments.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedDepartments.size} department(s)? This action cannot be undone.`)) return;
    setIsDeleting(true);
    try {
      for (const deptId of selectedDepartments) {
        await departmentAPI.delete(deptId);
      }
      toast.success(`${selectedDepartments.size} department(s) deleted successfully`);
      setSelectedDepartments(new Set());
      fetchData();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Failed to delete departments');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDeleteUsers = async () => {
    if (selectedUsers.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedUsers.size} user(s)? This action cannot be undone.`)) return;
    setIsDeleting(true);
    try {
      for (const userId of selectedUsers) {
        await userAPI.delete(userId);
      }
      toast.success(`${selectedUsers.size} user(s) deleted successfully`);
      setSelectedUsers(new Set());
      fetchData();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Failed to delete users');
    } finally {
      setIsDeleting(false);
    }
  };

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
        <LoadingSpinner size="xl" text="Loading company details..." />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Company not found</h2>
          <Button onClick={() => router.push('/superadmin/dashboard')}>Back to Dashboard</Button>
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* Header with Gradient */}
      <header className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 sticky top-0 z-50 shadow-xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVHJhbnNmb3JtPSJyb3RhdGUoNDUpIj48cGF0aCBkPSJNLTEwIDMwaDYwdjJoLTYweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNhKSIvPjwvc3ZnPg==')] opacity-30"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                onClick={() => router.push('/superadmin/dashboard')} 
                className="text-white/80 hover:text-white hover:bg-white/10 transition-all -ml-2"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm shadow-lg">
                <Building className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">{company.name}</h1>
                <p className="text-sm text-white/80 mt-0.5">
                  Company Dashboard • <span className="font-semibold">{company.companyId}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* WhatsApp Configuration Button */}
              <Button
                onClick={() => router.push(`/superadmin/company/${companyId}/whatsapp-config`)}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-all shadow-lg"
              >
                <MessageSquare className="w-4 h-4" />
                WhatsApp Config
              </Button>
              {/* Email Configuration Button */}
              <Button
                onClick={() => router.push(`/superadmin/company/${companyId}/email-config`)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition-all shadow-lg"
              >
                <Mail className="w-4 h-4" />
                Email Config
              </Button>
              
              {/* Chatbot Flows Button */}
              <Button
                onClick={() => router.push(`/superadmin/company/${companyId}/chatbot-flows`)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-xl transition-all shadow-lg"
              >
                <Workflow className="w-4 h-4" />
                Custom Flow
              </Button>
              
              <button
                onClick={fetchData}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all border border-white/30"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="inline-flex h-12 items-center justify-center rounded-2xl bg-white/80 backdrop-blur-sm p-1.5 shadow-lg border border-slate-200/50 gap-1">
            <TabsTrigger value="overview" className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">Overview</TabsTrigger>
            <TabsTrigger value="departments" className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">Departments</TabsTrigger>
            <TabsTrigger value="users" className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">Users</TabsTrigger>
            <TabsTrigger value="grievances" className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">Grievances</TabsTrigger>
            <TabsTrigger value="appointments" className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">Appointments</TabsTrigger>
            <TabsTrigger value="analytics" className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">Analytics</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="group relative overflow-hidden bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 border-0 shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer rounded-2xl" onClick={() => setActiveTab('departments')}>
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-[100px]"></div>
                <CardHeader className="pb-2 relative">
                  <CardTitle className="text-white/90 text-sm font-medium flex items-center gap-2">
                    <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                      <Building className="w-4 h-4 text-white" />
                    </div>
                    Total Departments
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  <p className="text-4xl font-bold text-white mb-1">{stats.totalDepartments}</p>
                  <p className="text-sm text-white/70">Active departments</p>
                </CardContent>
              </Card>

              <Card className="group relative overflow-hidden bg-gradient-to-br from-emerald-500 via-green-600 to-teal-700 border-0 shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer rounded-2xl" onClick={() => setActiveTab('users')}>
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-[100px]"></div>
                <CardHeader className="pb-2 relative">
                  <CardTitle className="text-white/90 text-sm font-medium flex items-center gap-2">
                    <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                      <Users className="w-4 h-4 text-white" />
                    </div>
                    Total Users
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  <p className="text-4xl font-bold text-white mb-1">{stats.totalUsers}</p>
                  <p className="text-sm text-white/70">{stats.activeUsers} active users</p>
                </CardContent>
              </Card>

              <Card className="group relative overflow-hidden bg-gradient-to-br from-purple-500 via-purple-600 to-fuchsia-700 border-0 shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer rounded-2xl" onClick={() => setActiveTab('grievances')}>
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-[100px]"></div>
                <CardHeader className="pb-2 relative">
                  <CardTitle className="text-white/90 text-sm font-medium flex items-center gap-2">
                    <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                      <FileText className="w-4 h-4 text-white" />
                    </div>
                    Grievances
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  <p className="text-4xl font-bold text-white mb-1">{stats.totalGrievances}</p>
                  <p className="text-sm text-white/70">{stats.pendingGrievances} pending</p>
                </CardContent>
              </Card>

              <Card className="group relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-600 to-red-600 border-0 shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer rounded-2xl" onClick={() => setActiveTab('appointments')}>
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-[100px]"></div>
                <CardHeader className="pb-2 relative">
                  <CardTitle className="text-white/90 text-sm font-medium flex items-center gap-2">
                    <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-white" />
                    </div>
                    Appointments
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  <p className="text-4xl font-bold text-white mb-1">{stats.totalAppointments}</p>
                  <p className="text-sm text-white/70">Scheduled appointments</p>
                </CardContent>
              </Card>
            </div>

            {/* Company Details Card */}
            <Card className="rounded-2xl border-0 shadow-xl overflow-hidden bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-slate-100 to-blue-50 border-b px-6 py-4">
                <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Building className="w-5 h-5 text-blue-600" />
                  Company Information
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="p-4 bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl border border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Company ID</p>
                    <p className="text-lg font-bold text-slate-800">{company.companyId}</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl border border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Contact Person</p>
                    <p className="text-lg font-bold text-slate-800">{company.name || 'N/A'}</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl border border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Contact Email</p>
                    <p className="text-lg font-bold text-slate-800 truncate">{company.contactEmail || 'N/A'}</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl border border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Status</p>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${company.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {company.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* WhatsApp Configuration Card */}
            {whatsappConfig && whatsappConfig._id && (
              <Card className="rounded-2xl border-0 shadow-xl overflow-hidden bg-white/80 backdrop-blur-sm border-green-200">
                <CardHeader className="bg-gradient-to-r from-green-100 to-emerald-50 border-b px-6 py-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-green-600" />
                      WhatsApp Configuration
                    </CardTitle>
                    <Button
                      onClick={() => router.push(`/superadmin/company/${companyId}/whatsapp-config`)}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white rounded-xl"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Configure
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100">
                      <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">Phone Number</p>
                      <p className="text-lg font-bold text-slate-800">{whatsappConfig.displayPhoneNumber || whatsappConfig.phoneNumber || 'N/A'}</p>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100">
                      <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">Phone Number ID</p>
                      <p className="text-sm font-mono text-slate-700 truncate">{whatsappConfig.phoneNumberId || 'N/A'}</p>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100">
                      <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">Business Account</p>
                      <p className="text-sm font-mono text-slate-700 truncate">{whatsappConfig.businessAccountId || 'N/A'}</p>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100">
                      <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">Status</p>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${whatsappConfig.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                        {whatsappConfig.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                  {whatsappConfig.activeFlows && whatsappConfig.activeFlows.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-green-200">
                      <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">Active Flows</p>
                      <div className="flex flex-wrap gap-2">
                        {whatsappConfig.activeFlows.filter((af: any) => af.isActive).map((af: any, idx: number) => (
                          <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                            {af.flowType || 'Custom'} Flow
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Departments Tab */}
          <TabsContent value="departments" className="space-y-6">
            <Card className="rounded-2xl border-0 shadow-xl overflow-hidden bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 text-white px-6 py-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                      <Building className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold text-white">Departments ({departments.length})</CardTitle>
                      <CardDescription className="text-cyan-100">All departments in this company</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Bulk Delete Button */}
                    {selectedDepartments.size > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleBulkDeleteDepartments}
                        disabled={isDeleting}
                        className="text-xs h-8 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl border border-red-700 shadow-sm"
                        title={`Delete ${selectedDepartments.size} selected department(s)`}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                        Delete ({selectedDepartments.size})
                      </Button>
                    )}
                    <button
                      onClick={() => exportToCSV(departments, 'departments')}
                      className="flex items-center gap-2 px-4 py-2 bg-white/20 text-white rounded-xl hover:bg-white/30 transition-all border border-white/30"
                    >
                      <Download className="w-4 h-4" />
                      Export
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {departments.length === 0 ? (
                  <div className="text-center py-16">
                    <Building className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg">No departments found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gradient-to-r from-cyan-50 via-teal-50 to-emerald-50 border-b border-teal-100">
                        <tr>
                          <th className="px-3 py-4 text-center text-[11px] font-bold text-teal-700 uppercase">
                            <input
                              type="checkbox"
                              checked={selectedDepartments.size > 0 && selectedDepartments.size === departments.length}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedDepartments(new Set(departments.map(d => d._id)));
                                } else {
                                  setSelectedDepartments(new Set());
                                }
                              }}
                              className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500 cursor-pointer"
                              title="Select All"
                            />
                          </th>
                          <th className="px-3 py-4 text-center text-[11px] font-bold text-teal-700 uppercase">Sr. No.</th>
                          <th className="px-6 py-4 text-left text-[11px] font-bold text-teal-700 uppercase">Department</th>
                          <th className="px-6 py-4 text-left text-[11px] font-bold text-teal-700 uppercase">Dept ID</th>
                          <th className="px-6 py-4 text-left text-[11px] font-bold text-teal-700 uppercase">Description</th>
                          <th className="px-6 py-4 text-left text-[11px] font-bold text-teal-700 uppercase">Status</th>
                          <th className="px-6 py-4 text-center text-[11px] font-bold text-teal-700 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {departments.map((dept, index) => (
                          <tr key={dept._id} className="hover:bg-gradient-to-r hover:from-cyan-50/50 hover:to-teal-50/50 transition-all">
                            <td className="px-3 py-4 text-center">
                              <input
                                type="checkbox"
                                checked={selectedDepartments.has(dept._id)}
                                onChange={(e) => {
                                  const newSelected = new Set(selectedDepartments);
                                  if (e.target.checked) {
                                    newSelected.add(dept._id);
                                  } else {
                                    newSelected.delete(dept._id);
                                  }
                                  setSelectedDepartments(newSelected);
                                }}
                                className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500 cursor-pointer"
                              />
                            </td>
                            <td className="px-3 py-4 text-center">
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-100 to-teal-100 text-teal-700 text-xs font-bold">{index + 1}</span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
                                  <Building className="w-5 h-5 text-teal-600" />
                                </div>
                                <span className="font-bold text-gray-900">{dept.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">{dept.departmentId}</span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{dept.description || '-'}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${dept.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                                {dept.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button
                                onClick={() => router.push(`/superadmin/department/${dept._id}?companyId=${companyId}`)}
                                className="px-3 py-1.5 text-xs font-semibold text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-all"
                              >
                                View Details →
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
                      <CardDescription className="text-emerald-100">All users in this company</CardDescription>
                    </div>
                  </div>
                  <button
                    onClick={() => exportToCSV(filteredUsers, 'users')}
                    className="flex items-center gap-2 px-4 py-2 bg-white/20 text-white rounded-xl hover:bg-white/30 transition-all border border-white/30"
                  >
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
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="px-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="all">All Roles</option>
                    <option value="COMPANY_ADMIN">Company Admin</option>
                    <option value="DEPARTMENT_ADMIN">Department Admin</option>
                    <option value="OPERATOR">Operator</option>
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
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
                          <th className="px-3 py-4 text-center text-[11px] font-bold text-emerald-700 uppercase">
                            <input
                              type="checkbox"
                              checked={selectedUsers.size > 0 && selectedUsers.size === filteredUsers.length}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedUsers(new Set(filteredUsers.map(u => u._id)));
                                } else {
                                  setSelectedUsers(new Set());
                                }
                              }}
                              className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 cursor-pointer"
                              title="Select All"
                            />
                          </th>
                          <th className="px-3 py-4 text-center text-[11px] font-bold text-emerald-700 uppercase">Sr. No.</th>
                          <th className="px-6 py-4 text-left">
                            <button onClick={() => handleSort('firstName')} className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 uppercase hover:text-emerald-800">
                              User <ArrowUpDown className="w-3.5 h-3.5" />
                            </button>
                          </th>
                          <th className="px-6 py-4 text-left">
                            <button onClick={() => handleSort('email')} className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 uppercase hover:text-emerald-800">
                              Email <ArrowUpDown className="w-3.5 h-3.5" />
                            </button>
                          </th>
                          <th className="px-6 py-4 text-left text-[11px] font-bold text-emerald-700 uppercase">Role</th>
                          <th className="px-6 py-4 text-left text-[11px] font-bold text-emerald-700 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredUsers.map((u, index) => (
                          <tr key={u._id} className="hover:bg-gradient-to-r hover:from-emerald-50/50 hover:to-green-50/50 transition-all">
                            <td className="px-3 py-4 text-center">
                              <input
                                type="checkbox"
                                checked={selectedUsers.has(u._id)}
                                onChange={(e) => {
                                  const newSelected = new Set(selectedUsers);
                                  if (e.target.checked) {
                                    newSelected.add(u._id);
                                  } else {
                                    newSelected.delete(u._id);
                                  }
                                  setSelectedUsers(newSelected);
                                }}
                                className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 cursor-pointer"
                              />
                            </td>
                            <td className="px-3 py-4 text-center">
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 text-emerald-700 text-xs font-bold">{index + 1}</span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-green-500 rounded-xl flex items-center justify-center text-white font-bold shadow-sm">
                                  {u.firstName?.[0]}{u.lastName?.[0]}
                                </div>
                                <div>
                                  <button
                                    onClick={async () => {
                                      try {
                                        const response = await userAPI.getById(u._id);
                                        if (response.success) {
                                          setSelectedUserForDetails(response.data.user);
                                          setShowUserDetailsDialog(true);
                                        }
                                      } catch (error: any) {
                                        toast.error('Failed to load user details');
                                      }
                                    }}
                                    className="font-bold text-gray-900 hover:text-blue-600 hover:underline text-left"
                                  >
                                    {u.firstName} {u.lastName}
                                  </button>
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
                      <CardTitle className="text-xl font-bold text-white">Grievances ({filteredGrievances.length})</CardTitle>
                      <CardDescription className="text-blue-100">All grievances in this company</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Bulk Delete Button */}
                    {selectedGrievances.size > 0 && (
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
                    <button
                      onClick={() => exportToCSV(filteredGrievances, 'grievances')}
                      className="flex items-center gap-2 px-4 py-2 bg-white/20 text-white rounded-xl hover:bg-white/30 transition-all border border-white/30"
                    >
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
                    <input
                      type="text"
                      placeholder="Search grievances..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Status</option>
                    <option value="PENDING">Pending</option>
                    <option value="ASSIGNED">Assigned</option>
                    <option value="RESOLVED">Resolved</option>
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
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-b border-blue-100">
                        <tr>
                          <th className="px-3 py-4 text-center text-[11px] font-bold text-blue-700 uppercase">
                            <input
                              type="checkbox"
                              checked={selectedGrievances.size > 0 && selectedGrievances.size === filteredGrievances.length}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedGrievances(new Set(filteredGrievances.map(g => g._id)));
                                } else {
                                  setSelectedGrievances(new Set());
                                }
                              }}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                              title="Select All"
                            />
                          </th>
                          <th className="px-3 py-4 text-center text-[11px] font-bold text-blue-700 uppercase">Sr. No.</th>
                          <th className="px-6 py-4 text-left text-[11px] font-bold text-blue-700 uppercase">Grievance ID</th>
                          <th className="px-6 py-4 text-left text-[11px] font-bold text-blue-700 uppercase">Citizen</th>
                          <th className="px-6 py-4 text-left text-[11px] font-bold text-blue-700 uppercase">Category</th>
                          <th className="px-6 py-4 text-left text-[11px] font-bold text-blue-700 uppercase">Status</th>
                          <th className="px-6 py-4 text-left text-[11px] font-bold text-blue-700 uppercase">Created</th>
                          <th className="px-6 py-4 text-center text-[11px] font-bold text-blue-700 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredGrievances.slice(0, 50).map((g, index) => (
                          <tr key={g._id} className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/50 transition-all">
                            <td className="px-3 py-4 text-center">
                              <input
                                type="checkbox"
                                checked={selectedGrievances.has(g._id)}
                                onChange={(e) => {
                                  const newSelected = new Set(selectedGrievances);
                                  if (e.target.checked) {
                                    newSelected.add(g._id);
                                  } else {
                                    newSelected.delete(g._id);
                                  }
                                  setSelectedGrievances(newSelected);
                                }}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                              />
                            </td>
                            <td className="px-3 py-4 text-center">
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 text-xs font-bold">{index + 1}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="font-bold text-sm text-blue-700">{g.grievanceId}</span>
                            </td>
                            <td className="px-6 py-4">
                              <button
                                onClick={async () => {
                                  const response = await grievanceAPI.getById(g._id);
                                  if (response.success) {
                                    setSelectedGrievance(response.data.grievance);
                                    setShowGrievanceDetail(true);
                                  }
                                }}
                                className="text-left hover:text-blue-600"
                              >
                                <p className="font-semibold text-gray-900 hover:underline">{g.citizenName}</p>
                                <p className="text-xs text-gray-500">{g.citizenPhone}</p>
                              </button>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-xs font-medium bg-blue-50 text-blue-600 px-2 py-1 rounded">{g.category || 'General'}</span>
                            </td>
                            <td className="px-6 py-4">
                              <button
                                onClick={() => {
                                  setSelectedGrievanceForStatus(g);
                                  setShowGrievanceStatusModal(true);
                                }}
                                className={`px-3 py-1.5 text-[10px] font-bold border border-gray-200 rounded bg-white hover:border-purple-400 hover:bg-purple-50 focus:outline-none focus:ring-1 focus:ring-purple-500 uppercase tracking-tight transition-all ${
                                  g.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                  g.status === 'PENDING' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-blue-100 text-blue-700 border-blue-200'
                                }`}
                              >
                                {g.status}
                              </button>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">{new Date(g.createdAt).toLocaleDateString()}</td>
                            <td className="px-6 py-4 text-center">
                              <button
                                onClick={async () => {
                                  const response = await grievanceAPI.getById(g._id);
                                  if (response.success) {
                                    setSelectedGrievance(response.data.grievance);
                                    setShowGrievanceDetail(true);
                                  }
                                }}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                              >
                                View
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

          {/* Appointments Tab */}
          <TabsContent value="appointments" className="space-y-6">
            <Card className="rounded-2xl border-0 shadow-xl overflow-hidden bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 text-white px-6 py-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold text-white">Appointments ({filteredAppointments.length})</CardTitle>
                      <CardDescription className="text-purple-100">All appointments in this company</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Bulk Delete Button */}
                    {selectedAppointments.size > 0 && (
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
                    <button
                      onClick={() => exportToCSV(filteredAppointments, 'appointments')}
                      className="flex items-center gap-2 px-4 py-2 bg-white/20 text-white rounded-xl hover:bg-white/30 transition-all border border-white/30"
                    >
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
                    <input
                      type="text"
                      placeholder="Search appointments..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="all">All Status</option>
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              </div>
              
              <CardContent className="p-0">
                {filteredAppointments.length === 0 ? (
                  <div className="text-center py-16">
                    <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg">No appointments found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gradient-to-r from-purple-50 via-fuchsia-50 to-pink-50 border-b border-purple-100">
                        <tr>
                          <th className="px-3 py-4 text-center text-[11px] font-bold text-purple-700 uppercase">
                            <input
                              type="checkbox"
                              checked={selectedAppointments.size > 0 && selectedAppointments.size === filteredAppointments.length}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedAppointments(new Set(filteredAppointments.map(a => a._id)));
                                } else {
                                  setSelectedAppointments(new Set());
                                }
                              }}
                              className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 cursor-pointer"
                              title="Select All"
                            />
                          </th>
                          <th className="px-3 py-4 text-center text-[11px] font-bold text-purple-700 uppercase">Sr. No.</th>
                          <th className="px-6 py-4 text-left text-[11px] font-bold text-purple-700 uppercase">Appointment ID</th>
                          <th className="px-6 py-4 text-left text-[11px] font-bold text-purple-700 uppercase">Citizen</th>
                          <th className="px-6 py-4 text-left text-[11px] font-bold text-purple-700 uppercase">Purpose</th>
                          <th className="px-6 py-4 text-left text-[11px] font-bold text-purple-700 uppercase">Scheduled</th>
                          <th className="px-6 py-4 text-left text-[11px] font-bold text-purple-700 uppercase">Status</th>
                          <th className="px-6 py-4 text-center text-[11px] font-bold text-purple-700 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredAppointments.slice(0, 50).map((a, index) => (
                          <tr key={a._id} className="hover:bg-gradient-to-r hover:from-purple-50/50 hover:to-pink-50/50 transition-all">
                            <td className="px-3 py-4 text-center">
                              <input
                                type="checkbox"
                                checked={selectedAppointments.has(a._id)}
                                onChange={(e) => {
                                  const newSelected = new Set(selectedAppointments);
                                  if (e.target.checked) {
                                    newSelected.add(a._id);
                                  } else {
                                    newSelected.delete(a._id);
                                  }
                                  setSelectedAppointments(newSelected);
                                }}
                                className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 cursor-pointer"
                              />
                            </td>
                            <td className="px-3 py-4 text-center">
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-purple-100 to-fuchsia-100 text-purple-700 text-xs font-bold">{index + 1}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="font-bold text-sm text-purple-700">{a.appointmentId}</span>
                            </td>
                            <td className="px-6 py-4">
                              <button
                                onClick={async () => {
                                  const response = await appointmentAPI.getById(a._id);
                                  if (response.success) {
                                    setSelectedAppointment(response.data.appointment);
                                    setShowAppointmentDetail(true);
                                  }
                                }}
                                className="text-left hover:text-purple-600"
                              >
                                <p className="font-semibold text-gray-900 hover:underline">{a.citizenName}</p>
                                <p className="text-xs text-gray-500">{a.citizenPhone}</p>
                              </button>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">{a.purpose}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              <div>
                                <p className="font-medium">{new Date(a.appointmentDate).toLocaleDateString()}</p>
                                <p className="text-xs text-amber-600">{a.appointmentTime}</p>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                a.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                                a.status === 'CANCELLED' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                              }`}>{a.status}</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button
                                onClick={async () => {
                                  const response = await appointmentAPI.getById(a._id);
                                  if (response.success) {
                                    setSelectedAppointment(response.data.appointment);
                                    setShowAppointmentDetail(true);
                                  }
                                }}
                                className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
                              >
                                View
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

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <Card className="rounded-2xl border-0 shadow-xl overflow-hidden bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 text-white px-6 py-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold text-white">Analytics Dashboard</CardTitle>
                    <CardDescription className="text-violet-100">View company statistics and insights</CardDescription>
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
                        Grievance Status Distribution
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
