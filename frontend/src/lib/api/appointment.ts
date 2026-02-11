import { apiClient } from './client';

export interface Appointment {
  _id: string;
  appointmentId: string;
  companyId: string | { _id: string; name: string };
  departmentId?: string | { _id: string; name: string };
  citizenName: string;
  citizenPhone: string;
  citizenWhatsApp?: string;
  citizenEmail?: string;
  purpose: string;
  appointmentDate: string;
  appointmentTime: string;
  duration?: number;
  status: string;
  assignedTo?: string | { _id: string; firstName: string; lastName: string };
  statusHistory?: Array<{
    status: string;
    changedBy?: string | { _id: string; firstName: string; lastName: string };
    changedAt: string;
    remarks?: string;
  }>;
  location?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  timeline?: Array<{
    action: string;
    details?: any;
    performedBy?: string | { _id: string; firstName: string; lastName: string; role: string };
    timestamp: string;
  }>;
}

export interface CreateAppointmentData {
  companyId: string;
  departmentId?: string;
  citizenName: string;
  citizenPhone: string;
  citizenWhatsApp?: string;
  citizenEmail?: string;
  purpose: string;
  appointmentDate: string;
  appointmentTime: string;
  duration?: number;
  location?: string;
}

export interface AppointmentsResponse {
  success: boolean;
  data: {
    appointments: Appointment[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

export const appointmentAPI = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    companyId?: string;
    departmentId?: string;
    assignedTo?: string;
    date?: string;
  }): Promise<AppointmentsResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.companyId) queryParams.append('companyId', params.companyId);
    if (params?.departmentId) queryParams.append('departmentId', params.departmentId);
    if (params?.assignedTo) queryParams.append('assignedTo', params.assignedTo);
    if (params?.date) queryParams.append('date', params.date);
    
    return apiClient.get(`/appointments?${queryParams.toString()}`);
  },

  getById: async (id: string): Promise<{ success: boolean; data: { appointment: Appointment } }> => {
    return apiClient.get(`/appointments/${id}`);
  },

  create: async (data: CreateAppointmentData): Promise<{ success: boolean; data: { appointment: Appointment } }> => {
    return apiClient.post('/appointments', data);
  },

  updateStatus: async (id: string, status: string, remarks?: string): Promise<{ success: boolean; data: { appointment: Appointment } }> => {
    return apiClient.put(`/appointments/${id}/status`, { status, remarks });
  },

  assign: async (id: string, assignedTo: string, departmentId?: string): Promise<{ success: boolean; data: { appointment: Appointment } }> => {
    return apiClient.put(`/assignments/appointment/${id}/assign`, { assignedTo, departmentId });
  },

  update: async (id: string, data: Partial<CreateAppointmentData>): Promise<{ success: boolean; data: { appointment: Appointment } }> => {
    return apiClient.put(`/appointments/${id}`, data);
  },

  delete: async (id: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.delete(`/appointments/${id}`);
  },

  deleteBulk: async (ids: string[]): Promise<{ success: boolean; message: string; data: { deletedCount: number } }> => {
    return apiClient.delete('/appointments/bulk', { ids });
  }
};
