'use client';

import { useEffect, useState, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiClient } from '@/lib/api/client';
import { companyAPI, Company } from '@/lib/api/company';
import { departmentAPI, Department } from '@/lib/api/department';
import { userAPI, User } from '@/lib/api/user';
import { grievanceAPI, Grievance } from '@/lib/api/grievance';
import { appointmentAPI, Appointment } from '@/lib/api/appointment';
import CreateDepartmentDialog from '@/components/department/CreateDepartmentDialog';
import CreateUserDialog from '@/components/user/CreateUserDialog';
import EditUserDialog from '@/components/user/EditUserDialog';
import ChangePermissionsDialog from '@/components/user/ChangePermissionsDialog';
import UserDetailsDialog from '@/components/user/UserDetailsDialog';
import { ProtectedButton } from '@/components/ui/ProtectedButton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Permission, hasPermission } from '@/lib/permissions';
import toast from 'react-hot-toast';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import GrievanceDetailDialog from '@/components/grievance/GrievanceDetailDialog';
import AppointmentDetailDialog from '@/components/appointment/AppointmentDetailDialog';
import AssignmentDialog from '@/components/assignment/AssignmentDialog';
import StatusUpdateModal from '@/components/grievance/StatusUpdateModal';
import MetricInfoDialog, { MetricInfo } from '@/components/analytics/MetricInfoDialog';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Pagination } from '@/components/ui/Pagination';
import AvailabilityCalendar from '@/components/availability/AvailabilityCalendar';
import { 
  ArrowUpDown,
  ArrowLeft,
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
  Download,
  Search,
  RefreshCw,
  FileDown,
  FileText,
  BarChart2,
  TrendingUp,
  Clock,
  AlertTriangle,
  Target,
  CalendarCheck,
  PieChart as PieChartIcon
} from 'lucide-react';

const CHART_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

interface DashboardStats {
  grievances: {
    total: number;
    pending: number;
    assigned?: number;
    inProgress: number;
    resolved: number;
    closed?: number;
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
    noShow?: number;
    last7Days: number;
    last30Days: number;
    completionRate: number;
    byDepartment?: Array<{ departmentId: string; departmentName: string; count: number; completed: number }>;
    daily: Array<{ date: string; count: number }>;
    monthly?: Array<{ month: string; count: number; completed: number }>;
  };
  departments: number;
  users: number;
  activeUsers: number;
}

