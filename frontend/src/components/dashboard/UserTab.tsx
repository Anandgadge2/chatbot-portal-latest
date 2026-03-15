"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  ArrowUpDown, 
  Mail, 
  Phone, 
  Shield, 
  Building, 
  Edit2, 
  Trash2,
  TrendingUp
} from "lucide-react";
import { TabsContent } from "@/components/ui/tabs";
import { Permission, hasPermission } from "@/lib/permissions";
import { TableSkeleton } from "@/components/ui/GeneralSkeleton";
import { Pagination } from "@/components/ui/Pagination";
import { toast } from "react-hot-toast";
import { userAPI } from "@/lib/api/user";

interface UserTabProps {
  user: any;
  users: any[];
  roles: any[];
  departments: any[];
  isCompanyLevel: boolean;
  isDepartmentLevel: boolean;
  isSuperAdmin: boolean;
  userSearch: string;
  setUserSearch: (val: string) => void;
  userFilters: any;
  setUserFilters: (fn: (prev: any) => any) => void;
  showUserFiltersOnMobile: boolean;
  setShowUserFiltersOnMobile: (val: any) => void;
  activeUserFilterCount: number;
  loadingUsers: boolean;
  userPage: number;
  setUserPage: (page: number) => void;
  userPagination: any;
  setShowUserDialog: (show: boolean) => void;
  setSelectedUserForDetails: (user: any) => void;
  setShowUserDetailsDialog: (show: boolean) => void;
  setEditingUser: (user: any) => void;
  setShowEditUserDialog: (show: boolean) => void;
  setShowChangePermissionsDialog: (show: boolean) => void;
  handleSort: (key: string, type: string) => void;
  sortConfig: any;
  getSortedData: (data: any[], type: string) => any[];
  handleToggleUserStatus: (id: string, current: boolean) => void;
  setConfirmDialog: (dialog: any) => void;
  formatTo10Digits: (phone?: string) => string;
  getParentDepartmentId: (dept: any) => string | null;
  setUsers: (fn: (prev: any[]) => any[]) => void;
  fetchUsers: (page: number, silent?: boolean) => void;
  fetchDashboardData: (silent?: boolean) => void;
}

