import { apiClient } from './client';

export interface Flow {
  _id: string;
  companyId: any;
  flowName: string;
  flowDescription?: string;
  flowType: string;
  isActive: boolean;
  version: number;
  startStepId: string;
  steps: any[];
  triggers: any[];
  createdAt: string;
  updatedAt: string;
}

export const chatbotFlowApi = {
  getFlows: (companyId: string) => 
    apiClient.get(`/chatbot-flows?companyId=${companyId}`),
  
  getFlowById: (id: string) => 
    apiClient.get(`/chatbot-flows/${id}`),
  
  createFlow: (data: any) => 
    apiClient.post('/chatbot-flows', data),
  
  updateFlow: (id: string, data: any) => 
    apiClient.put(`/chatbot-flows/${id}`, data),
  
  deleteFlow: (id: string) => 
    apiClient.delete(`/chatbot-flows/${id}`),
  
  duplicateFlow: (id: string) => 
    apiClient.post(`/chatbot-flows/${id}/duplicate`),
  
  activateFlow: (id: string) => 
    apiClient.post(`/chatbot-flows/${id}/activate`),
    
  generateDefaults: (companyId: string) =>
    apiClient.post(`/chatbot-flows/company/${companyId}/generate-defaults`),
    
  hasDefaults: (companyId: string) =>
    apiClient.get(`/chatbot-flows/company/${companyId}/has-defaults`),
};
