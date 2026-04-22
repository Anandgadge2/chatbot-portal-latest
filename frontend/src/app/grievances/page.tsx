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
  BellRing,
  X,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import CitizenDetailsModal from "../../components/grievance/CitizenDetailsModal";
import AssignmentDialog from "../../components/assignment/AssignmentDialog";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import { formatDate, formatDateTime, formatISTTime } from "../../lib/utils";
import { isCompanyAdminOrHigher } from "@/lib/permissions";

export default function GrievancesPage() {
  const JHARSUGUDA_COMPANY_ID =
    process.env.NEXT_PUBLIC_JHARSUGUDA_COMPANY_ID || "69ad4c6eb1ad8e405e6c0858";
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
    status: "all",
    department: "all",
    assignment: "all", // all, assigned, unassigned
    dateRange: "all", // all, today, week, month
    overdue: "all", // all, overdue, ontrack
    search: "",
  });
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [grievanceForReminder, setGrievanceForReminder] = useState<Grievance | null>(null);
  const [reminderRemarks, setReminderRemarks] = useState("");
  const [sendingReminder, setSendingReminder] = useState(false);

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
      const response = await grievanceAPI.getAll({ limit: 25 });
      if (response.success) {
        setGrievances(response.data.grievances);
      }
    } catch (error) {
      toast.error("Failed to load grievances");
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await departmentAPI.getAll({ companyId, limit: 25 });
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

  const handleAssign = async (userId: string, departmentId?: string, note?: string) => {
    if (!grievanceToAssign) return;
    await grievanceAPI.assign(grievanceToAssign._id, userId, departmentId, note);
    await fetchGrievances();
  };

  const handleViewDetails = (grievance: Grievance) => {
    setSelectedGrievance(grievance);
    setModalOpen(true);
  };

  const isJharsugudaCompany = companyId === JHARSUGUDA_COMPANY_ID;
  const isCompanyAdminUser = isCompanyAdminOrHigher(user) && !user?.departmentId;

  // Helper function to check if grievance is overdue
  const isOverdue = (grievance: Grievance) => {
    const createdDate = new Date(grievance.createdAt);
    const now = new Date();
    const hoursDiff = Math.floor(
      (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60),
    );

    if (grievance.status === "PENDING") {
      return hoursDiff > 24; // PENDING should be assigned within 24h
    } else if (grievance.status === "ASSIGNED" || grievance.status === "IN_PROGRESS") {
      const assignedDate = grievance.assignedAt
        ? new Date(grievance.assignedAt)
        : createdDate;
      const hoursFromAssigned = Math.floor(
        (now.getTime() - assignedDate.getTime()) / (1000 * 60 * 60),
      );
      return hoursFromAssigned > 120; // ASSIGNED should be resolved within 5 days (120h)
    }
    return false;
  };

  const getOverdueDetails = (grievance: Grievance) => {
    const createdDate = new Date(grievance.createdAt);
    const now = new Date();
    const assignedDate = grievance.assignedAt
      ? new Date(grievance.assignedAt)
      : createdDate;
    const baseDate =
      grievance.status === "PENDING" ? createdDate : assignedDate;
    const daysPassed = Math.max(
      1,
      Math.floor((now.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24)),
    );
    const assigneeName =
      grievance.assignedTo && typeof grievance.assignedTo === "object"
        ? `${grievance.assignedTo.firstName} ${grievance.assignedTo.lastName}`.trim()
        : "Not assigned";
    const departmentName =
      typeof grievance.departmentId === "object"
        ? grievance.departmentId.name
        : "General Department";
    const officeName =
      typeof grievance.subDepartmentId === "object"
        ? grievance.subDepartmentId.name
        : "N/A";
    return { createdDate, daysPassed, assigneeName, departmentName, officeName };
  };

  const openReminderDialog = (grievance: Grievance) => {
    setGrievanceForReminder(grievance);
    setReminderRemarks("");
    setReminderDialogOpen(true);
  };

  const handleSendReminder = async () => {
    if (!grievanceForReminder) return;
    if (!reminderRemarks.trim()) {
      toast.error("Please enter remarks before sending reminder");
      return;
    }
    try {
      setSendingReminder(true);
      await grievanceAPI.sendReminder(grievanceForReminder._id, reminderRemarks.trim());
      toast.success("Reminder sent successfully");
      setReminderDialogOpen(false);
      setGrievanceForReminder(null);
      setReminderRemarks("");
      await fetchGrievances();
    } catch (error: any) {
      toast.error(error?.message || "Failed to send reminder");
    } finally {
      setSendingReminder(false);
    }
  };

  const filteredGrievances = grievances
    .filter((g) => {
      // Status filter
      if (filters.status !== "all" && g.status !== filters.status) return false;

      // Department filter
      if (filters.department !== "all") {
        const deptId =
          typeof g.departmentId === "object"
            ? (g.departmentId as any)._id
            : g.departmentId;
        if (deptId !== filters.department) return false;
      }

      // Assignment filter
      if (filters.assignment === "assigned" && !g.assignedTo) return false;
      if (filters.assignment === "unassigned" && g.assignedTo) return false;

      // Date range filter
      if (filters.dateRange !== "all") {
        const createdDate = new Date(g.createdAt);
        const now = new Date();
        const today = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
        );
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

        if (filters.dateRange === "today" && createdDate < today) return false;
        if (filters.dateRange === "week" && createdDate < weekAgo) return false;
        if (filters.dateRange === "month" && createdDate < monthAgo)
          return false;
      }

      // Overdue filter
      if (filters.overdue === "overdue" && !isOverdue(g)) return false;
      if (filters.overdue === "ontrack" && isOverdue(g)) return false;

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
      // Sort by created date (latest first)
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA; // Latest first
    });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "ASSIGNED":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "IN_PROGRESS":
        return "bg-indigo-100 text-indigo-800 border-indigo-300";
      case "RESOLVED":
        return "bg-green-100 text-green-800 border-green-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      {/* Header with Gradient */}
      <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 shadow-xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVHJhbnNmb3JtPSJyb3RhdGUoNDUpIj48cGF0aCBkPSJNLTEwIDMwaDYwdjJoLTYweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNhKSIvPjwvc3ZnPg==')] opacity-30"></div>
        <div className="relative max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm shadow-lg">
                <FileText className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Active Grievances
                </h1>
                <p className="text-white/80 mt-0.5">
                  View and manage pending and in-progress grievances
                </p>
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
                <p className="text-sm text-white/70">Active</p>
                <p className="text-2xl font-bold text-white">
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
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {/* Search */}
            <div className="relative col-span-2 md:col-span-1 lg:col-span-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by name or ID..."
                value={filters.search}
                onChange={(e) =>
                  setFilters({ ...filters, search: e.target.value })
                }
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Status */}
            <select
              value={filters.status}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value })
              }
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="PENDING">🟡 Pending</option>
              <option value="ASSIGNED">🔵 Assigned</option>
              <option value="IN_PROGRESS">🛠️ In Progress</option>
            </select>

            {/* Department */}
            <select
              value={filters.department}
              onChange={(e) =>
                setFilters({ ...filters, department: e.target.value })
              }
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Departments</option>
              {departments.map((dept) => (
                <option key={dept._id} value={dept._id}>
                  {dept.name}
                </option>
              ))}
            </select>

            {/* Assignment */}
            <select
              value={filters.assignment}
              onChange={(e) =>
                setFilters({ ...filters, assignment: e.target.value })
              }
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Assignments</option>
              <option value="assigned">✅ Assigned</option>
              <option value="unassigned">⏳ Unassigned</option>
            </select>

            {/* Date Range */}
            <select
              value={filters.dateRange}
              onChange={(e) =>
                setFilters({ ...filters, dateRange: e.target.value })
              }
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Time</option>
              <option value="today">📅 Today</option>
              <option value="week">📆 Last 7 Days</option>
              <option value="month">🗓️ Last 30 Days</option>
            </select>

            {/* Overdue Filter */}
            <select
              value={filters.overdue}
              onChange={(e) =>
                setFilters({ ...filters, overdue: e.target.value })
              }
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All SLA Status</option>
              <option value="overdue">🔴 Overdue</option>
              <option value="ontrack">🟢 On Track</option>
            </select>

            {/* Reset Button */}
            <button
              onClick={() =>
                setFilters({
                  status: "all",
                  department: "all",
                  assignment: "all",
                  dateRange: "all",
                  overdue: "all",
                  search: "",
                })
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
              <LoadingSpinner text="Loading grievances..." />
            </div>
          ) : filteredGrievances.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">No grievances found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200 whitespace-nowrap">
                  <tr>
                    <th className="px-4 py-4 text-center text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Sr. No.
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Application No
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Citizen Information
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Department & Category
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Issue Description
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Assignment
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Raised On
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredGrievances.map((grievance, index) => (
                    <tr
                      key={grievance._id}
                      className="hover:bg-slate-50/50 transition-colors border-b border-slate-100"
                    >
                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-sm font-bold">
                          {index + 1}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <button
                            onClick={() => handleViewDetails(grievance)}
                            className="font-bold text-sm text-blue-700 text-left hover:underline break-all"
                          >
                            {grievance.grievanceId}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <button
                            onClick={() => handleViewDetails(grievance)}
                            className="text-blue-600 hover:text-blue-800 font-bold text-left hover:underline break-words whitespace-normal"
                          >
                            {grievance.citizenName}
                          </button>
                          <div className="flex items-center text-sm text-gray-500 mt-1 break-all">
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
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-600 border border-blue-100 w-fit">
                            {grievance.category || "General"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600 max-w-xs leading-relaxed break-words whitespace-normal">
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
                                Assigned on:{" "}
                                {new Date(
                                  grievance.assignedAt,
                                ).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center text-xs text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                            Pending Assignment
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-2">
                          <span
                            className={`px-3 py-1 rounded-full text-[11px] font-bold border uppercase tracking-wider w-fit ${getStatusColor(grievance.status)}`}
                          >
                            {grievance.status.replace("_", " ")}
                          </span>
                          {isOverdue(grievance) &&
                            (isJharsugudaCompany && isCompanyAdminUser ? (
                              <button
                                onClick={() => openReminderDialog(grievance)}
                                title="Open overdue reminder dialog"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 w-fit"
                              >
                                <BellRing className="w-3.5 h-3.5" />
                                Overdue
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border border-red-200 text-red-700 bg-red-50 w-fit">
                                <BellRing className="w-3.5 h-3.5" />
                                Overdue
                              </span>
                            ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <div className="flex items-center text-sm font-medium text-gray-900">
                            <Calendar className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                            {formatDate(grievance.createdAt)}
                          </div>
                          <span className="text-[10px] text-gray-400 mt-1">
                            {formatISTTime(grievance.createdAt)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center space-x-2">
                          {isCompanyAdminOrHigher(user) && (
                            <button
                              onClick={() => handleAssignClick(grievance)}
                              title="Assign Officer"
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors border border-transparent hover:border-green-200"
                            >
                              <UserPlus className="w-5 h-5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleViewDetails(grievance)}
                            title="View Full Details"
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-200"
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
        currentDepartmentId={
          grievanceToAssign?.departmentId &&
          typeof grievanceToAssign.departmentId === 'object'
            ? (grievanceToAssign.departmentId as any)._id
            : grievanceToAssign?.departmentId
        }
        currentSubDepartmentId={
          grievanceToAssign?.subDepartmentId &&
          typeof grievanceToAssign.subDepartmentId === 'object'
            ? (grievanceToAssign.subDepartmentId as any)._id
            : grievanceToAssign?.subDepartmentId
        }
        userRole={user?.role}
        userDepartmentId={
          user?.departmentId &&
          typeof user.departmentId === 'object'
            ? (user.departmentId as any)._id
            : user?.departmentId
        }
        currentUserId={user?.id}
      />

      {reminderDialogOpen && grievanceForReminder && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-red-50 border-b border-red-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-red-900">
                  Overdue Reminder - {grievanceForReminder.grievanceId}
                </h3>
                <p className="text-xs text-red-700">
                  Template: <span className="font-semibold">reminder_admin_v1</span>
                </p>
              </div>
              <button
                onClick={() => setReminderDialogOpen(false)}
                className="p-2 rounded-lg hover:bg-red-100 text-red-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {(() => {
                const details = getOverdueDetails(grievanceForReminder);
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg border p-3 bg-slate-50">
                      <p className="text-slate-500 text-xs">Raised On</p>
                      <p className="font-semibold text-slate-900">
                        {formatDateTime(details.createdDate.toISOString())}
                      </p>
                    </div>
                    <div className="rounded-lg border p-3 bg-slate-50">
                      <p className="text-slate-500 text-xs">Assigned To</p>
                      <p className="font-semibold text-slate-900">{details.assigneeName}</p>
                    </div>
                    <div className="rounded-lg border p-3 bg-slate-50">
                      <p className="text-slate-500 text-xs">Department / Office</p>
                      <p className="font-semibold text-slate-900">
                        {details.departmentName} / {details.officeName}
                      </p>
                    </div>
                    <div className="rounded-lg border p-3 bg-slate-50">
                      <p className="text-slate-500 text-xs">Days Passed / Reminder Count</p>
                      <p className="font-semibold text-slate-900">
                        {details.daysPassed} days / {(grievanceForReminder.reminderCount || 0) + 1}
                      </p>
                    </div>
                  </div>
                );
              })()}

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-2">
                  Remarks by Collector / Company Admin
                </label>
                <textarea
                  value={reminderRemarks}
                  onChange={(e) => setReminderRemarks(e.target.value)}
                  rows={4}
                  placeholder="Type reminder remarks to be sent with template..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
            </div>

            <div className="px-5 py-4 bg-slate-50 border-t flex items-center justify-end gap-3">
              <button
                onClick={() => setReminderDialogOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSendReminder}
                disabled={sendingReminder}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 inline-flex items-center gap-2"
              >
                <BellRing className="w-4 h-4" />
                {sendingReminder ? "Sending..." : "Send Reminder"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
