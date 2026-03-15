"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Calendar, Search, RefreshCw, FileDown, Filter, X, 
  Trash2, ArrowUpDown, Phone, Clock, CalendarClock, Eye
} from "lucide-react";
import { Appointment } from "@/lib/api/appointment";
import { User } from "@/lib/api/user";
import { formatTo10Digits } from "@/lib/utils/phoneUtils";
import { TableSkeleton } from "@/components/ui/GeneralSkeleton";
import { Pagination } from "@/components/ui/Pagination";
import { isSuperAdmin } from "@/lib/permissions";

interface AppointmentListProps {
  appointments: Appointment[];
  appointmentFilters: any;
  setAppointmentFilters: React.Dispatch<React.SetStateAction<any>>;
  appointmentSearch: string;
  setAppointmentSearch: (s: string) => void;
  loadingAppointments: boolean;
  appointmentPage: number;
  appointmentPagination: any;
  setAppointmentPage: (p: number) => void;
  handleRefreshData: () => void;
  isRefreshing: boolean;
  exportToCSV: (data: any[], filename: string, columns: any[]) => void;
  getSortedData: (data: any[], tab: string) => any[];
  handleSort: (key: string, tab: string) => void;
  sortConfig: { key: string; direction: "asc" | "desc" | null; tab: string };
  openAppointmentDetail: (id: string) => void;
  user: User | null;
  isCompanyLevel: boolean;
  isDepartmentLevel: boolean;
  setShowAvailabilityCalendar: (s: boolean) => void;
  selectedAppointments: Set<string>;
  setSelectedAppointments: React.Dispatch<React.SetStateAction<Set<string>>>;
  handleBulkDeleteAppointments: () => void;
  isDeleting: boolean;
  setSelectedAppointmentForStatus: (appointment: any) => void;
  setShowAppointmentStatusModal: (s: boolean) => void;
  updatingAppointmentStatus: Set<string>;
}

