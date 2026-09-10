import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radius, spacing, typography, useThemeColors } from '../../styles/theme';

export type BadgeTone = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
}

const Badge = ({ label, tone = 'neutral' }: BadgeProps) => {
  const colors = useThemeColors();
  const { styles, toneColors } = useMemo(() => createStyles(colors), [colors]);
  const { bg, fg } = toneColors[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: fg }]}>{label}</Text>
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) => {
  const toneColors: Record<BadgeTone, { bg: string; fg: string }> = {
    success: { bg: colors.successLight, fg: colors.success },
    danger: { bg: colors.dangerLight, fg: colors.danger },
    warning: { bg: colors.warningLight, fg: colors.warning },
    info: { bg: colors.primaryLight, fg: colors.primary },
    neutral: { bg: colors.grayLight, fg: colors.gray },
  };

  const styles = StyleSheet.create({
    badge: {
      alignSelf: 'flex-start',
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.full,
    },
    text: {
      ...typography.caption,
      fontWeight: '600',
    },
  });

  return { styles, toneColors };
};

export default Badge;
