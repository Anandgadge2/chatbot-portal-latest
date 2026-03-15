"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Building, 
  RefreshCw, 
  Search, 
  ArrowUpDown, 
  Users, 
  User as UserIcon, 
  Mail, 
  Edit2, 
  Trash2 
} from "lucide-react";
import { TabsContent } from "@/components/ui/tabs";
import { Permission } from "@/lib/permissions";
import { ProtectedButton } from "@/components/ui/ProtectedButton";
import { TableSkeleton } from "@/components/ui/GeneralSkeleton";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import toast from "react-hot-toast";
import { departmentAPI } from "@/lib/api/department";

interface DepartmentTabProps {
  isCompanyLevel: boolean;
  departments: any[];
  fetchDepartments: (page: number, silent?: boolean) => void;
  setShowDepartmentDialog: (show: boolean) => void;
  deptSearch: string;
  setDeptSearch: (val: string) => void;
  deptFilters: any;
  setDeptFilters: (fn: (prev: any) => any) => void;
  loadingDepartments: boolean;
  handleSort: (key: string, type: string) => void;
  sortConfig: any;
  getSortedData: (data: any[], type: string) => any[];
  navigatingToDepartment: string | null;
  setNavigatingToDepartment: (id: string | null) => void;
  setSelectedDepartmentId: (id: string | null) => void;
  router: any;
  deptUserCounts: Record<string, number>;
  setSelectedDeptForUsers: (dept: any) => void;
  setShowDeptUsersDialog: (show: boolean) => void;
  setConfirmDialog: (dialog: any) => void;
  setEditingDepartment: (dept: any) => void;
}

