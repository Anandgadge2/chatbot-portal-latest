"use client";

import { whatsappAPI } from "@/lib/api/whatsapp";
import { useCachedQuery } from "./cache";

export function useWhatsappConfig(companyId?: string) {
  return useCachedQuery({
    queryKey: ["whatsapp-config", companyId],
    queryFn: async () => {
      const response = await whatsappAPI.getConfig(companyId!);
      return response?.success ? response.data : response?.data ?? response ?? null;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!companyId,
  });
}
