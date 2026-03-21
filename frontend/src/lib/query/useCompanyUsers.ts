"use client";

import { userAPI } from "@/lib/api/user";
import { useCachedQuery } from "./cache";

export function useCompanyUsers(companyId?: string) {
  return useCachedQuery({
    queryKey: ["company-users", companyId],
    queryFn: async () => {
      const response = await userAPI.getAll({ companyId: companyId!, limit: 25 });
      return response.data;
    },
    staleTime: 2 * 60 * 1000,
    enabled: !!companyId,
  });
}
