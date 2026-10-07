import type { TranslationKey } from '../../../i18n';

/** E-mail format check used by the auth forms (web relies on <input type="email"> / /\S+@\S+\.\S+/). */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Sign-up e-mail check aligned with the backend validator (Apache Commons EmailValidator, no local
 * domains): dot-atom local part (≤ 64 chars, no leading / trailing / double dot, no space or
 * ()<>,;:\"[]), domain labels (letters, digits, inner hyphens) and an alphabetic TLD (or IDN
 * "xn--…"). The server also checks the TLD against the IANA list (same French message then).
 */
const LOCAL_ATOM = '[^\\s@()<>,;:\\\\"\\[\\].\\x00-\\x1F\\x7F]+';
export const SIGNUP_EMAIL_REGEX = new RegExp(
  `^(?=.{1,254}$)(?=[^@]{1,64}@)${LOCAL_ATOM}(?:\\.${LOCAL_ATOM})*@` +
    '(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\\.)+(?:[A-Za-z]{2,63}|xn--[A-Za-z0-9-]{1,59})$'
);

export type PasswordRuleKey = 'length' | 'uppercase' | 'lowercase' | 'number';

/** Same checklist as web ResetPassword.jsx (checkPasswordStrength). */
export const PASSWORD_RULES: { key: PasswordRuleKey; label: TranslationKey; test: (v: string) => boolean }[] = [
  { key: 'length', label: 'auth.reset.rules.length', test: (v) => v.length >= 8 },
  { key: 'uppercase', label: 'auth.reset.rules.uppercase', test: (v) => /[A-Z]/.test(v) },
  { key: 'lowercase', label: 'auth.reset.rules.lowercase', test: (v) => /[a-z]/.test(v) },
  { key: 'number', label: 'auth.reset.rules.number', test: (v) => /[0-9]/.test(v) },
];
