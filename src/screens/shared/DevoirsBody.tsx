import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FontAwesome5 } from "@expo/vector-icons";
import { EmptyState, LoadingSpinner } from "../../components/ui";
import { CollapsibleHeader, CountPill } from "../../components/common/LearningUI";
import { radius, spacing, typography, useThemeColors } from "../../styles/theme";
import { ClassEntity } from "../../types";
import { useT } from "../../i18n";
import { DevoirItem, loadDevoirs } from "../../utils/devoirs";
import { GENERAL_COURSE_ID } from "../../utils/classCourses";
import DevoirCard, { useDevoirNavigation } from "./DevoirCard";

type FilterId = "all" | "todo" | "soumis" | "corriges" | "retard";
const FILTERS: FilterId[] = ["all", "todo", "soumis", "corriges", "retard"];

const matches = (d: DevoirItem, f: FilterId) => {
  if (f === "todo") return !d.isSubmitted;
  if (f === "soumis") return d.isSubmitted && !d.isGraded;
  if (f === "corriges") return d.isGraded;
  if (f === "retard") return d.overdue;
  return true;
};

interface DevoirsBodyProps {
  /** Whose homework: the student's own id, or (from Parent) the selected child's id. */
  userId: string | null;
  classes: ClassEntity[];
  classesLoading: boolean;
  /** The classes request failed (error + retry instead of an empty list). */
  classesError?: string;
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

interface CourseGroup {
  key: string;
  coursId: string | null;
  titre: string;
  items: DevoirItem[];
}
interface ClassGroup {
  key: string;
  nom: string;
  courses: CourseGroup[];
  total: number;
}

/**
 * Homework tracker (web: StudentDevoirsContent.jsx): summary counts,
 * Tous / À faire / Rendus / Corrigés / En retard filters, and the homework
 * grouped by class then by course (collapsible; "Devoirs généraux (sans cours)"
 * for homework without a course). DEVOIR only: EXERCICE-type programmations
 * are shown inside the courses (class → course → exercises), each card with deadline, status and note.
 * The attempt opens as a full page (ExerciseAttempt); a submitted devoir
 * opens the read-only copy (ExerciseResult).
 */
const DevoirsBody = ({
  userId,
  classes,
  classesLoading,
  classesError,
  readOnly = false,
  learnerName,
  hint,
  emptyMessage,
  onRefreshClasses,
}: DevoirsBodyProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const navigation = useNavigation<any>();
  const { openAttempt, openResult } = useDevoirNavigation(userId, learnerName);
  const [devoirs, setDevoirs] = useState<DevoirItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterId>("all");
  /** Collapsed groups ("c:<classId>" / "k:<classId>:<courseId>"); everything is open by default. */
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const seqRef = useRef(0);

  const load = useCallback(
    async (mode: "initial" | "refresh" | "silent" = "initial") => {
      if (!userId || classesLoading) return;
      const seq = ++seqRef.current;
      if (mode === "refresh") setRefreshing(true);
      else if (mode === "initial") setLoading(true);
      if (mode !== "silent") setError("");
      try {
        const list = await loadDevoirs(userId, classes);
        if (seq !== seqRef.current) return;
        setDevoirs(list);
        setError("");
      } catch (e) {
        if (seq !== seqRef.current) return;
        // A silent refresh keeps the current list.
        if (mode !== "silent") setError(e instanceof Error && e.message ? e.message : t("devoirs.loadError"));
      } finally {
        if (seq === seqRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [userId, classes, classesLoading, t]
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

  const counts = useMemo(() => {
    const c = {} as Record<FilterId, number>;
    FILTERS.forEach((f) => {
      c[f] = devoirs.filter((d) => matches(d, f)).length;
    });
    return c;
  }, [devoirs]);

  const groups = useMemo<ClassGroup[]>(() => {
    const filtered = devoirs.filter((d) => matches(d, filter));
    const byClass = new Map<string, ClassGroup>();
    filtered.forEach((d) => {
      const ck = d.classeId ?? "?";
      let g = byClass.get(ck);
      if (!g) {
        g = { key: ck, nom: d.classeNom || t("parentClasses.classFallback"), courses: [], total: 0 };
        byClass.set(ck, g);
      }
      const kk = d.coursId ?? GENERAL_COURSE_ID;
      let cg = g.courses.find((x) => x.key === kk);
      if (!cg) {
        cg = { key: kk, coursId: d.coursId, titre: d.coursTitre || (d.coursId ? t("learning.course") : t("learning.generalDevoirs")), items: [] };
        g.courses.push(cg);
      }
      cg.items.push(d);
      g.total += 1;
    });
    const out = Array.from(byClass.values());
    out.forEach((g) =>
      g.courses.sort((a, b) => (a.coursId ? 0 : 1) - (b.coursId ? 0 : 1) || a.titre.localeCompare(b.titre))
    );
    // Keep the order of the classes prop.
    const order = new Map(classes.map((c, i) => [String(c.id), i]));
    return out.sort((a, b) => (order.get(a.key) ?? 999) - (order.get(b.key) ?? 999));
  }, [devoirs, filter, classes, t]);

  const toggle = (key: string) => setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  const stats: { icon: string; value: number; label: string }[] = [
    { icon: "book", value: devoirs.length, label: t("devoirs.statDevoirs", { count: devoirs.length }) },
    { icon: "clock", value: counts.todo, label: t("devoirs.statTodo") },
    { icon: "check-circle", value: counts.soumis, label: t("devoirs.statSubmitted") },
    { icon: "trophy", value: counts.corriges, label: t("devoirs.statGraded", { count: counts.corriges }) },
    { icon: "exclamation-circle", value: counts.retard, label: t("devoirs.statOverdue") },
  ];

  const subtitleOf = (items: DevoirItem[]) => {
    const todo = items.filter((d) => !d.isSubmitted).length;
    const late = items.filter((d) => d.overdue).length;
    const parts = [t("learning.groups.items", { count: items.length })];
    if (todo) parts.push(t("learning.groups.todo", { count: todo }));
    if (late) parts.push(t("learning.groups.late", { count: late }));
    return parts.join(" · ");
  };

  const renderContent = () => {
    if (!userId) return <EmptyState icon="child" title={t("devoirs.noChildTitle")} message={emptyMessage ?? t("devoirs.noChild")} />;
    if (classesError && !classesLoading && classes.length === 0) {
      return (
        <EmptyState
          icon="exclamation-triangle"
          title={t("classDetails.error.classes")}
          message={classesError}
          actionLabel={t("classDetails.retry")}
          onAction={refresh}
        />
      );
    }
    if ((loading || classesLoading) && !refreshing) return <LoadingSpinner label={t("devoirs.loading")} />;
    if (error && devoirs.length === 0) {
      return (
        <EmptyState
          icon="exclamation-triangle"
          title={t("devoirs.loadError")}
          message={error}
          actionLabel={t("classDetails.retry")}
          onAction={() => load("initial")}
        />
      );
    }
    if (groups.length === 0) {
      return <EmptyState icon="file-alt" title={t("devoirs.emptyTitle")} message={filter === "all" ? t("devoirs.emptyAll") : t("devoirs.emptyFilter")} />;
    }
    return groups.map((g) => {
      const classKey = `c:${g.key}`;
      const classOpen = !collapsed[classKey];
      return (
        <View key={g.key} style={styles.classGroup}>
          <CollapsibleHeader
            title={g.nom}
            icon="graduation-cap"
            open={classOpen}
            onToggle={() => toggle(classKey)}
            subtitle={subtitleOf(g.courses.flatMap((c) => c.items))}
            right={<CountPill value={g.total} />}
          />
          {classOpen
            ? g.courses.map((cg) => {
                const courseKey = `k:${g.key}:${cg.key}`;
                const open = !collapsed[courseKey];
                const late = cg.items.filter((d) => d.overdue).length;
                return (
                  <View key={cg.key} style={styles.courseGroup}>
                    <CollapsibleHeader
                      level={2}
                      title={cg.titre}
                      icon={cg.coursId ? "book" : "layer-group"}
                      open={open}
                      onToggle={() => toggle(courseKey)}
                      subtitle={subtitleOf(cg.items)}
                      right={<CountPill value={cg.items.length} color={late ? colors.danger : colors.purple} />}
                    />
                    {open
                      ? cg.items.map((d) => (
                          <DevoirCard
                            key={d.programme.id}
                            item={d}
                            readOnly={readOnly}
                            learnerName={learnerName}
                            onAttempt={openAttempt}
                            onResult={openResult}
                          />
                        ))
                      : null}
                  </View>
                );
              })
            : null}
        </View>
      );
    });
  };

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
          const danger = f === "retard" && counts.retard > 0;
          return (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, active && styles.filterChipActive, active && danger && { backgroundColor: colors.danger, borderColor: colors.danger }]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{t(`devoirs.filters.${f}`)}</Text>
              <View style={[styles.countPill, active && styles.countPillActive]}>
                <Text style={[styles.countText, active && styles.countTextActive, !active && danger && { color: colors.danger }]}>{counts[f]}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {error && devoirs.length > 0 ? (
        <View style={styles.errorBanner}>
          <FontAwesome5 name="exclamation-circle" size={13} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => load("refresh")}>
            <Text style={styles.retryLink}>{t("classDetails.retry")}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.list}>{renderContent()}</View>
    </ScrollView>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: { flex: 1 },
    summary: { marginHorizontal: 16, marginBottom: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.primaryDark },
    summaryHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
    summaryText: { ...typography.caption, color: "#FFFFFF", opacity: 0.9, flex: 1 },
    refreshButton: { padding: spacing.sm, borderRadius: radius.sm, backgroundColor: "rgba(255,255,255,0.15)" },
    statsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    stat: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      borderRadius: radius.sm,
      backgroundColor: "rgba(255,255,255,0.15)",
    },
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
    countPill: {
      minWidth: 20,
      paddingHorizontal: 5,
      height: 18,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceElevated,
    },
    countPillActive: { backgroundColor: "rgba(255,255,255,0.25)" },
    countText: { ...typography.tiny, color: colors.textMuted },
    countTextActive: { color: "#FFFFFF" },
    errorBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginHorizontal: 16,
      marginBottom: spacing.md,
      padding: spacing.sm,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.danger,
    },
    errorText: { ...typography.caption, color: colors.danger, flex: 1 },
    retryLink: { ...typography.captionBold, color: colors.primary },
    list: { paddingHorizontal: 16 },
    classGroup: { marginBottom: spacing.md, gap: spacing.sm },
    courseGroup: { paddingLeft: spacing.sm },
  });

export default DevoirsBody;
