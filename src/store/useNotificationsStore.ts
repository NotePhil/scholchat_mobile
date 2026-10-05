import { create } from 'zustand';
import { serverDateMs } from '../utils/dates';

export interface NotificationItem {
  id: string;
  /** Matches the real backend field names (Notification.java) — not "titre"/"lu"/"dateCreation", which never existed on the actual API response. */
  title?: string;
  message?: string;
  /**
   * Normalized read flag. The backend's Lombok `boolean isRead` field serializes
   * as JSON `read` (getter `isRead()`), so notificationService.normalize copies
   * `read` into this field — every consumer reads `isRead`.
   */
  isRead?: boolean;
  createdAt?: string;
  /** e.g. "MESSAGE_SENT", "CLASS_VALIDATED", "ACCESS_REQUEST" — lets a tap route somewhere useful instead of just marking read. */
  type?: string;
  relatedEntityId?: string | null;
  relatedEntityType?: string;
  actorId?: string;
  actorName?: string;
  [key: string]: unknown;
}

const countUnread = (items: NotificationItem[]) => items.filter((n) => !n.isRead).length;

const sortByDateDesc = (items: NotificationItem[]) =>
  [...items].sort((a, b) => {
    return serverDateMs(b.createdAt) - serverDateMs(a.createdAt);
  });

interface NotificationsState {
  items: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  /** Replaces the list; the unread badge is derived from it so the two never disagree. */
  setItems: (items: NotificationItem[]) => void;
  setUnreadCount: (count: number) => void;
  setLoading: (loading: boolean) => void;
  /** Adds a real-time (WebSocket) notification on top, ignoring duplicates. */
  upsert: (item: NotificationItem) => void;
  markReadLocally: (id: string) => void;
  markAllReadLocally: () => void;
  removeLocally: (id: string) => void;
  reset: () => void;
}

/**
 * Holds notification state shared across the header bell, the
 * notifications screen and the student/parent stats body.
 */
export const useNotificationsStore = create<NotificationsState>((set) => ({
  items: [],
  unreadCount: 0,
  isLoading: false,
  setItems: (items) => set({ items: sortByDateDesc(items), unreadCount: countUnread(items) }),
  setUnreadCount: (unreadCount) => set({ unreadCount: Math.max(0, unreadCount) }),
  setLoading: (isLoading) => set({ isLoading }),
  upsert: (item) =>
    set((state) => {
      if (!item?.id) return state;
      const exists = state.items.some((n) => n.id === item.id);
      const items = exists
        ? state.items.map((n) => (n.id === item.id ? { ...n, ...item } : n))
        : [item, ...state.items];
      return { items, unreadCount: countUnread(items) };
    }),
  markReadLocally: (id) =>
    set((state) => {
      const items = state.items.map((item) => (item.id === id ? { ...item, isRead: true } : item));
      return { items, unreadCount: countUnread(items) };
    }),
  markAllReadLocally: () =>
    set((state) => ({ items: state.items.map((item) => ({ ...item, isRead: true })), unreadCount: 0 })),
  removeLocally: (id) =>
    set((state) => {
      const items = state.items.filter((item) => item.id !== id);
      return { items, unreadCount: countUnread(items) };
    }),
  reset: () => set({ items: [], unreadCount: 0, isLoading: false }),
}));
