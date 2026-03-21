"use client";

import { chatbotFlowApi } from "@/lib/api/chatbotFlow";
import { useCachedQuery } from "./cache";

export function useFlows(companyId?: string) {
  return useCachedQuery({
    queryKey: ["flows", companyId],
    queryFn: async () => {
      const response: any = await chatbotFlowApi.getFlows(companyId!);
      if (response?.success && Array.isArray(response.data)) return response.data;
      if (Array.isArray(response)) return response;
      if (Array.isArray(response?.data)) return response.data;
      if (Array.isArray(response?.flows)) return response.flows;
      return [];
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!companyId,
  });
}
