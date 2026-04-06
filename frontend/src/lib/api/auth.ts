import { apiClient } from './client';

export interface LoginCredentials {
  phone?: string;
  email?: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    user: {
      id: string;
      userId: string;
      firstName: string;
      lastName: string;
      email?: string;
      phone: string;
      role: string;
      roleId?: string;
      companyId?: string;
      departmentId?: string;
      isActive: boolean;
      isSuperAdmin?: boolean;
      level?: number;
      scope?: 'platform' | 'company' | 'department' | 'subdepartment' | 'assigned';
      permissions?: { module: string; actions: string[] }[];
      filteredPermissions?: { module: string; actions: string[] }[];
      permissionsVersion?: number;
    };
    accessToken: string;
    refreshToken: string;
  };
}

export interface RegisterData {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  password?: string;
  role: string;
  companyId?: string;
  departmentId?: string;
}

export interface ForgotPasswordPayload {
  phone: string;
  deliveryChannel: 'email' | 'whatsapp';
}

export interface ResetPasswordPayload {
  phone: string;
  otp: string;
  password: string;
}

export const authAPI = {
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    return apiClient.post('/auth/login', credentials);
  },

  register: async (data: RegisterData): Promise<any> => {
    return apiClient.post('/auth/register', data);
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
  },

  getCurrentUser: () => {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    }
    return null;
  },

  verifySSOToken: async (ssoToken: string): Promise<LoginResponse> => {
    return apiClient.post('/auth/sso/login', { ssoToken });
  },

  saveUser: (user: any) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(user));
    }
  },
  
  getCurrentProfile: async (): Promise<any> => {
    return apiClient.get('/auth/me');
  },

  forgotPassword: async (payload: ForgotPasswordPayload): Promise<any> => {
    return apiClient.post('/auth/forgot-password', payload);
  },

  resetPassword: async (payload: ResetPasswordPayload): Promise<any> => {
    return apiClient.post('/auth/reset-password', payload);
  },
};
