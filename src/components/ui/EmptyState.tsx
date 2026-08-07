import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../styles/theme';
import Button from './Button';

interface EmptyStateProps {
  icon?: React.ComponentProps<typeof FontAwesome5>['name'];
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const EmptyState = ({ icon = 'inbox', title, message, actionLabel, onAction }: EmptyStateProps) => (
  <View style={styles.container}>
    <FontAwesome5 name={icon} size={40} color={colors.grayLight} />
    <Text style={styles.title}>{title}</Text>
    {message ? <Text style={styles.message}>{message}</Text> : null}
    {actionLabel && onAction ? (
      <Button label={actionLabel} onPress={onAction} style={styles.action} />
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  title: {
    ...typography.h3,
    color: colors.text,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  message: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  action: {
    marginTop: spacing.lg,
  },
});

export default EmptyState;
