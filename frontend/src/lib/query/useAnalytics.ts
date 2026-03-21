"use client";

import { analyticsAPI } from "@/lib/api/analytics";
import { useCachedQuery } from "./cache";

export function useAnalytics(companyId?: string) {
  return useCachedQuery({
    queryKey: ["analytics", companyId],
    queryFn: async () => {
      const response = await analyticsAPI.dashboard(companyId!);
      return response.data;
    },
    staleTime: 2 * 60 * 1000,
    enabled: !!companyId,
  });
}
