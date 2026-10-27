import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { radius, spacing, typography, useThemeColors } from "../../styles/theme";
import type { ChildKind } from "../../services/api/parentService";
import { useT } from "../../i18n";

interface Props {
  value: ChildKind;
  onChange: (kind: ChildKind) => void;
  disabled?: boolean;
}

/**
 * Child card choice: "Mineur (sans compte)" — prénom, nom, class code; the parent acts for them — or
 * "Majeur — a son propre compte élève" — added by e-mail (follow request validated by a professor); the
 * parent only follows them.
 */
const ChildKindToggle = ({ value, onChange, disabled }: Props) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  const options: { kind: ChildKind; icon: string; label: string }[] = [
    { kind: "MINEUR", icon: "child", label: t("adultChild.minor") },
    { kind: "MAJEUR", icon: "user-graduate", label: t("adultChild.adult") },
  ];
  return (
    <View style={styles.wrap}>
      <View style={styles.row} accessibilityRole="radiogroup">
        {options.map((o) => {
          const active = value === o.kind;
          return (
            <TouchableOpacity
              key={o.kind}
              style={[styles.option, active && styles.optionActive]}
              onPress={() => !disabled && onChange(o.kind)}
              activeOpacity={0.8}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ checked: active, disabled }}
            >
              <FontAwesome5 name={o.icon} size={12} color={active ? colors.primary : colors.textMuted} />
              <Text style={[styles.label, active && styles.labelActive]}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.hint}>{value === "MAJEUR" ? t("adultChild.adultHint") : t("adultChild.minorHint")}</Text>
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    wrap: { marginBottom: spacing.md },
    row: { flexDirection: "row", gap: spacing.sm },
    option: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    optionActive: { borderColor: colors.primary, backgroundColor: `${colors.primary}14` },
    label: { ...typography.caption, color: colors.textMuted, flex: 1 },
    labelActive: { color: colors.primary, fontWeight: "700" },
    hint: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs, lineHeight: 17 },
  });

export default ChildKindToggle;
