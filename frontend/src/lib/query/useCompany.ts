"use client";

import { companyAPI } from "@/lib/api/company";
import { useCachedQuery } from "./cache";

export function useCompany(companyId?: string) {
  const query = useCachedQuery({
    queryKey: ["company", companyId],
    queryFn: async () => {
      try {
        // Try getById first (works for Superadmins)
        const response = await companyAPI.getById(companyId!);
        return response.data.company;
      } catch (error: any) {
        // If 403/Forbidden, try getMyCompany (works for Company Admins)
        if (error.response?.status === 403 || error.status === 403) {
          const myResponse = await companyAPI.getMyCompany();
          return myResponse.data.company;
        }
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!companyId,
  });

  return {
    ...query,
    company: query.data ?? null,
  };
}
