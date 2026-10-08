import React, { useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { ProgressBar, scoreColor } from "../../../../components/common/LearningUI";
import { radius, spacing, typography, useThemeColors } from "../../../../styles/theme";
import { fmtNote } from "../../../../services/api";
import type { ExerciceStat } from "../../../../services/api";
import { ExerciseProgramme } from "../../../../types";
import { formatDateTime, serverDateMs } from "../../../../utils/dates";
import { useT } from "../../../../i18n";

const fmt = (d?: string | null) =>
  d ? formatDateTime(d, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

interface Props {
  programme: ExerciseProgramme;
  stat?: ExerciceStat | null;
  statLoading?: boolean;
  /** Open the corrections of this programmed exercise. */
  onCorrect?: () => void;
  /** Extra line (class / course) for flat lists. */
  context?: string;
}

/** Professor view of one programmed exercise: deadline, rendus/attendus, à corriger, moyenne (min–max), link to corrections. */
const ProgrammedExerciseRow = ({ programme: ep, stat, statLoading, onCorrect, context }: Props) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  const isDevoir = ep.typeAssignation === "DEVOIR";
  const due = ep.dateFinExoEffectif;
  const past = !!due && serverDateMs(due, NaN) < Date.now();
  const ratio = stat && stat.attendus > 0 ? stat.rendus / stat.attendus : null;
  const toCorrect = stat?.enAttenteCorrection ?? 0;

  return (
    <View style={styles.row}>
      <View style={styles.head}>
        <View style={[styles.icon, { backgroundColor: isDevoir ? "rgba(139,92,246,0.14)" : "rgba(59,130,246,0.14)" }]}>
          <FontAwesome5 name={isDevoir ? "file-alt" : "book-open"} size={13} color={isDevoir ? colors.purple : colors.primary} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title} numberOfLines={2}>
            {ep.nom || t("devoirs.fallbackTitle")}
          </Text>
          {context ? (
            <Text style={styles.context} numberOfLines={1}>
              {context}
            </Text>
          ) : null}
          <View style={styles.metaRow}>
            <Text style={[styles.typeTag, { color: isDevoir ? colors.purple : colors.primary }]}>
              {isDevoir ? t("devoirs.tag") : t("learning.exerciseTag")}
            </Text>
            <FontAwesome5 name="clock" size={10} color={past ? colors.danger : colors.textMuted} />
            <Text style={[styles.meta, past && { color: colors.danger }]}>
              {past ? t("learning.prof.closedOn", { date: fmt(due) }) : t("learning.prof.dueOn", { date: fmt(due) })}
            </Text>
          </View>
        </View>
        {toCorrect > 0 ? (
          <View style={styles.toCorrect}>
            <Text style={styles.toCorrectText}>{t("learning.prof.toCorrectCount", { count: toCorrect })}</Text>
          </View>
        ) : null}
      </View>

      {statLoading && !stat ? (
        <View style={styles.inline}>
          <ActivityIndicator size="small" color={colors.textMuted} />
          <Text style={styles.meta}>{t("learning.prof.loadingStats")}</Text>
        </View>
      ) : stat ? (
        <View style={{ gap: 6 }}>
          <View style={styles.inline}>
            <Text style={styles.metric}>
              {t("learning.prof.submitted", { done: stat.rendus, total: stat.attendus > 0 ? stat.attendus : "—" })}
            </Text>
            <Text style={[styles.metric, { marginLeft: "auto", color: scoreColor(stat.moyenne != null ? stat.moyenne / 20 : null, colors) }]}>
              {t("learning.prof.average", { avg: fmtNote(stat.moyenne) })}
              {stat.min != null && stat.max != null ? ` (${fmtNote(stat.min)}–${fmtNote(stat.max)})` : ""}
            </Text>
          </View>
          {ratio != null ? <ProgressBar value={ratio * 100} color={scoreColor(ratio, colors)} height={6} /> : null}
        </View>
      ) : null}

      {onCorrect && (isDevoir || toCorrect > 0 || (stat?.rendus ?? 0) > 0) ? (
        <TouchableOpacity style={[styles.correctBtn, toCorrect > 0 && { backgroundColor: colors.purple }]} onPress={onCorrect} activeOpacity={0.85}>
          <FontAwesome5 name="clipboard-check" size={12} color={toCorrect > 0 ? "#FFFFFF" : colors.purple} />
          <Text style={[styles.correctText, toCorrect > 0 && styles.correctTextOn]}>
            {toCorrect > 0 ? t("learning.prof.correct") : t("learning.prof.viewCopies")}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    row: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    head: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
    icon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    title: { ...typography.bodyBold, color: colors.text },
    context: { ...typography.caption, color: colors.primary },
    metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 2 },
    typeTag: { ...typography.captionBold },
    meta: { ...typography.caption, color: colors.textMuted },
    inline: { flexDirection: "row", alignItems: "center", gap: 6 },
    metric: { ...typography.captionBold, color: colors.text },
    toCorrect: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, backgroundColor: colors.warning },
    toCorrectText: { ...typography.tiny, color: "#FFFFFF" },
    correctBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 8,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.purple,
    },
    correctText: { ...typography.captionBold, color: colors.purple },
    correctTextOn: { color: "#FFFFFF" },
  });

export default ProgrammedExerciseRow;
