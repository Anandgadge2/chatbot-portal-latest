import { apiClient } from "./client";

export const whatsappAPI = {
  getConfig: async (companyId: string): Promise<any> =>
    apiClient.get(`/whatsapp-config/company/${companyId}`),

  updateConfig: async (configId: string, payload: Record<string, any>): Promise<any> =>
    apiClient.put(`/whatsapp-config/${configId}`, payload),
};
