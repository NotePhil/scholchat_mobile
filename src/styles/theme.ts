/**
 * Central design tokens for the mobile app. Extracted from the palette that
 * was already used consistently-but-uncentralized across professeurs/admin
 * screens (#4F46E5 primary, #10B981 success, etc.) so every new role
 * dashboard shares one source of truth instead of copy-pasted hex literals.
 */
export const colors = {
  primary: '#4F46E5',
  primaryDark: '#4338CA',
  primaryLight: '#EEF2FF',
  success: '#10B981',
  successLight: '#D1FAE5',
  danger: '#EF4444',
  dangerLight: '#FEF2F2',
  warning: '#F59E0B',
  warningLight: '#FFFBEB',
  info: '#3B82F6',
  gray: '#6B7280',
  grayLight: '#E5E7EB',
  background: '#F9FAFB',
  surface: '#FFFFFF',
  text: '#111827',
  textMuted: '#6B7280',
  border: '#E5E7EB',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 999,
} as const;

export const typography = {
  h1: { fontSize: 24, fontWeight: '700' as const },
  h2: { fontSize: 20, fontWeight: '700' as const },
  h3: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 14, fontWeight: '400' as const },
  bodyBold: { fontSize: 14, fontWeight: '600' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
};

export const shadow = {
  card: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
};

export const theme = { colors, spacing, radius, typography, shadow };
export default theme;
