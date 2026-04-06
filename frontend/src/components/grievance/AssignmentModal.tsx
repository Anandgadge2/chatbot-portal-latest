'use client';

import { useState, useEffect } from 'react';
import { X, Users, Check, UserCheck } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import toast from 'react-hot-toast';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role?: string;
  departmentId?: {
    name: string;
  };
}

interface AssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  itemType: 'grievance' | 'appointment';
  currentAssignee?: string;
  onSuccess: () => void;
}

export default function AssignmentModal({
  isOpen,
  onClose,
  itemId,
  itemType,
  currentAssignee,
  onSuccess
}: AssignmentModalProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchAvailableUsers();
    }
  }, [isOpen]);

  const fetchAvailableUsers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/assignments/users/available');
      if (response.success) {
        setUsers(response.data);
      }
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedUser) {
      toast.error('Please select a user to assign');
      return;
    }

    try {
      setSubmitting(true);
      const response = await apiClient.put(
        `/assignments/${itemType}/${itemId}/assign`,
        { assignedTo: selectedUser }
      );

      if (response.success) {
        toast.success(`${itemType === 'grievance' ? 'Grievance' : 'Appointment'} assigned successfully!`);
        onSuccess();
        onClose();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to assign');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const typeLabel = itemType === 'grievance' ? 'Grievance' : 'Appointment';

  return (
    <div className="fixed inset-0 bg-slate-500/10 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header — matching the new overview theme */}
        <div className="bg-slate-900 p-5 flex items-center justify-between flex-shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
              <UserCheck className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Assign {typeLabel}</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                Select an officer to handle this {itemType}
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

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-5">
          {loading ? (
            <div className="flex justify-center py-16">
              <LoadingSpinner text="Loading available officers..." />
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-3">
                <Users className="w-7 h-7 text-slate-400" />
              </div>
              <p className="text-sm font-bold text-slate-600">No Officers Available</p>
              <p className="text-xs text-slate-400 mt-1">No users are available for assignment</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                {users.length} Officers Available
              </p>
              {users.map((user) => {
                const isSelected = selectedUser === user._id;
                const isCurrent = currentAssignee === user._id;
                return (
                  <div
                    key={user._id}
                    onClick={() => !isCurrent && setSelectedUser(user._id)}
                    className={`
                      flex items-center justify-between p-3.5 rounded-xl border-2 cursor-pointer transition-all duration-150
                      ${isSelected
                        ? 'border-slate-800 bg-slate-50 shadow-sm ring-1 ring-blue-500/30'
                        : isCurrent
                        ? 'border-emerald-300 bg-emerald-50 cursor-not-allowed'
                        : 'border-slate-200 bg-white hover:border-slate-800/30 hover:bg-slate-50'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`
                        w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm flex-shrink-0
                        ${isSelected ? 'bg-slate-800 ring-1 ring-blue-500/50' : isCurrent ? 'bg-emerald-500' : 'bg-slate-300'}
                      `}>
                        {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {user.firstName} {user.lastName}
                          {isCurrent && <span className="ml-2 text-[9px] font-black text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded uppercase">Current</span>}
                        </p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                            {(user.role || "CUSTOM").replace('_', ' ')}
                          </span>
                          {user.departmentId && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              {user.departmentId.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-7 h-7 bg-slate-800 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg shadow-slate-900/40 ring-1 ring-blue-500/50">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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
            onClick={handleAssign}
            disabled={!selectedUser || submitting}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-slate-900/40 ring-1 ring-blue-500/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 active:scale-95"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                <span>Assigning...</span>
              </>
            ) : (
              <>
                <UserCheck className="w-4 h-4" />
                <span>Assign {typeLabel}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
