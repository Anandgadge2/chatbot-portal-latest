import { apiClient } from "./client";

export const whatsappAPI = {
  getConfig: async (companyId: string): Promise<any> =>
    apiClient.get(`/whatsapp-config/company/${companyId}`),
};
