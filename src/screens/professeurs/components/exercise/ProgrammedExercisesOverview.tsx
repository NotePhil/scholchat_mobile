import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { EmptyState } from "../../../../components/ui";
import { CollapsibleHeader, CountPill, SectionState } from "../../../../components/common/LearningUI";
import { spacing, typography, useThemeColors } from "../../../../styles/theme";
import { exerciseProgrammerService, programmeCoursId, programmeCoursTitre } from "../../../../services/api";
import type { ExerciceStat } from "../../../../services/api";
import { ClassEntity, ExerciseProgramme } from "../../../../types";
import { GENERAL_COURSE_ID, loadClassCourses } from "../../../../utils/classCourses";
import { loadExerciseStats } from "../../../../utils/classStats";
import { serverDateMs } from "../../../../utils/dates";
import { useT } from "../../../../i18n";
import ProgrammedExerciseRow from "./ProgrammedExerciseRow";

type FilterId = "all" | "open" | "toCorrect" | "corrected" | "late";
const FILTERS: FilterId[] = ["all", "open", "toCorrect", "corrected", "late"];

interface ClassData {
  status: "loading" | "ready" | "error";
  error?: string;
  programmes: ExerciseProgramme[];
  titles: Record<string, string>;
  stats: Record<string, ExerciceStat>;
  statsLoading: boolean;
}

interface Props {
  classes: ClassEntity[];
  classesLoading: boolean;
  /** Open the corrections page focused on a programmed exercise. */
  onOpenCorrections: (exerciseProgrammerId: string) => void;
  /** Open the scheduling form with this class preselected. */
  onSchedule: (classId: string) => void;
  /** Bumped by the parent's pull-to-refresh. */
  refreshKey?: number;
}

const className = (c: ClassEntity) => c.nom || (c as any).name || `Classe ${c.id}`;

/**
 * Professor "Programmés" view: every programmed exercise of the professor's
 * classes grouped by class then by course (collapsible, "Exercices généraux"
 * last), with status filters (En cours / À corriger / Corrigés / En retard),
 * deadlines, rendus/attendus, copies to correct and average note.
 */
