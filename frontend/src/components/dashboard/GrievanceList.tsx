"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  FileText, Search, RefreshCw, FileDown, Filter, X, 
  Trash2, ArrowUpDown, Phone, Clock, UserIcon, MoreHorizontal,
  ChevronRight, ArrowRight, Eye, UserPlus, History, Undo2
} from "lucide-react";
import { Grievance } from "@/lib/api/grievance";
import { Department } from "@/lib/api/department";
import { User } from "@/lib/api/user";
import { formatTo10Digits } from "@/lib/utils/phoneUtils";
import { TableSkeleton } from "@/components/ui/GeneralSkeleton";
import { Pagination } from "@/components/ui/Pagination";
import { Permission } from "@/lib/permissions";
import { hasPermission, isSuperAdmin } from "@/lib/permissions";

interface GrievanceListProps {
  grievances: Grievance[];
  grievanceFilters: any;
  setGrievanceFilters: React.Dispatch<React.SetStateAction<any>>;
  grievanceSearch: string;
  setGrievanceSearch: (s: string) => void;
  loadingGrievances: boolean;
  grievancePage: number;
  grievancePagination: any;
  setGrievancePage: (p: number) => void;
  handleRefreshData: () => void;
  isRefreshing: boolean;
  exportToCSV: (data: any[], filename: string, columns: any[]) => void;
  getSortedData: (data: any[], tab: string) => any[];
  handleSort: (key: string, tab: string) => void;
  sortConfig: { key: string; direction: "asc" | "desc" | null; tab: string };
  openGrievanceDetail: (id: string) => void;
  departments: Department[];
  isCompanyLevel: boolean;
  user: User | null;
  selectedGrievances: Set<string>;
  setSelectedGrievances: React.Dispatch<React.SetStateAction<Set<string>>>;
  handleBulkDeleteGrievances: () => void;
  isDeleting: boolean;
  openStatusUpdate: (grievance: any) => void;
  openRevertDialog: (grievance: any) => void;
  openAssignDialog: (grievance: any) => void;
  getParentDepartmentId: (dept: any) => string | null;
}

