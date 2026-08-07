import { create } from 'zustand';

export interface NotificationItem {
  id: string;
  titre?: string;
  message?: string;
  lu?: boolean;
  dateCreation?: string;
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
      items: state.items.map((item) => (item.id === id ? { ...item, lu: true } : item)),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),
  reset: () => set({ items: [], unreadCount: 0, isLoading: false }),
}));