const ProgrammedExercisesOverview = ({ classes, classesLoading, onOpenCorrections, onSchedule, refreshKey = 0 }: Props) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  const [data, setData] = useState<Record<string, ClassData>>({});
  const [filter, setFilter] = useState<FilterId>("all");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const seqRef = useRef(0);

  const loadClass = useCallback(async (c: ClassEntity, seq: number) => {
    const id = String(c.id);
    setData((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { programmes: [], titles: {}, stats: {} }), status: prev[id]?.status === "ready" ? "ready" : "loading", statsLoading: false },
    }));
    try {
      const [programmes, courses] = await Promise.all([
        exerciseProgrammerService.getByClasse(id),
        loadClassCourses(id).catch(() => null),
      ]);
      if (seq !== seqRef.current) return;
      const titles: Record<string, string> = {};
      (courses?.courses ?? []).forEach((x) => {
        titles[x.coursId] = x.titre;
      });
      const list = (programmes || []).filter((p) => p?.id);
      setData((prev) => ({ ...prev, [id]: { status: "ready", programmes: list, titles, stats: prev[id]?.stats ?? {}, statsLoading: true } }));
      const res = await loadExerciseStats(id, list).catch(() => null);
      if (seq !== seqRef.current) return;
      setData((prev) => ({ ...prev, [id]: { ...prev[id], stats: res?.byId ?? {}, statsLoading: false } }));
    } catch (e) {
      if (seq !== seqRef.current) return;
      setData((prev) => ({
        ...prev,
        [id]: {
          ...(prev[id] ?? { programmes: [], titles: {}, stats: {} }),
          status: prev[id]?.status === "ready" ? "ready" : "error",
          error: e instanceof Error ? e.message : "",
          statsLoading: false,
        },
      }));
    }
  }, []);

  useEffect(() => {
    if (classesLoading) return;
    const seq = ++seqRef.current;
    classes.forEach((c) => loadClass(c, seq));
  }, [classes, classesLoading, loadClass, refreshKey]);

  const matches = useCallback(
    (ep: ExerciseProgramme, stat?: ExerciceStat) => {
      const past = !!ep.dateFinExoEffectif && serverDateMs(ep.dateFinExoEffectif, NaN) < Date.now();
      switch (filter) {
        case "open":
          return !past;
        case "toCorrect":
          return (stat?.enAttenteCorrection ?? 0) > 0;
        case "corrected":
          return !!stat && stat.rendus > 0 && stat.enAttenteCorrection === 0;
        case "late":
          return past && (!stat || stat.attendus === 0 || stat.rendus < stat.attendus);
        default:
          return true;
      }
    },
    [filter]
  );

  const counts = useMemo(() => {
    const out = { all: 0, open: 0, toCorrect: 0, corrected: 0, late: 0 } as Record<FilterId, number>;
    Object.values(data).forEach((d) =>
      d.programmes.forEach((ep) => {
        const stat = d.stats[ep.id];
        const past = !!ep.dateFinExoEffectif && serverDateMs(ep.dateFinExoEffectif, NaN) < Date.now();
        out.all += 1;
        if (!past) out.open += 1;
        if ((stat?.enAttenteCorrection ?? 0) > 0) out.toCorrect += 1;
        if (stat && stat.rendus > 0 && stat.enAttenteCorrection === 0) out.corrected += 1;
        if (past && (!stat || stat.attendus === 0 || stat.rendus < stat.attendus)) out.late += 1;
      })
    );
    return out;
  }, [data]);

  const toggle = (k: string) => setCollapsed((p) => ({ ...p, [k]: !p[k] }));

  if (classesLoading) return <SectionState status="loading" loadingLabel={t("learning.prof.loadingProgrammed")} errorLabel="" onRetry={() => undefined} />;
  if (classes.length === 0) {
    return <EmptyState icon="users" title={t("learning.prof.noClassTitle")} message={t("learning.prof.noClass")} />;
  }

  return (
    <View style={{ gap: spacing.md }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map((f) => {
          const on = filter === f;
          return (
            <TouchableOpacity key={f} style={[styles.chip, on && styles.chipOn]} onPress={() => setFilter(f)}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{t(`learning.prof.filters.${f}`)}</Text>
              <View style={[styles.pill, on && styles.pillOn]}>
                <Text style={[styles.pillText, on && styles.chipTextOn]}>{counts[f]}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {classes.map((c) => {
        const id = String(c.id);
        const d = data[id];
        const ck = `c:${id}`;
        const open = !collapsed[ck];
        const visible = (d?.programmes ?? []).filter((ep) => matches(ep, d?.stats[ep.id]));
        const toCorrect = (d?.programmes ?? []).reduce((n, ep) => n + (d?.stats[ep.id]?.enAttenteCorrection ?? 0), 0);
        // Group by course.
        const groups = new Map<string, { coursId: string | null; titre: string; items: ExerciseProgramme[] }>();
        visible.forEach((ep) => {
          const cid = programmeCoursId(ep);
          const k = cid ?? GENERAL_COURSE_ID;
          if (!groups.has(k)) {
            groups.set(k, {
              coursId: cid,
              titre: (cid && (d?.titles[cid] || programmeCoursTitre(ep))) || (cid ? t("learning.course") : t("learning.generalExercises")),
              items: [],
            });
          }
          groups.get(k)!.items.push(ep);
        });
        const sorted = Array.from(groups.entries()).sort(
          ([, a], [, b]) => (a.coursId ? 0 : 1) - (b.coursId ? 0 : 1) || a.titre.localeCompare(b.titre)
        );
        if (d?.status === "ready" && filter !== "all" && visible.length === 0) return null;
        return (
          <View key={id} style={{ gap: spacing.sm }}>
            <CollapsibleHeader
              title={className(c)}
              icon="graduation-cap"
              open={open}
              onToggle={() => toggle(ck)}
              subtitle={
                d?.status === "ready"
                  ? [t("learning.groups.items", { count: visible.length }), toCorrect ? t("learning.prof.toCorrectCount", { count: toCorrect }) : null]
                      .filter(Boolean)
                      .join(" · ")
                  : undefined
              }
              right={d?.status === "ready" ? <CountPill value={visible.length} /> : undefined}
            />
            {open ? (
              !d || d.status === "loading" ? (
                <SectionState compact status="loading" loadingLabel={t("learning.prof.loadingProgrammed")} errorLabel="" onRetry={() => undefined} />
              ) : d.status === "error" ? (
                <SectionState
                  compact
                  status="error"
                  loadingLabel=""
                  errorLabel={t("learning.errors.exercises")}
                  message={d.error}
                  onRetry={() => loadClass(c, seqRef.current)}
                />
              ) : visible.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>{t("learning.prof.noneInClass")}</Text>
                  <TouchableOpacity onPress={() => onSchedule(String(c.id))}>
                    <Text style={styles.link}>{t("learning.prof.schedule")}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                sorted.map(([k, g]) => {
                  const gk = `k:${id}:${k}`;
                  const gOpen = !collapsed[gk];
                  return (
                    <View key={k} style={{ paddingLeft: spacing.sm }}>
                      <CollapsibleHeader
                        level={2}
                        title={g.titre}
                        icon={g.coursId ? "book" : "layer-group"}
                        open={gOpen}
                        onToggle={() => toggle(gk)}
                        right={<CountPill value={g.items.length} color={colors.purple} />}
                      />
                      {gOpen
                        ? g.items.map((ep) => (
                            <ProgrammedExerciseRow
                              key={ep.id}
                              programme={ep}
                              stat={d.stats[ep.id]}
                              statLoading={d.statsLoading}
                              onCorrect={() => onOpenCorrections(ep.id)}
                            />
                          ))
                        : null}
                    </View>
                  );
                })
              )
            ) : null}
          </View>
        );
      })}
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    filters: { gap: spacing.sm },
    chip: {
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
    chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
    chipTextOn: { color: "#FFFFFF" },
    pill: { minWidth: 20, paddingHorizontal: 5, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceElevated },
    pillOn: { backgroundColor: "rgba(255,255,255,0.25)" },
    pillText: { ...typography.tiny, color: colors.textMuted },
    empty: { alignItems: "center", gap: 6, paddingVertical: spacing.md },
    emptyText: { ...typography.caption, color: colors.textMuted },
    link: { ...typography.captionBold, color: colors.primary },
  });

export default ProgrammedExercisesOverview;
