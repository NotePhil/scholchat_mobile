import React, { useMemo } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Button } from '../ui';
import { radius, spacing, typography, useThemeColors } from '../../styles/theme';
import { useT } from '../../i18n';

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  /** Extra emphasised line (e.g. "Cette action est irréversible."), shown in red. */
  warning?: string;
  /** Red confirm button + red icon (reject / delete). */
  destructive?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  /** While true the confirm button shows a spinner and both buttons are disabled. */
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Centered confirmation dialog with explicit Confirmer / Annuler buttons.
 * Unlike Alert.alert it stays open while the action runs, so the confirm
 * button can show a loading state and ignore double taps.
 */
const ConfirmDialog = ({
  visible,
  title,
  message,
  warning,
  destructive = false,
  confirmLabel,
  cancelLabel,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  const close = () => {
    if (!loading) onCancel();
  };
  const accent = destructive ? colors.danger : colors.success;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={close} />
        <View style={styles.card} accessibilityRole="alert">
          <View style={[styles.iconWrap, { backgroundColor: destructive ? colors.dangerLight : colors.grayLight }]}>
            <FontAwesome5 name={destructive ? 'exclamation-triangle' : 'check-circle'} size={22} color={accent} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          {warning ? <Text style={styles.warning}>{warning}</Text> : null}
          <View style={styles.actions}>
            <Button
              label={cancelLabel ?? t('classConfirm.cancel')}
              variant="secondary"
              onPress={close}
              disabled={loading}
              style={styles.actionBtn}
            />
            <Button
              label={confirmLabel ?? t('classConfirm.confirm')}
              variant={destructive ? 'danger' : 'primary'}
              onPress={onConfirm}
              loading={loading}
              style={destructive ? styles.actionBtn : { ...styles.actionBtn, backgroundColor: colors.success }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xl,
      backgroundColor: 'rgba(17, 24, 39, 0.5)',
    },
    card: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.xl,
      alignItems: 'center',
    },
    iconWrap: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    title: { ...typography.h3, color: colors.text, textAlign: 'center', marginBottom: spacing.sm },
    message: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
    warning: { ...typography.bodyBold, color: colors.danger, textAlign: 'center', marginTop: spacing.sm },
    actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, width: '100%' },
    actionBtn: { flex: 1 },
  });

export default ConfirmDialog;
