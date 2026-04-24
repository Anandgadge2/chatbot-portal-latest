"use client";

import { useCachedQuery } from "./cache";
import { apiClient } from "../api/client";

export interface DashboardKpiStats {
  grievances: {
    total: number;
    registeredTotal: number;
    pending: number;
    reverted: number;
    resolved: number;
    rejected: number;
    pendingOverdue: number;
    slaBreached: number;
  };
}

interface UseDashboardKpisParams {
  companyId?: string;
  departmentId?: string;
  enabled?: boolean;
}

export function useDashboardKpis(params: UseDashboardKpisParams) {
  const { enabled = true, companyId, departmentId } = params;

  return useCachedQuery<DashboardKpiStats>({
    queryKey: ["dashboard-kpis", companyId, departmentId],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (companyId) queryParams.append("companyId", companyId);
      if (departmentId) queryParams.append("departmentId", departmentId);

      const response = await apiClient.get<{
        success: boolean;
        data: DashboardKpiStats;
      }>(`/analytics/dashboard/kpis?${queryParams.toString()}`);

      if (response.success && response.data) {
        return response.data;
      }
      throw new Error("Failed to fetch dashboard KPI statistics");
    },
    staleTime: 15 * 1000,
    enabled,
  });
}