function DashboardContent() {
  const { user, loading, logout } = useAuth();
  const isCompanyAdmin = user?.role === 'COMPANY_ADMIN';
  const isDepartmentAdmin = user?.role === 'DEPARTMENT_ADMIN';
  const isOperator = user?.role === 'OPERATOR';
  const isAnalyticsViewer = user?.role === 'ANALYTICS_VIEWER';
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  // Get initial tab from URL search params, default based on role
  const getDefaultTab = () => {
    if (user?.role === 'OPERATOR') return 'profile';
    if (user?.role === 'ANALYTICS_VIEWER') return 'grievances';
    return 'overview';
  };
  const initialTab = searchParams?.get('tab') || getDefaultTab();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [previousTab, setPreviousTab] = useState<string>('overview');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [showDepartmentDialog, setShowDepartmentDialog] = useState(false);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showEditUserDialog, setShowEditUserDialog] = useState(false);
  const [showChangePermissionsDialog, setShowChangePermissionsDialog] = useState(false);
  const [selectedUserForDetails, setSelectedUserForDetails] = useState<User | null>(null);
  const [showUserDetailsDialog, setShowUserDetailsDialog] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
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
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingGrievances, setLoadingGrievances] = useState(false);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [updatingGrievanceStatus, setUpdatingGrievanceStatus] = useState<Set<string>>(new Set());
  const [updatingAppointmentStatus, setUpdatingAppointmentStatus] = useState<Set<string>>(new Set());
  const [navigatingToDepartment, setNavigatingToDepartment] = useState<string | null>(null);
  const [performanceData, setPerformanceData] = useState<any>(null);
  const [hourlyData, setHourlyData] = useState<any>(null);
  const [categoryData, setCategoryData] = useState<any>(null);
  const [selectedGrievance, setSelectedGrievance] = useState<Grievance | null>(null);
  const [showGrievanceDetail, setShowGrievanceDetail] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showAppointmentDetail, setShowAppointmentDetail] = useState(false);
  const [showAppointmentStatusModal, setShowAppointmentStatusModal] = useState(false);
  const [selectedAppointmentForStatus, setSelectedAppointmentForStatus] = useState<Appointment | null>(null);
  const [showGrievanceStatusModal, setShowGrievanceStatusModal] = useState(false);
  const [selectedGrievanceForStatus, setSelectedGrievanceForStatus] = useState<Grievance | null>(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  
  // Selection state for bulk delete (Super Admin only)
  const [selectedGrievances, setSelectedGrievances] = useState<Set<string>>(new Set());
  const [selectedAppointments, setSelectedAppointments] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [showGrievanceAssignment, setShowGrievanceAssignment] = useState(false);
  const [selectedGrievanceForAssignment, setSelectedGrievanceForAssignment] = useState<Grievance | null>(null);
  const [showAppointmentAssignment, setShowAppointmentAssignment] = useState(false);
  const [selectedAppointmentForAssignment, setSelectedAppointmentForAssignment] = useState<Appointment | null>(null);
  const [showMetricDialog, setShowMetricDialog] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<MetricInfo | null>(null);
  const [showAvailabilityCalendar, setShowAvailabilityCalendar] = useState(false);
  
  // Pagination State
  const [grievancePage, setGrievancePage] = useState(1);
  const [grievancePagination, setGrievancePagination] = useState({ total: 0, pages: 1, limit: 10 });
  
  const [appointmentPage, setAppointmentPage] = useState(1);
  const [appointmentPagination, setAppointmentPagination] = useState({ total: 0, pages: 1, limit: 10 });
  
  const [departmentPage, setDepartmentPage] = useState(1);
  const [departmentPagination, setDepartmentPagination] = useState({ total: 0, pages: 1, limit: 10 });
  
  const [userPage, setUserPage] = useState(1);
  const [userPagination, setUserPagination] = useState({ total: 0, pages: 1, limit: 10 });

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc' | null;
    tab: string;
  }>({
    key: '',
    direction: null,
    tab: 'grievances'
  });

  // Grievances Filters
  const [grievanceFilters, setGrievanceFilters] = useState({
    status: '',
    department: '',
    assignmentStatus: '',
    overdueStatus: '',
    dateRange: ''
  });

  // Search states
  const [grievanceSearch, setGrievanceSearch] = useState('');
  const [appointmentSearch, setAppointmentSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Export functions
  const exportToCSV = (data: any[], filename: string, columns: { key: string; label: string }[]) => {
    const headers = columns.map(col => col.label).join(',');
    const rows = data.map(item => 
      columns.map(col => {
        let value = item[col.key];
        if (typeof value === 'object' && value !== null) {
          value = value.name || value.firstName || value._id || '';
        }
        if (typeof value === 'string' && value.includes(',')) {
          value = `"${value}"`;
        }
        return value || '';
      }).join(',')
    );
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
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
      toast.success('Data refreshed successfully');
    } catch (error) {
      toast.error('Failed to refresh data');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Bulk delete handlers (Super Admin only)
  const handleBulkDeleteGrievances = async () => {
    if (selectedGrievances.size === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedGrievances.size} grievance(s)? This action cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await grievanceAPI.deleteBulk(Array.from(selectedGrievances));
      if (response.success) {
        toast.success(response.message);
        setSelectedGrievances(new Set());
        await fetchGrievances();
        await fetchDashboardData();
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
    
    if (!confirm(`Are you sure you want to delete ${selectedAppointments.size} appointment(s)? This action cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await appointmentAPI.deleteBulk(Array.from(selectedAppointments));
      if (response.success) {
        toast.success(response.message);
        setSelectedAppointments(new Set());
        await fetchAppointments();
        await fetchDashboardData();
      } else {
        toast.error('Failed to delete appointments');
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Failed to delete appointments');
    } finally {
      setIsDeleting(false);
    }
  };

  // Appointments Filters
  const [appointmentFilters, setAppointmentFilters] = useState({
    status: '',
    department: '',
    assignmentStatus: '',
    dateFilter: ''
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    } else if (!loading && user && user.role === 'SUPER_ADMIN') {
      router.push('/superadmin/dashboard');
    }
  }, [user, loading, router]);

  // Set default tab to grievances for operators (they don't have access to overview)
  useEffect(() => {
    if (user && user.role === 'OPERATOR' && activeTab === 'overview') {
      setActiveTab('grievances');
    }
  }, [user, activeTab]);

  // Update URL when tab changes to persist state
  useEffect(() => {
    if (mounted && activeTab) {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', activeTab);
      window.history.replaceState({}, '', url.toString());
    }
  }, [activeTab, mounted]);

  // Track previous counts for real-time notifications
  const [prevGrievanceCount, setPrevGrievanceCount] = useState<number | null>(null);
  const [prevAppointmentCount, setPrevAppointmentCount] = useState<number | null>(null);

  const fetchPerformanceData = useCallback(async () => {
    try {
      const response = await apiClient.get('/analytics/performance');
      if (response.success) {
        setPerformanceData(response.data);
      }
    } catch (error: any) {
      console.error('Failed to fetch performance data:', error);
    }
  }, []);

  const fetchHourlyData = useCallback(async () => {
    try {
      const response = await apiClient.get('/analytics/hourly?days=7');
      if (response.success) {
        setHourlyData(response.data);
      }
    } catch (error: any) {
      console.error('Failed to fetch hourly data:', error);
    }
  }, []);

  const fetchCategoryData = useCallback(async () => {
    try {
      const response = await apiClient.get('/analytics/category');
      if (response.success) {
        setCategoryData(response.data);
      }
    } catch (error: any) {
      console.error('Failed to fetch category data:', error);
    }
  }, []);

  const fetchDashboardData = useCallback(async () => {
    setLoadingStats(true);
    try {
      const response = await apiClient.get<{ success: boolean; data: DashboardStats }>('/analytics/dashboard');
      if (response.success) {
        setStats(response.data);
      }
    } catch (error: any) {
      console.error('Failed to fetch dashboard stats:', error);
      toast.error('Failed to load dashboard statistics');
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const fetchCompany = useCallback(async () => {
    if (!user || user.role !== 'COMPANY_ADMIN') return;
    
    try {
      const response = await companyAPI.getMyCompany();
      if (response.success) {
        setCompany(response.data.company);
      }
    } catch (error: any) {
      // CompanyAdmin might not have company associated
      console.log('Company details not available:', error.message);
    }
  }, [user]);

  const fetchDepartments = useCallback(async (page = departmentPage) => {
    setLoadingDepartments(true);
    try {
      const response = await departmentAPI.getAll({ page, limit: departmentPagination.limit });
      if (response.success) {
        let filteredDepartments = response.data.departments;
        
        // For department admin, only show their own department
        if (isDepartmentAdmin && user?.departmentId) {
          const userDeptId = typeof user.departmentId === 'object' && user.departmentId !== null 
            ? (user.departmentId as any)._id || (user.departmentId as any).toString()
            : user.departmentId;
          
          filteredDepartments = filteredDepartments.filter((dept: Department) => {
            const deptId = dept._id?.toString() || dept._id;
            const userDeptIdStr = userDeptId?.toString() || userDeptId;
            return deptId === userDeptIdStr;
          });
        }
        
        setDepartments(filteredDepartments);
        setDepartmentPagination(prev => ({
          ...prev,
          total: response.data.pagination.total,
          pages: response.data.pagination.pages
        }));
      }
    } catch (error: any) {
      console.error('Failed to fetch departments:', error);
      toast.error('Failed to load departments');
    } finally {
      setLoadingDepartments(false);
    }
  }, [departmentPage, departmentPagination.limit, isDepartmentAdmin, user?.departmentId]);

  const fetchUsers = useCallback(async (page = userPage) => {
    setLoadingUsers(true);
    try {
      const response = await userAPI.getAll({ page, limit: userPagination.limit });
      if (response.success) {
        let filteredUsers = response.data.users;
        
        // Filter users by department for department admins
        if (isDepartmentAdmin && user?.departmentId) {
          const userDeptId = typeof user.departmentId === 'object' && user.departmentId !== null 
            ? user.departmentId._id 
            : user.departmentId;
          
          filteredUsers = filteredUsers.filter((u: any) => {
            const uDeptId = typeof u.departmentId === 'object' && u.departmentId !== null
              ? u.departmentId._id
              : u.departmentId;
            return uDeptId === userDeptId;
          });
        }
        
        setUsers(filteredUsers);
        setUserPagination(prev => ({
          ...prev,
          total: response.data.pagination.total,
          pages: response.data.pagination.pages
        }));
      }
    } catch (error: any) {
      console.error('Failed to fetch users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  }, [userPage, userPagination.limit, isDepartmentAdmin, user?.departmentId]);

  const fetchGrievances = useCallback(async (page = grievancePage) => {
    setLoadingGrievances(true);
    try {
      const response = await grievanceAPI.getAll({ page, limit: grievancePagination.limit });
      if (response.success) {
        setGrievances(response.data.grievances);
        setGrievancePagination(prev => ({
          ...prev,
          total: response.data.pagination.total,
          pages: response.data.pagination.pages
        }));
      }
    } catch (error: any) {
      console.error('Failed to fetch grievances:', error);
      toast.error('Failed to load grievances');
    } finally {
      setLoadingGrievances(false);
    }
  }, [grievancePage, grievancePagination.limit]);

  const fetchAppointments = useCallback(async (page = appointmentPage) => {
    setLoadingAppointments(true);
    try {
      const response = await appointmentAPI.getAll({ page, limit: appointmentPagination.limit });
      if (response.success) {
        setAppointments(response.data.appointments);
        setAppointmentPagination(prev => ({
          ...prev,
          total: response.data.pagination.total,
          pages: response.data.pagination.pages
        }));
      }
    } catch (error: any) {
      console.error('Failed to fetch appointments:', error);
      toast.error('Failed to load appointments');
    } finally {
      setLoadingAppointments(false);
    }
  }, [appointmentPage, appointmentPagination.limit]);

  useEffect(() => {
    if (mounted && user && user.role !== 'SUPER_ADMIN') {
      fetchDashboardData();
      
      const fetchPromises: Promise<any>[] = [
        fetchDepartments(departmentPage),
        fetchUsers(userPage)
      ];
      
      if (user.companyId && user.role === 'COMPANY_ADMIN') {
        fetchPromises.push(fetchCompany());
      }
      
      Promise.all(fetchPromises).catch(err => console.error('Error fetching initial data:', err));
      
      setTimeout(() => {
        fetchGrievances(grievancePage);
        fetchAppointments(appointmentPage);
      }, 100);

      const pollInterval = setInterval(async () => {
        try {
          const [grievanceRes, appointmentRes] = await Promise.all([
            grievanceAPI.getAll({ page: 1, limit: 10 }),
            appointmentAPI.getAll({ page: 1, limit: 10 })
          ]);
          
          if (grievanceRes.success && prevGrievanceCount !== null) {
            const newCount = grievanceRes.data.pagination.total;
            if (newCount > prevGrievanceCount) {
              toast.success(`📋 New grievance received! (${newCount - prevGrievanceCount} new)`, { duration: 4000 });
              fetchDashboardData();
            }
            setPrevGrievanceCount(newCount);
            if (grievancePage === 1) {
              setGrievances(grievanceRes.data.grievances);
              setGrievancePagination(prev => ({
                ...prev,
                total: grievanceRes.data.pagination.total,
                pages: grievanceRes.data.pagination.pages
              }));
            }
          } else if (grievanceRes.success) {
            setPrevGrievanceCount(grievanceRes.data.pagination.total);
          }
          
          if (appointmentRes.success && prevAppointmentCount !== null) {
            const newCount = appointmentRes.data.pagination.total;
            if (newCount > prevAppointmentCount) {
              toast.success(`📅 New appointment scheduled! (${newCount - prevAppointmentCount} new)`, { duration: 4000 });
              fetchDashboardData();
            }
            setPrevAppointmentCount(newCount);
            if (appointmentPage === 1) {
              setAppointments(appointmentRes.data.appointments);
              setAppointmentPagination(prev => ({
                ...prev,
                total: appointmentRes.data.pagination.total,
                pages: appointmentRes.data.pagination.pages
              }));
            }
          } else if (appointmentRes.success) {
            setPrevAppointmentCount(appointmentRes.data.pagination.total);
          }
        } catch (error) {
          console.error('Polling error:', error);
        }
      }, 30000);

      return () => clearInterval(pollInterval);
    }
  }, [mounted, user, grievancePage, appointmentPage, departmentPage, userPage, fetchDashboardData, fetchDepartments, fetchUsers, fetchCompany, fetchGrievances, fetchAppointments, prevGrievanceCount, prevAppointmentCount]);
 
  useEffect(() => {
    if (mounted && user && activeTab === 'analytics') {
      fetchPerformanceData();
      fetchHourlyData();
      fetchCategoryData();
    }
  }, [mounted, user, activeTab, fetchPerformanceData, fetchHourlyData, fetchCategoryData]);


  const handleSort = (key: string, tab: string) => {
    let direction: 'asc' | 'desc' | null = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = null;
    }
    setSortConfig({ key, direction, tab });
  };

  const getSortedData = (data: any[], tab: string) => {
    let filteredData = data;
    
    // For operators, only show items assigned to them
    if (user?.role === 'OPERATOR' && user.id) {
      if (tab === 'grievances' || tab === 'appointments') {
        filteredData = data.filter((item) => {
          const assignedToId = item.assignedTo?._id || item.assignedTo;
          return assignedToId === user.id;
        });
      }
    }

    // Apply grievance filters
    if (tab === 'grievances') {
      // Status filter
      if (grievanceFilters.status) {
        filteredData = filteredData.filter((g: Grievance) => 
          g.status?.toUpperCase() === grievanceFilters.status.toUpperCase()
        );
      }
      // Department filter
      if (grievanceFilters.department) {
        filteredData = filteredData.filter((g: Grievance) => {
          const deptId = typeof g.departmentId === 'object' && g.departmentId ? (g.departmentId as any)._id : g.departmentId;
          return deptId === grievanceFilters.department;
        });
      }
      // Assignment status filter
      if (grievanceFilters.assignmentStatus) {
        if (grievanceFilters.assignmentStatus === 'assigned') {
          filteredData = filteredData.filter((g: Grievance) => g.assignedTo);
        } else if (grievanceFilters.assignmentStatus === 'unassigned') {
          filteredData = filteredData.filter((g: Grievance) => !g.assignedTo);
        }
      }
      // Overdue status filter
      if (grievanceFilters.overdueStatus) {
        const now = new Date();
        filteredData = filteredData.filter((g: Grievance) => {
          const createdAt = new Date(g.createdAt);
          const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
          const isOverdue = hoursDiff > 48; // 48 hours SLA
          return grievanceFilters.overdueStatus === 'overdue' ? isOverdue : !isOverdue;
        });
      }
      // Date range filter
      if (grievanceFilters.dateRange) {
        const now = new Date();
        filteredData = filteredData.filter((g: Grievance) => {
          const createdAt = new Date(g.createdAt);
          const daysDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
          switch (grievanceFilters.dateRange) {
            case 'today': return daysDiff < 1;
            case 'week': return daysDiff <= 7;
            case 'month': return daysDiff <= 30;
            default: return true;
          }
        });
      }
      // Search filter
      if (grievanceSearch.trim()) {
        const search = grievanceSearch.toLowerCase().trim();
        filteredData = filteredData.filter((g: Grievance) => 
          g.grievanceId?.toLowerCase().includes(search) ||
          g.citizenName?.toLowerCase().includes(search) ||
          g.citizenPhone?.includes(search) ||
          g.category?.toLowerCase().includes(search) ||
          g.description?.toLowerCase().includes(search)
        );
      }
    }

    // Apply appointment filters
    if (tab === 'appointments') {
      // Status filter
      if (appointmentFilters.status) {
        filteredData = filteredData.filter((a: Appointment) => 
          a.status?.toUpperCase() === appointmentFilters.status.toUpperCase()
        );
      }
      // Department filter - Removed (Appointments are CEO-only, no departments)
      // Assignment status filter
      if (appointmentFilters.assignmentStatus) {
        if (appointmentFilters.assignmentStatus === 'assigned') {
          filteredData = filteredData.filter((a: Appointment) => a.assignedTo);
        } else if (appointmentFilters.assignmentStatus === 'unassigned') {
          filteredData = filteredData.filter((a: Appointment) => !a.assignedTo);
        }
      }
      // Date filter
      if (appointmentFilters.dateFilter) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        filteredData = filteredData.filter((a: Appointment) => {
          const appointmentDate = new Date(a.appointmentDate);
          const appointmentDayStart = new Date(appointmentDate.getFullYear(), appointmentDate.getMonth(), appointmentDate.getDate());
          switch (appointmentFilters.dateFilter) {
            case 'today':
              return appointmentDayStart.getTime() === today.getTime();
            case 'week':
              const weekStart = new Date(today);
              weekStart.setDate(today.getDate() - today.getDay());
              const weekEnd = new Date(weekStart);
              weekEnd.setDate(weekStart.getDate() + 6);
              return appointmentDayStart >= weekStart && appointmentDayStart <= weekEnd;
            case 'month':
              return appointmentDate.getMonth() === now.getMonth() && appointmentDate.getFullYear() === now.getFullYear();
            case 'upcoming':
              return appointmentDayStart >= today;
            default: return true;
          }
        });
      }
      // Search filter
      if (appointmentSearch.trim()) {
        const search = appointmentSearch.toLowerCase().trim();
        filteredData = filteredData.filter((a: Appointment) => 
          a.appointmentId?.toLowerCase().includes(search) ||
          a.citizenName?.toLowerCase().includes(search) ||
          a.citizenPhone?.includes(search) ||
          a.purpose?.toLowerCase().includes(search)
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
      if (sortConfig.key.includes('.')) {
        const parts = sortConfig.key.split('.');
        aValue = parts.reduce((obj, key) => obj?.[key], a);
        bValue = parts.reduce((obj, key) => obj?.[key], b);
      }

      // String comparison
      if (typeof aValue === 'string') {
        return sortConfig.direction === 'asc' 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      }

      // Date or number comparison
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    // Prevent self-deactivation
    if (user && userId === user.id) {
      toast.error('You cannot deactivate yourself');
      return;
    }

    try {
      const response = await userAPI.update(userId, { isActive: !currentStatus } as any);
      if (response.success) {
        toast.success(`User ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
        fetchUsers();
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to update user status';
      toast.error(errorMessage);
    }
  };

  if (loading || !mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoadingSpinner size="xl" text="Loading dashboard..." />
      </div>
    );
  }

  if (!user || user.role === 'SUPER_ADMIN') {
    return null;
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      {/* Header with Gradient */}
      <header className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 sticky top-0 z-50 shadow-xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVHJhbnNmb3JtPSJyb3RhdGUoNDUpIj48cGF0aCBkPSJNLTEwIDMwaDYwdjJoLTYweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNhKSIvPjwvc3ZnPg==')] opacity-30"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm shadow-lg">
                <Building className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  {isCompanyAdmin && 'Admin Dashboard'}
                  {isDepartmentAdmin && 'Department Admin Dashboard'}
                  {isOperator && 'Operator Dashboard'}
                  {isAnalyticsViewer && 'Analytics Dashboard'}
                </h1>
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <Tabs value={activeTab} onValueChange={(value) => {
          if (activeTab !== value) {
            setPreviousTab(activeTab);
          }
          setActiveTab(value);
        }} className="space-y-4 sm:space-y-6">
          <TabsList className="inline-flex h-auto sm:h-12 flex-wrap sm:flex-nowrap items-center justify-center rounded-2xl bg-white/80 backdrop-blur-sm p-1.5 shadow-lg border border-slate-200/50 gap-1">
            {/* Hide Overview tab for operators - they should only see assigned items */}
            {!isOperator && (
              <TabsTrigger 
                value="overview" 
                className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
              >
                Overview
              </TabsTrigger>
            )}
            {/* Grievances tab for Company/Department Admin only (Operator & Analytics Viewer get it in their blocks below) */}
            {user && hasPermission(user.role, Permission.READ_GRIEVANCE) && !isOperator && !isAnalyticsViewer && (
              <TabsTrigger 
                value="grievances"
                className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
              >
                Grievances
              </TabsTrigger>
            )}
            {/* Appointments Tab - Only for Company Admin */}
            {isCompanyAdmin && (
              <TabsTrigger 
                value="appointments"
                className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
              >
                Appointments
              </TabsTrigger>
            )}
            {/* Only show Departments tab for Company Admin, not for Department Admin */}
            {isCompanyAdmin && (
              <TabsTrigger 
                value="departments"
                className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
              >
                Departments
              </TabsTrigger>
            )}
            {(isCompanyAdmin || isDepartmentAdmin) && (
              <TabsTrigger 
                value="users"
                className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
              >
                Users
              </TabsTrigger>
            )}
            {!isOperator && !isAnalyticsViewer && (
              <TabsTrigger 
                value="analytics"
                className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
              >
                Analytics
              </TabsTrigger>
            )}
            {isOperator && (
              <>
                <TabsTrigger 
                  value="profile"
                  className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
                >
                  Profile
                </TabsTrigger>
                <TabsTrigger 
                  value="grievances"
                  className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
                >
                  Grievances
                </TabsTrigger>
                <TabsTrigger 
                  value="my-analytics"
                  className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
                >
                  My Analytics
                </TabsTrigger>
              </>
            )}
            {/* Analytics Viewer - Show Grievances and Analytics tabs */}
            {isAnalyticsViewer && (
              <>
                <TabsTrigger 
                  value="grievances"
                  className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
                >
                  Grievances
                </TabsTrigger>
                <TabsTrigger 
                  value="analytics"
                  className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100"
                >
                  Analytics
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stats Grid - Moved to top */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {loadingStats ? (
                <>
                  {/* Skeleton Loaders - Modern Design */}
                  <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 shadow-sm animate-pulse">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-slate-400 text-sm font-medium flex items-center justify-between">
                        <div className="h-4 w-28 bg-slate-200 rounded"></div>
                        <div className="h-4 w-4 bg-slate-200 rounded"></div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-10 w-20 bg-slate-200 rounded mb-2"></div>
                      <div className="h-3 w-24 bg-slate-200 rounded"></div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 shadow-sm animate-pulse">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-slate-400 text-sm font-medium flex items-center justify-between">
                        <div className="h-4 w-20 bg-slate-200 rounded"></div>
                        <div className="h-4 w-4 bg-slate-200 rounded"></div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-10 w-16 bg-slate-200 rounded mb-2"></div>
                      <div className="h-3 w-28 bg-slate-200 rounded"></div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 shadow-sm animate-pulse">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-slate-400 text-sm font-medium flex items-center justify-between">
                        <div className="h-4 w-24 bg-slate-200 rounded"></div>
                        <div className="h-4 w-4 bg-slate-200 rounded"></div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-10 w-16 bg-slate-200 rounded mb-2"></div>
                      <div className="h-3 w-24 bg-slate-200 rounded"></div>
                    </CardContent>
                  </Card>

                  {isCompanyAdmin && (
                    <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 shadow-sm animate-pulse">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-slate-400 text-sm font-medium flex items-center justify-between">
                          <div className="h-4 w-24 bg-slate-200 rounded"></div>
                          <div className="h-4 w-4 bg-slate-200 rounded"></div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-10 w-12 bg-slate-200 rounded mb-2"></div>
                        <div className="h-3 w-32 bg-slate-200 rounded"></div>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : stats ? (
                <>
                  {/* Total Grievances - Gradient Blue Card */}
                  <Card 
                    className="group relative overflow-hidden bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 border-0 shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer rounded-2xl"
                    onClick={() => {
                      setActiveTab('grievances');
                    }}
                  >
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVHJhbnNmb3JtPSJyb3RhdGUoNDUpIj48cGF0aCBkPSJNLTEwIDMwaDYwdjJoLTYweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNhKSIvPjwvc3ZnPg==')] opacity-30"></div>
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-[100px]"></div>
                    <CardHeader className="pb-2 relative">
                      <CardTitle className="text-white/90 text-sm font-medium flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          Total Grievances
                        </span>
                        <svg className="w-5 h-5 text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="relative">
                      <p className="text-4xl font-bold text-white mb-2">{stats.grievances.total}</p>
                      <p className="text-sm text-white/80 font-medium">
                        <span className="inline-flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                          {stats.grievances.pending} pending
                        </span>
                      </p>
                    </CardContent>
                  </Card>

                  {/* Resolved - Gradient Emerald Card */}
                  <Card 
                    className="group relative overflow-hidden bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 border-0 shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer rounded-2xl"
                    onClick={() => {
                      setPreviousTab(activeTab);
                      setActiveTab('grievances');
                      setGrievanceFilters(prev => ({ ...prev, status: 'RESOLVED' }));
                    }}
                  >
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVHJhbnNmb3JtPSJyb3RhdGUoNDUpIj48cGF0aCBkPSJNLTEwIDMwaDYwdjJoLTYweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNhKSIvPjwvc3ZnPg==')] opacity-30"></div>
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-[100px]"></div>
                    <CardHeader className="pb-2 relative">
                      <CardTitle className="text-white/90 text-sm font-medium flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                            <CheckCircle className="w-4 h-4 text-white" />
                          </div>
                          Resolved
                        </span>
                        <svg className="w-5 h-5 text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="relative">
                      <p className="text-4xl font-bold text-white mb-2">{stats.grievances.resolved}</p>
                      <p className="text-sm text-white/80 font-medium">
                        <span className="inline-flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-300"></span>
                          {stats.grievances.inProgress || stats.grievances.assigned || 0} in progress
                        </span>
                      </p>
                    </CardContent>
                  </Card>

                  {/* Appointments - Gradient Purple Card - Only for Company Admin */}
                  {isCompanyAdmin && (
                    <Card 
                      className="group relative overflow-hidden bg-gradient-to-br from-purple-500 via-purple-600 to-fuchsia-700 border-0 shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer rounded-2xl"
                      onClick={() => {
                        setActiveTab('appointments');
                      }}
                    >
                      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVHJhbnNmb3JtPSJyb3RhdGUoNDUpIj48cGF0aCBkPSJNLTEwIDMwaDYwdjJoLTYweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNhKSIvPjwvc3ZnPg==')] opacity-30"></div>
                      <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-[100px]"></div>
                      <CardHeader className="pb-2 relative">
                        <CardTitle className="text-white/90 text-sm font-medium flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                            Appointments
                          </span>
                          <svg className="w-5 h-5 text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="relative">
                        <p className="text-4xl font-bold text-white mb-2">{stats.appointments.total}</p>
                        <p className="text-sm text-white/80 font-medium">
                          <span className="inline-flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-300"></span>
                            {stats.appointments.confirmed || stats.appointments.pending || 0} scheduled
                          </span>
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Users - Gradient Indigo Card - For Department Admin */}
                  {isDepartmentAdmin && (
                    <Card 
                      className="group relative overflow-hidden bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-600 border-0 shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer rounded-2xl"
                      onClick={() => {
                        setActiveTab('users');
                      }}
                    >
                      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVHJhbnNmb3JtPSJyb3RhdGUoNDUpIj48cGF0aCBkPSJNLTEwIDMwaDYwdjJoLTYweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNhKSIvPjwvc3ZnPg==')] opacity-30"></div>
                      <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-[100px]"></div>
                      <CardHeader className="pb-2 relative">
                        <CardTitle className="text-white/90 text-sm font-medium flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                              <Users className="w-4 h-4 text-white" />
                            </div>
                            Users
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
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-300"></span>
                            {stats.activeUsers} active
                          </span>
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Departments - Gradient Amber Card */}
                  {isCompanyAdmin && (
                    <Card 
                      className="group relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 border-0 shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer rounded-2xl"
                      onClick={() => {
                        setActiveTab('departments');
                      }}
                    >
                      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVHJhbnNmb3JtPSJyb3RhdGUoNDUpIj48cGF0aCBkPSJNLTEwIDMwaDYwdjJoLTYweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNhKSIvPjwvc3ZnPg==')] opacity-30"></div>
                      <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-[100px]"></div>
                      <CardHeader className="pb-2 relative">
                        <CardTitle className="text-white/90 text-sm font-medium flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                              <Building className="w-4 h-4 text-white" />
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
                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-300"></span>
                            Active departments
                          </span>
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : null}
            </div>

            {/* Company Info (for Company Admin) - Beautified Modern Design */}
            {isCompanyAdmin && company && (
              <Card className="overflow-hidden border-0 shadow-xl bg-white/80 backdrop-blur-sm rounded-2xl">
                <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-6 py-6 relative overflow-hidden">
                  <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVHJhbnNmb3JtPSJyb3RhdGUoNDUpIj48cGF0aCBkPSJNLTEwIDMwaDYwdjJoLTYweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA4KSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNhKSIvPjwvc3ZnPg==')] opacity-30"></div>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-bl-[150px]"></div>
                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="h-16 w-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm shadow-lg">
                        <Building className="text-white w-8 h-8" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-white leading-tight">{company.name}</h3>
                        <p className="text-white/80 text-sm font-medium mt-1">Company Profile & Statistics</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="px-4 py-2 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 text-white text-sm font-semibold">
                        {company.companyType}
                      </span>
                    </div>
                  </div>
                </div>
                <CardContent className="p-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-200/50">
                    <div className="p-6 hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50/30 transition-all duration-200 group">
                      <div className="flex items-center text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center mr-2 group-hover:scale-110 transition-transform">
                          <UserIcon className="w-4 h-4 text-white" />
                        </div>
                        Total Users
                      </div>
                      <div className="flex items-baseline space-x-2">
                        <span className="text-3xl font-bold text-slate-900">{users.length}</span>
                        <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">Active</span>
                      </div>
                    </div>
                    <div className="p-6 hover:bg-gradient-to-br hover:from-purple-50 hover:to-pink-50/30 transition-all duration-200 group">
                      <div className="flex items-center text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center mr-2 group-hover:scale-110 transition-transform">
                          <Building className="w-4 h-4 text-white" />
                        </div>
                        Departments
                      </div>
                      <div className="flex items-baseline space-x-2">
                        <span className="text-3xl font-bold text-slate-900">{departments.length}</span>
                        <span className="text-xs text-blue-600 font-semibold bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">Managed</span>
                      </div>
                    </div>
                    <div className="p-6 hover:bg-gradient-to-br hover:from-cyan-50 hover:to-teal-50/30 transition-all duration-200 group">
                      <div className="flex items-center text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-lg flex items-center justify-center mr-2 group-hover:scale-110 transition-transform">
                          <Mail className="w-4 h-4 text-white" />
                        </div>
                        Contact Email
                      </div>
                      <div className="text-sm font-semibold text-slate-900 truncate">{company.contactEmail}</div>
                    </div>
                    <div className="p-6 hover:bg-gradient-to-br hover:from-emerald-50 hover:to-green-50/30 transition-all duration-200 group">
                      <div className="flex items-center text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-green-500 rounded-lg flex items-center justify-center mr-2 group-hover:scale-110 transition-transform">
                          <Phone className="w-4 h-4 text-white" />
                        </div>
                        Contact Phone
                      </div>
                      <div className="text-sm font-semibold text-slate-900">{company.contactPhone}</div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-r from-slate-50 via-blue-50/30 to-purple-50/30 p-6 border-t border-slate-200/50">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
                      <div className="flex items-center space-x-8">
                        <div className="flex flex-col bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-slate-200/50 shadow-sm">
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Grievances</span>
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-slate-900">{stats?.grievances.total || 0}</span>
                            <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">{stats?.grievances.pending || 0} Pending</span>
                          </div>
                        </div>
                        <div className="flex flex-col bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-slate-200/50 shadow-sm">
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Appointments</span>
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-slate-900">{stats?.appointments.total || 0}</span>
                            <span className="text-xs font-medium text-violet-600 bg-violet-50 px-2.5 py-1 rounded-full border border-violet-200">{stats?.appointments.confirmed || 0} Confirmed</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 bg-white/60 backdrop-blur-sm rounded-xl px-4 py-2 border border-slate-200/50">
                        <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shadow-lg shadow-emerald-500/50"></div>
                        <span className="text-xs font-semibold text-emerald-600">System Online</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Department Admin - Profile & Department Info in Overview */}
            {isDepartmentAdmin && (
              <div className="space-y-6">
                {/* Department Admin Profile Card */}
                <Card className="rounded-2xl border-0 shadow-xl overflow-hidden bg-white/80 backdrop-blur-sm">
                  <CardHeader className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm shadow-lg">
                        <UserIcon className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-bold text-white">My Profile</CardTitle>
                        <CardDescription className="text-white/80 mt-0.5">Your personal information</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-6">
                      {/* Profile Avatar */}
                      <div className="flex-shrink-0">
                        <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white rounded-2xl flex items-center justify-center shadow-xl text-3xl font-bold">
                          {user?.firstName?.[0]}{user?.lastName?.[0]}
                        </div>
                      </div>
                      {/* Profile Details */}
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="bg-gradient-to-br from-slate-50 to-indigo-50/30 rounded-xl p-4 border border-slate-200">
                          <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-1">Full Name</p>
                          <p className="text-lg font-bold text-slate-800">{user?.firstName} {user?.lastName}</p>
                        </div>
                        <div className="bg-gradient-to-br from-slate-50 to-purple-50/30 rounded-xl p-4 border border-slate-200">
                          <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-1">Email Address</p>
                          <p className="text-sm font-medium text-slate-700 truncate">{user?.email}</p>
                        </div>
                        <div className="bg-gradient-to-br from-slate-50 to-pink-50/30 rounded-xl p-4 border border-slate-200">
                          <p className="text-xs font-semibold text-pink-600 uppercase tracking-wide mb-1">Phone Number</p>
                          <p className="text-lg font-bold text-slate-800">{user?.phone}</p>
                        </div>
                        <div className="bg-gradient-to-br from-slate-50 to-emerald-50/30 rounded-xl p-4 border border-slate-200">
                          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1">Role</p>
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold rounded-full shadow-sm">
                            <Shield className="w-3.5 h-3.5" />
                            Department Admin
                          </span>
                        </div>
                        <div className="bg-gradient-to-br from-slate-50 to-amber-50/30 rounded-xl p-4 border border-slate-200">
                          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">User ID</p>
                          <p className="text-sm font-mono bg-white px-2 py-1 rounded border border-amber-200 inline-block">{user?.userId}</p>
                        </div>
                        <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 rounded-xl p-4 border border-slate-200">
                          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Status</p>
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-bold rounded-full shadow-sm">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Active
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* My Department Card - with Department Name in Header */}
                <Card className="rounded-2xl border-0 shadow-xl overflow-hidden bg-white/80 backdrop-blur-sm">
                  <CardHeader className="bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 text-white px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm shadow-lg">
                        <Building className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-bold text-white">
                          {(() => {
                            // Try to get department from user object first (if populated)
                            if (user?.departmentId && typeof user.departmentId === 'object' && (user.departmentId as any).name) {
                              return (user.departmentId as any).name;
                            }
                            // Otherwise use from departments array
                            return departments.length > 0 ? departments[0].name : 'My Department';
                          })()}
                        </CardTitle>
                        <CardDescription className="text-white/80 mt-0.5">Your department information and statistics</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    {(() => {
                      // Get the department - prefer from user object if populated, otherwise from departments array
                      let currentDepartment: Department | null = null;
                      if (user?.departmentId && typeof user.departmentId === 'object' && (user.departmentId as any).name) {
                        currentDepartment = user.departmentId as any;
                      } else if (departments.length > 0) {
                        currentDepartment = departments[0];
                      }
                      return currentDepartment ? (
                        <div className="space-y-6">
                          {/* Department Header */}
                          <div className="flex items-start gap-6">
                            <div className="flex-shrink-0">
                              <div className="w-20 h-20 bg-gradient-to-br from-cyan-500 via-teal-500 to-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-xl">
                                <Building className="w-10 h-10" />
                              </div>
                            </div>
                            <div className="flex-1">
                              <h3 className="text-2xl font-bold text-slate-800 mb-2">{currentDepartment.name}</h3>
                              <p className="text-slate-600">{currentDepartment.description || 'No description provided'}</p>
                            </div>
                          </div>

                          {/* Department Details Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-gradient-to-br from-cyan-50 to-teal-50 rounded-xl p-4 border border-cyan-200">
                              <p className="text-xs font-semibold text-cyan-700 uppercase tracking-wide mb-1">Department ID</p>
                              <p className="text-sm font-mono bg-white px-2 py-1 rounded border border-cyan-200 inline-block">
                                {currentDepartment.departmentId}
                              </p>
                            </div>
                            <div className="bg-gradient-to-br from-teal-50 to-emerald-50 rounded-xl p-4 border border-teal-200">
                              <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Status</p>
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-emerald-500 to-green-500 text-white text-xs font-bold rounded-full shadow-sm">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Active
                              </span>
                            </div>
                            <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-4 border border-emerald-200">
                              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">Contact Person</p>
                              <p className="text-sm font-medium text-slate-700">
                                {currentDepartment.contactPerson || user?.firstName + ' ' + user?.lastName}
                              </p>
                            </div>
                            <div className="bg-gradient-to-br from-green-50 to-lime-50 rounded-xl p-4 border border-green-200">
                              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">Contact Email</p>
                              <p className="text-sm font-medium text-slate-700 truncate">
                                {currentDepartment.contactEmail || user?.email}
                              </p>
                            </div>
                          </div>

                          {/* Department Stats */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                            <div className="bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 rounded-2xl p-5 text-white shadow-lg">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-white/80 text-sm font-medium">Total Grievances</p>
                                  <p className="text-3xl font-bold mt-1">{grievances.length}</p>
                                </div>
                                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                                  <FileText className="w-6 h-6 text-white" />
                                </div>
                              </div>
                            </div>
                            <div className="bg-gradient-to-br from-purple-500 via-purple-600 to-fuchsia-600 rounded-2xl p-5 text-white shadow-lg">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-white/80 text-sm font-medium">Total Appointments</p>
                                  <p className="text-3xl font-bold mt-1">{appointments.length}</p>
                                </div>
                                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                                  <CalendarClock className="w-6 h-6 text-white" />
                                </div>
                              </div>
                            </div>
                            <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 rounded-2xl p-5 text-white shadow-lg">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-white/80 text-sm font-medium">Team Members</p>
                                  <p className="text-3xl font-bold mt-1">{users.filter(u => {
                                    const uDeptId = typeof u.departmentId === 'object' ? (u.departmentId as any)?._id : u.departmentId;
                                    const currentDeptId = typeof currentDepartment._id === 'object' ? (currentDepartment._id as any)?._id : currentDepartment._id;
                                    return uDeptId?.toString() === currentDeptId?.toString();
                                  }).length}</p>
                                </div>
                                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                                  <Users className="w-6 h-6 text-white" />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <Building className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                          <p className="text-slate-500 text-lg">No department information available</p>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Quick Actions */}
            <Card className="border border-slate-200 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-slate-900 text-lg font-semibold">Quick Actions</CardTitle>
                <CardDescription className="text-slate-500">Common tasks and operations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {isCompanyAdmin && (
                  <>
                    <ProtectedButton
                      permission={Permission.CREATE_DEPARTMENT}
                      className="w-full justify-start"
                      variant="outline"
                      onClick={() => setActiveTab('departments')}
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      Manage Departments
                    </ProtectedButton>
                    <ProtectedButton
                      permission={Permission.CREATE_USER}
                      className="w-full justify-start"
                      variant="outline"
                      onClick={() => setActiveTab('users')}
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      Manage Users
                    </ProtectedButton>
                  </>
                )}
                <ProtectedButton
                  permission={Permission.VIEW_ANALYTICS}
                  className="w-full justify-start"
                  variant="outline"
                  onClick={() => setActiveTab('analytics')}
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  View Analytics
                </ProtectedButton>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Departments Tab - Only for Company Admin */}
          {isCompanyAdmin && (
            <TabsContent value="departments" className="space-y-6">
              {/* Company Admin View - Show all departments */}
                <Card className="rounded-2xl border-0 shadow-xl overflow-hidden bg-white/80 backdrop-blur-sm">
                  <CardHeader className="bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 text-white px-6 py-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm shadow-lg">
                          <Building className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-xl font-bold text-white">Department Management</CardTitle>
                          <CardDescription className="text-cyan-100 mt-0.5">
                            Manage all departments in your company
                          </CardDescription>
                        </div>
                      </div>
                      <ProtectedButton
                        permission={Permission.CREATE_DEPARTMENT}
                        onClick={() => setShowDepartmentDialog(true)}
                        className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm transition-all duration-200 rounded-xl px-5"
                      >
                        <Building className="w-4 h-4 mr-2" />
                        Add Department
                      </ProtectedButton>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {departments.length === 0 ? (
                      <div className="text-center py-16">
                        <div className="w-20 h-20 bg-gradient-to-br from-cyan-100 to-teal-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                          <Building className="w-10 h-10 text-cyan-500" />
                        </div>
                        <p className="text-gray-500 text-lg font-medium">No departments found</p>
                        <p className="text-gray-400 text-sm mt-1">Add a department to get started</p>
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-2xl border border-slate-200">
                        <div className="overflow-x-auto">
                          <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                            <table className="w-full relative border-collapse min-w-[800px]">
                            <thead className="sticky top-0 z-20 bg-gradient-to-r from-cyan-50 via-teal-50 to-emerald-50 border-b border-teal-100">
                              <tr>
                                <th className="px-3 py-4 text-center text-[11px] font-bold text-teal-700 uppercase tracking-wider">Sr. No.</th>
                                <th className="px-6 py-4 text-left">
                                  <button 
                                    onClick={() => handleSort('name', 'departments')}
                                    className="group flex items-center space-x-1.5 text-[11px] font-bold text-teal-700 uppercase tracking-wider hover:text-teal-800 transition-colors"
                                  >
                                    <span>Department Name</span>
                                    <ArrowUpDown className={`w-3.5 h-3.5 transition-colors ${sortConfig.key === 'name' ? 'text-teal-700' : 'text-teal-300 group-hover:text-teal-400'}`} />
                                  </button>
                                </th>
                                <th className="px-6 py-4 text-left">
                                  <button 
                                    onClick={() => handleSort('departmentId', 'departments')}
                                    className="group flex items-center space-x-1.5 text-[11px] font-bold text-teal-700 uppercase tracking-wider hover:text-teal-800 transition-colors"
                                  >
                                    <span>Dept ID</span>
                                    <ArrowUpDown className={`w-3.5 h-3.5 transition-colors ${sortConfig.key === 'departmentId' ? 'text-teal-700' : 'text-teal-300 group-hover:text-teal-400'}`} />
                                  </button>
                                </th>
                                <th className="px-6 py-4 text-left font-bold text-[11px] text-teal-700 uppercase tracking-wider">Description</th>
                                <th className="px-6 py-4 text-left font-bold text-[11px] text-teal-700 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-right font-bold text-[11px] text-teal-700 uppercase tracking-wider">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {getSortedData(departments, 'departments').map((dept, index) => (
                                <tr key={dept._id} className="hover:bg-gradient-to-r hover:from-cyan-50/50 hover:to-teal-50/50 transition-all duration-200 group/row">
                                  <td className="px-3 py-5 text-center">
                                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-100 to-teal-100 text-teal-700 text-xs font-bold shadow-sm">
                                      {(departmentPage - 1) * departmentPagination.limit + index + 1}
                                    </span>
                                  </td>
                                  <td className="px-6 py-5 whitespace-nowrap">
                                    <div className="flex items-center">
                                      <div className="flex-shrink-0 h-10 w-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center shadow-sm">
                                        <Building className="w-5 h-5" />
                                      </div>
                                      <div className="ml-3">
                                        <div 
                                          className="text-sm font-bold text-gray-900 group-hover:text-blue-600 cursor-pointer hover:underline transition-colors duration-200 flex items-center gap-2"
                                          onClick={() => {
                                            setNavigatingToDepartment(dept._id);
                                            setSelectedDepartmentId(dept._id);
                                            router.push(`/dashboard/department/${dept._id}`);
                                          }}
                                        >
                                          {navigatingToDepartment === dept._id ? (
                                            <>
                                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                                              <span>Loading...</span>
                                            </>
                                          ) : (
                                            dept.name
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-5 whitespace-nowrap">
                                    <span className="text-[10px] font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200 uppercase">
                                      {dept.departmentId}
                                    </span>
                                  </td>
                                  <td className="px-6 py-5">
                                    <p className="text-sm text-gray-500 truncate max-w-xs">{dept.description || 'No description provided'}</p>
                                  </td>
                                  <td className="px-6 py-5 whitespace-nowrap">
                                    <div className="flex items-center gap-3">
                                      <button
                                        onClick={() => {
                                          setConfirmDialog({
                                            isOpen: true,
                                            title: dept.isActive ? 'Deactivate Department' : 'Activate Department',
                                            message: dept.isActive 
                                              ? `Are you sure you want to deactivate "${dept.name}"? Users in this department may lose access to certain features.`
                                              : `Are you sure you want to activate "${dept.name}"? This will restore access for users in this department.`,
                                            onConfirm: async () => {
                                              try {
                                                const response = await departmentAPI.update(dept._id, { isActive: !dept.isActive });
                                                if (response.success) {
                                                  toast.success(`Department ${!dept.isActive ? 'activated' : 'deactivated'} successfully`);
                                                  fetchDepartments();
                                                }
                                              } catch (error: any) {
                                                toast.error(error.message || 'Failed to update department status');
                                              } finally {
                                                setConfirmDialog(p => ({ ...p, isOpen: false }));
                                              }
                                            },
                                            variant: dept.isActive ? 'warning' : 'default'
                                          } as any);
                                        }}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                                          dept.isActive 
                                            ? 'bg-emerald-500 focus:ring-emerald-500' 
                                            : 'bg-gray-300 focus:ring-gray-400'
                                        }`}
                                        title={dept.isActive ? 'Click to deactivate' : 'Click to activate'}
                                      >
                                        <span
                                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform duration-200 ${
                                            dept.isActive ? 'translate-x-6' : 'translate-x-1'
                                          }`}
                                        />
                                      </button>
                                      <span className={`text-[10px] font-bold uppercase tracking-wider ${
                                        dept.isActive ? 'text-emerald-600' : 'text-gray-400'
                                      }`}>
                                        {dept.isActive ? 'Active' : 'Inactive'}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-5 whitespace-nowrap text-right text-sm font-medium">
                                    <div className="flex justify-end items-center space-x-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                        onClick={() => {
                                          setEditingDepartment(dept);
                                          setShowDepartmentDialog(true);
                                        }}
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                        onClick={() => {
                                          setConfirmDialog({
                                            isOpen: true,
                                            title: 'Delete Department',
                                            message: `Are you sure you want to delete "${dept.name}"? This action cannot be undone and will delete all associated users, grievances, and appointments.`,
                                            onConfirm: async () => {
                                              try {
                                                const response = await departmentAPI.delete(dept._id);
                                                if (response.success) {
                                                  toast.success('Department deleted successfully');
                                                  fetchDepartments();
                                                }
                                              } catch (error: any) {
                                                toast.error(error.message || 'Failed to delete department');
                                              } finally {
                                                setConfirmDialog(p => ({ ...p, isOpen: false }));
                                              }
                                            },
                                            variant: 'danger'
                                          } as any);
                                        }}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          </div>
                        </div>
                        
                        <Pagination
                          currentPage={departmentPage}
                          totalPages={departmentPagination.pages}
                          totalItems={departmentPagination.total}
                          itemsPerPage={departmentPagination.limit}
                          onPageChange={setDepartmentPage}
                          className="mt-6 shadow-none border-t border-slate-100 rounded-none bg-slate-50/30"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
            </TabsContent>
          )}

          {/* Users Tab */}
          {(isCompanyAdmin || isDepartmentAdmin) && (
            <TabsContent value="users" className="space-y-6">
              <Card className="rounded-2xl border-0 shadow-xl overflow-hidden bg-white/80 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 text-white px-6 py-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm shadow-lg">
                        <Users className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-bold text-white">User Management</CardTitle>
                        <CardDescription className="text-emerald-100 mt-0.5">
                          {isCompanyAdmin ? 'Manage users in your company' : 'Manage users in your department'}
                        </CardDescription>
                      </div>
                    </div>
                    {hasPermission(user?.role || '', Permission.CREATE_USER) && (
                      <Button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowUserDialog(true);
                        }}
                        className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm transition-all duration-200 rounded-xl px-5"
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Add User
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {loadingUsers ? (
                    <div className="text-center py-16">
                      <LoadingSpinner size="lg" text="Loading users..." />
                    </div>
                  ) : users.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="w-20 h-20 bg-gradient-to-br from-emerald-100 to-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Users className="w-10 h-10 text-emerald-500" />
                      </div>
                      <p className="text-slate-500 text-lg font-medium">No users found</p>
                      <p className="text-slate-400 text-sm mt-1">Add a user to get started</p>
                    </div>
                  ) : (
                    <div className="overflow-hidden">
                      <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full relative border-collapse min-w-[1200px]">
                            <thead className="sticky top-0 z-20 bg-gradient-to-r from-emerald-50 via-green-50 to-teal-50 border-b border-emerald-100">
                              <tr>
                                <th className="px-3 py-4 text-center text-xs font-bold text-emerald-700 uppercase tracking-wide">Sr. No.</th>
                                <th className="px-6 py-4 text-left min-w-[200px]">
                                  <button 
                                    onClick={() => handleSort('firstName', 'users')}
                                    className="group flex items-center space-x-1.5 text-xs font-bold text-emerald-700 uppercase tracking-wide hover:text-emerald-800 transition-colors"
                                  >
                                    <span>User Info</span>
                                    <ArrowUpDown className={`w-3.5 h-3.5 transition-colors ${sortConfig.key === 'firstName' ? 'text-emerald-700' : 'text-emerald-300 group-hover:text-emerald-400'}`} />
                                  </button>
                                </th>
                                <th className="px-6 py-4 text-left min-w-[220px]">
                                  <button 
                                    onClick={() => handleSort('email', 'users')}
                                    className="group flex items-center space-x-1.5 text-xs font-bold text-emerald-700 uppercase tracking-wide hover:text-emerald-800 transition-colors"
                                  >
                                    <span>Contact Information</span>
                                    <ArrowUpDown className={`w-3.5 h-3.5 transition-colors ${sortConfig.key === 'email' ? 'text-emerald-700' : 'text-emerald-300 group-hover:text-emerald-400'}`} />
                                  </button>
                                </th>
                                <th className="px-6 py-4 text-left min-w-[200px]">
                                  <button 
                                    onClick={() => handleSort('role', 'users')}
                                    className="group flex items-center space-x-1.5 text-xs font-bold text-emerald-700 uppercase tracking-wide hover:text-emerald-800 transition-colors"
                                  >
                                    <span>Role & Dept</span>
                                    <ArrowUpDown className={`w-3.5 h-3.5 transition-colors ${sortConfig.key === 'role' ? 'text-emerald-700' : 'text-emerald-300 group-hover:text-emerald-400'}`} />
                                  </button>
                                </th>
                                <th className="px-6 py-4 text-left min-w-[180px]">
                                  <button 
                                    onClick={() => handleSort('isActive', 'users')}
                                    className="group flex items-center space-x-1.5 text-xs font-bold text-emerald-700 uppercase tracking-wide hover:text-emerald-800 transition-colors"
                                  >
                                    <span>Status & Access</span>
                                    <ArrowUpDown className={`w-3.5 h-3.5 transition-colors ${sortConfig.key === 'isActive' ? 'text-emerald-700' : 'text-emerald-300 group-hover:text-emerald-400'}`} />
                                  </button>
                                </th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-emerald-700 uppercase tracking-wide min-w-[140px] sticky right-0 bg-gradient-to-r from-green-50 to-teal-50">Actions</th>
                              </tr>
                            </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {getSortedData(users, 'users').map((u: User, index: number) => (
                              <tr key={u._id} className="hover:bg-gradient-to-r hover:from-emerald-50/50 hover:to-green-50/50 transition-all duration-200 group/row">
                                <td className="px-3 py-5 text-center">
                                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 text-emerald-700 text-xs font-bold shadow-sm">
                                    {(userPage - 1) * userPagination.limit + index + 1}
                                  </span>
                                </td>
                                <td className="px-6 py-5 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <div className="relative">
                                      <div className="flex-shrink-0 h-12 w-12 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-full flex items-center justify-center text-white text-base font-bold shadow-sm border-2 border-white ring-1 ring-gray-100">
                                        {u.firstName[0]}{u.lastName[0]}
                                      </div>
                                      <div className={`absolute bottom-0 right-0 h-3.5 w-3.5 border-2 border-white rounded-full shadow-sm ${u.isActive ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                    </div>
                                    <div className="ml-4">
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
                                        className="text-sm font-bold text-gray-900 leading-tight hover:text-blue-600 hover:underline text-left"
                                      >
                                        {u.firstName} {u.lastName}
                                      </button>
                                      <div className="mt-1">
                                        <span className="text-[10px] font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200 uppercase tracking-tighter">
                                          ID: {u.userId}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-5 whitespace-nowrap">
                                  <div className="flex flex-col space-y-1.5">
                                    <div className="flex items-center text-sm text-blue-600 font-medium">
                                      <Mail className="w-3.5 h-3.5 mr-2 text-blue-400" />
                                      {u.email}
                                    </div>
                                    {u.phone && (
                                      <div className="flex items-center text-xs text-gray-500">
                                        <Phone className="w-3.5 h-3.5 mr-2 text-gray-400" />
                                        {u.phone}
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-5 whitespace-nowrap">
                                  <div className="flex flex-col space-y-2">
                                    <div className="flex">
                                      <span className={`px-2.5 py-0.5 inline-flex items-center text-[10px] font-bold rounded-full border shadow-sm ${
                                        u.role === 'COMPANY_ADMIN' ? 'bg-red-50 text-red-700 border-red-100 ring-1 ring-red-200' :
                                        u.role === 'DEPARTMENT_ADMIN' ? 'bg-blue-50 text-blue-700 border-blue-100 ring-1 ring-blue-200' :
                                        'bg-emerald-50 text-emerald-700 border-emerald-100 ring-1 ring-emerald-200'
                                      }`}>
                                        <Shield className="w-2.5 h-2.5 mr-1" />
                                        {u.role.replace('_', ' ')}
                                      </span>
                                    </div>
                                    <div className="flex items-center text-xs text-gray-500 font-medium ml-1">
                                      <Building className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                                      {typeof u.departmentId === 'object' && u.departmentId ? u.departmentId.name : 'All Company Access'}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-5 whitespace-nowrap">
                                  <div className="flex flex-col space-y-2.5">
                                    <div className="flex items-center">
                                      <div className={`h-2 w-2 rounded-full mr-2 ${u.isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
                                      <span className={`text-xs font-bold ${u.isActive ? 'text-green-700' : 'text-gray-500'}`}>
                                        {u.isActive ? 'Active' : 'Inactive'}
                                      </span>
                                    </div>
                                    <div className="flex items-center">
                                      <button 
                                        onClick={() => handleToggleUserStatus(u._id, u.isActive)}
                                        disabled={user && u._id === user.id}
                                        className={`relative inline-flex h-5 w-10 flex-shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                                          user && u._id === user.id 
                                            ? 'bg-gray-300 cursor-not-allowed opacity-50' 
                                            : u.isActive 
                                              ? 'bg-green-500 cursor-pointer' 
                                              : 'bg-red-400 cursor-pointer'
                                        }`}
                                        title={user && u._id === user.id ? 'You cannot deactivate yourself' : 'Toggle user status'}
                                      >
                                        <span className="sr-only">Toggle user status</span>
                                        <span
                                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${u.isActive ? 'translate-x-5' : 'translate-x-1'}`}
                                        />
                                      </button>
                                      {/* Show only one action label - the current status */}
                                      <span className={`ml-2 text-[10px] font-bold uppercase tracking-wider ${
                                        u.isActive ? 'text-green-600' : 'text-gray-400'
                                      }`}>
                                        {u.isActive ? 'Active' : 'Inactive'}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-5 whitespace-nowrap text-right sticky right-0 bg-white group-hover/row:bg-slate-50/50">
                                  <div className="flex justify-end items-center gap-1.5">
                                    {hasPermission(user?.role || '', Permission.UPDATE_USER) && (
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
                                    {hasPermission(user?.role || '', Permission.UPDATE_USER) && (
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-8 w-8 p-0 text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors flex-shrink-0"
                                        title="Change Permissions"
                                        onClick={() => {
                                          setEditingUser(u);
                                          setShowChangePermissionsDialog(true);
                                        }}
                                      >
                                        <Shield className="w-4 h-4" />
                                      </Button>
                                    )}
                                    {hasPermission(user?.role || '', Permission.DELETE_USER) && (
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className={`h-8 w-8 p-0 transition-colors flex-shrink-0 ${
                                          user && u._id === user.id 
                                            ? 'text-slate-300 cursor-not-allowed' 
                                            : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                                        }`}
                                        title={user && u._id === user.id ? 'You cannot delete yourself' : 'Delete User'}
                                        disabled={user && u._id === user.id}
                                        onClick={() => {
                                          // Prevent self-deletion
                                          if (user && u._id === user.id) {
                                            toast.error('You cannot delete yourself');
                                            return;
                                          }
                                          
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
                                                }
                                              } catch (error: any) {
                                                const errorMessage = error.response?.data?.message || error.message || 'Failed to delete user';
                                                toast.error(errorMessage);
                                              } finally {
                                                setConfirmDialog(p => ({ ...p, isOpen: false }));
                                              }
                                            }
                                          } as any);
                                        }}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
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
          <TabsContent value="grievances" className="space-y-6">
            {/* Back Button - Show when coming from overview (not for operators) */}
            {previousTab === 'overview' && !isOperator && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setActiveTab(previousTab);
                  setGrievanceFilters(prev => ({ ...prev, status: '' }));
                }}
                className="mb-4 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Overview
              </Button>
            )}
            <Card className="rounded-2xl border-0 shadow-xl overflow-hidden bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white px-6 py-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold text-white">
                        {grievanceFilters.status === 'RESOLVED' ? 'Resolved Grievances' : grievanceFilters.status === 'REJECTED' ? 'Rejected Grievances' : grievanceFilters.status === 'CLOSED' ? 'Closed Grievances' : 'Active Grievances'}
                      </CardTitle>
                      <CardDescription className="text-white/80 mt-0.5">
                        {grievanceFilters.status === 'RESOLVED' ? 'View all resolved grievances' : grievanceFilters.status === 'REJECTED' ? 'View all rejected grievances' : grievanceFilters.status === 'CLOSED' ? 'View all closed grievances' : 'View and manage pending and in-progress grievances'}
                      </CardDescription>
                    </div>
                  </div>
                  <Link 
                    href="/resolved-grievances"
                    className="flex items-center gap-2 px-5 py-2.5 bg-white/20 text-white rounded-xl hover:bg-white/30 transition-all duration-200 backdrop-blur-sm text-sm font-medium border border-white/30"
                  >
                    <CheckCircle className="w-4 h-4" />
                    View Resolved
                  </Link>
                </div>
              </CardHeader>
              
              {/* Grievance Filters */}
              <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-indigo-50/30 border-b border-slate-200">
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
                      <RefreshCw className={`w-4 h-4 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportToCSV(
                        getSortedData(grievances, 'grievances'),
                        'grievances',
                        [
                          { key: 'grievanceId', label: 'ID' },
                          { key: 'citizenName', label: 'Citizen Name' },
                          { key: 'citizenPhone', label: 'Phone' },
                          { key: 'category', label: 'Category' },
                          { key: 'status', label: 'Status' },
                          { key: 'createdAt', label: 'Created At' }
                        ]
                      )}
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
                    <span className="text-sm font-semibold text-slate-700">Filters</span>
                  </div>
                  
                  {/* Status Filter */}
                  <select
                    value={grievanceFilters.status}
                    onChange={(e) => setGrievanceFilters(prev => ({ ...prev, status: e.target.value }))}
                    className="text-xs px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm hover:border-indigo-300 transition-colors cursor-pointer"
                    title="Filter by grievance status"
                  >
                    <option value="">📋 All Status</option>
                    <option value="PENDING">🔸 Pending</option>
                    <option value="ASSIGNED">👤 Assigned</option>
                    <option value="RESOLVED">✅ Resolved</option>
                    <option value="REJECTED">❌ Rejected</option>
                    <option value="CLOSED">🔒 Closed</option>
                  </select>

                  {/* Department Filter */}
                  <select
                    value={grievanceFilters.department}
                    onChange={(e) => setGrievanceFilters(prev => ({ ...prev, department: e.target.value }))}
                    className="text-xs px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm hover:border-indigo-300 transition-colors cursor-pointer"
                    title="Filter by department"
                  >
                    <option value="">🏢 All Departments</option>
                    {departments.map((dept) => (
                      <option key={dept._id} value={dept._id}>{dept.name}</option>
                    ))}
                  </select>

                  {/* Assignment Status Filter */}
                  <select
                    value={grievanceFilters.assignmentStatus}
                    onChange={(e) => setGrievanceFilters(prev => ({ ...prev, assignmentStatus: e.target.value }))}
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
                    onChange={(e) => setGrievanceFilters(prev => ({ ...prev, overdueStatus: e.target.value }))}
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
                    onChange={(e) => setGrievanceFilters(prev => ({ ...prev, dateRange: e.target.value }))}
                    className="text-xs px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm hover:border-indigo-300 transition-colors cursor-pointer"
                    title="Filter by date range"
                  >
                    <option value="">📅 All Time</option>
                    <option value="today">Today</option>
                    <option value="week">Last 7 Days</option>
                    <option value="month">Last 30 Days</option>
                  </select>

                  {/* Clear Filters */}
                  {(grievanceFilters.status || grievanceFilters.department || grievanceFilters.assignmentStatus || grievanceFilters.overdueStatus || grievanceFilters.dateRange) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setGrievanceFilters({ status: '', department: '', assignmentStatus: '', overdueStatus: '', dateRange: '' })}
                      className="text-xs h-8 px-3 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl border border-red-200"
                      title="Clear all filters"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Clear
                    </Button>
                  )}

                  {/* Results count */}
                  <span className="text-xs text-slate-500 ml-auto bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-200">
                    Showing <span className="font-semibold text-indigo-600">{getSortedData(grievances, 'grievances').length}</span> of {grievances.length} grievances
                  </span>

                  {/* Bulk Delete Button (Super Admin only) */}
                  {user?.role === 'SUPER_ADMIN' && selectedGrievances.size > 0 && (
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

              <CardContent>
                {loadingGrievances ? (
                  <div className="text-center py-16">
                    <LoadingSpinner size="lg" text="Loading grievances..." />
                  </div>
                ) : grievances.length === 0 ? (
                  <div className="text-center py-16 bg-gradient-to-b from-slate-50 to-white rounded-2xl border border-slate-200">
                    <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-slate-600 font-medium">No grievances found</p>
                    <p className="text-slate-400 text-sm mt-1">New grievances will appear here</p>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-lg bg-white">
                    <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                      <table className="w-full relative border-collapse">
                        <thead className="sticky top-0 z-20 bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 backdrop-blur-sm shadow-sm border-b border-slate-200">
                          <tr className="whitespace-nowrap">
                            {user?.role === 'SUPER_ADMIN' && (
                              <th className="px-3 py-4 text-center text-[11px] font-bold text-indigo-600 uppercase tracking-wider">
                                <input
                                  type="checkbox"
                                  checked={selectedGrievances.size > 0 && selectedGrievances.size === getSortedData(grievances, 'grievances').length}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedGrievances(new Set(getSortedData(grievances, 'grievances').map(g => g._id)));
                                    } else {
                                      setSelectedGrievances(new Set());
                                    }
                                  }}
                                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                                  title="Select All"
                                />
                              </th>
                            )}
                            <th className="px-3 py-4 text-center text-[11px] font-bold text-indigo-600 uppercase tracking-wider">Sr. No.</th>
                            <th className="px-4 py-4 text-left">
                              <button 
                                onClick={() => handleSort('grievanceId', 'grievances')}
                                className="group flex items-center space-x-1.5 text-[11px] font-bold text-indigo-600 uppercase tracking-wider hover:text-indigo-800 transition-colors"
                              >
                                <span>App No</span>
                                <ArrowUpDown className={`w-3.5 h-3.5 transition-colors ${sortConfig.key === 'grievanceId' ? 'text-indigo-600' : 'text-indigo-300 group-hover:text-indigo-400'}`} />
                              </button>
                            </th>
                            <th className="px-4 py-4 text-left">
                              <button 
                                onClick={() => handleSort('citizenName', 'grievances')}
                                className="group flex items-center space-x-1.5 text-[11px] font-bold text-indigo-600 uppercase tracking-wider hover:text-indigo-800 transition-colors"
                              >
                                <span>Citizen</span>
                                <ArrowUpDown className={`w-3.5 h-3.5 transition-colors ${sortConfig.key === 'citizenName' ? 'text-blue-600' : 'text-gray-300 group-hover:text-gray-400'}`} />
                              </button>
                            </th>
                            <th className="px-4 py-3 text-left">
                              <button 
                                onClick={() => handleSort('category', 'grievances')}
                                className="group flex items-center space-x-1.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider hover:text-blue-600 transition-colors"
                              >
                                <span>Dept & Category</span>
                                <ArrowUpDown className={`w-3.5 h-3.5 transition-colors ${sortConfig.key === 'category' ? 'text-indigo-600' : 'text-indigo-300 group-hover:text-indigo-400'}`} />
                              </button>
                            </th>
                            <th className="px-4 py-4 text-left">
                              <button 
                                onClick={() => handleSort('assignedTo', 'grievances')}
                                className="group flex items-center space-x-1.5 text-[11px] font-bold text-indigo-600 uppercase tracking-wider hover:text-indigo-800 transition-colors"
                              >
                                <span>Assigned With</span>
                                <ArrowUpDown className={`w-3.5 h-3.5 transition-colors ${sortConfig.key === 'assignedTo' ? 'text-indigo-600' : 'text-indigo-300 group-hover:text-indigo-400'}`} />
                              </button>
                            </th>
                            <th className="px-4 py-4 text-left">
                              <button 
                                onClick={() => handleSort('status', 'grievances')}
                                className="group flex items-center space-x-1.5 text-[11px] font-bold text-indigo-600 uppercase tracking-wider hover:text-indigo-800 transition-colors"
                              >
                                <span>Status</span>
                                <ArrowUpDown className={`w-3.5 h-3.5 transition-colors ${sortConfig.key === 'status' ? 'text-indigo-600' : 'text-indigo-300 group-hover:text-indigo-400'}`} />
                              </button>
                            </th>
                            <th className="px-4 py-4 text-left text-[11px] font-bold text-indigo-600 uppercase tracking-wider">Overdue</th>
                            <th className="px-4 py-4 text-left">
                              <button 
                                onClick={() => handleSort('createdAt', 'grievances')}
                                className="group flex items-center space-x-1.5 text-[11px] font-bold text-indigo-600 uppercase tracking-wider hover:text-indigo-800 transition-colors"
                              >
                                <span>Raised On</span>
                                <ArrowUpDown className={`w-3.5 h-3.5 transition-colors ${sortConfig.key === 'createdAt' ? 'text-indigo-600' : 'text-indigo-300 group-hover:text-indigo-400'}`} />
                              </button>
                            </th>
                            <th className="px-4 py-4 text-center text-[11px] font-bold text-indigo-600 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {getSortedData(grievances, 'grievances').map((grievance, index) => (
                            <tr key={grievance._id} className="hover:bg-gradient-to-r hover:from-indigo-50/50 hover:to-purple-50/50 transition-all duration-200 group/row">
                            {user?.role === 'SUPER_ADMIN' && (
                              <td className="px-3 py-4 text-center">
                                <input
                                  type="checkbox"
                                  checked={selectedGrievances.has(grievance._id)}
                                  onChange={(e) => {
                                    const newSelected = new Set(selectedGrievances);
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
                                {(grievancePage - 1) * grievancePagination.limit + index + 1}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <span className="font-bold text-sm text-blue-700">{grievance.grievanceId}</span>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-col">
                                <button
                                  onClick={async () => {
                                    try {
                                      const response = await grievanceAPI.getById(grievance._id);
                                      if (response.success) {
                                        setSelectedGrievance(response.data.grievance);
                                        setShowGrievanceDetail(true);
                                      }
                                    } catch (error: any) {
                                      toast.error('Failed to load grievance details');
                                    }
                                  }}
                                  className="text-gray-900 font-bold text-sm text-left hover:text-blue-600 hover:underline"
                                >
                                  {grievance.citizenName}
                                </button>
                                <span className="text-xs text-gray-500">{grievance.citizenPhone}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-col">
                                <span className="text-xs font-semibold text-gray-700">
                                  {typeof grievance.departmentId === 'object' && grievance.departmentId ? (grievance.departmentId as any).name : 'General'}
                                </span>
                                <span className="text-[10px] text-orange-400 uppercase">{grievance.category}</span>
                              </div>
                            </td>
                            {/* Assigned With Column */}
                            <td className="px-4 py-4">
                              <div className="flex flex-col">
                                {grievance.assignedTo ? (
                                  <>
                                    <span className="text-xs font-semibold text-green-700">
                                      {typeof grievance.assignedTo === 'object' 
                                        ? `${(grievance.assignedTo as any).firstName} ${(grievance.assignedTo as any).lastName}`
                                        : grievance.assignedTo}
                                    </span>
                                    {grievance.assignedAt && (
                                      <span className="text-[10px] text-gray-400">
                                        {new Date(grievance.assignedAt).toLocaleDateString()}
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-xs text-gray-400 italic">Not assigned</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <button
                                onClick={() => {
                                  setSelectedGrievanceForStatus(grievance);
                                  setShowGrievanceStatusModal(true);
                                }}
                                disabled={grievance.status === 'RESOLVED' || grievance.status === 'CLOSED' || grievance.status === 'REJECTED' || updatingGrievanceStatus.has(grievance._id)}
                                className={`px-3 py-1.5 text-[10px] font-bold border border-gray-200 rounded bg-white hover:border-purple-400 hover:bg-purple-50 focus:outline-none focus:ring-1 focus:ring-purple-500 uppercase tracking-tight transition-all ${
                                  updatingGrievanceStatus.has(grievance._id) ? 'opacity-50 cursor-wait' : ''
                                } ${
                                  (grievance.status === 'RESOLVED' || grievance.status === 'CLOSED' || grievance.status === 'REJECTED') ? 'opacity-60 cursor-not-allowed' : ''
                                }`}
                              >
                                {grievance.status}
                              </button>
                            </td>
                            {/* Overdue Status Column */}
                            <td className="px-4 py-4">
                              {(() => {
                                // Calculate overdue status based on SLA
                                const createdDate = new Date(grievance.createdAt);
                                const now = new Date();
                                const hoursDiff = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60));
                                
                                // SLA: PENDING should be assigned within 24h, ASSIGNED should be resolved within 120h (5 days)
                                let isOverdue = false;
                                let slaHours = 0;
                                
                                if (grievance.status === 'PENDING') {
                                  slaHours = 24;
                                  isOverdue = hoursDiff > slaHours;
                                } else if (grievance.status === 'ASSIGNED') {
                                  slaHours = 120;
                                  const assignedDate = grievance.assignedAt ? new Date(grievance.assignedAt) : createdDate;
                                  const hoursFromAssigned = Math.floor((now.getTime() - assignedDate.getTime()) / (1000 * 60 * 60));
                                  isOverdue = hoursFromAssigned > slaHours;
                                }
                                
                                if (grievance.status === 'RESOLVED') {
                                  return <span className="px-2 py-1 text-[10px] font-bold bg-green-100 text-green-700 rounded">COMPLETED</span>;
                                }
                                
                                return isOverdue 
                                  ? <span className="px-2 py-1 text-[10px] font-bold bg-red-100 text-red-700 rounded animate-pulse">OVERDUE</span>
                                  : <span className="px-2 py-1 text-[10px] font-bold bg-green-100 text-green-700 rounded">ON TRACK</span>;
                              })()}
                            </td>
                            <td className="px-4 py-4 text-xs text-gray-600">
                              <div className="flex flex-col">
                                <span className="font-medium">{new Date(grievance.createdAt).toLocaleDateString()}</span>
                                <span className="text-[10px] text-gray-400">{new Date(grievance.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center justify-center space-x-1">
                                {/* Hide assign button for operators and for resolved/closed grievances */}
                                {!isOperator && grievance.status !== 'RESOLVED' && grievance.status !== 'CLOSED' && grievance.status !== 'REJECTED' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedGrievanceForAssignment(grievance);
                                    setShowGrievanceAssignment(true);
                                  }}
                                  title="Assign"
                                  className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      const response = await grievanceAPI.getById(grievance._id);
                                      if (response.success) {
                                        setSelectedGrievance(response.data.grievance);
                                        setShowGrievanceDetail(true);
                                      }
                                    } catch (error: any) {
                                      toast.error('Failed to load details');
                                    }
                                  }}
                                  title="View"
                                  className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
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

          {/* Appointments Tab - Only for Company Admin */}
          {isCompanyAdmin && (
            <TabsContent value="appointments" className="space-y-6">
            <Card className="rounded-2xl border-0 shadow-xl overflow-hidden bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 text-white px-6 py-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold text-white">Appointments</CardTitle>
                      <CardDescription className="text-white/80 mt-0.5">View and manage all scheduled appointments</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      href="/completed-appointments"
                      className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl transition-all border border-white/30 backdrop-blur-sm font-medium text-sm"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Completed Appointments
                    </Link>
                    {(user?.role === 'COMPANY_ADMIN' || user?.role === 'DEPARTMENT_ADMIN') && (
                      <Button
                        onClick={() => setShowAvailabilityCalendar(true)}
                        className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm transition-all duration-200 rounded-xl px-5"
                        title="Configure when appointments can be scheduled including holidays, weekends, and time slots"
                      >
                        <CalendarClock className="w-4 h-4 mr-2" />
                        Manage Availability
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
                      <RefreshCw className={`w-4 h-4 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportToCSV(
                        getSortedData(appointments, 'appointments'),
                        'appointments',
                        [
                          { key: 'appointmentId', label: 'ID' },
                          { key: 'citizenName', label: 'Citizen Name' },
                          { key: 'citizenPhone', label: 'Phone' },
                          { key: 'purpose', label: 'Purpose' },
                          { key: 'appointmentDate', label: 'Date' },
                          { key: 'appointmentTime', label: 'Time' },
                          { key: 'status', label: 'Status' }
                        ]
                      )}
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
                    <span className="text-sm font-semibold text-slate-700">Filters</span>
                  </div>
                  
                  {/* Status Filter */}
                  <select
                    value={appointmentFilters.status}
                    onChange={(e) => setAppointmentFilters(prev => ({ ...prev, status: e.target.value }))}
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
                    onChange={(e) => setAppointmentFilters(prev => ({ ...prev, dateFilter: e.target.value }))}
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
                  {(appointmentFilters.status || appointmentFilters.dateFilter) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAppointmentFilters({ status: '', department: '', assignmentStatus: '', dateFilter: '' })}
                      className="text-xs h-8 px-3 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl border border-red-200"
                      title="Clear all filters"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Clear
                    </Button>
                  )}

                  {/* Results count */}
                  <span className="text-xs text-slate-500 ml-auto bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-200">
                    Showing <span className="font-semibold text-purple-600">{getSortedData(appointments, 'appointments').length}</span> of {appointments.length} appointments
                  </span>

                  {/* Bulk Delete Button (Super Admin only) */}
                  {user?.role === 'SUPER_ADMIN' && selectedAppointments.size > 0 && (
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

              <CardContent>
                {loadingAppointments ? (
                  <div className="text-center py-16">
                    <LoadingSpinner size="lg" text="Loading appointments..." />
                  </div>
                ) : appointments.length === 0 ? (
                  <div className="text-center py-16 bg-gradient-to-b from-slate-50 to-white rounded-2xl border border-slate-200">
                    <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-slate-600 font-medium">No appointments found</p>
                    <p className="text-slate-400 text-sm mt-1">New appointments will appear here</p>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-lg bg-white">
                    <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                      <table className="w-full relative border-collapse">
                        <thead className="sticky top-0 z-20 bg-gradient-to-r from-purple-50 via-fuchsia-50 to-pink-50 backdrop-blur-sm shadow-sm border-b border-slate-200">
                        <tr className="whitespace-nowrap">
                          {user?.role === 'SUPER_ADMIN' && (
                            <th className="px-3 py-4 text-center text-[11px] font-bold text-purple-600 uppercase tracking-wider">
                              <input
                                type="checkbox"
                                checked={selectedAppointments.size > 0 && selectedAppointments.size === getSortedData(appointments, 'appointments').length}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedAppointments(new Set(getSortedData(appointments, 'appointments').map(a => a._id)));
                                  } else {
                                    setSelectedAppointments(new Set());
                                  }
                                }}
                                className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 cursor-pointer"
                                title="Select All"
                              />
                            </th>
                          )}
                          <th className="px-3 py-4 text-center text-[11px] font-bold text-purple-600 uppercase tracking-wider">Sr. No.</th>
                          <th className="px-4 py-4 text-left">
                            <button 
                              onClick={() => handleSort('appointmentId', 'appointments')}
                              className="group flex items-center space-x-1.5 text-[11px] font-bold text-purple-600 uppercase tracking-wider hover:text-purple-800 transition-colors"
                            >
                              <span>App ID</span>
                              <ArrowUpDown className={`w-3.5 h-3.5 transition-colors ${sortConfig.key === 'appointmentId' ? 'text-purple-600' : 'text-purple-300 group-hover:text-purple-400'}`} />
                            </button>
                          </th>
                          <th className="px-4 py-4 text-left">
                            <button 
                              onClick={() => handleSort('citizenName', 'appointments')}
                              className="group flex items-center space-x-1.5 text-[11px] font-bold text-purple-600 uppercase tracking-wider hover:text-purple-800 transition-colors"
                            >
                              <span>Citizen</span>
                              <ArrowUpDown className={`w-3.5 h-3.5 transition-colors ${sortConfig.key === 'citizenName' ? 'text-purple-600' : 'text-purple-300 group-hover:text-purple-400'}`} />
                            </button>
                          </th>
                          <th className="px-4 py-4 text-left">
                            <button 
                              onClick={() => handleSort('purpose', 'appointments')}
                              className="group flex items-center space-x-1.5 text-[11px] font-bold text-purple-600 uppercase tracking-wider hover:text-purple-800 transition-colors"
                            >
                              <span>Dept & Purpose</span>
                              <ArrowUpDown className={`w-3.5 h-3.5 transition-colors ${sortConfig.key === 'purpose' ? 'text-purple-600' : 'text-purple-300 group-hover:text-purple-400'}`} />
                            </button>
                          </th>
                          <th className="px-4 py-4 text-left">
                            <button 
                              onClick={() => handleSort('appointmentDate', 'appointments')}
                              className="group flex items-center space-x-1.5 text-[11px] font-bold text-purple-600 uppercase tracking-wider hover:text-purple-800 transition-colors"
                            >
                              <span>Scheduled At</span>
                              <ArrowUpDown className={`w-3.5 h-3.5 transition-colors ${sortConfig.key === 'appointmentDate' ? 'text-purple-600' : 'text-purple-300 group-hover:text-purple-400'}`} />
                            </button>
                          </th>
                          <th className="px-4 py-4 text-left">
                            <button 
                              onClick={() => handleSort('status', 'appointments')}
                              className="group flex items-center space-x-1.5 text-[11px] font-bold text-purple-600 uppercase tracking-wider hover:text-purple-800 transition-colors"
                            >
                              <span>Status</span>
                              <ArrowUpDown className={`w-3.5 h-3.5 transition-colors ${sortConfig.key === 'status' ? 'text-purple-600' : 'text-purple-300 group-hover:text-purple-400'}`} />
                            </button>
                          </th>
                          <th className="px-4 py-4 text-center text-[11px] font-bold text-purple-600 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {getSortedData(appointments, 'appointments').map((appointment, index) => (
                          <tr key={appointment._id} className="hover:bg-gradient-to-r hover:from-purple-50/50 hover:to-pink-50/50 transition-all duration-200 group/row">
                            <td className="px-3 py-4 text-center">
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-purple-100 text-purple-700 text-xs font-bold">
                                {(appointmentPage - 1) * appointmentPagination.limit + index + 1}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <span className="font-bold text-sm text-purple-700">{appointment.appointmentId}</span>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-col">
                                <button
                                  onClick={async () => {
                                    try {
                                      const response = await appointmentAPI.getById(appointment._id);
                                      if (response.success) {
                                        setSelectedAppointment(response.data.appointment);
                                        setShowAppointmentDetail(true);
                                      }
                                    } catch (error: any) {
                                      toast.error('Failed to load details');
                                    }
                                  }}
                                  className="text-gray-900 font-bold text-sm text-left hover:text-purple-600 hover:underline"
                                >
                                  {appointment.citizenName}
                                </button>
                                <span className="text-xs text-gray-500">{appointment.citizenPhone}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-col max-w-[150px]">
                                <span className="text-xs font-semibold text-gray-700 truncate">
                                  CEO - Zilla Parishad Amravati
                                </span>
                                <span className="text-[10px] text-gray-500 truncate italic">{appointment.purpose}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-start gap-2">
                                <div className="flex flex-col items-center justify-center w-12 h-12 bg-gradient-to-br from-purple-100 to-fuchsia-100 rounded-xl border border-purple-200/50 shadow-sm">
                                  <span className="text-[10px] font-bold text-purple-600 uppercase">
                                    {new Date(appointment.appointmentDate).toLocaleDateString('en-US', { month: 'short' })}
                                  </span>
                                  <span className="text-lg font-black text-purple-700 leading-tight">
                                    {new Date(appointment.appointmentDate).getDate()}
                                  </span>
                                </div>
                                <div className="flex flex-col justify-center">
                                  <span className="text-xs font-semibold text-gray-800">
                                    {new Date(appointment.appointmentDate).toLocaleDateString('en-US', { weekday: 'long' })}
                                  </span>
                                  <span className="text-[11px] text-gray-500">
                                    {new Date(appointment.appointmentDate).getFullYear()}
                                  </span>
                                  <div className="flex items-center gap-1 mt-1">
                                    <Clock className="w-3 h-3 text-amber-500" />
                                    <span className="text-xs font-bold text-amber-600">
                                      {appointment.appointmentTime ? (() => {
                                        const [hours, minutes] = appointment.appointmentTime.split(':');
                                        const hour = parseInt(hours, 10);
                                        const period = hour >= 12 ? 'PM' : 'AM';
                                        const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
                                        return `${displayHour}:${minutes || '00'} ${period}`;
                                      })() : 'TBD'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="relative flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    setSelectedAppointmentForStatus(appointment);
                                    setShowAppointmentStatusModal(true);
                                  }}
                                  className={`px-3 py-1.5 text-[10px] font-bold border border-gray-200 rounded bg-white hover:border-purple-400 hover:bg-purple-50 focus:outline-none focus:ring-1 focus:ring-purple-500 uppercase tracking-tight transition-all ${
                                    updatingAppointmentStatus.has(appointment._id) ? 'opacity-50 cursor-wait' : ''
                                  }`}
                                  disabled={updatingAppointmentStatus.has(appointment._id)}
                                >
                                  {appointment.status}
                                </button>
                                {updatingAppointmentStatus.has(appointment._id) && (
                                  <RefreshCw className="w-3.5 h-3.5 text-purple-600 animate-spin flex-shrink-0" />
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center justify-center gap-1">
                                {/* Assign button removed - Appointments are for CEO only, no assignment needed */}
                                <button
                                  onClick={async () => {
                                    try {
                                      const response = await appointmentAPI.getById(appointment._id);
                                      if (response.success) {
                                        setSelectedAppointment(response.data.appointment);
                                        setShowAppointmentDetail(true);
                                      }
                                    } catch (error: any) {
                                      toast.error('Failed to load details');
                                    }
                                  }}
                                  title="View Details"
                                  className="p-2 rounded-lg text-purple-600 hover:text-purple-700 hover:bg-purple-50 border border-transparent hover:border-purple-200 transition-all duration-200"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
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

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <Card className="rounded-2xl border-0 shadow-xl overflow-hidden bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 text-white px-6 py-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm shadow-lg">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold text-white">Analytics Dashboard</CardTitle>
                    <CardDescription className="text-violet-100 mt-0.5">View statistics, metrics, and performance insights</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {loadingStats ? (
                  <div className="py-20">
                    <LoadingSpinner size="lg" text="Loading analytics..." />
                  </div>
                ) : stats ? (
                  <div className="space-y-8 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                    {/* Interactive Performance Metrics */}
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-purple-600" />
                        Performance Metrics
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                        <div 
                          className="relative overflow-hidden bg-gradient-to-br from-emerald-500 via-green-500 to-teal-500 rounded-2xl p-5 text-white shadow-lg cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-[1.02] group"
                          onClick={() => {
                            const resolutionRate = stats.grievances.total > 0 
                              ? ((stats.grievances.resolved / stats.grievances.total) * 100).toFixed(1)
                              : '0.0';
                            setSelectedMetric({
                              title: 'Resolution Rate',
                              description: 'The percentage of grievances that have been successfully resolved out of all grievances received.',
                              formula: '(Resolved Grievances ÷ Total Grievances) × 100',
                              interpretation: `A resolution rate of ${resolutionRate}% means that ${stats.grievances.resolved} out of ${stats.grievances.total} grievances have been resolved. Industry benchmark is typically 70-85%. ${parseFloat(resolutionRate) >= 70 ? 'Your performance is good!' : 'Consider improving resolution processes.'}`,
                              currentValue: `${resolutionRate}%`,
                              benchmark: '70-85% (Industry Standard)',
                              icon: 'trending'
                            });
                            setShowMetricDialog(true);
                          }}
                        >
                          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
                          <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/10 rounded-full translate-x-1/3 translate-y-1/3" />
                          <div className="relative z-10">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm font-semibold text-white/90">Resolution Rate</p>
                              <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                <CheckCircle className="w-5 h-5 text-white" />
                              </div>
                            </div>
                            <p className="text-4xl font-black tracking-tight">
                              {stats.grievances.total > 0 
                                ? ((stats.grievances.resolved / stats.grievances.total) * 100).toFixed(1)
                                : '0.0'}%
                            </p>
                            <p className="text-sm text-white/80 mt-2 font-medium">
                              {stats.grievances.resolved} of {stats.grievances.total} resolved
                            </p>
                            <p className="text-xs text-white/60 mt-1 group-hover:text-white/80 transition-colors">Click for details →</p>
                          </div>
                        </div>

                        <div 
                          className="relative overflow-hidden bg-gradient-to-br from-blue-500 via-indigo-500 to-cyan-500 rounded-2xl p-5 text-white shadow-lg cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-[1.02] group"
                          onClick={() => {
                            const completionRate = stats.appointments.total > 0 
                              ? ((stats.appointments.completed / stats.appointments.total) * 100).toFixed(1)
                              : '0.0';
                            setSelectedMetric({
                              title: 'Completion Rate',
                              description: 'The percentage of appointments that have been successfully completed out of all scheduled appointments.',
                              formula: '(Completed Appointments ÷ Total Appointments) × 100',
                              interpretation: `A completion rate of ${completionRate}% indicates that ${stats.appointments.completed} out of ${stats.appointments.total} appointments were completed. A good completion rate is above 75%. ${parseFloat(completionRate) >= 75 ? 'Excellent performance!' : 'Consider reducing no-shows and cancellations.'}`,
                              currentValue: `${completionRate}%`,
                              benchmark: '75-90% (Target Range)',
                              icon: 'target'
                            });
                            setShowMetricDialog(true);
                          }}
                        >
                          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
                          <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/10 rounded-full translate-x-1/3 translate-y-1/3" />
                          <div className="relative z-10">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm font-semibold text-white/90">Completion Rate</p>
                              <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                <CalendarCheck className="w-5 h-5 text-white" />
                              </div>
                            </div>
                            <p className="text-4xl font-black tracking-tight">
                              {stats.appointments.total > 0 
                                ? ((stats.appointments.completed / stats.appointments.total) * 100).toFixed(1)
                                : '0.0'}%
                            </p>
                            <p className="text-sm text-white/80 mt-2 font-medium">
                              {stats.appointments.completed} of {stats.appointments.total} completed
                            </p>
                            <p className="text-xs text-white/60 mt-1 group-hover:text-white/80 transition-colors">Click for details →</p>
                          </div>
                        </div>

                        {stats.grievances.slaComplianceRate !== undefined && (
                          <div 
                            className="relative overflow-hidden bg-gradient-to-br from-purple-500 via-violet-500 to-fuchsia-500 rounded-2xl p-5 text-white shadow-lg cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-[1.02] group"
                            onClick={() => {
                              const slaBreaches = stats.grievances.slaBreached || 0;
                              const slaCompliance = stats.grievances.slaComplianceRate?.toFixed(1) || '0.0';
                              setSelectedMetric({
                                title: 'SLA Compliance',
                                description: 'Service Level Agreement compliance measures the percentage of grievances resolved within the defined time frame.',
                                formula: '((Total Grievances - SLA Breaches) ÷ Total Grievances) × 100',
                                interpretation: `An SLA compliance of ${slaCompliance}% means ${stats.grievances.total - slaBreaches} out of ${stats.grievances.total} grievances were resolved within the SLA timeframe. ${slaBreaches} grievances breached the SLA. Target is 90%+ compliance. ${parseFloat(slaCompliance) >= 90 ? 'Outstanding compliance!' : 'Focus on reducing resolution times.'}`,
                                currentValue: `${slaCompliance}%`,
                                benchmark: '90%+ (Target)',
                                icon: 'target'
                              });
                              setShowMetricDialog(true);
                            }}
                          >
                            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
                            <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/10 rounded-full translate-x-1/3 translate-y-1/3" />
                            <div className="relative z-10">
                              <div className="flex items-center justify-between mb-3">
                                <p className="text-sm font-semibold text-white/90">SLA Compliance</p>
                                <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                  <Target className="w-5 h-5 text-white" />
                                </div>
                              </div>
                              <p className="text-4xl font-black tracking-tight">
                                {stats.grievances.slaComplianceRate?.toFixed(1)}%
                              </p>
                              <p className="text-sm text-white/80 mt-2 font-medium">
                                {stats.grievances.slaBreached || 0} breaches
                              </p>
                              <p className="text-xs text-white/60 mt-1 group-hover:text-white/80 transition-colors">Click for details →</p>
                            </div>
                          </div>
                        )}

                        {stats.grievances.avgResolutionDays !== undefined && (
                          <div 
                            className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 rounded-2xl p-5 text-white shadow-lg cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-[1.02] group"
                            onClick={() => {
                              const avgDays = stats.grievances.avgResolutionDays?.toFixed(1) || '0.0';
                              setSelectedMetric({
                                title: 'Avg Resolution Time',
                                description: 'The average number of days taken to resolve a grievance from the time it was created to resolution.',
                                formula: 'Sum of (Resolution Date - Creation Date) ÷ Number of Resolved Grievances',
                                interpretation: `On average, it takes ${avgDays} days to resolve a grievance. Industry best practice is 3-5 days for standard grievances. ${parseFloat(avgDays) <= 5 ? 'Excellent response time!' : 'Consider streamlining resolution processes to reduce time.'}`,
                                currentValue: `${avgDays} days`,
                                benchmark: '3-5 days (Best Practice)',
                                icon: 'calculator'
                              });
                              setShowMetricDialog(true);
                            }}
                          >
                            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
                            <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/10 rounded-full translate-x-1/3 translate-y-1/3" />
                            <div className="relative z-10">
                              <div className="flex items-center justify-between mb-3">
                                <p className="text-sm font-semibold text-white/90">Avg Resolution Time</p>
                                <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                  <Clock className="w-5 h-5 text-white" />
                                </div>
                              </div>
                              <p className="text-4xl font-black tracking-tight">
                                {stats.grievances.avgResolutionDays?.toFixed(1)}
                              </p>
                              <p className="text-sm text-white/80 mt-2 font-medium">Days Average</p>
                              <p className="text-xs text-white/60 mt-1 group-hover:text-white/80 transition-colors">Click for details →</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* STATUS DISTRIBUTION CHARTS */}
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <PieChartIcon className="w-5 h-5 text-purple-600" />
                        Status Distribution
                      </h3>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="rounded-2xl border border-slate-200/50 shadow-md hover:shadow-lg transition-shadow duration-300 bg-white/80 backdrop-blur-sm overflow-hidden">
                          <CardHeader className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-b border-slate-100 px-5 py-4">
                            <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                              <FileText className="w-5 h-5 text-blue-600" />
                              Grievance Status Distribution
                            </CardTitle>
                          </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={280}>
                            <PieChart>
                              <defs>
                                <linearGradient id="grievancePending" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#FFBB28" stopOpacity={0.9}/>
                                  <stop offset="95%" stopColor="#FFBB28" stopOpacity={0.7}/>
                                </linearGradient>
                                <linearGradient id="grievanceInProgress" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#0088FE" stopOpacity={0.9}/>
                                  <stop offset="95%" stopColor="#0088FE" stopOpacity={0.7}/>
                                </linearGradient>
                                <linearGradient id="grievanceResolved" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#00C49F" stopOpacity={0.9}/>
                                  <stop offset="95%" stopColor="#00C49F" stopOpacity={0.7}/>
                                </linearGradient>
                              </defs>
                              <Pie
                                data={[
                                  { name: 'Pending', value: stats.grievances.pending, fill: 'url(#grievancePending)' },
                                  { name: 'In Progress', value: stats.grievances.inProgress, fill: 'url(#grievanceInProgress)' },
                                  { name: 'Resolved', value: stats.grievances.resolved, fill: 'url(#grievanceResolved)' }
                                ].filter(item => item.value > 0)}
                                cx="50%"
                                cy="50%"
                                labelLine={true}
                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                                outerRadius={90}
                                innerRadius={50}
                                dataKey="value"
                                paddingAngle={2}
                              >
                              </Pie>
                              <Tooltip 
                                contentStyle={{ 
                                  backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '8px',
                                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                                }}
                              />
                              <Legend 
                                verticalAlign="bottom" 
                                height={36}
                                iconType="circle"
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>

                      <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-300">
                        <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                          <CardTitle className="text-lg text-slate-900">Grievance Statistics</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={[
                              { name: 'Total', value: stats.grievances.total },
                              { name: 'Pending', value: stats.grievances.pending },
                              { name: 'In Progress', value: stats.grievances.inProgress },
                              { name: 'Resolved', value: stats.grievances.resolved }
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
                      </div>
                    </div>

                    {/* Appointment Charts */}
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <CalendarClock className="w-5 h-5 text-purple-600" />
                        Appointment Analytics
                      </h3>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="rounded-2xl border border-slate-200/50 shadow-md hover:shadow-lg transition-shadow duration-300 bg-white/80 backdrop-blur-sm overflow-hidden">
                          <CardHeader className="bg-gradient-to-r from-purple-50 via-fuchsia-50 to-pink-50 border-b border-slate-100 px-5 py-4">
                            <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                              <CalendarCheck className="w-5 h-5 text-purple-600" />
                              Appointment Status Distribution
                            </CardTitle>
                          </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={280}>
                            <PieChart>
                              <defs>
                                <linearGradient id="appointmentPending" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#FFBB28" stopOpacity={0.9}/>
                                  <stop offset="95%" stopColor="#FFBB28" stopOpacity={0.7}/>
                                </linearGradient>
                                <linearGradient id="appointmentConfirmed" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#0088FE" stopOpacity={0.9}/>
                                  <stop offset="95%" stopColor="#0088FE" stopOpacity={0.7}/>
                                </linearGradient>
                                <linearGradient id="appointmentCompleted" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#00C49F" stopOpacity={0.9}/>
                                  <stop offset="95%" stopColor="#00C49F" stopOpacity={0.7}/>
                                </linearGradient>
                              </defs>
                              <Pie
                                data={[
                                  { name: 'Pending', value: stats.appointments.pending, fill: 'url(#appointmentPending)' },
                                  { name: 'Confirmed', value: stats.appointments.confirmed, fill: 'url(#appointmentConfirmed)' },
                                  { name: 'Completed', value: stats.appointments.completed, fill: 'url(#appointmentCompleted)' }
                                ].filter(item => item.value > 0)}
                                cx="50%"
                                cy="50%"
                                labelLine={true}
                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                                outerRadius={90}
                                innerRadius={50}
                                dataKey="value"
                                paddingAngle={2}
                              >
                              </Pie>
                              <Tooltip 
                                contentStyle={{ 
                                  backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '8px',
                                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                                }}
                              />
                              <Legend 
                                verticalAlign="bottom" 
                                height={36}
                                iconType="circle"
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>

                        <Card className="rounded-2xl border border-slate-200/50 shadow-md hover:shadow-lg transition-shadow duration-300 bg-white/80 backdrop-blur-sm overflow-hidden">
                          <CardHeader className="bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 border-b border-slate-100 px-5 py-4">
                            <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                              <BarChart2 className="w-5 h-5 text-emerald-600" />
                              Appointment Statistics
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ResponsiveContainer width="100%" height={250}>
                              <BarChart data={[
                                { name: 'Total', value: stats.appointments.total },
                                { name: 'Pending', value: stats.appointments.pending },
                                { name: 'Confirmed', value: stats.appointments.confirmed },
                                { name: 'Completed', value: stats.appointments.completed }
                              ]}>
                                <defs>
                                  <linearGradient id="appointmentGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.9}/>
                                    <stop offset="100%" stopColor="#059669" stopOpacity={0.9}/>
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} />
                                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                                <Tooltip 
                                  contentStyle={{ 
                                    backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '8px',
                                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                                  }}
                                />
                                <Bar dataKey="value" fill="url(#appointmentGradient)" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </CardContent>
                        </Card>
                      </div>
                    </div>


                    {/* Additional Analytics Charts */}
                    {/* Priority chart commented out
                    {stats.grievances.byPriority && stats.grievances.byPriority.length > 0 && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Grievances by Priority</CardTitle>
                            <CardDescription>Distribution of grievances by priority level</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <ResponsiveContainer width="100%" height={250}>
                              <BarChart 
                                data={stats.grievances.byPriority} 
                                layout="vertical"
                                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" />
                                <YAxis type="category" dataKey="priority" width={80} />
                                <Tooltip />
                                <Bar dataKey="count" fill="#8884d8" />
                              </BarChart>
                            </ResponsiveContainer>
                          </CardContent>
                        </Card>

                        {stats.appointments.byDepartment && stats.appointments.byDepartment.length > 0 && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base">Appointments by Department</CardTitle>
                              <CardDescription>Distribution of appointments across departments</CardDescription>
                            </CardHeader>
                            <CardContent>
                              <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={stats.appointments.byDepartment.map((dept: any) => ({
                                  ...dept,
                                  departmentName: dept.departmentName.replace(/\s+Department$/i, '').trim()
                                }))}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="departmentName" angle={-45} textAnchor="end" height={100} />
                                  <YAxis />
                                  <Tooltip />
                                  <Bar dataKey="count" fill="#00C49F" />
                                </BarChart>
                              </ResponsiveContainer>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    )}
                    */}
                    
                    {/* Show only Appointments by Department chart */}
                    {stats.appointments.byDepartment && stats.appointments.byDepartment.length > 0 && (
                      <div className="grid grid-cols-1 gap-6">
                        <Card className="rounded-2xl border border-slate-200/50 shadow-md hover:shadow-lg transition-shadow duration-300 bg-white/80 backdrop-blur-sm overflow-hidden">
                          <CardHeader className="bg-gradient-to-r from-amber-50 via-orange-50 to-red-50 border-b border-slate-100 px-5 py-4">
                            <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                              <Building className="w-5 h-5 text-amber-600" />
                              Appointments by Department
                            </CardTitle>
                            <CardDescription className="text-slate-500">Distribution of appointments across departments</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <ResponsiveContainer width="100%" height={250}>
                              <BarChart data={stats.appointments.byDepartment.map((dept: any) => ({
                                ...dept,
                                departmentName: dept.departmentName ? dept.departmentName.replace(/\s+Department$/i, '').trim() : 'Unknown'
                              }))}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="departmentName" angle={-45} textAnchor="end" height={100} />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="count" fill="#00C49F" />
                              </BarChart>
                            </ResponsiveContainer>
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    {/* Time Series Charts */}
                    {stats.grievances.daily && stats.grievances.daily.length > 0 && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Grievance Trends (Last 7 Days)</CardTitle>
                            <CardDescription>Daily grievance creation trend</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <ResponsiveContainer width="100%" height={280}>
                              <AreaChart data={stats.grievances.daily}>
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

                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Appointment Trends (Last 7 Days)</CardTitle>
                            <CardDescription>Daily appointment creation trend</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <ResponsiveContainer width="100%" height={280}>
                              <AreaChart data={stats.appointments.daily}>
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

                    {/* Monthly Trends */}
                    {(stats.grievances.monthly || stats.appointments.monthly) && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {stats.grievances.monthly && stats.grievances.monthly.length > 0 && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base">Grievance Trends (Last 6 Months)</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <ResponsiveContainer width="100%" height={280}>
                                <LineChart data={stats.grievances.monthly}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="month" />
                                  <YAxis />
                                  <Tooltip />
                                  <Legend />
                                  <Line type="monotone" dataKey="count" stroke="#8884d8" name="Total" />
                                  <Line type="monotone" dataKey="resolved" stroke="#00C49F" name="Resolved" />
                                </LineChart>
                              </ResponsiveContainer>
                            </CardContent>
                          </Card>
                        )}

                        {stats.appointments.monthly && stats.appointments.monthly.length > 0 && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base">Appointment Trends (Last 6 Months)</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <ResponsiveContainer width="100%" height={280}>
                                <LineChart data={stats.appointments.monthly}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="month" />
                                  <YAxis />
                                  <Tooltip />
                                  <Legend />
                                  <Line type="monotone" dataKey="count" stroke="#00C49F" name="Total" />
                                  <Line type="monotone" dataKey="completed" stroke="#0088FE" name="Completed" />
                                </LineChart>
                              </ResponsiveContainer>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    )}

                    {/* Hourly Distribution */}
                    {hourlyData && (hourlyData.grievances?.length > 0 || hourlyData.appointments?.length > 0) && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {hourlyData.grievances && hourlyData.grievances.length > 0 && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-lg">Grievance Distribution by Hour</CardTitle>
                              <CardDescription>Peak hours for grievance submissions (Last 7 Days)</CardDescription>
                            </CardHeader>
                            <CardContent>
                              <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={hourlyData.grievances}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="hour" label={{ value: 'Hour of Day', position: 'insideBottom', offset: -2 }} />
                                  <YAxis />
                                  <Tooltip />
                                  <Bar dataKey="count" fill="#8884d8" />
                                </BarChart>
                              </ResponsiveContainer>
                            </CardContent>
                          </Card>
                        )}

                        {hourlyData.appointments && hourlyData.appointments.length > 0 && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-lg">Appointment Distribution by Hour</CardTitle>
                              <CardDescription>Peak hours for appointment bookings (Last 7 Days)</CardDescription>
                            </CardHeader>
                            <CardContent>
                              <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={hourlyData.appointments}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="hour" label={{ value: 'Hour of Day', position: 'insideBottom', offset: -2 }} />
                                  <YAxis />
                                  <Tooltip />
                                  <Bar dataKey="count" fill="#00C49F" />
                                </BarChart>
                              </ResponsiveContainer>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    )}

                    {/* Performance Metrics */}
                    {performanceData && (
                      <div className="grid">
                        {/* {performanceData.topDepartments && performanceData.topDepartments.length > 0 && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-lg">Top Performing Departments</CardTitle>
                              <CardDescription>Departments with highest resolution rates</CardDescription>
                            </CardHeader>
                            <CardContent>
                              <ResponsiveContainer width="100%" height={250}>
                                <BarChart 
                                  data={performanceData.topDepartments.map((dept: any) => ({
                                    ...dept,
                                    departmentName: dept.departmentName.replace(/\s+Department$/i, '').trim()
                                  }))}
                                  layout="vertical"
                                  margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis type="number" />
                                  <YAxis type="category" dataKey="departmentName" width={90} />
                                  <Tooltip />
                                  <Legend 
                                    verticalAlign="top" 
                                    align="right"
                                    wrapperStyle={{ paddingBottom: '10px' }}
                                  />
                                  <Bar dataKey="total" fill="#8884d8" name="Total" />
                                  <Bar dataKey="resolved" fill="#00C49F" name="Resolved" />
                                </BarChart>
                              </ResponsiveContainer>
                            </CardContent>
                          </Card>
                        )} */}

                        {performanceData.topOperators && performanceData.topOperators.length > 0 && (
                          <Card className="rounded-2xl border border-slate-200/50 shadow-md hover:shadow-lg transition-shadow duration-300 bg-white/80 backdrop-blur-sm overflow-hidden">
                            <CardHeader className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-b border-slate-100">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-sm">
                                  <Users className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                  <CardTitle className="text-lg font-semibold text-slate-800">Top Performing Operators</CardTitle>
                                  <CardDescription className="text-slate-500">Operators with most resolved grievances</CardDescription>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="pt-6">
                              <ResponsiveContainer width="100%" height={300}>
                                <BarChart 
                                  data={performanceData.topOperators.map((op: any) => ({
                                    ...op,
                                    displayName: op.userName 
                                      ? (op.userName.length > 15 ? op.userName.substring(0, 15) + '...' : op.userName)
                                      : 'Unknown'
                                  }))} 
                                  margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                  <XAxis 
                                    dataKey="displayName" 
                                    angle={-45} 
                                    textAnchor="end" 
                                    height={80}
                                    tick={{ fontSize: 11, fill: '#64748b' }}
                                    interval={0}
                                  />
                                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                                  <Tooltip 
                                    content={({ active, payload }) => {
                                      if (active && payload && payload.length) {
                                        const data = payload[0].payload;
                                        return (
                                          <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
                                            <p className="font-semibold text-slate-800">{data.userName || 'Unknown'}</p>
                                            <p className="text-sm text-blue-600 font-medium">Resolved: {data.resolved}</p>
                                          </div>
                                        );
                                      }
                                      return null;
                                    }}
                                  />
                                  <Bar dataKey="resolved" fill="url(#blueGradient)" radius={[4, 4, 0, 0]}>
                                    <defs>
                                      <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#3b82f6" />
                                        <stop offset="100%" stopColor="#6366f1" />
                                      </linearGradient>
                                    </defs>
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    )}

                    {/* Category Distribution */}
                    {categoryData && categoryData.length > 0 && (
                      <Card className="rounded-2xl border border-slate-200/50 shadow-md hover:shadow-lg transition-shadow duration-300 bg-white/80 backdrop-blur-sm overflow-hidden">
                        <CardHeader className="bg-gradient-to-r from-purple-50 via-fuchsia-50 to-pink-50 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-fuchsia-500 flex items-center justify-center shadow-sm">
                              <Building className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold text-slate-800">Grievance Distribution by Category</CardTitle>
                              <CardDescription className="text-slate-500">Breakdown of grievances by department</CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-6">
                          <ResponsiveContainer width="100%" height={350}>
                            <BarChart 
                              data={categoryData.map((item: any) => {
                                const cleanName = item.category 
                                  ? item.category.replace(/\s+Department$/i, '').replace(/\s+Dept\.?$/i, '').trim() 
                                  : 'Unknown';
                                return {
                                  ...item,
                                  category: cleanName,
                                  shortName: cleanName.length > 12 ? cleanName.substring(0, 10) + '...' : cleanName
                                };
                              })}
                              margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                              <XAxis 
                                dataKey="shortName" 
                                angle={-55} 
                                textAnchor="end" 
                                height={100}
                                interval={0}
                                tick={{ fontSize: 10, fill: '#64748b' }}
                              />
                              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                              <Tooltip 
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (
                                      <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200 min-w-[150px]">
                                        <p className="font-semibold text-slate-800 mb-2 border-b border-slate-100 pb-1">{data.category}</p>
                                        <div className="space-y-1">
                                          <p className="text-sm flex justify-between">
                                            <span className="text-purple-600">Total:</span> 
                                            <span className="font-medium">{data.count}</span>
                                          </p>
                                          <p className="text-sm flex justify-between">
                                            <span className="text-emerald-600">Resolved:</span> 
                                            <span className="font-medium">{data.resolved}</span>
                                          </p>
                                        </div>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Legend 
                                verticalAlign="top" 
                                height={36}
                                wrapperStyle={{ paddingBottom: '10px' }}
                              />
                              <Bar dataKey="count" fill="url(#purpleGradient)" name="Total" radius={[4, 4, 0, 0]}>
                                <defs>
                                  <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#8b5cf6" />
                                    <stop offset="100%" stopColor="#a855f7" />
                                  </linearGradient>
                                </defs>
                              </Bar>
                              <Bar dataKey="resolved" fill="url(#greenGradient)" name="Resolved" radius={[4, 4, 0, 0]}>
                                <defs>
                                  <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#10b981" />
                                    <stop offset="100%" stopColor="#34d399" />
                                  </linearGradient>
                                </defs>
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    )}

                    {/* Summary Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card className="bg-gradient-to-br from-slate-50 to-blue-50 border-slate-200 shadow-lg">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-xl font-bold bg-gradient-to-r from-slate-700 to-blue-700 bg-clip-text text-transparent flex items-center gap-2">
                            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Grievance Summary
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm border border-slate-100">
                              <span className="text-slate-700 font-medium">Total Grievances:</span>
                              <span className="font-bold text-2xl text-slate-800">{stats.grievances.total}</span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3">
                              <div className="flex flex-col p-3 bg-gradient-to-br from-yellow-50 to-amber-50 rounded-lg border border-yellow-200">
                                <span className="text-xs font-semibold text-yellow-700 mb-1">Pending:</span>
                                <span className="font-bold text-xl text-yellow-800">{stats.grievances.pending}</span>
                              </div>
                              
                              <div className="flex flex-col p-3 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
                                <span className="text-xs font-semibold text-blue-700 mb-1">In Progress:</span>
                                <span className="font-bold text-xl text-blue-800">{stats.grievances.inProgress}</span>
                              </div>
                              
                              <div className="flex flex-col p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
                                <span className="text-xs font-semibold text-green-700 mb-1">Resolved:</span>
                                <span className="font-bold text-xl text-green-800">{stats.grievances.resolved}</span>
                              </div>
                              
                              {stats.grievances.closed !== undefined && (
                                <div className="flex flex-col p-3 bg-gradient-to-br from-gray-50 to-slate-50 rounded-lg border border-gray-200">
                                  <span className="text-xs font-semibold text-gray-700 mb-1">Closed:</span>
                                  <span className="font-bold text-xl text-gray-800">{stats.grievances.closed}</span>
                                </div>
                              )}
                            </div>
                            
                            <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
                              <div className="flex justify-between items-center p-2 bg-white rounded-md">
                                <span className="text-sm text-slate-600 flex items-center gap-1">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  Last 30 Days:
                                </span>
                                <span className="font-bold text-slate-800">{stats.grievances.last30Days}</span>
                              </div>
                              {stats.grievances.avgResolutionDays !== undefined && (
                                <div className="flex justify-between items-center p-2 bg-white rounded-md">
                                  <span className="text-sm text-slate-600 flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Avg Resolution:
                                  </span>
                                  <span className="font-bold text-slate-800">{stats.grievances.avgResolutionDays} days</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-gradient-to-br from-slate-50 to-purple-50 border-slate-200 shadow-lg">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-xl font-bold bg-gradient-to-r from-slate-700 to-purple-700 bg-clip-text text-transparent flex items-center gap-2">
                            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Appointment Summary
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm border border-slate-100">
                              <span className="text-slate-700 font-medium">Total Appointments:</span>
                              <span className="font-bold text-2xl text-slate-800">{stats.appointments.total}</span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3">
                              <div className="flex flex-col p-3 bg-gradient-to-br from-yellow-50 to-amber-50 rounded-lg border border-yellow-200">
                                <span className="text-xs font-semibold text-yellow-700 mb-1">Pending:</span>
                                <span className="font-bold text-xl text-yellow-800">{stats.appointments.pending}</span>
                              </div>
                              
                              <div className="flex flex-col p-3 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
                                <span className="text-xs font-semibold text-blue-700 mb-1">Confirmed:</span>
                                <span className="font-bold text-xl text-blue-800">{stats.appointments.confirmed}</span>
                              </div>
                              
                              <div className="flex flex-col p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
                                <span className="text-xs font-semibold text-green-700 mb-1">Completed:</span>
                                <span className="font-bold text-xl text-green-800">{stats.appointments.completed}</span>
                              </div>
                              
                              {stats.appointments.cancelled !== undefined && (
                                <div className="flex flex-col p-3 bg-gradient-to-br from-red-50 to-rose-50 rounded-lg border border-red-200">
                                  <span className="text-xs font-semibold text-red-700 mb-1">Cancelled:</span>
                                  <span className="font-bold text-xl text-red-800">{stats.appointments.cancelled}</span>
                                </div>
                              )}
                            </div>
                            
                            <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
                              <div className="flex justify-between items-center p-2 bg-white rounded-md">
                                <span className="text-sm text-slate-600 flex items-center gap-1">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  Last 30 Days:
                                </span>
                                <span className="font-bold text-slate-800">{stats.appointments.last30Days}</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No analytics data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Profile Tab - For Operators */}
          {isOperator && (
            <>
            <TabsContent value="profile" className="space-y-6">
              <Card className="rounded-2xl border-0 shadow-xl overflow-hidden bg-white/80 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white px-6 py-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm shadow-lg">
                        <UserIcon className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-2xl font-bold text-white">My Profile</CardTitle>
                        <CardDescription className="text-white/80 mt-0.5">View your profile information and performance statistics</CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Profile Information Card */}
                    <div className="lg:col-span-1">
                      <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 rounded-2xl p-6 border border-indigo-100 shadow-lg">
                        <div className="flex flex-col items-center text-center">
                          <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl mb-4">
                            <span className="text-3xl font-bold text-white">
                              {user?.firstName?.[0]}{user?.lastName?.[0]}
                            </span>
                          </div>
                          <h3 className="text-xl font-bold text-gray-900 mb-1">
                            {user?.firstName} {user?.lastName}
                          </h3>
                          <span className="px-3 py-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-bold rounded-full uppercase tracking-wide mb-4">
                            {user?.role?.replace('_', ' ')}
                          </span>
                          
                          <div className="w-full space-y-3 mt-4 text-left">
                            <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                <Mail className="w-5 h-5 text-blue-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Email</p>
                                <p className="text-sm font-medium text-gray-900 truncate">{user?.email}</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                <Phone className="w-5 h-5 text-green-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Phone</p>
                                <p className="text-sm font-medium text-gray-900">{user?.phone || 'Not provided'}</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                <Building className="w-5 h-5 text-purple-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Department</p>
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {typeof user?.departmentId === 'object' && user?.departmentId 
                                    ? (user.departmentId as any).name 
                                    : departments.find(d => d._id === user?.departmentId)?.name || 'Not assigned'}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                                <Shield className="w-5 h-5 text-amber-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">User ID</p>
                                <p className="text-xs font-mono text-gray-600 truncate">{user?.id}</p>
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
                            <p className="text-sm font-medium text-white/80">Assigned Grievances</p>
                            <p className="text-3xl font-black mt-1">
                              {grievances.filter(g => {
                                const assignedId = typeof g.assignedTo === 'object' && g.assignedTo ? (g.assignedTo as any)._id : g.assignedTo;
                                return assignedId === user?.id;
                              }).length}
                            </p>
                          </div>
                        </div>
                        
                        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 via-green-500 to-teal-500 rounded-2xl p-5 text-white shadow-lg">
                          <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
                          <div className="relative z-10">
                            <p className="text-sm font-medium text-white/80">Resolved Grievances</p>
                            <p className="text-3xl font-black mt-1">
                              {grievances.filter(g => {
                                const assignedId = typeof g.assignedTo === 'object' && g.assignedTo ? (g.assignedTo as any)._id : g.assignedTo;
                                return assignedId === user?.id && g.status === 'RESOLVED';
                              }).length}
                            </p>
                          </div>
                        </div>
                        
                        <div className="relative overflow-hidden bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-500 rounded-2xl p-5 text-white shadow-lg">
                          <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
                          <div className="relative z-10">
                            <p className="text-sm font-medium text-white/80">Assigned Appointments</p>
                            <p className="text-3xl font-black mt-1">
                              {appointments.filter(a => {
                                const assignedId = typeof a.assignedTo === 'object' && a.assignedTo ? (a.assignedTo as any)._id : a.assignedTo;
                                return assignedId === user?.id;
                              }).length}
                            </p>
                          </div>
                        </div>
                        
                        <div className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 rounded-2xl p-5 text-white shadow-lg">
                          <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
                          <div className="relative z-10">
                            <p className="text-sm font-medium text-white/80">Completed Appointments</p>
                            <p className="text-3xl font-black mt-1">
                              {appointments.filter(a => {
                                const assignedId = typeof a.assignedTo === 'object' && a.assignedTo ? (a.assignedTo as any)._id : a.assignedTo;
                                return assignedId === user?.id && a.status === 'COMPLETED';
                              }).length}
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
                            <h4 className="text-lg font-bold text-gray-900">Grievances Breakdown</h4>
                          </div>
                          
                          <div className="space-y-3">
                            {(() => {
                              const myGrievances = grievances.filter(g => {
                                const assignedId = typeof g.assignedTo === 'object' && g.assignedTo ? (g.assignedTo as any)._id : g.assignedTo;
                                return assignedId === user?.id;
                              });
                              const pending = myGrievances.filter(g => g.status === 'PENDING').length;
                              const assigned = myGrievances.filter(g => g.status === 'ASSIGNED').length;
                              const resolved = myGrievances.filter(g => g.status === 'RESOLVED').length;
                              const total = myGrievances.length;
                              
                              return (
                                <>
                                  <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-gray-100">
                                    <span className="text-sm text-gray-600 flex items-center gap-2">
                                      <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                                      Pending
                                    </span>
                                    <span className="font-bold text-gray-900">{pending}</span>
                                  </div>
                                  <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-gray-100">
                                    <span className="text-sm text-gray-600 flex items-center gap-2">
                                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                      In Progress
                                    </span>
                                    <span className="font-bold text-gray-900">{assigned}</span>
                                  </div>
                                  <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-gray-100">
                                    <span className="text-sm text-gray-600 flex items-center gap-2">
                                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                      Resolved
                                    </span>
                                    <span className="font-bold text-gray-900">{resolved}</span>
                                  </div>
                                  <div className="flex justify-between items-center p-3 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl text-white mt-2">
                                    <span className="text-sm font-medium">Resolution Rate</span>
                                    <span className="font-bold text-lg">
                                      {total > 0 ? ((resolved / total) * 100).toFixed(1) : '0.0'}%
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
                            <h4 className="text-lg font-bold text-gray-900">Appointments Breakdown</h4>
                          </div>
                          
                          <div className="space-y-3">
                            {(() => {
                              const myAppointments = appointments.filter(a => {
                                const assignedId = typeof a.assignedTo === 'object' && a.assignedTo ? (a.assignedTo as any)._id : a.assignedTo;
                                return assignedId === user?.id;
                              });
                              const scheduled = myAppointments.filter(a => a.status === 'SCHEDULED').length;
                              const completed = myAppointments.filter(a => a.status === 'COMPLETED').length;
                              const cancelled = myAppointments.filter(a => a.status === 'CANCELLED').length;
                              const total = myAppointments.length;
                              
                              return (
                                <>
                                  <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-gray-100">
                                    <span className="text-sm text-gray-600 flex items-center gap-2">
                                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                      Scheduled
                                    </span>
                                    <span className="font-bold text-gray-900">{scheduled}</span>
                                  </div>
                                  <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-gray-100">
                                    <span className="text-sm text-gray-600 flex items-center gap-2">
                                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                      Completed
                                    </span>
                                    <span className="font-bold text-gray-900">{completed}</span>
                                  </div>
                                  <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-gray-100">
                                    <span className="text-sm text-gray-600 flex items-center gap-2">
                                      <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                                      Cancelled
                                    </span>
                                    <span className="font-bold text-gray-900">{cancelled}</span>
                                  </div>
                                  <div className="flex justify-between items-center p-3 bg-gradient-to-r from-purple-500 to-fuchsia-500 rounded-xl text-white mt-2">
                                    <span className="text-sm font-medium">Completion Rate</span>
                                    <span className="font-bold text-lg">
                                      {total > 0 ? ((completed / total) * 100).toFixed(1) : '0.0'}%
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
                            const myGrievances = grievances.filter(g => {
                              const assignedId = typeof g.assignedTo === 'object' && g.assignedTo ? (g.assignedTo as any)._id : g.assignedTo;
                              return assignedId === user?.id;
                            });
                            const myAppointments = appointments.filter(a => {
                              const assignedId = typeof a.assignedTo === 'object' && a.assignedTo ? (a.assignedTo as any)._id : a.assignedTo;
                              return assignedId === user?.id;
                            });
                            const totalTasks = myGrievances.length + myAppointments.length;
                            const completedTasks = myGrievances.filter(g => g.status === 'RESOLVED').length + 
                                                   myAppointments.filter(a => a.status === 'COMPLETED').length;
                            const pendingTasks = totalTasks - completedTasks - myAppointments.filter(a => a.status === 'CANCELLED').length;
                            
                            return (
                              <>
                                <div className="text-center p-4 bg-white rounded-xl border border-gray-100">
                                  <p className="text-3xl font-black text-indigo-600">{totalTasks}</p>
                                  <p className="text-xs font-medium text-gray-500 uppercase mt-1">Total Tasks</p>
                                </div>
                                <div className="text-center p-4 bg-white rounded-xl border border-gray-100">
                                  <p className="text-3xl font-black text-emerald-600">{completedTasks}</p>
                                  <p className="text-xs font-medium text-gray-500 uppercase mt-1">Completed</p>
                                </div>
                                <div className="text-center p-4 bg-white rounded-xl border border-gray-100">
                                  <p className="text-3xl font-black text-amber-600">{pendingTasks}</p>
                                  <p className="text-xs font-medium text-gray-500 uppercase mt-1">Pending</p>
                                </div>
                                <div className="text-center p-4 bg-white rounded-xl border border-gray-100">
                                  <p className="text-3xl font-black text-purple-600">
                                    {totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(0) : '0'}%
                                  </p>
                                  <p className="text-xs font-medium text-gray-500 uppercase mt-1">Efficiency</p>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* My Analytics Tab - For Operators */}
            <TabsContent value="my-analytics" className="space-y-6">
              <Card className="rounded-2xl border-0 shadow-xl overflow-hidden bg-white/80 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 text-white px-6 py-5">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm shadow-lg">
                      <TrendingUp className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold text-white">My Analytics</CardTitle>
                      <CardDescription className="text-violet-100 mt-0.5">View your personal performance metrics and statistics</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  {(() => {
                    // Calculate operator's personal stats
                    const myGrievances = grievances.filter(g => {
                      const assignedId = typeof g.assignedTo === 'object' && g.assignedTo ? (g.assignedTo as any)._id : g.assignedTo;
                      return assignedId === user?.id;
                    });
                    const myAppointments = appointments.filter(a => {
                      const assignedId = typeof a.assignedTo === 'object' && a.assignedTo ? (a.assignedTo as any)._id : a.assignedTo;
                      return assignedId === user?.id;
                    });
                    
                    const grievancesPending = myGrievances.filter(g => g.status === 'PENDING').length;
                    const grievancesAssigned = myGrievances.filter(g => g.status === 'ASSIGNED').length;
                    const grievancesResolved = myGrievances.filter(g => g.status === 'RESOLVED').length;
                    
                    const appointmentsScheduled = myAppointments.filter(a => a.status === 'SCHEDULED').length;
                    const appointmentsCompleted = myAppointments.filter(a => a.status === 'COMPLETED').length;
                    const appointmentsCancelled = myAppointments.filter(a => a.status === 'CANCELLED').length;
                    
                    const grievanceResolutionRate = myGrievances.length > 0 ? ((grievancesResolved / myGrievances.length) * 100) : 0;
                    const appointmentCompletionRate = myAppointments.length > 0 ? ((appointmentsCompleted / myAppointments.length) * 100) : 0;
                    
                    // Data for pie charts
                    const grievanceStatusData = [
                      { name: 'Pending', value: grievancesPending, color: '#FFBB28' },
                      { name: 'In Progress', value: grievancesAssigned, color: '#0088FE' },
                      { name: 'Resolved', value: grievancesResolved, color: '#00C49F' }
                    ].filter(d => d.value > 0);
                    
                    const appointmentStatusData = [
                      { name: 'Scheduled', value: appointmentsScheduled, color: '#0088FE' },
                      { name: 'Completed', value: appointmentsCompleted, color: '#00C49F' },
                      { name: 'Cancelled', value: appointmentsCancelled, color: '#FF8042' }
                    ].filter(d => d.value > 0);
                    
                    return (
                      <div className="space-y-8">
                        {/* Performance Metrics */}
                        <div>
                          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-purple-600" />
                            Performance Metrics
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                            <div className="relative overflow-hidden bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 rounded-2xl p-5 text-white shadow-lg">
                              <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
                              <div className="relative z-10">
                                <div className="flex items-center justify-between mb-3">
                                  <p className="text-sm font-semibold text-white/90">Total Grievances</p>
                                  <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-white" />
                                  </div>
                                </div>
                                <p className="text-4xl font-black">{myGrievances.length}</p>
                                <p className="text-sm text-white/80 mt-2">{grievancesResolved} resolved</p>
                              </div>
                            </div>
                            
                            <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 via-green-500 to-teal-500 rounded-2xl p-5 text-white shadow-lg">
                              <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
                              <div className="relative z-10">
                                <div className="flex items-center justify-between mb-3">
                                  <p className="text-sm font-semibold text-white/90">Resolution Rate</p>
                                  <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                                    <CheckCircle className="w-5 h-5 text-white" />
                                  </div>
                                </div>
                                <p className="text-4xl font-black">{grievanceResolutionRate.toFixed(1)}%</p>
                                <p className="text-sm text-white/80 mt-2">Grievances resolved</p>
                              </div>
                            </div>
                            
                            <div className="relative overflow-hidden bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-500 rounded-2xl p-5 text-white shadow-lg">
                              <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
                              <div className="relative z-10">
                                <div className="flex items-center justify-between mb-3">
                                  <p className="text-sm font-semibold text-white/90">Total Appointments</p>
                                  <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                                    <CalendarClock className="w-5 h-5 text-white" />
                                  </div>
                                </div>
                                <p className="text-4xl font-black">{myAppointments.length}</p>
                                <p className="text-sm text-white/80 mt-2">{appointmentsCompleted} completed</p>
                              </div>
                            </div>
                            
                            <div className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 rounded-2xl p-5 text-white shadow-lg">
                              <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
                              <div className="relative z-10">
                                <div className="flex items-center justify-between mb-3">
                                  <p className="text-sm font-semibold text-white/90">Completion Rate</p>
                                  <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                                    <CalendarCheck className="w-5 h-5 text-white" />
                                  </div>
                                </div>
                                <p className="text-4xl font-black">{appointmentCompletionRate.toFixed(1)}%</p>
                                <p className="text-sm text-white/80 mt-2">Appointments completed</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Status Distribution Charts */}
                        <div>
                          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <PieChartIcon className="w-5 h-5 text-purple-600" />
                            Status Distribution
                          </h3>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Grievance Status Chart */}
                            <Card className="rounded-2xl border border-slate-200/50 shadow-md bg-white/80 backdrop-blur-sm overflow-hidden">
                              <CardHeader className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-b border-slate-100 px-5 py-4">
                                <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                                  <FileText className="w-5 h-5 text-blue-600" />
                                  My Grievances by Status
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="p-5">
                                {myGrievances.length > 0 ? (
                                  <ResponsiveContainer width="100%" height={250}>
                                    <PieChart>
                                      <Pie
                                        data={grievanceStatusData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={90}
                                        fill="#8884d8"
                                        paddingAngle={5}
                                        dataKey="value"
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                      >
                                        {grievanceStatusData.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                      </Pie>
                                      <Tooltip />
                                      <Legend />
                                    </PieChart>
                                  </ResponsiveContainer>
                                ) : (
                                  <div className="flex flex-col items-center justify-center h-[250px] text-gray-400">
                                    <FileText className="w-12 h-12 mb-2" />
                                    <p>No grievances assigned yet</p>
                                  </div>
                                )}
                              </CardContent>
                            </Card>

                            {/* Appointment Status Chart */}
                            <Card className="rounded-2xl border border-slate-200/50 shadow-md bg-white/80 backdrop-blur-sm overflow-hidden">
                              <CardHeader className="bg-gradient-to-r from-purple-50 via-fuchsia-50 to-pink-50 border-b border-slate-100 px-5 py-4">
                                <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                                  <CalendarClock className="w-5 h-5 text-purple-600" />
                                  My Appointments by Status
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="p-5">
                                {myAppointments.length > 0 ? (
                                  <ResponsiveContainer width="100%" height={250}>
                                    <PieChart>
                                      <Pie
                                        data={appointmentStatusData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={90}
                                        fill="#8884d8"
                                        paddingAngle={5}
                                        dataKey="value"
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                      >
                                        {appointmentStatusData.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                      </Pie>
                                      <Tooltip />
                                      <Legend />
                                    </PieChart>
                                  </ResponsiveContainer>
                                ) : (
                                  <div className="flex flex-col items-center justify-center h-[250px] text-gray-400">
                                    <CalendarClock className="w-12 h-12 mb-2" />
                                    <p>No appointments assigned yet</p>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          </div>
                        </div>

                        {/* Detailed Stats Cards */}
                        <div>
                          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <BarChart2 className="w-5 h-5 text-purple-600" />
                            Detailed Statistics
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Grievances Details */}
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-100 shadow-lg">
                              <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-md">
                                  <FileText className="w-5 h-5 text-white" />
                                </div>
                                <h4 className="text-lg font-bold text-gray-900">Grievances Summary</h4>
                              </div>
                              
                              <div className="space-y-3">
                                <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-gray-100">
                                  <span className="text-sm text-gray-600 flex items-center gap-2">
                                    <span className="w-3 h-3 bg-yellow-400 rounded-full"></span>
                                    Pending
                                  </span>
                                  <span className="font-bold text-lg text-gray-900">{grievancesPending}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-gray-100">
                                  <span className="text-sm text-gray-600 flex items-center gap-2">
                                    <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                                    In Progress
                                  </span>
                                  <span className="font-bold text-lg text-gray-900">{grievancesAssigned}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-gray-100">
                                  <span className="text-sm text-gray-600 flex items-center gap-2">
                                    <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                                    Resolved
                                  </span>
                                  <span className="font-bold text-lg text-gray-900">{grievancesResolved}</span>
                                </div>
                                <div className="flex justify-between items-center p-4 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl text-white mt-2">
                                  <span className="text-sm font-semibold">Total Assigned</span>
                                  <span className="font-bold text-2xl">{myGrievances.length}</span>
                                </div>
                              </div>
                            </div>

                            {/* Appointments Details */}
                            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-5 border border-purple-100 shadow-lg">
                              <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center shadow-md">
                                  <CalendarClock className="w-5 h-5 text-white" />
                                </div>
                                <h4 className="text-lg font-bold text-gray-900">Appointments Summary</h4>
                              </div>
                              
                              <div className="space-y-3">
                                <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-gray-100">
                                  <span className="text-sm text-gray-600 flex items-center gap-2">
                                    <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                                    Scheduled
                                  </span>
                                  <span className="font-bold text-lg text-gray-900">{appointmentsScheduled}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-gray-100">
                                  <span className="text-sm text-gray-600 flex items-center gap-2">
                                    <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                                    Completed
                                  </span>
                                  <span className="font-bold text-lg text-gray-900">{appointmentsCompleted}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-gray-100">
                                  <span className="text-sm text-gray-600 flex items-center gap-2">
                                    <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                                    Cancelled
                                  </span>
                                  <span className="font-bold text-lg text-gray-900">{appointmentsCancelled}</span>
                                </div>
                                <div className="flex justify-between items-center p-4 bg-gradient-to-r from-purple-500 to-fuchsia-500 rounded-xl text-white mt-2">
                                  <span className="text-sm font-semibold">Total Assigned</span>
                                  <span className="font-bold text-2xl">{myAppointments.length}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Overall Performance Card */}
                        <div className="bg-gradient-to-r from-slate-50 via-gray-50 to-slate-50 rounded-2xl p-6 border border-slate-200 shadow-lg">
                          <h4 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
                            <Target className="w-5 h-5 text-indigo-600" />
                            Overall Performance
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div className="text-center p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                              <p className="text-3xl font-black text-indigo-600">{myGrievances.length + myAppointments.length}</p>
                              <p className="text-xs font-semibold text-gray-500 uppercase mt-1">Total Tasks</p>
                            </div>
                            <div className="text-center p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                              <p className="text-3xl font-black text-emerald-600">{grievancesResolved + appointmentsCompleted}</p>
                              <p className="text-xs font-semibold text-gray-500 uppercase mt-1">Completed</p>
                            </div>
                            <div className="text-center p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                              <p className="text-3xl font-black text-amber-600">{grievancesPending + grievancesAssigned + appointmentsScheduled}</p>
                              <p className="text-xs font-semibold text-gray-500 uppercase mt-1">In Progress</p>
                            </div>
                            <div className="text-center p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                              <p className="text-3xl font-black text-red-600">{appointmentsCancelled}</p>
                              <p className="text-xs font-semibold text-gray-500 uppercase mt-1">Cancelled</p>
                            </div>
                            <div className="text-center p-4 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl shadow-sm">
                              <p className="text-3xl font-black text-white">
                                {(myGrievances.length + myAppointments.length) > 0 
                                  ? (((grievancesResolved + appointmentsCompleted) / (myGrievances.length + myAppointments.length)) * 100).toFixed(0)
                                  : '0'}%
                              </p>
                              <p className="text-xs font-semibold text-white/80 uppercase mt-1">Efficiency</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </TabsContent>
            </>
          )}
        </Tabs>

        {/* Dialogs */}
        {(isCompanyAdmin || isDepartmentAdmin) && (
          <>
            {isCompanyAdmin && (
              <CreateDepartmentDialog
                isOpen={showDepartmentDialog}
                onClose={() => {
                  setShowDepartmentDialog(false);
                  setEditingDepartment(null);
                }}
                onDepartmentCreated={() => {
                  fetchDepartments();
                  fetchDashboardData();
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
              onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
              variant={confirmDialog.variant}
            />
            <CreateUserDialog
              isOpen={showUserDialog}
              onClose={() => setShowUserDialog(false)}
              onUserCreated={() => {
                fetchUsers();
                fetchDashboardData();
              }}
            />
            <EditUserDialog
              isOpen={showEditUserDialog}
              onClose={() => {
                setShowEditUserDialog(false);
                setEditingUser(null);
              }}
              onUserUpdated={() => {
                fetchUsers();
                fetchDashboardData();
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
                fetchUsers();
                fetchDashboardData();
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

        {/* Assignment Dialogs */}
        {selectedGrievanceForAssignment && user?.companyId && (
          <AssignmentDialog
            isOpen={showGrievanceAssignment}
            onClose={() => {
              setShowGrievanceAssignment(false);
              setSelectedGrievanceForAssignment(null);
            }}
            onAssign={async (userId: string, departmentId?: string) => {
              await grievanceAPI.assign(selectedGrievanceForAssignment._id, userId, departmentId);
              await fetchGrievances();
              await fetchDashboardData();
            }}
            itemType="grievance"
            itemId={selectedGrievanceForAssignment._id}
            companyId={typeof user.companyId === 'object' && user.companyId !== null ? user.companyId._id : user.companyId || ''}
            currentAssignee={selectedGrievanceForAssignment.assignedTo}
            currentDepartmentId={
              selectedGrievanceForAssignment.departmentId && typeof selectedGrievanceForAssignment.departmentId === 'object' 
                ? selectedGrievanceForAssignment.departmentId._id 
                : selectedGrievanceForAssignment.departmentId
            }
            userRole={user.role}
            userDepartmentId={typeof user.departmentId === 'object' && user.departmentId !== null ? user.departmentId._id : user.departmentId}
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
              await appointmentAPI.assign(selectedAppointmentForAssignment._id, userId, departmentId);
              await fetchAppointments();
              await fetchDashboardData();
            }}
            itemType="appointment"
            itemId={selectedAppointmentForAssignment._id}
            companyId={typeof user.companyId === 'object' && user.companyId !== null ? user.companyId._id : user.companyId || ''}
            currentAssignee={selectedAppointmentForAssignment.assignedTo}
            currentDepartmentId={
              selectedAppointmentForAssignment.departmentId && typeof selectedAppointmentForAssignment.departmentId === 'object' 
                ? selectedAppointmentForAssignment.departmentId._id 
                : selectedAppointmentForAssignment.departmentId
            }
            userRole={user.role}
            userDepartmentId={typeof user.departmentId === 'object' && user.departmentId !== null ? user.departmentId._id : user.departmentId}
            currentUserId={user.id}
          />
        )}

        {/* User Details Dialog */}
        <UserDetailsDialog
          isOpen={showUserDetailsDialog}
          onClose={() => {
            setShowUserDetailsDialog(false);
            setSelectedUserForDetails(null);
          }}
          user={selectedUserForDetails}
        />

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
          departmentId={user?.role === 'DEPARTMENT_ADMIN' && user?.departmentId 
            ? (typeof user.departmentId === 'object' ? user.departmentId._id : user.departmentId) 
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
          itemId={selectedAppointmentForStatus?._id || ''}
          itemType="appointment"
          currentStatus={selectedAppointmentForStatus?.status || ''}
          onSuccess={() => {
            fetchAppointments();
            fetchDashboardData();
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
          itemId={selectedGrievanceForStatus?._id || ''}
          itemType="grievance"
          currentStatus={selectedGrievanceForStatus?.status || ''}
          onSuccess={() => {
            fetchGrievances();
            fetchDashboardData();
          }}
          grievanceVariant={user?.role === 'OPERATOR' ? 'operator' : 'department-admin'}
        />
      </main>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>}>
      <DashboardContent />
    </Suspense>
  );
}
