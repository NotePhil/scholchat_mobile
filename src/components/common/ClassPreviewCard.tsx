import React, { useMemo } from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { radius, spacing, typography, useThemeColors } from '../../styles/theme';
import type { ClassPreview } from '../../services/api/classPreviewService';
import type { ClassPreviewStatus } from '../../hooks/useClassPreview';
import { useT } from '../../i18n';

interface ClassPreviewCardProps {
  status: ClassPreviewStatus;
  preview: ClassPreview | null;
  error?: string;
  /** Heading shown above the class name ("Classe trouvée" by default). */
  heading?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Result of a class-code lookup (GET /public/classes/apercu): a spinner while searching, the
 * class card (name, level, establishment, teacher) once found, or the error message.
 * Renders nothing while idle.
 */
const ClassPreviewCard = ({ status, preview, error, heading, style }: ClassPreviewCardProps) => {
  const colors = useThemeColors();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();

  if (status === 'loading') {
    return (
      <View style={[s.row, s.loading, style]} accessibilityLiveRegion="polite">
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={s.loadingText}>{t('classPreview.searching')}</Text>
      </View>
    );
  }

  if (status === 'error' && error) {
    return (
      <View style={[s.row, s.error, style]} accessibilityLiveRegion="polite">
        <FontAwesome5 name="exclamation-circle" size={14} color={colors.danger} solid />
        <Text style={s.errorText}>{error}</Text>
      </View>
    );
  }

  if (status !== 'found' || !preview) return null;

  const meta: { icon: string; label: string; value?: string | null }[] = [
    { icon: 'layer-group', label: t('classPreview.level'), value: preview.niveau },
    { icon: 'school', label: t('classPreview.establishment'), value: preview.etablissementNom },
    { icon: 'chalkboard-teacher', label: t('classPreview.teacher'), value: preview.professeurNom },
  ];

  return (
    <View style={[s.card, style]} accessibilityLiveRegion="polite">
      <View style={s.headRow}>
        <FontAwesome5 name="check-circle" size={13} color={colors.success} solid />
        <Text style={s.heading}>{heading ?? t('classPreview.found')}</Text>
      </View>
      <View style={s.titleRow}>
        <View style={s.icon}>
          <FontAwesome5 name="chalkboard" size={16} color={colors.white} />
        </View>
        <Text style={s.title} numberOfLines={2}>
          {preview.nom || '—'}
        </Text>
      </View>
      {meta.map((m) =>
        m.value ? (
          <View key={m.icon} style={s.metaRow}>
            <FontAwesome5 name={m.icon} size={11} color={colors.textMuted} style={s.metaIcon} />
            <Text style={s.metaLabel}>{m.label} :</Text>
            <Text style={s.metaValue} numberOfLines={1}>
              {m.value}
            </Text>
          </View>
        ) : null
      )}
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.md, padding: spacing.md },
    loading: { backgroundColor: colors.surfaceElevated },
    loadingText: { ...typography.caption, color: colors.textMuted, flex: 1 },
    error: { backgroundColor: `${colors.danger}14`, borderWidth: 1, borderColor: `${colors.danger}55` },
    errorText: { ...typography.caption, color: colors.danger, flex: 1, fontWeight: '600' },
    card: {
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: `${colors.success}88`,
      backgroundColor: `${colors.success}12`,
      padding: spacing.md,
      gap: 6,
    },
    headRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    heading: { ...typography.caption, color: colors.successDark, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2, marginBottom: 2 },
    icon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
    title: { ...typography.bodyBold, color: colors.text, fontSize: 16, flex: 1 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    metaIcon: { width: 14, textAlign: 'center' },
    metaLabel: { ...typography.caption, color: colors.textMuted },
    metaValue: { ...typography.caption, color: colors.text, fontWeight: '600', flex: 1 },
  });

export default ClassPreviewCard;
