'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { appointmentAPI, Appointment } from '@/lib/api/appointment';
import { departmentAPI, Department } from '@/lib/api/department';
import { Calendar, Phone, Filter, Search, Eye, Clock, CheckCircle, ArrowLeft, ArrowUpDown } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import AppointmentDetailDialog from '@/components/appointment/AppointmentDetailDialog';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function CompletedAppointmentsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [filters, setFilters] = useState({
    department: 'all',
    dateRange: 'all', // all, today, week, month
    search: ''
  });
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | null }>({ key: '', direction: null });

  // Extract companyId from user
  const companyId = typeof user?.companyId === 'object' ? (user.companyId as any)._id : user?.companyId || '';

  // Restrict access to Company Admin only
  useEffect(() => {
    if (!authLoading && user && user.role !== 'COMPANY_ADMIN') {
      toast.error('Access denied. Completed appointments are only available for Company Admins.');
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && user.role === 'COMPANY_ADMIN') {
      fetchAppointments();
      fetchDepartments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const response = await appointmentAPI.getAll();
      if (response.success) {
        // Filter only completed appointments
        const completedAppointments = response.data.appointments.filter(
          (a: Appointment) => a.status === 'COMPLETED'
        );
        setAppointments(completedAppointments);
      }
    } catch (error) {
      toast.error('Failed to load completed appointments');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await departmentAPI.getAll({ companyId });
      if (response.success) {
        setDepartments(response.data.departments);
      }
    } catch (error) {
      console.error('Failed to load departments:', error);
    }
  };

  const handleViewDetails = async (appointment: Appointment) => {
    try {
      const response = await appointmentAPI.getById(appointment._id);
      if (response.success) {
        setSelectedAppointment(response.data.appointment);
        setModalOpen(true);
      }
    } catch (error) {
      toast.error('Failed to load appointment details');
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

  const filteredAppointments = useMemo(() => {
    let filtered = appointments.filter(a => {
      // Filter by department
      if (filters.department !== 'all') {
        const deptId = typeof a.departmentId === 'object' ? (a.departmentId as any)._id : a.departmentId;
        if (deptId !== filters.department) return false;
      }
      
      // Date range filter (based on completed date)
      if (filters.dateRange !== 'all') {
        const completedDate = new Date((a as any).completedAt || a.updatedAt);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        if (filters.dateRange === 'today' && completedDate < today) return false;
        if (filters.dateRange === 'week' && completedDate < weekAgo) return false;
        if (filters.dateRange === 'month' && completedDate < monthAgo) return false;
      }
      
      // Search filter
      if (filters.search && 
          !a.citizenName?.toLowerCase().includes(filters.search.toLowerCase()) &&
          !a.appointmentId?.toLowerCase().includes(filters.search.toLowerCase()) &&
          !a.purpose?.toLowerCase().includes(filters.search.toLowerCase())) return false;
      return true;
    });

    // Apply sorting
    if (sortConfig.key && sortConfig.direction) {
      filtered = [...filtered].sort((a, b) => {
        let aValue: any = a[sortConfig.key as keyof Appointment];
        let bValue: any = b[sortConfig.key as keyof Appointment];

        // Handle nested properties
        if (sortConfig.key === 'appointmentDate') {
          aValue = new Date(a.appointmentDate).getTime();
          bValue = new Date(b.appointmentDate).getTime();
        } else if (sortConfig.key === 'completedAt') {
          aValue = new Date((a as any).completedAt || a.updatedAt).getTime();
          bValue = new Date((b as any).completedAt || b.updatedAt).getTime();
        } else if (sortConfig.key === 'citizenName') {
          aValue = a.citizenName?.toLowerCase() || '';
          bValue = b.citizenName?.toLowerCase() || '';
        } else if (typeof aValue === 'string') {
          aValue = aValue.toLowerCase();
          bValue = bValue?.toLowerCase() || '';
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [appointments, filters, sortConfig]);

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  if (!user || user.role !== 'COMPANY_ADMIN') {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-purple-50/30">
        <div className="text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-10 h-10 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Access Denied</h2>
          <p className="text-slate-600 mb-6">Completed appointments are only available for Company Admins.</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all font-semibold shadow-lg"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      {/* Header with Gradient */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 shadow-xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVHJhbnNmb3JtPSJyb3RhdGUoNDUpIj48cGF0aCBkPSJNLTEwIDMwaDYwdjJoLTYweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNhKSIvPjwvc3ZnPg==')] opacity-30"></div>
        <div className="relative max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm shadow-lg">
                <CheckCircle className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Completed Appointments</h1>
                <p className="text-white/80 mt-0.5">View all completed citizen appointments</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/appointments"
                className="flex items-center gap-2 px-4 py-2.5 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all border border-white/30 backdrop-blur-sm"
              >
                <ArrowLeft className="w-5 h-5" />
                Back to Appointments
              </Link>
              <div className="text-right bg-white/10 px-4 py-2 rounded-xl border border-white/20 backdrop-blur-sm">
                <p className="text-sm text-white/70">Completed</p>
                <p className="text-2xl font-bold text-white">{appointments.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Content Area */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Filters Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/50 shadow-xl p-6 mb-6">
          {/* Filters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative col-span-2 md:col-span-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by name, ID, or purpose..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            {/* Department */}
            <select
              value={filters.department}
              onChange={(e) => setFilters({ ...filters, department: e.target.value })}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="all">All Departments</option>
              {departments.map((dept) => (
                <option key={dept._id} value={dept._id}>
                  {dept.name}
                </option>
              ))}
            </select>

            {/* Date Range */}
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="all">All Time</option>
              <option value="today">📅 Completed Today</option>
              <option value="week">📆 Last 7 Days</option>
              <option value="month">🗓️ Last 30 Days</option>
            </select>

            {/* Reset Button */}
            <button
              onClick={() => setFilters({ department: 'all', dateRange: 'all', search: '' })}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center"
            >
              <Filter className="w-4 h-4 mr-2" />
              Reset Filters
            </button>
          </div>
        </div>

        {/* Appointments Table */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/50 shadow-xl overflow-hidden">
          {loading ? (
            <div className="p-16 text-center">
              <LoadingSpinner size="lg" text="Loading completed appointments..." />
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">No completed appointments found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 border-b border-emerald-100 whitespace-nowrap">
                  <tr>
                    <th className="px-4 py-4 text-center text-xs font-semibold text-emerald-700 uppercase tracking-wide">Sr. No.</th>
                    <th className="px-6 py-4 text-left">
                      <button 
                        onClick={() => handleSort('appointmentId')}
                        className="group flex items-center space-x-1.5 text-xs font-semibold text-emerald-700 uppercase tracking-wide hover:text-emerald-800 transition-colors"
                      >
                        <span>App ID</span>
                        <ArrowUpDown className={`w-3.5 h-3.5 transition-colors ${sortConfig.key === 'appointmentId' ? 'text-emerald-700' : 'text-emerald-300 group-hover:text-emerald-400'}`} />
                      </button>
                    </th>
                    <th className="px-6 py-4 text-left">
                      <button 
                        onClick={() => handleSort('citizenName')}
                        className="group flex items-center space-x-1.5 text-xs font-semibold text-emerald-700 uppercase tracking-wide hover:text-emerald-800 transition-colors"
                      >
                        <span>Citizen Information</span>
                        <ArrowUpDown className={`w-3.5 h-3.5 transition-colors ${sortConfig.key === 'citizenName' ? 'text-emerald-700' : 'text-emerald-300 group-hover:text-emerald-400'}`} />
                      </button>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-emerald-700 uppercase tracking-wide">Department & Purpose</th>
                    <th className="px-6 py-4 text-left">
                      <button 
                        onClick={() => handleSort('appointmentDate')}
                        className="group flex items-center space-x-1.5 text-xs font-semibold text-emerald-700 uppercase tracking-wide hover:text-emerald-800 transition-colors"
                      >
                        <span>Scheduled At</span>
                        <ArrowUpDown className={`w-3.5 h-3.5 transition-colors ${sortConfig.key === 'appointmentDate' ? 'text-emerald-700' : 'text-emerald-300 group-hover:text-emerald-400'}`} />
                      </button>
                    </th>
                    <th className="px-6 py-4 text-left">
                      <button 
                        onClick={() => handleSort('completedAt')}
                        className="group flex items-center space-x-1.5 text-xs font-semibold text-emerald-700 uppercase tracking-wide hover:text-emerald-800 transition-colors"
                      >
                        <span>Completed On</span>
                        <ArrowUpDown className={`w-3.5 h-3.5 transition-colors ${sortConfig.key === 'completedAt' ? 'text-emerald-700' : 'text-emerald-300 group-hover:text-emerald-400'}`} />
                      </button>
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-emerald-700 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredAppointments.map((appointment, index) => {
                    const appointmentDate = new Date(appointment.appointmentDate);
                    const completedDate = (appointment as any).completedAt ? new Date((appointment as any).completedAt) : new Date(appointment.updatedAt);
                    
                    return (
                      <tr key={appointment._id} className="hover:bg-emerald-50/30 transition-colors border-b border-slate-100">
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 text-sm font-bold">
                            {index + 1}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-sm text-emerald-700">{appointment.appointmentId}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <button
                              onClick={() => handleViewDetails(appointment)}
                              className="text-emerald-600 hover:text-emerald-800 font-bold text-left hover:underline"
                            >
                              {appointment.citizenName}
                            </button>
                            <div className="flex items-center text-sm text-gray-500 mt-1">
                              <Phone className="w-3.5 h-3.5 mr-1 text-gray-400" />
                              {appointment.citizenPhone}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col space-y-1">
                            <span className="text-sm font-semibold text-gray-900">
                              CEO - Zilla Parishad Amravati
                            </span>
                            <span className="text-xs text-gray-600 line-clamp-2 max-w-xs">
                              {appointment.purpose || 'No purpose provided'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <div className="flex flex-col items-center">
                                <span className="text-[10px] font-bold text-emerald-600 uppercase">
                                  {appointmentDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                                </span>
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white flex items-center justify-center font-bold text-sm shadow-md">
                                  {appointmentDate.getDate()}
                                </div>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-semibold text-gray-900">
                                  {appointmentDate.toLocaleDateString('en-US', { weekday: 'long' })}
                                </span>
                                <span className="text-xs text-gray-500">{appointmentDate.getFullYear()}</span>
                                <div className="flex items-center gap-1 mt-1">
                                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                                  <span className="text-xs font-medium text-emerald-700">{appointment.appointmentTime}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-gray-900">
                              {completedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                            <span className="text-xs text-gray-500">
                              {completedDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleViewDetails(appointment)}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-700 transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Appointment Detail Dialog */}
      <AppointmentDetailDialog
        isOpen={modalOpen}
        appointment={selectedAppointment}
        onClose={() => {
          setModalOpen(false);
          setSelectedAppointment(null);
        }}
      />
    </div>
  );
}
