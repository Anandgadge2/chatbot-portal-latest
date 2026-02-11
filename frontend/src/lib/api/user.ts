import { apiClient } from './client';

export interface User {
  _id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: string;
  companyId?: string | { _id: string; name: string; companyId: string };
  departmentId?: string | { _id: string; name: string; departmentId: string };
  isActive: boolean;
  isEmailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  role: string;
  companyId?: string;
  departmentId?: string;
}

export interface UsersResponse {
  success: boolean;
  data: {
    users: User[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

export const userAPI = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    companyId?: string;
    departmentId?: string;
  }): Promise<UsersResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.role) queryParams.append('role', params.role);
    if (params?.companyId) queryParams.append('companyId', params.companyId);
    if (params?.departmentId) queryParams.append('departmentId', params.departmentId);
    
    return apiClient.get(`/users?${queryParams.toString()}`);
  },

  getById: async (id: string): Promise<{ success: boolean; data: { user: User } }> => {
    return apiClient.get(`/users/${id}`);
  },

  create: async (data: CreateUserData): Promise<{ success: boolean; data: { user: User } }> => {
    return apiClient.post('/users', data);
  },

  update: async (id: string, data: Partial<CreateUserData>): Promise<{ success: boolean; data: { user: User } }> => {
    return apiClient.put(`/users/${id}`, data);
  },

  delete: async (id: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.delete(`/users/${id}`);
  }
};
