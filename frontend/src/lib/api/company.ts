import { apiClient } from './client';

export interface Company {
  _id: string;
  companyId: string;
  name: string;
  nameHi?: string;
  nameOr?: string;
  nameMr?: string;
  companyType: string;
  enabledModules: string[];
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  theme: {
    primaryColor: string;
    secondaryColor: string;
    logoUrl?: string;
  };
  whatsappConfig?: {
    phoneNumberId: string;
    accessToken: string;
    businessAccountId: string;
  };
  isActive: boolean;
  isSuspended: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCompanyData {
  name: string;
  nameHi?: string;
  nameOr?: string;
  nameMr?: string;
  companyType: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  enabledModules?: string[];
  theme?: {
    primaryColor?: string;
    secondaryColor?: string;
    logoUrl?: string;
  };
  admin?: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phone?: string;
  };
}

export interface CompaniesResponse {
  success: boolean;
  data: {
    companies: Company[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

export const companyAPI = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    companyType?: string;
    isActive?: boolean;
  }): Promise<CompaniesResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.companyType) queryParams.append('companyType', params.companyType);
    if (params?.isActive !== undefined) queryParams.append('isActive', params.isActive.toString());
    
    return apiClient.get(`/companies?${queryParams.toString()}`);
  },

  getById: async (id: string): Promise<{ success: boolean; data: { company: Company } }> => {
    return apiClient.get(`/companies/${id}`);
  },

  getMyCompany: async (): Promise<{ success: boolean; data: { company: Company } }> => {
    return apiClient.get('/companies/me');
  },

  create: async (data: CreateCompanyData): Promise<{ success: boolean; data: { company: Company } }> => {
    return apiClient.post('/companies', data);
  },

  update: async (id: string, data: Partial<CreateCompanyData>): Promise<{ success: boolean; data: { company: Company } }> => {
    return apiClient.put(`/companies/${id}`, data);
  },

  delete: async (id: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.delete(`/companies/${id}`);
  }
};
