import React, { ReactNode, useMemo } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radius, shadow, spacing, typography, useThemeColors } from '../../styles/theme';

interface HeroCardProps {
  title: string;
  subtitle?: string;
  accentColor?: string;
  /** Small slot in the top-right corner of the title row (e.g. a refresh icon button). */
  topRight?: ReactNode;
  children?: ReactNode;
  style?: ViewStyle;
}

/**
 * Big rounded "home screen" hero card — greeting/title up top, an optional
 * accent-tinted decorative circle bleeding off the corner, and a slot for
 * per-role content underneath. Replaces the old plain "Tableau de Bord"
 * page-title header on every role's landing screen.
 */
const HeroCard = ({ title, subtitle, accentColor = colors.primary, topRight, children, style }: HeroCardProps) => {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  return (
    <View style={[styles.card, { borderColor: `${accentColor}22` }, style]}>
      <View style={[styles.accentBlob, { backgroundColor: `${accentColor}18` }]} pointerEvents="none" />
      <View style={[styles.accentBlobSmall, { backgroundColor: `${accentColor}12` }]} pointerEvents="none" />
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {topRight}
      </View>
      {children}
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    ...shadow.card,
  },
  accentBlob: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  accentBlobSmall: {
    position: 'absolute',
    top: 20,
    right: 60,
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { ...typography.h1, color: colors.text, fontSize: 22 },
  subtitle: { ...typography.body, color: colors.textMuted, marginTop: 2 },
});

export default HeroCard;
