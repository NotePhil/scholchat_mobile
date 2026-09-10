import { useThemeStore } from '../store/useThemeStore';

/**
 * Central design tokens for the mobile app. Colors are managed the same way
 * web does it (scholchat_front/src/CSS/themes.css): a light and a dark
 * palette, where only backgrounds/text/borders flip between modes — brand
 * and status accent colors (primary blue, success/danger/warning) stay the
 * same in both. `primary` matches web's actual --primary-color (#3b82f6),
 * not the indigo that had crept in here.
 */

// ── Tokens that never change between light and dark ─────────────────────────
const staticColors = {
  primary: '#3B82F6', // web --primary-color
  primaryDark: '#1D4ED8', // web --secondary-color
  primaryLight: '#DBEAFE', // web --light-color
  primaryMid: '#60A5FA', // web --accent-color

  success: '#10B981',
  successDark: '#059669',
  successLight: '#D1FAE5',
  danger: '#EF4444',
  dangerDark: '#DC2626',
  dangerLight: '#FEF2F2',
  warning: '#F59E0B',
  warningDark: '#D97706',
  warningLight: '#FFFBEB',
  info: '#3B82F6',
  infoDark: '#2563EB', // web --hover-color
  infoLight: '#EFF6FF',

  // Role accent colours
  teal: '#0D9488',
  tealLight: '#CCFBF1',
  purple: '#8B5CF6',
  purpleLight: '#F3F4F6',
  rose: '#F43F5E',
  roseLight: '#FFF1F2',
  amber: '#F59E0B',
  amberLight: '#FFFBEB',

  white: '#FFFFFF',
  black: '#000000',

  // Decorative hero gradient (used by gradient headers) — a fixed accent,
  // not a surface, so it doesn't flip with light/dark either (matches web's
  // own .header-primary gradient, which also doesn't change with dark mode).
  heroStart: '#0F172A',
  heroMid: '#1E293B',
  heroEnd: '#334155',
} as const;

// ── Tokens that flip between light and dark — matched to web's themes.css ──
const lightSurfaces = {
  gray: '#64748B', // web --text-secondary
  grayLight: '#E2E8F0', // web --border-color
  grayMid: '#94A3B8', // web --text-tertiary
  background: '#F8FAFC', // web --bg-secondary
  surface: '#FFFFFF', // web --bg-primary
  surfaceElevated: '#F1F5F9', // web --bg-tertiary
  surfaceDim: '#F1F5F9',
  text: '#1E293B', // web --text-primary
  textMuted: '#64748B', // web --text-secondary
  textLight: '#94A3B8', // web --text-tertiary
  border: '#E2E8F0', // web --border-color
  borderLight: '#E2E8F0',
} as const;

const darkSurfaces = {
  gray: '#CBD5E1',
  grayLight: '#475569',
  grayMid: '#94A3B8',
  background: '#0F172A',
  surface: '#1E293B',
  surfaceElevated: '#334155',
  surfaceDim: '#334155',
  text: '#F8FAFC',
  textMuted: '#CBD5E1',
  textLight: '#94A3B8',
  border: '#475569',
  borderLight: '#475569',
} as const;

export const lightColors = { ...staticColors, ...lightSurfaces };
export const darkColors = { ...staticColors, ...darkSurfaces };

/** Default export for any screen not yet converted to `useThemeColors()` — always light, doesn't react to the toggle. */
export const colors = lightColors;

/** Reactive palette — reads the current light/dark mode from `useThemeStore`. Call inside a component body. */
export const useThemeColors = () => useThemeStore((s) => (s.mode === 'dark' ? darkColors : lightColors));

export type ThemeColors = typeof lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
} as const;

export const typography = {
  h1: { fontSize: 26, fontWeight: '800' as const, letterSpacing: -0.5 },
  h2: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.3 },
  h3: { fontSize: 17, fontWeight: '700' as const },
  h4: { fontSize: 15, fontWeight: '600' as const },
  body: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  bodyBold: { fontSize: 14, fontWeight: '700' as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  captionBold: { fontSize: 12, fontWeight: '700' as const, lineHeight: 16 },
  tiny: { fontSize: 10, fontWeight: '600' as const },
};

/** Three-tier elevation shadow system (neutral black, zero purple glow) */
export const shadow = {
  /** Subtle lift — for secondary cards / chips */
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  /** Standard card elevation */
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  /** Medium elevation */
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  /** Hero / accent components */
  hero: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
};

export const theme = { colors, spacing, radius, typography, shadow };
export default theme;
