"use client";

import { useCachedQuery } from "./cache";
import { apiClient } from "../api/client";

export interface DashboardStats {
  grievances: {
    total: number;
    registeredTotal: number;
    pending: number;
    assigned: number;
    reverted: number;
    rejected: number;
    inProgress: number;
    resolved: number;
    last7Days: number;
    last30Days: number;
    resolutionRate: number;
    slaBreached: number;
    pendingOverdue: number;
    slaComplianceRate: number;
    avgResolutionDays: number;
    byPriority: Array<{ priority: string; count: number }>;
    daily: Array<{ date: string; count: number }>;
    monthly: Array<{ month: string; count: number; resolved: number }>;
    byDepartment: Array<{
      departmentId: string;
      departmentName: string;
      total: number;
      pending: number;
    }>;
  };
  appointments: {
    total: number;
    pending: number;
    requested: number;
    scheduled: number;
    confirmed: number;
    completed: number;
    cancelled: number;
    last7Days: number;
    last30Days: number;
    completionRate: number;
    byDepartment: any[];
    daily: Array<{ date: string; count: number }>;
    monthly: Array<{ month: string; count: number; completed: number }>;
  };
  departments: number;
  mainDepartments: number;
  subDepartments: number;
  users: number;
  activeUsers: number;
  resolvedToday: number;
  highPriorityPending: number;
  isHierarchicalEnabled: boolean;
  deptCounts: any[];
  usersByRole: Array<{ name: string; count: number }>;
}

interface UseDashboardStatsParams {
  companyId?: string;
  departmentId?: string;
  enabled?: boolean;
}

export function useDashboardStats(params: UseDashboardStatsParams) {
  const { enabled = true, companyId, departmentId } = params;

  return useCachedQuery<DashboardStats>({
    queryKey: ["dashboard-stats", companyId, departmentId],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (companyId) queryParams.append("companyId", companyId);
      if (departmentId) queryParams.append("departmentId", departmentId);

      const response = await apiClient.get<{
        success: boolean;
        data: DashboardStats;
      }>(`/analytics/dashboard?${queryParams.toString()}`);

      if (response.success && response.data) {
        return response.data;
      }
      throw new Error("Failed to fetch dashboard stats");
    },
    staleTime: 60 * 1000, // 1 minute stale time for stats
    enabled,
  });
}
