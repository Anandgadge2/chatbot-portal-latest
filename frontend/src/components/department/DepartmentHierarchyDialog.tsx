"use client";

import React, { useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Building, X, GitBranch, Share2, Users, ShieldCheck } from "lucide-react";
import { Department } from "@/lib/api/department";

interface DepartmentHierarchyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  department: Department | null;
  allDepartments: Department[];
}

const DepartmentHierarchyDialog: React.FC<DepartmentHierarchyDialogProps> = ({
  isOpen,
  onClose,
  department,
  allDepartments,
}) => {
  // Always call hooks at the top level
  // Resolve the root department (if user clicks a sub-dept, show its parent hierarchy)
  const rootDept = useMemo(() => {
    if (!department) return null;
    const parentId = typeof department.parentDepartmentId === 'object' 
      ? (department.parentDepartmentId as any)?._id 
      : department.parentDepartmentId;
    
    if (!parentId) return department;
    return allDepartments.find(d => d._id === parentId) || department;
  }, [department, allDepartments]);

  const subDepts = useMemo(() => {
    if (!rootDept) return [];
    return allDepartments.filter(d => {
      const dParentId = typeof d.parentDepartmentId === 'object' 
        ? (d.parentDepartmentId as any)?._id 
        : d.parentDepartmentId;
      return dParentId === (rootDept as any)._id;
    });
  }, [rootDept, allDepartments]);

  if (!isOpen || !department || !rootDept) return null;

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-500"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Card className="w-full max-w-2xl bg-white rounded-2xl sm:rounded-3xl border-0 shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
        <CardHeader className="relative overflow-hidden bg-slate-900 px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-800 flex flex-row items-center justify-between">
          {/* Decorative background element */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
          
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-indigo-500/30 rounded-xl flex items-center justify-center border border-indigo-400/50 shadow-lg group-hover:scale-105 transition-transform">
              <Share2 className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-sm sm:text-base font-black text-white uppercase tracking-tight">
                Organization Hierarchy
              </CardTitle>
              <p className="text-[10px] text-indigo-100/70 font-bold uppercase tracking-widest mt-0.5">
                Departmental Relationship Map
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all border border-white/10 group cursor-pointer relative z-10 active:scale-90"
          >
            <X className="w-4 h-4 text-slate-400 group-hover:text-white" />
          </button>
        </CardHeader>

        <CardContent className="p-3 sm:p-6 bg-[#f8fafc] max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="relative py-2 sm:py-3">
            {/* Tree Container */}
            <div className="flex flex-col items-center">
              
              {/* Root Node (Main Department) */}
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-500"></div>
                <div className="relative px-4 sm:px-5 py-3 rounded-xl sm:rounded-2xl bg-white border border-slate-200 shadow-xl flex flex-col items-center min-w-[170px] sm:min-w-[190px] transition-transform duration-300 group-hover:-translate-y-1">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 bg-indigo-600 rounded-lg sm:rounded-xl mb-2 flex items-center justify-center shadow-lg shadow-indigo-200">
                    <Building className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-500 mb-1">
                    Main Department
                  </span>
                  <span className="text-xs sm:text-sm font-black text-center text-slate-800 leading-tight break-words">
                    {rootDept.name}
                  </span>
                  {(rootDept.headName || rootDept.head || rootDept.contactPerson) && (
                    <span className="mt-1 text-center text-[10px] font-bold leading-snug text-slate-500 break-words">
                      {rootDept.headName || rootDept.head || rootDept.contactPerson}
                    </span>
                  )}
                  <div className="mt-2.5 pt-2.5 border-t border-slate-100 w-full flex justify-between items-center px-1.5">
                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 uppercase">
                      <Users className="w-3 h-3 text-slate-400" />
                      {rootDept.userCount || 0} Staff
                    </div>
                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-600 uppercase">
                      <ShieldCheck className="w-3 h-3" />
                      Level 1
                    </div>
                  </div>
                </div>

                {/* Vertical Connector Line Below Root */}
                {subDepts.length > 0 && (
                  <div className="absolute top-full left-1/2 w-0.5 h-10 bg-gradient-to-b from-indigo-500 to-emerald-400 -translate-x-1/2" />
                )}
              </div>

              {/* Sub Departments Grid */}
              {subDepts.length > 0 ? (
                <div className="w-full mt-7 sm:mt-10">
                  {/* Horizontal Connector Line for multiple children */}
                  {subDepts.length > 1 && (
                    <div className="relative h-0.5 w-full flex justify-center px-[10%] mb-0">
                      <div className="absolute top-0 h-0.5 bg-emerald-400 w-[80%] rounded-full" />
                    </div>
                  )}

                  <div className={`grid gap-3 sm:gap-6 mt-0 ${
                    subDepts.length === 1 ? "grid-cols-1" : 
                    subDepts.length === 2 ? "grid-cols-2" : 
                    "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                  }`}>
                    {subDepts.map((child) => (
                      <div key={child._id} className="relative flex flex-col items-center pt-7 overflow-visible">
                        {/* Short vertical connector to horizontal line */}
                        <div className="absolute top-0 left-1/2 w-0.5 h-7 bg-emerald-400 -translate-x-1/2" />
                        
                        <div className={`relative px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl bg-white border transition-all duration-300 shadow-lg flex flex-col items-center w-full group/node hover:shadow-emerald-100 hover:-translate-y-1 ${
                          child._id === department._id ? "border-emerald-500 ring-2 ring-emerald-100" : "border-slate-200"
                        }`}>
                          <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg mb-1.5 flex items-center justify-center ${
                            child._id === department._id ? "bg-emerald-500 shadow-md shadow-emerald-200" : "bg-emerald-50"
                          }`}>
                            <GitBranch className={`w-4 h-4 ${child._id === department._id ? "text-white" : "text-emerald-600"}`} />
                          </div>
                          <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500 mb-1">Sub Department</span>
                          <span className="text-[11px] sm:text-xs font-black text-center text-slate-700 leading-tight mb-1.5 break-words">{child.name}</span>
                          {(child.headName || child.head || child.contactPerson) && (
                            <span className="mb-1.5 text-center text-[9px] font-bold leading-snug text-slate-500 break-words">
                              {child.headName || child.head || child.contactPerson}
                            </span>
                          )}
                          
                          <div className="pt-1.5 border-t border-slate-50 w-full flex justify-center">
                            <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1 group-hover/node:text-slate-600 transition-colors">
                              <Users className="w-2.5 h-2.5" />
                              {child.userCount || 0} Members
                            </span>
                          </div>

                          {child._id === department._id && (
                            <div className="absolute -top-2 -right-2 w-5 h-5 bg-emerald-500 text-white rounded-full flex items-center justify-center border-2 border-white shadow-sm animate-bounce">
                              <ShieldCheck className="w-3 h-3" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-16 w-full text-center py-8 px-5 bg-white rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center animate-in fade-in slide-in-from-top-4 duration-700">
                  <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <GitBranch className="w-6 h-6 text-slate-300" />
                  </div>
                  <h4 className="text-sm font-black text-slate-600 uppercase tracking-widest">No Sub-Organizations</h4>
                  <p className="text-xs text-slate-400 mt-2 max-w-[200px] font-medium leading-relaxed">
                    This unit functions as a primary entity without nested sub-departments.
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
        
        <div className="bg-slate-900 px-4 sm:px-6 py-2.5 sm:py-4 flex items-center justify-between border-t border-slate-800">
          <div className="flex items-center gap-3 sm:gap-4 text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-500">
            <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                <span>Primary Entity</span>
            </div>
            <div className="flex items-center gap-1.5 ml-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                <span>Functional Unit</span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="px-4 sm:px-7 py-2 sm:py-2.5 bg-white text-slate-900 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 hover:text-indigo-600 transition-all active:scale-95 shadow-lg shadow-black/20 cursor-pointer"
          >
            Acknowledge Map
          </button>
        </div>
      </Card>
      
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
};

export default DepartmentHierarchyDialog;
