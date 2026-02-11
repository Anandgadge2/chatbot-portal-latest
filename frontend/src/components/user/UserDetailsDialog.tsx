'use client';

import { User } from '@/lib/api/user';
import { X, User as UserIcon, Mail, Phone, Shield, Building, Calendar, CheckCircle, XCircle, Clock } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface UserDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

export default function UserDetailsDialog({
  isOpen,
  onClose,
  user
}: UserDetailsDialogProps) {
  if (!isOpen || !user) return null;

  const createdDate = new Date(user?.createdAt || '');
  const timeAgo = formatDistanceToNow(createdDate, { addSuffix: true });
  const updatedDate = user?.updatedAt ? new Date(user.updatedAt) : null;

  // Get role color
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'from-red-500 to-rose-600';
      case 'COMPANY_ADMIN':
        return 'from-blue-500 to-indigo-600';
      case 'DEPARTMENT_ADMIN':
        return 'from-purple-500 to-fuchsia-600';
      case 'OPERATOR':
        return 'from-emerald-500 to-teal-600';
      case 'ANALYTICS_VIEWER':
        return 'from-amber-500 to-orange-600';
      default:
        return 'from-gray-500 to-slate-600';
    }
  };

  const roleGradient = getRoleColor(user.role);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl bg-white animate-in fade-in zoom-in duration-200 flex flex-col">
        {/* Gradient Header */}
        <div className={`bg-gradient-to-r ${roleGradient} p-5 relative overflow-hidden flex-shrink-0`}>
          {/* Background pattern */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVHJhbnNmb3JtPSJyb3RhdGUoNDUpIj48cGF0aCBkPSJNLTEwIDMwaDYwdjJoLTYweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA4KSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNhKSIvPjwvc3ZnPg==')] opacity-50"></div>
          
          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm flex-shrink-0">
                  <UserIcon className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-white">User Details</h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="px-2 py-0.5 bg-white/20 rounded-full text-[11px] font-bold text-white backdrop-blur-sm">
                      {user.userId || `USER${user._id.substring(0, 8).toUpperCase()}`}
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
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* Quick Info Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <UserIcon className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-xs font-bold text-blue-600 uppercase">Name</span>
              </div>
              <p className="text-base font-bold text-gray-900 truncate" title={`${user.firstName} ${user.lastName}`}>
                {user.firstName} {user.lastName}
              </p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Shield className="w-4 h-4 text-purple-600" />
                </div>
                <span className="text-xs font-bold text-purple-600 uppercase">Role</span>
              </div>
              <p className="text-base font-bold text-gray-900 truncate" title={user.role}>
                {user.role.replace('_', ' ')}
              </p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-4 h-4 text-green-600" />
                </div>
                <span className="text-xs font-bold text-green-600 uppercase">Created</span>
              </div>
              <p className="text-base font-bold text-gray-900">
                {format(createdDate, 'dd MMM yyyy')}
              </p>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  {user.isActive ? (
                    <CheckCircle className="w-4 h-4 text-amber-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-amber-600" />
                  )}
                </div>
                <span className="text-xs font-bold text-amber-600 uppercase">Status</span>
              </div>
              <p className="text-base font-bold text-gray-900">
                {user.isActive ? 'Active' : 'Inactive'}
              </p>
            </div>
          </div>

          {/* User Information Section */}
          <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl p-5 border border-slate-200">
            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <UserIcon className="w-4 h-4 text-blue-600" />
              </div>
              User Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <UserIcon className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-semibold text-slate-500 uppercase">Full Name</span>
                </div>
                <p className="text-sm font-bold text-gray-900">{user.firstName} {user.lastName}</p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-semibold text-slate-500 uppercase">Email Address</span>
                </div>
                <p className="text-sm font-bold text-gray-900 break-all">{user.email}</p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <Phone className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-semibold text-slate-500 uppercase">Phone Number</span>
                </div>
                <p className="text-sm font-bold text-gray-900">{user.phone}</p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-semibold text-slate-500 uppercase">Role</span>
                </div>
                <p className="text-sm font-bold text-gray-900">{user.role.replace('_', ' ')}</p>
              </div>

              {user.departmentId && (
                <div className="bg-white rounded-lg p-4 border border-slate-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Building className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-semibold text-slate-500 uppercase">Department</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900">
                    {typeof user.departmentId === 'object' && user.departmentId !== null
                      ? (user.departmentId as any).name
                      : 'N/A'}
                  </p>
                </div>
              )}

              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-semibold text-slate-500 uppercase">Created At</span>
                </div>
                <p className="text-sm font-bold text-gray-900">
                  {format(createdDate, 'dd MMM yyyy, hh:mm a')}
                </p>
              </div>

              {updatedDate && (
                <div className="bg-white rounded-lg p-4 border border-slate-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-semibold text-slate-500 uppercase">Last Updated</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900">
                    {format(updatedDate, 'dd MMM yyyy, hh:mm a')}
                  </p>
                </div>
              )}

              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  {user.isActive ? (
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span className="text-xs font-semibold text-slate-500 uppercase">Account Status</span>
                </div>
                <p className={`text-sm font-bold ${user.isActive ? 'text-emerald-600' : 'text-red-600'}`}>
                  {user.isActive ? 'Active' : 'Inactive'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-5 py-4 bg-gradient-to-r from-slate-50 to-white border-t border-slate-200">
          <button
            onClick={onClose}
            className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
