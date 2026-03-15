"use client";

import React from "react";
import { TabsContent } from "@/components/ui/tabs";
import AppointmentList from "./AppointmentList";
import { Appointment } from "@/lib/api/appointment";
import { User } from "@/lib/api/user";

interface AppointmentTabProps {
  appointments: Appointment[];
  loadingAppointments: boolean;
  appointmentFilters: any;
  setAppointmentFilters: (filters: any) => void;
  appointmentSearch: string;
  setAppointmentSearch: (search: string) => void;
  handleRefreshData: () => void;
  isRefreshing: boolean;
  selectedAppointments: Set<string>;
  setSelectedAppointments: React.Dispatch<React.SetStateAction<Set<string>>>;
  handleBulkDeleteAppointments: () => void;
  isDeleting: boolean;
  sortConfig: any;
  handleSort: (key: string, tab: string) => void;
  appointmentPage: number;
  setAppointmentPage: (page: number) => void;
  appointmentPagination: any;
  openAppointmentDetail: (id: string) => void;
  setSelectedAppointmentForStatus: (a: any) => void;
  setShowAppointmentStatusModal: (show: boolean) => void;
  updatingAppointmentStatus: Set<string>;
  setShowAvailabilityCalendar: (show: boolean) => void;
  isCompanyLevel: boolean;
  isDepartmentLevel: boolean;
  user: User | null;
  getSortedData: (data: any[], tab: string) => any[];
  exportToCSV: (data: any[], filename: string, columns: any[]) => void;
}

const AppointmentTab: React.FC<AppointmentTabProps> = ({
  appointments,
  loadingAppointments,
  appointmentFilters,
  setAppointmentFilters,
  appointmentSearch,
  setAppointmentSearch,
  handleRefreshData,
  isRefreshing,
  selectedAppointments,
  setSelectedAppointments,
  handleBulkDeleteAppointments,
  isDeleting,
  sortConfig,
  handleSort,
  appointmentPage,
  setAppointmentPage,
  appointmentPagination,
  openAppointmentDetail,
  setSelectedAppointmentForStatus,
  setShowAppointmentStatusModal,
  updatingAppointmentStatus,
  setShowAvailabilityCalendar,
  isCompanyLevel,
  isDepartmentLevel,
  user,
  getSortedData,
  exportToCSV,
}) => {
  return (
    <TabsContent value="appointments" className="space-y-6">
      <AppointmentList
        appointments={appointments}
        loadingAppointments={loadingAppointments}
        appointmentFilters={appointmentFilters}
        setAppointmentFilters={setAppointmentFilters}
        appointmentSearch={appointmentSearch}
        setAppointmentSearch={setAppointmentSearch}
        handleRefreshData={handleRefreshData}
        isRefreshing={isRefreshing}
        selectedAppointments={selectedAppointments}
        setSelectedAppointments={setSelectedAppointments}
        handleBulkDeleteAppointments={handleBulkDeleteAppointments}
        isDeleting={isDeleting}
        sortConfig={sortConfig}
        handleSort={handleSort}
        appointmentPage={appointmentPage}
        setAppointmentPage={setAppointmentPage}
        appointmentPagination={appointmentPagination}
        openAppointmentDetail={openAppointmentDetail}
        setSelectedAppointmentForStatus={setSelectedAppointmentForStatus}
        setShowAppointmentStatusModal={setShowAppointmentStatusModal}
        updatingAppointmentStatus={updatingAppointmentStatus}
        setShowAvailabilityCalendar={setShowAvailabilityCalendar}
        isCompanyLevel={isCompanyLevel}
        isDepartmentLevel={isDepartmentLevel}
        user={user as any}
        getSortedData={getSortedData}
        exportToCSV={exportToCSV}
      />
    </TabsContent>
  );
};

export default AppointmentTab;
