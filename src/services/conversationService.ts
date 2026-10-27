import { apiClient, extractErrorMessage } from './api/client';
import { translate } from '../i18n';
import { MessageMedia, MessageMediaPayload } from '../types';

/**
 * WhatsApp-like chat API (backend ConversationsApi): conversations between
 * participants, paged message history, replies, read receipts.
 * Live events still arrive on /topic/messages/{userId} (see useMessagesRealtime).
 */

export type ConversationType = 'DIRECT' | 'GROUPE';

export interface ConversationParticipant {
  id: string;
  prenom?: string | null;
  nom?: string | null;
  typeUtilisateur?: string | null;
  lastReadAt?: string | null;
}

export interface ConversationLastMessage {
  id: string;
  contenu?: string | null;
  expediteurId?: string | null;
  expediteurPrenom?: string | null;
  expediteurNom?: string | null;
  date?: string | null;
  supprime?: boolean;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  titre?: string | null;
  classeId?: string | null;
  createdBy?: string | null;
  createdAt?: string | null;
  lastMessageAt?: string | null;
  participants: ConversationParticipant[];
  dernierMessage?: ConversationLastMessage | null;
  nonLus: number;
  muted: boolean;
  /** Starred by me. */
  favori?: boolean;
  /** Contains a message I starred. */
  contientFavori?: boolean;
  /** "Marquer comme non lu". */
  marqueNonLu?: boolean;
  /** Class, group or general broadcast conversation ("Général" filter). */
  general?: boolean;
  /** CLASSE | GENERAL | GROUPE | null */
  categorie?: 'CLASSE' | 'GENERAL' | 'GROUPE' | null;
  /** Trash only: date it was deleted for me. */
  supprimeLe?: string | null;
  /** Trash only: a newer message made it reappear; only the older history is in the trash. */
  reapparue?: boolean;
}

export interface ChatReplyPreview {
  id: string;
  expediteurId?: string | null;
  expediteurNom?: string | null;
  expediteurPrenom?: string | null;
  extrait?: string | null;
  supprime?: boolean;
}

export type ChatMessageStatus = 'SENT' | 'DELIVERED' | 'READ';

export interface ChatMessage {
  id: string;
  conversationId: string;
  expediteurId: string;
  expediteurNom?: string | null;
  expediteurPrenom?: string | null;
  contenu?: string | null;
  medias?: MessageMedia[];
  date: string;
  replyTo?: ChatReplyPreview | null;
  supprimePourTous?: boolean;
  statut?: ChatMessageStatus | null;
  lu?: boolean;
  /** Starred by me. */
  favori?: boolean;
  /** Trash only. */
  supprimeLe?: string | null;
  conversationTitre?: string | null;
  conversationType?: ConversationType | null;
  /** Client-only: optimistic message not yet confirmed by the server. */
  pending?: boolean;
}

export interface ChatMessagePage {
  messages: ChatMessage[];
  hasMore: boolean;
}

/** My trash: conversations and messages deleted for me. */
export interface ChatTrash {
  conversations: Conversation[];
  messages: ChatMessage[];
}

export interface SendChatMessagePayload {
  contenu?: string;
  medias?: MessageMediaPayload[];
  replyToId?: string | null;
}

/** Event pushed on /topic/messages/{userId} for the chat. */
export interface ChatRealtimeEvent {
  type: 'NEW_MESSAGE' | 'MESSAGE_DELETED' | 'MESSAGE_RESTORED' | 'CONVERSATION_READ' | string;
  message?: { id?: string; [key: string]: any } | null;
  conversationId?: string | null;
  chat?: ChatMessage | null;
  lecteurId?: string | null;
  luJusqua?: string | null;
  pourTous?: boolean | null;
}

const fail = (error: unknown, key: Parameters<typeof translate>[0]) => new Error(extractErrorMessage(error, translate(key)));

