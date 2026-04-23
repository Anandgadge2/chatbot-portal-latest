import sys
import re

file_path = r"d:\Multitenant_chatbot\chatbot_portal-chatbot_flow_features\frontend\src\app\dashboard\page.tsx"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add Imports
import_pattern = r'import \{ useGrievances \} from "@\/lib\/query\/useGrievances";'
new_imports = 'import { useGrievances } from "@/lib/query/useGrievances";\nimport { useDashboardStats } from "@/lib/query/useDashboardStats";\nimport { useDepartments } from "@/lib/query/useDepartments";\nimport { useUsers } from "@/lib/query/useUsers";'
content = content.replace(import_pattern, new_imports)

# 2. Add Hook Calls
# We look for the useGrievances hook call
hook_call_pattern = r'const \{ data: cachedGrievanceData, isLoading: isLoadingGrievancesFromHook, refetch: refetchGrievances \} = useGrievances\(\{.*?\}\);'
# Note: I need to be careful with the parameters for each hook.

new_hook_calls = """
  // ⚡ Performance Optimized Data Fetching (Cache-First)
  const { data: cachedGrievanceData, isLoading: isLoadingGrievancesFromHook, refetch: refetchGrievances } = useGrievances({
    page: grievancePage,
    limit: grievancePagination.limit,
    status: grievanceFilters.status,
    companyId: targetCompanyId,
    departmentId: grievanceFilters.subDeptId || grievanceFilters.mainDeptId,
    priority: grievanceFilters.priority,
    search: grievanceSearch,
    enabled: mounted && activeTab === "grievances",
  });

  const { data: cachedDashboardStats, isLoading: isLoadingStatsFromHook, refetch: refetchDashboardStats } = useDashboardStats({
    companyId: targetCompanyId,
    departmentId: isSubDepartmentAdminRole || isOperatorRole
            ? assignedDepartmentIds[0] || ""
            : (activeTab === "analytics" ? analyticsFilters : overviewFilters)?.subDeptId || (activeTab === "analytics" ? analyticsFilters : overviewFilters)?.mainDeptId || "",
    enabled: mounted && (activeTab === "overview" || activeTab === "analytics"),
  });

  const { data: cachedDepartmentData, isLoading: isLoadingDeptsFromHook, refetch: refetchDepartmentsHook } = useDepartments({
    page: departmentPage,
    limit: departmentPagination.limit,
    search: deptSearch,
    companyId: targetCompanyId,
    status: deptFilters.status,
    mainDeptId: deptFilters.mainDeptId,
    subDeptId: deptFilters.subDeptId,
    enabled: mounted && (activeTab === "departments" || (activeTab === "overview" && isDepartmentLevel)),
  });

  const { data: cachedUserData, isLoading: isLoadingUsersFromHook, refetch: refetchUsersHook } = useUsers({
    page: userPage,
    limit: userPagination.limit,
    search: userSearch,
    companyId: targetCompanyId,
    departmentId: userFilters.department,
    role: userFilters.role,
    status: userFilters.status,
    enabled: mounted && activeTab === "users",
  });
"""

# Find the start of the hook calls block
content = re.sub(r'// ⚡ Performance Optimized Grievance Fetching \(Cache-First\).*?refetch: refetchGrievances \} = useGrievances\(\{.*?\}\);', new_hook_calls, content, flags=re.DOTALL)

# 3. Add Synchronization Effects
sync_effects = """
  // 🔄 Background Synchronization for Cached Data
  useEffect(() => {
    if (cachedGrievanceData) {
      setGrievances(cachedGrievanceData.grievances);
      setGrievancePagination(prev => ({
        ...prev,
        total: cachedGrievanceData.pagination.total,
        pages: cachedGrievanceData.pagination.pages,
      }));
    }
  }, [cachedGrievanceData]);

  useEffect(() => {
    if (cachedDashboardStats) {
      setStats(cachedDashboardStats);
    }
  }, [cachedDashboardStats]);

  useEffect(() => {
    if (cachedDepartmentData) {
      setDepartments(cachedDepartmentData.departments);
      setDepartmentPagination(prev => ({
        ...prev,
        total: cachedDepartmentData.pagination.total,
        pages: cachedDepartmentData.pagination.pages,
      }));
    }
  }, [cachedDepartmentData]);

  useEffect(() => {
    if (cachedUserData) {
      setUsers(cachedUserData.users);
      setUserPagination(prev => ({
        ...prev,
        total: cachedUserData.pagination.total,
        pages: cachedUserData.pagination.pages,
      }));
    }
  }, [cachedUserData]);
"""

# Place sync effects after the hook calls
content = content.replace(new_hook_calls, new_hook_calls + sync_effects)

# 4. Refactor fetch functions to use hooks
# fetchDashboardData
fetch_dashboard_data_replacement = """
  const fetchDashboardData = useCallback(
    async (
      refresh = false,
      overrideFilters?: { mainDeptId?: string; subDeptId?: string },
    ) => {
      if (isSuperAdminUser && !companyIdParam) return;
      
      // If we are in the relevant tab, use the hook's refetch for consistency
      if (activeTab === "overview" || activeTab === "analytics") {
        await refetchDashboardStats();
        return;
      }

      try {
"""
content = content.replace("const fetchDashboardData = useCallback(\n    async (\n      refresh = false,\n      overrideFilters?: { mainDeptId?: string; subDeptId?: string },\n    ) => {\n      if (isSuperAdminUser && !companyIdParam) return;\n      try {", fetch_dashboard_data_replacement)

# fetchDepartments
fetch_depts_replacement = """
  const fetchDepartments = useCallback(
    async (page = departmentPage, isSilent = false) => {
      if (isSuperAdminUser && !companyIdParam) return;

      if (activeTab === "departments" || (activeTab === "overview" && isDepartmentLevel)) {
        await refetchDepartmentsHook();
        return;
      }

      if (!isSilent) setLoadingDepartments(true);
"""
content = content.replace("const fetchDepartments = useCallback(\n    async (page = departmentPage, isSilent = false) => {\n      if (isSuperAdminUser && !companyIdParam) return;\n\n      if (!isSilent) setLoadingDepartments(true);", fetch_depts_replacement)

# fetchUsers
fetch_users_replacement = """
  const fetchUsers = useCallback(
    async (page = userPage, isSilent = false) => {
      if (isSuperAdminUser && !companyIdParam) return;

      if (activeTab === "users") {
        await refetchUsersHook();
        return;
      }

      if (!isSilent) setLoadingUsers(true);
"""
content = content.replace("const fetchUsers = useCallback(\n    async (page = userPage, isSilent = false) => {\n      if (isSuperAdminUser && !companyIdParam) return;\n\n      if (!isSilent) setLoadingUsers(true);", fetch_users_replacement)

# 5. Comment out legacy triggers in page.tsx to prevent duplicate calls
# Departments effect
content = content.replace('      fetchDepartments(departmentPage);', '      // fetchDepartments(departmentPage); // Replaced by useDepartments hook')
# Users effect
content = content.replace('      fetchUsers(userPage);', '      // fetchUsers(userPage); // Replaced by useUsers hook')
# Dashboard stats effects
content = content.replace('    fetchDashboardData();', '    // fetchDashboardData(); // Replaced by useDashboardStats hook')

# 6. Resolve the TypeScript error for priority clearing
# We search for the setGrievanceFilters block that was failing
content = content.replace('                                  dateRange: "",\n                                })', '                                  dateRange: "",\n                                  priority: "",\n                                })')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Dashboard performance optimizations applied successfully.")
