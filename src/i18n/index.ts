/**
 * Tiny in-house i18n (no dependency).
 *
 * - Dictionaries: ./fr.ts (source of truth) and ./en.ts (typed `Dictionary`, so
 *   TypeScript fails if a key is missing or extra in English).
 * - Keys are dot paths ("auth.login.title"), type-checked via `TranslationKey`.
 * - `{{name}}` placeholders are replaced from `params`.
 * - Plurals: give a `count` param and define "<key>_one" / "<key>_other"
 *   variants; `t('x.items', { count })` picks the right one (fr: 0 and 1 are
 *   singular, en: only 1).
 *
 * In components use `useT()` (re-renders on language switch); elsewhere
 * (alerts, services, helpers) use `translate()`, which reads the store state.
 */
import { useCallback } from 'react';
import { SupportedLanguage, useLanguageStore } from '../store/useLanguageStore';
import { fr } from './fr';
import { en } from './en';

/** Same shape as `fr` with every leaf widened to string. */
export type Dictionary = DeepString<typeof fr>;
type DeepString<T> = { [K in keyof T]: T[K] extends string ? string : DeepString<T[K]> };

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

type AllKeys = Leaves<typeof fr>;
/** Base key of plural groups: "x.items" when "x.items_one" / "x.items_other" exist. */
type PluralBase<K> = K extends `${infer B}_other` ? B : never;
export type TranslationKey = AllKeys | PluralBase<AllKeys>;
export type TranslationParams = Record<string, string | number | null | undefined>;
export type TFunction = (key: TranslationKey, params?: TranslationParams) => string;

const dictionaries: Record<SupportedLanguage, Dictionary> = { fr, en };

const lookup = (dict: unknown, key: string): string | undefined => {
  let node: any = dict;
  for (const part of key.split('.')) {
    if (node == null || typeof node !== 'object') return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
};

const interpolate = (text: string, params?: TranslationParams) =>
  params ? text.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, name) => (params[name] == null ? m : String(params[name]))) : text;

export const translateIn = (lang: SupportedLanguage, key: TranslationKey, params?: TranslationParams): string => {
  const dict = dictionaries[lang] ?? fr;
  let text: string | undefined;
  const count = params?.count;
  if (typeof count === 'number') {
    const singular = lang === 'fr' ? Math.abs(count) < 2 : count === 1;
    text = lookup(dict, `${key}_${singular ? 'one' : 'other'}`);
  }
  text = text ?? lookup(dict, key) ?? lookup(fr, key);
  if (text === undefined) {
    if (__DEV__) console.warn(`[i18n] missing key "${key}"`);
    return key;
  }
  return interpolate(text, params);
};

/** Non-hook translation (reads the current language from the store at call time). */
export const translate: TFunction = (key, params) => translateIn(useLanguageStore.getState().currentLanguage, key, params);

/** Current language outside React. */
export const getLanguage = (): SupportedLanguage => useLanguageStore.getState().currentLanguage;

/** BCP-47 locale for Intl / toLocale*String. */
export const localeFor = (lang: SupportedLanguage) => (lang === 'en' ? 'en-GB' : 'fr-FR');
export const getLocale = () => localeFor(getLanguage());

/** `const { t, lang, locale } = useT();` — re-renders when the language changes. */
export const useT = () => {
  const lang = useLanguageStore((s) => s.currentLanguage);
  const t = useCallback<TFunction>((key, params) => translateIn(lang, key, params), [lang]);
  return { t, lang, locale: localeFor(lang) };
};

export type { SupportedLanguage };

/**
 * Backend messages are French. When the server also sends a known error code
 * that the client maps to a key, show the translated text in English and keep
 * the (often more detailed) server wording in French.
 */
export const localizedServerMessage = (serverMessage: string, key: TranslationKey | undefined): string =>
  key && getLanguage() !== 'fr' ? translate(key) : serverMessage;
