import { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { userAPI, User } from '../../lib/api/user';
import { departmentAPI, Department } from '../../lib/api/department';
import {
  Building2,
  Search,
  Loader2,
  UserCheck,
  Mail,
  X,
  Users,
  Layers,
  ChevronDown,
  ShieldCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../ui/LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';
import { SearchableSelect } from '../ui/SearchableSelect';
import UserDetailsDialog from '../user/UserDetailsDialog';
import { getUserRoleLabel } from '@/lib/utils/userUtils';
import { Switch } from '../ui/switch';
import { Checkbox } from '../ui/Checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { ScrollArea } from '../ui/scroll-area';

interface AssignmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAssign: (
    userId: string,
    departmentId?: string,
    note?: string,
    additionalDepartmentIds?: string[],
    additionalAssigneeIds?: string[]
  ) => Promise<void>;
  itemType: 'grievance' | 'appointment';
  itemId: string;
  companyId: string;
  allDepartments?: Department[];
  currentAssignee?: string | { _id: string; firstName: string; lastName: string };
  currentDepartmentId?: string;
  currentSubDepartmentId?: string;
  suggestedDepartmentId?: string;
  suggestedSubDepartmentId?: string;
  userRole?: string;
  canReassignCurrent?: boolean;
  userDepartmentId?: string;
  currentUserId?: string;
  displayId?: string;
  onSuccess?: () => void;
}

const getRoleString = (role: unknown): string => {
  if (!role) return '';
  if (typeof role === 'string') return role.toUpperCase();
  if (typeof role === 'object' && role && 'name' in role) {
    return String((role as { name?: string }).name || '').toUpperCase();
  }
  return '';
};

const getEntityId = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value && '_id' in value) {
    return String((value as { _id?: string })._id || '');
  }
  return undefined;
};

const getParentDepartmentId = (department: Department): string | null => {
  const parentId = getEntityId(department.parentDepartmentId);
  return parentId || null;
};

const getUserDepartmentIds = (user: User): string[] => {
  const ids = new Set<string>();
  const primaryId = getEntityId(user.departmentId);
  if (primaryId) ids.add(primaryId);
  (user.departmentIds || []).forEach((department) => {
    const deptId = getEntityId(department);
    if (deptId) ids.add(deptId);
  });
  return Array.from(ids);
};

