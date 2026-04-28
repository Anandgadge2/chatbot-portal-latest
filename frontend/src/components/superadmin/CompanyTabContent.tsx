import React, { useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Building,
  Plus,
  Search,
  Trash2,
  Edit2,
  Shield,
  RefreshCw,
  CheckSquare,
  Square,
  AlertTriangle,
  Settings,
  ShieldAlert,
} from "lucide-react";
import RoleManagement from "@/components/roles/RoleManagement";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { Pagination } from "@/components/ui/Pagination";
import { Company } from "@/lib/api/company";
import { companyAPI } from "@/lib/api/company";
import toast from "react-hot-toast";
import { formatTo10Digits } from "@/lib/utils/phoneUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import WhatsAppConfigTab from "@/components/superadmin/drilldown/tabs/WhatsAppConfigTab";
import { CompanyProvider } from "@/contexts/CompanyContext";

interface CompanyTabContentProps {
  companies: Company[];
  companiesLoading: boolean;
  companySearchTerm: string;
  setCompanySearchTerm: (val: string) => void;
  companyStatusFilter: string;
  setCompanyStatusFilter: (val: string) => void;
  companyTypeFilter: string;
  setCompanyTypeFilter: (val: string) => void;
  companyPage: number;
  setCompanyPage: (val: number) => void;
  companyPagination: { total: number; pages: number; limit: number };
  setCompanyLimit: (val: number) => void;
  navigatingCompanyId: string | null;
  setShowCreateDialog: (val: boolean) => void;
  handleOpenCompanyDashboard: (id: string) => void;
  handleEditCompany: (company: Company) => void;
  handleDeleteCompany: (company: Company) => void;
  toggleCompanyStatus: (company: Company) => void;
  onRefresh?: () => void;
}

