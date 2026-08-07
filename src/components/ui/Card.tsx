import React, { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius, shadow, spacing } from '../../styles/theme';

interface CardProps {
  children: ReactNode;
  style?: ViewStyle;
  padded?: boolean;
}

const Card = ({ children, style, padded = true }: CardProps) => (
  <View style={[styles.card, padded && styles.padded, style]}>{children}</View>
);

const styles = StyleSheet.create({
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
