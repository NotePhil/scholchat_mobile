import React, { useEffect, useState } from 'react';
import { BottomSheet, Button, Input } from '../ui';
import { spacing } from '../../styles/theme';

interface PromptSheetProps {
  visible: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  submitLabel?: string;
  multiline?: boolean;
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
  onCancel,
  onSubmit,
}: PromptSheetProps) => {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) setValue('');
  }, [visible]);

  const handleSubmit = async () => {
    if (!value.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(value.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onCancel} title={title}>
      <Input
        label={message}
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        multiline={multiline}
        numberOfLines={multiline ? 3 : undefined}
        autoFocus
      />
      <Button
        label={submitLabel}
        onPress={handleSubmit}
        loading={submitting}
        fullWidth
        style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}
      />
    </BottomSheet>
  );
};

export default PromptSheet;