export default function UserTab({
  user,
  users,
  roles,
  departments,
  isCompanyLevel,
  isDepartmentLevel,
  isSuperAdmin,
  userSearch,
  setUserSearch,
  userFilters,
  setUserFilters,
  showUserFiltersOnMobile,
  setShowUserFiltersOnMobile,
  activeUserFilterCount,
  loadingUsers,
  userPage,
  setUserPage,
  userPagination,
  setShowUserDialog,
  setSelectedUserForDetails,
  setShowUserDetailsDialog,
  setEditingUser,
  setShowEditUserDialog,
  setShowChangePermissionsDialog,
  handleSort,
  sortConfig,
  getSortedData,
  handleToggleUserStatus,
  setConfirmDialog,
  formatTo10Digits,
  getParentDepartmentId,
  setUsers,
  fetchUsers,
  fetchDashboardData
}: UserTabProps) {
  return (
    <TabsContent value="users" className="space-y-6">
      <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
        <CardHeader className="bg-slate-900 px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                <Users className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-white">
                  User Management
                </CardTitle>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                  {isCompanyLevel
                    ? "Manage users in your company"
                    : "Manage users in your department"}
                </p>
              </div>
            </div>
            {hasPermission(user, Permission.CREATE_USER) && (
              <Button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowUserDialog(true);
                }}
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white border-0 h-8 text-[10px] font-bold uppercase tracking-widest rounded-lg px-4 shadow-md"
              >
                <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                Add User
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Search and Filters for Users */}
          <div className="px-3 sm:px-5 py-3 border-b border-slate-100 bg-slate-50/40 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <div className="relative w-full sm:flex-1 sm:min-w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search users by name, email, phone or ID..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm"
                />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowUserFiltersOnMobile((prev: any) => !prev)}
                  className="sm:hidden h-8 flex-1 text-[10px] font-bold uppercase tracking-wider border-slate-200 text-slate-700"
                >
                  <Filter className="w-3.5 h-3.5 mr-1.5" />
                  Filters {activeUserFilterCount > 0 ? `(${activeUserFilterCount})` : ""}
                </Button>
                {(userFilters.role || userFilters.status || userFilters.mainDeptId || userFilters.subDeptId || userSearch.trim()) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setUserSearch("");
                      setUserFilters((prev: any) => ({ ...prev, role: "", status: "", mainDeptId: "", subDeptId: "" }));
                    }}
                    className="h-8 px-3 sm:px-2 text-[10px] font-bold text-red-500 hover:text-red-600 hover:bg-red-50 uppercase tracking-tighter"
                  >
                    Clear All
                  </Button>
                )}
              </div>
            </div>

            {/* User Filters */}
            <div className={`${showUserFiltersOnMobile ? "grid" : "hidden"} sm:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-2 w-full`}>
              <select
                value={userFilters.role}
                onChange={(e) => setUserFilters((prev: any) => ({ ...prev, role: e.target.value }))}
                className="w-full h-9 text-[10px] font-bold uppercase tracking-wider px-3 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500/10 outline-none cursor-pointer hover:border-indigo-200 transition-all"
                aria-label="Filter users by role"
              >
                <option value="">All Roles</option>
                {roles.map(r => (
                  <option key={r._id} value={`CUSTOM:${r._id}`}>{r.name}</option>
                ))}
                {isSuperAdmin && <option value="SUPER_ADMIN">Super Admin</option>}
              </select>
              <select
                value={userFilters.status}
                onChange={(e) => setUserFilters((prev: any) => ({ ...prev, status: e.target.value }))}
                className="w-full h-9 text-[10px] font-bold uppercase tracking-wider px-3 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500/10 outline-none cursor-pointer hover:border-indigo-200 transition-all"
                aria-label="Filter users by status"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <select
                value={userFilters.mainDeptId}
                onChange={(e) => setUserFilters((prev: any) => ({ ...prev, mainDeptId: e.target.value, subDeptId: "" }))}
                className="w-full h-9 text-[10px] font-bold uppercase tracking-wider px-3 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500/10 outline-none cursor-pointer hover:border-indigo-200 transition-all"
                aria-label="Filter users by main department"
              >
                <option value="">Main Dept</option>
                {departments.filter(d => !d.parentDepartmentId).map(dept => (
                  <option key={dept._id} value={dept._id}>{dept.name}</option>
                ))}
              </select>
              <select
                value={userFilters.subDeptId}
                onChange={(e) => setUserFilters((prev: any) => ({ ...prev, subDeptId: e.target.value }))}
                className="w-full h-9 text-[10px] font-bold uppercase tracking-wider px-3 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500/10 outline-none cursor-pointer hover:border-indigo-200 transition-all disabled:bg-slate-100 disabled:text-slate-400"
                disabled={!userFilters.mainDeptId}
                aria-label="Filter users by sub department"
              >
                <option value="">Sub Dept</option>
                {userFilters.mainDeptId && departments.filter(d => getParentDepartmentId(d) === userFilters.mainDeptId).map(dept => (
                  <option key={dept._id} value={dept._id}>{dept.name}</option>
                ))}
              </select>
            </div>
          </div>

          {loadingUsers ? (
            <TableSkeleton rows={8} cols={6} />
          ) : users.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-10 h-10 text-indigo-500" />
              </div>
              <p className="text-slate-500 text-lg font-medium">
                No users found
              </p>
              <p className="text-slate-400 text-sm mt-1">
                Add a user to get started
              </p>
            </div>
          ) : (
            <div className="overflow-hidden">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full min-w-[980px] relative border-collapse table-auto">
                  <thead className="bg-[#fcfdfe] border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-3 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest w-[5%]">
                        Sr.
                      </th>
                      <th className="px-6 py-3 text-left w-[25%]">
                        <button
                          onClick={() =>
                            handleSort("firstName", "users")
                          }
                          className="group flex items-center space-x-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                        >
                          <span>User Info</span>
                          <ArrowUpDown
                            className={`w-3 h-3 transition-colors ${sortConfig.key === "firstName" ? "text-indigo-500" : "text-slate-300 group-hover:text-slate-400"}`}
                          />
                        </button>
                      </th>
                      <th className="px-5 py-3 text-left">
                        <button
                          onClick={() => handleSort("email", "users")}
                          className="group flex items-center space-x-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                        >
                          <span>Contact Information</span>
                          <ArrowUpDown
                            className={`w-3 h-3 transition-colors ${sortConfig.key === "email" ? "text-indigo-500" : "text-slate-300 group-hover:text-slate-400"}`}
                          />
                        </button>
                      </th>
                      <th className="px-6 py-3 text-left">
                        <button
                          onClick={() => handleSort("role", "users")}
                          className="group flex items-center space-x-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                        >
                          <span>Role &amp; Dept</span>
                          <ArrowUpDown
                            className={`w-3 h-3 transition-colors ${sortConfig.key === "role" ? "text-indigo-500" : "text-slate-300 group-hover:text-slate-400"}`}
                          />
                        </button>
                      </th>
                      <th className="px-6 py-3 text-left">
                        <button
                          onClick={() =>
                            handleSort("isActive", "users")
                          }
                          className="group flex items-center space-x-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                        >
                          <span>Status &amp; Access</span>
                          <ArrowUpDown
                            className={`w-3 h-3 transition-colors ${sortConfig.key === "isActive" ? "text-indigo-500" : "text-slate-300 group-hover:text-slate-400"}`}
                          />
                        </button>
                      </th>
                      <th className="px-6 py-3 text-right text-[9px] font-black text-slate-400 border-b border-slate-100 uppercase tracking-widest">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {getSortedData(users, "users").map(
                      (u: any, index: number) => (
                        <tr
                          key={u._id}
                          className="hover:bg-gradient-to-r hover:from-indigo-50/50 hover:to-blue-50/50 transition-all duration-200 group/row"
                        >
                          <td className="px-3 py-5 text-center">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-100 to-blue-100 text-indigo-700 text-xs font-bold shadow-sm">
                              {(userPage - 1) * userPagination.limit +
                                index +
                                1}
                            </span>
                          </td>
                          <td className="px-4 py-5">
                            <div className="flex items-center">
                              <div className="relative">
                                <div className="flex-shrink-0 h-12 w-12 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-full flex items-center justify-center text-white text-base font-bold shadow-sm border-2 border-white ring-1 ring-gray-100">
                                  {u.firstName[0]}
                                  {u.lastName[0]}
                                </div>
                                <div
                                  className={`absolute bottom-0 right-0 h-3.5 w-3.5 border-2 border-white rounded-full shadow-sm ${u.isActive ? "bg-green-500" : "bg-gray-300"}`}
                                ></div>
                              </div>
                              <div className="ml-3 min-w-0">
                                <button
                                  onClick={async () => {
                                    try {
                                      const response =
                                        await userAPI.getById(u._id);
                                      if (response.success) {
                                        setSelectedUserForDetails(
                                          response.data.user,
                                        );
                                        setShowUserDetailsDialog(true);
                                      }
                                    } catch (error: any) {
                                      toast.error(
                                        "Failed to load user details",
                                      );
                                    }
                                  }}
                                  className="text-sm font-bold text-slate-900 leading-snug hover:text-blue-600 hover:underline text-left whitespace-normal block w-full"
                                >
                                  {u.firstName} {u.lastName}
                                </button>
                                <div className="mt-1 flex flex-col gap-1">
                                  {u.designation && (
                                    <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50/80 px-2 py-0.5 rounded-md border border-indigo-100/50 uppercase tracking-wider w-fit shadow-sm">
                                      {u.designation}
                                    </span>
                                  )}
                                  <span className="text-[8px] font-black bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 uppercase tracking-widest w-fit">
                                    ID: {u.userId}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-5">
                            <div className="flex flex-col space-y-1.5">
                              <div className="flex items-center text-sm text-blue-600 font-medium break-all">
                                <Mail className="w-3.5 h-3.5 mr-2 text-blue-400 shrink-0" />
                                {u.email}
                              </div>
                              {u.phone && (
                                <div className="flex items-center text-xs text-gray-500">
                                  <Phone className="w-3.5 h-3.5 mr-2 text-gray-400" />
                                  {formatTo10Digits(u.phone)}
                                </div>
                              )}
                              {isSuperAdmin && u.notificationSettings && (
                                <div className="flex items-center gap-2 mt-2">
                                  <div 
                                    title={`Email Notifications: ${u.notificationSettings.email ? 'Enabled' : 'Disabled'}`}
                                    className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter border flex items-center gap-1 ${
                                      u.notificationSettings.email 
                                        ? 'bg-blue-50 text-blue-600 border-blue-100' 
                                        : 'bg-slate-50 text-slate-300 border-slate-100'
                                    }`}
                                  >
                                    <Mail className={`w-2.5 h-2.5 ${u.notificationSettings.email ? 'text-blue-500' : 'text-slate-300'}`} />
                                    Email
                                  </div>
                                  <div 
                                    title={`WhatsApp Notifications: ${u.notificationSettings.whatsapp ? 'Enabled' : 'Disabled'}`}
                                    className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter border flex items-center gap-1 ${
                                      u.notificationSettings.whatsapp 
                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                                        : 'bg-slate-50 text-slate-300 border-slate-100'
                                    }`}
                                  >
                                    <TrendingUp className={`w-2.5 h-2.5 ${u.notificationSettings.whatsapp ? 'text-emerald-500' : 'text-slate-300'}`} />
                                    WhatsApp
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-5">
                            <div className="flex flex-col space-y-2">
                              <div className="flex">
                                <span
                                  className={`px-2.5 py-0.5 inline-flex items-center text-[10px] font-bold rounded-full border shadow-sm ${
                                    u.role === "COMPANY_ADMIN"
                                      ? "bg-red-50 text-red-700 border-red-100 ring-1 ring-red-200"
                                      : typeof u.customRoleId ===
                                            "object" && u.customRoleId
                                        ? "bg-indigo-50 text-indigo-700 border-indigo-100 ring-1 ring-indigo-200"
                                        : (u.role ===
                                              "DEPARTMENT_ADMIN" &&
                                              typeof u.departmentId ===
                                                "object" &&
                                              (u.departmentId as any)
                                                ?.parentDepartmentId) ||
                                            u.role ===
                                              "SUB_DEPARTMENT_ADMIN"
                                          ? "bg-purple-50 text-purple-700 border-purple-100 ring-1 ring-purple-200 shadow-purple-900/5"
                                          : u.role ===
                                              "DEPARTMENT_ADMIN"
                                            ? "bg-blue-50 text-blue-700 border-blue-100 ring-1 ring-blue-200"
                                            : u.role === "OPERATOR"
                                              ? "bg-emerald-50 text-emerald-700 border-emerald-100 ring-1 ring-emerald-200"
                                              : "bg-slate-50 text-slate-700 border-slate-200"
                                  }`}
                                >
                                  <Shield className="w-2.5 h-2.5 mr-1" />
                                  {typeof u.customRoleId === "object" &&
                                  u.customRoleId
                                    ? (u.customRoleId as any).name
                                    : (u.role === "DEPARTMENT_ADMIN" &&
                                          typeof u.departmentId ===
                                            "object" &&
                                          (u.departmentId as any)
                                            ?.parentDepartmentId) ||
                                        u.role ===
                                          "SUB_DEPARTMENT_ADMIN"
                                      ? "Sub Department Admin"
                                      : u.role === "SUPER_ADMIN"
                                        ? "Super Admin"
                                        : u.role === "COMPANY_ADMIN"
                                          ? "Company Admin"
                                          : u.role ===
                                              "DEPARTMENT_ADMIN"
                                            ? "Department Admin"
                                            : u.role === "OPERATOR"
                                              ? "Operator"
                                              : u.role ===
                                                  "ANALYTICS_VIEWER"
                                                ? "Analytics Viewer"
                                                : (
                                                    u.role || ""
                                                  ).replace(/_/g, " ")}
                                </span>
                              </div>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-start text-[11px] text-slate-600 font-bold group-hover/row:text-indigo-900 transition-colors whitespace-normal break-words">
                                  <Building className="w-3.5 h-3.5 mr-1.5 text-slate-400 group-hover/row:text-indigo-400 transition-colors shrink-0 mt-0.5" />
                                  {typeof u.departmentId === "object" &&
                                  u.departmentId
                                    ? u.departmentId.name
                                    : "All Company Access"}
                                </div>
                                {/* Show permissions summary for custom roles */}
                                {typeof u.customRoleId === "object" &&
                                  u.customRoleId &&
                                  (u.customRoleId as any).permissions
                                    ?.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-0.5">
                                      {(
                                        u.customRoleId as any
                                      ).permissions
                                        .slice(0, 3)
                                        .map((p: any, i: number) => (
                                          <span
                                            key={i}
                                            className="text-[8px] font-black text-indigo-400 bg-indigo-50/50 px-1 py-px rounded uppercase tracking-tighter border border-indigo-100/50"
                                          >
                                            {p.module?.replace(
                                              /_/g,
                                              " ",
                                            )}
                                          </span>
                                        ))}
                                      {(u.customRoleId as any)
                                        .permissions.length > 3 && (
                                        <span className="text-[8px] font-black text-slate-300">
                                          +
                                          {(u.customRoleId as any)
                                            .permissions.length -
                                            3}{" "}
                                          more
                                        </span>
                                      )}
                                    </div>
                                  )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-5">
                            <div className="flex flex-col space-y-2.5">
                              <div className="flex items-center">
                                <div
                                  className={`h-2 w-2 rounded-full mr-2 ${u.isActive ? "bg-green-500 animate-pulse" : "bg-gray-300"}`}
                                ></div>
                                <span
                                  className={`text-xs font-bold ${u.isActive ? "text-green-700" : "text-gray-500"}`}
                                >
                                  {u.isActive ? "Active" : "Inactive"}
                                </span>
                              </div>
                              <div className="flex items-center">
                                <button
                                  onClick={() =>
                                    handleToggleUserStatus(
                                      u._id,
                                      u.isActive,
                                    )
                                  }
                                  disabled={user && u._id === user.id}
                                  className={`relative inline-flex h-5 w-10 flex-shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                                    user && u._id === user.id
                                      ? "bg-gray-300 cursor-not-allowed opacity-50"
                                      : u.isActive
                                        ? "bg-green-500 cursor-pointer"
                                        : "bg-red-400 cursor-pointer"
                                  }`}
                                  title={
                                    user && u._id === user.id
                                      ? "You cannot deactivate yourself"
                                      : "Toggle user status"
                                  }
                                >
                                  <span className="sr-only">
                                    Toggle user status
                                  </span>
                                  <span
                                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${u.isActive ? "translate-x-5" : "translate-x-1"}`}
                                  />
                                </button>
                                <span
                                  className={`ml-2 text-[10px] font-bold uppercase tracking-wider ${
                                    u.isActive
                                      ? "text-green-600"
                                      : "text-gray-400"
                                  }`}
                                >
                                  {u.isActive ? "Active" : "Inactive"}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-5 whitespace-normal text-right">
                            <div className="flex justify-end items-center gap-1.5">
                              {hasPermission(
                                user,
                                Permission.UPDATE_USER,
                              ) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors flex-shrink-0"
                                  title="Edit User"
                                  onClick={() => {
                                    setEditingUser(u);
                                    setShowEditUserDialog(true);
                                  }}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                              )}
                              {hasPermission(
                                user,
                                Permission.UPDATE_USER,
                              ) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors flex-shrink-0"
                                  title="Change Permissions"
                                  onClick={() => {
                                    setEditingUser(u);
                                    setShowChangePermissionsDialog(
                                      true,
                                    );
                                  }}
                                >
                                  <Shield className="w-4 h-4" />
                                </Button>
                              )}
                              {hasPermission(
                                user,
                                Permission.DELETE_USER,
                              ) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={`h-8 w-8 p-0 transition-colors flex-shrink-0 ${
                                    user && u._id === user.id
                                      ? "text-slate-300 cursor-not-allowed"
                                      : "text-slate-400 hover:text-red-600 hover:bg-red-50"
                                  }`}
                                  title={
                                    user && u._id === user.id
                                      ? "You cannot delete yourself"
                                      : "Delete User"
                                  }
                                  disabled={user && u._id === user.id}
                                  onClick={() => {
                                    if (user && u._id === user.id) {
                                      toast.error(
                                        "You cannot delete yourself",
                                      );
                                      return;
                                    }

                                    setConfirmDialog({
                                      isOpen: true,
                                      title: "Delete User",
                                      message: `Are you sure you want to delete ${u.firstName} ${u.lastName}? This action cannot be undone.`,
                                      onConfirm: async () => {
                                        try {
                                          const response =
                                            await userAPI.delete(u._id);
                                          if (response.success) {
                                            toast.success(
                                              "User deleted successfully",
                                            );
                                            setUsers((prev: any[]) =>
                                              prev.filter(
                                                (user: any) =>
                                                  user._id !== u._id,
                                              ),
                                            );
                                            fetchUsers(userPage, true);
                                            fetchDashboardData(true);
                                          }
                                        } catch (error: any) {
                                          const errorMessage =
                                            error.response?.data
                                              ?.message ||
                                            error.message ||
                                            "Failed to delete user";
                                          toast.error(errorMessage);
                                        } finally {
                                          setConfirmDialog((p: any) => ({
                                            ...p,
                                            isOpen: false,
                                          }));
                                        }
                                      },
                                    });
                                  }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>

              <Pagination
                currentPage={userPage}
                totalPages={userPagination.pages}
                totalItems={userPagination.total}
                itemsPerPage={userPagination.limit}
                onPageChange={setUserPage}
                className="mt-6 shadow-none border-t border-slate-100 rounded-none bg-slate-50/30"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}
