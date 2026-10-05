import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FontAwesome5 } from "@expo/vector-icons";
import { Badge, EmptyState, LoadingSpinner } from "../../components/ui";
import { radius, spacing, typography, useThemeColors } from "../../styles/theme";
import { ClassEntity } from "../../types";
import { useT } from "../../i18n";
import { formatDate } from "../../utils/dates";
import { DEVOIR_STATUS_KEY, DevoirItem, ExerciseAttemptParams, ExerciseResultParams, loadDevoirs } from "../../utils/devoirs";

type FilterId = "all" | "todo" | "soumis" | "corriges";
const FILTERS: FilterId[] = ["all", "todo", "soumis", "corriges"];

const fmtDate = (d?: string) => formatDate(d, { day: "2-digit", month: "short", year: "numeric" }, "—");

interface DevoirsBodyProps {
  /** Whose homework: the student's own id, or (from Parent) the selected child's id. */
  userId: string | null;
  classes: ClassEntity[];
  classesLoading: boolean;
  /** Parent of an adult child (own account): list + copies only — the child answers himself (backend enforces it). */
  readOnly?: boolean;
  /** Parent view: the child's first name — a minor's homework is handed in by the parent on their behalf. */
  learnerName?: string;
  /** Extra line under the summary (e.g. who hands the homework in). */
  hint?: string;
  emptyMessage?: string;
  /** Re-fetch the classes too on refresh. */
  onRefreshClasses?: () => void;
}

/**
 * Homework tracker — mirrors web's StudentDevoirsContent.jsx: summary counts,
 * Tous / À rendre / Soumis / Corrigés filters, and one card per DEVOIR with
 * level, overdue flag, status (or due date), planned/due dates, subjects,
 * grade + appreciation once corrected, "waiting for correction" notice,
 * question count, and "Rendre le devoir" for anything not yet submitted.
 * The attempt opens as a full page (ExerciseAttempt); a submitted devoir
 * opens the read-only copy (ExerciseResult).
 */
