import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CountPill, SectionState } from "../../components/common/LearningUI";
import { radius, spacing, typography, useThemeColors } from "../../styles/theme";
import { learningService, liveSessionService } from "../../services/api";
import type { CoursResume, EleveProgression } from "../../services/api";
import { ClassEntity, CoursProgramme } from "../../types";
import { useUser } from "../../context/UserContext";
import { TranslationKey, useT } from "../../i18n";
import { formatDate, formatTime, serverDateMs } from "../../utils/dates";
import { GENERAL_COURSE_ID, loadClassCourses, titlesFromAccessible } from "../../utils/classCourses";
import { buildDevoirItem, DevoirItem, loadDevoirs, sortDevoirs } from "../../utils/devoirs";
import { loadClassProgression } from "../../utils/progression";
import DevoirCard, { useDevoirNavigation } from "../shared/DevoirCard";
import ProgressionContent from "../shared/ProgressionContent";

/**
 * A learner's class page (student, or a parent viewing a child): the courses
 * programmed in the class with their counts + "Exercices généraux", and a
 * Progression view. Entering a course shows its sessions (live join), a
 * link to its content (CourseViewer) and its exercises / homework with the
 * learner's status and note (Faire / Voir la copie).
 */

interface Props {
  classe: ClassEntity;
  onBack: () => void;
  /** Parent view: the child's id. */
  learnerId?: string;
  /** Parent view: the child's first name (a minor's work is handed in by the parent). */
  learnerName?: string;
  /** Parent of an adult child: copies only. */
  readOnly?: boolean;
}

const STATUS_STYLE: Record<string, { color: string; bg: string; icon: string; label: TranslationKey }> = {
  PLANIFIE: { color: "#1e40af", bg: "rgba(59,130,246,0.14)", icon: "clock", label: "studentClasses.statusPlanned" },
  EN_COURS: { color: "#15803d", bg: "rgba(34,197,94,0.14)", icon: "play-circle", label: "studentClasses.statusLive" },
  TERMINE: { color: "#6b7280", bg: "rgba(107,114,128,0.14)", icon: "check-circle", label: "studentClasses.statusDone" },
  ANNULE: { color: "#b91c1c", bg: "rgba(239,68,68,0.14)", icon: "exclamation-circle", label: "studentClasses.statusCancelled" },
};

const fmtWhen = (d?: string | null, fallback = "") =>
  d ? `${formatDate(d, { weekday: "short", day: "numeric", month: "short" }, fallback)} ${formatTime(d) ?? ""}`.trim() : fallback;

