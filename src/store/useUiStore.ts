import { create } from 'zustand';

export type AppLanguage = 'fr' | 'en';
export type AppTheme = 'light' | 'dark';

interface UiState {
  theme: AppTheme;
  language: AppLanguage;
  /** Which bottom-tab/section is active in the current role navigator. */
  activeSection: string;
  setTheme: (theme: AppTheme) => void;
  setLanguage: (language: AppLanguage) => void;
  setActiveSection: (section: string) => void;
  /**
   * A tab switch requested from OUTSIDE the current dashboard instance (e.g.
   * tapping a message notification while on the separate stack-pushed
   * NotificationsScreen). Each role Dashboard is a local-state tab switcher,
   * not a set of navigable routes, so there's no `navigation.navigate(tab)`
   * to call from elsewhere — this flag is the bridge: the still-mounted
   * Dashboard underneath picks it up in a focus effect and clears it.
   */
  pendingTab: string | null;
  requestTab: (tab: string) => void;
  clearPendingTab: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  theme: 'light',
  language: 'fr',
  activeSection: 'dashboard',
  pendingTab: null,
  setTheme: (theme) => set({ theme }),
  setLanguage: (language) => set({ language }),
  setActiveSection: (activeSection) => set({ activeSection }),
  requestTab: (pendingTab) => set({ pendingTab }),
  clearPendingTab: () => set({ pendingTab: null }),
}));