const DevoirsBody = ({ userId, classes, classesLoading, readOnly = false, learnerName, hint, emptyMessage, onRefreshClasses }: DevoirsBodyProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const navigation = useNavigation<any>();
  const [devoirs, setDevoirs] = useState<DevoirItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterId>("all");

  const load = useCallback(
    async (mode: "initial" | "refresh" | "silent" = "initial") => {
      if (!userId || classesLoading) return;
      if (mode === "refresh") setRefreshing(true);
      else if (mode === "initial") setLoading(true);
      try {
        setDevoirs(await loadDevoirs(userId, classes));
      } catch {
        setDevoirs([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId, classes, classesLoading]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Coming back from the attempt / copy page: refresh statuses silently.
  useEffect(() => navigation.addListener("focus", () => load("silent")), [navigation, load]);

  const refresh = () => {
    if (onRefreshClasses) onRefreshClasses();
    else load("refresh");
  };

  const counts = useMemo(
    () => ({
      all: devoirs.length,
      todo: devoirs.filter((d) => !d.isSubmitted).length,
      soumis: devoirs.filter((d) => d.isSubmitted && !d.isGraded).length,
      corriges: devoirs.filter((d) => d.isGraded).length,
    }),
    [devoirs]
  );

  const filtered = devoirs.filter((d) => {
    if (filter === "todo") return !d.isSubmitted;
    if (filter === "soumis") return d.isSubmitted && !d.isGraded;
    if (filter === "corriges") return d.isGraded;
    return true;
  });

  const openAttempt = (d: DevoirItem) => {
    const params: ExerciseAttemptParams = {
      exerciseProgrammerId: d.programme.id,
      exerciseId: d.programme.exerciseId,
      title: d.programme.nom,
      description: d.programme.description,
      hasParticipation: !!d.participation,
      ...(learnerName && userId ? { learnerId: userId, learnerName } : {}),
    };
    navigation.navigate("ExerciseAttempt", params);
  };

  const openResult = (d: DevoirItem) => {
    if (!userId) return;
    const params: ExerciseResultParams = {
      exerciseProgrammerId: d.programme.id,
      exerciseId: d.programme.exerciseId,
      title: d.programme.nom,
      userId,
      etat: d.etat,
      note: d.participation?.note,
      appreciation: d.participation?.appreciation,
    };
    navigation.navigate("ExerciseResult", params);
  };

  const stats: { icon: string; value: number; label: string }[] = [
    { icon: "book", value: counts.all, label: t("devoirs.statDevoirs", { count: counts.all }) },
    { icon: "clock", value: counts.todo, label: t("devoirs.statTodo") },
    { icon: "check-circle", value: counts.soumis, label: t("devoirs.statSubmitted") },
    { icon: "trophy", value: counts.corriges, label: t("devoirs.statGraded", { count: counts.corriges }) },
  ];

  const tone = (d: DevoirItem) =>
    d.isGraded
      ? { border: colors.purple, bar: colors.purple }
      : d.isPending
        ? { border: colors.warning, bar: colors.warning }
        : d.isSubmitted
          ? { border: colors.primaryMid, bar: colors.primary }
          : d.overdue
            ? { border: colors.danger, bar: colors.danger }
            : { border: colors.border, bar: colors.border };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />}
    >
      <View style={styles.summary}>
        <View style={styles.summaryHead}>
          <FontAwesome5 name="file-alt" size={16} color="#FFFFFF" />
          <Text style={styles.summaryText}>{hint ?? t("devoirs.subtitle")}</Text>
          <TouchableOpacity onPress={refresh} style={styles.refreshButton} accessibilityLabel={t("devoirs.refresh")}>
            <FontAwesome5 name="sync-alt" size={12} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <View style={styles.statsRow}>
          {stats.map((s) => (
            <View key={s.icon} style={styles.stat}>
              <FontAwesome5 name={s.icon} size={11} color="#FFFFFF" />
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
        {FILTERS.map((f) => {
          const active = filter === f;
          return (
            <TouchableOpacity key={f} style={[styles.filterChip, active && styles.filterChipActive]} onPress={() => setFilter(f)}>
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{t(`devoirs.filters.${f}`)}</Text>
              <View style={[styles.countPill, active && styles.countPillActive]}>
                <Text style={[styles.countText, active && styles.countTextActive]}>{counts[f]}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.list}>
        {!userId ? (
          <EmptyState icon="child" title={t("devoirs.noChildTitle")} message={emptyMessage ?? t("devoirs.noChild")} />
        ) : loading || classesLoading ? (
          <LoadingSpinner label={t("devoirs.loading")} />
        ) : filtered.length === 0 ? (
          <EmptyState icon="file-alt" title={t("devoirs.emptyTitle")} message={filter === "all" ? t("devoirs.emptyAll") : t("devoirs.emptyFilter")} />
        ) : (
          filtered.map((d) => {
            const ep = d.programme;
            const c = tone(d);
            const questionCount = (ep.questions ?? []).length;
            return (
              <TouchableOpacity
                key={ep.id}
                style={[styles.card, { borderColor: c.border }]}
                activeOpacity={0.8}
                disabled={!d.isSubmitted && readOnly}
                onPress={() => (d.isSubmitted ? openResult(d) : openAttempt(d))}
              >
                <View style={[styles.cardBar, { backgroundColor: c.bar }]} />
                <View style={styles.cardTop}>
                  <View style={styles.badges}>
                    <Badge label={t("devoirs.tag")} tone="info" />
                    {ep.niveau ? <Badge label={ep.niveau} tone="neutral" /> : null}
                    {d.overdue ? <Badge label={t("devoirs.overdue")} tone="danger" /> : null}
                  </View>
                  {d.etat ? (
                    <Badge
                      label={DEVOIR_STATUS_KEY[d.etat] ? t(DEVOIR_STATUS_KEY[d.etat]) : d.etat}
                      tone={d.isGraded ? "success" : d.isPending || d.etat === "EN_COURS" ? "warning" : "info"}
                    />
                  ) : (
                    <View style={styles.dueRow}>
                      <FontAwesome5 name="calendar-alt" size={10} color={colors.textMuted} />
                      <Text style={styles.small}>{fmtDate(ep.dateFinExoEffectif)}</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.cardTitle}>{ep.nom || t("devoirs.fallbackTitle")}</Text>
                {ep.description ? (
                  <Text style={styles.cardDescription} numberOfLines={2}>
                    {ep.description}
                  </Text>
                ) : null}

                <View style={styles.dates}>
                  <View style={styles.dueRow}>
                    <FontAwesome5 name="calendar-alt" size={10} color={colors.textMuted} />
                    <Text style={styles.small}>{t("devoirs.planned", { date: fmtDate(ep.dateExoPrevue) })}</Text>
                  </View>
                  <View style={styles.dueRow}>
                    <FontAwesome5 name="clock" size={10} color={d.overdue ? colors.danger : colors.textMuted} />
                    <Text style={[styles.small, d.overdue && { color: colors.danger }]}>{t("devoirs.dueBefore", { date: fmtDate(ep.dateFinExoEffectif) })}</Text>
                  </View>
                </View>

                {ep.matieres && ep.matieres.length > 0 ? (
                  <View style={styles.subjects}>
                    {ep.matieres.slice(0, 3).map((m) => (
                      <View key={m.id} style={styles.subject}>
                        <Text style={styles.subjectText}>{m.nom}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {d.isGraded && d.participation?.note ? (
                  <View style={styles.gradeBox}>
                    <FontAwesome5 name="trophy" size={12} color={colors.purple} />
                    <Text style={styles.gradeText}>{d.participation.note}</Text>
                    {d.participation.appreciation ? (
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
                    <TouchableOpacity style={[styles.action, { backgroundColor: d.overdue ? colors.danger : colors.primary }]} onPress={() => openAttempt(d)}>
                      <FontAwesome5 name="play-circle" size={12} color="#FFFFFF" />
                      <Text style={styles.actionText}>{learnerName ? t("devoirs.submitForChild", { name: learnerName }) : t("devoirs.submit")}</Text>
                    </TouchableOpacity>
                  ) : d.isSubmitted ? (
                    <TouchableOpacity style={styles.actionGhost} onPress={() => openResult(d)}>
                      <FontAwesome5 name={d.isGraded ? "check-double" : "eye"} size={12} color={colors.primary} />
                      <Text style={styles.actionGhostText}>
                        {d.isGraded ? t("devoirs.viewCorrection") : readOnly || learnerName ? t("devoirs.viewChildCopy") : t("devoirs.viewCopy")}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={[styles.small, styles.italic]}>{t("devoirs.childTodo", { name: learnerName || t("devoirs.theStudent") })}</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>
    </ScrollView>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: { flex: 1 },
    italic: { fontStyle: "italic" },
    summary: { marginHorizontal: 16, marginBottom: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.primaryDark },
    summaryHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
    summaryText: { ...typography.caption, color: "#FFFFFF", opacity: 0.9, flex: 1 },
    refreshButton: { padding: spacing.sm, borderRadius: radius.sm, backgroundColor: "rgba(255,255,255,0.15)" },
    statsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    stat: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: "rgba(255,255,255,0.15)" },
    statValue: { ...typography.captionBold, color: "#FFFFFF" },
    statLabel: { ...typography.caption, color: "#FFFFFF", opacity: 0.85 },
    filterRow: { flexGrow: 0, marginBottom: spacing.md },
    filterContent: { paddingHorizontal: 16, gap: spacing.sm },
    filterChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterText: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
    filterTextActive: { color: "#FFFFFF" },
    countPill: { minWidth: 20, paddingHorizontal: 5, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceElevated },
    countPillActive: { backgroundColor: "rgba(255,255,255,0.25)" },
    countText: { ...typography.tiny, color: colors.textMuted },
    countTextActive: { color: "#FFFFFF" },
    list: { paddingHorizontal: 16 },
    card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, paddingTop: spacing.md + 3, marginBottom: spacing.md, overflow: "hidden" },
    cardBar: { position: "absolute", top: 0, left: 0, right: 0, height: 3 },
    cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
    badges: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, flex: 1 },
    dueRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    small: { ...typography.caption, color: colors.textMuted },
    cardTitle: { ...typography.bodyBold, color: colors.text, marginBottom: 2 },
    cardDescription: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
    dates: { flexDirection: "row", flexWrap: "wrap", columnGap: spacing.md, rowGap: 2, marginBottom: spacing.sm },
    subjects: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.sm },
    subject: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full, borderWidth: 1, borderColor: colors.purple },
    subjectText: { ...typography.caption, color: colors.purple },
    gradeBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.purple, marginBottom: spacing.sm },
    gradeText: { ...typography.captionBold, color: colors.purple },
    appreciation: { ...typography.caption, color: colors.textMuted, fontStyle: "italic", flex: 1 },
    pendingBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.warning, marginBottom: spacing.sm },
    pendingText: { ...typography.caption, color: colors.warningDark, flex: 1 },
    footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
    action: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.sm },
    actionText: { ...typography.captionBold, color: "#FFFFFF" },
    actionGhost: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.primary },
    actionGhostText: { ...typography.captionBold, color: colors.primary },
  });

export default DevoirsBody;
