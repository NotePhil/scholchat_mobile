import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { BottomSheet, Button } from "../../components/ui";
import { radius, spacing, typography, useThemeColors } from "../../styles/theme";
import { AppRole } from "../../types";
import { TranslationKey, useT } from "../../i18n";

/** Role namespaces of the help texts (i18n `help.<role>.<page>`), same structure as the web. */
export type HelpRole = "parent" | "eleve" | "professeur";

export interface HelpTarget {
  role: HelpRole;
  /** One or more page keys; the first is the screen itself, the others closely related sub-screens. */
  pages: string[];
}

export const helpRoleFor = (role: AppRole): HelpRole | null =>
  role === "parent" ? "parent" : role === "student" ? "eleve" : role === "professor" || role === "tutor" ? "professeur" : null;

/** DashboardShell tab (see its renderBody) → help pages, per role. */
const TAB_PAGES: Record<HelpRole, Record<string, string[]>> = {
  parent: {
    dashboard: ["dashboard"],
    activities: ["activites"],
    exercises: ["devoirs"],
    devoirs: ["devoirs"],
    "manage-exercises": ["devoirs"],
    classes: ["classes"],
    class: ["classes"],
    courses: ["cours"],
    cours: ["cours"],
    children: ["enfants"],
    "my-children": ["enfants"],
    messages: ["messages"],
    settings: ["profil"],
    notifications: ["notifications"],
  },
  eleve: {
    dashboard: ["dashboard"],
    activities: ["activites"],
    exercises: ["devoirs"],
    devoirs: ["devoirs"],
    "manage-exercises": ["devoirs"],
    classes: ["classes"],
    class: ["classes"],
    courses: ["cours"],
    cours: ["cours"],
    messages: ["messages"],
    settings: ["profil"],
    notifications: ["notifications"],
  },
  professeur: {
    dashboard: ["dashboard"],
    activities: ["activites"],
    cours: ["cours", "programmation"],
    courses: ["cours", "programmation"],
    matieres: ["matieres"],
    exercises: ["devoirs", "corrections"],
    "manage-exercises": ["devoirs", "corrections"],
    devoirs: ["devoirs", "corrections"],
    class: ["classes"],
    classes: ["classes"],
    "manage-class": ["classes"],
    "create-class": ["classes"],
    users: ["utilisateurs"],
    messages: ["messages"],
    settings: ["profil"],
    notifications: ["notifications"],
  },
};

/** Help for a dashboard tab of the given session role, or null (no help for that role). */
export const getHelpTarget = (role: AppRole, tab: string): HelpTarget | null => {
  const helpRole = helpRoleFor(role);
  if (!helpRole) return null;
  return { role: helpRole, pages: TAB_PAGES[helpRole][tab] ?? ["dashboard"] };
};

const lines = (text: string) =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

interface HelpSheetProps {
  visible: boolean;
  onClose: () => void;
  target: HelpTarget | null;
}

/** Bottom sheet with the guidelines of a screen: purpose, numbered steps, tips. */
export const HelpSheet = ({ visible, onClose, target }: HelpSheetProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  if (!target) return null;
  const k = (page: string, field: string) => t(`help.${target.role}.${page}.${field}` as TranslationKey);
  const firstTitle = k(target.pages[0], "title");

  return (
    <BottomSheet visible={visible} onClose={onClose} title={`${t("helpUi.title")} — ${firstTitle}`}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.sm }}>
        {target.pages.map((page, idx) => (
          <View key={page} style={idx > 0 ? styles.extraSection : undefined}>
            {idx > 0 ? <Text style={styles.sectionTitle}>{k(page, "title")}</Text> : null}
            <View style={styles.purposeBox}>
              <FontAwesome5 name="lightbulb" size={14} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{t("helpUi.purpose")}</Text>
                <Text style={styles.body}>{k(page, "purpose")}</Text>
              </View>
            </View>

            <Text style={styles.label}>{t("helpUi.steps")}</Text>
            {lines(k(page, "steps")).map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>{i + 1}</Text>
                </View>
                <Text style={[styles.body, { flex: 1 }]}>{step}</Text>
              </View>
            ))}

            {lines(k(page, "tips")).length > 0 ? (
              <View style={styles.tipsBox}>
                <Text style={[styles.label, { color: colors.warningDark }]}>{t("helpUi.tips")}</Text>
                {lines(k(page, "tips")).map((tip, i) => (
                  <View key={i} style={styles.tipRow}>
                    <FontAwesome5 name="star" size={10} color={colors.warningDark} solid style={{ marginTop: 4 }} />
                    <Text style={[styles.body, { flex: 1 }]}>{tip}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ))}
        <Button label={t("helpUi.close")} onPress={onClose} fullWidth style={{ marginTop: spacing.md }} />
      </ScrollView>
    </BottomSheet>
  );
};

/** The "?" button — always at the same place (top-right of the header). */
export const HelpButton = ({ target, style }: { target: HelpTarget | null; style?: object }) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  const [open, setOpen] = useState(false);
  if (!target) return null;
  return (
    <>
      <TouchableOpacity
        style={[styles.helpBtn, style]}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={t("helpUi.button")}
      >
        <FontAwesome5 name="question" size={11} color={colors.primary} />
        <Text style={styles.helpBtnText}>{t("helpUi.button")}</Text>
      </TouchableOpacity>
      <HelpSheet visible={open} onClose={() => setOpen(false)} target={target} />
    </>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    helpBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: `${colors.primary}66`,
      backgroundColor: `${colors.primary}14`,
    },
    helpBtnText: { fontSize: 11, fontWeight: "700", color: colors.primary },
    extraSection: { marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
    sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
    purposeBox: {
      flexDirection: "row",
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: `${colors.primary}12`,
      marginBottom: spacing.md,
    },
    label: { ...typography.caption, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", marginBottom: 6, letterSpacing: 0.4 },
    body: { ...typography.body, color: colors.text, fontSize: 14, lineHeight: 20 },
    stepRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", marginBottom: spacing.sm },
    stepNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: 1 },
    stepNumText: { color: colors.white, fontSize: 11, fontWeight: "700" },
    tipsBox: { marginTop: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: `${colors.warning}18`, gap: 4 },
    tipRow: { flexDirection: "row", gap: spacing.sm },
  });

export default HelpSheet;
