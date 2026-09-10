import React, { ReactNode, useMemo } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { radius, shadow, spacing, useThemeColors } from '../../styles/theme';

interface CardProps {
  children: ReactNode;
  style?: ViewStyle;
  padded?: boolean;
}

const Card = ({ children, style, padded = true }: CardProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={[styles.card, padded && styles.padded, style]}>{children}</View>;
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    ...shadow.card,
  },
  padded: {
    padding: spacing.lg,
  },
});

export default Card;
