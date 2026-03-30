"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Building, X, ChevronRight, GitBranch, Share2 } from "lucide-react";
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
  if (!isOpen || !department) return null;

  const isMain = !department.parentDepartmentId;
  const parentId = typeof department.parentDepartmentId === 'object' 
    ? (department.parentDepartmentId as any)?._id 
    : department.parentDepartmentId;

  // Find relatives
  const parent = isMain ? null : allDepartments.find(d => d._id === parentId);
  const children = isMain 
    ? allDepartments.filter(d => {
        const dParentId = typeof d.parentDepartmentId === 'object' 
          ? (d.parentDepartmentId as any)?._id 
          : d.parentDepartmentId;
        return dParentId === department._id;
      })
    : [];

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Card className="w-full max-w-xl bg-white rounded-2xl border-0 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <CardHeader className="bg-slate-900 px-6 py-4 border-b border-slate-800 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20">
              <Share2 className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <CardTitle className="text-sm font-black text-white uppercase tracking-tight">
                Hierarchy Tree
              </CardTitle>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all border border-white/10 group cursor-pointer"
          >
            <X className="w-4 h-4 text-slate-400 group-hover:text-white" />
          </button>
        </CardHeader>

        <CardContent className="p-6 bg-slate-50/50">
          <div className="relative">
            <div className="flex flex-col items-center gap-8">
              
              {/* Root / Parent Node */}
              {(isMain || parent) && (
                <div className="flex flex-col items-center w-full">
                  <div className={`relative px-4 py-3 rounded-xl border-2 transition-all shadow-lg flex flex-col items-center min-w-[140px] max-w-[220px] ${
                    isMain 
                    ? "bg-indigo-600 border-indigo-400 text-white" 
                    : "bg-white border-slate-200 text-slate-900"
                  }`}>
                    <div className={`w-8 h-8 rounded-lg mb-2 flex items-center justify-center ${
                      isMain ? "bg-white/20" : "bg-indigo-50"
                    }`}>
                      <Building className={`w-4 h-4 ${isMain ? "text-white" : "text-indigo-600"}`} />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-0.5">
                      Main Department
                    </span>
                    <span className="text-xs font-bold text-center leading-tight">
                      {isMain ? department.name : parent?.name}
                    </span>
                    
                    {/* Connection Line Down */}
                    <div className="absolute top-full left-1/2 w-0.5 h-8 bg-indigo-200 -translate-x-1/2" />
                  </div>
                </div>
              )}

              {/* Children Nodes Wrapper */}
              <div className="w-full">
                {isMain ? (
                  <div className="relative pt-2">
                    {children.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {children.map((child, idx) => (
                          <div key={child._id} className="relative flex flex-col items-center">
                            {/* Horizontal connection line */}
                            {children.length > 1 && (
                                <div className={`absolute top-[-16px] h-0.5 bg-indigo-200 ${
                                    idx === 0 ? "left-1/2 right-0" : 
                                    idx === children.length - 1 ? "left-0 right-1/2" : 
                                    "left-0 right-0"
                                }`} />
                            )}
                            {/* Vertical stub */}
                            <div className="absolute top-[-16px] left-1/2 w-0.5 h-4 bg-indigo-200 -translate-x-1/2" />
                            
                            <div className="px-3 py-2.5 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col items-center w-full min-h-[70px] justify-center hover:border-indigo-300 transition-colors group/node">
                                <GitBranch className="w-3.5 h-3.5 text-emerald-500 mb-1.5" />
                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Sub Department</span>
                                <span className="text-[10px] font-bold text-center text-slate-700 leading-tight">{child.name}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 bg-white rounded-xl border border-dashed border-slate-300">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No Sub-Departments</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="px-4 py-3 rounded-xl bg-indigo-600 border-2 border-indigo-400 text-white shadow-lg flex flex-col items-center min-w-[140px] max-w-[220px]">
                      <div className="w-8 h-8 bg-white/20 rounded-lg mb-2 flex items-center justify-center">
                        <GitBranch className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-0.5">
                        Sub Department
                      </span>
                      <span className="text-xs font-bold text-center leading-tight">
                        {department.name}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="mt-8 pt-4 border-t border-slate-200 flex items-center justify-between text-[8px] font-black uppercase tracking-widest text-slate-400">
            <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <span>Primary Entity</span>
            </div>
            <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Secondary Node</span>
            </div>
          </div>
        </CardContent>
        
        <div className="bg-slate-50 p-3 border-t border-slate-200 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-md shadow-slate-200 cursor-pointer"
          >
            Close Diagram
          </button>
        </div>
      </Card>
    </div>
  );
};

export default DepartmentHierarchyDialog;
