import { apiClient } from './client';

export interface User {
  _id: string;
  userId: string;
  username?: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  email: string;
  phone?: string;
  designation?: string;
  role: string;
  companyId?: string | { _id: string; name: string; companyId: string };
  departmentId?: string | { _id: string; name: string; departmentId: string; parentDepartmentId?: string | { _id: string; name: string } };
  isActive: boolean;
  customRoleId?: string | { _id: string; name: string };
  rawPassword?: string;
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
  designation?: string;
  role: string;
  customRoleId?: string | null;
  companyId?: string;
  departmentId?: string;
}

export interface UpdateUserData extends Omit<Partial<CreateUserData>, 'customRoleId'> {
  customRoleId?: string | null;
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

  update: async (id: string, data: UpdateUserData): Promise<{ success: boolean; data: { user: User } }> => {
    return apiClient.put(`/users/${id}`, data);
  },

  delete: async (id: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.delete(`/users/${id}`);
  }
};
