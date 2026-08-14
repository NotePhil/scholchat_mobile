import { create } from 'zustand';
import { messageService } from '../services/messageService';

interface MessagesState {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  /** Refreshes the real unread-received count from /messages/utilisateur/{id}/non-lus/count. */
  refresh: (userId?: string | null) => Promise<void>;
}

/**
 * Holds the unread-message count shared between the footer nav badge and the
 * Messages screen, mirroring useNotificationsStore's shape. A dedicated
 * backend count endpoint already exists (messageService.countUnread), so
 * this is a lightweight refresh rather than loading the full message list.
 */
export const useMessagesStore = create<MessagesState>((set) => ({
  unreadCount: 0,
  setUnreadCount: (unreadCount) => set({ unreadCount }),
  refresh: async (userId) => {
    if (!userId) return;
    try {
      const count = await messageService.countUnread(userId);
      set({ unreadCount: count });
    } catch {
      // best-effort — leave the last known count on failure
    }
  },
}));
