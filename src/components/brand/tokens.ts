import { useMemo } from 'react';
import { useThemeStore } from '../../store/useThemeStore';
import { usePoppinsStore } from './fonts';

/**
 * ScholChat brand tokens (design boards "Palette de couleurs" / "Typographie (Poppins)").
 * Used by the pre-login experience and the brand components. The dashboards keep their own
 * palette from styles/theme.ts.
 */
export const brand = {
  primary: '#8C52FF',
  gradientStart: '#4F46E5',
  gradientEnd: '#9333EA',
  blue: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  white: '#FFFFFF',
} as const;

export const brandGradient = [brand.gradientStart, brand.gradientEnd] as const;

const light = {
  ...brand,
  mode: 'light' as 'light' | 'dark',
  background: '#FFFFFF',
  backgroundAlt: '#F8FAFC',
  card: '#FFFFFF',
  input: '#FFFFFF',
  text: '#0F172A',
  textSecondary: '#64748B',
  placeholder: '#94A3B8',
  border: '#E2E8F0',
  link: '#7C3AED',
  primarySoft: '#F3EEFF',
  dangerSoft: '#FEF2F2',
  dangerText: '#B91C1C',
  successSoft: '#ECFDF5',
  infoSoft: '#EEF2FF',
  statusBar: 'dark-content' as 'dark-content' | 'light-content',
};

const dark: typeof light = {
  ...brand,
  mode: 'dark',
  background: '#0F172A',
  backgroundAlt: '#0F172A',
  card: '#1E293B',
  input: '#1E293B',
  text: '#F8FAFC',
  textSecondary: '#CBD5E1',
  placeholder: '#64748B',
  border: '#334155',
  link: '#A78BFA',
  primarySoft: 'rgba(140,82,255,0.16)',
  dangerSoft: 'rgba(239,68,68,0.14)',
  dangerText: '#FCA5A5',
  successSoft: 'rgba(16,185,129,0.14)',
  infoSoft: 'rgba(79,70,229,0.18)',
  statusBar: 'light-content',
};

export type BrandColors = typeof light;

/**
 * Light/dark brand palette following the app-wide theme toggle (useThemeStore). A new object is
 * returned when Poppins finishes loading, so `useMemo(() => createStyles(c), [c])` picks up the font.
 */
export const useBrandColors = (): BrandColors => {
  const mode = useThemeStore((s) => s.mode);
  const fontsReady = usePoppinsStore((s) => s.ready);
  return useMemo(() => ({ ...(mode === 'dark' ? dark : light) }), [mode, fontsReady]);
};

/** Role accent colours used by the role cards ("Je suis…"). */
export const roleAccents = {
  professeur: { color: '#8C52FF', soft: 'rgba(140,82,255,0.14)', icon: 'graduation-cap' },
  eleve: { color: '#3B82F6', soft: 'rgba(59,130,246,0.14)', icon: 'user-graduate' },
  parent: { color: '#10B981', soft: 'rgba(16,185,129,0.14)', icon: 'user-friends' },
  etablissement: { color: '#F59E0B', soft: 'rgba(245,158,11,0.16)', icon: 'school' },
} as const;
