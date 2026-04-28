"use client";

import type { ReactNode } from "react";
import { CalendarCheck, CheckCircle, Clock } from "lucide-react";

type OverviewAppointmentCardsProps = {
  visible: boolean;
  total: number;
  pending: number;
  completed: number;
  onOpenAppointments: () => void;
};

type AppointmentCardProps = {
  title: string;
  value: number;
  label: string;
  icon: ReactNode;
  cardClass: string;
  accentClass: string;
  iconWrapperClass: string;
  badgeClass: string;
  valueClass: string;
  onClick: () => void;
};

function AppointmentCard({
  title,
  value,
  label,
  icon,
  cardClass,
  accentClass,
  iconWrapperClass,
  badgeClass,
  valueClass,
  onClick,
}: AppointmentCardProps) {
  return (
    <div
      onClick={onClick}
      className={`group relative bg-white/70 backdrop-blur-md rounded-xl border border-slate-200/60 p-3 sm:p-4 transition-all duration-500 hover:shadow-xl hover:-translate-y-1 cursor-pointer overflow-hidden min-h-[7rem] sm:min-h-[9.5rem] ${cardClass}`}
    >
      <div
        className={`absolute -right-4 -top-4 w-20 h-20 bg-gradient-to-br rounded-full transition-transform group-hover:scale-150 duration-700 ${accentClass}`}
      />
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <div
            className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center border shadow-sm transition-all ${iconWrapperClass}`}
          >
            {icon}
          </div>
          <div className={`text-[8px] sm:text-[9px] font-black px-1.5 sm:px-2 py-1 rounded-lg uppercase tracking-tight ${badgeClass}`}>
            {label}
          </div>
        </div>
        <h4 className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
          {title}
        </h4>
        <p className={`text-xl sm:text-2xl font-black tracking-tighter leading-none ${valueClass}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

export function OverviewAppointmentCards({
  visible,
  total,
  pending,
  completed,
  onOpenAppointments,
}: OverviewAppointmentCardsProps) {
  if (!visible) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
      <AppointmentCard
        title="Total Appointments"
        value={total}
        label="Total"
        icon={<CalendarCheck className="w-4 h-4 sm:w-5 sm:h-5" />}
        cardClass="hover:shadow-purple-500/10"
        accentClass="from-purple-500/10 to-transparent"
        iconWrapperClass="bg-purple-50 text-purple-600 border-purple-100/50 group-hover:rotate-12"
        badgeClass="text-purple-600 bg-purple-50"
        valueClass="text-slate-900"
        onClick={onOpenAppointments}
      />
      <AppointmentCard
        title="Pending Appointments"
        value={pending}
        label="Pending"
        icon={<Clock className="w-4 h-4 sm:w-5 sm:h-5" />}
        cardClass="hover:shadow-blue-500/10"
        accentClass="from-blue-500/10 to-transparent"
        iconWrapperClass="bg-blue-50 text-blue-600 border-blue-100/50 group-hover:rotate-6"
        badgeClass="text-blue-600 bg-blue-50"
        valueClass="text-blue-600"
        onClick={onOpenAppointments}
      />
      <AppointmentCard
        title="Completed Appointments"
        value={completed}
        label="Done"
        icon={<CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />}
        cardClass="hover:shadow-emerald-500/10"
        accentClass="from-emerald-500/10 to-transparent"
        iconWrapperClass="bg-emerald-50 text-emerald-600 border-emerald-100/50 group-hover:rotate-6"
        badgeClass="text-emerald-600 bg-emerald-50"
        valueClass="text-emerald-600"
        onClick={onOpenAppointments}
      />
    </div>
  );
}
