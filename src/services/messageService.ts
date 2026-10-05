import { apiClient, extractErrorMessage } from './api/client';
import { ApiSuccess, MessageContact, MessageContactClass, MessageItem, MessageMediaPayload } from '../types';

export type DeleteScope = 'me' | 'everyone';

/** Utilisateurs payload for POST /messages (Jackson "type" discriminator + non-null nom/prenom). */
export interface MessageUserPayload {
  type: string;
  id: string;
  nom: string;
  prenom: string;
  email?: string;
  [key: string]: unknown;
}

/** Body of POST /messages — matches the Messages.java model. */
export interface IndividualMessagePayload {
  objet?: string;
  contenu?: string;
  dateCreation?: string;
  etat?: string;
  /** Optional and ignored — the server uses the JWT user. */
  expediteur?: MessageUserPayload;
  destinataires: MessageUserPayload[];
  medias?: MessageMediaPayload[];
}

/** Body of POST /messages/group — matches GroupMessageDto.java field names exactly. */
export interface GroupMessagePayload {
  classIds: string[];
  objet?: string;
  content?: string;
  /** Optional and ignored — the server uses the JWT user. */
  senderId?: string;
  copieRecipientIds?: string[];
  medias?: MessageMediaPayload[];
}

/**
 * Wraps the endpoints that actually exist in MessagesApi.java. (Calls to
 * /messages/conversation, /messages/bulk, PUT /messages/{id} and paged/search
 * GET /messages used to live here, ported from web's MessageService.js, but
 * the backend has none of them.)
 */
export const messageService = {
  sendIndividualMessage: async (payload: IndividualMessagePayload): Promise<MessageItem> => {
    try {
      const { data } = await apiClient.post<MessageItem>('/messages', payload);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de l'envoi du message."));
    }
  },

  sendGroupMessage: async (payload: GroupMessagePayload): Promise<MessageItem> => {
    try {
      const { data } = await apiClient.post<MessageItem>('/messages/group', payload);
      return data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Échec de l'envoi du message de groupe."));
    }
  },

  getSentMessages: async (userId: string): Promise<MessageItem[]> => {
    try {
      const { data } = await apiClient.get<MessageItem[]>(`/messages/utilisateur/${userId}/sent`);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des messages envoyés.'));
    }
  },

  getReceivedMessages: async (userId: string): Promise<MessageItem[]> => {
    try {
      const { data } = await apiClient.get<MessageItem[]>(`/messages/utilisateur/${userId}/received`);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des messages reçus.'));
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

  /**
   * DELETE /messages/{id}?scope=me|everyone. `me` hides it for the caller only
   * (goes to their trash); `everyone` is sender-only (403 otherwise).
   */
  remove: async (id: string, scope: DeleteScope = 'me'): Promise<ApiSuccess> => {
    try {
      await apiClient.delete(`/messages/${id}`, { params: { scope } });
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la suppression du message.'));
    }
  },

  /** POST /messages/bulk-delete — whole-conversation delete. With `everyone`, only the caller's sent messages are deleted for all. */
  bulkDelete: async (messageIds: string[], scope: DeleteScope = 'me'): Promise<number> => {
    try {
      const { data } = await apiClient.post<{ deleted?: number }>('/messages/bulk-delete', { messageIds, scope });
      return data?.deleted ?? 0;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec de la suppression de la conversation.'));
    }
  },

  /** GET /messages/utilisateur/{id}/trash — the caller's own trash (newest first). */
  getTrash: async (userId: string): Promise<MessageItem[]> => {
    try {
      const { data } = await apiClient.get<MessageItem[]>(`/messages/utilisateur/${userId}/trash`);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement de la corbeille.'));
    }
  },

  /** DELETE /messages/trash/cleanup — permanently empties the caller's trash only. */
  emptyTrash: async (): Promise<ApiSuccess> => {
    try {
      await apiClient.delete('/messages/trash/cleanup');
      return { success: true };
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du vidage de la corbeille.'));
    }
  },

  /** GET /messages/contacts — people the caller may message. */
  getContacts: async (): Promise<MessageContact[]> => {
    try {
      const { data } = await apiClient.get<MessageContact[]>('/messages/contacts');
      return Array.isArray(data) ? data : [];
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des contacts.'));
    }
  },

  /** GET /messages/contacts/classes — classes the caller may group-message. */
  getContactClasses: async (): Promise<MessageContactClass[]> => {
    try {
      const { data } = await apiClient.get<MessageContactClass[]>('/messages/contacts/classes');
      return Array.isArray(data) ? data : [];
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Échec du chargement des classes.'));
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
};
