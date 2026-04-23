import sys
import re

file_path = r"d:\Multitenant_chatbot\chatbot_portal-chatbot_flow_features\frontend\src\app\dashboard\page.tsx"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix fetchDashboardData dependencies
# Look for the block and add refetchDashboardStats
dashboard_deps_pattern = r'(\[[\s\n]*companyIdParam,[\s\n]*isSuperAdminUser,[\s\n]*activeTab,[\s\n]*analyticsFilters,[\s\n]*overviewFilters,[\s\n]*assignedDepartmentIds,[\s\n]*isSubDepartmentAdminRole,[\s\n]*isOperatorRole,[\s\n]*currentUserCompanyId,)[\s\n]*\],'
content = re.sub(dashboard_deps_pattern, r'\1\n      refetchDashboardStats,\n    ],', content)

# Fix fetchGrievances dependencies
# Look for the block and add activeTab and refetchGrievances
grievance_deps_pattern = r'(\[[\s\n]*grievancePage,[\s\n]*grievancePagination\.limit,[\s\n]*user,[\s\n]*hasModule,[\s\n]*grievanceFilters,[\s\n]*grievanceSearch,[\s\n]*assignedDepartmentIds,[\s\n]*isSubDepartmentAdminRole,[\s\n]*isOperatorRole,[\s\n]*isSuperAdminUser,[\s\n]*companyIdParam,)[\s\n]*\],'
content = re.sub(grievance_deps_pattern, r'\1\n      activeTab,\n      refetchGrievances,\n    ],', content)

# Also check fetchDepartments and fetchUsers which I modified earlier
# fetchDepartments
dept_deps_pattern = r'(\[[\s\n]*departmentPage,[\s\n]*departmentPagination\.limit,[\s\n]*deptSearch,[\s\n]*deptFilters,[\s\n]*isSuperAdminUser,[\s\n]*isCompanyLevel,[\s\n]*isDepartmentLevel,[\s\n]*user,[\s\n]*companyIdParam,[\s\n]*getParentDepartmentId,)[\s\n]*\],'
content = re.sub(dept_deps_pattern, r'\1\n      activeTab,\n      refetchDepartmentsHook,\n    ],', content)

# fetchUsers
user_deps_pattern = r'(\[[\s\n]*userPage,[\s\n]*userPagination\.limit,[\s\n]*userSearch,[\s\n]*userFilters,[\s\n]*getParentDepartmentId,[\s\n]*assignedDepartmentIds,[\s\n]*isSubDepartmentAdminRole,[\s\n]*isOperatorRole,[\s\n]*isSuperAdminUser,[\s\n]*companyIdParam,)[\s\n]*\],'
content = re.sub(user_deps_pattern, r'\1\n      activeTab,\n      refetchUsersHook,\n    ],', content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("ESLint dependency warnings fixed.")
