import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { radius, spacing, typography, useThemeColors } from '../../styles/theme';
import BottomSheet from './BottomSheet';

export interface DropdownOption {
  label: string;
  value: string;
}

interface DropdownFieldProps {
  label?: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
  sheetTitle?: string;
}

/**
 * Mobile-native equivalent of web's `<select>` — a single field showing the
 * current choice, tapping it opens a scrollable list to pick from (a
 * BottomSheet rather than `@react-native-picker/picker`, which is an
 * installed-but-never-used native module here; wiring it in now would risk
 * needing an EAS dev-client rebuild before it works, the same trap
 * `expo-video` hit earlier — this stays pure JS/RN). Used everywhere a form
 * field on web is a real dropdown (niveau, établissement, offre, etc.)
 * instead of the chip-picker pattern those forms used before.
 */
const DropdownField = ({ label, value, options, onChange, placeholder = 'Sélectionner...', disabled, loading, error, sheetTitle }: DropdownFieldProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TouchableOpacity
        style={[styles.field, error ? styles.fieldError : null, disabled ? styles.fieldDisabled : null]}
        onPress={() => !disabled && setOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.value, !selected && styles.placeholder]} numberOfLines={1}>
          {loading ? 'Chargement...' : selected ? selected.label : placeholder}
        </Text>
        <FontAwesome5 name={open ? 'chevron-up' : 'chevron-down'} size={12} color={colors.textMuted} />
      </TouchableOpacity>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <BottomSheet visible={open} onClose={() => setOpen(false)} title={sheetTitle ?? label ?? 'Sélectionner'}>
        <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
          {options.length === 0 ? (
            <Text style={styles.emptyText}>Aucune option disponible.</Text>
          ) : (
            options.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={styles.optionRow}
                onPress={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                <Text style={[styles.optionText, opt.value === value && styles.optionTextActive]}>{opt.label}</Text>
                {opt.value === value ? <FontAwesome5 name="check" size={14} color={colors.primary} /> : null}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </BottomSheet>
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: { ...typography.bodyBold, color: colors.text, marginBottom: spacing.xs },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  fieldError: { borderColor: colors.danger },
  fieldDisabled: { backgroundColor: colors.background },
  value: { ...typography.body, color: colors.text, flex: 1, marginRight: spacing.sm },
  placeholder: { color: colors.textMuted },
  errorText: { ...typography.caption, color: colors.danger, marginTop: spacing.xs },
  optionsList: { maxHeight: 400 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionText: { ...typography.body, color: colors.text },
  optionTextActive: { color: colors.primary, fontWeight: '700' },
  emptyText: { ...typography.body, color: colors.textMuted, paddingVertical: spacing.lg, textAlign: 'center' },
});

export default DropdownField;
