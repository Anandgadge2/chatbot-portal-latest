import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Plus, Search, Edit2, Trash2 } from "lucide-react";
import { Pagination } from "@/components/ui/Pagination";
import { Department } from "@/lib/api/department";
import { Company } from "@/lib/api/company";

interface DepartmentTabContentProps {
  departments: Department[];
  deptSearchTerm: string;
  setDeptSearchTerm: (val: string) => void;
  deptCompanyFilter: string;
  setDeptCompanyFilter: (val: string) => void;
  allCompanies: Company[];
  departmentPage: number;
  setDepartmentPage: (val: number) => void;
  departmentPagination: { total: number; pages: number; limit: number };
  setEditingDepartment: (dept: Department | null) => void;
  setShowDepartmentDialog: (val: boolean) => void;
  handleEditDepartment: (dept: Department) => void;
  handleDeleteDepartment: (dept: Department) => void;
  toggleDepartmentStatus: (dept: Department) => void;
  getCompanyDisplay: (companyId: any) => string;
  router: any;
}

const DepartmentTabContent: React.FC<DepartmentTabContentProps> = ({
  departments,
  deptSearchTerm,
  setDeptSearchTerm,
  deptCompanyFilter,
  setDeptCompanyFilter,
  allCompanies,
  departmentPage,
  setDepartmentPage,
  departmentPagination,
  setEditingDepartment,
  setShowDepartmentDialog,
  handleEditDepartment,
  handleDeleteDepartment,
  toggleDepartmentStatus,
  getCompanyDisplay,
  router,
}) => {
  return (
    <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
      <CardHeader className="bg-slate-900 border-0 px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center backdrop-blur-md border border-white/20">
              <Settings className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-white">
                Department Ecosystem
              </CardTitle>
              <CardDescription className="text-slate-400 text-[10px] font-medium leading-none mt-1">
                Hierarchical organization structure
              </CardDescription>
            </div>
          </div>
          <Button
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg h-8 shadow-md shadow-indigo-900/20 font-bold text-[10px] uppercase tracking-wider px-4 border-0 transition-all"
            onClick={() => {
              setEditingDepartment(null);
              setShowDepartmentDialog(true);
            }}
          >
            <Plus className="w-3 h-3 mr-1.5" />
            Add Department
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/30 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              placeholder="Find department..."
              value={deptSearchTerm}
              onChange={(e) => {
                setDeptSearchTerm(e.target.value);
                setDepartmentPage(1);
              }}
              className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              Filter By Company
            </span>
            <select
              value={deptCompanyFilter}
              onChange={(e) => {
                setDeptCompanyFilter(e.target.value);
                setDepartmentPage(1);
              }}
              className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-600 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all cursor-pointer min-w-[150px]"
            >
              <option value="">All Companies</option>
              {allCompanies.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#fcfdfe] border-b border-slate-100">
              <tr>
                <th className="px-4 py-2.5 text-center text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  #
                </th>
                <th className="px-5 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  Department
                </th>
                <th className="px-5 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  Company
                </th>
                <th className="px-5 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  Head
                </th>
                <th className="px-5 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  Status
                </th>
                <th className="px-5 py-2.5 text-right text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {departments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Settings className="w-12 h-12 text-slate-200 mb-3" />
                      <p className="text-slate-500 font-medium">
                        No departments matching your criteria
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                departments.map((department, index) => (
                  <tr
                    key={department._id}
                    className="hover:bg-slate-50 transition-colors group"
                  >
                    <td className="px-4 py-4 text-center">
                      <span className="text-xs font-bold text-slate-400">
                        {(departmentPage - 1) * departmentPagination.limit +
                          index +
                          1}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div
                        className="cursor-pointer"
                        onClick={() => {
                          const companyId =
                            typeof department.companyId === "object"
                              ? department.companyId?._id
                              : department.companyId;
                          router.push(
                            `/superadmin/department/${department._id}?companyId=${companyId}`,
                          );
                        }}
                      >
                        <div className="text-sm font-bold text-blue-600 hover:text-blue-800 hover:underline">
                          {department.name}
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-tighter">
                          ID: {department.departmentId}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-xs font-bold text-slate-700">
                        {getCompanyDisplay(department.companyId)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs font-bold text-slate-700 uppercase">
                        {department.contactPerson || "Not Assigned"}
                      </div>
                      <div className="text-[10px] font-medium text-slate-400 mt-0.5">
                        {(() => {
                          const phone = department.contactPhone;
                          if (!phone) return "-";
                          const digitsOnly = phone.replace(/\D/g, "");
                          return digitsOnly.length >= 10
                            ? digitsOnly.slice(-10)
                            : digitsOnly;
                        })()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => toggleDepartmentStatus(department)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-widest transition-all hover:scale-105 active:scale-95 ${
                          department.isActive
                            ? "bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100"
                            : "bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100"
                        }`}
                      >
                        {department.isActive ? "Active" : "Suspended"}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          onClick={() => handleEditDepartment(department)}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          onClick={() => handleDeleteDepartment(department)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/20">
          <Pagination
            currentPage={departmentPage}
            totalPages={departmentPagination.pages}
            totalItems={departmentPagination.total}
            itemsPerPage={departmentPagination.limit}
            onPageChange={setDepartmentPage}
            className="shadow-none"
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default DepartmentTabContent;