const AppointmentList: React.FC<AppointmentListProps> = ({
  appointments,
  appointmentFilters,
  setAppointmentFilters,
  appointmentSearch,
  setAppointmentSearch,
  loadingAppointments,
  appointmentPage,
  appointmentPagination,
  setAppointmentPage,
  handleRefreshData,
  isRefreshing,
  exportToCSV,
  getSortedData,
  handleSort,
  sortConfig,
  openAppointmentDetail,
  user,
  isCompanyLevel,
  isDepartmentLevel,
  setShowAvailabilityCalendar,
  selectedAppointments,
  setSelectedAppointments,
  handleBulkDeleteAppointments,
  isDeleting,
  setSelectedAppointmentForStatus,
  setShowAppointmentStatusModal,
  updatingAppointmentStatus,
}) => {
  const sortedAppointments = getSortedData(appointments, "appointments");

  return (
    <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
      <CardHeader className="bg-slate-900 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
              <Calendar className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-white">
                Appointments
              </CardTitle>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                View and manage all scheduled appointments
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(isCompanyLevel || isDepartmentLevel) && (
              <Button
                onClick={() => setShowAvailabilityCalendar(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white border-0 h-8 text-[10px] font-bold uppercase tracking-widest rounded-lg px-4 shadow-md"
                title="Configure when appointments can be scheduled"
              >
                <CalendarClock className="w-3.5 h-3.5 mr-1.5" />
                Availability
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
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white shadow-sm text-sm placeholder:text-slate-400 outline-none"
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
                  sortedAppointments,
                  "appointments",
                  [
                    { key: "appointmentId", label: "ID" },
                    { key: "citizenName", label: "Citizen Name" },
                    { key: "citizenPhone", label: "Phone" },
                    { key: "purpose", label: "Purpose" },
                    { key: "appointmentDate", label: "Date" },
                    { key: "appointmentTime", label: "Time" },
                    { key: "status", label: "Status" },
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
            <Filter className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-semibold text-slate-700">
              Filters
            </span>
          </div>

          <select
            value={appointmentFilters.status}
            onChange={(e) =>
              setAppointmentFilters((prev: any) => ({
                ...prev,
                status: e.target.value,
              }))
            }
            className="text-xs px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white shadow-sm hover:border-purple-300 transition-colors cursor-pointer outline-none"
            title="Filter by appointment status"
          >
            <option value="">📋 All Status</option>
            <option value="SCHEDULED">📅 Scheduled</option>
            <option value="CONFIRMED">✅ Confirmed</option>
            <option value="COMPLETED">✅ Completed</option>
            <option value="CANCELLED">❌ Cancelled</option>
          </select>

          <select
            value={appointmentFilters.dateFilter}
            onChange={(e) =>
              setAppointmentFilters((prev: any) => ({
                ...prev,
                dateFilter: e.target.value,
              }))
            }
            className="text-xs px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white shadow-sm hover:border-purple-300 transition-colors cursor-pointer outline-none"
            title="Filter by date"
          >
            <option value="">📅 All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="upcoming">Upcoming</option>
          </select>

          {(appointmentFilters.status ||
            appointmentFilters.dateFilter) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setAppointmentFilters({
                  status: "",
                  department: "",
                  assignmentStatus: "",
                  dateFilter: "",
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
            <span className="font-semibold text-purple-600">
              {sortedAppointments.length}
            </span>{" "}
            of {appointments.length} appointments
          </span>

          {isSuperAdmin(user?.role) && selectedAppointments.size > 0 && (
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

      <CardContent className="p-0">
        {loadingAppointments ? (
          <TableSkeleton rows={8} cols={6} />
        ) : appointments.length === 0 ? (
          <div className="text-center py-16 bg-gradient-to-b from-slate-50 to-white rounded-2xl border border-slate-200 m-6">
            <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-purple-500" />
            </div>
            <p className="text-slate-600 font-medium">
              No appointments found
            </p>
            <p className="text-slate-400 text-sm mt-1">
              New appointments will appear here
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
                            selectedAppointments.size > 0 &&
                            selectedAppointments.size === sortedAppointments.length
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAppointments(
                                new Set(sortedAppointments.map((a) => a._id)),
                              );
                            } else {
                              setSelectedAppointments(new Set());
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
                          handleSort("appointmentId", "appointments")
                        }
                        className="group flex items-center space-x-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                      >
                        <span>App ID</span>
                        <ArrowUpDown
                          className={`w-3 h-3 transition-colors ${sortConfig.key === "appointmentId" ? "text-indigo-500" : "text-slate-300 group-hover:text-slate-400"}`}
                        />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() =>
                          handleSort("citizenName", "appointments")
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
                          handleSort("purpose", "appointments")
                        }
                        className="group flex items-center space-x-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                      >
                        <span>Purpose</span>
                        <ArrowUpDown
                          className={`w-3 h-3 transition-colors ${sortConfig.key === "purpose" ? "text-indigo-500" : "text-slate-300 group-hover:text-slate-400"}`}
                        />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() =>
                          handleSort(
                            "appointmentDate",
                            "appointments",
                          )
                        }
                        className="group flex items-center space-x-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                      >
                        <span>Scheduled At</span>
                        <ArrowUpDown
                          className={`w-3 h-3 transition-colors ${sortConfig.key === "appointmentDate" ? "text-indigo-500" : "text-slate-300 group-hover:text-slate-400"}`}
                        />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() =>
                          handleSort("status", "appointments")
                        }
                        className="group flex items-center space-x-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                      >
                        <span>Status</span>
                        <ArrowUpDown
                          className={`w-3 h-3 transition-colors ${sortConfig.key === "status" ? "text-indigo-500" : "text-slate-300 group-hover:text-slate-400"}`}
                        />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedAppointments.map(
                    (appointment, index) => (
                      <tr
                        key={appointment._id}
                        className="hover:bg-gradient-to-r hover:from-purple-50/50 hover:to-pink-50/50 transition-all duration-200 group/row"
                      >
                        {isSuperAdmin(user?.role) && (
                          <td className="px-3 py-4 text-center">
                            <input
                              type="checkbox"
                              checked={selectedAppointments.has(appointment._id)}
                              onChange={(e) => {
                                const newSelected = new Set(selectedAppointments);
                                if (e.target.checked) {
                                  newSelected.add(appointment._id);
                                } else {
                                  newSelected.delete(appointment._id);
                                }
                                setSelectedAppointments(newSelected);
                              }}
                              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                            />
                          </td>
                        )}
                        <td className="px-3 py-4 text-center">
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-purple-100 text-purple-700 text-xs font-bold">
                            {(appointmentPage - 1) *
                              appointmentPagination.limit +
                              index +
                              1}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <button
                            onClick={() => openAppointmentDetail(appointment._id)}
                            className="font-bold text-sm text-purple-700 hover:text-purple-800 hover:underline"
                          >
                            {appointment.appointmentId}
                          </button>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col">
                            <button
                              onClick={() => openAppointmentDetail(appointment._id)}
                              className="text-gray-900 font-bold text-sm text-left hover:text-purple-600 hover:underline whitespace-normal break-words"
                            >
                              {appointment.citizenName}
                            </button>
                            <div className="flex items-center text-xs text-gray-500 font-medium">
                              <Phone className="w-3 h-3 mr-1.5" />
                              {formatTo10Digits(appointment.citizenPhone)}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col max-w-[150px]">
                            <span className="text-[12px] text-gray-500 whitespace-normal break-words italic">
                              {appointment.purpose}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-start gap-2">
                            <div className="flex flex-col items-center justify-center w-12 h-12 bg-gradient-to-br from-purple-100 to-fuchsia-100 rounded-xl border border-purple-200/50 shadow-sm">
                              <span className="text-[10px] font-bold text-purple-600 uppercase">
                                {new Date(
                                  appointment.appointmentDate,
                                ).toLocaleDateString("en-US", {
                                  month: "short",
                                })}
                              </span>
                              <span className="text-lg font-black text-purple-700 leading-tight">
                                {new Date(
                                  appointment.appointmentDate,
                                ).getDate()}
                              </span>
                            </div>
                            <div className="flex flex-col justify-center">
                              <span className="text-xs font-semibold text-gray-800">
                                {new Date(
                                  appointment.appointmentDate,
                                ).toLocaleDateString("en-US", {
                                  weekday: "long",
                                })}
                              </span>
                              <span className="text-[11px] text-gray-500">
                                {new Date(
                                  appointment.appointmentDate,
                                ).getFullYear()}
                              </span>
                              <div className="flex items-center gap-1 mt-1">
                                <Clock className="w-3 h-3 text-amber-500" />
                                <span className="text-xs font-bold text-amber-600">
                                  {appointment.appointmentTime
                                    ? (() => {
                                        const [hours, minutes] =
                                          appointment.appointmentTime.split(
                                            ":",
                                          );
                                        const hour = parseInt(
                                          hours,
                                          10,
                                        );
                                        const period =
                                          hour >= 12 ? "PM" : "AM";
                                        const displayHour =
                                          hour > 12
                                            ? hour - 12
                                            : hour === 0
                                              ? 12
                                              : hour;
                                        return `${displayHour}:${minutes || "00"} ${period}`;
                                      })()
                                    : "TBD"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="relative flex items-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedAppointmentForStatus(
                                  appointment,
                                );
                                setShowAppointmentStatusModal(true);
                              }}
                              className={`px-3 py-1.5 text-[10px] font-bold border border-gray-200 rounded bg-white hover:border-purple-400 hover:bg-purple-50 focus:outline-none focus:ring-1 focus:ring-purple-500 uppercase tracking-tight transition-all ${
                                updatingAppointmentStatus.has(
                                  appointment._id,
                                )
                                  ? "opacity-50 cursor-wait"
                                  : ""
                              }`}
                              disabled={updatingAppointmentStatus.has(
                                appointment._id,
                              )}
                            >
                              {appointment.status}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-normal text-right">
                          <div className="flex justify-end items-center gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-colors flex-shrink-0"
                              title="View Details"
                              onClick={() => openAppointmentDetail(appointment._id)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ),
                  )}
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
  );
};

export default AppointmentList;
