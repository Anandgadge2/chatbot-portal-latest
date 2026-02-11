'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { grievanceAPI, Grievance } from '../../lib/api/grievance';
import { departmentAPI, Department } from '../../lib/api/department';
import { FileText, MapPin, Phone, Calendar, Filter, Search, Eye, UserPlus, CheckCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import CitizenDetailsModal from '../../components/grievance/CitizenDetailsModal';
import AssignmentDialog from '../../components/assignment/AssignmentDialog';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

export default function ResolvedGrievancesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGrievance, setSelectedGrievance] = useState<Grievance | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [grievanceToAssign, setGrievanceToAssign] = useState<Grievance | null>(null);
  const [filters, setFilters] = useState({
    department: 'all',
    dateRange: 'all', // all, today, week, month
    search: ''
  });

  // Extract companyId from user
  const companyId = typeof user?.companyId === 'object' ? (user.companyId as any)._id : user?.companyId || '';

  useEffect(() => {
    fetchGrievances();
    fetchDepartments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchGrievances = async () => {
    try {
      setLoading(true);
      const response = await grievanceAPI.getAll();
      if (response.success) {
        // Filter only resolved grievances
        const resolvedGrievances = response.data.grievances.filter(
          (g) => g.status === 'RESOLVED'
        );
        setGrievances(resolvedGrievances);
      }
    } catch (error) {
      toast.error('Failed to load grievances');
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

  const handleAssignClick = (grievance: Grievance) => {
    setGrievanceToAssign(grievance);
    setAssignDialogOpen(true);
  };

  const handleAssign = async (userId: string) => {
    if (!grievanceToAssign) return;
    await grievanceAPI.assign(grievanceToAssign._id, userId);
    await fetchGrievances();
  };

  const handleViewDetails = (grievance: Grievance) => {
    setSelectedGrievance(grievance);
    setModalOpen(true);
  };

  const filteredGrievances = grievances
    .filter(g => {
      // Filter by department
      if (filters.department !== 'all') {
        const deptId = typeof g.departmentId === 'object' ? (g.departmentId as any)._id : g.departmentId;
        if (deptId !== filters.department) return false;
      }
      
      // Date range filter (based on resolved date)
      if (filters.dateRange !== 'all') {
        const resolvedDate = new Date(g.resolvedAt || g.updatedAt);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        if (filters.dateRange === 'today' && resolvedDate < today) return false;
        if (filters.dateRange === 'week' && resolvedDate < weekAgo) return false;
        if (filters.dateRange === 'month' && resolvedDate < monthAgo) return false;
      }
      
      // Search filter
      if (filters.search && !g.citizenName?.toLowerCase().includes(filters.search.toLowerCase()) &&
          !g.grievanceId?.toLowerCase().includes(filters.search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      // Sort by resolved/closed date (latest first)
      const dateA = new Date(a.resolvedAt || a.closedAt || a.updatedAt).getTime();
      const dateB = new Date(b.resolvedAt || b.closedAt || b.updatedAt).getTime();
      return dateB - dateA;
    });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RESOLVED': return 'bg-green-100 text-green-800 border-green-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

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
                <h1 className="text-2xl font-bold text-white tracking-tight">Resolved Grievances</h1>
                <p className="text-white/80 mt-0.5">View completed and resolved citizen grievances</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => router.back()}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all border border-white/30 backdrop-blur-sm"
              >
                <ArrowLeft className="w-5 h-5" />
                Back
              </button>
              <div className="text-right bg-white/10 px-4 py-2 rounded-xl border border-white/20 backdrop-blur-sm">
                <p className="text-sm text-white/70">Resolved</p>
                <p className="text-2xl font-bold text-white">{grievances.length}</p>
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
              placeholder="Search by name or ID..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {/* Department */}
          <select
            value={filters.department}
            onChange={(e) => setFilters({ ...filters, department: e.target.value })}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="all">All Time</option>
            <option value="today">📅 Resolved Today</option>
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

      {/* Grievances Table */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/50 shadow-xl overflow-hidden">
        {loading ? (
          <div className="p-16 text-center">
            <LoadingSpinner size="lg" text="Loading resolved grievances..." />
          </div>
        ) : filteredGrievances.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">No resolved grievances found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200 whitespace-nowrap">
                <tr>
                  <th className="px-4 py-4 text-center text-xs font-semibold text-slate-600 uppercase tracking-wide">Sr. No.</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Application No</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Citizen Information</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Department & Category</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Issue Description</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Resolved By</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Resolved On</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredGrievances.map((grievance, index) => (
                  <tr key={grievance._id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100">
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 text-sm font-bold">
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-green-700">{grievance.grievanceId}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <button
                          onClick={() => handleViewDetails(grievance)}
                          className="text-green-600 hover:text-green-800 font-bold text-left hover:underline"
                        >
                          {grievance.citizenName}
                        </button>
                        <div className="flex items-center text-sm text-gray-500 mt-1">
                          <Phone className="w-3.5 h-3.5 mr-1 text-gray-400" />
                          {grievance.citizenPhone}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col space-y-1">
                        <span className="text-sm font-semibold text-gray-900">
                          {typeof grievance.departmentId === 'object' ? (grievance.departmentId as any).name : 'General Department'}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-green-50 text-green-600 border border-green-100 w-fit">
                          {grievance.category || 'General'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-600 line-clamp-2 max-w-xs leading-relaxed">
                        {grievance.description}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      {grievance.assignedTo ? (
                        <div className="flex flex-col">
                          <div className="flex items-center">
                            <UserPlus className="w-3.5 h-3.5 mr-1.5 text-green-600" />
                            <span className="text-sm font-semibold text-gray-900">
                              {typeof grievance.assignedTo === 'object' 
                                ? `${grievance.assignedTo.firstName} ${grievance.assignedTo.lastName}`
                                : grievance.assignedTo}
                            </span>
                          </div>
                          {grievance.assignedAt && (
                            <span className="text-[10px] text-gray-400 mt-1">
                              Assigned on: {new Date(grievance.assignedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center text-xs text-gray-500 font-medium bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                          Not Assigned
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[11px] font-bold border uppercase tracking-wider ${getStatusColor(grievance.status)}`}>
                        {grievance.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <div className="flex items-center text-sm font-medium text-gray-900">
                          <Calendar className="w-3.5 h-3.5 mr-1.5 text-green-600" />
                          {new Date(grievance.resolvedAt || grievance.closedAt || grievance.updatedAt).toLocaleDateString()}
                        </div>
                        <span className="text-[10px] text-gray-400 mt-1">
                          {new Date(grievance.resolvedAt || grievance.closedAt || grievance.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => handleViewDetails(grievance)}
                          title="View Full Details"
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors border border-transparent hover:border-green-200"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>

      {/* Citizen Details Modal */}
      <CitizenDetailsModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedGrievance(null);
        }}
        grievance={selectedGrievance}
      />

      {/* Assignment Dialog */}
      <AssignmentDialog
        isOpen={assignDialogOpen}
        onClose={() => {
          setAssignDialogOpen(false);
          setGrievanceToAssign(null);
        }}
        onAssign={handleAssign}
        itemType="grievance"
        itemId={grievanceToAssign?._id || ''}
        companyId={companyId}
        currentAssignee={grievanceToAssign?.assignedTo}
      />
    </div>
  );
}
