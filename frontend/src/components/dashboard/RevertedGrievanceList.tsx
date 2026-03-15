"use client";

import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  RefreshCw, 
  Search, 
  Filter, 
  X, 
  ExternalLink, 
  Phone, 
  Undo2, 
  ArrowRightCircle, 
  Building2, 
  Inbox, 
  UserPlus, 
  Eye 
} from "lucide-react";
import { Grievance } from "@/lib/api/grievance";
import { Department } from "@/lib/api/department";

interface RevertedGrievanceListProps {
  grievances: Grievance[];
  grievanceSearch: string;
  setGrievanceSearch: (val: string) => void;
  grievanceFilters: { mainDeptId: string; subDeptId: string; dateRange: string };
  setGrievanceFilters: (val: any) => void;
  departments: Department[];
  handleRefreshData: () => void;
  isRefreshing: boolean;
  getSortedData: (data: any[], type: string) => any[];
  openGrievanceDetail: (id: string) => void;
  formatTo10Digits: (phone?: string) => string;
  setSelectedGrievanceForAssignment: (g: any) => void;
  setShowGrievanceAssignment: (show: boolean) => void;
}

export default function RevertedGrievanceList({
  grievances,
  grievanceSearch,
  setGrievanceSearch,
  grievanceFilters,
  setGrievanceFilters,
  departments,
  handleRefreshData,
  isRefreshing,
  getSortedData,
  openGrievanceDetail,
  formatTo10Digits,
  setSelectedGrievanceForAssignment,
  setShowGrievanceAssignment,
}: RevertedGrievanceListProps) {
  const revertedGrievances = getSortedData(grievances, "reverted");

  return (
    <Card className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white mb-8">
      <CardHeader className="bg-slate-900 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-rose-500/20 rounded-xl flex items-center justify-center border border-rose-500/30">
              <Undo2 className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-white uppercase tracking-tight">
                Reverted Grievances
              </CardTitle>
              <CardDescription className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                Cases sent back from departments for manual reassignment
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-200">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search reverted grievances..."
              value={grievanceSearch}
              onChange={(e) => setGrievanceSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-white shadow-sm text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshData}
              className="border-slate-200 hover:bg-slate-50 rounded-xl"
            >
              <RefreshCw className={`w-4 h-4 mr-1.5 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
            <Filter className="w-3.5 h-3.5 text-rose-500" />
            <span className="text-xs font-bold text-slate-600">Filters</span>
          </div>

          <select
            value={grievanceFilters.mainDeptId}
            onChange={(e) => setGrievanceFilters((prev: any) => ({ ...prev, mainDeptId: e.target.value, subDeptId: "" }))}
            className="text-xs px-4 py-2 border border-slate-200 rounded-xl bg-white shadow-sm hover:border-rose-300 transition-colors cursor-pointer min-w-[170px]"
          >
            <option value="">🏢 Origin Department</option>
            {departments.filter(d => !d.parentDepartmentId).map(d => (
              <option key={d._id} value={d._id}>{d.name}</option>
            ))}
          </select>

          <select
            value={grievanceFilters.dateRange}
            onChange={(e) => setGrievanceFilters((prev: any) => ({ ...prev, dateRange: e.target.value }))}
            className="text-xs px-4 py-2 border border-slate-200 rounded-xl bg-white shadow-sm hover:border-rose-300 transition-colors cursor-pointer"
          >
            <option value="">📅 All Dates</option>
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
          </select>

          {(grievanceSearch || grievanceFilters.mainDeptId || grievanceFilters.dateRange) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setGrievanceSearch("");
                setGrievanceFilters((prev: any) => ({ ...prev, mainDeptId: "", subDeptId: "", dateRange: "" }));
              }}
              className="text-xs h-8 px-3 text-red-600 hover:bg-red-50 rounded-xl border border-red-100"
            >
              <X className="w-3 h-3 mr-1" /> Clear
            </Button>
          )}

          <div className="ml-auto text-xs font-black text-slate-400 uppercase tracking-widest bg-slate-100/50 px-3 py-1.5 rounded-lg">
            Showing: <span className="text-slate-900">{revertedGrievances.length} reverted cases</span>
          </div>
        </div>
      </div>

      <div className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/30">
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-12">#</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Grievance Id</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Citizen Details</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Description & Remarks</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Dept & Category</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Reassign</th>
              </tr>
            </thead>
            <tbody>
              {revertedGrievances.length > 0 ? (
                revertedGrievances.map((grievance, index) => {
                  const latestRevertRemark = grievance.statusHistory
                      ?.filter((h: any) => h.status === 'REVERTED')
                      .sort((a: any, b: any) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())[0]?.remarks;

                  return (
                    <tr key={grievance._id} className="border-b border-slate-50 hover:bg-slate-50/80 transition-all group">
                      <td className="px-4 py-5 text-center">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-700 text-[10px] font-black group-hover:bg-rose-100 group-hover:text-rose-700 transition-colors shadow-sm">
                          {index + 1}
                        </span>
                      </td>
                      <td className="px-4 py-5 font-bold text-sm">
                        <button
                          onClick={() => openGrievanceDetail(grievance._id)}
                          className="text-blue-700 hover:text-blue-900 flex items-center gap-1.5 group/id"
                        >
                          {grievance.grievanceId}
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover/id:opacity-100 transition-opacity" />
                        </button>
                        <div className="text-[10px] text-slate-400 font-medium mt-1">
                          {new Date(grievance.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-4 py-5">
                        <div className="flex flex-col">
                          <button
                            onClick={() => openGrievanceDetail(grievance._id)}
                            className="text-slate-900 font-bold text-sm text-left hover:text-indigo-600 transition-colors"
                          >
                            {grievance.citizenName}
                          </button>
                          <div className="flex items-center text-[11px] text-slate-500 font-medium mt-0.5">
                            <Phone className="w-3 h-3 mr-1.5 text-slate-400" />
                            {formatTo10Digits(grievance.citizenPhone)}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-5 max-w-[250px]">
                        <div className="flex flex-col gap-1.5">
                          <div className="text-xs text-slate-600 line-clamp-1 italic" title={grievance.description}>
                            &quot;{grievance.description}&quot;
                          </div>
                          {latestRevertRemark && (
                            <div className="bg-rose-50 border border-rose-100 rounded-lg p-2">
                              <p className="text-[10px] font-black text-rose-500 uppercase tracking-tighter mb-0.5 flex items-center gap-1">
                                <Undo2 className="w-2.5 h-2.5" /> Revert Remark
                              </p>
                              <p className="text-[11px] text-rose-700 font-bold leading-tight">
                                {latestRevertRemark}
                              </p>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-5">
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mb-0.5">Original Dept</span>
                            <span className="text-xs font-semibold text-slate-700">
                              {grievance.departmentId && typeof grievance.departmentId === "object" ? (grievance.departmentId as any).name : "General"}
                            </span>
                          </div>
                          
                          {(() => {
                            const revertEntry = grievance.timeline
                              ?.filter((t: any) => t.action === "REVERTED_TO_COMPANY_ADMIN")
                              .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
                            
                            const suggestedDeptId = revertEntry?.details?.suggestedDepartmentId;
                            const suggestedSubDeptId = revertEntry?.details?.suggestedSubDepartmentId;
                            
                            if (suggestedDeptId || suggestedSubDeptId) {
                              const suggestedDept = departments.find(d => d._id === (suggestedSubDeptId || suggestedDeptId));
                              return (
                                <div className="mt-2 group/suggested">
                                  <div className="flex items-center gap-1 text-[9px] text-rose-500 font-black uppercase tracking-widest mb-1 opacity-70">
                                    <ArrowRightCircle className="w-2.5 h-2.5" /> Proposed Destination
                                  </div>
                                  <div className="flex items-center gap-2 bg-rose-50/50 border border-rose-100 rounded-lg p-2 transition-all group-hover/suggested:bg-rose-50">
                                    <div className="w-6 h-6 bg-rose-100 rounded-md flex items-center justify-center text-rose-600">
                                      <Building2 className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-xs font-bold text-slate-900 leading-none">
                                        {suggestedDept?.name || "Target Department"}
                                      </span>
                                      <span className="text-[9px] font-bold text-rose-500 uppercase mt-0.5 tracking-tighter">
                                        Recommended by Admin
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          })()}
                          
                          <span className="text-[10px] text-orange-500 font-bold uppercase tracking-tight mt-1">
                            {grievance.category}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-rose-50 text-rose-600 border border-rose-100 uppercase tracking-wider">
                          REVERTED
                        </span>
                      </td>
                      <td className="px-4 py-5">
                        <div className="flex justify-center gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedGrievanceForAssignment(grievance);
                              setShowGrievanceAssignment(true);
                            }}
                            className="h-8 w-8 p-0 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg shadow-none border-0 transition-all"
                            title="Assign to New Official"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openGrievanceDetail(grievance._id)}
                            className="h-8 w-8 p-0 text-slate-400 hover:bg-slate-50 hover:text-slate-900 rounded-lg shadow-none border-0 transition-all"
                            title="View Case Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-24 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                        <Inbox className="w-8 h-8 text-slate-200" />
                      </div>
                      <h3 className="text-slate-900 font-bold">No Reverted Items</h3>
                      <p className="text-slate-400 text-xs mt-1 max-w-[200px] mx-auto leading-relaxed">
                        All reverted grievances have been addressed or none exist currently.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
