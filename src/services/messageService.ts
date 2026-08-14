import { apiClient, extractErrorMessage } from './api/client';
import { ApiSuccess, MessageItem } from '../types';

export const messageService = {
  sendIndividualMessage: async (messageData: Partial<MessageItem>): Promise<MessageItem> => {
    try {
      const { data } = await apiClient.post<MessageItem>('/messages', messageData);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de l'envoi du message."));
    }
  },

  sendGroupMessage: async (messageData: Partial<MessageItem>): Promise<MessageItem> => {
    try {
      const { data } = await apiClient.post<MessageItem>('/messages/group', messageData);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de l'envoi du message de groupe."));
    }
  },

  getSentMessages: async (userId: string): Promise<MessageItem[]> => {
    try {
      const { data } = await apiClient.get<MessageItem[]>(`/messages/utilisateur/${userId}/sent`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des messages envoyés.'));
    }
  },

  getReceivedMessages: async (userId: string): Promise<MessageItem[]> => {
    try {
      const { data } = await apiClient.get<MessageItem[]>(`/messages/utilisateur/${userId}/received`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des messages reçus.'));
    }
  },

  // --- Remaining endpoints from scholchat_front's MessageService.js ---

  getAll: async (page = 0, limit = 20): Promise<Record<string, unknown>> => {
    try {
      const { data } = await apiClient.get('/messages', { params: { page, limit } });
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des messages.'));
    }
  },

  search: async (query: string, page = 0, limit = 20): Promise<Record<string, unknown>> => {
    try {
      const { data } = await apiClient.get('/messages', { params: { search: query, page, limit } });
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la recherche.'));
    }
  },

  getById: async (id: string): Promise<MessageItem> => {
    try {
      const { data } = await apiClient.get<MessageItem>(`/messages/${id}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement du message.'));
    }
  },

  createSimpleMessage: async (messageData: Partial<MessageItem>): Promise<MessageItem> => {
    try {
      const { data } = await apiClient.post<MessageItem>('/messages', messageData);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de l'envoi du message."));
    }
  },

  update: async (id: string, messageData: Partial<MessageItem>): Promise<MessageItem> => {
    try {
      const { data } = await apiClient.put<MessageItem>(`/messages/${id}`, messageData);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la mise à jour du message.'));
    }
  },

  /** Soft-delete — moves the message to trash (MessagesEntity.deleted=true), not a hard delete. */
  remove: async (id: string): Promise<ApiSuccess> => {
    try {
      await apiClient.delete(`/messages/${id}`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la suppression du message.'));
    }
  },

  /** GET /messages/utilisateur/{id}/trash — only messages the user themself sent and then deleted. */
  getTrash: async (userId: string): Promise<MessageItem[]> => {
    try {
      const { data } = await apiClient.get<MessageItem[]>(`/messages/utilisateur/${userId}/trash`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement de la corbeille.'));
    }
  },

  restore: async (id: string): Promise<ApiSuccess> => {
    try {
      await apiClient.post(`/messages/${id}/restore`);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la restauration du message.'));
    }
  },

  getConversation: async (user1: string, user2: string): Promise<MessageItem[]> => {
    try {
      const { data } = await apiClient.get<MessageItem[]>('/messages/conversation', {
        params: { user1, user2 },
      });
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement de la conversation.'));
    }
  },

  setRead: async (messageId: string, userId: string, lu = true): Promise<ApiSuccess> => {
    try {
      await apiClient.post(`/messages/${messageId}/statut/${userId}/lu`, undefined, { params: { lu } });
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la mise à jour du statut.'));
    }
  },

  setFavorite: async (messageId: string, userId: string, favori = true): Promise<ApiSuccess> => {
    try {
      await apiClient.post(`/messages/${messageId}/statut/${userId}/favori`, undefined, { params: { favori } });
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la mise à jour du statut.'));
    }
  },

  getStatus: async (messageId: string, userId: string): Promise<Record<string, unknown>> => {
    try {
      const { data } = await apiClient.get(`/messages/${messageId}/statut/${userId}`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement du statut.'));
    }
  },

  getFavorites: async (userId: string): Promise<MessageItem[]> => {
    try {
      const { data } = await apiClient.get<MessageItem[]>(`/messages/utilisateur/${userId}/favoris`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des favoris.'));
    }
  },

  getUnread: async (userId: string): Promise<MessageItem[]> => {
    try {
      const { data } = await apiClient.get<MessageItem[]>(`/messages/utilisateur/${userId}/non-lus`);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des messages non lus.'));
    }
  },

  countUnread: async (userId: string): Promise<number> => {
    try {
      const { data } = await apiClient.get<{ count?: number } | number>(
        `/messages/utilisateur/${userId}/non-lus/count`
      );
      return typeof data === 'number' ? data : data?.count ?? 0;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement du compteur.'));
    }
  },

  sendBulk: async (payload: Record<string, unknown>): Promise<ApiSuccess> => {
    try {
      await apiClient.post('/messages/bulk', payload);
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de l'envoi groupé."));
    }
  },

  deleteMultiple: async (messageIds: string[]): Promise<ApiSuccess> => {
    try {
      await apiClient.delete('/messages/bulk', { data: { messageIds } });
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la suppression groupée.'));
    }
  },
};
