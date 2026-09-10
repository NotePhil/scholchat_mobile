import React, { useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors, radius, spacing, typography, useThemeColors } from '../../styles/theme';

interface DateTimeFieldProps {
  label: string;
  value?: string;
  onChange: (isoString: string) => void;
  required?: boolean;
}

/**
 * Native date+time picker producing a real ISO string — replaces the
 * free-text "JJ/MM/AAAA HH:MM" inputs that had no format validation and
 * routinely produced unparsable dates sent straight to the API.
 */
const DateTimeField = ({ label, value, onChange, required }: DateTimeFieldProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [stage, setStage] = useState<'none' | 'date' | 'time'>('none');
  const [pendingDate, setPendingDate] = useState<Date | null>(null);

  const current = value ? new Date(value) : null;

  const open = () => {
    setPendingDate(current ?? new Date());
    setStage('date');
  };

  // iOS's native picker supports a single combined datetime step; Android
  // only offers separate date/time dialogs, so that platform needs two stages.
  const handleDateChange = (event: any, selected?: Date) => {
    if (Platform.OS === 'android') {
      setStage('none');
      if (event.type === 'dismissed' || !selected) return;
      setPendingDate(selected);
      setStage('time');
      return;
    }
    if (event.type === 'dismissed' || !selected) {
      setStage('none');
      return;
    }
    onChange(selected.toISOString());
  };

  const handleTimeChange = (event: any, selected?: Date) => {
    setStage('none');
    if (event.type === 'dismissed' || !selected || !pendingDate) return;
    const merged = new Date(pendingDate);
    merged.setHours(selected.getHours(), selected.getMinutes());
    onChange(merged.toISOString());
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label} {required ? '*' : ''}
      </Text>
      <TouchableOpacity style={styles.field} onPress={open}>
        <FontAwesome5 name="calendar-alt" size={14} color={colors.textMuted} />
        <Text style={[styles.value, !current && styles.placeholder]}>
          {current ? current.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : 'Sélectionner une date et heure'}
        </Text>
      </TouchableOpacity>

      {stage === 'date' && (
        <DateTimePicker
          value={pendingDate ?? new Date()}
          mode={Platform.OS === 'ios' ? 'datetime' : 'date'}
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={handleDateChange}
        />
      )}
      {stage === 'time' && (
        <DateTimePicker value={pendingDate ?? new Date()} mode="time" display="default" onChange={handleTimeChange} />
      )}
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: { ...typography.bodyBold, color: colors.text, marginBottom: spacing.xs },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  value: { ...typography.body, color: colors.text },
  placeholder: { color: colors.textMuted },
});

export default DateTimeField;
