import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { radius, spacing, typography, useThemeColors } from '../../styles/theme';

export type BadgeTone = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  /** FontAwesome5 icon name shown before the label. */
  icon?: string;
}

const Badge = ({ label, tone = 'neutral', icon }: BadgeProps) => {
  const colors = useThemeColors();
  const { styles, toneColors } = useMemo(() => createStyles(colors), [colors]);
  const { bg, fg } = toneColors[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {icon ? <FontAwesome5 name={icon as any} size={10} color={fg} /> : null}
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
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
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
