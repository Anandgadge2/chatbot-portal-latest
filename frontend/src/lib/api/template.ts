import { apiClient } from "./client";
import { SendTemplatePayload, TemplateListResponse } from "@/types/whatsappTemplate";

export interface TemplateQuery {
  companyId: string;
  search?: string;
  status?: string;
  language?: string;
  category?: string;
}

export const templateAPI = {
  getTemplates: async (params: TemplateQuery): Promise<TemplateListResponse> => {
    const query = new URLSearchParams();
    query.set("companyId", params.companyId);
    if (params.search) query.set("search", params.search);
    if (params.status) query.set("status", params.status);
    if (params.language) query.set("language", params.language);
    if (params.category) query.set("category", params.category);

    return apiClient.get(`/templates?${query.toString()}`);
  },

  syncTemplates: async (companyId: string): Promise<any> =>
    apiClient.post("/templates/sync", { companyId }),

  saveMapping: async (payload: {
    companyId: string;
    templateName: string;
    mappings: Record<string, string>;
  }): Promise<any> => apiClient.post("/templates/mapping", payload),

  sendTemplate: async (payload: SendTemplatePayload): Promise<any> =>
    apiClient.post("/whatsapp/send-template", payload),
};
