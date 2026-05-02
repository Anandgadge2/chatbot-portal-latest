"use client";

import { Building, Building2, Mail, Shield, Terminal } from "lucide-react";

type DepartmentAssignment = {
  id: string;
  name: string;
  code: string;
  isPrimary: boolean;
};

type DepartmentStat = {
  departmentId: string;
  total: number;
};

type OverviewDepartmentSummaryProps = {
  visible: boolean;
  user: {
    firstName?: string;
    lastName?: string;
    email?: string;
    role?: string;
  };
  normalizedDesignations: string[];
  assignedDepartmentSummaries: DepartmentAssignment[];
  departmentStats?: DepartmentStat[];
};

export function OverviewDepartmentSummary({
  visible,
  user,
  normalizedDesignations,
  assignedDepartmentSummaries,
  departmentStats,
}: OverviewDepartmentSummaryProps) {
  if (!visible) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-md font-black text-white shadow-md flex-shrink-0">
            {user?.firstName?.[0]}
            {user?.lastName?.[0]}
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
              Identity
            </p>
            <h2 className="text-[15px] font-black text-slate-900 uppercase truncate leading-none">
              {user?.firstName} {user?.lastName}
            </h2>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <Mail className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
              Contact
            </p>
            <h2 className="text-[14px] font-bold text-slate-600 truncate leading-none">
              {user?.email}
            </h2>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 overflow-hidden">
            <p className="text-[14px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">
              Authorization
            </p>
            <div className="flex flex-wrap gap-1">
              <span className="px-1.5 py-0.5 bg-indigo-600 text-white text-[14px] font-black rounded uppercase leading-none">
                {user.role?.replace(/_/g, " ")}
              </span>
              {normalizedDesignations.map((designation, index) => (
                <span
                  key={index}
                  className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[14px] font-black rounded uppercase border border-slate-200 leading-none"
                >
                  {designation}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 pt-3">
        <div className="flex items-center justify-between ml-1">
          <h4 className="text-[14px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-slate-400/60" />
            Active Department Assignments
          </h4>
          {assignedDepartmentSummaries.length > 1 && (
            <span className="text-[14px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 uppercase tracking-tight">
              {assignedDepartmentSummaries.length} Units
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {assignedDepartmentSummaries.length > 0 ? (
            assignedDepartmentSummaries.map((dept, idx) => {
              const statsForDept = departmentStats?.find(
                (departmentStat) => departmentStat.departmentId === dept.id,
              );

              return (
                <div
                  key={dept.id || `dept-assignment-${idx}`}
                  className="bg-white border border-slate-200 rounded-[18px] p-3 sm:p-4 flex items-center gap-3 hover:shadow-md hover:border-indigo-200 transition-all duration-300 cursor-default group shadow-sm relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-50/0 to-indigo-50/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                  <div className="h-10 w-10 shrink-0 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center shadow-inner group-hover:bg-indigo-600 group-hover:border-indigo-500 transition-all duration-300 relative z-10">
                    <Building className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
                  </div>

                  <div className="flex-1 min-w-0 relative z-10">
                    <h5 className="text-[15px] font-black text-slate-900 uppercase leading-tight truncate group-hover:text-indigo-600 transition-colors mb-1">
                      {dept.name}
                    </h5>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <div className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-50 border border-slate-100 rounded-md">
                        <Terminal className="w-2.5 h-2.5 text-slate-400" />
                        <span className="text-[14px] font-black text-slate-500 uppercase tracking-tight">
                          {dept.code || "UNIT"}
                        </span>
                      </div>

                      {dept.isPrimary && (
                        <div className="px-1.5 py-0.5 bg-indigo-50 border border-indigo-100 rounded-md">
                          <span className="text-[14px] font-black text-indigo-600 uppercase tracking-tight">
                            Primary
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right pl-3 border-l border-slate-100 shrink-0 relative z-10">
                    <div className="text-xl font-black text-slate-900 tracking-tighter leading-none group-hover:text-indigo-600 transition-colors">
                      {statsForDept?.total || 0}
                    </div>
                    <div className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                      Grievances
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full p-6 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center text-slate-400 bg-slate-50/30">
              <Building2 className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-[15px] font-black uppercase tracking-widest">
                No assigned units
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
