import { create } from 'zustand';

export interface NotificationItem {
  id: string;
  /** Matches the real backend field names (Notification.java) — not "titre"/"lu"/"dateCreation", which never existed on the actual API response. */
  title?: string;
  message?: string;
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

interface NotificationsState {
  items: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  setItems: (items: NotificationItem[]) => void;
  setUnreadCount: (count: number) => void;
  setLoading: (loading: boolean) => void;
  markReadLocally: (id: string) => void;
  reset: () => void;
}

/**
 * Holds notification state shared across the header bell and the
 * notifications screen. Populated by notificationService (added in Phase 2)
 * — this store just owns the reactive shape so multiple screens agree.
 */
export const useNotificationsStore = create<NotificationsState>((set) => ({
  items: [],
  unreadCount: 0,
  isLoading: false,
  setItems: (items) => set({ items }),
  setUnreadCount: (unreadCount) => set({ unreadCount }),
  setLoading: (isLoading) => set({ isLoading }),
  markReadLocally: (id) =>
    set((state) => ({
      items: state.items.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),
  reset: () => set({ items: [], unreadCount: 0, isLoading: false }),
}));
