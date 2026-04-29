"use client";

import { CalendarCheck, CalendarClock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ProtectedButton } from "@/components/ui/ProtectedButton";
import { Permission } from "@/lib/permissions";

type OverviewQuickActionsProps = {
  isViewingCompany: boolean;
  isDepartmentLevel: boolean;
  onOpenDepartments: () => void;
  onOpenUsers: () => void;
  onOpenAvailability: () => void;
  onOpenAnalytics: () => void;
  hasAppointmentModule: boolean;
};

const BuildingIcon = () => (
  <svg
    className="w-5 h-5 mr-2"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
    />
  </svg>
);

const UsersIcon = () => (
  <svg
    className="w-5 h-5 mr-2"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
    />
  </svg>
);

const AnalyticsIcon = () => (
  <svg
    className="w-5 h-5 mr-2"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
    />
  </svg>
);

export function OverviewQuickActions({
  isViewingCompany,
  isDepartmentLevel,
  onOpenDepartments,
  onOpenUsers,
  onOpenAvailability,
  onOpenAnalytics,
  hasAppointmentModule,
}: OverviewQuickActionsProps) {
  return (
    <Card className="border border-slate-200 shadow-sm rounded-xl overflow-hidden">
      <CardContent className="p-4 space-y-2">
        {isViewingCompany && (
          <>
            <ProtectedButton
              permission={Permission.CREATE_DEPARTMENT}
              className="w-full justify-start"
              variant="outline"
              onClick={onOpenDepartments}
            >
              <BuildingIcon />
              Manage Departments
            </ProtectedButton>
            <ProtectedButton
              permission={Permission.CREATE_USER}
              className="w-full justify-start"
              variant="outline"
              onClick={onOpenUsers}
            >
              <UsersIcon />
              Manage Users
            </ProtectedButton>
            {hasAppointmentModule && (
              <ProtectedButton
                permission={Permission.READ_APPOINTMENT}
                className="w-full justify-start hover:border-indigo-200 hover:text-indigo-600 transition-all"
                variant="outline"
                onClick={onOpenAvailability}
              >
                <CalendarCheck className="w-5 h-5 mr-3" />
                Manage Availability
              </ProtectedButton>
            )}
          </>
        )}
        {isDepartmentLevel && hasAppointmentModule && (
          <ProtectedButton
            permission={Permission.READ_APPOINTMENT}
            className="w-full justify-start hover:border-indigo-200 hover:text-indigo-600 transition-all font-bold"
            variant="outline"
            onClick={onOpenAvailability}
          >
            <CalendarClock className="w-5 h-5 mr-3" />
            Dept. Availability
          </ProtectedButton>
        )}
        <ProtectedButton
          permission={Permission.VIEW_ANALYTICS}
          className="w-full justify-start"
          variant="outline"
          onClick={onOpenAnalytics}
        >
          <AnalyticsIcon />
          View Analytics
        </ProtectedButton>
      </CardContent>
    </Card>
  );
}
