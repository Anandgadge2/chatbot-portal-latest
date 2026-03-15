"use client";

import React from "react";
import { TabsContent } from "@/components/ui/tabs";
import { 
  User as UserIcon, 
  Mail, 
  Phone, 
  Building, 
  Shield, 
  FileText, 
  CalendarClock, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  Zap 
} from "lucide-react";

interface ProfileTabProps {
  user: any;
  departments: any[];
  grievances: any[];
  appointments: any[];
}

export default function ProfileTab({ user, departments, grievances, appointments }: ProfileTabProps) {
  return (
    <TabsContent value="profile" className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-900 px-6 py-4 border-b border-slate-800">
              <h3 className="text-white text-sm font-bold uppercase tracking-tight flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-indigo-400" />
                Official Identity
              </h3>
            </div>
            <div className="p-6">
              <div className="flex flex-col items-center text-center">
                <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl mb-4">
                  <span className="text-3xl font-bold text-white uppercase">
                    {user?.firstName?.[0]}
                    {user?.lastName?.[0]}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">
                  {user?.firstName} {user?.lastName}
                </h3>
                <span className="px-3 py-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-bold rounded-full uppercase tracking-wide mb-4">
                  {user?.role?.replace("_", " ")}
                </span>

                <div className="w-full space-y-3 mt-4 text-left">
                  <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Mail className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                        Email
                      </p>
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {user?.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <Phone className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                        Phone
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        {user?.phone || "Not provided"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Building className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                        Department
                      </p>
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {typeof user?.departmentId === "object" &&
                        user?.departmentId
                          ? (user.departmentId as any).name
                          : departments.find(
                              (d) => d._id === user?.departmentId,
                            )?.name || "Not assigned"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                      <Shield className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                        User ID
                      </p>
                      <p className="text-xs font-mono text-gray-600 truncate">
                        {user?.id}
                      </p>
                    </div>
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
                <p className="text-sm font-medium text-white/80">
                  Assigned Grievances
                </p>
                <p className="text-3xl font-black mt-1">
                  {
                    grievances.filter((g) => {
                      const assignedId =
                        typeof g.assignedTo === "object" && g.assignedTo
                          ? (g.assignedTo as any)._id
                          : g.assignedTo;
                      return assignedId === user?.id;
                    }).length
                  }
                </p>
              </div>
            </div>

            <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 via-green-500 to-teal-500 rounded-2xl p-5 text-white shadow-lg">
              <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
              <div className="relative z-10">
                <p className="text-sm font-medium text-white/80">
                  Resolved Grievances
                </p>
                <p className="text-3xl font-black mt-1">
                  {
                    grievances.filter((g) => {
                      const assignedId =
                        typeof g.assignedTo === "object" && g.assignedTo
                          ? (g.assignedTo as any)._id
                          : g.assignedTo;
                      return (
                        assignedId === user?.id && g.status === "RESOLVED"
                      );
                    }).length
                  }
                </p>
              </div>
            </div>

            <div className="relative overflow-hidden bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-500 rounded-2xl p-5 text-white shadow-lg">
              <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
              <div className="relative z-10">
                <p className="text-sm font-medium text-white/80">
                  Assigned Appointments
                </p>
                <p className="text-3xl font-black mt-1">
                  {
                    appointments.filter((a) => {
                      const assignedId =
                        typeof a.assignedTo === "object" && a.assignedTo
                          ? (a.assignedTo as any)._id
                          : a.assignedTo;
                      return assignedId === user?.id;
                    }).length
                  }
                </p>
              </div>
            </div>

            <div className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 rounded-2xl p-5 text-white shadow-lg">
              <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
              <div className="relative z-10">
                <p className="text-sm font-medium text-white/80">
                  Completed Appointments
                </p>
                <p className="text-3xl font-black mt-1">
                  {
                    appointments.filter((a) => {
                      const assignedId =
                        typeof a.assignedTo === "object" && a.assignedTo
                          ? (a.assignedTo as any)._id
                          : a.assignedTo;
                      return (
                        assignedId === user?.id &&
                        a.status === "COMPLETED"
                      );
                    }).length
                  }
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
                <h4 className="text-lg font-bold text-gray-900">
                  Grievances Breakdown
                </h4>
              </div>

              <div className="space-y-3">
                {(() => {
                  const myGrievances = grievances.filter((g) => {
                    const assignedId =
                      typeof g.assignedTo === "object" && g.assignedTo
                        ? (g.assignedTo as any)._id
                        : g.assignedTo;
                    return assignedId === user?.id;
                  });
                  const pending = myGrievances.filter(
                    (g) => g.status === "PENDING",
                  ).length;
                  const assigned = myGrievances.filter(
                    (g) => g.status === "ASSIGNED",
                  ).length;
                  const resolved = myGrievances.filter(
                    (g) => g.status === "RESOLVED",
                  ).length;
                  const total = myGrievances.length;

                  return (
                    <>
                      <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-gray-100">
                        <span className="text-sm text-gray-600 flex items-center gap-2">
                          <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                          Pending
                        </span>
                        <span className="font-bold text-gray-900">
                          {pending}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-gray-100">
                        <span className="text-sm text-gray-600 flex items-center gap-2">
                          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                          In Progress
                        </span>
                        <span className="font-bold text-gray-900">
                          {assigned}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-gray-100">
                        <span className="text-sm text-gray-600 flex items-center gap-2">
                          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                          Resolved
                        </span>
                        <span className="font-bold text-gray-900">
                          {resolved}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl text-white mt-2">
                        <span className="text-sm font-medium">
                          Resolution Rate
                        </span>
                        <span className="font-bold text-lg">
                          {total > 0
                            ? ((resolved / total) * 100).toFixed(1)
                            : "0.0"}
                          %
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
                <h4 className="text-lg font-bold text-gray-900">
                  Appointments Breakdown
                </h4>
              </div>

              <div className="space-y-3">
                {(() => {
                  const myAppointments = appointments.filter((a) => {
                    const assignedId =
                      typeof a.assignedTo === "object" && a.assignedTo
                        ? (a.assignedTo as any)._id
                        : a.assignedTo;
                    return assignedId === user?.id;
                  });
                  const scheduled = myAppointments.filter(
                    (a) => a.status === "SCHEDULED",
                  ).length;
                  const completed = myAppointments.filter(
                    (a) => a.status === "COMPLETED",
                  ).length;
                  const cancelled = myAppointments.filter(
                    (a) => a.status === "CANCELLED",
                  ).length;
                  const total = myAppointments.length;

                  return (
                    <>
                      <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-gray-100">
                        <span className="text-sm text-gray-600 flex items-center gap-2">
                          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                          Scheduled
                        </span>
                        <span className="font-bold text-gray-900">
                          {scheduled}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-gray-100">
                        <span className="text-sm text-gray-600 flex items-center gap-2">
                          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                          Completed
                        </span>
                        <span className="font-bold text-gray-900">
                          {completed}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-gray-100">
                        <span className="text-sm text-gray-600 flex items-center gap-2">
                          <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                          Cancelled
                        </span>
                        <span className="font-bold text-gray-900">
                          {cancelled}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-gradient-to-r from-purple-500 to-fuchsia-500 rounded-xl text-white mt-2">
                        <span className="text-sm font-medium">
                          Completion Rate
                        </span>
                        <span className="font-bold text-lg">
                          {total > 0
                            ? ((completed / total) * 100).toFixed(1)
                            : "0.0"}
                          %
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
                const myGrievances = grievances.filter((g) => {
                  const assignedId =
                    typeof g.assignedTo === "object" && g.assignedTo
                      ? (g.assignedTo as any)._id
                      : g.assignedTo;
                  return assignedId === user?.id;
                });
                const myAppointments = appointments.filter((a) => {
                  const assignedId =
                    typeof a.assignedTo === "object" && a.assignedTo
                      ? (a.assignedTo as any)._id
                      : a.assignedTo;
                  return assignedId === user?.id;
                });
                const totalTasks =
                  myGrievances.length + myAppointments.length;
                const completedTasks =
                  myGrievances.filter((g) => g.status === "RESOLVED")
                    .length +
                  myAppointments.filter((a) => a.status === "COMPLETED")
                    .length;
                const pendingTasks =
                  totalTasks -
                  completedTasks -
                  myAppointments.filter((a) => a.status === "CANCELLED")
                    .length;

                return (
                  <>
                    <div className="text-center p-4 bg-white rounded-xl border border-gray-100">
                      <p className="text-3xl font-black text-indigo-600">
                        {totalTasks}
                      </p>
                      <p className="text-xs font-medium text-gray-500 uppercase mt-1">
                        Total Tasks
                      </p>
                    </div>
                    <div className="text-center p-4 bg-white rounded-xl border border-gray-100">
                      <p className="text-3xl font-black text-emerald-600">
                        {completedTasks}
                      </p>
                      <p className="text-xs font-medium text-gray-500 uppercase mt-1">
                        Completed
                      </p>
                    </div>
                    <div className="text-center p-4 bg-white rounded-xl border border-gray-100">
                      <p className="text-3xl font-black text-amber-600">
                        {pendingTasks}
                      </p>
                      <p className="text-xs font-medium text-gray-500 uppercase mt-1">
                        Pending
                      </p>
                    </div>
                    <div className="text-center p-4 bg-white rounded-xl border border-gray-100">
                      <p className="text-3xl font-black text-purple-600">
                        {totalTasks > 0
                          ? ((completedTasks / totalTasks) * 100).toFixed(
                              0,
                            )
                          : "0"}
                        %
                      </p>
                      <p className="text-xs font-medium text-gray-500 uppercase mt-1">
                        Efficiency
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </TabsContent>
  );
}
