import { apiClient } from './client';

export interface Lead {
  _id: string;
  leadId: string;
  companyId: string;
  name: string;
  companyName?: string;
  projectType: string;
  projectDescription: string;
  budgetRange?: string;
  timeline?: string;
  contactInfo: string;
  email?: string;
  phone?: string;
  status: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export const leadAPI = {
  getAll: async (params?: { companyId?: string }): Promise<{ success: boolean; data: Lead[] }> => {
    const queryParams = new URLSearchParams();
    if (params?.companyId) queryParams.append('companyId', params.companyId);
    return apiClient.get(`/leads?${queryParams.toString()}`);
  },
  
  getById: async (id: string): Promise<{ success: boolean; data: Lead }> => {
    return apiClient.get(`/leads/${id}`);
  },

  updateStatus: async (id: string, status: string): Promise<{ success: boolean; data: Lead }> => {
    return apiClient.patch(`/leads/${id}/status`, { status });
  }
};
