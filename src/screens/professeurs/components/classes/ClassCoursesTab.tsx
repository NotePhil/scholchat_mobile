import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { CountPill, SectionState } from "../../../../components/common/LearningUI";
import { radius, spacing, typography, useThemeColors } from "../../../../styles/theme";
import { learningService, programmeCoursId } from "../../../../services/api";
import type { CoursResume, ExerciceStat } from "../../../../services/api";
import { CoursProgramme, ExerciseProgramme } from "../../../../types";
import { GENERAL_COURSE_ID, loadClassCourses } from "../../../../utils/classCourses";
import { loadExerciseStats } from "../../../../utils/classStats";
import { formatDateTime, serverDateMs } from "../../../../utils/dates";
import { TranslationKey, useT } from "../../../../i18n";
import ProgrammedExerciseRow from "../exercise/ProgrammedExerciseRow";

const fmt = (d?: string | null) => (d ? formatDateTime(d, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

const SESSION_STATUS: Record<string, { key: TranslationKey; color: string }> = {
  EN_COURS: { key: "studentClasses.statusLive", color: "#16A34A" },
  PLANIFIE: { key: "studentClasses.statusPlanned", color: "#2563EB" },
  TERMINE: { key: "studentClasses.statusDone", color: "#6B7280" },
  ANNULE: { key: "studentClasses.statusCancelled", color: "#DC2626" },
};

interface Props {
  classId: string;
  /** Programmed sessions of the class (ClassDetails "courses" section). */
  sessions: CoursProgramme[];
  /** Programmed exercises of the class (ClassDetails "exercises" section). */
  programmes: ExerciseProgramme[];
  /** Status of the exercises section (fallback grouping needs it). */
  programmesReady: boolean;
  /** Learners of the class when known (attendus fallback). */
  effectif: number | null;
  canPublish: boolean;
  onScheduleCourse?: () => void;
  onScheduleExercise?: () => void;
  /** Open the corrections of a programmed exercise. */
  onOpenCorrections?: (exerciseProgrammerId: string) => void;
  /** Bumped by the class page's pull-to-refresh. */
  refreshKey?: number;
}

/**
 * Professor ClassDetails "Cours" tab: the courses programmed in the class
 * (with chapters / sessions / exercises / homework counts) + "Exercices
 * généraux"; entering one shows its sessions, a link to its content and the
 * exercises / homework linked to it with rendus/attendus, copies to correct,
 * average, and a link to the corrections.
 */
const ClassCoursesTab = ({
  classId,
  sessions,
  programmes,
  programmesReady,
  effectif,
  canPublish,
  onScheduleCourse,
  onScheduleExercise,
  onOpenCorrections,
  refreshKey = 0,
}: Props) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  const navigation = useNavigation<any>();

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [courses, setCourses] = useState<CoursResume[]>([]);
  const [fromSummary, setFromSummary] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const s = ++seq.current;
    setStatus((prev) => (prev === "ready" ? "ready" : "loading"));
    setError("");
    try {
      const res = await loadClassCourses(classId);
      if (s !== seq.current) return;
      setCourses(res.courses);
      setFromSummary(res.fromSummary);
      setStatus("ready");
    } catch (e) {
      if (s !== seq.current) return;
      setError(e instanceof Error ? e.message : "");
      setStatus((prev) => (prev === "ready" ? "ready" : "error"));
    }
  }, [classId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  // Exercise counts from the class programmes when the summary didn't give them.
  const countsFor = (coursId: string | null) => {
    const list = programmes.filter((p) => (programmeCoursId(p) ?? null) === coursId);
    return { ex: list.filter((p) => p.typeAssignation !== "DEVOIR").length, dev: list.filter((p) => p.typeAssignation === "DEVOIR").length };
  };
  const generalCount = programmes.filter((p) => !programmeCoursId(p)).length;

  if (selected) {
    const course = selected === GENERAL_COURSE_ID ? null : courses.find((c) => c.coursId === selected) ?? null;
    return (
      <ProfessorCoursePage
        classId={classId}
        coursId={selected === GENERAL_COURSE_ID ? null : selected}
        course={course}
        sessions={sessions.filter((s) => String(s.coursId) === selected)}
        programmes={programmes}
        programmesReady={programmesReady}
        effectif={effectif}
        canPublish={canPublish}
        onBack={() => setSelected(null)}
        onOpenContent={(id) => navigation.navigate("CourseViewer", { coursId: id, readOnlyProgress: true })}
        onScheduleExercise={onScheduleExercise}
        onOpenCorrections={onOpenCorrections}
        refreshKey={refreshKey}
      />
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title}>{t("learning.classCourses.title")}</Text>
          <Text style={styles.sub}>{t("learning.classCourses.subtitle")}</Text>
        </View>
        {canPublish && onScheduleCourse ? (
          <TouchableOpacity style={[styles.solidBtn, { backgroundColor: "#4F46E5" }]} onPress={onScheduleCourse}>
            <FontAwesome5 name="plus" size={10} color="#FFFFFF" />
            <Text style={styles.solidBtnText}>{t("learning.classCourses.schedule")}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {status !== "ready" ? (
        <SectionState
          status={status}
          loadingLabel={t("classDetails.loading.courses")}
          errorLabel={t("classDetails.error.courses")}
          message={error}
          onRetry={load}
        />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {courses.length === 0 ? (
            <View style={styles.empty}>
              <FontAwesome5 name="book" size={24} color={colors.textLight} />
              <Text style={styles.sub}>{t("learning.classCourses.empty")}</Text>
            </View>
          ) : (
            courses.map((c) => {
              const local = countsFor(c.coursId);
              const nbEx = fromSummary ? c.nbExercices : local.ex;
              const nbDev = fromSummary ? c.nbDevoirs : local.dev;
              return (
                <TouchableOpacity key={c.coursId} style={styles.courseRow} onPress={() => setSelected(c.coursId)} activeOpacity={0.8}>
                  <View style={styles.courseIcon}>
                    <FontAwesome5 name="book-open" size={14} color="#4F46E5" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    <Text style={styles.courseTitle} numberOfLines={2}>
                      {c.titre || t("studentClasses.untitledCourse")}
                    </Text>
                    {c.matiere ? <Text style={styles.sub}>{c.matiere}</Text> : null}
                    <View style={styles.chips}>
                      {c.nbChapitres > 0 ? <Chip icon="list-ol" text={t("learning.counts.chapters", { count: c.nbChapitres })} /> : null}
                      <Chip icon="calendar-alt" text={t("learning.counts.sessions", { count: c.nbSessions })} />
                      <Chip icon="book-open" text={t("learning.counts.exercises", { count: nbEx })} />
                      <Chip icon="file-alt" text={t("learning.counts.devoirs", { count: nbDev })} />
                    </View>
                    {c.prochaineSession ? (
                      <Text style={styles.next}>{t("learning.classCourses.nextSession", { date: fmt(c.prochaineSession) })}</Text>
                    ) : null}
                  </View>
                  <FontAwesome5 name="chevron-right" size={12} color={colors.textLight} />
                </TouchableOpacity>
              );
            })
          )}
          <TouchableOpacity style={[styles.courseRow, styles.generalRow]} onPress={() => setSelected(GENERAL_COURSE_ID)} activeOpacity={0.8}>
            <View style={[styles.courseIcon, { backgroundColor: colors.surfaceElevated }]}>
              <FontAwesome5 name="layer-group" size={14} color={colors.textMuted} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.courseTitle}>{t("learning.generalExercises")}</Text>
              <Text style={styles.sub}>{t("learning.classCourses.generalHint")}</Text>
            </View>
            {programmesReady ? <CountPill value={generalCount} color={colors.textMuted} /> : null}
            <FontAwesome5 name="chevron-right" size={12} color={colors.textLight} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const Chip = ({ icon, text }: { icon: string; text: string }) => {
  const colors = useThemeColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.full, backgroundColor: colors.surfaceElevated }}>
      <FontAwesome5 name={icon} size={9} color={colors.textMuted} />
      <Text style={{ ...typography.tiny, color: colors.textMuted }}>{text}</Text>
    </View>
  );
};

// ─── Course page (professor) ─────────────────────────────────────────────────

const ProfessorCoursePage = ({
  classId,
  coursId,
  course,
  sessions,
  programmes,
  programmesReady,
  effectif,
  canPublish,
  onBack,
  onOpenContent,
  onScheduleExercise,
  onOpenCorrections,
  refreshKey,
}: {
  classId: string;
  coursId: string | null;
  course: CoursResume | null;
  sessions: CoursProgramme[];
  programmes: ExerciseProgramme[];
  programmesReady: boolean;
  effectif: number | null;
  canPublish: boolean;
  onBack: () => void;
  onOpenContent: (coursId: string) => void;
  onScheduleExercise?: () => void;
  onOpenCorrections?: (id: string) => void;
  refreshKey: number;
}) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [list, setList] = useState<ExerciseProgramme[]>([]);
  const [stats, setStats] = useState<Record<string, ExerciceStat>>({});
  const [statsLoading, setStatsLoading] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const s = ++seq.current;
    setStatus("loading");
    setError("");
    try {
      // GET /classes/{id}/cours/{coursId|general}/exercices, else the class programmes of that course.
      let items: ExerciseProgramme[] = await learningService.getCourseExercises(classId, coursId).catch((e) => {
        if (!programmesReady) throw e;
        return programmes.filter((p) => (programmeCoursId(p) ?? null) === coursId);
      });
      if (s !== seq.current) return;
      items = [...items].sort((a, b) => serverDateMs(a.dateFinExoEffectif, 0) - serverDateMs(b.dateFinExoEffectif, 0));
      setList(items);
      setStatus("ready");
      setStatsLoading(true);
      const res = await loadExerciseStats(classId, items, effectif).catch(() => null);
      if (s !== seq.current) return;
      setStats(res?.byId ?? {});
      setStatsLoading(false);
    } catch (e) {
      if (s !== seq.current) return;
      setError(e instanceof Error ? e.message : "");
      setStatus("error");
      setStatsLoading(false);
    }
  }, [classId, coursId, programmes, programmesReady, effectif]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const toCorrect = list.reduce((n, ep) => n + (stats[ep.id]?.enAttenteCorrection ?? 0), 0);
  const sortedSessions = [...sessions].sort((a, b) => serverDateMs(a.dateCoursPrevue, 0) - serverDateMs(b.dateCoursPrevue, 0));

  return (
    <View style={{ gap: spacing.md }}>
      <TouchableOpacity style={styles.back} onPress={onBack} activeOpacity={0.8}>
        <FontAwesome5 name="arrow-left" size={12} color={colors.primary} />
        <Text style={styles.backText}>{t("learning.classCourses.allCourses")}</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <View style={styles.header}>
          <View style={[styles.courseIcon, !coursId && { backgroundColor: colors.surfaceElevated }]}>
            <FontAwesome5 name={coursId ? "book-open" : "layer-group"} size={14} color={coursId ? "#4F46E5" : colors.textMuted} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.title} numberOfLines={2}>
              {coursId ? course?.titre || t("studentClasses.untitledCourse") : t("learning.generalExercises")}
            </Text>
            {course?.matiere ? <Text style={styles.sub}>{course.matiere}</Text> : null}
          </View>
        </View>
        <View style={styles.chips}>
          {course && course.nbChapitres > 0 ? <Chip icon="list-ol" text={t("learning.counts.chapters", { count: course.nbChapitres })} /> : null}
          {coursId ? <Chip icon="calendar-alt" text={t("learning.counts.sessions", { count: course?.nbSessions || sessions.length })} /> : null}
          {status === "ready" ? <Chip icon="tasks" text={t("learning.groups.items", { count: list.length })} /> : null}
          {toCorrect > 0 ? <Chip icon="clipboard-check" text={t("learning.prof.toCorrectCount", { count: toCorrect })} /> : null}
        </View>
        {coursId ? (
          <TouchableOpacity style={styles.outlineBtn} onPress={() => onOpenContent(coursId)} activeOpacity={0.85}>
            <FontAwesome5 name="eye" size={12} color={colors.primary} />
            <Text style={styles.outlineText}>{t("studentClasses.viewContent")}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {coursId ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("learning.classCourses.sessions")}</Text>
          {sortedSessions.length === 0 ? (
            <Text style={styles.sub}>{t("learning.classCourses.noSessions")}</Text>
          ) : (
            sortedSessions.map((s) => {
              const st = SESSION_STATUS[s.etatCoursProgramme ?? ""] ?? SESSION_STATUS.PLANIFIE;
              return (
                <View key={s.id} style={styles.sessionRow}>
                  <FontAwesome5 name="calendar-alt" size={11} color={colors.textMuted} />
                  <Text style={[styles.sub, { flex: 1 }]}>{fmt(s.dateCoursPrevue)}</Text>
                  {s.lieu ? (
                    <Text style={styles.sub} numberOfLines={1}>
                      {s.lieu}
                    </Text>
                  ) : null}
                  <Text style={[styles.sessionStatus, { color: st.color }]}>{t(st.key)}</Text>
                </View>
              );
            })
          )}
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={[styles.sectionTitle, { flex: 1 }]}>{t("learning.classCourses.exercisesTitle")}</Text>
          {canPublish && onScheduleExercise ? (
            <TouchableOpacity style={[styles.solidBtn, { backgroundColor: "#9333EA" }]} onPress={onScheduleExercise}>
              <FontAwesome5 name="plus" size={10} color="#FFFFFF" />
              <Text style={styles.solidBtnText}>{t("learning.classCourses.schedule")}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {status !== "ready" ? (
          <SectionState
            status={status}
            loadingLabel={t("classDetails.loading.exercises")}
            errorLabel={t("classDetails.error.exercises")}
            message={error}
            onRetry={load}
          />
        ) : list.length === 0 ? (
          <View style={styles.empty}>
            <FontAwesome5 name="file-alt" size={22} color={colors.textLight} />
            <Text style={styles.sub}>{t("learning.classCourses.noExercises")}</Text>
          </View>
        ) : (
          list.map((ep) => (
            <ProgrammedExerciseRow
              key={ep.id}
              programme={ep}
              stat={stats[ep.id]}
              statLoading={statsLoading}
              onCorrect={onOpenCorrections ? () => onOpenCorrections(ep.id) : undefined}
            />
          ))
        )}
      </View>
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      gap: spacing.sm,
    },
    header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    title: { ...typography.bodyBold, fontSize: 16, color: colors.text },
    sectionTitle: { ...typography.bodyBold, color: colors.text },
    sub: { ...typography.caption, color: colors.textMuted },
    next: { ...typography.caption, color: colors.primary },
    solidBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.sm },
    solidBtnText: { ...typography.captionBold, color: "#FFFFFF" },
    empty: { alignItems: "center", gap: 6, paddingVertical: spacing.lg },
    courseRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    generalRow: { borderStyle: "dashed" },
    courseIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(79,70,229,0.12)" },
    courseTitle: { ...typography.bodyBold, color: colors.text },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    back: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", paddingVertical: 4 },
    backText: { ...typography.captionBold, color: colors.primary },
    outlineBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 9,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    outlineText: { ...typography.captionBold, color: colors.primary },
    sessionRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border },
    sessionStatus: { ...typography.captionBold },
  });

export default ClassCoursesTab;
