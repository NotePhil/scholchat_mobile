import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SupportedLanguage = 'fr' | 'en';

interface LanguageState {
  currentLanguage: SupportedLanguage;
  /** True once loadLanguage() has resolved (saved choice or device locale applied). */
  loaded: boolean;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  toggleLanguage: () => Promise<void>;
  loadLanguage: () => Promise<void>;
}

const STORAGE_KEY = 'app_language';

/** Device language via Intl (no native module): 'en' for English locales, 'fr' otherwise. */
const deviceLanguage = (): SupportedLanguage => {
  try {
    const locale =
      typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function'
        ? Intl.DateTimeFormat().resolvedOptions().locale
        : '';
    return /^en\b/i.test(locale || '') ? 'en' : 'fr';
  } catch {
    return 'fr';
  }
};

export const useLanguageStore = create<LanguageState>((set, get) => ({
  currentLanguage: 'fr',
  loaded: false,

  loadLanguage: async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved === 'fr' || saved === 'en') {
        set({ currentLanguage: saved, loaded: true });
        return;
      }
      set({ currentLanguage: deviceLanguage(), loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  setLanguage: async (lang: SupportedLanguage) => {
    set({ currentLanguage: lang, loaded: true });
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