export const conversationService = {
  list: async (): Promise<Conversation[]> => {
    try {
      const { data } = await apiClient.get<Conversation[]>('/conversations');
      return Array.isArray(data) ? data : [];
    } catch (error) {
      throw fail(error, 'chat.errors.load');
    }
  },

  get: async (id: string): Promise<Conversation> => {
    try {
      const { data } = await apiClient.get<Conversation>(`/conversations/${id}`);
      return data;
    } catch (error) {
      throw fail(error, 'chat.errors.load');
    }
  },

  byMessage: async (messageId: string): Promise<Conversation> => {
    try {
      const { data } = await apiClient.get<Conversation>(`/conversations/par-message/${messageId}`);
      return data;
    } catch (error) {
      throw fail(error, 'chat.errors.load');
    }
  },

  unreadCount: async (): Promise<number> => {
    try {
      const { data } = await apiClient.get<{ total?: number }>('/conversations/non-lus/count');
      return data?.total ?? 0;
    } catch (error) {
      throw fail(error, 'chat.errors.load');
    }
  },

  create: async (participantIds: string[], titre?: string): Promise<Conversation> => {
    try {
      const { data } = await apiClient.post<Conversation>('/conversations', {
        participantIds,
        ...(titre?.trim() ? { titre: titre.trim() } : {}),
      });
      return data;
    } catch (error) {
      throw fail(error, 'chat.errors.create');
    }
  },

  messages: async (id: string, before?: string | null, size = 30): Promise<ChatMessagePage> => {
    try {
      const { data } = await apiClient.get<ChatMessagePage>(`/conversations/${id}/messages`, {
        params: { size, ...(before ? { before } : {}) },
      });
      return { messages: Array.isArray(data?.messages) ? data.messages : [], hasMore: !!data?.hasMore };
    } catch (error) {
      throw fail(error, 'chat.errors.load');
    }
  },

  send: async (id: string, payload: SendChatMessagePayload): Promise<ChatMessage> => {
    try {
      const { data } = await apiClient.post<ChatMessage>(`/conversations/${id}/messages`, {
        contenu: payload.contenu ?? '',
        medias: payload.medias ?? [],
        ...(payload.replyToId ? { replyToId: payload.replyToId } : {}),
      });
      return data;
    } catch (error) {
      throw fail(error, 'chat.errors.send');
    }
  },

  markRead: async (id: string): Promise<{ conversationId: string; lastReadAt?: string | null }> => {
    try {
      const { data } = await apiClient.post(`/conversations/${id}/lu`);
      return data;
    } catch (error) {
      throw fail(error, 'chat.errors.generic');
    }
  },

  deleteMessage: async (id: string, messageId: string, pourTous: boolean): Promise<void> => {
    try {
      await apiClient.delete(`/conversations/${id}/messages/${messageId}`, { params: { pourTous } });
    } catch (error) {
      throw fail(error, 'chat.errors.delete');
    }
  },

  hide: async (id: string): Promise<void> => {
    try {
      await apiClient.delete(`/conversations/${id}`);
    } catch (error) {
      throw fail(error, 'chat.errors.delete');
    }
  },

  /** Star / unstar the conversation (for me only). */
  setFavorite: async (id: string, favori: boolean): Promise<Conversation> => {
    try {
      const { data } = await apiClient.put<Conversation>(`/conversations/${id}/favori`, undefined, { params: { favori } });
      return data;
    } catch (error) {
      throw fail(error, 'chat.errors.generic');
    }
  },

  /** "Marquer comme non lu" (cleared when the conversation is read). */
  markUnread: async (id: string): Promise<Conversation> => {
    try {
      const { data } = await apiClient.put<Conversation>(`/conversations/${id}/non-lu`);
      return data;
    } catch (error) {
      throw fail(error, 'chat.errors.generic');
    }
  },

  /** Star / unstar one message (legacy per-user status endpoint). */
  setMessageFavorite: async (messageId: string, userId: string, favori: boolean): Promise<void> => {
    try {
      await apiClient.post(`/messages/${messageId}/statut/${userId}/favori`, undefined, { params: { favori } });
    } catch (error) {
      throw fail(error, 'chat.errors.generic');
    }
  },

  trash: async (): Promise<ChatTrash> => {
    try {
      const { data } = await apiClient.get<Partial<ChatTrash>>('/conversations/corbeille');
      return {
        conversations: Array.isArray(data?.conversations) ? data!.conversations! : [],
        messages: Array.isArray(data?.messages) ? data!.messages! : [],
      };
    } catch (error) {
      throw fail(error, 'chat.errors.trash');
    }
  },

  restoreConversation: async (id: string): Promise<Conversation> => {
    try {
      const { data } = await apiClient.post<Conversation>(`/conversations/${id}/restaurer`);
      return data;
    } catch (error) {
      throw fail(error, 'chat.errors.restore');
    }
  },

  purgeConversation: async (id: string): Promise<void> => {
    try {
      await apiClient.delete(`/conversations/${id}/definitif`);
    } catch (error) {
      throw fail(error, 'chat.errors.delete');
    }
  },

  restoreMessage: async (messageId: string): Promise<void> => {
    try {
      await apiClient.post(`/conversations/corbeille/messages/${messageId}/restaurer`);
    } catch (error) {
      throw fail(error, 'chat.errors.restore');
    }
  },

  purgeMessage: async (messageId: string): Promise<void> => {
    try {
      await apiClient.delete(`/conversations/corbeille/messages/${messageId}`);
    } catch (error) {
      throw fail(error, 'chat.errors.delete');
    }
  },

  emptyTrash: async (): Promise<void> => {
    try {
      await apiClient.delete('/conversations/corbeille');
    } catch (error) {
      throw fail(error, 'chat.errors.delete');
    }
  },

  setMuted: async (id: string, muted: boolean): Promise<Conversation> => {
    try {
      const { data } = await apiClient.put<Conversation>(`/conversations/${id}/muet`, undefined, { params: { muted } });
      return data;
    } catch (error) {
      throw fail(error, 'chat.errors.generic');
    }
  },
};
