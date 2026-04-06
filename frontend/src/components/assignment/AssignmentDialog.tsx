import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { userAPI, User } from '../../lib/api/user';
import { departmentAPI, Department } from '../../lib/api/department';
import { UserCircle, Building2, Search, Loader2, UserCheck, Mail, Shield, ChevronRight, X, Users, ArrowRight, Layers } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../ui/LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';
import { SearchableSelect } from '../ui/SearchableSelect';

interface AssignmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAssign: (userId: string, departmentId?: string) => Promise<void>;
  itemType: 'grievance' | 'appointment';
  itemId: string; 
  companyId: string;
  currentAssignee?: string | { _id: string; firstName: string; lastName: string };
  currentDepartmentId?: string;
  currentSubDepartmentId?: string;
  userRole?: string;
  userDepartmentId?: string;
  currentUserId?: string; // Current logged-in user ID to filter out from assignee list
}

/**
 * Role-based filtering rules:
 * - COMPANY_ADMIN: sees ALL departments (top-level) and their sub-departments
 * - DEPARTMENT_ADMIN: sees only their own department's sub-departments (dept dropdown locked to their dept)
 * - Others (OPERATOR, SUB_DEPT users): sees only sub-departments of their own sub-department hierarchy
 */
export default function AssignmentDialog({
  isOpen,
  onClose,
  onAssign,
  itemType,
  itemId,
  companyId,
  currentAssignee,
  currentDepartmentId,
  currentSubDepartmentId,
  userRole,
  userDepartmentId,
  currentUserId
}: AssignmentDialogProps) {
  const { user: authUser } = useAuth();
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedSubDepartment, setSelectedSubDepartment] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null);

  // Determine the effective role for filtering
  const effectiveRole = userRole || authUser?.role || '';

  // ──────────────────────────────────────────────────────────
  // Derived data from allDepartments based on role
  // ──────────────────────────────────────────────────────────

  /**
   * Top-level (parent) departments visible to the current user.
   * - COMPANY_ADMIN: all departments with no parent
   * - DEPARTMENT_ADMIN: only their own department (as the "top-level")
   * - Others: the sub-department the user belongs to (treated as their scope)
   */
  const visibleTopDepts = useMemo(() => {
    if (!allDepartments.length) return [];

    if (effectiveRole === 'COMPANY_ADMIN') {
      // Show all departments that have no parent (true top-level departments)
      return allDepartments.filter(d => {
        const pId = typeof d.parentDepartmentId === 'object'
          ? (d.parentDepartmentId as any)?._id
          : d.parentDepartmentId;
        return !pId;
      });
    }

    if (effectiveRole === 'DEPARTMENT_ADMIN' && userDepartmentId) {
      // Show only the department admin's own department as the sole "parent"
      const myDept = allDepartments.find(d => d._id === userDepartmentId);
      return myDept ? [myDept] : [];
    }

    // For operators and other roles - show the department the user belongs to
    if (userDepartmentId) {
      const myDept = allDepartments.find(d => d._id === userDepartmentId);
      if (myDept) {
        // Check if user's dept is a sub-department (has a parent)
        const pId = typeof myDept.parentDepartmentId === 'object'
          ? (myDept.parentDepartmentId as any)?._id
          : myDept.parentDepartmentId;
        if (pId) {
          // User is in a sub-dept; show the parent department
          const parentDept = allDepartments.find(d => d._id === pId);
          return parentDept ? [parentDept] : [myDept];
        }
        return [myDept];
      }
    }

    // Fallback: show all top-level
    return allDepartments.filter(d => {
      const pId = typeof d.parentDepartmentId === 'object'
        ? (d.parentDepartmentId as any)?._id
        : d.parentDepartmentId;
      return !pId;
    });
  }, [allDepartments, effectiveRole, userDepartmentId]);

  /**
   * Sub-departments under the currently selected top-level department.
   * - COMPANY_ADMIN: all sub-departments of selected dept
   * - DEPARTMENT_ADMIN: all sub-departments of their dept (selectedDept is locked to their dept)
   * - Others: only sub-departments of the user's own sub-department scope
   */
  const visibleSubDepts = useMemo(() => {
    if (!selectedDepartment || !allDepartments.length) return [];

    const allSubOfSelected = allDepartments.filter(d => {
      const pId = typeof d.parentDepartmentId === 'object'
        ? (d.parentDepartmentId as any)?._id
        : d.parentDepartmentId;
      return pId === selectedDepartment;
    });

    if (effectiveRole === 'COMPANY_ADMIN' || effectiveRole === 'DEPARTMENT_ADMIN') {
      return allSubOfSelected;
    }

    // For operators/others: if their assigned dept is a sub-dept within selectedDepartment,
    // show only that sub-department (restrict to their own sub-dept)
    if (userDepartmentId) {
      const myDept = allDepartments.find(d => d._id === userDepartmentId);
      if (myDept) {
        const myParentId = typeof myDept.parentDepartmentId === 'object'
          ? (myDept.parentDepartmentId as any)?._id
          : myDept.parentDepartmentId;
        if (myParentId === selectedDepartment) {
          // User belongs to a sub-dept: only show their own sub-dept
          return allSubOfSelected.filter(d => d._id === userDepartmentId);
        }
      }
    }

    return allSubOfSelected;
  }, [selectedDepartment, allDepartments, effectiveRole, userDepartmentId]);

  // ──────────────────────────────────────────────────────────
  // Effects
  // ──────────────────────────────────────────────────────────

  // Reset on open/close
  useEffect(() => {
    if (isOpen) {
      fetchAllDepartments();
      setSearchQuery('');
    } else {
      setUsers([]);
      setAllDepartments([]);
      setSelectedDepartment('');
      setSelectedSubDepartment('');
      setAssigningUserId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, companyId]);

  // Auto-select department once departments are loaded
  useEffect(() => {
    if (!allDepartments.length || !isOpen) return;

    if (selectedDepartment) return; // already selected

    // Try to auto-select based on current grievance/appointment dept
    if (currentDepartmentId) {
      const dept = allDepartments.find(d => d._id === currentDepartmentId);
      if (dept) {
        const parentId = typeof dept.parentDepartmentId === 'object'
          ? (dept.parentDepartmentId as any)?._id
          : dept.parentDepartmentId;

        if (parentId) {
          // currentDepartmentId is actually a sub-dept; select the parent
          setSelectedDepartment(parentId);
          setSelectedSubDepartment(currentDepartmentId);
          return;
        } else {
          setSelectedDepartment(currentDepartmentId);
        }
      }
    }

    // Handle currentSubDepartmentId
    if (currentSubDepartmentId) {
      const subDept = allDepartments.find(d => d._id === currentSubDepartmentId);
      if (subDept) {
        const parentId = typeof subDept.parentDepartmentId === 'object'
          ? (subDept.parentDepartmentId as any)?._id
          : subDept.parentDepartmentId;
        if (parentId) {
          setSelectedDepartment(parentId);
          setSelectedSubDepartment(currentSubDepartmentId);
          return;
        }
      }
    }

    // Default: lock to user's dept if DEPARTMENT_ADMIN or operator
    if ((effectiveRole === 'DEPARTMENT_ADMIN' || effectiveRole === 'OPERATOR') && userDepartmentId) {
      const myDept = allDepartments.find(d => d._id === userDepartmentId);
      if (myDept) {
        const parentId = typeof myDept.parentDepartmentId === 'object'
          ? (myDept.parentDepartmentId as any)?._id
          : myDept.parentDepartmentId;
        if (parentId) {
          setSelectedDepartment(parentId);
          setSelectedSubDepartment(userDepartmentId);
        } else {
          setSelectedDepartment(userDepartmentId);
        }
        return;
      }
    }

    // Fallback: select first visible top-level dept
    if (visibleTopDepts.length > 0) {
      setSelectedDepartment(visibleTopDepts[0]._id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDepartments, isOpen]);

  // Clear sub-department if it doesn't belong to newly selected parent
  useEffect(() => {
    if (selectedSubDepartment && visibleSubDepts.length > 0) {
      const belongs = visibleSubDepts.some(s => s._id === selectedSubDepartment);
      if (!belongs) {
        setSelectedSubDepartment('');
      }
    }
  }, [selectedDepartment, visibleSubDepts, selectedSubDepartment]);

  // Fetch users when department/subdept selection changes
  useEffect(() => {
    if (isOpen && selectedDepartment) {
      fetchUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDepartment, selectedSubDepartment, isOpen]);

  // ──────────────────────────────────────────────────────────
  // API calls
  // ──────────────────────────────────────────────────────────

  const fetchAllDepartments = async () => {
    setLoadingDepts(true);
    try {
      // Fetch all departments (limit=500 to get all)
      const deptRes = await departmentAPI.getAll({ companyId, limit: 200});
      if (deptRes.success) {
        setAllDepartments(deptRes.data.departments);
      }
    } catch (error) {
      toast.error('Failed to load departments');
      console.error(error);
    } finally {
      setLoadingDepts(false);
    }
  };

  const fetchUsers = async () => {
    // Use sub-department if selected, otherwise use the top-level department
    const targetDeptId = selectedSubDepartment || selectedDepartment;
    if (!targetDeptId) return;
    
    setLoading(true);
    try {
      const usersRes = await userAPI.getAll({ 
        companyId,
        departmentId: targetDeptId,
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
        const newDept = allDepartments.find(d => d._id === userDeptId);
        toast.success(
          `${itemType === 'grievance' ? 'Grievance' : 'Appointment'} assigned to ${userName} and transferred to ${newDept?.name || 'new department'}`,
          { id: toastId, duration: 1000 }
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
    if (typeof currentAssignee === 'object') {
      return `${currentAssignee.firstName} ${currentAssignee.lastName}`;
    }
    
    const userInList = users.find(u => u._id === currentAssignee || u.userId === currentAssignee);
    if (userInList) return `${userInList.firstName} ${userInList.lastName}`;
    
    return currentAssignee;
  };

  const filteredUsers = useMemo(() => {
    let filtered = users;
    if (currentUserId) {
      filtered = filtered.filter(user => user._id !== currentUserId);
    }
    
    if (!searchQuery) return filtered;
    
    const query = searchQuery.toLowerCase();
    return filtered.filter(user => {
      const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
      const emailVal = (user.email || "").toLowerCase();
      const userIdVal = (user.userId || "").toLowerCase();
      return fullName.includes(query) || 
             emailVal.includes(query) ||
             userIdVal.includes(query);
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

  // Whether the department dropdown should be disabled (locked)
  const isDeptLocked = effectiveRole === 'DEPARTMENT_ADMIN' || 
    (effectiveRole !== 'COMPANY_ADMIN' && effectiveRole !== 'SUPER_ADMIN' && !!userDepartmentId);

  const hasSubDepts = visibleSubDepts.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent hideClose className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0 rounded-[2rem] border-0 shadow-2xl bg-white">
        {/* Modern Slate Header */}
        <div className="bg-slate-900 p-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-purple-500/10"></div>
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl"></div>
          
          <div className="relative flex items-start justify-between">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-xl border border-white/20 shadow-inner">
                <UserCheck className="w-7 h-7 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight">
                  Assign {itemType === 'grievance' ? 'Grievance' : 'Appointment'}
                </h2>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Currently With:</span>
                  <span className="px-3 py-1 bg-indigo-500/20 rounded-full text-[10px] font-black uppercase tracking-wider text-indigo-300 backdrop-blur-md border border-indigo-500/30">
                    {getCurrentAssigneeName()}
                  </span>
                </div>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all duration-300 border border-white/10 group cursor-pointer"
            >
              <X className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4 flex-1 overflow-visible flex flex-col bg-slate-50">
          {/* Filters */}
          <div className="flex flex-col space-y-3">
            {/* Search */}
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-indigo-500 transition-colors" />
              <input
                type="text"
                placeholder="Search name, email, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-all bg-white shadow-sm font-medium"
              />
            </div>

            {/* Department & Sub-Department Dropdowns - Always shown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Department Dropdown */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                  Department
                  {isDeptLocked && (
                    <span className="text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full border">Locked</span>
                  )}
                </label>
                <div className="relative group">
                  <Building2 className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-indigo-500 transition-colors" />
                  <SearchableSelect
                    options={visibleTopDepts.map(d => ({ value: d._id, label: d.name }))}
                    value={selectedDepartment}
                    onValueChange={(value) => {
                        setSelectedDepartment(value);
                        setSelectedSubDepartment('');
                    }}
                    placeholder={loadingDepts ? 'Loading...' : 'Select Department'}
                    disabled={isDeptLocked || loadingDepts}
                  />
                </div>
              </div>

              {/* Sub-Department Dropdown */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-purple-400" />
                  Sub Department
                  {!hasSubDepts && selectedDepartment && (
                    <span className="text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full border">None available</span>
                  )}
                </label>
                <div className="relative group">
                  <Layers className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-purple-500 transition-colors" />
                  <SearchableSelect
                    options={visibleSubDepts.map(d => ({ value: d._id, label: d.name }))}
                    value={selectedSubDepartment}
                    onValueChange={(value) => setSelectedSubDepartment(value)}
                    placeholder={!selectedDepartment 
                        ? 'Select dept. first' 
                        : !hasSubDepts 
                          ? 'No sub-departments' 
                          : 'All (show dept. users)'}
                    disabled={!selectedDepartment || !hasSubDepts}
                  />
                </div>
              </div>
            </div>

            {/* Info banner showing current filter scope */}
            {selectedDepartment && (
              <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 rounded-xl border border-indigo-100 text-xs text-indigo-600 font-medium">
                <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  Showing users from: <strong>
                    {selectedSubDepartment 
                      ? visibleSubDepts.find(d => d._id === selectedSubDepartment)?.name 
                      : visibleTopDepts.find(d => d._id === selectedDepartment)?.name}
                  </strong>
                  {selectedSubDepartment && (
                    <span className="text-indigo-400"> (sub-department)</span>
                  )}
                </span>
              </div>
            )}
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
                <LoadingSpinner text="Loading users..." />
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
                  const currentAssigneeId = typeof currentAssignee === 'object' && currentAssignee !== null
                    ? currentAssignee._id 
                    : currentAssignee;
                  const isCurrentAssignee = currentAssigneeId === user._id;
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
                            <span className="break-words whitespace-normal">{user.email}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                              {user.userId}
                            </span>
                             <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${getRoleColor(user.role || "")}`}>
                               {(user.role || "CUSTOM").replace('_', ' ')}
                             </span>
                            {userDept && (
                              <span className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                <Building2 className="w-3 h-3" />
                                <span className="break-words whitespace-normal">{userDept.name}</span>
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
