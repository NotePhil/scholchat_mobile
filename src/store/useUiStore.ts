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
}

export const useUiStore = create<UiState>((set) => ({
  theme: 'light',
  language: 'fr',
  activeSection: 'dashboard',
  setTheme: (theme) => set({ theme }),
  setLanguage: (language) => set({ language }),
  setActiveSection: (activeSection) => set({ activeSection }),
}));
