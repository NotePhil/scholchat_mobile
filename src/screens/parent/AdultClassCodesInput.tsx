import React, { useMemo } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { radius, spacing, typography, useThemeColors } from "../../styles/theme";
import { useT } from "../../i18n";

export const MAX_ADULT_CODES = 10;

interface Props {
  codes: string[];
  onChange: (codes: string[]) => void;
  /** Error under the list (no code, ELEVE_PAS_DANS_CLASSE, LIEN_PARENT_DEJA_DEMANDE…). */
  error?: string;
  disabled?: boolean;
}

/**
 * Adult child: codes of the classes (the child is already a member of) whose follow-up the parent requests —
 * one or several, add / remove. Each class's professor validates the follow request of his class.
 */
const AdultClassCodesInput = ({ codes, onChange, error, disabled }: Props) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  const list = codes.length ? codes : [""];

  const setAt = (i: number, v: string) => onChange(list.map((c, j) => (j === i ? v : c)));
  const removeAt = (i: number) => onChange(list.length > 1 ? list.filter((_, j) => j !== i) : [""]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{`${t("adultChild.codes.label")} *`}</Text>
      {list.map((c, i) => (
        <View key={i} style={styles.row}>
          <TextInput
            style={[styles.input, error ? styles.inputError : null]}
            value={c}
            onChangeText={(v) => setAt(i, v)}
            placeholder={t("auth.signup.classe.placeholder")}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!disabled}
            accessibilityLabel={t("adultChild.codes.itemLabel", { index: i + 1 })}
          />
          {list.length > 1 ? (
            <TouchableOpacity
              onPress={() => removeAt(i)}
              disabled={disabled}
              style={styles.remove}
              accessibilityRole="button"
              accessibilityLabel={t("adultChild.codes.remove")}
            >
              <FontAwesome5 name="times" size={13} color={colors.danger} />
            </TouchableOpacity>
          ) : null}
        </View>
      ))}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {list.length < MAX_ADULT_CODES ? (
        <TouchableOpacity
          onPress={() => onChange([...list, ""])}
          disabled={disabled}
          style={styles.add}
          accessibilityRole="button"
        >
          <FontAwesome5 name="plus-circle" size={12} color={colors.primary} />
          <Text style={styles.addText}>{t("adultChild.codes.add")}</Text>
        </TouchableOpacity>
      ) : null}
      <Text style={styles.hint}>{t("adultChild.codes.hint")}</Text>
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    wrap: { marginBottom: spacing.md },
    label: { ...typography.caption, color: colors.text, fontWeight: "600", marginBottom: 6 },
    row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    inputError: { borderColor: colors.danger },
    remove: { padding: spacing.sm },
    error: { ...typography.caption, color: colors.danger, marginBottom: spacing.xs },
    add: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4, alignSelf: "flex-start" },
    addText: { ...typography.caption, color: colors.primary, fontWeight: "700" },
    hint: { ...typography.caption, color: colors.textMuted, marginTop: 4, lineHeight: 17 },
  });

export default AdultClassCodesInput;
