import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { radius, spacing, typography, useThemeColors } from '../../styles/theme';
import { useT } from '../../i18n';

/**
 * Small building blocks shared by the class → course → exercises pages,
 * the progression views and the class statistics (loader / error-retry,
 * progress bars, stat tiles, bar chart made of Views, collapsible header).
 */

/** Loader, or error + "Réessayer", for one section of a page. */
export const SectionState = ({
  status,
  loadingLabel,
  errorLabel,
  message,
  onRetry,
  compact = false,
}: {
  status: 'loading' | 'error';
  loadingLabel: string;
  errorLabel: string;
  message?: string;
  onRetry: () => void;
  compact?: boolean;
}) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  if (status === 'loading') {
    return (
      <View style={[styles.state, compact && styles.stateCompact]} accessibilityRole="progressbar" accessibilityLabel={loadingLabel}>
        <ActivityIndicator size={compact ? 'small' : 'large'} color={colors.primary} />
        <Text style={styles.stateText}>{loadingLabel}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.state, compact && styles.stateCompact]}>
      <FontAwesome5 name="exclamation-triangle" size={compact ? 18 : 24} color={colors.danger} />
      <Text style={styles.stateText}>{errorLabel}</Text>
      {message && message !== errorLabel ? <Text style={styles.stateSub}>{message}</Text> : null}
      <TouchableOpacity style={styles.retryBtn} onPress={onRetry} activeOpacity={0.85} accessibilityRole="button">
        <FontAwesome5 name="redo" size={11} color="#FFFFFF" />
        <Text style={styles.retryText}>{t('classDetails.retry')}</Text>
      </TouchableOpacity>
    </View>
  );
};

/** Horizontal progress bar (value in 0..100). */
export const ProgressBar = ({ value, color, height = 8 }: { value: number; color?: string; height?: number }) => {
  const colors = useThemeColors();
  const v = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <View
      style={{ height, borderRadius: height / 2, backgroundColor: colors.surfaceElevated, overflow: 'hidden' }}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(v) }}
    >
      <View style={{ width: `${v}%`, height: '100%', borderRadius: height / 2, backgroundColor: color ?? colors.primary }} />
    </View>
  );
};

/** Colour of a percentage / average: red < 50 %, amber < 70 %, green otherwise. */
export const scoreColor = (ratio: number | null | undefined, colors: ReturnType<typeof useThemeColors>) => {
  if (ratio == null || !Number.isFinite(ratio)) return colors.textLight;
  if (ratio < 0.5) return colors.danger;
  if (ratio < 0.7) return colors.warning;
  return colors.success;
};

/** Compact metric tile (icon, value, label). */
export const StatTile = ({
  icon,
  value,
  label,
  color,
  sub,
}: {
  icon: string;
  value: string | number;
  label: string;
  color?: string;
  sub?: string;
}) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const c = color ?? colors.primary;
  return (
    <View style={styles.tile}>
      <View style={[styles.tileIcon, { backgroundColor: `${c}22` }]}>
        <FontAwesome5 name={icon} size={13} color={c} />
      </View>
      <Text style={[styles.tileValue, { color: c }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.tileLabel} numberOfLines={2}>
        {label}
      </Text>
      {sub ? (
        <Text style={styles.tileSub} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
};

/** Simple horizontal bar chart built with Views (one row per item, value / max). */
export const BarChart = ({
  rows,
  max,
  format = (v) => String(v),
}: {
  rows: { key: string; label: string; value: number | null; color?: string }[];
  max: number;
  format?: (v: number) => string;
}) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={{ gap: 8 }}>
      {rows.map((r) => {
        const v = r.value ?? 0;
        const w = max > 0 ? Math.max(0, Math.min(100, (v / max) * 100)) : 0;
        return (
          <View key={r.key} style={styles.barRow}>
            <Text style={styles.barLabel} numberOfLines={1}>
              {r.label}
            </Text>
            <View style={styles.barTrack}>
              {r.value != null ? <View style={[styles.barFill, { width: `${w}%`, backgroundColor: r.color ?? colors.primary }]} /> : null}
            </View>
            <Text style={styles.barValue}>{r.value == null ? '—' : format(v)}</Text>
          </View>
        );
      })}
    </View>
  );
};

/** Tappable header of a collapsible group (chevron + title + count / extra). */
export const CollapsibleHeader = ({
  title,
  subtitle,
  icon,
  open,
  onToggle,
  right,
  level = 1,
}: {
  title: string;
  subtitle?: string;
  icon?: string;
  open: boolean;
  onToggle: () => void;
  right?: React.ReactNode;
  level?: 1 | 2;
}) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <TouchableOpacity
      style={[styles.groupHead, level === 2 && styles.groupHead2]}
      onPress={onToggle}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
    >
      <FontAwesome5 name={open ? 'chevron-down' : 'chevron-right'} size={11} color={colors.textMuted} />
      {icon ? <FontAwesome5 name={icon} size={level === 1 ? 13 : 12} color={level === 1 ? colors.primary : colors.purple} /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={level === 1 ? styles.groupTitle : styles.groupTitle2} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.groupSub} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </TouchableOpacity>
  );
};

/** Small rounded counter pill. */
export const CountPill = ({ value, color }: { value: string | number; color?: string }) => {
  const colors = useThemeColors();
  const c = color ?? colors.primary;
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full, backgroundColor: `${c}22` }}>
      <Text style={{ ...typography.captionBold, color: c }}>{value}</Text>
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    state: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
    stateCompact: { paddingVertical: spacing.md },
    stateText: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
    stateSub: { ...typography.caption, color: colors.textLight, textAlign: 'center' },
    retryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
      marginTop: 4,
    },
    retryText: { ...typography.captionBold, color: '#FFFFFF' },
    tile: {
      flexGrow: 1,
      flexBasis: '45%',
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      gap: 4,
    },
    tileIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    tileValue: { fontSize: 20, fontWeight: '800' },
    tileLabel: { ...typography.caption, color: colors.textMuted },
    tileSub: { ...typography.tiny, color: colors.textLight },
    barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    barLabel: { ...typography.caption, color: colors.text, width: 96 },
    barTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.surfaceElevated, overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: 5 },
    barValue: { ...typography.captionBold, color: colors.textMuted, minWidth: 40, textAlign: 'right' },
    groupHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    groupHead2: { backgroundColor: 'transparent', borderWidth: 0, paddingHorizontal: 4, paddingVertical: 8 },
    groupTitle: { ...typography.bodyBold, color: colors.text },
    groupTitle2: { ...typography.captionBold, color: colors.text, fontSize: 13 },
    groupSub: { ...typography.caption, color: colors.textMuted },
  });
