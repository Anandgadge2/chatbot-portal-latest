import { apiClient } from "./client";

export interface DashboardAnalyticsResponse {
  success: boolean;
  data: {
    grievances: {
      total: number;
      pending: number;
      resolved: number;
    };
    appointments: {
      total: number;
    };
    departments: number;
    users: number;
    activeUsers: number;
    deptCounts?: Array<{ _id: string | null; count: number }>;
    [key: string]: any;
  };
}

export const analyticsAPI = {
  dashboard: async (companyId: string): Promise<DashboardAnalyticsResponse> =>
    apiClient.get(`/analytics/dashboard?companyId=${companyId}`),
};
