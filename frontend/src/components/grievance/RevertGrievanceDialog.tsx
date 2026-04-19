'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, Undo2, ChevronDown } from 'lucide-react';
import { departmentAPI, Department } from '@/lib/api/department';

interface Props {
  isOpen: boolean;
  grievanceId?: string;
  onClose: () => void;
  onSubmit: (payload: { remarks: string; suggestedDepartmentId?: string; suggestedSubDepartmentId?: string }) => Promise<void>;
}

export default function RevertGrievanceDialog({ isOpen, grievanceId, onClose, onSubmit }: Props) {
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // 🏢 Hierarchical Department State
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [selectedMainDept, setSelectedMainDept] = useState('');
  const [selectedSubDept, setSelectedSubDept] = useState('');

  const fetchDepts = useCallback(async () => {
    setLoadingDepts(true);
    try {
      const response = await departmentAPI.getAll({ limit: 100, listAll: true });
      if (response.success) {
        setDepartments(response.data.departments);
      }
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    } finally {
      setLoadingDepts(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setRemarks('');
      setSelectedMainDept('');
      setSelectedSubDept('');
      fetchDepts();
    }
  }, [isOpen, fetchDepts]);

  // Filter departments for dropdowns
  const mainDepartments = departments.filter(d => !d.parentDepartmentId);
  const subDepartments = departments.filter(d => 
    d.parentDepartmentId && (
      typeof d.parentDepartmentId === 'string' 
        ? d.parentDepartmentId === selectedMainDept 
        : (d.parentDepartmentId as any)._id === selectedMainDept
    )
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-slate-900 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center">
              <Undo2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm">Request Reassignment</h3>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Send request to company admin</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Grievance ID</span>
            <span className="text-xs font-black text-slate-900 font-mono">{grievanceId || '-'}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">Target Department <span className="text-slate-400 normal-case">(optional)</span></label>
              <div className="relative group">
                <select
                  value={selectedMainDept}
                  onChange={(e) => {
                    setSelectedMainDept(e.target.value);
                    setSelectedSubDept('');
                  }}
                  className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all cursor-pointer"
                >
                  <option value="">Select Department</option>
                  {mainDepartments.map(d => (
                    <option key={d._id} value={d._id}>{d.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none group-hover:text-amber-500 transition-colors" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">Sub Department <span className="text-slate-400 normal-case">(optional)</span></label>
              <div className="relative group">
                <select
                  disabled={!selectedMainDept}
                  value={selectedSubDept}
                  onChange={(e) => setSelectedSubDept(e.target.value)}
                  className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">{!selectedMainDept ? 'Select department first' : subDepartments.length === 0 ? 'No sub-departments' : 'Select Sub-Dept'}</option>
                  {subDepartments.map(d => (
                    <option key={d._id} value={d._id}>{d.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">Note / Description for Reassignment *</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={4}
              placeholder="Explain why this grievance should be reassigned and which department/sub-department should handle it."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all resize-none"
            />
          </div>
        </div>

        <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
          <button 
            onClick={onClose} 
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={!remarks.trim() || submitting}
            onClick={async () => {
              setSubmitting(true);
              try {
                await onSubmit({ 
                  remarks: remarks.trim(), 
                  suggestedDepartmentId: selectedMainDept || undefined,
                  suggestedSubDepartmentId: selectedSubDept || undefined
                });
                onClose();
              } finally {
                setSubmitting(false);
              }
            }}
            className="px-6 py-2 text-xs font-black bg-amber-600 text-white rounded-xl shadow-lg shadow-amber-600/20 hover:bg-amber-700 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  );
}
