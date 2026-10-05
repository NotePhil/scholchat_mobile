import { apiClient, extractErrorMessage } from './client';
import { ApiSuccess } from '../../types';
import type { NotificationItem } from '../../store/useNotificationsStore';
import { toServerDateTime } from '../../utils/dates';

/**
 * Backend (Notification.java / NotificationEntity) serializes its Lombok
 * `boolean isRead` as JSON `read`, and `createdAt` as an ISO instant (older
 * servers: a zone-less LocalDateTime that may carry microseconds). Normalize once here so every
 * screen can rely on `isRead` and a Hermes-parsable `createdAt`.
 */
export const normalizeNotification = (raw: Record<string, unknown>): NotificationItem => {
  const read = raw.read ?? raw.isRead;
  // Accepts ISO instants, legacy naive strings (≥6 fractional digits, which
  // Hermes rejects) and Jackson timestamp arrays; re-emitted as ISO "…Z".
  const createdAt = toServerDateTime(raw.createdAt) ?? (typeof raw.createdAt === 'string' ? raw.createdAt : undefined);
  return {
    ...(raw as NotificationItem),
    id: String(raw.id ?? ''),
    isRead: read === true,
    createdAt,
  };
};

const normalizeList = (data: unknown): NotificationItem[] =>
  Array.isArray(data) ? data.map((n) => normalizeNotification(n as Record<string, unknown>)) : [];

export const notificationService = {
  getAll: async (): Promise<NotificationItem[]> => {
    try {
      const { data } = await apiClient.get('/notifications');
      return normalizeList(data);
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des notifications.'));
    }
  },

  getUnread: async (): Promise<NotificationItem[]> => {
    try {
      const { data } = await apiClient.get('/notifications/unread');
      return normalizeList(data);
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
