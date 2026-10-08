import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { typography, useThemeColors } from "../../../../styles/theme";
import { useUiStore } from "../../../../store/useUiStore";
import { useT } from "../../../../i18n";

/** Opens the course programming form of the professor dashboard, with this class pre-selected. */
export const openCourseProgramming = (classeId?: string | null) => {
  const ui = useUiStore.getState();
  ui.requestScheduleCourse(classeId || "");
  ui.requestTab("cours");
};

interface Props {
  classeId?: string | null;
  /** Class name, shown when several classes are listed. */
  classeNom?: string | null;
  /** Called before navigating (e.g. to close the sheet / form hosting the notice). */
  onNavigate?: () => void;
}

/**
 * A class without any programmed course: an exercise / homework must belong to a course, so the
 * teacher has to program one first. Shows the message and a "Programmer un cours" shortcut.
 */
const NoCourseNotice = ({ classeId, classeNom, onNavigate }: Props) => {
  const colors = useThemeColors();
  const { t } = useT();
  return (
    <View style={styles.row}>
      <Text style={[styles.text, { color: colors.warningDark }]}>
        {classeNom ? `${classeNom} : ` : ""}
        {t("learning.schedule.noCourses")}
      </Text>
      <TouchableOpacity
        onPress={() => {
          onNavigate?.();
          openCourseProgramming(classeId);
        }}
        style={styles.link}
        activeOpacity={0.8}
        accessibilityRole="button"
      >
        <FontAwesome5 name="calendar-plus" size={11} color={colors.primary} />
        <Text style={[styles.linkText, { color: colors.primary }]}>{t("learning.schedule.scheduleCourseShortcut")}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { marginTop: 4, gap: 4 },
  text: { ...typography.caption },
  link: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingVertical: 4 },
  linkText: { ...typography.captionBold },
});

export default NoCourseNotice;
