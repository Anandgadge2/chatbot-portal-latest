"use client";

import { companyAPI } from "@/lib/api/company";
import { useCachedQuery } from "./cache";

export function useCompany(companyId?: string) {
  const query = useCachedQuery({
    queryKey: ["company", companyId],
    queryFn: async () => {
      const response = await companyAPI.getById(companyId!);
      return response.data.company;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!companyId,
  });

  return {
    ...query,
    company: query.data ?? null,
  };
}