const StudentClassDetailPage = ({ classe, onBack, learnerId, learnerName, readOnly = false }: Props) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { t } = useT();
  const { user } = useUser();
  const userId = learnerId ?? user?.userId;

  const [mode, setMode] = useState<"courses" | "progress">("courses");
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [courses, setCourses] = useState<CoursResume[]>([]);
  const [sessions, setSessions] = useState<CoursProgramme[]>([]);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(
    async (kind: "initial" | "refresh") => {
      if (!userId) return;
      const s = ++seq.current;
      if (kind === "refresh") {
        setRefreshing(true);
        setRefreshKey((n) => n + 1);
      } else setStatus("loading");
      setError("");
      try {
        const res = await loadClassCourses(classe.id, { withSessions: true, titles: titlesFromAccessible(userId) });
        if (s !== seq.current) return;
        setCourses(res.courses);
        setSessions(res.sessions);
        setStatus("ready");
      } catch (e) {
        if (s !== seq.current) return;
        setError(e instanceof Error ? e.message : "");
        setStatus((p) => (p === "ready" ? "ready" : "error"));
      } finally {
        if (s === seq.current) setRefreshing(false);
      }
    },
    [classe.id, userId]
  );

  useEffect(() => {
    load("initial");
    return () => {
      seq.current++;
    };
  }, [load]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    []
  );

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  const titleOf = (coursId?: string | null) => courses.find((c) => c.coursId === coursId)?.titre || t("studentClasses.untitledCourse");

  const openContent = (coursId: string) => {
    const session =
      sessions.find((s) => String(s.coursId) === coursId && s.etatCoursProgramme === "EN_COURS") ??
      sessions.find((s) => String(s.coursId) === coursId);
    navigation.navigate(
      "CourseViewer",
      learnerId
        ? { coursId, coursProgrammeId: session?.id, learnerId, readOnlyProgress: true }
        : { coursId, coursProgrammeId: session?.id }
    );
  };

  // Same as web: check for an active session only when the learner taps "Rejoindre".
  const joinLive = async (coursId?: string | null) => {
    if (!coursId) return;
    try {
      const session = await liveSessionService.getActiveSession(coursId);
      if (session) navigation.navigate("LiveSession", { coursId, isHost: false });
      else showToast(t("studentClasses.noActiveSession"));
    } catch {
      showToast(t("studentClasses.sessionCheckError"));
    }
  };

  const liveSessions = sessions.filter((s) => s.etatCoursProgramme === "EN_COURS" && s.coursId);
  const q = search.trim().toLowerCase();
  const visibleCourses = courses.filter((c) => !q || c.titre.toLowerCase().includes(q) || (c.matiere ?? "").toLowerCase().includes(q));

  const renderCourseList = () => {
    if (status !== "ready") {
      return (
        <View style={styles.card}>
          <SectionState
            status={status}
            loadingLabel={t("studentClasses.loadingCourses")}
            errorLabel={t("classDetails.error.courses")}
            message={error}
            onRetry={() => load("initial")}
          />
        </View>
      );
    }
    return (
      <>
        {liveSessions.map((s) => (
          <View key={s.id} style={[styles.card, styles.liveCard]}>
            <View style={styles.inline}>
              <View style={styles.liveDot} />
              <Text style={styles.liveLabel}>{t("studentClasses.liveBanner")}</Text>
            </View>
            <Text style={styles.courseTitle}>{titleOf(String(s.coursId))}</Text>
            <TouchableOpacity style={styles.liveBtn} onPress={() => joinLive(String(s.coursId))} activeOpacity={0.85}>
              <FontAwesome5 name="dot-circle" size={14} color="#FFFFFF" />
              <Text style={styles.liveBtnText}>{t("studentClasses.joinLive")}</Text>
            </TouchableOpacity>
          </View>
        ))}

        <View style={styles.searchBox}>
          <FontAwesome5 name="search" size={12} color={colors.textLight} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder={t("studentClasses.searchCourse")}
            placeholderTextColor={colors.textLight}
          />
        </View>

        {courses.length === 0 ? (
          <View style={[styles.card, { alignItems: "center" }]}>
            <FontAwesome5 name="book-open" size={36} color={colors.textLight} />
            <Text style={styles.emptyTitle}>{t("studentClasses.noCourses")}</Text>
            <Text style={styles.muted}>{learnerId ? t("studentClasses.noCoursesHintChild") : t("studentClasses.noCoursesHint")}</Text>
          </View>
        ) : visibleCourses.length === 0 ? (
          <View style={[styles.card, { alignItems: "center" }]}>
            <Text style={styles.emptyTitle}>{t("studentClasses.noCoursesFound")}</Text>
          </View>
        ) : (
          visibleCourses.map((c) => (
            <TouchableOpacity key={c.coursId} style={styles.card} onPress={() => setSelected(c.coursId)} activeOpacity={0.8}>
              <View style={styles.inline}>
                <View style={styles.courseIcon}>
                  <FontAwesome5 name="book-open" size={14} color="#4f46e5" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.courseTitle} numberOfLines={2}>
                    {c.titre || t("studentClasses.untitledCourse")}
                  </Text>
                  {c.matiere ? <Text style={styles.muted}>{c.matiere}</Text> : null}
                </View>
                <FontAwesome5 name="chevron-right" size={12} color={colors.textLight} />
              </View>
              <View style={styles.chips}>
                {c.nbChapitres > 0 ? <Chip icon="list-ol" text={t("learning.counts.chapters", { count: c.nbChapitres })} /> : null}
                <Chip icon="calendar-alt" text={t("learning.counts.sessions", { count: c.nbSessions })} />
                {c.nbExercices > 0 ? <Chip icon="book-open" text={t("learning.counts.exercises", { count: c.nbExercices })} /> : null}
                {c.nbDevoirs > 0 ? <Chip icon="file-alt" text={t("learning.counts.devoirs", { count: c.nbDevoirs })} /> : null}
              </View>
              {c.prochaineSession ? (
                <Text style={styles.next}>{t("learning.classCourses.nextSession", { date: fmtWhen(c.prochaineSession) })}</Text>
              ) : null}
            </TouchableOpacity>
          ))
        )}

        <TouchableOpacity style={[styles.card, styles.generalCard]} onPress={() => setSelected(GENERAL_COURSE_ID)} activeOpacity={0.8}>
          <View style={styles.inline}>
            <View style={[styles.courseIcon, { backgroundColor: colors.surfaceElevated }]}>
              <FontAwesome5 name="layer-group" size={14} color={colors.textMuted} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.courseTitle}>{t("learning.generalExercises")}</Text>
              <Text style={styles.muted}>{t("learning.classCourses.generalHint")}</Text>
            </View>
            <FontAwesome5 name="chevron-right" size={12} color={colors.textLight} />
          </View>
        </TouchableOpacity>
      </>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 150 }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load("refresh")} colors={[colors.primary]} tintColor={colors.primary} />}
      >
        <LinearGradient colors={["#2563eb", "#4f46e5"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.hero}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={selected ? () => setSelected(null) : onBack}
            activeOpacity={0.7}
            accessibilityLabel={t("common.back")}
          >
            <FontAwesome5 name="arrow-left" size={14} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.inline}>
              <FontAwesome5 name="graduation-cap" size={13} color="#FFFFFF" />
              <Text style={styles.heroTitle} numberOfLines={1}>
                {classe.nom}
              </Text>
            </View>
            <Text style={styles.heroSub} numberOfLines={1}>
              {`${classe.niveau ?? ""} · ${classe.description || t("studentClasses.classSpace")}`}
            </Text>
          </View>
          {status === "ready" ? (
            <Text style={styles.heroCount}>{t("studentClasses.coursesCount", { count: courses.length })}</Text>
          ) : status === "loading" ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : null}
        </LinearGradient>

        {selected ? (
          <LearnerCoursePage
            classe={classe}
            coursId={selected === GENERAL_COURSE_ID ? null : selected}
            course={courses.find((c) => c.coursId === selected) ?? null}
            sessions={sessions.filter((s) => String(s.coursId) === selected)}
            userId={userId ?? null}
            learnerName={learnerName}
            readOnly={readOnly}
            refreshKey={refreshKey}
            onBack={() => setSelected(null)}
            onOpenContent={openContent}
            onJoinLive={joinLive}
          />
        ) : (
          <>
            <View style={styles.segment}>
              {(["courses", "progress"] as const).map((k) => (
                <TouchableOpacity
                  key={k}
                  style={[styles.segBtn, mode === k && styles.segBtnOn]}
                  onPress={() => setMode(k)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: mode === k }}
                >
                  <FontAwesome5 name={k === "courses" ? "book" : "chart-line"} size={11} color={mode === k ? "#FFFFFF" : colors.textMuted} />
                  <Text style={[styles.segText, mode === k && { color: "#FFFFFF" }]}>
                    {t(k === "courses" ? "learning.classCourses.tabCourses" : "learning.classCourses.tabProgress")}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {mode === "courses" ? (
              renderCourseList()
            ) : (
              <ClassProgressionView
                classe={classe}
                userId={userId ?? null}
                courses={courses}
                coursesReady={status === "ready"}
                refreshKey={refreshKey}
                onOpenCourse={(id) => setSelected(id || GENERAL_COURSE_ID)}
              />
            )}
          </>
        )}
      </ScrollView>

      {toast ? (
        <View style={[styles.toast, { bottom: insets.bottom + 110 }]} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
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

// ─── Course page (learner) ───────────────────────────────────────────────────

const LearnerCoursePage = ({
  classe,
  coursId,
  course,
  sessions,
  userId,
  learnerName,
  readOnly,
  refreshKey,
  onBack,
  onOpenContent,
  onJoinLive,
}: {
  classe: ClassEntity;
  coursId: string | null;
  course: CoursResume | null;
  sessions: CoursProgramme[];
  userId: string | null;
  learnerName?: string;
  readOnly: boolean;
  refreshKey: number;
  onBack: () => void;
  onOpenContent: (coursId: string) => void;
  onJoinLive: (coursId: string) => void;
}) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  const navigation = useNavigation<any>();
  const { openAttempt, openResult } = useDevoirNavigation(userId, learnerName);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [items, setItems] = useState<DevoirItem[]>([]);
  const seq = useRef(0);

  const load = useCallback(
    async (silent = false) => {
      if (!userId) return;
      const s = ++seq.current;
      if (!silent) setStatus("loading");
      setError("");
      try {
        let list: DevoirItem[];
        try {
          // GET /classes/{id}/cours/{coursId|general}/exercices?eleveId= (status + note inline).
          const eps = await learningService.getCourseExercises(classe.id, coursId, userId);
          list = eps.map((ep) => buildDevoirItem(ep, null, classe));
        } catch {
          // Older backend: the class's programmed exercises + the learner's participations.
          const all = await loadDevoirs(userId, [classe], { includeExercises: true });
          list = all.filter((d) => d.coursId === coursId);
        }
        if (s !== seq.current) return;
        setItems(sortDevoirs(list));
        setStatus("ready");
      } catch (e) {
        if (s !== seq.current) return;
        setError(e instanceof Error ? e.message : "");
        if (!silent) setStatus("error");
      }
    },
    [classe, coursId, userId]
  );

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  // Back from the attempt / copy page: refresh statuses silently.
  useEffect(() => navigation.addListener("focus", () => load(true)), [navigation, load]);

  const sorted = [...sessions].sort((a, b) => serverDateMs(a.dateCoursPrevue, 0) - serverDateMs(b.dateCoursPrevue, 0));
  const todo = items.filter((d) => !d.isSubmitted).length;

  return (
    <View style={{ gap: spacing.md }}>
      <TouchableOpacity style={styles.backLink} onPress={onBack} activeOpacity={0.8}>
        <FontAwesome5 name="arrow-left" size={12} color={colors.primary} />
        <Text style={styles.backLinkText}>{t("learning.classCourses.allCourses")}</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <View style={styles.inline}>
          <View style={[styles.courseIcon, !coursId && { backgroundColor: colors.surfaceElevated }]}>
            <FontAwesome5 name={coursId ? "book-open" : "layer-group"} size={14} color={coursId ? "#4f46e5" : colors.textMuted} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.courseTitle}>{coursId ? course?.titre || t("studentClasses.untitledCourse") : t("learning.generalExercises")}</Text>
            {course?.matiere ? <Text style={styles.muted}>{course.matiere}</Text> : null}
            {!coursId ? <Text style={styles.muted}>{t("learning.classCourses.generalHint")}</Text> : null}
          </View>
        </View>
        {course ? (
          <View style={styles.chips}>
            {course.nbChapitres > 0 ? <Chip icon="list-ol" text={t("learning.counts.chapters", { count: course.nbChapitres })} /> : null}
            <Chip icon="calendar-alt" text={t("learning.counts.sessions", { count: course.nbSessions || sessions.length })} />
          </View>
        ) : null}
        {coursId ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => onOpenContent(coursId)} activeOpacity={0.85}>
            <FontAwesome5 name="book-reader" size={13} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>{t("learning.classCourses.readCourse")}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {coursId && sorted.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("learning.classCourses.sessions")}</Text>
          {sorted.map((s) => {
            const st = STATUS_STYLE[s.etatCoursProgramme ?? ""] ?? STATUS_STYLE.PLANIFIE;
            const live = s.etatCoursProgramme === "EN_COURS";
            return (
              <View key={s.id} style={styles.sessionRow}>
                <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
                  <FontAwesome5 name={st.icon} size={9} color={st.color} />
                  <Text style={[styles.statusText, { color: st.color }]}>{t(st.label)}</Text>
                </View>
                <Text style={[styles.muted, { flex: 1 }]} numberOfLines={1}>
                  {fmtWhen(s.dateCoursPrevue, t("studentClasses.dateUndefined"))}
                  {s.lieu ? ` · ${s.lieu}` : ""}
                </Text>
                {live ? (
                  <TouchableOpacity style={styles.liveMini} onPress={() => onJoinLive(coursId)}>
                    <Text style={styles.liveMiniText}>{t("learning.join")}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={styles.inline}>
          <Text style={[styles.sectionTitle, { flex: 1 }]}>{t("learning.classCourses.exercisesTitle")}</Text>
          {status === "ready" && todo > 0 ? <CountPill value={t("learning.groups.todo", { count: todo })} color={colors.warning} /> : null}
        </View>
        {status !== "ready" ? (
          <SectionState
            status={status}
            loadingLabel={t("classDetails.loading.exercises")}
            errorLabel={t("classDetails.error.exercises")}
            message={error}
            onRetry={() => load()}
          />
        ) : items.length === 0 ? (
          <Text style={styles.muted}>{t("learning.classCourses.noExercises")}</Text>
        ) : (
          // Exercises (EXERCICE) and homework (DEVOIR) of the course, in two separate sections
          ([
            { key: "ex", title: t("learning.classCourses.exercisesSection"), empty: t("learning.classCourses.noExercisesOnly"), list: items.filter((d) => d.programme.typeAssignation !== "DEVOIR") },
            { key: "dv", title: t("learning.classCourses.devoirsSection"), empty: t("learning.classCourses.noDevoirs"), list: items.filter((d) => d.programme.typeAssignation === "DEVOIR") },
          ] as const).map((sec) => (
            <View key={sec.key} style={{ gap: spacing.sm }}>
              <View style={styles.inline}>
                <FontAwesome5 name={sec.key === "ex" ? "book-open" : "file-alt"} size={12} color={colors.textMuted} />
                <Text style={[styles.courseTitle, { flex: 1 }]}>{sec.title}</Text>
                <CountPill value={String(sec.list.length)} color={colors.textMuted} />
              </View>
              {sec.list.length === 0 ? (
                <Text style={styles.muted}>{sec.empty}</Text>
              ) : (
                sec.list.map((d) => (
                  <DevoirCard key={d.programme.id} item={d} readOnly={readOnly} learnerName={learnerName} onAttempt={openAttempt} onResult={openResult} />
                ))
              )}
            </View>
          ))
        )}
      </View>
    </View>
  );
};

// ─── Progression (one class) ─────────────────────────────────────────────────

const ClassProgressionView = ({
  classe,
  userId,
  courses,
  coursesReady,
  refreshKey,
  onOpenCourse,
}: {
  classe: ClassEntity;
  userId: string | null;
  courses: CoursResume[];
  coursesReady: boolean;
  refreshKey: number;
  onOpenCourse: (coursId: string) => void;
}) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [data, setData] = useState<EleveProgression | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!userId || !coursesReady) return;
    const s = ++seq.current;
    setStatus((p) => (p === "ready" ? "ready" : "loading"));
    setError("");
    try {
      const d = await loadClassProgression(userId, classe, courses);
      if (s !== seq.current) return;
      setData(d);
      setStatus("ready");
    } catch (e) {
      if (s !== seq.current) return;
      setError(e instanceof Error ? e.message : "");
      setStatus("error");
    }
  }, [userId, classe, courses, coursesReady]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (status !== "ready" || !data) {
    return (
      <View style={styles.card}>
        <SectionState
          status={status === "error" ? "error" : "loading"}
          loadingLabel={t("learning.progress.loading")}
          errorLabel={t("learning.errors.progression")}
          message={error}
          onRetry={load}
        />
      </View>
    );
  }
  return <ProgressionContent data={data} onOpenCourse={onOpenCourse} />;
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    content: { paddingHorizontal: 16, paddingTop: spacing.sm, gap: spacing.md },
    inline: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    hero: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md },
    backBtn: { width: 32, height: 32, borderRadius: radius.sm, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
    heroTitle: { ...typography.h4, color: "#FFFFFF", fontWeight: "800", flexShrink: 1 },
    heroSub: { ...typography.caption, color: "#dbeafe", marginTop: 2 },
    heroCount: { ...typography.caption, color: "#dbeafe" },
    segment: { flexDirection: "row", gap: 6, padding: 4, borderRadius: radius.md, backgroundColor: colors.surfaceElevated },
    segBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: radius.sm },
    segBtnOn: { backgroundColor: colors.primary },
    segText: { ...typography.captionBold, color: colors.textMuted },
    card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm },
    generalCard: { borderStyle: "dashed" },
    liveCard: { borderColor: "#4ade80", borderWidth: 2 },
    liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#22c55e" },
    liveLabel: { ...typography.captionBold, color: "#15803d", textTransform: "uppercase", letterSpacing: 1 },
    liveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: "#16a34a", borderRadius: radius.md, paddingVertical: 11 },
    liveBtnText: { ...typography.bodyBold, color: "#FFFFFF" },
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md,
    },
    searchInput: { flex: 1, fontSize: 14, color: colors.text, paddingVertical: 8 },
    courseIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(79,70,229,0.12)" },
    courseTitle: { ...typography.bodyBold, color: colors.text },
    sectionTitle: { ...typography.bodyBold, color: colors.text },
    muted: { ...typography.caption, color: colors.textMuted },
    next: { ...typography.caption, color: colors.primary },
    emptyTitle: { ...typography.h4, color: colors.text, textAlign: "center" },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    backLink: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", paddingVertical: 4 },
    backLinkText: { ...typography.captionBold, color: colors.primary },
    primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: 10 },
    primaryBtnText: { ...typography.bodyBold, color: "#FFFFFF" },
    sessionRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border },
    statusPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.full },
    statusText: { fontSize: 11, fontWeight: "600" },
    liveMini: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm, backgroundColor: "#16a34a" },
    liveMiniText: { ...typography.captionBold, color: "#FFFFFF" },
    toast: { position: "absolute", left: 16, right: 16, backgroundColor: "#2563eb", borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
    toastText: { ...typography.bodyBold, color: "#FFFFFF" },
  });

export default StudentClassDetailPage;
