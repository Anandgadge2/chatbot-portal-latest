import { apiClient } from './client';

export interface Role {
  _id: string;
  companyId: string | { _id: string; name: string };
  name: string;
  description?: string;
  isSystem: boolean;
  permissions: Array<{
    module: string;
    actions: string[];
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoleData {
  companyId: string;
  name: string;
  description?: string;
  permissions: Array<{
    module: string;
    actions: string[];
  }>;
}

export const roleAPI = {
  getRoles: async (companyId?: string, filterGlobal?: boolean): Promise<{ success: boolean; data: { roles: Role[] } }> => {
    const params = new URLSearchParams();
    if (companyId) params.append('companyId', companyId);
    if (filterGlobal) params.append('filterGlobal', 'true');
    
    const url = params.toString() ? `/roles?${params.toString()}` : '/roles';
    return apiClient.get(url);
  },

  getRoleById: async (id: string): Promise<{ success: boolean; data: { role: Role } }> => {
    return apiClient.get(`/roles/${id}`);
  },

  createRole: async (data: CreateRoleData): Promise<{ success: boolean; data: { role: Role } }> => {
    return apiClient.post('/roles', data);
  },

  updateRole: async (id: string, data: Partial<CreateRoleData>): Promise<{ success: boolean; data: { role: Role } }> => {
    return apiClient.put(`/roles/${id}`, data);
  },

  deleteRole: async (id: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.delete(`/roles/${id}`);
  },

  getRoleUsers: async (id: string): Promise<{ success: boolean; data: { users: any[] } }> => {
    return apiClient.get(`/roles/${id}/users`);
  }
};
