"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Download } from "lucide-react";
import { Appointment } from "@/lib/api/appointment";

interface AppointmentListProps {
  appointments: Appointment[];
  filteredAppointments: Appointment[];
  exportToCSV: (data: any[], filename: string) => void;
  setSelectedAppointment: (a: Appointment) => void;
  setShowAppointmentDetail: (open: boolean) => void;
}

export default function AppointmentList({
  appointments,
  filteredAppointments,
  exportToCSV,
  setSelectedAppointment,
  setShowAppointmentDetail,
}: AppointmentListProps) {
  return (
    <Card className="rounded-2xl border-slate-200 shadow-xl overflow-hidden bg-white">
      <CardHeader className="flex flex-row items-center justify-between border-b bg-slate-50/50 px-6 py-4">
        <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-600 flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-emerald-500" />
          Appointment Calendar
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportToCSV(appointments, "appointments")}
          className="text-[10px] font-black uppercase tracking-wider"
        >
          <Download className="w-3.5 h-3.5 mr-2" />
          Export
        </Button>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 whitespace-nowrap">
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                Sr. No.
              </th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                Token ID
              </th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                Citizen
              </th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                Slot Date/Time
              </th>
              <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredAppointments.map((a, idx) => (
              <tr
                key={a._id}
                className="group hover:bg-slate-50 transition-colors"
              >
                <td className="px-6 py-4">
                  <span className="inline-flex items-center justify-center w-7 h-7 bg-slate-100 text-slate-600 font-black text-[10px] rounded-lg group-hover:bg-emerald-100 group-hover:text-emerald-700 transition-colors">
                    {idx + 1}
                  </span>
                </td>
                <td className="px-6 py-4 font-black text-purple-600 text-sm">
                  {a.appointmentId}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <p className="font-bold text-slate-900 leading-none">
                      {a.citizenName}
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">
                      {a.citizenPhone}
                    </p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-[10px] font-black text-slate-600">
                      {new Date(a.appointmentDate).getDate()}
                    </div>
                    <div className="flex flex-col">
                      <p className="text-[10px] font-black text-slate-900 uppercase tracking-tighter">
                        {a.appointmentTime}
                      </p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                        {new Date(a.appointmentDate).toLocaleDateString(
                          "en-US",
                          { month: "short", year: "numeric" },
                        )}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedAppointment(a);
                      setShowAppointmentDetail(true);
                    }}
                    className="text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                  >
                    View Schedule
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
