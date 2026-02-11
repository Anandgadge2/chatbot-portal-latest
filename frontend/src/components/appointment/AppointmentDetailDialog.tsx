'use client';

import { format, formatDistanceToNow } from 'date-fns';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Appointment } from '@/lib/api/appointment';
import { 
  Calendar, 
  User, 
  RefreshCw, 
  CheckCircle2, 
  Clock,
  Building,
  AlertCircle,
  Phone,
  MessageCircle,
  FileText,
  Tag,
  X,
  Target
} from 'lucide-react';

interface AppointmentDetailDialogProps {
  isOpen: boolean;
  appointment: Appointment | null;
  onClose: () => void;
}

const AppointmentDetailDialog: React.FC<AppointmentDetailDialogProps> = ({ isOpen, appointment, onClose }) => {
  if (!isOpen || !appointment) return null;

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return { 
          bg: 'bg-emerald-100', 
          text: 'text-emerald-700', 
          border: 'border-emerald-200',
          icon: <CheckCircle2 className="w-4 h-4" />,
          label: 'Completed',
          gradient: 'from-emerald-500 to-green-600'
        };
      case 'CONFIRMED':
        return { 
          bg: 'bg-blue-100', 
          text: 'text-blue-700', 
          border: 'border-blue-200',
          icon: <CheckCircle2 className="w-4 h-4" />,
          label: 'Confirmed',
          gradient: 'from-blue-500 to-indigo-600'
        };
      case 'SCHEDULED':
        return { 
          bg: 'bg-indigo-100', 
          text: 'text-indigo-700', 
          border: 'border-indigo-200',
          icon: <Calendar className="w-4 h-4" />,
          label: 'Scheduled',
          gradient: 'from-indigo-500 to-purple-600'
        };
      case 'REQUESTED':
        return { 
          bg: 'bg-amber-100', 
          text: 'text-amber-700', 
          border: 'border-amber-200',
          icon: <Clock className="w-4 h-4" />,
          label: 'Requested',
          gradient: 'from-amber-500 to-orange-600'
        };
      case 'CANCELLED':
      case 'NO_SHOW':
        return { 
          bg: 'bg-red-100', 
          text: 'text-red-700', 
          border: 'border-red-200',
          icon: <AlertCircle className="w-4 h-4" />,
          label: status === 'CANCELLED' ? 'Cancelled' : 'No Show',
          gradient: 'from-red-500 to-rose-600'
        };
      default:
        return { 
          bg: 'bg-gray-100', 
          text: 'text-gray-700', 
          border: 'border-gray-200',
          icon: <AlertCircle className="w-4 h-4" />,
          label: status,
          gradient: 'from-gray-500 to-slate-600'
        };
    }
  };

  const statusConfig = getStatusConfig(appointment.status);
  const createdDate = new Date(appointment.createdAt);
  const timeAgo = formatDistanceToNow(createdDate, { addSuffix: true });
  const appointmentDate = new Date(appointment.appointmentDate);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto p-4">
      <div className="w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-2xl shadow-2xl bg-white animate-in fade-in zoom-in duration-200 flex flex-col">
        {/* Gradient Header */}
        <div className={`bg-gradient-to-r ${statusConfig.gradient} p-5 relative overflow-hidden flex-shrink-0`}>
          {/* Background pattern */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVHJhbnNmb3JtPSJyb3RhdGUoNDUpIj48cGF0aCBkPSJNLTEwIDMwaDYwdjJoLTYweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA4KSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNhKSIvPjwvc3ZnPg==')] opacity-50"></div>
          
          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm flex-shrink-0">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-white">Appointment Details</h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="px-2 py-0.5 bg-white/20 rounded-full text-[11px] font-bold text-white backdrop-blur-sm">
                      {appointment.appointmentId}
                    </span>
                    <span className="text-white/80 text-xs">•</span>
                    <span className="text-white/80 text-xs">{timeAgo}</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="w-9 h-9 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all backdrop-blur-sm flex-shrink-0"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Status Badge */}
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${statusConfig.bg} ${statusConfig.border} border`}>
                {statusConfig.icon}
                <span className={`font-bold text-xs ${statusConfig.text}`}>{statusConfig.label}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* Quick Info Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-3 border border-blue-100">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <User className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <span className="text-[10px] font-bold text-blue-600 uppercase">Citizen</span>
              </div>
              <p className="text-sm font-bold text-gray-900 truncate" title={appointment.citizenName}>{appointment.citizenName}</p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50 rounded-xl p-3 border border-purple-100 group relative">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Target className="w-3.5 h-3.5 text-purple-600" />
                </div>
                <span className="text-[10px] font-bold text-purple-600 uppercase">Purpose</span>
              </div>
              <p className="text-sm font-bold text-gray-900 truncate" title={appointment.purpose}>
                {appointment.purpose}
              </p>
              {/* Tooltip for full purpose */}
              {appointment.purpose && appointment.purpose.length > 15 && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-9999 pointer-events-none shadow-lg">
                  {appointment.purpose}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                </div>
              )}
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-3 border border-emerald-100">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <span className="text-[10px] font-bold text-emerald-600 uppercase">Scheduled</span>
              </div>
              <p className="text-sm font-bold text-gray-900">{format(appointmentDate, 'dd MMM yyyy')}</p>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-3 border border-amber-100">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <span className="text-[10px] font-bold text-amber-600 uppercase">Time</span>
              </div>
              <p className="text-sm font-bold text-gray-900">{appointment.appointmentTime}</p>
            </div>
          </div>
          {/* Citizen Information */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="bg-gradient-to-r from-slate-50 to-blue-50 px-5 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                Citizen Information
              </h3>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Full Name</p>
                    <p className="text-sm font-bold text-slate-800 truncate">{appointment.citizenName}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Phone className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Phone Number</p>
                    <p className="text-sm font-bold text-slate-800">{appointment.citizenPhone}</p>
                  </div>
                </div>

                {appointment.citizenWhatsApp && (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <MessageCircle className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">WhatsApp</p>
                      <p className="text-sm font-bold text-slate-800">{appointment.citizenWhatsApp}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Appointment Purpose */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="bg-gradient-to-r from-slate-50 to-purple-50 px-5 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-600" />
                Appointment Purpose
              </h3>
            </div>
            <div className="p-5">
              <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl p-4 border border-slate-100">
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {appointment.purpose || 'No purpose provided'}
                </p>
              </div>
            </div>
          </div>

          {/* Service Timeline */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="bg-gradient-to-r from-slate-50 to-blue-50 px-5 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                Service Timeline
              </h3>
            </div>
            <div className="p-5">
              <div className="relative pl-8 space-y-6">
                {/* Vertical Line */}
                <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-gradient-to-b from-emerald-400 via-blue-400 to-slate-200 rounded-full"></div>
                
                {/* Creation Entry */}
                <div className="relative">
                  <div className="absolute -left-8 top-0 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-200">
                    <Calendar className="w-3 h-3 text-white" />
                  </div>
                  <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl p-4 border border-emerald-100 ml-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Appointment Booked</span>
                      <span className="text-[10px] text-emerald-600 font-medium bg-emerald-100 px-2 py-0.5 rounded-full">
                        {format(new Date(appointment.createdAt), 'MMM dd, yyyy • hh:mm a')}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">Appointment successfully scheduled via WhatsApp Chatbot</p>
                  </div>
                </div>

              {/* Dynamic Timeline Entries */}
              {appointment.timeline && appointment.timeline.length > 0 ? (
                appointment.timeline.map((event, index) => {
                  if (event.action === 'CREATED') return null;

                  let iconBg = 'bg-blue-500';
                  let cardBg = 'from-blue-50 to-indigo-50';
                  let borderColor = 'border-blue-100';
                  let textColor = 'text-blue-700';
                  let icon = <RefreshCw className="w-3 h-3 text-white" />;
                  let title = 'Activity Logged';
                  let description = '';

                  switch (event.action) {
                    case 'ASSIGNED':
                      iconBg = 'bg-orange-500';
                      cardBg = 'from-orange-50 to-amber-50';
                      borderColor = 'border-orange-100';
                      textColor = 'text-orange-700';
                      icon = <User className="w-3 h-3 text-white" />;
                      title = 'Officer Assigned';
                      description = `Assigned to ${event.details?.toUserName || 'an officer'}`;
                      break;
                    case 'STATUS_UPDATED':
                      const isSuccess = event.details?.toStatus === 'COMPLETED' || event.details?.toStatus === 'CONFIRMED' || event.details?.toStatus === 'SCHEDULED';
                      const isFailure = event.details?.toStatus === 'CANCELLED' || event.details?.toStatus === 'NO_SHOW';
                      iconBg = isSuccess ? 'bg-emerald-500' : isFailure ? 'bg-red-500' : 'bg-blue-500';
                      cardBg = isSuccess ? 'from-emerald-50 to-green-50' : isFailure ? 'from-red-50 to-rose-50' : 'from-blue-50 to-indigo-50';
                      borderColor = isSuccess ? 'border-emerald-100' : isFailure ? 'border-red-100' : 'border-blue-100';
                      textColor = isSuccess ? 'text-emerald-700' : isFailure ? 'text-red-700' : 'text-blue-700';
                      icon = isSuccess ? <CheckCircle2 className="w-3 h-3 text-white" /> : 
                             isFailure ? <AlertCircle className="w-3 h-3 text-white" /> : 
                             <RefreshCw className="w-3 h-3 text-white" />;
                      title = `Status: ${event.details?.toStatus?.replace('_', ' ')}`;
                      description = event.details?.remarks || 'Status updated by administration';
                      break;
                    case 'DEPARTMENT_TRANSFER':
                      iconBg = 'bg-purple-500';
                      cardBg = 'from-purple-50 to-fuchsia-50';
                      borderColor = 'border-purple-100';
                      textColor = 'text-purple-700';
                      icon = <Building className="w-3 h-3 text-white" />;
                      title = 'Department Transferred';
                      description = 'Transferred to another department for resolution';
                      break;
                  }

                  const performer = typeof event.performedBy === 'object' 
                    ? `${event.performedBy.firstName} ${event.performedBy.lastName}` 
                    : 'System';

                  return (
                    <div key={index} className="relative">
                      <div className={`absolute -left-8 top-0 w-6 h-6 rounded-full ${iconBg} flex items-center justify-center shadow-lg`}>
                        {icon}
                      </div>
                      <div className={`bg-gradient-to-r ${cardBg} rounded-xl p-4 border ${borderColor} ml-2`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-xs font-bold ${textColor} uppercase tracking-wide`}>{title}</span>
                          <span className="text-[10px] text-slate-500 font-medium bg-white/50 px-2 py-0.5 rounded-full">
                            {format(new Date(event.timestamp), 'MMM dd, yyyy • hh:mm a')}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600">{description}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-[10px] text-slate-400">By {performer}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                // Fallback (for older records)
                (appointment as any).completedAt && (
                   <div className="relative">
                    <div className="absolute -left-8 top-0 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-white" />
                    </div>
                    <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl p-4 border border-emerald-100 ml-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Completed</span>
                        <span className="text-[10px] text-emerald-600 font-medium bg-emerald-100 px-2 py-0.5 rounded-full">
                          {format(new Date((appointment as any).completedAt), 'MMM dd, yyyy • hh:mm a')}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-200 flex justify-end bg-white flex-shrink-0">
          <Button 
            onClick={onClose}
            className="px-6 py-2 bg-slate-700 hover:bg-slate-800 text-white font-semibold rounded-lg transition-colors"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AppointmentDetailDialog;
