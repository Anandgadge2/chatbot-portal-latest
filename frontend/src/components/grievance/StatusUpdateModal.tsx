'use client';

import { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, Clock, MessageSquare, RefreshCw, Ban } from 'lucide-react';
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
    }
  }, [isOpen, currentStatus]);

  const handleUpdate = async () => {
    if (selectedStatus === currentStatus) {
      toast.error('Please select a different status');
      return;
    }

    try {
      setSubmitting(true);
      const response = await apiClient.put(
        `/status/${itemType}/${itemId}`,
        { status: selectedStatus, remarks }
      );

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
            disabled={selectedStatus === currentStatus || submitting}
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
