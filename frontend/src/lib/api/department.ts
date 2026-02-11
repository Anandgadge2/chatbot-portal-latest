import { apiClient } from './client';

export interface Department {
  _id: string;
  departmentId: string;
  name: string;
  /** Display name in Hindi (for chatbot when user selects Hindi) */
  nameHi?: string;
  /** Display name in Odia (for chatbot when user selects Odia) */
  nameOr?: string;
  /** Display name in Marathi (for chatbot when user selects Marathi) */
  nameMr?: string;
  description?: string;
  descriptionHi?: string;
  descriptionOr?: string;
  descriptionMr?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  companyId: string | { _id: string; name: string; companyId: string };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDepartmentData {
  name: string;
  nameHi?: string;
  nameOr?: string;
  nameMr?: string;
  description?: string;
  descriptionHi?: string;
  descriptionOr?: string;
  descriptionMr?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  companyId: string;
}

export interface UpdateDepartmentData {
  name?: string;
  nameHi?: string;
  nameOr?: string;
  nameMr?: string;
  description?: string;
  descriptionHi?: string;
  descriptionOr?: string;
  descriptionMr?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  isActive?: boolean;
}

export interface DepartmentsResponse {
  success: boolean;
  data: {
    departments: Department[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

export const departmentAPI = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    companyId?: string;
  }): Promise<DepartmentsResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.companyId) queryParams.append('companyId', params.companyId);
    
    return apiClient.get(`/departments?${queryParams.toString()}`);
  },

  getById: async (id: string): Promise<{ success: boolean; data: { department: Department } }> => {
    return apiClient.get(`/departments/${id}`);
  },

  create: async (data: CreateDepartmentData): Promise<{ success: boolean; data: { department: Department } }> => {
    return apiClient.post('/departments', data);
  },

  update: async (id: string, data: UpdateDepartmentData): Promise<{ success: boolean; data: { department: Department } }> => {
    return apiClient.put(`/departments/${id}`, data);
  },

  delete: async (id: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.delete(`/departments/${id}`);
  }
};
