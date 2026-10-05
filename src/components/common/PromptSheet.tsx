import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { BottomSheet, Button, Input } from '../ui';
import { spacing, typography, useThemeColors } from '../../styles/theme';

interface PromptSheetProps {
  visible: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  submitLabel?: string;
  multiline?: boolean;
  /** Sentence shown above the field (e.g. the confirmation wording). */
  description?: string;
  /** When set, an explicit cancel button is rendered next to the submit one. */
  cancelLabel?: string;
  /** Red submit button (reject / delete style confirmations). */
  destructive?: boolean;
  onCancel: () => void;
  onSubmit: (value: string) => void | Promise<void>;
}

/**
 * Cross-platform replacement for `Alert.prompt`, which only exists on iOS —
 * on Android it silently no-ops, so every call site using it was a dead
 * button on the majority platform. Renders as a BottomSheet with a text
 * field instead.
 */
const PromptSheet = ({
  visible,
  title,
  message,
  placeholder,
  submitLabel = 'Valider',
  multiline = false,
  description,
  cancelLabel,
  destructive = false,
  onCancel,
  onSubmit,
}: PromptSheetProps) => {
  const colors = useThemeColors();
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (visible) setValue('');
  }, [visible]);

  const handleSubmit = async () => {
    if (!value.trim() || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await onSubmit(value.trim());
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={() => !submitting && onCancel()} title={title}>
      {description ? (
        <Text style={{ ...typography.body, color: colors.text, marginBottom: spacing.md }}>{description}</Text>
      ) : null}
      <Input
        label={message}
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        multiline={multiline}
        numberOfLines={multiline ? 3 : undefined}
        autoFocus
      />
      {cancelLabel ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.lg }}>
          <Button label={cancelLabel} variant="secondary" onPress={onCancel} disabled={submitting} style={{ flex: 1 }} />
          <Button
            label={submitLabel}
            variant={destructive ? 'danger' : 'primary'}
            onPress={handleSubmit}
            loading={submitting}
            disabled={!value.trim()}
            style={{ flex: 1 }}
          />
        </View>
      ) : (
        <Button
          label={submitLabel}
          variant={destructive ? 'danger' : 'primary'}
          onPress={handleSubmit}
          loading={submitting}
          fullWidth
          style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}
        />
      )}
    </BottomSheet>
  );
};

export default PromptSheet;
