import { apiClient } from './client';

export interface User {
  _id: string;
  userId: string;
  username?: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  email?: string; // 🏢 Optional email per new requirement
  phone?: string;
  designation?: string;
  designations?: string[]; // 🏢 Added for multiple designations
  role?: string;
  roleId?: string;
  isSuperAdmin?: boolean;
  level?: number;
  scope?: 'platform' | 'company' | 'department' | 'subdepartment' | 'assigned';
  companyId?: string | { _id: string; name: string; companyId: string };
  departmentId?: string | { _id: string; name: string; departmentId: string; parentDepartmentId?: string | { _id: string; name: string } };
  departmentIds?: (string | { _id: string; name: string; departmentId: string })[]; // 🏢 Added for multiple department mapping
  isActive: boolean;
  customRoleId?: string | { _id: string; name: string };
  rawPassword?: string;
  notificationSettings?: {
    hasOverride?: boolean;
    email: boolean;
    whatsapp: boolean;
    actions?: {
      [action: string]: { email: boolean, whatsapp: boolean };
    };
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserData {
  firstName: string;
  lastName: string;
  email?: string; // 🏢 Optional email per new requirement
  password: string;
  phone?: string;
  designation?: string;
  designations?: string[]; // 🏢 Added for multiple designations
  role?: string;
  roleId?: string;
  isSuperAdmin?: boolean;
  level?: number;
  scope?: 'platform' | 'company' | 'department' | 'subdepartment' | 'assigned';
  customRoleId?: string | null;
  companyId?: string;
  departmentId?: string;
  departmentIds?: string[]; // 🏢 Added for multiple department mapping
  notificationSettings?: {
    hasOverride?: boolean;
    email: boolean;
    whatsapp: boolean;
    actions?: {
      [action: string]: { email: boolean, whatsapp: boolean };
    };
  };
}

export interface UpdateUserData extends Omit<Partial<CreateUserData>, 'customRoleId'> {
  customRoleId?: string | null;
  notificationSettings?: {
    hasOverride?: boolean;
    email: boolean;
    whatsapp: boolean;
    actions?: {
      [action: string]: { email: boolean, whatsapp: boolean };
    };
  };
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
  roleId?: string;
  isSuperAdmin?: boolean;
  level?: number;
  scope?: 'platform' | 'company' | 'department' | 'subdepartment' | 'assigned';
    status?: 'active' | 'inactive';
    companyId?: string;
    departmentId?: string;
  }): Promise<UsersResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.role) queryParams.append('role', params.role);
    if (params?.status) queryParams.append('status', params.status);
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
  },

  deleteBulk: async (ids: string[]): Promise<{ success: boolean; message: string; data: { deletedCount: number } }> => {
    return apiClient.delete('/users/bulk', { ids });
  }
};
