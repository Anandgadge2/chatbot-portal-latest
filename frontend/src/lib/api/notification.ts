import { apiClient } from './client';

export interface InAppNotification {
  _id: string;
  grievanceId?: string;
  eventType: 'GRIEVANCE_RECEIVED' | 'GRIEVANCE_REMINDER' | 'GRIEVANCE_REVERTED';
  title: string;
  message: string;
  meta?: Record<string, any>;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export const notificationAPI = {
  getAll: async (params?: { page?: number; limit?: number; isRead?: boolean }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', String(params.page));
    if (params?.limit) queryParams.append('limit', String(params.limit));
    if (typeof params?.isRead === 'boolean') queryParams.append('isRead', String(params.isRead));
    return apiClient.get<{ success: boolean; data: { notifications: InAppNotification[]; pagination: any } }>(`/notifications?${queryParams.toString()}`);
  },
  getUnreadCount: async () =>
    apiClient.get<{ success: boolean; data: { unreadCount: number } }>('/notifications/unread-count'),
  markRead: async (id: string) =>
    apiClient.put<{ success: boolean }>(`/notifications/${id}/read`),
  markAllRead: async () =>
    apiClient.put<{ success: boolean; data: { updatedCount: number } }>('/notifications/mark-all-read'),
};
