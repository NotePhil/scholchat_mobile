import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { spacing, typography, useThemeColors } from '../../styles/theme';

interface LoadingSpinnerProps {
  label?: string;
  fullScreen?: boolean;
}

const LoadingSpinner = ({ label, fullScreen = false }: LoadingSpinnerProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={[styles.container, fullScreen && styles.fullScreen]}>
      <ActivityIndicator size="large" color={colors.primary} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
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
