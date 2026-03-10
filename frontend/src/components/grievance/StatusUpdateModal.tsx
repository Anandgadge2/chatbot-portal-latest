'use client';

import { useState, useEffect } from 'react';
import { X, CheckCircle2, Clock, MessageSquare, RefreshCw, Ban, CalendarDays } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import toast from 'react-hot-toast';

interface StatusUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  itemType: 'grievance' | 'appointment';
  currentStatus: string;
  onSuccess: () => void;
  /** For grievance only: 'operator' = 2 buttons (Resolved, Rejected); 'department-admin' = 4 buttons (Pending, Assigned, Resolved, Rejected) */
  grievanceVariant?: 'operator' | 'department-admin';
}

const grievanceStatusesAll = [
  { value: 'PENDING', label: 'Pending', iconBg: 'bg-amber-100', iconColor: 'text-amber-600', badge: 'bg-amber-50 border-amber-200 text-amber-700', activeBadge: 'bg-amber-500 text-white border-amber-500', Icon: Clock },
  { value: 'ASSIGNED', label: 'Assigned', iconBg: 'bg-blue-100', iconColor: 'text-blue-600', badge: 'bg-blue-50 border-blue-200 text-blue-700', activeBadge: 'bg-blue-600 text-white border-blue-600', Icon: CheckCircle2 },
  { value: 'RESOLVED', label: 'Resolved', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', badge: 'bg-emerald-50 border-emerald-200 text-emerald-700', activeBadge: 'bg-emerald-600 text-white border-emerald-600', Icon: CheckCircle2 },
  { value: 'REJECTED', label: 'Rejected', iconBg: 'bg-rose-100', iconColor: 'text-rose-600', badge: 'bg-rose-50 border-rose-200 text-rose-700', activeBadge: 'bg-rose-600 text-white border-rose-600', Icon: Ban },
];

const grievanceStatusesOperator = [
  { value: 'RESOLVED', label: 'Resolved', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', badge: 'bg-emerald-50 border-emerald-200 text-emerald-700', activeBadge: 'bg-emerald-600 text-white border-emerald-600', Icon: CheckCircle2 },
  { value: 'REJECTED', label: 'Rejected', iconBg: 'bg-rose-100', iconColor: 'text-rose-600', badge: 'bg-rose-50 border-rose-200 text-rose-700', activeBadge: 'bg-rose-600 text-white border-rose-600', Icon: Ban },
];

const appointmentStatuses = [
  { value: 'SCHEDULED', label: 'Scheduled', iconBg: 'bg-blue-100', iconColor: 'text-blue-600', badge: 'bg-blue-50 border-blue-200 text-blue-700', activeBadge: 'bg-blue-600 text-white border-blue-600', Icon: Clock },
  { value: 'CONFIRMED', label: 'Confirmed', iconBg: 'bg-indigo-100', iconColor: 'text-indigo-600', badge: 'bg-indigo-50 border-indigo-200 text-indigo-700', activeBadge: 'bg-indigo-600 text-white border-indigo-600', Icon: CheckCircle2 },
  { value: 'COMPLETED', label: 'Completed', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', badge: 'bg-emerald-50 border-emerald-200 text-emerald-700', activeBadge: 'bg-emerald-600 text-white border-emerald-600', Icon: CheckCircle2 },
  { value: 'CANCELLED', label: 'Cancelled', iconBg: 'bg-rose-100', iconColor: 'text-rose-600', badge: 'bg-rose-50 border-rose-200 text-rose-700', activeBadge: 'bg-rose-600 text-white border-rose-600', Icon: Ban },
];

const CLOCK_HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

const to24Hour = (hour12: number, minute: number, period: 'AM' | 'PM') => {
  let hour24 = hour12 % 12;
  if (period === 'PM') hour24 += 12;
  return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const angleToPoint = (index: number, total: number, radius: number, center = 128) => {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
  return {
    x: center + radius * Math.cos(angle),
    y: center + radius * Math.sin(angle)
  };
};

export default function StatusUpdateModal({
  isOpen,
  onClose,
  itemId,
  itemType,
  currentStatus,
  onSuccess,
  grievanceVariant
}: StatusUpdateModalProps) {
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);
  const [remarks, setRemarks] = useState('');
  const [documents, setDocuments] = useState<File[]>([]);
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [clockHour, setClockHour] = useState(9);
  const [clockMinute, setClockMinute] = useState(0);
  const [clockPeriod, setClockPeriod] = useState<'AM' | 'PM'>('AM');
  const [clockMode, setClockMode] = useState<'hour' | 'minute'>('hour');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const grievanceStatuses =
    itemType === 'grievance' && grievanceVariant === 'operator'
      ? grievanceStatusesOperator
      : grievanceStatusesAll;
  const statuses = itemType === 'grievance' ? grievanceStatuses : appointmentStatuses;

  useEffect(() => {
    if (isOpen) {
      setSelectedStatus(currentStatus);
      setRemarks('');
      setDocuments([]);
      setAppointmentDate('');
      setAppointmentTime('');
      setClockHour(9);
      setClockMinute(0);
      setClockPeriod('AM');
      setClockMode('hour');
      setDescription('');
    }
  }, [isOpen, currentStatus]);

  const handleUpdate = async () => {
    if (selectedStatus === currentStatus) {
      toast.error('Please select a different status');
      return;
    }

    if (itemType === 'appointment' && selectedStatus === 'CONFIRMED') {
      if (!appointmentDate) {
        toast.error('Please select confirmation date');
        return;
      }
      if (!appointmentTime) {
        toast.error('Please select confirmation time from the clock');
        return;
      }
    }

    try {
      setSubmitting(true);
      let response;
      if (itemType === 'grievance') {
        const formData = new FormData();
        formData.append('status', selectedStatus);
        if (remarks) formData.append('remarks', remarks);
        if (selectedStatus === 'RESOLVED' && documents.length > 0) {
          documents.forEach((file) => formData.append('documents', file));
        }
        response = await apiClient.put(
          `/status/${itemType}/${itemId}`,
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
      } else {
        response = await apiClient.put(
          `/status/${itemType}/${itemId}`,
          {
            status: selectedStatus,
            remarks,
            appointmentDate: selectedStatus === 'CONFIRMED' ? appointmentDate : undefined,
            appointmentTime: selectedStatus === 'CONFIRMED' ? appointmentTime : undefined,
            description: selectedStatus === 'CONFIRMED' ? description : undefined
          }
        );
      }

      if (response.success) {
        toast.success(
          `${itemType === 'grievance' ? 'Grievance' : 'Appointment'} status updated! Citizen notified via WhatsApp.`,
          { duration: 5000 }
        );
        onSuccess();
        onClose();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update status');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const currentStatusInfo = statuses.find(s => s.value === currentStatus) || statuses[0];
  const typeLabel = itemType === 'grievance' ? 'Grievance' : 'Appointment';

  const computedClockTime = to24Hour(clockHour, clockMinute, clockPeriod);
  const activeIndex = clockMode === 'hour' ? CLOCK_HOURS_12.indexOf(clockHour) : Math.round(clockMinute / 5) % 12;
  const handPoint = angleToPoint(activeIndex, 12, 75);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        {/* Dark Header */}
        <div className="bg-slate-900 p-5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center border border-emerald-500/30">
              <RefreshCw className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Update Status</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                Change {typeLabel} Status & Notify Citizen
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* Current Status */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Current Status</p>
            {currentStatusInfo && (
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 ${currentStatusInfo.iconBg} rounded-lg flex items-center justify-center`}>
                  <currentStatusInfo.Icon className={`w-4 h-4 ${currentStatusInfo.iconColor}`} />
                </div>
                <span className={`px-3 py-1 rounded-lg border text-xs font-bold uppercase tracking-wider ${currentStatusInfo.badge}`}>
                  {currentStatusInfo.label}
                </span>
              </div>
            )}
          </div>

          {/* Status Selection */}
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">
              Select New Status <span className="text-rose-500">*</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              {statuses.map((status) => {
                const isSelected = selectedStatus === status.value;
                const isCurrent = status.value === currentStatus;
                return (
                  <button
                    key={status.value}
                    onClick={() => !isCurrent && setSelectedStatus(status.value)}
                    disabled={isCurrent}
                    className={`
                      flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 font-bold text-xs uppercase tracking-wider transition-all duration-150
                      ${isSelected
                        ? `${status.activeBadge} shadow-md ring-2 ring-offset-2 ring-slate-200`
                        : isCurrent
                        ? `${status.badge} opacity-50 cursor-not-allowed`
                        : `${status.badge} hover:shadow-sm cursor-pointer`
                      }
                    `}
                  >
                    <status.Icon className="w-4 h-4 flex-shrink-0" />
                    {status.label}
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 ml-auto flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {itemType === 'appointment' && selectedStatus === 'CONFIRMED' && (
            <div className="space-y-4 bg-indigo-50/40 border border-indigo-100 rounded-xl p-4">
              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Confirmation Date *</label>
                <input
                  type="date"
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Select Time (Clock) *</label>
                <div className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-center mb-3">
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100">
                    Selected: {appointmentTime || `${computedClockTime} (tap Apply)`}
                  </span>
                </div>
                <div className="relative w-64 h-64 mx-auto rounded-full border-[5px] border-indigo-200/90 bg-gradient-to-b from-indigo-50 to-white shadow-inner scale-90 sm:scale-100">
                  {(clockMode === 'hour' ? CLOCK_HOURS_12 : Array.from({ length: 12 }, (_, i) => i * 5)).map((value, idx) => {
                    const { x, y } = angleToPoint(idx, 12, 102);
                    const active = clockMode === 'hour' ? clockHour === value : Math.round(clockMinute / 5) % 12 === idx;
                    return (
                      <button
                        key={`${clockMode}-${value}`}
                        type="button"
                        onClick={() => {
                          if (clockMode === 'hour') {
                            setClockHour(value);
                            setClockMode('minute');
                          } else {
                            setClockMinute(value);
                          }
                        }}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 text-[11px] px-2.5 py-1.5 rounded-full border font-semibold transition-all duration-200 ${active ? 'bg-indigo-600 text-white border-indigo-600 scale-110 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'}`}
                        style={{ left: `${x}px`, top: `${y}px` }}
                      >
                        {clockMode === 'hour' ? value : String(value).padStart(2, '0')}
                      </button>
                    );
                  })}
                  <div className="absolute inset-0 pointer-events-none">
                    <svg className="w-full h-full" viewBox="0 0 256 256">
                      <line x1="128" y1="128" x2={handPoint.x} y2={handPoint.y} stroke="#6366f1" strokeWidth="2.5" />
                      <circle cx="128" cy="128" r="5" fill="#6366f1" />
                    </svg>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-20 h-20 rounded-full border border-indigo-200 bg-white shadow-sm flex flex-col items-center justify-center">
                      <CalendarDays className="w-7 h-7 text-indigo-400" />
                      <span className="text-[10px] font-bold text-indigo-500 mt-1">CLOCK</span>
                    </div>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setClockMode('hour')} className={`py-1.5 rounded-lg text-xs font-bold border ${clockMode === 'hour' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200'}`}>Hour</button>
                  <button type="button" onClick={() => setClockMode('minute')} className={`py-1.5 rounded-lg text-xs font-bold border ${clockMode === 'minute' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200'}`}>Minute</button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="flex gap-2">
                    {(['AM', 'PM'] as const).map((period) => (
                      <button
                        key={period}
                        type="button"
                        onClick={() => setClockPeriod(period)}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold border ${clockPeriod === period ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200'}`}
                      >
                        {period}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-2 col-span-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-500 w-7">Hr</span>
                      <input type="range" min={1} max={12} value={clockHour} onChange={(e) => { setClockHour(Number(e.target.value)); setClockMode('hour'); }} className="w-full" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-500 w-7">Min</span>
                      <input type="range" min={0} max={59} value={clockMinute} onChange={(e) => { setClockMinute(Number(e.target.value)); setClockMode('minute'); }} className="w-full" />
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAppointmentTime(computedClockTime)}
                  className="mt-3 w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
                >
                  Apply {computedClockTime}
                </button>
                </div>
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Description (optional)</label>
                <textarea value={description} onChange={(e)=>setDescription(e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Add meeting details" />
              </div>
            </div>
          )}

          {/* Remarks */}
          <div>
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">
              Remarks / Notes <span className="text-slate-400 font-normal normal-case">(optional but recommended)</span>
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none transition-all bg-white text-sm placeholder:text-slate-400"
              placeholder="Add notes, comments, or instructions about this status change. These will be sent to the citizen via WhatsApp..."
            />
          </div>

          {itemType === 'grievance' && selectedStatus === 'RESOLVED' && (
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Upload Relevant Documents <span className="text-slate-400 font-normal normal-case">(optional)</span>
              </label>
              <input
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                onChange={(e) => setDocuments(Array.from(e.target.files || []))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
              />
              {documents.length > 0 && (
                <p className="text-[11px] text-slate-500 mt-2">
                  {documents.length} file(s) selected. These will be uploaded and shared as links with the citizen.
                </p>
              )}
            </div>
          )}

          {/* WhatsApp Notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-3">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-800">Citizen Will Be Notified via WhatsApp</p>
              <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                The citizen will automatically receive a WhatsApp message with the new status and your remarks.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-4 flex justify-end gap-3 border-t border-slate-200 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-5 py-2 border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUpdate}
            disabled={selectedStatus === currentStatus || submitting || (itemType === 'appointment' && selectedStatus === 'CONFIRMED' && (!appointmentDate || !appointmentTime))}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-md shadow-indigo-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                <span>Updating...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Update &amp; Notify</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
