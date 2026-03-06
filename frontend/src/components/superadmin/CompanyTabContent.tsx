import React from "react";
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
} from "lucide-react";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { Pagination } from "@/components/ui/Pagination";
import { Company } from "@/lib/api/company";

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
  navigatingCompanyId: string | null;
  setShowCreateDialog: (val: boolean) => void;
  handleOpenCompanyDashboard: (id: string) => void;
  handleEditCompany: (company: Company) => void;
  handleDeleteCompany: (company: Company) => void;
  toggleCompanyStatus: (company: Company) => void;
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
  navigatingCompanyId,
  setShowCreateDialog,
  handleOpenCompanyDashboard,
  handleEditCompany,
  handleDeleteCompany,
  toggleCompanyStatus,
}) => {
  return (
    <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
      <CardHeader className="bg-slate-900 border-0 px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center backdrop-blur-md border border-white/20">
              <Building className="w-4.5 h-4.5 text-white" />
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
          <Button
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg h-8 shadow-md shadow-indigo-900/20 font-bold text-[10px] uppercase tracking-wider px-4 border-0 transition-all"
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus className="w-3 h-3 mr-1.5" />
            Add Organization
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/30 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Find by name or ID..."
              value={companySearchTerm}
              onChange={(e) => {
                setCompanySearchTerm(e.target.value);
                setCompanyPage(1);
              }}
              className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              Status
            </span>
            <select
              value={companyStatusFilter}
              onChange={(e) => {
                setCompanyStatusFilter(e.target.value);
                setCompanyPage(1);
              }}
              className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-600 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all cursor-pointer"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              Type
            </span>
            <select
              value={companyTypeFilter}
              onChange={(e) => {
                setCompanyTypeFilter(e.target.value);
                setCompanyPage(1);
              }}
              className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-600 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all cursor-pointer"
            >
              <option value="">All Types</option>
              <option value="SOCIETY">Society</option>
              <option value="GOVERNMENT">Government</option>
              <option value="CORPORATE">Corporate</option>
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
                  Organization
                </th>
                <th className="px-5 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  ID
                </th>
                <th className="px-5 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  Head
                </th>
                <th className="px-5 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  Contact
                </th>
                <th className="px-5 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  Type
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
              {companiesLoading ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center">
                    <LoadingSpinner text="Refreshing database..." />
                  </td>
                </tr>
              ) : companies.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Building className="w-12 h-12 text-slate-200 mb-3" />
                      <p className="text-slate-500 font-medium">
                        No organizations matching your criteria
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                companies.map((company, index) => (
                  <tr
                    key={company._id}
                    className="hover:bg-slate-50 transition-colors group"
                  >
                    <td className="px-4 py-4 text-center">
                      <span className="text-xs font-bold text-slate-400">
                        {(companyPage - 1) * companyPagination.limit +
                          index +
                          1}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div
                        className={`cursor-pointer ${navigatingCompanyId ? "pointer-events-none" : ""}`}
                        onClick={() => handleOpenCompanyDashboard(company._id)}
                      >
                        <div className="text-sm font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-2">
                          {company.name}
                          {navigatingCompanyId === company._id && (
                            <LoadingSpinner className="scale-50 origin-left" />
                          )}
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-tighter">
                          Drill down to departments
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded font-mono text-[10px] font-bold uppercase">
                        {company.companyId}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-800">
                          {company.companyHead?.name || "N/A"}
                        </span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase italic">
                          {company.companyHead?.email || "No Head Assigned"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-slate-600 font-medium">
                          {company.contactEmail || "N/A"}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold">
                          {company.contactPhone || "N/A"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-md text-[9px] font-black uppercase tracking-wider border border-indigo-100">
                        {company.companyType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
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
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Improved Pagination */}
        {companyPagination.pages > 1 && (
          <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Record {(companyPage - 1) * companyPagination.limit + 1} -{" "}
              {Math.min(
                companyPage * companyPagination.limit,
                companyPagination.total,
              )}{" "}
              of {companyPagination.total}
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
    </Card>
  );
};

export default CompanyTabContent;
