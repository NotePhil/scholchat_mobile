import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../styles/theme';

interface LoadingSpinnerProps {
  label?: string;
  fullScreen?: boolean;
}

const LoadingSpinner = ({ label, fullScreen = false }: LoadingSpinnerProps) => (
  <View style={[styles.container, fullScreen && styles.fullScreen]}>
    <ActivityIndicator size="large" color={colors.primary} />
    {label ? <Text style={styles.label}>{label}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  fullScreen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  label: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
});

export default LoadingSpinner;
