import { apiClient } from './client';

export interface Grievance {
  _id: string;
  grievanceId: string;
  companyId: string | { _id: string; name: string };
  departmentId?: string | { _id: string; name: string };
  citizenName: string;
  citizenPhone: string;
  citizenWhatsApp?: string;
  citizenEmail?: string;
  description: string;
  category?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: string;
  statusHistory?: Array<{
    status: string;
    changedBy?: string | { _id: string; firstName: string; lastName: string };
    changedAt: string;
    remarks?: string;
  }>;
  assignedTo?: string | { _id: string; firstName: string; lastName: string };
  assignedAt?: string;
  location?: {
    type: 'Point';
    coordinates: [number, number];
    address?: string;
  };
  media?: Array<{
    url: string;
    type: 'image' | 'document';
    uploadedAt: string;
  }>;
  resolution?: string;
  resolvedAt?: string;
  closedAt?: string;
  slaBreached?: boolean;
  slaDueDate?: string;
  language?: 'en' | 'hi' | 'mr';
  createdAt: string;
  updatedAt: string;
  timeline?: Array<{
    action: string;
    details?: any;
    performedBy?: string | { _id: string; firstName: string; lastName: string; role: string };
    timestamp: string;
  }>;
}

export interface CreateGrievanceData {
  companyId: string;
  departmentId?: string;
  citizenName: string;
  citizenPhone: string;
  citizenWhatsApp?: string;
  description: string;
  category?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  location?: {
    coordinates: [number, number];
    address?: string;
  };
}

export interface GrievancesResponse {
  success: boolean;
  data: {
    grievances: Grievance[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

export const grievanceAPI = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    companyId?: string;
    departmentId?: string;
    assignedTo?: string;
    priority?: string;
  }): Promise<GrievancesResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.companyId) queryParams.append('companyId', params.companyId);
    if (params?.departmentId) queryParams.append('departmentId', params.departmentId);
    if (params?.assignedTo) queryParams.append('assignedTo', params.assignedTo);
    if (params?.priority) queryParams.append('priority', params.priority);
    
    return apiClient.get(`/grievances?${queryParams.toString()}`);
  },

  getById: async (id: string): Promise<{ success: boolean; data: { grievance: Grievance } }> => {
    return apiClient.get(`/grievances/${id}`);
  },

  create: async (data: CreateGrievanceData): Promise<{ success: boolean; data: { grievance: Grievance } }> => {
    return apiClient.post('/grievances', data);
  },

  updateStatus: async (id: string, status: string, remarks?: string): Promise<{ success: boolean; data: { grievance: Grievance } }> => {
    return apiClient.put(`/grievances/${id}/status`, { status, remarks });
  },

  assign: async (id: string, assignedTo: string, departmentId?: string): Promise<{ success: boolean; data: { grievance: Grievance } }> => {
    return apiClient.put(`/grievances/${id}/assign`, { assignedTo, departmentId });
  },

  update: async (id: string, data: Partial<CreateGrievanceData>): Promise<{ success: boolean; data: { grievance: Grievance } }> => {
    return apiClient.put(`/grievances/${id}`, data);
  },

  delete: async (id: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.delete(`/grievances/${id}`);
  },

  deleteBulk: async (ids: string[]): Promise<{ success: boolean; message: string; data: { deletedCount: number } }> => {
    return apiClient.delete('/grievances/bulk', { ids });
  }
};
