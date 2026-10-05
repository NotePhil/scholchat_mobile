import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => Promise<void>;
  toggleMode: () => Promise<void>;
  loadMode: () => Promise<void>;
}

const STORAGE_KEY = 'app_theme_mode';

/** Mirrors useLanguageStore.ts's shape exactly (zustand + AsyncStorage, load/set/toggle). */
export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'light',

  loadMode: async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      // Light by default; dark only once the user picks it in the app
      // (the phone's own dark-mode setting is intentionally not followed).
      set({ mode: saved === 'dark' ? 'dark' : 'light' });
    } catch {
      // best-effort
    }
  },

  setMode: async (mode: ThemeMode) => {
    set({ mode });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // best-effort
    }
  },

  toggleMode: async () => {
    const next: ThemeMode = get().mode === 'dark' ? 'light' : 'dark';
    await get().setMode(next);
  },
}));
