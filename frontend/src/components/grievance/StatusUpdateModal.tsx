'use client';

import { X, RefreshCw } from 'lucide-react';
import StatusUpdateForm from './StatusUpdateForm';

interface StatusUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  itemType: 'grievance' | 'appointment';
  currentStatus: string;
  onSuccess: () => void;
  /** For grievance only: 'operator' = 2 buttons (Resolved, Rejected); 'department-admin' = 4 buttons (Pending, Assigned, Resolved, Rejected) */
  grievanceVariant?: 'operator' | 'department-admin';
  initialDate?: string;
  initialTime?: string;
}

export default function StatusUpdateModal({
  isOpen,
  onClose,
  itemId,
  itemType,
  currentStatus,
  onSuccess,
  grievanceVariant,
  initialDate,
  initialTime
}: StatusUpdateModalProps) {
  if (!isOpen) return null;

  const typeLabel = itemType === 'grievance' ? 'Grievance' : 'Appointment';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header — matching the new overview theme */}
        <div className="bg-slate-900 p-5 flex items-center justify-between flex-shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center border border-emerald-500/30">
              <RefreshCw className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Update Status</h2>
              <p className="text-xs text-cyan-50 font-semibold uppercase tracking-[0.08em] mt-0.5">
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

        <div className="overflow-y-auto flex-1">
          <StatusUpdateForm
            itemId={itemId}
            itemType={itemType}
            currentStatus={currentStatus}
            onSuccess={() => {
              onSuccess();
              onClose();
            }}
            onCancel={onClose}
            grievanceVariant={grievanceVariant}
            initialDate={initialDate}
            initialTime={initialTime}
            showCancelButton={true}
          />
        </div>
      </div>
    </div>
  );
}
