import React, { useState, useCallback, useMemo } from "react";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Settings,
  Plus,
  Search,
  Edit2,
  Trash2,
  RefreshCw,
  Filter,
  Layers,
  ClipboardCheck,
  Building,
  ArrowRight,
  ArrowUpDown,
  Mail,
  User,
  Users,
  Building2,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";
import { Pagination } from "@/components/ui/Pagination";
import { Department, departmentAPI } from "@/lib/api/department";
import { Company } from "@/lib/api/company";
import toast from "react-hot-toast";
import { formatTo10Digits } from "@/lib/utils/phoneUtils";

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
  setDepartmentLimit: (val: number) => void;
  setEditingDepartment: (dept: Department | null) => void;
  setShowDepartmentDialog: (val: boolean) => void;
  handleEditDepartment: (dept: Department) => void;
  handleDeleteDepartment: (dept: Department) => void;
  toggleDepartmentStatus: (dept: Department) => void;
  getCompanyDisplay: (companyId: any) => string;
  router: any;
  onRefresh?: () => void;
  userLevel?: number;
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
  setDepartmentLimit,
  setEditingDepartment,
  setShowDepartmentDialog,
  handleEditDepartment,
  handleDeleteDepartment,
  toggleDepartmentStatus,
  getCompanyDisplay,
  router,
  onRefresh,
  userLevel = 1,
}) => {
  // Local filters for the types and status (mocked or should be passed)
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  
  const mainDeptsCount = useMemo(() => departments.filter(d => !d.parentDepartmentId || (typeof d.parentDepartmentId === 'object' && !d.parentDepartmentId)).length, [departments]);
  const subDeptsCount = departments.length - mainDeptsCount;

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      {/* Search and Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
        <Button variant="outline" size="sm" className="h-9 px-3 gap-2 text-slate-500 border-slate-200 lg:w-auto">
          <Filter className="w-3.5 h-3.5" />
          <span className="text-xs font-bold">Filters</span>
        </Button>
        
        <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2 h-9 w-full lg:w-auto">
          <Layers className="w-3.5 h-3.5 text-slate-400 mr-2" />
          <select 
            value={typeFilter} 
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs font-bold text-slate-600 outline-none pr-1 bg-transparent cursor-pointer flex-1"
          >
            <option value="all">All Types</option>
            <option value="main">Main Depts</option>
            <option value="sub">Sub Depts</option>
          </select>
        </div>

        <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2 h-9 w-full lg:w-auto">
          <ClipboardCheck className="w-3.5 h-3.5 text-slate-400 mr-2" />
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-bold text-slate-600 outline-none pr-1 bg-transparent cursor-pointer flex-1"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2 h-9 min-w-0 sm:min-w-[200px] flex-1 w-full lg:w-auto">
          <Building className="w-3.5 h-3.5 text-slate-400 mr-2" />
          <SearchableSelect
            options={[
              { value: "", label: "🏢 All Companies" },
              ...allCompanies.map((c) => ({ value: c._id, label: c.name })),
            ]}
            value={deptCompanyFilter}
            onValueChange={setDeptCompanyFilter}
            placeholder="Search Company..."
            className="flex-1 border-0 h-full p-0 bg-transparent text-[14px] font-bold"
          />
        </div>

        <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2 h-9 flex-1 min-w-0 sm:min-w-[200px] w-full lg:w-auto">
          <Search className="w-3.5 h-3.5 text-slate-400 mr-2" />
          <input 
            placeholder="Search Dept..."
            value={deptSearchTerm}
            onChange={(e) => setDeptSearchTerm(e.target.value)}
            className="text-[14px] font-bold text-slate-600 outline-none bg-transparent w-full"
          />
        </div>

        <div className="flex items-center gap-4 ml-auto w-full sm:w-auto justify-between sm:justify-end border-t sm:border-0 pt-3 sm:pt-0">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-black text-slate-400 uppercase">Rows:</span>
            <select 
              value={departmentPagination.limit}
              onChange={(e) => setDepartmentLimit(Number(e.target.value))}
              className="text-xs font-black text-slate-600 outline-none cursor-pointer"
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 -ml-1" />
          </div>
          <span className="text-[14px] font-bold text-slate-400 whitespace-nowrap">
            <span className="text-slate-800">{departments.length}</span> / <span className="text-slate-800">{departmentPagination.total}</span>
          </span>
        </div>
      </div>

      {/* Summary Pills Row */}
      <div className="flex items-center gap-2 px-1">
        <div className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-md text-[14px] font-black uppercase tracking-wider border border-indigo-100/50 shadow-sm">
          {mainDeptsCount || 0} Main
        </div>
        <div className="px-3 py-1 bg-blue-50 text-blue-600 rounded-md text-[14px] font-black uppercase tracking-wider border border-blue-100/50 shadow-sm">
          {subDeptsCount || 0} Sub
        </div>
      </div>

      {/* Table Section */}
      <Card className="rounded-xl border border-slate-100 shadow-sm overflow-hidden bg-white">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#fcfdfe] border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 text-left text-[14px] font-black text-slate-400 uppercase tracking-widest w-12">Sr.</th>
                  <th className="px-6 py-3 text-left text-[14px] font-black text-slate-400 uppercase tracking-widest min-w-[250px]">
                    <div className="flex items-center gap-1.5 cursor-pointer hover:text-slate-600 transition-colors">
                      Department Name
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-[14px] font-black text-slate-400 uppercase tracking-widest">Dept ID</th>
                  <th className="px-6 py-3 text-left text-[14px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                  <th className="px-6 py-3 text-left text-[14px] font-black text-slate-400 uppercase tracking-widest">Users</th>
                  <th className="px-6 py-3 text-left text-[14px] font-black text-slate-400 uppercase tracking-widest">Head / Contact</th>
                  <th className="px-6 py-3 text-left text-[14px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-right text-[14px] font-black text-slate-400 uppercase tracking-widest pr-8">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {departments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-20 text-center">
                      <div className="flex flex-col items-center justify-center opacity-40">
                        <Building2 className="w-12 h-12 text-slate-300 mb-3" />
                        <p className="text-sm font-bold text-slate-400">No Departments Found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  departments.map((dept, idx) => {
                    const isMain = !dept.parentDepartmentId || (typeof dept.parentDepartmentId === 'object' && !dept.parentDepartmentId);
                    return (
                      <tr key={dept._id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-4 py-4">
                          <div className="w-8 h-8 rounded-lg bg-[#f8fafc] flex items-center justify-center text-[14px] font-black text-slate-400 border border-slate-200/40 shadow-sm">
                            {(departmentPage - 1) * departmentPagination.limit + idx + 1}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center shadow-sm group-hover:border-indigo-100 transition-all">
                              <Building2 className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[15px] font-black text-slate-800 tracking-tight flex items-center gap-1.5 group-hover:text-indigo-600 transition-colors">
                                {dept.name}
                              </span>
                              <span className="text-[14px] font-bold text-slate-400 tracking-tighter flex items-center gap-1 mt-0.5 opacity-80">
                                <span className="text-slate-300">↳</span>
                                {typeof dept.parentDepartmentId === 'object' 
                                  ? (dept.parentDepartmentId as any)?.name 
                                  : (isMain ? (typeof dept.companyId === 'object' ? (dept.companyId as any)?.name : "Excise") : "Sub-Unit")}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="inline-flex items-center px-2.5 py-1 bg-slate-50 text-[14px] font-bold text-slate-600 rounded-md border border-slate-200/60 uppercase tracking-tighter shadow-sm w-fit">
                            {dept.departmentId || "DEPT000000"}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className={`px-2 py-0.5 rounded-full text-[15px] font-black uppercase tracking-widest border shadow-sm ${
                            isMain ? "bg-indigo-50/50 text-indigo-500 border-indigo-100/50" : "bg-blue-50/50 text-blue-500 border-blue-100/50"
                          }`}>
                            {isMain ? "Main" : "Sub"}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 bg-emerald-50/50 px-2.5 py-1 rounded-lg border border-emerald-100/40 shadow-sm w-fit">
                            <Users className="w-3 h-3 text-emerald-400" />
                            <span className="text-[15px] font-black text-emerald-600">1</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-[15px] font-black text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                              <User className="w-3 h-3 text-slate-300" />
                              {dept.contactPerson || "SRI BABULU DASH"}
                            </span>
                            <span className="text-[14px] font-bold text-slate-400 mt-1 flex items-center gap-1.5 lowercase opacity-80 group-hover:text-blue-500 transition-colors">
                              <Mail className="w-3 h-3" />
                              {dept.contactPhone || "babuludash8@gmail.com"}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Switch 
                              checked={dept.isActive} 
                              onCheckedChange={() => toggleDepartmentStatus(dept)}
                              className="data-[state=checked]:bg-emerald-500 scale-75" 
                            />
                            <span className={`text-[14px] font-black uppercase tracking-widest ${dept.isActive ? "text-emerald-500" : "text-slate-400"}`}>
                              {dept.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right pr-4">
                          <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleEditDepartment(dept)}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-all"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => {}}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-blue-500 hover:bg-slate-100 rounded-lg transition-all"
                            >
                              <Users className="w-3.5 h-3.5" />
                            </Button>
                            {userLevel === 1 && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleDeleteDepartment(dept)}
                                className="h-8 w-8 p-0 text-slate-400 hover:text-rose-500 hover:bg-slate-100 rounded-lg transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 bg-slate-50/10 border-t border-slate-50 flex items-center justify-center">
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
      
      {/* Footer Helper */}
      <div className="flex items-center justify-end gap-2 px-1">
        <p className="text-[14px] font-bold text-slate-400 uppercase tracking-widest">
          Use the filters above to narrow down your results
        </p>
      </div>
    </div>
  );
};

export default DepartmentTabContent;
