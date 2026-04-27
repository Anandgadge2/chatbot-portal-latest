"use client";

import { useCachedQuery } from "./cache";
import { apiClient } from "../api/client";

interface UseDepartmentsParams {
  page: number;
  limit: number;
  search?: string;
  companyId?: string;
  status?: string;
  mainDeptId?: string;
  subDeptId?: string;
  type?: string;
  sortBy?: string;
  sortOrder?: string;
  enabled?: boolean;
}

export function useDepartments(params: UseDepartmentsParams) {
  const { enabled = true, ...queryParam } = params;

  return useCachedQuery({
    queryKey: ["departments", params.page, params.limit, params.search, params.companyId, params.status, params.mainDeptId, params.subDeptId, params.type, params.sortBy, params.sortOrder],
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
          departments: any[];
          pagination: {
            total: number;
            pages: number;
            page: number;
            limit: number;
          };
        };
      }>(`/departments?${queryParams.toString()}`);

      if (response.success && response.data) {
        return response.data;
      }
      return { departments: [], pagination: { total: 0, pages: 0, page: 1, limit: 20 } };
    },
    staleTime: 45 * 1000, // 45 seconds stale time
    enabled,
  });
}
