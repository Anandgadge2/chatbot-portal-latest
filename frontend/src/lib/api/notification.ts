import { apiClient } from './client';

export interface InAppNotification {
  _id: string;
  grievanceId?: string;
  eventType:
    | 'GRIEVANCE_RECEIVED'
    | 'GRIEVANCE_REMINDER'
    | 'GRIEVANCE_REVERTED'
    | 'GRIEVANCE_ASSIGNED'
    | 'GRIEVANCE_REASSIGNED'
    | 'GRIEVANCE_STATUS_UPGRADED';
  title: string;
  message: string;
  meta?: Record<string, any>;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
  grievanceObjectId?: string;
}

export interface NotificationApiMeta {
  supported: boolean;
  message?: string;
}

const isNotificationRouteMissing = (error: any) => {
  const status = error?.response?.status;
  const message = String(error?.response?.data?.message || '').toLowerCase();
  return status === 404 && message.includes('/api/notifications');
};

export const notificationAPI = {
  getAll: async (params?: { page?: number; limit?: number; isRead?: boolean }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', String(params.page));
    if (params?.limit) queryParams.append('limit', String(params.limit));
    if (typeof params?.isRead === 'boolean') queryParams.append('isRead', String(params.isRead));
    try {
      const response = await apiClient.get<{ success: boolean; data: { notifications: InAppNotification[]; pagination: any } }>(`/notifications?${queryParams.toString()}`);
      return { ...response, meta: { supported: true } as NotificationApiMeta };
    } catch (error: any) {
      if (isNotificationRouteMissing(error)) {
        return {
          success: false,
          data: { notifications: [], pagination: null },
          meta: {
            supported: false,
            message: 'Notification API is not available in this deployment.',
          } as NotificationApiMeta,
        };
      }
      throw error;
    }
  },
  getUnreadCount: async () => {
    try {
      const response = await apiClient.get<{ success: boolean; data: { unreadCount: number } }>('/notifications/unread-count');
      return { ...response, meta: { supported: true } as NotificationApiMeta };
    } catch (error: any) {
      if (isNotificationRouteMissing(error)) {
        return {
          success: false,
          data: { unreadCount: 0 },
          meta: {
            supported: false,
            message: 'Notification API is not available in this deployment.',
          } as NotificationApiMeta,
        };
      }
      throw error;
    }
  },
  markRead: async (id: string) =>
    apiClient.put<{ success: boolean }>(`/notifications/${id}/read`),
  markAllRead: async () =>
    apiClient.put<{ success: boolean; data: { updatedCount: number } }>('/notifications/mark-all-read'),
};
