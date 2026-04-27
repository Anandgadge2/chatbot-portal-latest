import { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { userAPI, User } from '../../lib/api/user';
import { departmentAPI, Department } from '../../lib/api/department';
import { Building2, Search, Loader2, UserCheck, Mail, X, Users, Layers } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../ui/LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';
import { SearchableSelect } from '../ui/SearchableSelect';
import UserDetailsDialog from '../user/UserDetailsDialog';

interface AssignmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAssign: (userId: string, departmentId?: string, note?: string) => Promise<void>;
  itemType: 'grievance' | 'appointment';
  itemId: string; 
  companyId: string;
  allDepartments?: Department[];
  currentAssignee?: string | { _id: string; firstName: string; lastName: string };
  currentDepartmentId?: string;
  currentSubDepartmentId?: string;
  userRole?: string;
  canReassignCurrent?: boolean;
  userDepartmentId?: string;
  currentUserId?: string; // Current logged-in user ID to filter out from assignee list
  displayId?: string; // Human readable ID like JSG0001
  onSuccess?: () => void;
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
  allDepartments: initialDepartments = [],
  currentAssignee,
  currentDepartmentId,
  currentSubDepartmentId,
  userRole,
  canReassignCurrent = false,
  userDepartmentId,
  currentUserId,
  displayId,
  onSuccess
}: AssignmentDialogProps) {
  const { user: authUser } = useAuth();
  const [allDepartments, setAllDepartments] = useState<Department[]>(initialDepartments);
  
  useEffect(() => {
    if (initialDepartments && initialDepartments.length > 0) {
      setAllDepartments(initialDepartments);
    }
  }, [initialDepartments]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedSubDepartment, setSelectedSubDepartment] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [assignmentNote, setAssignmentNote] = useState('');
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null);
  const [selectedUserProfile, setSelectedUserProfile] = useState<User | null>(null);
  const [allCompanyUsers, setAllCompanyUsers] = useState<User[]>([]);
  const [loadingAllUsers, setLoadingAllUsers] = useState(false);

  // Determine the effective role for filtering
  const getRoleString = (r: any): string => {
    if (!r) return '';
    if (typeof r === 'string') return r.toUpperCase();
    if (typeof r === 'object' && r.name) return r.name.toUpperCase();
    return '';
  };

  const effectiveRole = getRoleString(userRole || authUser?.role);
  
  const isTopLevelAdmin =
    effectiveRole.includes('COMPANY') ||
    effectiveRole.includes('SUPER') ||
    !!authUser?.isSuperAdmin ||
    (authUser?.level !== undefined && authUser.level <= 1);

  // ──────────────────────────────────────────────────────────
  // Derived data from allDepartments based on role
  // ──────────────────────────────────────────────────────────

  /**
   * Top-level (parent) departments visible to the current user.
   */
  const visibleTopDepts = useMemo(() => {
    // If no departments loaded yet, return empty
    if (!allDepartments.length) return [];

    const getParentId = (d: Department) => {
      if (!d?.parentDepartmentId) return null;
      const pId = typeof d.parentDepartmentId === 'object'
        ? (d.parentDepartmentId as any)?._id?.toString()
        : d.parentDepartmentId.toString();
      return pId === 'null' || pId === 'undefined' || !pId ? null : pId;
    };

    const allIds = new Set(allDepartments.map(d => d._id?.toString()).filter(Boolean));
    
    // A department is "top-level" if it has no parentId, OR if its parentId is not in our current company list
    const topLevelDepts = allDepartments.filter(d => {
      const pId = getParentId(d);
      return !pId || !allIds.has(pId);
    });

    // 🏆 UNRESTRICTED ADMIN ACCESS
    // If you are an admin, you MUST see departments. 
    // If our strict hierarchical filter (topLevelDepts) returns nothing for some reason, 
    // but the company has departments, we show ALL departments to the admin.
    if (isTopLevelAdmin) {
      return topLevelDepts.length > 0 ? topLevelDepts : allDepartments;
    }

    // Get user's mapped IDs (handling potential object vs string mismatch)
    const userMappedIds = new Set((authUser?.departmentIds || []).map(id => {
      if (!id) return '';
      const stringId = (typeof id === 'object') ? (id as any)?._id?.toString() : id.toString();
      return stringId;
    }).filter(Boolean));

    const allowedTopDeptIds = new Set<string>();

    allDepartments.forEach(d => {
      const dId = d._id?.toString();
      if (dId && userMappedIds.has(dId)) {
        const pId = getParentId(d);
        if (!pId || !allIds.has(pId)) {
          // Mapped to a top-level dept
          allowedTopDeptIds.add(dId);
        } else {
          // Mapped to a sub-dept, allow its parent
          allowedTopDeptIds.add(pId);
        }
      }
    });

    const filtered = topLevelDepts.filter(d => allowedTopDeptIds.has(d._id?.toString() || ''));
    
    // Safety fallback for mapped users: If filtered list is empty but user has mappings, show those mappings directly
    if (filtered.length === 0 && userMappedIds.size > 0) {
      return allDepartments.filter(d => userMappedIds.has(d._id?.toString() || ''));
    }

    return filtered;
  }, [allDepartments, isTopLevelAdmin, authUser?.departmentIds]);

  /**
   * Sub-departments under the currently selected top-level department.
   */
  const visibleSubDepts = useMemo(() => {
    if (!selectedDepartment || !allDepartments.length) return [];

    const getParentId = (d: Department) => {
      if (!d?.parentDepartmentId) return null;
      return typeof d.parentDepartmentId === 'object'
        ? (d.parentDepartmentId as any)?._id?.toString()
        : d.parentDepartmentId.toString();
    };

    const subDeptsOfParent = allDepartments.filter(d => getParentId(d) === selectedDepartment);

    if (isTopLevelAdmin) {
      return subDeptsOfParent;
    }

    const userMappedIds = new Set((authUser?.departmentIds || []).map(id => {
      if (!id) return '';
      return (typeof id === 'object') ? (id as any)?._id?.toString() : id.toString();
    }).filter(Boolean));

    // If user is mapped to the parent itself, grant access to all children
    if (userMappedIds.has(selectedDepartment)) {
      return subDeptsOfParent;
    }

    // Otherwise, filter to only those sub-depts they are specifically mapped to
    return subDeptsOfParent.filter(d => userMappedIds.has(d._id?.toString() || ''));
  }, [selectedDepartment, allDepartments, isTopLevelAdmin, authUser?.departmentIds]);

  // Reset on open/close
  useEffect(() => {
    if (isOpen) {
      if (!initialDepartments || initialDepartments.length === 0) {
        fetchAllDepartments();
      } else {
        setAllDepartments(initialDepartments);
      }
      setSearchQuery('');
    } else {
      // Only clear if we're not using props
      if (!initialDepartments || initialDepartments.length === 0) {
        setAllDepartments([]);
      }
      setSelectedDepartment('');
      setSelectedSubDepartment('');
      setAssignmentNote('');
      setAssigningUserId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialDepartments, companyId]);

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
    if (!isTopLevelAdmin && (authUser?.departmentIds?.length || 0) > 0) {
      // Use visibleTopDepts which is already filtered by role/mapping
      if (visibleTopDepts.length > 0) {
        setSelectedDepartment(visibleTopDepts[0]._id);
        
        // If it's a sub-dept admin, they might have only one sub-dept in this parent
        const subDepts = allDepartments.filter(d => {
          const pId = typeof d?.parentDepartmentId === 'object'
            ? (d?.parentDepartmentId as any)?._id
            : d?.parentDepartmentId;
          return pId === visibleTopDepts[0]._id;
        });

        const userMappedIds = new Set((authUser?.departmentIds || []).map(id => id.toString()));
        const mySubDepts = subDepts.filter(d => userMappedIds.has(d._id.toString()));
        
        if (mySubDepts.length === 1 && effectiveRole !== 'DEPARTMENT_ADMIN') {
          setSelectedSubDepartment(mySubDepts[0]._id);
        }
      }
      return;
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


  // ──────────────────────────────────────────────────────────
  // API calls
  // ──────────────────────────────────────────────────────────

  const fetchAllDepartments = async () => {
    setLoadingDepts(true);
    try {
      const pageSize = 200;
      let page = 1;
      let totalPages = 1;
      const collected = new Map<string, Department>();

      do {
        const deptRes = await departmentAPI.getAll({
          companyId,
          page,
          limit: pageSize
        });

        if (!deptRes.success) {
          break;
        }

        deptRes.data.departments.forEach((department) => {
          collected.set(department._id, department);
        });

        totalPages = Math.max(1, Number(deptRes.data.pagination?.pages || 1));
        page += 1;
      } while (page <= totalPages);

      setAllDepartments(Array.from(collected.values()));
    } catch (error) {
      toast.error('Failed to load departments');
      console.error(error);
    } finally {
      setLoadingDepts(false);
    }
  };

  const fetchAllCompanyUsers = useCallback(async () => {
    if (!companyId) return;
    setLoadingAllUsers(true);
    try {
      const res = await userAPI.getAll({
        companyId,
        limit: 1000, 
      });
      if (res.success) {
        setAllCompanyUsers(res.data.users || []);
      }
    } catch (error) {
      console.error('Failed to fetch all company users:', error);
    } finally {
      setLoadingAllUsers(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (isOpen) {
      fetchAllCompanyUsers();
    }
  }, [isOpen, fetchAllCompanyUsers]);

  const { filteredUsers, isUsingCompanyWideFallback } = useMemo(() => {
    const targetDeptId = selectedSubDepartment || selectedDepartment;
    if (!targetDeptId) {
      return {
        filteredUsers: [],
        isUsingCompanyWideFallback: false,
      };
    }

    const departmentUsers = allCompanyUsers.filter(user => {
      const primaryDeptId = typeof user.departmentId === 'object'
        ? (user.departmentId as any)?._id
        : user.departmentId;
      const mappedDeptIds = (user.departmentIds || []).map((department) =>
        typeof department === 'object' ? (department as any)?._id : department
      );

      return [primaryDeptId, ...mappedDeptIds]
        .filter(Boolean)
        .some((deptId) => deptId === targetDeptId);
    });

    const shouldUseCompanyWideFallback =
      departmentUsers.length === 0 && isTopLevelAdmin;

    const baseUsers = (shouldUseCompanyWideFallback ? allCompanyUsers : departmentUsers)
      .filter(user => user._id !== currentUserId);

    if (!searchQuery) {
      return {
        filteredUsers: baseUsers,
        isUsingCompanyWideFallback: shouldUseCompanyWideFallback,
      };
    }

    const query = searchQuery.toLowerCase();
    return {
      filteredUsers: baseUsers.filter(user => {
      const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
      const emailVal = (user.email || "").toLowerCase();
      const userIdVal = (user.userId || "").toLowerCase();
      return fullName.includes(query) || 
             emailVal.includes(query) ||
             userIdVal.includes(query);
      }),
      isUsingCompanyWideFallback: shouldUseCompanyWideFallback,
    };
  }, [
    allCompanyUsers,
    currentUserId,
    isTopLevelAdmin,
    searchQuery,
    selectedDepartment,
    selectedSubDepartment,
  ]);

  const handleAssign = async (userId: string) => {
    setAssigningUserId(userId);

    const assignedUser = allCompanyUsers.find((user) => user._id === userId);
    const userName = assignedUser
      ? `${assignedUser.firstName} ${assignedUser.lastName}`
      : 'officer';

    const toastId = toast.loading(`Assigning to ${userName}...`);

    try {
      const userDeptId = assignedUser?.departmentId
        ? typeof assignedUser.departmentId === 'object'
          ? assignedUser.departmentId._id
          : assignedUser.departmentId
        : undefined;

      await onAssign(userId, userDeptId, assignmentNote.trim() || undefined);

      if (userDeptId && currentDepartmentId && userDeptId !== currentDepartmentId) {
        const newDept = allDepartments.find((department) => department._id === userDeptId);
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
      if (msg.toLowerCase().includes('access denied')) {
        toast.error("Access Denied: This grievance may have been moved. Refreshing list...", { id: toastId, duration: 4000 });
        onClose();
        if (onSuccess) onSuccess();
      } else {
        toast.error(msg, { id: toastId });
      }
    } finally {
      setAssigningUserId(null);
    }
  };

  const getCurrentAssigneeName = () => {
    if (!currentAssignee) return 'Unassigned';

    if (typeof currentAssignee === 'object') {
      return `${currentAssignee.firstName} ${currentAssignee.lastName}`;
    }

    const matchedUser = allCompanyUsers.find(
      (user) => user._id === currentAssignee || user.userId === currentAssignee
    );

    if (matchedUser) {
      return `${matchedUser.firstName} ${matchedUser.lastName}`;
    }

    return currentAssignee;
  };

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

  const hasSubDepts = visibleSubDepts.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent hideClose className="w-[96vw] max-w-2xl max-h-[92vh] sm:max-h-[88vh] overflow-y-auto flex flex-col p-0 gap-0 rounded-2xl sm:rounded-[2rem] border-0 shadow-2xl bg-white">
        <DialogHeader className="relative space-y-0 border-b-0 p-0 text-left">
          <div className="relative overflow-hidden rounded-t-2xl sm:rounded-t-[2rem] bg-gradient-to-r from-[#1aa6ea] via-[#0d9ee3] to-[#2bb4ef] px-5 py-3 sm:px-6 sm:py-4">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.2),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.16),transparent_28%)]" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-white/30 bg-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-md">
                  <UserCheck className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="flex items-center gap-2 truncate text-xl font-black tracking-tight text-white sm:text-2xl">
                    Assign {itemType === 'grievance' ? 'Grievance' : 'Appointment'}
                    {displayId && (
                      <span className="text-xs font-black text-white/60 bg-black/10 px-1.5 py-0.5 rounded-md border border-white/10 font-mono tracking-widest mt-1">
                        #{displayId}
                      </span>
                    )}
                  </DialogTitle>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-cyan-50/90">
                      Currently with
                    </span>
                    <span className="max-w-full truncate rounded-full border border-white/35 bg-white/16 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.06em] text-white backdrop-blur-sm">
                      {getCurrentAssigneeName()}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={onClose}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-white/35 bg-white/12 transition-all duration-200 hover:bg-white/20"
                aria-label="Close assignment dialog"
              >
                <X className="h-4 w-4 text-white" />
              </button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col bg-slate-50 p-4">
          {/* Filters */}
          <div className="flex flex-col space-y-2">

            {/* Department & Sub-Department Dropdowns - Always shown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Department Dropdown */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                  Department
                </label>
                <div className="relative group">
                  <Building2 className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-indigo-500 transition-colors" />
                  <SearchableSelect
                    options={visibleTopDepts.filter(Boolean).map(d => ({ value: d!._id, label: d!.name }))}
                    value={selectedDepartment}
                    onValueChange={(value) => {
                        setSelectedDepartment(value);
                        setSelectedSubDepartment('');
                    }}
                    placeholder={loadingDepts ? 'Loading...' : 'Select Department'}
                    disabled={false}
                  />
                </div>
              </div>

              {/* Sub-Department Dropdown */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-700" />
                  Sub Department
                  {!hasSubDepts && selectedDepartment && (
                    <span className="text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full border">None available</span>
                  )}
                </label>
                <div className="relative group">
                  <Layers className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4 group-focus-within:text-slate-900 transition-colors" />
                  <SearchableSelect
                    options={visibleSubDepts.filter(Boolean).map(d => ({ value: d!._id, label: d!.name }))}
                    value={selectedSubDepartment}
                    onValueChange={(value) => setSelectedSubDepartment(value)}
                    placeholder={!selectedDepartment 
                        ? 'Select dept. first' 
                        : !hasSubDepts 
                          ? 'No sub-departments' 
                          : 'All (show dept. users)'}
                    disabled={!selectedDepartment}
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
                      ? (visibleSubDepts as any[]).find(d => d?._id === selectedSubDepartment)?.name 
                      : (visibleTopDepts as any[]).find(d => d?._id === selectedDepartment)?.name}
                  </strong>
                  {selectedSubDepartment && (
                    <span className="text-indigo-400"> (sub-department)</span>
                  )}
                </span>
              </div>
            )}
            {isUsingCompanyWideFallback && isTopLevelAdmin && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-700 font-medium">
                <Users className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  No alternate assignee found in selected scope. Showing company-wide users for reassignment.
                </span>
              </div>
            )}

            {itemType === 'grievance' && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
                  Note / Description
                  <span className="ml-1 text-[9px] font-semibold normal-case tracking-normal text-slate-400">
                    (optional)
                  </span>
                </label>
                <textarea
                  value={assignmentNote}
                  onChange={(e) => setAssignmentNote(e.target.value)}
                  placeholder="Add context for this sub-department transfer..."
                  className="min-h-[60px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}
          </div>

          {/* User Search */}
          <div className="mt-3 relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            <input
              type="text"
              placeholder="Search assignees by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 bg-white text-sm font-medium text-slate-700 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-transparent focus:ring-2 focus:ring-indigo-500 hover:border-slate-300"
            />
          </div>

          {/* Users List */}
          <div className="mt-3 rounded-xl border border-slate-200 bg-white shadow-sm">
            {!selectedDepartment ? (
              <div className="p-10 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-600 font-medium">Please select a department</p>
                <p className="text-slate-400 text-sm mt-1">Choose a department to view available assignees</p>
              </div>
            ) : loadingAllUsers ? (
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
                {filteredUsers.map((user) => {
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

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedUserProfile(user)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-transparent hover:border-indigo-100"
                            title="View Profile"
                          >
                            <Search className="w-4 h-4" />
                          </button>

                          <div className="flex flex-col items-end gap-1.5">
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
                            {isCurrentAssignee && canReassignCurrent && (
                              <Button
                                onClick={() => handleAssign(user._id)}
                                disabled={assigningUserId !== null}
                                size="sm"
                                variant="outline"
                                className="min-w-[100px] rounded-xl border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800 font-semibold"
                              >
                                Reassign
                              </Button>
                            )}
                          </div>
                      </div>
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
      {selectedUserProfile && (
        <UserDetailsDialog 
          isOpen={!!selectedUserProfile} 
          onClose={() => setSelectedUserProfile(null)} 
          user={selectedUserProfile}
          onAssign={(u) => handleAssign(u._id)}
          isAssigning={assigningUserId === selectedUserProfile._id}
        />
      )}
    </Dialog>
  );
}
