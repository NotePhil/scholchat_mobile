import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { BarChart as KitBarChart } from "react-native-chart-kit";
import { BarChart, ProgressBar, SectionState, StatTile, scoreColor } from "../../../../components/common/LearningUI";
import { radius, spacing, typography, useThemeColors } from "../../../../styles/theme";
import { fmtNote, learningService, pct } from "../../../../services/api";
import type { ClasseStatistiques, EleveStat } from "../../../../services/api";
import { useT } from "../../../../i18n";

type SortKey = "name" | "progress" | "average" | "late";
const SORTS: SortKey[] = ["name", "progress", "average", "late"];

interface Props {
  classId: string;
  /** Open the corrections of a programmed exercise. */
  onOpenCorrections?: (exerciseProgrammerId: string) => void;
  refreshKey?: number;
}

const short = (s: string, n = 9) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * Professor ClassDetails "Statistiques" tab (GET /classes/{id}/statistiques):
 * summary tiles, per course (average progress, per exercise rendus/attendus,
 * copies to correct, average / min / max) and per student (progress,
 * homework, average, overdue) with sorting.
 */
const ClassStatsTab = ({ classId, onOpenCorrections, refreshKey = 0 }: Props) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [data, setData] = useState<ClasseStatistiques | null>(null);
  const [view, setView] = useState<"courses" | "students">("courses");
  const [sort, setSort] = useState<SortKey>("name");
  const [openCourse, setOpenCourse] = useState<Record<string, boolean>>({});
  const seq = useRef(0);

  const load = useCallback(async () => {
    const s = ++seq.current;
    setStatus((p) => (p === "ready" ? "ready" : "loading"));
    setError("");
    try {
      const d = await learningService.getClassStatistics(classId);
      if (s !== seq.current) return;
      setData(d);
      setStatus("ready");
    } catch (e) {
      if (s !== seq.current) return;
      setError(e instanceof Error ? e.message : "");
      setStatus("error");
    }
  }, [classId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const students = useMemo(() => {
    const list = [...(data?.eleves ?? [])];
    const name = (e: EleveStat) => `${e.nom ?? ""} ${e.prenom ?? ""}`.trim().toLowerCase();
    list.sort((a, b) => {
      if (sort === "progress") return b.progressionMoyenne - a.progressionMoyenne;
      if (sort === "average") return (b.moyenne ?? -1) - (a.moyenne ?? -1);
      if (sort === "late") return b.enRetard - a.enRetard;
      return name(a).localeCompare(name(b));
    });
    return list;
  }, [data, sort]);

  if (status !== "ready" || !data) {
    return (
      <View style={styles.card}>
        <SectionState
          status={status === "ready" ? "loading" : status}
          loadingLabel={t("learning.stats.loading")}
          errorLabel={t("learning.errors.statistics")}
          message={error}
          onRetry={load}
        />
      </View>
    );
  }

  const allEx = data.cours.flatMap((c) => c.exercices);
  const toCorrect = allEx.reduce((n, e) => n + e.enAttenteCorrection, 0);
  const progressAvg = data.cours.length ? data.cours.reduce((s, c) => s + pct(c.progressionMoyenne), 0) / data.cours.length : 0;
  const avgs = data.eleves.map((e) => e.moyenne).filter((m): m is number => m != null);
  const classAvg = avgs.length ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null;
  const lateStudents = data.eleves.filter((e) => e.enRetard > 0).length;
  const chartWidth = Dimensions.get("window").width - 32 - 2 * spacing.md - 2;

  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.tiles}>
        <StatTile icon="user-friends" value={data.effectif} label={t("learning.stats.effectif")} color={colors.primary} />
        <StatTile icon="chart-line" value={`${Math.round(progressAvg)}%`} label={t("learning.stats.progress")} color={colors.teal} />
        <StatTile icon="clipboard-check" value={toCorrect} label={t("learning.stats.toCorrect")} color={toCorrect ? colors.warning : colors.success} />
        <StatTile
          icon="trophy"
          value={classAvg == null ? "—" : `${fmtNote(classAvg)}/20`}
          label={t("learning.stats.average")}
          color={classAvg == null ? colors.textMuted : scoreColor(classAvg / 20, colors)}
          sub={lateStudents ? t("learning.stats.lateStudents", { count: lateStudents }) : undefined}
        />
      </View>

      <View style={styles.segment}>
        {(["courses", "students"] as const).map((k) => (
          <TouchableOpacity key={k} style={[styles.segBtn, view === k && styles.segBtnOn]} onPress={() => setView(k)} accessibilityRole="tab">
            <FontAwesome5 name={k === "courses" ? "book" : "user-graduate"} size={11} color={view === k ? "#FFFFFF" : colors.textMuted} />
            <Text style={[styles.segText, view === k && { color: "#FFFFFF" }]}>{t(k === "courses" ? "learning.stats.byCourse" : "learning.stats.byStudent")}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {view === "courses" ? (
        <>
          {data.cours.length > 1 ? (
            <View style={styles.card}>
              <Text style={styles.title}>{t("learning.stats.progressChart")}</Text>
              <KitBarChart
                data={{ labels: data.cours.map((c) => short(c.titre || t("learning.generalExercises"))), datasets: [{ data: data.cours.map((c) => pct(c.progressionMoyenne)) }] }}
                width={chartWidth}
                height={190}
                fromZero
                yAxisLabel=""
                yAxisSuffix="%"
                withInnerLines={false}
                chartConfig={{
                  backgroundGradientFrom: colors.surface,
                  backgroundGradientTo: colors.surface,
                  decimalPlaces: 0,
                  color: (o = 1) => `rgba(59, 130, 246, ${o})`,
                  labelColor: () => colors.textMuted,
                  barPercentage: 0.6,
                }}
                style={{ borderRadius: radius.md, marginLeft: -12 }}
              />
            </View>
          ) : null}
          {data.cours.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.muted}>{t("learning.stats.noCourses")}</Text>
            </View>
          ) : (
            data.cours.map((c) => {
              const key = c.coursId ?? "general";
              const open = openCourse[key] ?? true;
              const p = pct(c.progressionMoyenne);
              return (
                <View key={key} style={styles.card}>
                  <TouchableOpacity style={styles.rowHead} onPress={() => setOpenCourse((o) => ({ ...o, [key]: !open }))} activeOpacity={0.8}>
                    <FontAwesome5 name={open ? "chevron-down" : "chevron-right"} size={11} color={colors.textMuted} />
                    <FontAwesome5 name={c.coursId ? "book" : "layer-group"} size={12} color={colors.primary} />
                    <Text style={[styles.title, { flex: 1 }]} numberOfLines={2}>
                      {c.titre || (c.coursId ? t("learning.course") : t("learning.generalExercises"))}
                    </Text>
                    {c.coursId ? <Text style={[styles.pctText, { color: scoreColor(p / 100, colors) }]}>{p}%</Text> : null}
                  </TouchableOpacity>
                  {c.coursId ? <ProgressBar value={p} color={scoreColor(p / 100, colors)} /> : null}
                  {c.coursId ? <Text style={styles.muted}>{t("learning.stats.courseProgress", { pct: p })}</Text> : null}
                  {open ? (
                    c.exercices.length === 0 ? (
                      <Text style={styles.muted}>{t("learning.classCourses.noExercises")}</Text>
                    ) : (
                      <>
                        {c.exercices.some((e) => e.moyenne != null) ? (
                          <BarChart
                            max={20}
                            format={(v) => fmtNote(v)}
                            rows={c.exercices.map((e) => ({
                              key: e.exerciseProgrammerId,
                              label: e.titre || t("devoirs.fallbackTitle"),
                              value: e.moyenne,
                              color: scoreColor(e.moyenne != null ? e.moyenne / 20 : null, colors),
                            }))}
                          />
                        ) : null}
                        {c.exercices.map((e) => {
                          const ratio = e.attendus > 0 ? e.rendus / e.attendus : 0;
                          return (
                            <View key={e.exerciseProgrammerId} style={styles.exRow}>
                              <View style={styles.rowHead}>
                                <Text style={[styles.exTitle, { flex: 1 }]} numberOfLines={2}>
                                  {e.titre || t("devoirs.fallbackTitle")}
                                </Text>
                                {e.enAttenteCorrection > 0 ? (
                                  <TouchableOpacity
                                    style={styles.badge}
                                    disabled={!onOpenCorrections}
                                    onPress={() => onOpenCorrections?.(e.exerciseProgrammerId)}
                                  >
                                    <Text style={styles.badgeText}>{t("learning.prof.toCorrectCount", { count: e.enAttenteCorrection })}</Text>
                                  </TouchableOpacity>
                                ) : null}
                              </View>
                              <View style={styles.rowHead}>
                                <Text style={styles.muted}>{t("learning.prof.submitted", { done: e.rendus, total: e.attendus })}</Text>
                                <Text style={[styles.muted, { marginLeft: "auto" }]}>
                                  {t("learning.stats.avgMinMax", { avg: fmtNote(e.moyenne), min: fmtNote(e.min), max: fmtNote(e.max) })}
                                </Text>
                              </View>
                              <ProgressBar value={ratio * 100} color={scoreColor(ratio, colors)} height={6} />
                            </View>
                          );
                        })}
                      </>
                    )
                  ) : null}
                </View>
              );
            })
          )}
        </>
      ) : (
        <View style={styles.card}>
          <View style={styles.sortRow}>
            <Text style={styles.muted}>{t("learning.stats.sortBy")}</Text>
            {SORTS.map((k) => (
              <TouchableOpacity key={k} style={[styles.sortChip, sort === k && styles.sortChipOn]} onPress={() => setSort(k)}>
                <Text style={[styles.sortText, sort === k && { color: "#FFFFFF" }]}>{t(`learning.stats.sort.${k}`)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {students.length === 0 ? (
            <Text style={styles.muted}>{t("learning.stats.noStudents")}</Text>
          ) : (
            students.map((e) => {
              const p = pct(e.progressionMoyenne);
              return (
                <View key={e.eleveId} style={styles.studentRow}>
                  <View style={styles.rowHead}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{(e.prenom || e.nom || "?").charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={[styles.exTitle, { flex: 1 }]} numberOfLines={1}>
                      {`${e.prenom ?? ""} ${e.nom ?? ""}`.trim() || "—"}
                    </Text>
                    {e.enRetard > 0 ? (
                      <View style={[styles.badge, { backgroundColor: colors.danger }]}>
                        <Text style={styles.badgeText}>{t("learning.stats.late", { count: e.enRetard })}</Text>
                      </View>
                    ) : null}
                  </View>
                  <ProgressBar value={p} color={scoreColor(p / 100, colors)} height={6} />
                  <View style={styles.rowHead}>
                    <Text style={styles.muted}>{t("learning.stats.progressPct", { pct: p })}</Text>
                    <Text style={styles.muted}>{t("learning.stats.devoirs", { done: e.devoirsRendus, total: e.devoirsTotal })}</Text>
                    <Text style={[styles.muted, { marginLeft: "auto", fontWeight: "700", color: scoreColor(e.moyenne != null ? e.moyenne / 20 : null, colors) }]}>
                      {e.moyenne == null ? "—" : `${fmtNote(e.moyenne)}/20`}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    tiles: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm },
    title: { ...typography.bodyBold, color: colors.text },
    muted: { ...typography.caption, color: colors.textMuted },
    pctText: { ...typography.captionBold },
    rowHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
    segment: { flexDirection: "row", gap: 6, padding: 4, borderRadius: radius.md, backgroundColor: colors.surfaceElevated },
    segBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, borderRadius: radius.sm },
    segBtnOn: { backgroundColor: colors.primary },
    segText: { ...typography.captionBold, color: colors.textMuted },
    exRow: { gap: 4, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
    exTitle: { ...typography.captionBold, color: colors.text, fontSize: 13 },
    badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full, backgroundColor: colors.warning },
    badgeText: { ...typography.tiny, color: "#FFFFFF" },
    sortRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
    sortChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border },
    sortChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    sortText: { ...typography.captionBold, color: colors.textMuted },
    studentRow: { gap: 6, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
    avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
    avatarText: { ...typography.captionBold, color: colors.primaryDark },
  });

export default ClassStatsTab;