const GrievanceList: React.FC<GrievanceListProps> = ({
  grievances,
  grievanceFilters,
  setGrievanceFilters,
  grievanceSearch,
  setGrievanceSearch,
  loadingGrievances,
  grievancePage,
  grievancePagination,
  setGrievancePage,
  handleRefreshData,
  isRefreshing,
  exportToCSV,
  getSortedData,
  handleSort,
  sortConfig,
  openGrievanceDetail,
  departments,
  isCompanyLevel,
  user,
  selectedGrievances,
  setSelectedGrievances,
  handleBulkDeleteGrievances,
  isDeleting,
  openStatusUpdate,
  openRevertDialog,
  openAssignDialog,
  getParentDepartmentId,
}) => {
  const sortedGrievances = getSortedData(grievances, "grievances");

  return (
    <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
      <CardHeader className="bg-slate-900 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
              <FileText className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-white">
                {grievanceFilters.status === "REJECTED"
                  ? "Rejected Grievances"
                  : grievanceFilters.status === "CLOSED"
                  ? "Closed Grievances"
                  : grievanceFilters.status === "REVERTED"
                  ? "Reverted Grievances"
                  : "Active Grievances"}
              </CardTitle>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                {grievanceFilters.status === "REJECTED"
                  ? "View all rejected grievances"
                  : grievanceFilters.status === "CLOSED"
                  ? "View all closed grievances"
                  : grievanceFilters.status === "REVERTED"
                  ? "Reverted by departments and pending reassignment"
                  : "View and manage grievances"}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>

      {/* Grievance Filters */}
      <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-200">
        {/* Search and Actions Bar */}
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by ID, name, phone, or category..."
              value={grievanceSearch}
              onChange={(e) => setGrievanceSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm text-sm placeholder:text-slate-400 outline-none"
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
              <RefreshCw
                className={`w-4 h-4 mr-1.5 ${isRefreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportToCSV(
                  sortedGrievances,
                  "grievances",
                  [
                    { key: "grievanceId", label: "ID" },
                    { key: "citizenName", label: "Citizen Name" },
                    { key: "citizenPhone", label: "Phone" },
                    { key: "category", label: "Category" },
                    { key: "status", label: "Status" },
                    { key: "createdAt", label: "Created At" },
                  ],
                )
              }
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
            <span className="text-sm font-semibold text-slate-700">
              Filters
            </span>
          </div>

          <select
            value={grievanceFilters.status}
            onChange={(e) =>
              setGrievanceFilters((prev: any) => ({
                ...prev,
                status: e.target.value,
              }))
            }
            className="text-xs px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm hover:border-indigo-300 transition-colors cursor-pointer outline-none"
            title="Filter by grievance status"
          >
            <option value="">📋 All Status</option>
            <option value="PENDING">🔸 Pending</option>
            <option value="ASSIGNED">👤 Assigned</option>
            <option value="RESOLVED">✅ Resolved</option>
            <option value="REJECTED">❌ Rejected</option>
            {isCompanyLevel && (
              <>
                <option value="CLOSED">🔒 Closed</option>
                <option value="REVERTED">↩️ Reverted</option>
              </>
            )}
          </select>

          {isCompanyLevel && (
            <>
              <select
                value={grievanceFilters.mainDeptId}
                onChange={(e) =>
                  setGrievanceFilters((prev: any) => ({
                    ...prev,
                    mainDeptId: e.target.value,
                    subDeptId: "",
                    department: "",
                  }))
                }
                className="text-xs px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm hover:border-indigo-300 transition-colors cursor-pointer min-w-[150px] outline-none"
                title="Filter by main department"
              >
                <option value="">🏢 Main Dept</option>
                {departments.filter(d => !d.parentDepartmentId).map((dept) => (
                  <option key={dept._id} value={dept._id}>
                    {dept.name}
                  </option>
                ))}
              </select>

              <select
                value={grievanceFilters.subDeptId}
                onChange={(e) =>
                  setGrievanceFilters((prev: any) => ({
                    ...prev,
                    subDeptId: e.target.value,
                  }))
                }
                className="text-xs px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm hover:border-indigo-300 transition-colors cursor-pointer min-w-[150px] outline-none"
                title="Filter by sub department"
                disabled={!grievanceFilters.mainDeptId}
              >
                <option value="">🏢 Sub Dept</option>
                {grievanceFilters.mainDeptId && departments.filter(d => getParentDepartmentId(d) === grievanceFilters.mainDeptId).map((dept) => (
                  <option key={dept._id} value={dept._id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </>
          )}

          <select
            value={grievanceFilters.assignmentStatus}
            onChange={(e) =>
              setGrievanceFilters((prev: any) => ({
                ...prev,
                assignmentStatus: e.target.value,
              }))
            }
            className="text-xs px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm hover:border-indigo-300 transition-colors cursor-pointer outline-none"
            title="Filter by assignment status"
          >
            <option value="">👥 All Assignments</option>
            <option value="assigned">✓ Assigned</option>
            <option value="unassigned">○ Unassigned</option>
          </select>

          <select
            value={grievanceFilters.overdueStatus}
            onChange={(e) =>
              setGrievanceFilters((prev: any) => ({
                ...prev,
                overdueStatus: e.target.value,
              }))
            }
            className="text-xs px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm hover:border-indigo-300 transition-colors cursor-pointer outline-none"
            title="Filter by overdue status"
          >
            <option value="">⏱️ All Overdue Status</option>
            <option value="overdue">🔴 Overdue</option>
            <option value="ontrack">🟢 On Track</option>
          </select>

          <select
            value={grievanceFilters.dateRange}
            onChange={(e) =>
              setGrievanceFilters((prev: any) => ({
                ...prev,
                dateRange: e.target.value,
              }))
            }
            className="text-xs px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm hover:border-indigo-300 transition-colors cursor-pointer outline-none"
            title="Filter by date range"
          >
            <option value="">📅 All Time</option>
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
          </select>

          {(grievanceFilters.status ||
            grievanceFilters.department ||
            grievanceFilters.mainDeptId ||
            grievanceFilters.subDeptId ||
            grievanceFilters.assignmentStatus ||
            grievanceFilters.overdueStatus ||
            grievanceFilters.dateRange) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setGrievanceFilters({
                  status: "",
                  department: "",
                  mainDeptId: "",
                  subDeptId: "",
                  assignmentStatus: "",
                  overdueStatus: "",
                  dateRange: "",
                })
              }
              className="text-xs h-8 px-3 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl border border-red-200"
              title="Clear all filters"
            >
              <X className="w-3 h-3 mr-1" />
              Clear
            </Button>
          )}

          <span className="text-xs text-slate-500 ml-auto bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-200">
            Showing{" "}
            <span className="font-semibold text-indigo-600">
              {sortedGrievances.length}
            </span>{" "}
            of {grievances.length} grievances
          </span>

          {isSuperAdmin(user?.role) && selectedGrievances.size > 0 && (
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

      <CardContent className="p-0">
        {loadingGrievances ? (
          <TableSkeleton rows={8} cols={6} />
        ) : grievances.length === 0 ? (
          <div className="text-center py-16 bg-gradient-to-b from-slate-50 to-white rounded-2xl border border-slate-200 m-6">
            <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-indigo-500" />
            </div>
            <p className="text-slate-600 font-medium">
              No grievances found
            </p>
            <p className="text-slate-400 text-sm mt-1">
              New grievances will appear here
            </p>
          </div>
        ) : (
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-lg bg-white m-6">
            <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
              <table className="w-full relative border-collapse">
                <thead className="sticky top-0 z-20 bg-[#fcfdfe] border-b border-slate-200">
                  <tr className="whitespace-nowrap">
                    {isSuperAdmin(user?.role) && (
                      <th className="px-3 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={
                            selectedGrievances.size > 0 &&
                            selectedGrievances.size === sortedGrievances.length
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedGrievances(
                                new Set(sortedGrievances.map((g) => g._id)),
                              );
                            } else {
                              setSelectedGrievances(new Set());
                            }
                          }}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                          title="Select All"
                        />
                      </th>
                    )}
                    <th className="px-3 py-3 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      Sr.
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() =>
                          handleSort("grievanceId", "grievances")
                        }
                        className="group flex items-center space-x-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                      >
                        <span>Grievance No</span>
                        <ArrowUpDown
                          className={`w-3 h-3 transition-colors ${sortConfig.key === "grievanceId" ? "text-indigo-500" : "text-slate-300 group-hover:text-slate-400"}`}
                        />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() =>
                          handleSort("citizenName", "grievances")
                        }
                        className="group flex items-center space-x-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                      >
                        <span>Citizen</span>
                        <ArrowUpDown
                          className={`w-3 h-3 transition-colors ${sortConfig.key === "citizenName" ? "text-indigo-500" : "text-slate-300 group-hover:text-slate-400"}`}
                        />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() =>
                          handleSort("category", "grievances")
                        }
                        className="group flex items-center space-x-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                      >
                        <span>Dept &amp; Category</span>
                        <ArrowUpDown
                          className={`w-3 h-3 transition-colors ${sortConfig.key === "category" ? "text-indigo-500" : "text-slate-300 group-hover:text-slate-400"}`}
                        />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() =>
                          handleSort("assignedTo", "grievances")
                        }
                        className="group flex items-center space-x-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                      >
                        <span>Assigned Official</span>
                        <ArrowUpDown
                          className={`w-3 h-3 transition-colors ${sortConfig.key === "assignedTo" ? "text-indigo-500" : "text-slate-300 group-hover:text-slate-400"}`}
                        />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() =>
                          handleSort("status", "grievances")
                        }
                        className="group flex items-center space-x-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                      >
                        <span>Status</span>
                        <ArrowUpDown
                          className={`w-3 h-3 transition-colors ${sortConfig.key === "status" ? "text-indigo-500" : "text-slate-300 group-hover:text-slate-400"}`}
                        />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      SLA Status
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() =>
                          handleSort("createdAt", "grievances")
                        }
                        className="group flex items-center space-x-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                      >
                        <span>Raised On</span>
                        <ArrowUpDown
                          className={`w-3 h-3 transition-colors ${sortConfig.key === "createdAt" ? "text-indigo-500" : "text-slate-300 group-hover:text-slate-400"}`}
                        />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {sortedGrievances.map(
                    (grievance, index) => {
                      const now = new Date();
                      const createdDate = new Date(grievance.createdAt);
                      const hoursDiff = Math.floor(
                        (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60)
                      );
                      
                      let isOverdue = false;
                      let slaHours = 0;
                      
                      if (grievance.status === "PENDING") {
                        slaHours = 24;
                        isOverdue = hoursDiff > slaHours;
                      } else if (grievance.status === "ASSIGNED") {
                        slaHours = 120;
                        const assignedDate = grievance.assignedAt ? new Date(grievance.assignedAt) : createdDate;
                        const hoursFromAssigned = Math.floor((now.getTime() - assignedDate.getTime()) / (1000 * 60 * 60));
                        isOverdue = hoursFromAssigned > slaHours;
                      }
                      
                      if (grievance.status === 'RESOLVED' || grievance.status === 'CLOSED' || grievance.status === 'REJECTED') {
                        isOverdue = false;
                      }

                      return (
                        <tr
                          key={grievance._id}
                          className="hover:bg-gradient-to-r hover:from-indigo-50/50 hover:to-purple-50/50 transition-all duration-200 group/row"
                        >
                          {isSuperAdmin(user?.role) && (
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
                            <button
                              onClick={() => openGrievanceDetail(grievance._id)}
                              className="font-bold text-sm text-blue-700 hover:text-blue-800 hover:underline"
                            >
                              {grievance.grievanceId}
                            </button>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-col">
                              <button
                                onClick={() => openGrievanceDetail(grievance._id)}
                                className="text-gray-900 font-bold text-sm text-left hover:text-blue-600 hover:underline"
                              >
                                {grievance.citizenName}
                              </button>
                              <div className="flex items-center text-xs text-gray-500 font-medium">
                                <Phone className="w-3 h-3 mr-1.5" />
                                {formatTo10Digits(grievance.citizenPhone)}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold text-gray-700">
                                {typeof grievance.departmentId === "object" && grievance.departmentId
                                  ? grievance.departmentId.name
                                  : "General"}
                              </span>
                              <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-tighter mt-0.5">
                                {grievance.category}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            {grievance.assignedTo ? (
                              <div className="flex items-center">
                                <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center mr-2 border border-indigo-200">
                                  <UserIcon className="w-3.5 h-3.5 text-indigo-600" />
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-xs font-bold text-slate-800">
                                    {grievance.assignedTo.firstName} {grievance.assignedTo.lastName}
                                  </span>
                                  {grievance.assignedAt && (
                                    <span className="text-[9px] text-slate-400 font-medium leading-none mt-0.5">
                                      on {new Date(grievance.assignedAt).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-400 text-[10px] font-bold rounded-full border border-slate-200">
                                Unassigned
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <span 
                              className={`px-2.5 py-1 inline-flex items-center text-[10px] font-black rounded-full border shadow-sm uppercase tracking-widest ${
                                grievance.status === 'RESOLVED' 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                  : grievance.status === 'REJECTED'
                                  ? 'bg-red-50 text-red-700 border-red-100'
                                  : grievance.status === 'ASSIGNED'
                                  ? 'bg-blue-50 text-blue-700 border-blue-100'
                                  : grievance.status === 'REVERTED'
                                  ? 'bg-purple-50 text-purple-700 border-purple-100 ring-2 ring-purple-100/50'
                                  : 'bg-amber-50 text-amber-700 border-amber-100'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                                grievance.status === 'RESOLVED' ? 'bg-emerald-500' :
                                grievance.status === 'REJECTED' ? 'bg-red-500' :
                                grievance.status === 'ASSIGNED' ? 'bg-blue-500' :
                                grievance.status === 'REVERTED' ? 'bg-purple-500' :
                                'bg-amber-500'
                              }`}></span>
                              {grievance.status}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            {grievance.status === 'RESOLVED' || grievance.status === 'CLOSED' || grievance.status === 'REJECTED' ? (
                              <span className="text-[10px] font-bold text-slate-300 uppercase italic">Completed</span>
                            ) : (
                                <div className="flex flex-col">
                                  <span className={`text-[10px] font-black uppercase tracking-tight ${isOverdue ? 'text-red-500' : 'text-emerald-600'}`}>
                                    {isOverdue ? '🔴 Overdue' : '🟢 On Track'}
                                  </span>
                                  <span className="text-[9px] text-slate-400 font-bold mt-0.5">
                                    {isOverdue ? `Expired by ${hoursDiff - slaHours}h` : `Target: ${slaHours}h`}
                                  </span>
                                </div>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-800">
                                {new Date(grievance.createdAt).toLocaleDateString()}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {new Date(grievance.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-normal text-right">
                            <div className="flex justify-end items-center gap-1">
                               <Button
                                  variant="ghost" 
                                  size="sm"
                                  className="h-8 w-8 p-0 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                                  title="View Full Details"
                                  onClick={() => openGrievanceDetail(grievance._id)}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>

                                {hasPermission(user, Permission.UPDATE_GRIEVANCE) && grievance.status !== 'CLOSED' && (
                                  <Button
                                    variant="ghost" 
                                    size="sm"
                                    className="h-8 w-8 p-0 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all"
                                    title="Update Status"
                                    onClick={() => openStatusUpdate(grievance)}
                                  >
                                    <History className="w-4 h-4" />
                                  </Button>
                                )}

                                {isCompanyLevel && grievance.status === 'RESOLVED' && (
                                   <Button
                                      variant="ghost" 
                                      size="sm"
                                      className="h-8 w-8 p-0 text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-all"
                                      title="Revert Resolution"
                                      onClick={() => openRevertDialog(grievance)}
                                    >
                                      <Undo2 className="w-4 h-4" />
                                    </Button>
                                )}

                                {hasPermission(user, Permission.ASSIGN_GRIEVANCE) && (grievance.status === 'PENDING' || grievance.status === 'REVERTED') && (
                                  <Button
                                    variant="ghost" 
                                    size="sm"
                                    className="h-8 w-8 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                                    title="Assign Official"
                                    onClick={() => openAssignDialog(grievance)}
                                  >
                                    <UserPlus className="w-4 h-4" />
                                  </Button>
                                )}
                            </div>
                          </td>
                        </tr>
                      );
                    },
                  )}
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
  );
};

export default GrievanceList;
