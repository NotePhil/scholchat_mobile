import React, { useCallback, useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Badge } from "../../components/ui";
import { radius, spacing, typography, useThemeColors } from "../../styles/theme";
import { useT } from "../../i18n";
import { formatDate } from "../../utils/dates";
import { DEVOIR_STATUS_KEY, DevoirItem, ExerciseAttemptParams, ExerciseResultParams } from "../../utils/devoirs";

const fmtDate = (d?: string) => formatDate(d, { day: "2-digit", month: "short", year: "numeric" }, "—");

/**
 * Opens the attempt page (ExerciseAttempt) or the read-only copy (ExerciseResult)
 * of a learner's programmed exercise. `learnerName` = a parent answering for a minor child.
 */
export const useDevoirNavigation = (userId: string | null | undefined, learnerName?: string) => {
  const navigation = useNavigation<any>();
  const openAttempt = useCallback(
    (d: DevoirItem) => {
      const params: ExerciseAttemptParams = {
        exerciseProgrammerId: d.programme.id,
        exerciseId: d.programme.exerciseId,
        title: d.programme.nom,
        description: d.programme.description,
        hasParticipation: !!d.participation,
        ...(learnerName && userId ? { learnerId: userId, learnerName } : {}),
      };
      navigation.navigate("ExerciseAttempt", params);
    },
    [navigation, userId, learnerName]
  );
  const openResult = useCallback(
    (d: DevoirItem) => {
      if (!userId) return;
      const params: ExerciseResultParams = {
        exerciseProgrammerId: d.programme.id,
        exerciseId: d.programme.exerciseId,
        title: d.programme.nom,
        userId,
        etat: d.etat,
        note: d.participation?.note != null ? String(d.participation.note) : undefined,
        appreciation: d.participation?.appreciation,
      };
      navigation.navigate("ExerciseResult", params);
    },
    [navigation, userId]
  );
  return { openAttempt, openResult };
};

interface Props {
  item: DevoirItem;
  /** Parent of an adult child: list + copies only. */
  readOnly?: boolean;
  /** Parent view: the child's first name. */
  learnerName?: string;
  onAttempt: (d: DevoirItem) => void;
  onResult: (d: DevoirItem) => void;
  /** Show the class / course line (flat lists). */
  showContext?: boolean;
}

