import { create } from 'zustand';
import { messageService } from '../services/messageService';
import { MessageRealtimeEvent } from '../types';

/** What the open Messages screen receives: a pushed event, or a "re-fetch everything once" after a reconnect. */
export type MessagesStreamEvent = MessageRealtimeEvent | { type: 'RESYNC' };
type MessagesStreamListener = (event: MessagesStreamEvent) => void;

const listeners = new Set<MessagesStreamListener>();

interface MessagesState {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  /** Refreshes the real unread-received count from /messages/utilisateur/{id}/non-lus/count. */
  refresh: (userId?: string | null) => Promise<void>;
  reset: () => void;
}

/**
 * Holds the unread-message count shared between the footer nav badge and the
 * Messages screen. Kept live app-wide by useMessagesRealtime (mounted in
 * AppHeader), which also fans pushed events out to `subscribeMessagesStream`
 * listeners (the open Messages screen) — no polling.
 */
export const useMessagesStore = create<MessagesState>((set) => ({
  unreadCount: 0,
  setUnreadCount: (unreadCount) => set({ unreadCount: Math.max(0, unreadCount) }),
  refresh: async (userId) => {
    if (!userId) return;
    try {
      const count = await messageService.countUnread(userId);
      set({ unreadCount: count });
    } catch {
      // best-effort — leave the last known count on failure
    }
  },
  reset: () => set({ unreadCount: 0 }),
}));

export const subscribeMessagesStream = (listener: MessagesStreamListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const emitMessagesStream = (event: MessagesStreamEvent) => {
  listeners.forEach((l) => {
    try {
      l(event);
    } catch {
      // consumer error — ignore
    }
  });
};
