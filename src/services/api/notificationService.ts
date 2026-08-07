import { apiClient, extractErrorMessage } from './client';
import { ApiSuccess } from '../../types';
import { NotificationItem } from '../../store/useNotificationsStore';

export const notificationService = {
  getAll: async (): Promise<NotificationItem[]> => {
    try {
      const { data } = await apiClient.get<NotificationItem[]>('/notifications');
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des notifications.'));
    }
  },

  getUnread: async (): Promise<NotificationItem[]> => {
    try {
      const { data } = await apiClient.get<NotificationItem[]>('/notifications/unread');
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des notifications.'));
    }
  },

  getUnreadCount: async (): Promise<number> => {
    try {
      const { data } = await apiClient.get<{ count?: number } | number>('/notifications/count');
      return typeof data === 'number' ? data : data?.count ?? 0;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement du compteur.'));
    }
  },

  markAsRead: async (id: string): Promise<ApiSuccess> => {
    try {
      await apiClient.patch(`/notifications/${id}/read`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la mise à jour de la notification.'));
    }
  },

  markAllAsRead: async (): Promise<ApiSuccess> => {
    try {
      await apiClient.patch('/notifications/read-all');
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la mise à jour des notifications.'));
    }
  },

  remove: async (id: string): Promise<ApiSuccess> => {
    try {
      await apiClient.delete(`/notifications/${id}`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la suppression de la notification.'));
    }
  },

  removeAll: async (): Promise<ApiSuccess> => {
    try {
      await apiClient.delete('/notifications/all');
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la suppression des notifications.'));
    }
  },
};