const CompanyTabContent: React.FC<CompanyTabContentProps> = ({
  companies,
  companiesLoading,
  companySearchTerm,
  setCompanySearchTerm,
  companyStatusFilter,
  setCompanyStatusFilter,
  companyTypeFilter,
  setCompanyTypeFilter,
  companyPage,
  setCompanyPage,
  companyPagination,
  setCompanyLimit,
  navigatingCompanyId,
  setShowCreateDialog,
  handleOpenCompanyDashboard,
  handleEditCompany,
  handleDeleteCompany,
  toggleCompanyStatus,
  onRefresh,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [showWAConfigDialog, setShowWAConfigDialog] = useState(false);
  const [waConfigCompanyId, setWaConfigCompanyId] = useState<string | null>(null);
  const [showRolesDialog, setShowRolesDialog] = useState(false);
  const [rolesCompanyId, setRolesCompanyId] = useState<string | null>(null);

  const allSelected = companies.length > 0 && selectedIds.size === companies.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(companies.map((c) => c._id)));
    }
  }, [allSelected, companies]);

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    setShowBulkConfirm(false);
    let successCount = 0;
    let failCount = 0;
    for (const id of Array.from(selectedIds)) {
      try {
        const res = await companyAPI.delete(id);
        if (res.success) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }
    setBulkDeleting(false);
    setSelectedIds(new Set());
    if (successCount > 0) toast.success(`${successCount} company(ies) deleted successfully`);
    if (failCount > 0) toast.error(`${failCount} company(ies) could not be deleted`);
    onRefresh?.();
  };

  return (
    <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
      <CardHeader className="bg-slate-900 border-0 px-4 sm:px-5 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/10 rounded-lg flex shrink-0 items-center justify-center backdrop-blur-md border border-white/20">
              <Building className="w-4 h-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-white">
                Organization Registry
              </CardTitle>
              <CardDescription className="text-slate-400 text-[10px] font-medium leading-none mt-1">
                Manage global corporate entities
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg shrink-0"
                title="Refresh"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            )}
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg h-8 shadow-md shadow-indigo-900/20 font-bold text-[10px] uppercase tracking-wider px-3 sm:px-4 border-0 transition-all shrink-0"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="w-3 h-3 mr-1 sm:mr-1.5" />
              Add Org<span className="hidden sm:inline">anization</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Filters */}
        <div className="px-4 sm:px-5 py-3 border-b border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest shrink-0">Rows</span>
            <select
              value={companyPagination.limit}
              onChange={(e) => { setCompanyLimit(Number(e.target.value)); setCompanyPage(1); }}
              className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-600 outline-none transition-all cursor-pointer"
            >
              {[10, 20, 25, 50, 100].map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
          <div className="h-6 w-px bg-slate-200 hidden sm:block mx-1"></div>
          <div className="relative flex-1 w-full sm:w-auto min-w-0 sm:min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Find by name or ID..."
              value={companySearchTerm}
              onChange={(e) => {
                setCompanySearchTerm(e.target.value);
                setCompanyPage(1);
              }}
              className="w-full pl-9 pr-4 py-1.5 h-8 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
            />
          </div>
          <div className="flex flex-row items-center gap-3">
            <div className="flex items-center gap-2 flex-1 sm:flex-none">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest shrink-0">Status</span>
              <select
                value={companyStatusFilter}
                onChange={(e) => { setCompanyStatusFilter(e.target.value); setCompanyPage(1); }}
                className="w-full sm:w-auto h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-600 outline-none transition-all cursor-pointer"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="flex items-center gap-2 flex-1 sm:flex-none">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest shrink-0">Type</span>
              <select
                value={companyTypeFilter}
                onChange={(e) => { setCompanyTypeFilter(e.target.value); setCompanyPage(1); }}
                className="w-full sm:w-auto h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-600 outline-none transition-all cursor-pointer"
              >
                <option value="">All Types</option>
                <option value="SOCIETY">Society</option>
                <option value="GOVERNMENT">Government</option>
                <option value="CORPORATE">Corporate</option>
              </select>
            </div>
          </div>
        </div>

        {/* Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <div className="px-5 py-2.5 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-black text-indigo-700">
                {selectedIds.size} selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
                className="h-7 text-[10px] font-bold uppercase tracking-wider border-indigo-200 text-indigo-600 hover:bg-indigo-100"
              >
                Deselect All
              </Button>
              {showBulkConfirm ? (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                  <span className="text-[10px] text-red-700 font-bold">Delete {selectedIds.size} companies?</span>
                  <Button
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={bulkDeleting}
                    className="h-6 px-2.5 text-[10px] bg-red-600 hover:bg-red-700 text-white rounded-md font-bold"
                  >
                    {bulkDeleting ? "Deleting..." : "Confirm"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowBulkConfirm(false)}
                    className="h-6 px-2 text-[10px] text-slate-500"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setShowBulkConfirm(true)}
                  className="h-7 px-3 text-[10px] font-bold uppercase tracking-wider bg-red-600 hover:bg-red-700 text-white rounded-lg gap-1.5"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete Selected
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#fcfdfe] border-b border-slate-100">
              <tr>
                {/* Checkbox column */}
                <th className="pl-3 sm:pl-4 pr-2 py-2.5 w-8 sm:w-10">
                  <button
                    onClick={toggleAll}
                    className="text-slate-400 hover:text-indigo-600 transition-colors"
                    title={allSelected ? "Deselect all" : "Select all"}
                  >
                    {allSelected ? (
                      <CheckSquare className="w-4 h-4 text-indigo-600" />
                    ) : someSelected ? (
                      <div className="w-4 h-4 border-2 border-slate-300 rounded flex items-center justify-center bg-white">
                        <div className="w-2 h-0.5 bg-slate-400 rounded-full" />
                      </div>
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="hidden md:table-cell px-3 py-2.5 text-center text-[9px] font-bold text-slate-400 uppercase tracking-widest">#</th>
                <th className="px-2 sm:px-5 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">Organization</th>
                <th className="px-2 sm:px-5 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">ID</th>
                <th className="hidden lg:table-cell px-5 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">Contact</th>
                <th className="hidden lg:table-cell px-5 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">Depts</th>
                <th className="hidden md:table-cell px-5 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">Users</th>
                <th className="hidden md:table-cell px-5 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">Type</th>
                <th className="hidden sm:table-cell px-5 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-2 sm:px-5 py-2.5 text-right text-[9px] font-bold text-slate-400 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {companiesLoading ? (
                <tr>
                  <td colSpan={10} className="py-20 text-center">
                    <LoadingSpinner text="Refreshing database..." />
                  </td>
                </tr>
              ) : companies.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Building className="w-12 h-12 text-slate-200 mb-3" />
                      <p className="text-slate-500 font-medium">No organizations matching your criteria</p>
                    </div>
                  </td>
                </tr>
              ) : (
                companies.map((company, index) => {
                  const isSelected = selectedIds.has(company._id);
                  return (
                    <tr
                      key={company._id}
                      className={`hover:bg-slate-50 transition-colors group ${isSelected ? "bg-indigo-50/50" : ""}`}
                    >
                      <td className="pl-3 sm:pl-4 pr-2 py-4">
                        <button
                          onClick={() => toggleOne(company._id)}
                          className="text-slate-400 hover:text-indigo-600 transition-colors"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="hidden md:table-cell px-3 py-4 text-center">
                        <span className="text-xs font-bold text-slate-400">
                          {(companyPage - 1) * companyPagination.limit + index + 1}
                        </span>
                      </td>
                      <td className="px-2 sm:px-5 py-4 whitespace-nowrap">
                        <div
                          className={`cursor-pointer ${navigatingCompanyId ? "pointer-events-none" : ""}`}
                          onClick={() => handleOpenCompanyDashboard(company._id)}
                        >
                          <div className="text-sm font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-2">
                            <span className="truncate max-w-[120px] sm:max-w-none">{company.name}</span>
                            {navigatingCompanyId === company._id && (
                              <LoadingSpinner className="scale-50 origin-left shrink-0" />
                            )}
                          </div>
                          <div className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-tighter truncate max-w-[120px] sm:max-w-none">
                            Open Dashboard
                          </div>
                        </div>
                      </td>
                      <td className="px-2 sm:px-5 py-4 whitespace-nowrap">
                        <span className="px-1.5 sm:px-2 py-0.5 bg-slate-100 text-slate-500 rounded font-mono text-[9px] sm:text-[10px] font-bold uppercase truncate max-w-[80px] sm:max-w-none inline-block">
                          {company.companyId}
                        </span>
                      </td>
                      <td className="hidden lg:table-cell px-5 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs text-slate-600 font-medium">{company.companyHead?.name || "N/A"}</span>
                          <span className="text-xs text-slate-600 font-medium">{company.companyHead?.email || "N/A"}</span>
                          <span className="text-[10px] text-slate-400 font-bold">{formatTo10Digits(company.companyHead?.phone || "")}</span>
                        </div>
                      </td>
                      <td className="hidden lg:table-cell px-5 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          {company.mainDepartmentCount !== undefined && company.subDepartmentCount !== undefined ? (
                            <>
                              <span className="text-xs text-slate-600 font-medium">Main: {company.mainDepartmentCount}</span>
                              <span className="text-xs text-slate-600 font-medium">Sub: {company.subDepartmentCount}</span>
                            </>
                          ) : (
                            <span className="text-xs text-slate-600 font-medium">{company.departmentCount}</span>
                          )}
                        </div>
                      </td>
                      <td className="hidden md:table-cell px-5 py-4 whitespace-nowrap">
                        <span className="text-xs text-slate-600 font-medium">{company.userCount}</span>
                      </td>
                      <td className="hidden md:table-cell px-5 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-md text-[9px] font-black uppercase tracking-wider border border-indigo-100">
                          {company.companyType}
                        </span>
                      </td>
                      <td className="hidden sm:table-cell px-5 py-4 whitespace-nowrap">
                        <button
                          onClick={() => toggleCompanyStatus(company)}
                          className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${
                            company.isActive
                              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-200"
                              : "bg-red-50 text-red-600 hover:bg-red-100 border border-red-100"
                          }`}
                        >
                          {company.isActive ? "ACTIVE" : "SUSPENDED"}
                        </button>
                      </td>
                       <td className="px-2 sm:px-5 py-4 whitespace-normal sm:whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1 sm:gap-1.5 transition-opacity flex-wrap sm:flex-nowrap max-w-[80px] sm:max-w-none ml-auto">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setWaConfigCompanyId(company._id);
                              setShowWAConfigDialog(true);
                            }}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                            title="WhatsApp Configuration"
                          >
                            <Settings className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditCompany(company)}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteCompany(company)}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setRolesCompanyId(company._id);
                              setShowRolesDialog(true);
                            }}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg border border-transparent hover:border-emerald-100"
                            title="Authority & Role Management"
                          >
                            <Shield className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {companyPagination.pages > 1 && (
          <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Record {(companyPage - 1) * companyPagination.limit + 1}–
              {Math.min(companyPage * companyPagination.limit, companyPagination.total)} of {companyPagination.total}
            </div>
            <Pagination
              currentPage={companyPage}
              totalPages={companyPagination.pages}
              totalItems={companyPagination.total}
              itemsPerPage={companyPagination.limit}
              onPageChange={setCompanyPage}
            />
          </div>
        )}
      </CardContent>

      <Dialog open={showWAConfigDialog} onOpenChange={setShowWAConfigDialog}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0 border-0 bg-slate-50">
          <DialogHeader className="p-6 bg-slate-900 border-b border-slate-800 sticky top-0 z-10 rounded-t-lg">
            <DialogTitle className="text-lg font-black text-white uppercase tracking-widest flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20 shadow-inner">
                <Settings className="w-5 h-5 text-indigo-400" />
              </div>
              WhatsApp Configuration Setting
            </DialogTitle>
          </DialogHeader>
          <div className="p-6">
            {waConfigCompanyId && (
              <CompanyProvider companyId={waConfigCompanyId}>
                <WhatsAppConfigTab companyId={waConfigCompanyId} />
              </CompanyProvider>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showRolesDialog} onOpenChange={setShowRolesDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 border-0 bg-slate-50">
          <DialogHeader className="p-6 bg-slate-900 border-b border-slate-800 sticky top-0 z-50 rounded-t-lg">
            <DialogTitle className="text-lg font-black text-white uppercase tracking-widest flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
                <Shield className="w-5 h-5 text-emerald-400" />
              </div>
               Custom Authority Management
            </DialogTitle>
          </DialogHeader>
          <div className="p-6">
            {rolesCompanyId && (
              <RoleManagement companyId={rolesCompanyId} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default CompanyTabContent;
