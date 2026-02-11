import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { userAPI, User } from '../../lib/api/user';
import { departmentAPI, Department } from '../../lib/api/department';
import { UserCircle, Building2, Search, Loader2, UserCheck, Mail, Shield, ChevronRight, X, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../ui/LoadingSpinner';

interface AssignmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAssign: (userId: string, departmentId?: string) => Promise<void>;
  itemType: 'grievance' | 'appointment';
  itemId: string; 
  companyId: string;
  currentAssignee?: string | { _id: string; firstName: string; lastName: string };
  currentDepartmentId?: string;
  userRole?: string;
  userDepartmentId?: string;
  currentUserId?: string; // Current logged-in user ID to filter out from assignee list
}

export default function AssignmentDialog({
  isOpen,
  onClose,
  onAssign,
  itemType,
  itemId,
  companyId,
  currentAssignee,
  currentDepartmentId,
  userRole,
  userDepartmentId,
  currentUserId
}: AssignmentDialogProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchDepartments();
      setSearchQuery('');
    } else {
      setUsers([]);
      setSelectedDepartment('');
      setAssigningUserId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, companyId]);

  useEffect(() => {
    if (departments.length > 0 && !selectedDepartment) {
      if (currentDepartmentId) {
        setSelectedDepartment(currentDepartmentId);
      } else {
        setSelectedDepartment(departments[0]._id);
      }
    }
  }, [departments, currentDepartmentId, selectedDepartment]);

  useEffect(() => {
    if (isOpen && selectedDepartment) {
      fetchUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDepartment, isOpen]);

  const fetchDepartments = async () => {
    try {
      const deptRes = await departmentAPI.getAll({ companyId });
      if (deptRes.success) {
        let depts = deptRes.data.departments;
        if (userRole === 'DEPARTMENT_ADMIN' && userDepartmentId) {
          depts = depts.filter(d => d._id === userDepartmentId);
        }
        setDepartments(depts);
      }
    } catch (error) {
      toast.error('Failed to load departments');
      console.error(error);
    }
  };

  const fetchUsers = async () => {
    if (!selectedDepartment) return;
    
    setLoading(true);
    try {
      const usersRes = await userAPI.getAll({ 
        companyId,
        departmentId: selectedDepartment,
        limit: 100
      });
      if (usersRes.success) {
        setUsers(usersRes.data.users);
      }
    } catch (error) {
      toast.error('Failed to load users');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (userId: string) => {
    setAssigningUserId(userId);
    
    const assignedUser = users.find(u => u._id === userId);
    const userName = assignedUser ? `${assignedUser.firstName} ${assignedUser.lastName}` : 'officer';
    
    const toastId = toast.loading(`Assigning to ${userName}...`);
    
    try {
      const userDeptId = assignedUser?.departmentId 
        ? (typeof assignedUser.departmentId === 'object' ? assignedUser.departmentId._id : assignedUser.departmentId)
        : undefined;
      
      await onAssign(userId, userDeptId);
      
      if (userDeptId && currentDepartmentId && userDeptId !== currentDepartmentId) {
        const newDept = departments.find(d => d._id === userDeptId);
        toast.success(
          `${itemType === 'grievance' ? 'Grievance' : 'Appointment'} assigned to ${userName} and transferred to ${newDept?.name || 'new department'}`,
          { id: toastId, duration: 4000 }
        );
      } else {
        toast.success(`Successfully assigned to ${userName}!`, { id: toastId });
      }
      
      onClose();
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || 'Failed to assign';
      toast.error(msg, { id: toastId });
    } finally {
      setAssigningUserId(null);
    }
  };

  const getCurrentAssigneeName = () => {
    if (!currentAssignee) return 'Unassigned';
    if (typeof currentAssignee === 'string') return currentAssignee;
    return `${currentAssignee.firstName} ${currentAssignee.lastName}`;
  };

  const filteredUsers = useMemo(() => {
    // First, filter out the current user (department admin cannot assign to themselves)
    let filtered = users;
    if (currentUserId) {
      filtered = filtered.filter(user => user._id !== currentUserId);
    }
    
    // Then apply search filter
    if (!searchQuery) return filtered;
    
    const query = searchQuery.toLowerCase();
    return filtered.filter(user => {
      const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
      return fullName.includes(query) || 
             user.email.toLowerCase().includes(query) ||
             user.userId.toLowerCase().includes(query);
    });
  }, [users, searchQuery, currentUserId]);

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'DEPARTMENT_ADMIN':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'OPERATOR':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'COMPANY_ADMIN':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0 rounded-2xl border-0 shadow-2xl [&>button]:hidden">
        {/* Gradient Header */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVHJhbnNmb3JtPSJyb3RhdGUoNDUpIj48cGF0aCBkPSJNLTEwIDMwaDYwdjJoLTYweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA4KSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNhKSIvPjwvc3ZnPg==')] opacity-50"></div>
          
          <div className="relative flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <UserCheck className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  Assign {itemType === 'grievance' ? 'Grievance' : 'Appointment'}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-white/80 text-sm">Current:</span>
                  <span className="px-2.5 py-0.5 bg-white/20 rounded-full text-xs font-semibold text-white backdrop-blur-sm">
                    {getCurrentAssigneeName()}
                  </span>
                </div>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all z-10"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4 flex-1 overflow-hidden flex flex-col bg-slate-50">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by name, email, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all bg-white shadow-sm"
              />
            </div>

            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all bg-white shadow-sm appearance-none cursor-pointer"
                required
                disabled={userRole === 'DEPARTMENT_ADMIN'}
              >
                <option value="" disabled>Select Department</option>
                {departments.map((dept) => (
                  <option key={dept._id} value={dept._id}>
                    {dept.name}
                  </option>
                ))}
              </select>
              <ChevronRight className="absolute right-3 top-1/2 transform -translate-y-1/2 rotate-90 text-slate-400 w-4 h-4 pointer-events-none" />
            </div>
          </div>

          {/* Users List */}
          <div className="flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            {!selectedDepartment ? (
              <div className="p-10 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-600 font-medium">Please select a department</p>
                <p className="text-slate-400 text-sm mt-1">Choose a department to view available assignees</p>
              </div>
            ) : loading ? (
              <div className="p-10 text-center">
                <LoadingSpinner size="md" text="Loading users..." />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-10 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-600 font-medium">No users found</p>
                <p className="text-slate-400 text-sm mt-1">Try changing your search or department filter</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredUsers.map((user, index) => {
                  const userDept = typeof user.departmentId === 'object' 
                    ? user.departmentId 
                    : null;
                  const isCurrentAssignee = typeof currentAssignee === 'object' && currentAssignee !== null
                    ? currentAssignee._id === user._id 
                    : false;
                  const isAssigning = assigningUserId === user._id;

                  return (
                    <div
                      key={user._id}
                      className={`p-4 hover:bg-slate-50 transition-all duration-200 ${
                        isCurrentAssignee ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        {/* Avatar */}
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-md ${
                          isCurrentAssignee 
                            ? 'bg-gradient-to-br from-blue-500 to-indigo-600' 
                            : 'bg-gradient-to-br from-slate-400 to-slate-500'
                        }`}>
                          {user.firstName?.[0]}{user.lastName?.[0]}
                        </div>

                        {/* User Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-slate-900">
                              {user.firstName} {user.lastName}
                            </h4>
                            {isCurrentAssignee && (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded-full font-bold uppercase">
                                Current
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 text-slate-500 text-sm">
                            <Mail className="w-3.5 h-3.5" />
                            <span className="truncate">{user.email}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                              {user.userId}
                            </span>
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${getRoleColor(user.role)}`}>
                              {user.role.replace('_', ' ')}
                            </span>
                            {userDept && (
                              <span className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                <Building2 className="w-3 h-3" />
                                <span className="truncate max-w-[120px]">{userDept.name}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Assign Button */}
                        <Button
                          onClick={() => handleAssign(user._id)}
                          disabled={assigningUserId !== null || isCurrentAssignee}
                          size="sm"
                          className={`min-w-[100px] rounded-xl font-semibold transition-all shadow-md ${
                            isCurrentAssignee
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none'
                              : isAssigning
                              ? 'bg-blue-600'
                              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white'
                          }`}
                        >
                          {isAssigning ? (
                            <span className="flex items-center gap-1.5">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Assigning
                            </span>
                          ) : isCurrentAssignee ? (
                            <span className="flex items-center gap-1.5">
                              <UserCheck className="w-4 h-4" />
                              Assigned
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5">
                              <UserCheck className="w-4 h-4" />
                              Assign
                            </span>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-5 py-4 border-t border-slate-200 bg-white">
          <p className="text-xs text-slate-400">
            {filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'} available
          </p>
          <Button 
            onClick={onClose} 
            variant="outline"
            className="rounded-xl border-slate-200 hover:bg-slate-50"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
