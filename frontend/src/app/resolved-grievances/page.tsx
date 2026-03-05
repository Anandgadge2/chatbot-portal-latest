"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../contexts/AuthContext";
import { grievanceAPI, Grievance } from "../../lib/api/grievance";
import { departmentAPI, Department } from "../../lib/api/department";
import {
  FileText,
  MapPin,
  Phone,
  Calendar,
  Filter,
  Search,
  Eye,
  UserPlus,
  CheckCircle,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import CitizenDetailsModal from "../../components/grievance/CitizenDetailsModal";
import AssignmentDialog from "../../components/assignment/AssignmentDialog";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import { formatDate, formatDateTime, formatISTTime } from "../../lib/utils";

export default function ResolvedGrievancesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGrievance, setSelectedGrievance] = useState<Grievance | null>(
    null,
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [grievanceToAssign, setGrievanceToAssign] = useState<Grievance | null>(
    null,
  );
  const [filters, setFilters] = useState({
    department: "all",
    dateRange: "all", // all, today, week, month
    search: "",
  });

  // Extract companyId from user
  const companyId =
    typeof user?.companyId === "object"
      ? (user.companyId as any)._id
      : user?.companyId || "";

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
          (g) => g.status === "RESOLVED",
        );
        setGrievances(resolvedGrievances);
      }
    } catch (error) {
      toast.error("Failed to load grievances");
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
      console.error("Failed to load departments:", error);
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
    .filter((g) => {
      // Filter by department
      if (filters.department !== "all") {
        const deptId =
          typeof g.departmentId === "object"
            ? (g.departmentId as any)._id
            : g.departmentId;
        if (deptId !== filters.department) return false;
      }

      // Date range filter (based on resolved date)
      if (filters.dateRange !== "all") {
        const resolvedDate = new Date(g.resolvedAt || g.updatedAt);
        const now = new Date();
        const today = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
        );
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

        if (filters.dateRange === "today" && resolvedDate < today) return false;
        if (filters.dateRange === "week" && resolvedDate < weekAgo)
          return false;
        if (filters.dateRange === "month" && resolvedDate < monthAgo)
          return false;
      }

      // Search filter
      if (
        filters.search &&
        !g.citizenName?.toLowerCase().includes(filters.search.toLowerCase()) &&
        !g.grievanceId?.toLowerCase().includes(filters.search.toLowerCase())
      )
        return false;
      return true;
    })
    .sort((a, b) => {
      // Sort by resolved/closed date (latest first)
      const dateA = new Date(
        a.resolvedAt || a.closedAt || a.updatedAt,
      ).getTime();
      const dateB = new Date(
        b.resolvedAt || b.closedAt || b.updatedAt,
      ).getTime();
      return dateB - dateA;
    });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "RESOLVED":
        return "bg-green-100 text-green-800 border-green-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header with Dark Slate Theme */}
      <div className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50 shadow-xl overflow-hidden h-24">
        {/* Subtle Background Pattern */}
        <div className="absolute inset-0 bg-white bg-opacity-5">
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          ></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-6 h-full flex flex-col justify-center">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white bg-opacity-10 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white border-opacity-10 shadow-lg">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight uppercase">
                  Resolved Grievances
                </h1>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                  Public Service Resolution System
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="flex items-center gap-2 px-4 py-2.5 bg-white bg-opacity-10 text-white rounded-xl hover:bg-opacity-20 transition-all border border-white border-opacity-20 backdrop-blur-sm text-xs font-bold uppercase"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <div className="text-right bg-white bg-opacity-10 px-4 py-1.5 rounded-xl border border-white border-opacity-10 backdrop-blur-sm">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                  Total Resolved
                </p>
                <p className="text-xl font-black text-white leading-tight">
                  {grievances.length}
                </p>
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
                onChange={(e) =>
                  setFilters({ ...filters, search: e.target.value })
                }
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              />
            </div>

            {/* Department */}
            <select
              value={filters.department}
              onChange={(e) =>
                setFilters({ ...filters, department: e.target.value })
              }
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
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
              onChange={(e) =>
                setFilters({ ...filters, dateRange: e.target.value })
              }
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
            >
              <option value="all">All Time</option>
              <option value="today">📅 Resolved Today</option>
              <option value="week">📆 Last 7 Days</option>
              <option value="month">🗓️ Last 30 Days</option>
            </select>

            {/* Reset Button */}
            <button
              onClick={() =>
                setFilters({ department: "all", dateRange: "all", search: "" })
              }
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
              <LoadingSpinner text="Loading resolved grievances..." />
            </div>
          ) : filteredGrievances.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">
                No resolved grievances found
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200 whitespace-nowrap">
                  <tr>
                    <th className="px-4 py-4 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Sr. No.
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Application No
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Citizen Information
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Department & Category
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Issue Description
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Resolved By
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Resolved On
                    </th>
                    <th className="px-6 py-4 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredGrievances.map((grievance, index) => (
                    <tr
                      key={grievance._id}
                      className="hover:bg-slate-50 transition-colors border-b border-slate-100"
                    >
                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-black">
                          {index + 1}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-indigo-700">
                            {grievance.grievanceId}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <button
                            onClick={() => handleViewDetails(grievance)}
                            className="text-indigo-600 hover:text-indigo-800 font-bold text-left hover:underline"
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
                            {typeof grievance.departmentId === "object"
                              ? (grievance.departmentId as any).name
                              : "General Department"}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-green-50 text-green-600 border border-green-100 w-fit">
                            {grievance.category || "General"}
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
                                {typeof grievance.assignedTo === "object"
                                  ? `${grievance.assignedTo.firstName} ${grievance.assignedTo.lastName}`
                                  : grievance.assignedTo}
                              </span>
                            </div>
                            {grievance.assignedAt && (
                              <span className="text-[10px] text-gray-400 mt-1">
                                Assigned on: {formatDate(grievance.assignedAt)}
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
                        <span
                          className={`px-3 py-1 rounded-full text-[11px] font-bold border uppercase tracking-wider ${getStatusColor(grievance.status)}`}
                        >
                          {grievance.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <div className="flex items-center text-sm font-medium text-gray-900">
                            <Calendar className="w-3.5 h-3.5 mr-1.5 text-green-600" />
                            {formatDate(
                              grievance.resolvedAt ||
                                grievance.closedAt ||
                                grievance.updatedAt,
                            )}
                          </div>
                          <span className="text-[10px] text-gray-400 mt-1">
                            {formatISTTime(
                              grievance.resolvedAt ||
                                grievance.closedAt ||
                                grievance.updatedAt,
                            )}
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
        itemId={grievanceToAssign?._id || ""}
        companyId={companyId}
        currentAssignee={grievanceToAssign?.assignedTo}
      />
    </div>
  );
}