export default function AssignmentDialog({
  isOpen,
  onClose,
  onAssign,
  itemType,
  companyId,
  allDepartments: initialDepartments = [],
  currentAssignee,
  currentDepartmentId,
  currentSubDepartmentId,
  suggestedDepartmentId,
  suggestedSubDepartmentId,
  userRole,
  canReassignCurrent = false,
  currentUserId,
  displayId,
  onSuccess,
}: AssignmentDialogProps) {
  const { user: authUser } = useAuth();
  const [allDepartments, setAllDepartments] = useState<Department[]>(initialDepartments);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedSubDepartment, setSelectedSubDepartment] = useState('');
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>([]);
  const [selectedSubDepartmentIds, setSelectedSubDepartmentIds] = useState<string[]>([]);
  const [multipleAssignEnabled, setMultipleAssignEnabled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentSearchQuery, setDepartmentSearchQuery] = useState('');
  const [subDepartmentSearchQuery, setSubDepartmentSearchQuery] = useState('');
  const [assignmentNote, setAssignmentNote] = useState('');
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null);
  const [selectedUserProfile, setSelectedUserProfile] = useState<User | null>(null);
  const [allCompanyUsers, setAllCompanyUsers] = useState<User[]>([]);
  const [loadingAllUsers, setLoadingAllUsers] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [primarySelectedUserId, setPrimarySelectedUserId] = useState<string>('');

  useEffect(() => {
    if (initialDepartments.length > 0) {
      setAllDepartments(initialDepartments);
    }
  }, [initialDepartments]);

  const effectiveRole = getRoleString(userRole || authUser?.role);
  const isTopLevelAdmin =
    effectiveRole.includes('COMPANY') ||
    effectiveRole.includes('SUPER') ||
    !!authUser?.isSuperAdmin ||
    (authUser?.level !== undefined && authUser.level <= 1);
  const allowMultiAssign = itemType === 'grievance' && isTopLevelAdmin;

  const departmentsById = useMemo(() => {
    const map = new Map<string, Department>();
    allDepartments.forEach((department) => map.set(department._id, department));
    return map;
  }, [allDepartments]);

  const visibleTopDepts = useMemo(() => {
    if (!allDepartments.length) return [];

    const allIds = new Set(allDepartments.map((department) => department._id));
    const topLevelDepts = allDepartments.filter((department) => {
      const parentId = getParentDepartmentId(department);
      return !parentId || !allIds.has(parentId);
    });

    if (isTopLevelAdmin) {
      return topLevelDepts.length > 0 ? topLevelDepts : allDepartments;
    }

    const userMappedIds = new Set((authUser?.departmentIds || []).map((department) => getEntityId(department)).filter(Boolean) as string[]);
    const allowedTopDeptIds = new Set<string>();

    allDepartments.forEach((department) => {
      if (!userMappedIds.has(department._id)) return;
      const parentId = getParentDepartmentId(department);
      allowedTopDeptIds.add(parentId || department._id);
    });

    const filtered = topLevelDepts.filter((department) => allowedTopDeptIds.has(department._id));
    if (filtered.length === 0 && userMappedIds.size > 0) {
      return allDepartments.filter((department) => userMappedIds.has(department._id));
    }

    return filtered;
  }, [allDepartments, authUser?.departmentIds, isTopLevelAdmin]);

  const visibleSubDepts = useMemo(() => {
    if (!selectedDepartment || !allDepartments.length) return [];

    const subDepartments = allDepartments.filter(
      (department) => getParentDepartmentId(department) === selectedDepartment
    );

    if (isTopLevelAdmin) {
      return subDepartments;
    }

    const userMappedIds = new Set((authUser?.departmentIds || []).map((department) => getEntityId(department)).filter(Boolean) as string[]);
    if (userMappedIds.has(selectedDepartment)) {
      return subDepartments;
    }

    return subDepartments.filter((department) => userMappedIds.has(department._id));
  }, [allDepartments, authUser?.departmentIds, isTopLevelAdmin, selectedDepartment]);

  const selectedMultiDepartmentGroups = useMemo(
    () =>
      selectedDepartmentIds
        .map((departmentId) => ({
          department: departmentsById.get(departmentId),
          subDepartments: allDepartments.filter(
            (candidate) => getParentDepartmentId(candidate) === departmentId
          ),
        }))
        .filter((entry) => entry.department),
    [allDepartments, departmentsById, selectedDepartmentIds]
  );

  const filteredMultiTopDepts = useMemo(() => {
    const query = departmentSearchQuery.trim().toLowerCase();
    if (!query) return visibleTopDepts;
    return visibleTopDepts.filter((department) =>
      `${department.name} ${department.departmentId}`.toLowerCase().includes(query)
    );
  }, [departmentSearchQuery, visibleTopDepts]);

  const availableMultiSubDepartments = useMemo(() => {
    const uniqueDepartments = new Map<string, Department>();
    selectedDepartmentIds.forEach((departmentId) => {
      allDepartments.forEach((department) => {
        if (getParentDepartmentId(department) === departmentId) {
          uniqueDepartments.set(department._id, department);
        }
      });
    });

    return Array.from(uniqueDepartments.values()).sort((left, right) =>
      left.name.localeCompare(right.name)
    );
  }, [allDepartments, selectedDepartmentIds]);

  const filteredMultiSubDepartments = useMemo(() => {
    const query = subDepartmentSearchQuery.trim().toLowerCase();
    if (!query) return availableMultiSubDepartments;
    return availableMultiSubDepartments.filter((department) =>
      `${department.name} ${department.departmentId}`.toLowerCase().includes(query)
    );
  }, [availableMultiSubDepartments, subDepartmentSearchQuery]);

  const fetchAllDepartments = useCallback(async () => {
    setLoadingDepts(true);
    try {
      const pageSize = 200;
      let page = 1;
      let totalPages = 1;
      const collected = new Map<string, Department>();

      do {
        const departmentResponse = await departmentAPI.getAll({
          companyId,
          page,
          limit: pageSize,
        });

        if (!departmentResponse.success) break;

        departmentResponse.data.departments.forEach((department) => {
          collected.set(department._id, department);
        });
        totalPages = Math.max(1, Number(departmentResponse.data.pagination?.pages || 1));
        page += 1;
      } while (page <= totalPages);

      setAllDepartments(Array.from(collected.values()));
    } catch (error) {
      toast.error('Failed to load departments');
      console.error(error);
    } finally {
      setLoadingDepts(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (isOpen) {
      if (initialDepartments.length === 0) {
        void fetchAllDepartments();
      }
      setSearchQuery('');
      setDepartmentSearchQuery('');
      setSubDepartmentSearchQuery('');
      return;
    }

    if (initialDepartments.length === 0) {
      setAllDepartments([]);
    }
    setSelectedDepartment('');
    setSelectedSubDepartment('');
    setSelectedDepartmentIds([]);
    setSelectedSubDepartmentIds([]);
    setMultipleAssignEnabled(false);
    setAssignmentNote('');
    setAssigningUserId(null);
    setSelectedUserIds([]);
    setPrimarySelectedUserId('');
  }, [fetchAllDepartments, initialDepartments.length, isOpen]);

  useEffect(() => {
    if (!allDepartments.length || !isOpen) return;
    if (selectedDepartment) return;

    const resolvedCurrentDepartmentId = currentSubDepartmentId || currentDepartmentId;
    const targetDepartmentId = suggestedSubDepartmentId || suggestedDepartmentId || resolvedCurrentDepartmentId;
    if (targetDepartmentId) {
      const targetDepartment = allDepartments.find((department) => department._id === targetDepartmentId);
      if (targetDepartment) {
        const parentId = getParentDepartmentId(targetDepartment);
        if (parentId) {
          setSelectedDepartment(parentId);
          setSelectedSubDepartment(targetDepartment._id);
        } else {
          setSelectedDepartment(targetDepartment._id);
        }
        return;
      }
    }

    if (!isTopLevelAdmin && visibleTopDepts.length > 0) {
      setSelectedDepartment(visibleTopDepts[0]._id);
      return;
    }

    if (visibleTopDepts.length > 0) {
      setSelectedDepartment(visibleTopDepts[0]._id);
    }
  }, [
    allDepartments,
    currentDepartmentId,
    currentSubDepartmentId,
    isOpen,
    isTopLevelAdmin,
    selectedDepartment,
    suggestedDepartmentId,
    suggestedSubDepartmentId,
    visibleTopDepts,
  ]);

  useEffect(() => {
    if (!selectedSubDepartment) return;
    if (visibleSubDepts.some((department) => department._id === selectedSubDepartment)) return;
    setSelectedSubDepartment('');
  }, [selectedSubDepartment, visibleSubDepts]);

  useEffect(() => {
    if (!allowMultiAssign && multipleAssignEnabled) {
      setMultipleAssignEnabled(false);
    }
  }, [allowMultiAssign, multipleAssignEnabled]);

  useEffect(() => {
    setSelectedSubDepartmentIds((previous) =>
      previous.filter((subDepartmentId) => {
        const subDepartment = departmentsById.get(subDepartmentId);
        if (!subDepartment) return false;
        return selectedDepartmentIds.includes(getParentDepartmentId(subDepartment) || '');
      })
    );
  }, [departmentsById, selectedDepartmentIds]);

  useEffect(() => {
    if (!allowMultiAssign) return;

    if (multipleAssignEnabled) {
      setSelectedDepartmentIds((previous) => {
        if (previous.length > 0) return previous;
        const seedIds = new Set<string>();
        if (selectedDepartment) seedIds.add(selectedDepartment);
        if (seedIds.size === 0 && suggestedDepartmentId) seedIds.add(suggestedDepartmentId);
        if (seedIds.size === 0 && currentDepartmentId) seedIds.add(currentDepartmentId);
        return Array.from(seedIds);
      });
      setSelectedUserIds([]);
      setPrimarySelectedUserId('');
      return;
    }

    if (!selectedDepartment && selectedDepartmentIds.length > 0) {
      setSelectedDepartment(selectedDepartmentIds[0]);
    }
    setSelectedSubDepartmentIds([]);
    setSelectedUserIds([]);
    setPrimarySelectedUserId('');
  }, [
    allowMultiAssign,
    currentDepartmentId,
    multipleAssignEnabled,
    selectedDepartment,
    selectedDepartmentIds,
    suggestedDepartmentId,
  ]);

  const fetchAllCompanyUsers = useCallback(async () => {
    if (!companyId) return;
    setLoadingAllUsers(true);
    try {
      const response = await userAPI.getAll({
        companyId,
        limit: 1000,
      });
      if (response.success) {
        setAllCompanyUsers(response.data.users || []);
      }
    } catch (error) {
      console.error('Failed to fetch all company users:', error);
    } finally {
      setLoadingAllUsers(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (isOpen) {
      void fetchAllCompanyUsers();
    }
  }, [fetchAllCompanyUsers, isOpen]);

  const {
    filteredUsers,
    isUsingCompanyWideFallback,
    targetScopeDepartmentIds,
  } = useMemo(() => {
    let scopeDepartmentIds: string[] = [];

    if (multipleAssignEnabled && allowMultiAssign) {
      const scopedIds = new Set<string>(selectedDepartmentIds);
      if (selectedSubDepartmentIds.length > 0) {
        selectedSubDepartmentIds.forEach((subDepartmentId) => scopedIds.add(subDepartmentId));
      } else {
        selectedDepartmentIds.forEach((departmentId) => {
          allDepartments.forEach((department) => {
            if (getParentDepartmentId(department) === departmentId) {
              scopedIds.add(department._id);
            }
          });
        });
      }
      scopeDepartmentIds = Array.from(scopedIds);
    } else {
      const singleScopeId = selectedSubDepartment || selectedDepartment;
      scopeDepartmentIds = singleScopeId ? [singleScopeId] : [];
    }

    if (scopeDepartmentIds.length === 0) {
      return {
        filteredUsers: [] as User[],
        isUsingCompanyWideFallback: false,
        targetScopeDepartmentIds: [] as string[],
      };
    }

    const departmentUsers = allCompanyUsers.filter((user) =>
      getUserDepartmentIds(user).some((departmentId) => scopeDepartmentIds.includes(departmentId))
    );

    const shouldUseCompanyWideFallback = departmentUsers.length === 0 && isTopLevelAdmin;
    const baseUsers = (shouldUseCompanyWideFallback ? allCompanyUsers : departmentUsers).filter(
      (user) => user._id !== currentUserId
    );

    if (!searchQuery) {
      return {
        filteredUsers: baseUsers,
        isUsingCompanyWideFallback: shouldUseCompanyWideFallback,
        targetScopeDepartmentIds: scopeDepartmentIds,
      };
    }

    const normalizedQuery = searchQuery.toLowerCase();
    return {
      filteredUsers: baseUsers.filter((user) => {
        const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
        return (
          fullName.includes(normalizedQuery) ||
          String(user.email || '').toLowerCase().includes(normalizedQuery) ||
          String(user.userId || '').toLowerCase().includes(normalizedQuery)
        );
      }),
      isUsingCompanyWideFallback: shouldUseCompanyWideFallback,
      targetScopeDepartmentIds: scopeDepartmentIds,
    };
  }, [
    allCompanyUsers,
    allDepartments,
    allowMultiAssign,
    currentUserId,
    isTopLevelAdmin,
    multipleAssignEnabled,
    searchQuery,
    selectedDepartment,
    selectedDepartmentIds,
    selectedSubDepartmentIds,
    selectedSubDepartment,
  ]);

  const getTopDepartmentIdForUser = useCallback(
    (user: User): string | undefined => {
      const primaryDepartmentId = getEntityId(user.departmentId) || getUserDepartmentIds(user)[0];
      if (!primaryDepartmentId) return undefined;
      const department = departmentsById.get(primaryDepartmentId);
      if (!department) return primaryDepartmentId;
      return getParentDepartmentId(department) || department._id;
    },
    [departmentsById]
  );

  const getAssignmentDepartmentIdForUser = useCallback((user: User): string | undefined => {
    return getEntityId(user.departmentId) || getUserDepartmentIds(user)[0];
  }, []);

  const handleSingleAssign = async (userId: string) => {
    setAssigningUserId(userId);

    const assignedUser = allCompanyUsers.find((candidate) => candidate._id === userId);
    const userName = assignedUser
      ? `${assignedUser.firstName} ${assignedUser.lastName}`
      : 'officer';

    if (assignmentNote.length > 100) {
      toast.error('Note exceeds 100 character limit');
      setAssigningUserId(null);
      return;
    }

    const toastId = toast.loading(`Assigning to ${userName}...`);

    try {
      const userDeptId = assignedUser ? getAssignmentDepartmentIdForUser(assignedUser) : undefined;

      await onAssign(userId, userDeptId, assignmentNote.trim() || undefined);

      if (userDeptId && currentDepartmentId && userDeptId !== currentDepartmentId) {
        const newDepartment = departmentsById.get(userDeptId);
        toast.success(
          `${itemType === 'grievance' ? 'Grievance' : 'Appointment'} assigned to ${userName} and transferred to ${newDepartment?.name || 'new department'}`,
          { id: toastId, duration: 1000 }
        );
      } else {
        toast.success(`Successfully assigned to ${userName}!`, { id: toastId });
      }

      onClose();
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'Failed to assign';
      if (String(message).toLowerCase().includes('access denied')) {
        toast.error(
          'Access Denied: This grievance may have been moved. Refreshing list...',
          { id: toastId, duration: 4000 }
        );
        onClose();
        onSuccess?.();
      } else {
        toast.error(message, { id: toastId });
      }
    } finally {
      setAssigningUserId(null);
    }
  };

  const handleToggleSelectedUser = (userId: string, checked: boolean) => {
    setSelectedUserIds((previous) => {
      const next = checked
        ? Array.from(new Set([...previous, userId]))
        : previous.filter((value) => value !== userId);

      if (checked && !primarySelectedUserId) {
        setPrimarySelectedUserId(userId);
      }
      if (!checked && primarySelectedUserId === userId) {
        setPrimarySelectedUserId(next[0] || '');
      }

      return next;
    });
  };

  const handleMultiAssignSubmit = async () => {
    if (assignmentNote.length > 100) {
      toast.error('Note exceeds 100 character limit');
      return;
    }

    if (selectedDepartmentIds.length === 0) {
      toast.error('Select at least one department');
      return;
    }

    if (selectedUserIds.length === 0) {
      toast.error('Select at least one user');
      return;
    }

    if (!primarySelectedUserId || !selectedUserIds.includes(primarySelectedUserId)) {
      toast.error('Choose one primary assignee');
      return;
    }

    const primaryUser = allCompanyUsers.find((user) => user._id === primarySelectedUserId);
    if (!primaryUser) {
      toast.error('Primary assignee not found');
      return;
    }

    const primaryUserDeptId = getAssignmentDepartmentIdForUser(primaryUser);
    const primaryTopDepartmentId = getTopDepartmentIdForUser(primaryUser);
    const extraDepartmentIds = selectedDepartmentIds.filter(
      (departmentId) => departmentId !== primaryTopDepartmentId
    );
    const extraAssigneeIds = selectedUserIds.filter((userId) => userId !== primarySelectedUserId);
    const primaryUserName = `${primaryUser.firstName} ${primaryUser.lastName}`.trim();
    const toastId = toast.loading(`Assigning to ${primaryUserName} and notifying selected teams...`);

    setAssigningUserId(primarySelectedUserId);

    try {
      await onAssign(
        primarySelectedUserId,
        primaryUserDeptId,
        assignmentNote.trim() || undefined,
        extraDepartmentIds,
        extraAssigneeIds
      );

      toast.success(
        `Assigned to ${primaryUserName}. ${extraAssigneeIds.length} additional user${extraAssigneeIds.length === 1 ? '' : 's'} will also be notified.`,
        { id: toastId, duration: 2500 }
      );
      onClose();
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'Failed to assign';
      toast.error(message, { id: toastId });
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
    return matchedUser ? `${matchedUser.firstName} ${matchedUser.lastName}` : currentAssignee;
  };

  const getRoleColor = (roleLabel: string) => {
    const normalizedRole = roleLabel.toUpperCase().replace(/\s+/g, '_');
    switch (normalizedRole) {
      case 'SUPER_ADMIN':
        return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'DEPARTMENT_ADMIN':
      case 'SUB_DEPARTMENT_ADMIN':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'OPERATOR':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'COMPANY_ADMIN':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const selectedDepartmentNames = selectedDepartmentIds
    .map((departmentId) => departmentsById.get(departmentId)?.name)
    .filter(Boolean) as string[];
  const selectedSubDepartmentNames = selectedSubDepartmentIds
    .map((departmentId) => departmentsById.get(departmentId)?.name)
    .filter(Boolean) as string[];
  const hasSubDepartments = visibleSubDepts.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        hideClose
        className="w-[96vw] max-w-2xl max-h-[92vh] sm:max-h-[88vh] overflow-y-auto flex flex-col p-0 gap-0 rounded-2xl sm:rounded-[2rem] border-0 shadow-2xl bg-white"
      >
        <DialogHeader className="relative space-y-0 border-b-0 p-0 text-left">
          <div className="relative overflow-hidden rounded-t-2xl sm:rounded-t-[2rem] bg-gradient-to-r from-[#1aa6ea] via-[#0d9ee3] to-[#2bb4ef] px-4 py-2.5 sm:px-5 sm:py-3">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.2),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.16),transparent_28%)]" />
            <div className="relative flex items-start justify-between gap-2.5">
              <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-white/30 bg-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-md">
                  <UserCheck className="h-4.5 w-4.5 text-white" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="flex flex-wrap items-center gap-x-2 gap-y-1 text-lg font-black tracking-tight text-white sm:text-[1.35rem] leading-tight">
                    <span>Assign {itemType === 'grievance' ? 'Grievance' : 'Appointment'}</span>
                    {displayId && (
                      <span className="text-[10px] sm:text-xs font-black text-white/70 bg-black/15 px-2 py-0.5 rounded-md border border-white/10 font-mono tracking-wider inline-flex items-center">
                        #{displayId}
                      </span>
                    )}
                  </DialogTitle>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-cyan-50/90">
                      Currently with
                    </span>
                    <span className="max-w-full truncate rounded-full border border-white/35 bg-white/16 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.06em] text-white backdrop-blur-sm">
                      {getCurrentAssigneeName()}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={onClose}
                className="flex h-7.5 w-7.5 flex-shrink-0 items-center justify-center rounded-lg border border-white/35 bg-white/12 transition-all duration-200 hover:bg-white/20"
                aria-label="Close assignment dialog"
              >
                <X className="h-4 w-4 text-white" />
              </button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col bg-slate-50 p-3.5 sm:p-4">
          <div className="flex flex-col space-y-3">
            {allowMultiAssign && (
              <div className="rounded-2xl border border-sky-100 bg-white px-4 py-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                      <ShieldCheck className="h-4 w-4 text-sky-600" />
                      Multiple Assign
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Company admin can notify users across multiple departments. One selected user remains the primary assignee.
                    </p>
                  </div>
                  <Switch
                    checked={multipleAssignEnabled}
                    onCheckedChange={setMultipleAssignEnabled}
                    aria-label="Toggle multiple assignment"
                  />
                </div>
              </div>
            )}

            {!multipleAssignEnabled ? (
              <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                    Department
                  </label>
                  <div className="relative group">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-indigo-500 transition-colors" />
                    <SearchableSelect
                      options={visibleTopDepts.map((department) => ({
                        value: department._id,
                        label: department.name,
                      }))}
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

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-slate-700" />
                    Sub Department
                    {!hasSubDepartments && selectedDepartment && (
                      <span className="text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full border">
                        None available
                      </span>
                    )}
                  </label>
                  <div className="relative group">
                    <Layers className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 group-focus-within:text-slate-900 transition-colors" />
                    <SearchableSelect
                      options={visibleSubDepts.map((department) => ({
                        value: department._id,
                        label: department.name,
                      }))}
                      value={selectedSubDepartment}
                      onValueChange={setSelectedSubDepartment}
                      placeholder={
                        !selectedDepartment
                          ? 'Select dept. first'
                          : !hasSubDepartments
                            ? 'No sub-departments'
                            : 'All (show dept. users)'
                      }
                      disabled={!selectedDepartment}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                    Departments
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 shadow-sm"
                      >
                        <span className="truncate">
                          {selectedDepartmentNames.length > 0
                            ? `${selectedDepartmentNames.length} department${selectedDepartmentNames.length === 1 ? '' : 's'} selected`
                            : 'Select departments'}
                        </span>
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-[340px] max-h-[22rem] overflow-hidden p-0">
                      <div className="border-b border-slate-100 p-3">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={departmentSearchQuery}
                            onChange={(event) => setDepartmentSearchQuery(event.target.value)}
                            placeholder="Quick search departments..."
                            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                          />
                        </div>
                      </div>
                      <div
                        className="max-h-72 overflow-y-auto overscroll-contain"
                        onWheelCapture={(event) => event.stopPropagation()}
                      >
                        <div className="p-2">
                          {filteredMultiTopDepts.map((department) => {
                            const checked = selectedDepartmentIds.includes(department._id);
                            return (
                              <label
                                key={department._id}
                                className="flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2 hover:bg-slate-50"
                              >
                                <Checkbox
                                  checked={checked}
                                  onChange={(event) => {
                                    const nextChecked = event.currentTarget.checked;
                                    setSelectedDepartmentIds((previous) =>
                                      nextChecked
                                        ? Array.from(new Set([...previous, department._id]))
                                        : previous.filter((departmentId) => departmentId !== department._id)
                                    );
                                    if (!nextChecked) {
                                      setSelectedSubDepartmentIds((previous) =>
                                        previous.filter((subDepartmentId) => {
                                          const subDepartment = departmentsById.get(subDepartmentId);
                                          return (
                                            subDepartment &&
                                            getParentDepartmentId(subDepartment) !== department._id
                                          );
                                        })
                                      );
                                    }
                                  }}
                                />
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-slate-800">{department.name}</div>
                                  <div className="text-[11px] text-slate-500">{department.departmentId}</div>
                                </div>
                              </label>
                            );
                          })}
                          {filteredMultiTopDepts.length === 0 && (
                            <div className="px-3 py-6 text-center text-sm text-slate-500">
                              No departments match your search.
                            </div>
                          )}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                  {selectedDepartmentNames.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedDepartmentNames.map((name) => (
                        <span
                          key={name}
                          className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {selectedDepartmentIds.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-slate-700" />
                      Sub Departments
                    </label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 shadow-sm"
                        >
                          <span className="truncate">
                            {selectedSubDepartmentNames.length > 0
                              ? `${selectedSubDepartmentNames.length} sub-department${selectedSubDepartmentNames.length === 1 ? '' : 's'} selected`
                              : 'All sub-departments under selected departments'}
                          </span>
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-[360px] max-h-[22rem] overflow-hidden p-0">
                        <div className="border-b border-slate-100 p-3">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                              type="text"
                              value={subDepartmentSearchQuery}
                              onChange={(event) => setSubDepartmentSearchQuery(event.target.value)}
                              placeholder="Quick search sub departments..."
                            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                          />
                        </div>
                      </div>
                        <div
                          className="max-h-72 overflow-y-auto overscroll-contain"
                          onWheelCapture={(event) => event.stopPropagation()}
                        >
                          <div className="p-2">
                            {filteredMultiSubDepartments.map((subDepartment) => {
                              const checked = selectedSubDepartmentIds.includes(subDepartment._id);
                              const parentDepartmentName =
                                departmentsById.get(getParentDepartmentId(subDepartment) || '')?.name || 'Department';
                              return (
                                <label
                                  key={subDepartment._id}
                                  className="flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2 hover:bg-slate-50"
                                >
                                  <Checkbox
                                    checked={checked}
                                    onChange={(event) => {
                                      const nextChecked = event.currentTarget.checked;
                                      setSelectedSubDepartmentIds((previous) =>
                                        nextChecked
                                          ? Array.from(new Set([...previous, subDepartment._id]))
                                          : previous.filter((departmentId) => departmentId !== subDepartment._id)
                                      );
                                    }}
                                  />
                                  <div className="min-w-0">
                                    <div className="text-sm font-semibold text-slate-800">{subDepartment.name}</div>
                                    <div className="text-[11px] text-slate-500">
                                      {parentDepartmentName}
                                    </div>
                                  </div>
                                </label>
                              );
                            })}
                            {filteredMultiSubDepartments.length === 0 && (
                              <div className="px-3 py-6 text-center text-sm text-slate-500">
                                No sub-departments match your search.
                              </div>
                            )}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                    {selectedSubDepartmentNames.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedSubDepartmentNames.map((name) => (
                          <span
                            key={name}
                            className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {selectedMultiDepartmentGroups.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Available Sub Departments
                    </div>
                    <div className="mt-2 space-y-2">
                      {selectedMultiDepartmentGroups.map(({ department, subDepartments }) => (
                        <div key={department!._id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                          <div className="text-sm font-semibold text-slate-800">{department!.name}</div>
                          {subDepartments.length > 0 ? (
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {subDepartments.map((subDepartment) => (
                                <span
                                  key={subDepartment._id}
                                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600"
                                >
                                  {subDepartment.name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-1 text-[11px] text-slate-500">No sub-departments under this department.</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {(selectedDepartment || selectedDepartmentIds.length > 0) && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-xl border border-indigo-100 text-xs text-indigo-600 font-medium">
                <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  {multipleAssignEnabled
                    ? selectedSubDepartmentIds.length > 0
                      ? `Showing users from ${selectedSubDepartmentIds.length} selected sub-department${selectedSubDepartmentIds.length === 1 ? '' : 's'} and their parent departments`
                      : `Showing users from ${selectedDepartmentIds.length} selected department${selectedDepartmentIds.length === 1 ? '' : 's'}`
                    : (
                      <>
                        Showing users from:{' '}
                        <strong>
                          {selectedSubDepartment
                            ? visibleSubDepts.find((department) => department._id === selectedSubDepartment)?.name
                            : visibleTopDepts.find((department) => department._id === selectedDepartment)?.name}
                        </strong>
                        {selectedSubDepartment && <span className="text-indigo-400"> (sub-department)</span>}
                      </>
                    )}
                </span>
              </div>
            )}

            {isUsingCompanyWideFallback && isTopLevelAdmin && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-700 font-medium">
                <Users className="w-3.5 h-3.5 flex-shrink-0" />
                <span>No assignee found in selected scope. Showing company-wide users.</span>
              </div>
            )}

            {itemType === 'grievance' && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
                  Note / Description
                  <span className="ml-1 text-[9px] font-semibold normal-case tracking-normal text-slate-400">
                    (optional)
                  </span>
                  <span
                    className={`ml-auto text-[10px] font-bold ${assignmentNote.length > 100 ? 'text-rose-500' : 'text-slate-400'}`}
                  >
                    {assignmentNote.length}/100
                  </span>
                </label>
                <textarea
                  value={assignmentNote}
                  onChange={(event) => setAssignmentNote(event.target.value)}
                  placeholder={
                    multipleAssignEnabled
                      ? 'Add context for all selected departments and users...'
                      : 'Add context for this sub-department transfer...'
                  }
                  className={`min-h-[52px] w-full rounded-2xl border ${assignmentNote.length > 100 ? 'border-rose-500 ring-1 ring-rose-500/20' : 'border-slate-200'} bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-transparent focus:ring-2 focus:ring-indigo-500`}
                />
                {assignmentNote.length > 100 && (
                  <p className="mt-1 text-[10px] font-bold text-rose-500 uppercase tracking-tight px-1">
                    Character limit exceeded by {assignmentNote.length - 100} characters
                  </p>
                )}
              </div>
            )}
          </div>

        

          <div className="mt-2.5 rounded-xl border border-slate-200 bg-white shadow-sm">
            {(multipleAssignEnabled ? selectedDepartmentIds.length === 0 : !selectedDepartment) ? (
              <div className="p-10 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-600 font-medium">
                  {multipleAssignEnabled ? 'Please select one or more departments' : 'Please select a department'}
                </p>
                <p className="text-slate-400 text-sm mt-1">
                  {multipleAssignEnabled
                    ? 'Choose departments to load their users'
                    : 'Choose a department to view available assignees'}
                </p>
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
                  const userDept = typeof user.departmentId === 'object' ? user.departmentId : null;
                  const currentAssigneeId =
                    typeof currentAssignee === 'object' && currentAssignee !== null
                      ? currentAssignee._id
                      : currentAssignee;
                  const isCurrentAssignee = currentAssigneeId === user._id;
                  const isAssigning = assigningUserId === user._id;
                  const isSelected = selectedUserIds.includes(user._id);
                  const isPrimary = primarySelectedUserId === user._id;
                  const belongsToScope = getUserDepartmentIds(user).some((departmentId) =>
                    targetScopeDepartmentIds.includes(departmentId)
                  );

                  return (
                    <div
                      key={user._id}
                      className={`p-3.5 hover:bg-slate-50 transition-all duration-200 ${
                        isCurrentAssignee ? 'bg-blue-50/50' : ''
                      } ${isSelected ? 'bg-sky-50/40' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        {multipleAssignEnabled && (
                          <Checkbox
                            checked={isSelected}
                            onChange={(event) => handleToggleSelectedUser(user._id, event.currentTarget.checked)}
                          />
                        )}

                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-md ${
                            isCurrentAssignee
                              ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
                              : 'bg-gradient-to-br from-slate-400 to-slate-500'
                          }`}
                        >
                          {user.firstName?.[0]}
                          {user.lastName?.[0]}
                        </div>

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
                            {multipleAssignEnabled && isPrimary && (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] rounded-full font-bold uppercase">
                                Primary
                              </span>
                            )}
                            {multipleAssignEnabled && isSelected && !isPrimary && (
                              <span className="px-2 py-0.5 bg-sky-100 text-sky-700 text-[10px] rounded-full font-bold uppercase">
                                Also notify
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 text-slate-500 text-sm">
                            <Mail className="w-3.5 h-3.5" />
                            <span className="break-words whitespace-normal">{user.email}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                              {user.userId}
                            </span>
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${getRoleColor(getUserRoleLabel(user))}`}
                            >
                              {getUserRoleLabel(user)}
                            </span>
                            {userDept && (
                              <span className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                <Building2 className="w-3 h-3" />
                                <span className="break-words whitespace-normal">{userDept.name}</span>
                              </span>
                            )}
                            {multipleAssignEnabled && !belongsToScope && (
                              <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                fallback scope
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedUserProfile(user)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-transparent hover:border-indigo-100"
                            title="View Profile"
                          >
                            <Search className="w-4 h-4" />
                          </button>

                          {!multipleAssignEnabled ? (
                            <div className="flex flex-col items-end gap-1.5">
                              <Button
                                onClick={() => void handleSingleAssign(user._id)}
                                disabled={assigningUserId !== null}
                                title={
                                  assignmentNote.length > 100
                                    ? `Note exceeds 100 characters (currently ${assignmentNote.length})`
                                    : isCurrentAssignee
                                      ? 'Already assigned to this user'
                                      : ''
                                }
                                size="sm"
                                className={`min-w-[100px] rounded-xl font-semibold transition-all shadow-md ${
                                  isCurrentAssignee
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none'
                                    : assignmentNote.length > 100
                                      ? 'opacity-50 cursor-not-allowed bg-slate-200 text-slate-500'
                                      : isAssigning
                                        ? 'bg-blue-600'
                                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white active:scale-95'
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
                                  onClick={() => {
                                    if (assignmentNote.length <= 100) void handleSingleAssign(user._id);
                                  }}
                                  disabled={assigningUserId !== null}
                                  size="sm"
                                  variant="outline"
                                  className={`min-w-[100px] rounded-xl border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800 font-semibold transition-all ${assignmentNote.length > 100 ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
                                >
                                  Reassign
                                </Button>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col items-end gap-1.5">
                              <Button
                                type="button"
                                size="sm"
                                variant={isPrimary ? 'default' : 'outline'}
                                disabled={!isSelected}
                                onClick={() => setPrimarySelectedUserId(user._id)}
                                className={`min-w-[120px] rounded-xl font-semibold ${
                                  isPrimary
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                {isPrimary ? 'Primary assignee' : 'Make primary'}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center px-5 py-4 border-t border-slate-200 bg-white">
          <p className="text-xs text-slate-400">
            {multipleAssignEnabled
              ? `${selectedUserIds.length} selected user${selectedUserIds.length === 1 ? '' : 's'}`
              : `${filteredUsers.length} ${filteredUsers.length === 1 ? 'user' : 'users'} available`}
          </p>
          <div className="flex items-center gap-2">
            {multipleAssignEnabled && (
              <Button
                onClick={() => void handleMultiAssignSubmit()}
                disabled={
                  assigningUserId !== null ||
                  selectedUserIds.length === 0 ||
                  !primarySelectedUserId ||
                  assignmentNote.length > 100
                }
                className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700"
              >
                {assigningUserId ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Assigning
                  </span>
                ) : (
                  `Assign ${selectedUserIds.length || ''}`.trim()
                )}
              </Button>
            )}
            <Button
              onClick={onClose}
              variant="outline"
              className="rounded-xl border-slate-200 hover:bg-slate-50"
            >
              Cancel
            </Button>
          </div>
        </div>

        {selectedUserProfile && (
          <UserDetailsDialog
            isOpen={!!selectedUserProfile}
            onClose={() => setSelectedUserProfile(null)}
            user={selectedUserProfile}
            onAssign={(user) =>
              multipleAssignEnabled
                ? handleToggleSelectedUser(user._id, !selectedUserIds.includes(user._id))
                : void handleSingleAssign(user._id)
            }
            isAssigning={assigningUserId === selectedUserProfile._id}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
