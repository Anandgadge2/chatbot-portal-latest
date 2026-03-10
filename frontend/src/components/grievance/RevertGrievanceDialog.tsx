'use client';

import { useEffect, useState } from 'react';
import { X, Undo2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  grievanceId?: string;
  onClose: () => void;
  onSubmit: (payload: { remarks: string; suggestedDepartmentId?: string }) => Promise<void>;
}

export default function RevertGrievanceDialog({ isOpen, grievanceId, onClose, onSubmit }: Props) {
  const [remarks, setRemarks] = useState('');
  const [suggestedDepartmentId, setSuggestedDepartmentId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRemarks('');
      setSuggestedDepartmentId('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-slate-900 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center">
              <Undo2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-white font-bold">Revert Grievance</h3>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest">Send back to company admin</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-600">Grievance: <span className="font-mono font-bold">{grievanceId || '-'}</span></p>
          <div>
            <label className="block text-xs font-semibold mb-1">Suggested Department ID (optional)</label>
            <input
              value={suggestedDepartmentId}
              onChange={(e) => setSuggestedDepartmentId(e.target.value)}
              placeholder="Enter target department id"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Revert Remarks *</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={4}
              placeholder="Explain why this grievance should be reassigned and which team should handle it."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold border rounded-lg">Cancel</button>
          <button
            disabled={!remarks.trim() || submitting}
            onClick={async () => {
              setSubmitting(true);
              try {
                await onSubmit({ remarks: remarks.trim(), suggestedDepartmentId: suggestedDepartmentId || undefined });
                onClose();
              } finally {
                setSubmitting(false);
              }
            }}
            className="px-4 py-2 text-xs font-semibold bg-amber-600 text-white rounded-lg disabled:opacity-50"
          >
            {submitting ? 'Reverting...' : 'Revert to Company Admin'}
          </button>
        </div>
      </div>
    </div>
  );
}