export default function DepartmentTab({
  isCompanyLevel,
  departments,
  fetchDepartments,
  setShowDepartmentDialog,
  deptSearch,
  setDeptSearch,
  deptFilters,
  setDeptFilters,
  loadingDepartments,
  handleSort,
  sortConfig,
  getSortedData,
  navigatingToDepartment,
  setNavigatingToDepartment,
  setSelectedDepartmentId,
  router,
  deptUserCounts,
  setSelectedDeptForUsers,
  setShowDeptUsersDialog,
  setConfirmDialog,
  setEditingDepartment
}: DepartmentTabProps) {
  if (!isCompanyLevel) return null;

  return (
    <TabsContent value="departments" className="space-y-4">
      <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
        {/* Header */}
        <CardHeader className="bg-slate-900 px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                <Building className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                  Department Management
                  <span className="text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                    {departments.length} total
                  </span>
                </CardTitle>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                  Manage all departments in your company
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchDepartments(1, false)}
                className="h-8 w-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all border border-white/10"
                title="Refresh departments"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <ProtectedButton
                permission={Permission.CREATE_DEPARTMENT}
                onClick={() => setShowDepartmentDialog(true)}
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white border-0 h-8 text-[10px] font-bold uppercase tracking-widest rounded-lg px-4 shadow-md"
              >
                <Building className="w-3.5 h-3.5 mr-1.5" />
                Add Department
              </ProtectedButton>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Search bar */}
          <div className="px-3 sm:px-5 py-3 border-b border-slate-100 bg-slate-50/40 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
            <div className="relative w-full sm:flex-1 sm:min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search departments by name or ID..."
                value={deptSearch}
                onChange={(e) => setDeptSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm"
              />
            </div>
            {/* Dept Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 w-full">
               <select
                value={deptFilters.type}
                onChange={(e) => setDeptFilters((prev: any) => ({ ...prev, type: e.target.value }))}
                className="w-full text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500/10 outline-none cursor-pointer hover:border-indigo-200 transition-all"
              >
                <option value="">All Types</option>
                <option value="main">Main Depts</option>
                <option value="sub">Sub Depts</option>
              </select>
              <select
                value={deptFilters.status}
                onChange={(e) => setDeptFilters((prev: any) => ({ ...prev, status: e.target.value }))}
                className="w-full text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500/10 outline-none cursor-pointer hover:border-indigo-200 transition-all"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <select
                value={deptFilters.mainDeptId}
                onChange={(e) => setDeptFilters((prev: any) => ({ ...prev, mainDeptId: e.target.value }))}
                className="w-full text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500/10 outline-none cursor-pointer hover:border-indigo-200 transition-all sm:min-w-[150px]"
              >
                <option value="">Filter by Main Dept</option>
                {departments.filter(d => !d.parentDepartmentId).map(dept => (
                   <option key={dept._id} value={dept._id}>{dept.name}</option>
                ))}
              </select>
              {(deptFilters.type || deptFilters.status || deptFilters.mainDeptId) && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setDeptFilters((prev: any) => ({ type: "", status: "", mainDeptId: "" }))}
                  className="h-7 text-[9px] font-bold text-red-500 hover:text-red-600 hover:bg-red-50 uppercase tracking-tighter"
                >
                  Clear
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <span className="px-2 py-1 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg">
                {
                  departments.filter((d) => !d.parentDepartmentId)
                    .length
                }{" "}
                Main
              </span>
              <span className="px-2 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg">
                {
                  departments.filter((d) => !!d.parentDepartmentId)
                    .length
                }{" "}
                Sub
              </span>
            </div>
          </div>

          {loadingDepartments ? (
            <TableSkeleton rows={8} cols={5} />
          ) : departments.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Building className="w-10 h-10 text-indigo-500" />
              </div>
              <p className="text-gray-500 text-lg font-medium">
                No departments found
              </p>
              <p className="text-gray-400 text-sm mt-1">
                Add a department to get started
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="max-h-[640px] overflow-y-auto">
                <table className="w-full relative border-collapse min-w-[900px]">
                  <thead className="sticky top-0 z-20 bg-[#fcfdfe] border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-3 text-center text-[9px] font-black text-slate-400 border-b border-slate-100 uppercase tracking-widest w-12">
                        Sr.
                      </th>
                      <th className="px-4 py-3 text-left border-b border-slate-100">
                        <button
                          onClick={() =>
                            handleSort("name", "departments")
                          }
                          className="group flex items-center space-x-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                        >
                          <span>Department Name</span>
                          <ArrowUpDown
                            className={`w-3 h-3 transition-colors ${sortConfig.key === "name" ? "text-indigo-500" : "text-slate-300 group-hover:text-slate-400"}`}
                          />
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        Dept ID
                      </th>
                      <th className="px-4 py-3 text-center border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        Type
                      </th>
                      <th className="px-4 py-3 text-center border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        Users
                      </th>
                      <th className="px-4 py-3 text-left border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        Head / Contact
                      </th>
                      <th className="px-4 py-3 text-center border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {getSortedData(departments, "departments").map((dept: any, index: number) => {
                      const isMain = !dept.parentDepartmentId;
                      const userCount = dept.userCount || deptUserCounts[dept._id] || 0;
                      const parentName =
                        typeof dept.parentDepartmentId === "object" &&
                        dept.parentDepartmentId
                          ? (dept.parentDepartmentId as any).name
                          : null;
                      return (
                        <tr
                          key={dept._id}
                          className="hover:bg-indigo-50/30 transition-all duration-150 group/row"
                        >
                          {/* # */}
                          <td className="px-3 py-4 text-center">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-500 text-[10px] font-black group-hover/row:bg-indigo-100 group-hover/row:text-indigo-700 transition-colors">
                              {index + 1}
                            </span>
                          </td>

                          {/* Department Name */}
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                  isMain
                                    ? "bg-indigo-50 text-indigo-600 border border-indigo-100"
                                    : "bg-slate-100 text-slate-500 border border-slate-200"
                                }`}
                              >
                                <Building className="w-3.5 h-3.5" />
                              </div>
                              <div>
                                <div
                                  className="text-sm font-bold text-slate-900 group-hover/row:text-indigo-600 cursor-pointer hover:underline transition-colors flex items-center gap-1.5"
                                  onClick={() => {
                                    setNavigatingToDepartment(dept._id);
                                    setSelectedDepartmentId(dept._id);
                                    router.push(
                                      `/dashboard/department/${dept._id}`,
                                    );
                                  }}
                                >
                                  {navigatingToDepartment ===
                                  dept._id ? (
                                    <>
                                      <LoadingSpinner />
                                      <span className="ml-2">
                                        Loading...
                                      </span>
                                    </>
                                  ) : (
                                    dept.name
                                  )}
                                </div>
                                {!isMain && parentName && (
                                  <p className="text-[10px] text-slate-400 mt-0.5">
                                    ↳ {parentName}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Dept ID */}
                          <td className="px-4 py-4 whitespace-normal break-all">
                            <span className="text-[10px] font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200 uppercase">
                              {dept.departmentId}
                            </span>
                          </td>

                          {/* Type */}
                          <td className="px-4 py-4 text-center whitespace-normal">
                            {isMain ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                Main
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                Sub
                              </span>
                            )}
                          </td>

                          {/* User Count */}
                          <td className="px-4 py-4 text-center">
                            <div className="inline-flex items-center justify-center">
                              <button
                                className={`min-w-[32px] h-8 px-2 rounded-xl flex items-center justify-center text-xs font-black transition-all shadow-sm border ${
                                  userCount > 0
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:scale-105 active:scale-95"
                                    : "bg-slate-50 text-slate-400 border-slate-200"
                                }`}
                                onClick={() => {
                                  if (userCount > 0) {
                                    setSelectedDeptForUsers({
                                      id: dept._id,
                                      name: dept.name,
                                    });
                                    setShowDeptUsersDialog(true);
                                  }
                                }}
                                title={
                                  userCount > 0
                                    ? "Click to view personnel"
                                    : "No users in this department"
                                }
                              >
                                <Users className={`w-3 h-3 mr-1.5 ${userCount > 0 ? "text-emerald-500" : "text-slate-300"}`} />
                                {userCount}
                              </button>
                            </div>
                          </td>

                          {/* Head / Contact */}
                          <td className="px-4 py-4 whitespace-normal break-words">
                            <div className="flex flex-col gap-1 min-w-[120px]">
                              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-tight">
                                <UserIcon className="w-3 h-3 text-slate-400 shrink-0" />
                                {dept.head || (dept as any).headName || dept.contactPerson || (
                                  <span className="text-slate-300 font-medium">
                                    Not assigned
                                  </span>
                                )}
                              </div>
                              {(dept.headEmail || dept.contactEmail) && (
                                <div className="text-[10px] text-indigo-500 flex items-center gap-1.5 font-bold hover:underline cursor-pointer transition-colors px-1 break-all">
                                  <Mail className="w-3 h-3 text-indigo-300 shrink-0" />
                                  {dept.headEmail || dept.contactEmail}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-4 text-center whitespace-normal">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => {
                                  setConfirmDialog({
                                    isOpen: true,
                                    title: dept.isActive
                                      ? "Deactivate Department"
                                      : "Activate Department",
                                    message: dept.isActive
                                      ? `Are you sure you want to deactivate "${dept.name}"?`
                                      : `Are you sure you want to activate "${dept.name}"?`,
                                    onConfirm: async () => {
                                      try {
                                        const response =
                                          await departmentAPI.update(
                                            dept._id,
                                            {
                                              isActive: !dept.isActive,
                                            },
                                          );
                                        if (response.success) {
                                          toast.success(
                                            `Department ${!dept.isActive ? "activated" : "deactivated"} successfully`,
                                          );
                                          fetchDepartments(1, true);
                                        }
                                      } catch (error: any) {
                                        toast.error(
                                          error.message ||
                                            "Failed to update department status",
                                        );
                                      } finally {
                                        setConfirmDialog((p: any) => ({
                                          ...p,
                                          isOpen: false,
                                        }));
                                      }
                                    },
                                    variant: dept.isActive
                                      ? "warning"
                                      : "default",
                                  } as any);
                                }}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                                  dept.isActive
                                    ? "bg-emerald-500"
                                    : "bg-gray-300"
                                }`}
                              >
                                <span
                                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                                    dept.isActive
                                      ? "translate-x-[18px]"
                                      : "translate-x-0.5"
                                  }`}
                                />
                              </button>
                              <span
                                className={`text-[9px] font-black uppercase tracking-wider ${
                                  dept.isActive
                                    ? "text-emerald-600"
                                    : "text-gray-400"
                                }`}
                              >
                                {dept.isActive ? "Active" : "Inactive"}
                              </span>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-4 whitespace-normal text-right">
                            <div className="flex justify-end items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                onClick={() => {
                                  setEditingDepartment(dept);
                                  setShowDepartmentDialog(true);
                                }}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                onClick={() => {
                                  setConfirmDialog({
                                    isOpen: true,
                                    title: "Delete Department",
                                    message: `Are you sure you want to delete "${dept.name}"? This action cannot be undone.`,
                                    onConfirm: async () => {
                                      try {
                                        const response =
                                          await departmentAPI.delete(
                                            dept._id,
                                          );
                                        if (response.success) {
                                          toast.success(
                                            "Department deleted successfully",
                                          );
                                          fetchDepartments(1, false);
                                        }
                                      } catch (error: any) {
                                        toast.error(
                                          error.message ||
                                            "Failed to delete department",
                                        );
                                      } finally {
                                        setConfirmDialog((p: any) => ({
                                          ...p,
                                          isOpen: false,
                                        }));
                                      }
                                    },
                                    variant: "danger",
                                  } as any);
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer info */}
              <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <span>
                  Showing{" "}
                  {
                    departments.filter(
                      (d) =>
                        !deptSearch ||
                        d.name
                          .toLowerCase()
                          .includes(deptSearch.toLowerCase()) ||
                        d.departmentId
                          ?.toLowerCase()
                          .includes(deptSearch.toLowerCase()),
                    ).length
                  }{" "}
                  of {departments.length} departments
                </span>
                <span>
                  {departments.filter((d: any) => d.isActive).length} active
                  · {departments.filter((d: any) => !d.isActive).length}{" "}
                  inactive
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}
