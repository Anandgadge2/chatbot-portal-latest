"use client";

import { useCachedQuery } from "./cache";
import { apiClient } from "../api/client";

interface UseUsersParams {
  page: number;
  limit: number;
  search?: string;
  companyId?: string;
  departmentId?: string;
  role?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: string;
  enabled?: boolean;
}

export function useUsers(params: UseUsersParams) {
  const { enabled = true, ...queryParam } = params;

  return useCachedQuery({
    queryKey: ["users", params.page, params.limit, params.search, params.companyId, params.departmentId, params.role, params.status, params.sortBy, params.sortOrder],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      Object.entries(queryParam).forEach(([key, value]) => {
        if (value !== undefined && value !== "") {
          queryParams.append(key, value.toString());
        }
      });

      const response = await apiClient.get<{
        success: boolean;
        data: {
          users: any[];
          pagination: {
            total: number;
            pages: number;
            page: number;
            limit: number;
          };
        };
      }>(`/users?${queryParams.toString()}`);

      if (response.success && response.data) {
        return response.data;
      }
      return { users: [], pagination: { total: 0, pages: 0, page: 1, limit: 20 } };
    },
    staleTime: 300 * 1000, // 5 minutes stale time
    enabled,
  });
}
