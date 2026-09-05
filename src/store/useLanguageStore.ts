import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SupportedLanguage = 'fr' | 'en';

interface LanguageState {
  currentLanguage: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  toggleLanguage: () => Promise<void>;
  loadLanguage: () => Promise<void>;
}

const STORAGE_KEY = 'app_language';

export const useLanguageStore = create<LanguageState>((set, get) => ({
  currentLanguage: 'fr',

  loadLanguage: async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved === 'fr' || saved === 'en') {
        set({ currentLanguage: saved });
      }
    } catch {
      // best-effort
    }
  },

  setLanguage: async (lang: SupportedLanguage) => {
    set({ currentLanguage: lang });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // best-effort
    }
  },

  toggleLanguage: async () => {
    const next: SupportedLanguage = get().currentLanguage === 'fr' ? 'en' : 'fr';
    await get().setLanguage(next);
  },
}));
