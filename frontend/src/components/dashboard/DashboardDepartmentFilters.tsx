import React from "react";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Department } from "@/lib/api/department";

interface DepartmentFilters {
  mainDeptId: string;
  subDeptId: string;
}

interface DepartmentFiltersProps {
  allDepartments: Department[];
  onFiltersChange: (filters: DepartmentFilters) => void;
  getParentDepartmentId: (d: any) => string | null;
  currentFilters: DepartmentFilters;
  className?: string;
  mainPlaceholder?: string;
  subPlaceholder?: string;
}

export const DashboardDepartmentFilters: React.FC<DepartmentFiltersProps> = ({
  allDepartments,
  onFiltersChange,
  getParentDepartmentId,
  currentFilters,
  className = "",
  mainPlaceholder = "🏢 Main Depts",
  subPlaceholder = "📍 Sub Depts",
}) => {
  const mainDeptOptions = [
    { value: "", label: "🏢 All Main Depts" },
    ...allDepartments
      .filter((d) => !getParentDepartmentId(d))
      .map((dept) => ({
        value: dept._id,
        label: dept.name,
      })),
  ];

  const subDeptOptions = [
    { value: "", label: "📍 All Sub Depts" },
    ...allDepartments
      .filter((d) => getParentDepartmentId(d) === currentFilters.mainDeptId)
      .map((dept) => ({
        value: dept._id,
        label: dept.name,
      })),
  ];

  return (
    <div className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-2 ${className}`}>
      <div className="flex-1 min-w-0 sm:min-w-[180px] lg:min-w-[220px]">
        <SearchableSelect
          options={mainDeptOptions}
          value={currentFilters.mainDeptId}
          onValueChange={(val) =>
            onFiltersChange({ mainDeptId: val, subDeptId: "" })
          }
          placeholder={mainPlaceholder}
          className="w-full"
          triggerClassName="h-10 px-4 group-hover:border-indigo-300 transition-all"
        />
      </div>
      <div className="flex-1 min-w-0 sm:min-w-[180px] lg:min-w-[220px]">
        <SearchableSelect
          options={subDeptOptions}
          value={currentFilters.subDeptId}
          onValueChange={(val) =>
            onFiltersChange({ ...currentFilters, subDeptId: val })
          }
          disabled={!currentFilters.mainDeptId}
          placeholder={subPlaceholder}
          className="w-full"
          triggerClassName="h-10 px-4 group-hover:border-indigo-300 transition-all"
        />
      </div>
    </div>
  );
};
