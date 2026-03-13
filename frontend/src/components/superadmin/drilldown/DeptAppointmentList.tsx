import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Calendar, Search, Download, RefreshCw } from "lucide-react";
import { Appointment, appointmentAPI } from "@/lib/api/appointment";
import { formatTo10Digits } from "@/lib/utils/phoneUtils";

interface DeptAppointmentListProps {
  filteredAppointments: Appointment[];
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  setSelectedAppointment: (a: Appointment) => void;
  setShowAppointmentDetail: (val: boolean) => void;
  exportToCSV: (data: any[], filename: string) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}

const DeptAppointmentList: React.FC<DeptAppointmentListProps> = ({
  filteredAppointments,
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  setSelectedAppointment,
  setShowAppointmentDetail,
  exportToCSV,
  onRefresh,
  refreshing,
}) => {
  return (
    <Card className="rounded-2xl border-0 shadow-xl overflow-hidden bg-white/80 backdrop-blur-sm text-left">
      <CardHeader className="bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 text-white px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-white">
                Appointments ({filteredAppointments.length})
              </CardTitle>
              <CardDescription className="text-purple-100 font-medium">
                Scheduled consultation and meeting metrics
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={refreshing}
                className="p-2.5 bg-white/20 text-white rounded-xl hover:bg-white/30 transition-all border border-white/30 disabled:opacity-50"
                title="Refresh Appointment Data"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              </button>
            )}
            <button
              onClick={() => exportToCSV(filteredAppointments, "appointments")}
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
          <>
            <div className="md:hidden space-y-3 p-4">
            {filteredAppointments.slice(0, 50).map((a, index) => (
              <div
                key={a._id}
                className="rounded-xl border border-purple-100 bg-gradient-to-r from-purple-50/60 to-pink-50/60 p-4 space-y-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-purple-100 to-fuchsia-100 text-purple-700 text-xs font-bold">
                    {index + 1}
                  </span>
                  <span className="font-bold text-sm text-purple-700">{a.appointmentId}</span>
                </div>
                <button
                  onClick={async () => {
                    const response = await appointmentAPI.getById(a._id);
                    if (response.success) {
                      setSelectedAppointment(response.data.appointment);
                      setShowAppointmentDetail(true);
                    }
                  }}
                  className="text-left"
                >
                  <p className="font-semibold text-gray-900">{a.citizenName}</p>
                  <p className="text-xs text-gray-500">{formatTo10Digits(a.citizenPhone)}</p>
                </button>
                <p className="text-sm text-gray-600">{a.purpose}</p>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-800 text-sm">
                      {new Date(a.appointmentDate).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-amber-600">{a.appointmentTime}</p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      a.status === "COMPLETED"
                        ? "bg-emerald-100 text-emerald-700"
                        : a.status === "CANCELLED"
                          ? "bg-red-100 text-red-700"
                          : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {a.status}
                  </span>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={async () => {
                      const response = await appointmentAPI.getById(a._id);
                      if (response.success) {
                        setSelectedAppointment(response.data.appointment);
                        setShowAppointmentDetail(true);
                      }
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-purple-600 hover:bg-purple-100 rounded-lg transition-all"
                  >
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>

            <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-purple-50 via-fuchsia-50 to-pink-50 border-b border-purple-100">
                <tr>
                  <th className="px-3 py-4 text-center text-[11px] font-bold text-purple-700 uppercase">
                    Sr. No.
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-purple-700 uppercase">
                    Appointment ID
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-purple-700 uppercase">
                    Citizen
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-purple-700 uppercase">
                    Purpose
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-purple-700 uppercase">
                    Scheduled
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-purple-700 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-4 text-center text-[11px] font-bold text-purple-700 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAppointments.slice(0, 50).map((a, index) => (
                  <tr
                    key={a._id}
                    className="hover:bg-gradient-to-r hover:from-purple-50/50 hover:to-pink-50/50 transition-all"
                  >
                    <td className="px-3 py-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-purple-100 to-fuchsia-100 text-purple-700 text-xs font-bold">
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-sm text-purple-700">
                        {a.appointmentId}
                      </span>
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
                        <p className="font-semibold text-gray-900 hover:underline">
                          {a.citizenName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatTo10Digits(a.citizenPhone)}
                        </p>
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                      {a.purpose}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div>
                        <p className="font-medium text-gray-800">
                          {new Date(a.appointmentDate).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-amber-600">
                          {a.appointmentTime}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          a.status === "COMPLETED"
                            ? "bg-emerald-100 text-emerald-700"
                            : a.status === "CANCELLED"
                              ? "bg-red-100 text-red-700"
                              : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {a.status}
                      </span>
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
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default DeptAppointmentList;