/** One programmed exercise / homework of a learner: status, deadlines, note, Faire / Voir la copie. */
const DevoirCard = ({ item: d, readOnly = false, learnerName, onAttempt, onResult, showContext = false }: Props) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  const ep = d.programme;
  const isDevoir = ep.typeAssignation === "DEVOIR";
  const questionCount = (ep.questions ?? []).length || (typeof ep.nbQuestions === "number" ? ep.nbQuestions : 0);
  const c = d.isGraded
    ? { border: colors.purple, bar: colors.purple }
    : d.isPending
      ? { border: colors.warning, bar: colors.warning }
      : d.isSubmitted
        ? { border: colors.primaryMid, bar: colors.primary }
        : d.overdue
          ? { border: colors.danger, bar: colors.danger }
          : { border: colors.border, bar: colors.border };
  const note = d.participation?.note;

  return (
    <TouchableOpacity
      style={[styles.card, { borderColor: c.border }]}
      activeOpacity={0.8}
      disabled={!d.isSubmitted && readOnly}
      onPress={() => (d.isSubmitted ? onResult(d) : onAttempt(d))}
    >
      <View style={[styles.cardBar, { backgroundColor: c.bar }]} />
      <View style={styles.cardTop}>
        <View style={styles.badges}>
          <Badge label={isDevoir ? t("devoirs.tag") : t("learning.exerciseTag")} tone={isDevoir ? "info" : "neutral"} />
          {ep.niveau ? <Badge label={ep.niveau} tone="neutral" /> : null}
          {d.overdue ? <Badge label={t("devoirs.overdue")} tone="danger" /> : null}
        </View>
        {d.etat ? (
          <Badge
            label={DEVOIR_STATUS_KEY[d.etat] ? t(DEVOIR_STATUS_KEY[d.etat]) : d.etat}
            tone={d.isGraded ? "success" : d.isPending || d.etat === "EN_COURS" ? "warning" : "info"}
          />
        ) : (
          <Badge label={t("learning.status.todo")} tone={d.overdue ? "danger" : "warning"} />
        )}
      </View>

      <Text style={styles.cardTitle}>{ep.nom || t("devoirs.fallbackTitle")}</Text>
      {showContext && (d.classeNom || d.coursTitre || d.coursId === null) ? (
        <Text style={styles.context} numberOfLines={1}>
          {[d.classeNom, d.coursTitre || (d.coursId ? null : t(d.programme.typeAssignation === "DEVOIR" ? "learning.generalDevoirs" : "learning.generalExercises"))].filter(Boolean).join(" · ")}
        </Text>
      ) : null}
      {ep.description ? (
        <Text style={styles.cardDescription} numberOfLines={2}>
          {ep.description}
        </Text>
      ) : null}

      <View style={styles.dates}>
        {ep.dateExoPrevue ? (
          <View style={styles.dueRow}>
            <FontAwesome5 name="calendar-alt" size={10} color={colors.textMuted} />
            <Text style={styles.small}>{t("devoirs.planned", { date: fmtDate(ep.dateExoPrevue) })}</Text>
          </View>
        ) : null}
        <View style={styles.dueRow}>
          <FontAwesome5 name="clock" size={10} color={d.overdue ? colors.danger : colors.textMuted} />
          <Text style={[styles.small, d.overdue && { color: colors.danger, fontWeight: "700" }]}>
            {t("devoirs.dueBefore", { date: fmtDate(ep.dateFinExoEffectif) })}
          </Text>
        </View>
      </View>

      {d.isGraded && note != null && String(note).trim() !== "" ? (
        <View style={styles.gradeBox}>
          <FontAwesome5 name="trophy" size={12} color={colors.purple} />
          <Text style={styles.gradeText}>{t("learning.note", { note: String(note) })}</Text>
          {d.participation?.appreciation ? (
            <Text style={styles.appreciation} numberOfLines={1}>
              "{d.participation.appreciation}"
            </Text>
          ) : null}
        </View>
      ) : null}

      {d.isPending ? (
        <View style={styles.pendingBox}>
          <FontAwesome5 name="clock" size={12} color={colors.warningDark} />
          <Text style={styles.pendingText}>{t("devoirs.pendingCorrection")}</Text>
        </View>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.small}>{questionCount > 0 ? t("devoirs.questionCount", { count: questionCount }) : ""}</Text>
        {!d.isSubmitted && !readOnly ? (
          <TouchableOpacity style={[styles.action, { backgroundColor: d.overdue ? colors.danger : colors.primary }]} onPress={() => onAttempt(d)}>
            <FontAwesome5 name="play-circle" size={12} color="#FFFFFF" />
            <Text style={styles.actionText}>
              {learnerName ? t("devoirs.submitForChild", { name: learnerName }) : isDevoir ? t("devoirs.submit") : t("learning.do")}
            </Text>
          </TouchableOpacity>
        ) : d.isSubmitted ? (
          <TouchableOpacity style={styles.actionGhost} onPress={() => onResult(d)}>
            <FontAwesome5 name={d.isGraded ? "check-double" : "eye"} size={12} color={colors.primary} />
            <Text style={styles.actionGhostText}>
              {d.isGraded ? t("devoirs.viewCorrection") : readOnly || learnerName ? t("devoirs.viewChildCopy") : t("devoirs.viewCopy")}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={[styles.small, { fontStyle: "italic" }]}>{t("devoirs.childTodo", { name: learnerName || t("devoirs.theStudent") })}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      padding: spacing.md,
      paddingTop: spacing.md + 3,
      marginBottom: spacing.md,
      overflow: "hidden",
    },
    cardBar: { position: "absolute", top: 0, left: 0, right: 0, height: 3 },
    cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
    badges: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, flex: 1 },
    dueRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    small: { ...typography.caption, color: colors.textMuted },
    context: { ...typography.caption, color: colors.primary, marginBottom: 2 },
    cardTitle: { ...typography.bodyBold, color: colors.text, marginBottom: 2 },
    cardDescription: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
    dates: { flexDirection: "row", flexWrap: "wrap", columnGap: spacing.md, rowGap: 2, marginBottom: spacing.sm },
    gradeBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      padding: spacing.sm,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.purple,
      marginBottom: spacing.sm,
    },
    gradeText: { ...typography.captionBold, color: colors.purple },
    appreciation: { ...typography.caption, color: colors.textMuted, fontStyle: "italic", flex: 1 },
    pendingBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      padding: spacing.sm,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.warning,
      marginBottom: spacing.sm,
    },
    pendingText: { ...typography.caption, color: colors.warningDark, flex: 1 },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    action: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.sm },
    actionText: { ...typography.captionBold, color: "#FFFFFF" },
    actionGhost: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: 7,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    actionGhostText: { ...typography.captionBold, color: colors.primary },
  });

export default DevoirCard;
