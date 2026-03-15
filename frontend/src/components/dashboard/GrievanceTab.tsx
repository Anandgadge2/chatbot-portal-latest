"use client";

import React from "react";
import { TabsContent } from "@/components/ui/tabs";
import GrievanceList from "./GrievanceList";
import RevertedGrievanceList from "./RevertedGrievanceList";
import { Grievance } from "@/lib/api/grievance";
import { Department } from "@/lib/api/department";
import { User } from "@/lib/api/user";
import { Permission } from "@/lib/permissions";
import { hasPermission } from "@/lib/permissions";

interface GrievanceTabProps {
  grievances: Grievance[];
  loadingGrievances: boolean;
  grievanceFilters: any;
  setGrievanceFilters: (filters: any) => void;
  grievanceSearch: string;
  setGrievanceSearch: (search: string) => void;
  handleRefreshData: () => void;
  isRefreshing: boolean;
  selectedGrievances: Set<string>;
  setSelectedGrievances: React.Dispatch<React.SetStateAction<Set<string>>>;
  handleBulkDeleteGrievances: () => void;
  isDeleting: boolean;
  sortConfig: any;
  handleSort: (key: string, tab: string) => void;
  grievancePage: number;
  setGrievancePage: (page: number) => void;
  grievancePagination: any;
  openGrievanceDetail: (id: string) => void;
  setSelectedGrievanceForStatus: (g: any) => void;
  setShowGrievanceStatusModal: (show: boolean) => void;
  updatingGrievanceStatus: Set<string>;
  setSelectedGrievanceForAssignment: (g: any) => void;
  setShowGrievanceAssignment: (show: boolean) => void;
  setSelectedGrievanceForRevert: (g: any) => void;
  setShowGrievanceRevertDialog: (show: boolean) => void;
  departments: Department[];
  users: User[];
  user: User | null;
  isCompanyLevel: boolean;
  getSortedData: (data: any[], tab: string) => any[];
  formatTo10Digits: (phone?: string) => string;
  getParentDepartmentId: (dept: any) => string | null;
  exportToCSV: (data: any[], filename: string, columns: any[]) => void;
}

const GrievanceTab: React.FC<GrievanceTabProps> = ({
  grievances,
  loadingGrievances,
  grievanceFilters,
  setGrievanceFilters,
  grievanceSearch,
  setGrievanceSearch,
  handleRefreshData,
  isRefreshing,
  selectedGrievances,
  setSelectedGrievances,
  handleBulkDeleteGrievances,
  isDeleting,
  sortConfig,
  handleSort,
  grievancePage,
  setGrievancePage,
  grievancePagination,
  openGrievanceDetail,
  setSelectedGrievanceForStatus,
  setShowGrievanceStatusModal,
  updatingGrievanceStatus,
  setSelectedGrievanceForAssignment,
  setShowGrievanceAssignment,
  setSelectedGrievanceForRevert,
  setShowGrievanceRevertDialog,
  departments,
  users,
  user,
  isCompanyLevel,
  getSortedData,
  formatTo10Digits,
  getParentDepartmentId,
  exportToCSV,
}) => {
  return (
    <>
      <TabsContent value="grievances" className="space-y-6">
        <GrievanceList
          grievances={grievances}
          grievanceFilters={grievanceFilters}
          setGrievanceFilters={setGrievanceFilters}
          grievanceSearch={grievanceSearch}
          setGrievanceSearch={setGrievanceSearch}
          loadingGrievances={loadingGrievances}
          grievancePage={grievancePage}
          grievancePagination={grievancePagination}
          setGrievancePage={setGrievancePage}
          handleRefreshData={handleRefreshData}
          isRefreshing={isRefreshing}
          exportToCSV={exportToCSV}
          getSortedData={getSortedData}
          handleSort={handleSort}
          sortConfig={sortConfig}
          openGrievanceDetail={openGrievanceDetail}
          departments={departments}
          isCompanyLevel={isCompanyLevel}
          user={user}
          selectedGrievances={selectedGrievances}
          setSelectedGrievances={setSelectedGrievances}
          handleBulkDeleteGrievances={handleBulkDeleteGrievances}
          isDeleting={isDeleting}
          openStatusUpdate={(g) => {
            setSelectedGrievanceForStatus(g);
            setShowGrievanceStatusModal(true);
          }}
          openRevertDialog={(g) => {
            setSelectedGrievanceForRevert(g);
            setShowGrievanceRevertDialog(true);
          }}
          openAssignDialog={(g) => {
            setSelectedGrievanceForAssignment(g);
            setShowGrievanceAssignment(true);
          }}
          getParentDepartmentId={getParentDepartmentId}
        />
      </TabsContent>

      {isCompanyLevel && hasPermission(user, Permission.READ_GRIEVANCE) && (
        <TabsContent value="reverted" className="space-y-6">
          <RevertedGrievanceList
            grievances={grievances}
            grievanceSearch={grievanceSearch}
            setGrievanceSearch={setGrievanceSearch}
            grievanceFilters={grievanceFilters}
            setGrievanceFilters={setGrievanceFilters}
            departments={departments}
            handleRefreshData={handleRefreshData}
            isRefreshing={isRefreshing}
            getSortedData={getSortedData}
            openGrievanceDetail={openGrievanceDetail}
            formatTo10Digits={formatTo10Digits}
            setSelectedGrievanceForAssignment={setSelectedGrievanceForAssignment}
            setShowGrievanceAssignment={setShowGrievanceAssignment}
          />
        </TabsContent>
      )}
    </>
  );
};

export default GrievanceTab;
