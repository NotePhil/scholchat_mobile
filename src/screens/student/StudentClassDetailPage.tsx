import React, { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LoadingSpinner } from "../../components/ui";
import { radius, spacing, typography, useThemeColors } from "../../styles/theme";
import { coursProgrammerService, coursService, liveSessionService } from "../../services/api";
import { ClassEntity, CoursProgramme } from "../../types";
import { useUser } from "../../context/UserContext";
import { TranslationKey, useT } from "../../i18n";
import { formatDate, formatTime, serverDateMs } from "../../utils/dates";

/**
 * What web shows when a student enters an approved class: StudentClassList
 * renders CoursProgrammeManagement with `selectedClass` — the class's
 * scheduled courses (GET /cours-programmes/by-classe/{id}) joined locally with
 * GET /cours/accessibles/{userId} for titles/descriptions, a search box, a
 * status filter, paginated course cards with the live / finished / cancelled /
 * waiting actions, and a statistics strip. Rendered as a full page (back
 * button) inside the Classes tab.
 */

interface Props {
  classe: ClassEntity;
  onBack: () => void;
  /** Parent view (web: StudentClassList isParentView → same page, fed with selectedChildId): the child's id. */
  learnerId?: string;
}

type Enriched = CoursProgramme & { cours: { id?: string; titre: string; description: string } };
type StatusFilter = "TOUS" | "PLANIFIE" | "EN_COURS" | "TERMINE" | "ANNULE";

const PAGE_SIZE = 6;

const STATUS_STYLE: Record<string, { color: string; bg: string; border: string; icon: string; label: TranslationKey }> = {
  PLANIFIE: { color: "#1e40af", bg: "rgba(59,130,246,0.14)", border: "rgba(59,130,246,0.35)", icon: "clock", label: "studentClasses.statusPlanned" },
  EN_COURS: { color: "#15803d", bg: "rgba(34,197,94,0.14)", border: "rgba(34,197,94,0.35)", icon: "play-circle", label: "studentClasses.statusLive" },
  TERMINE: { color: "#6b7280", bg: "rgba(107,114,128,0.14)", border: "rgba(107,114,128,0.35)", icon: "check-circle", label: "studentClasses.statusDone" },
  ANNULE: { color: "#b91c1c", bg: "rgba(239,68,68,0.14)", border: "rgba(239,68,68,0.35)", icon: "exclamation-circle", label: "studentClasses.statusCancelled" },
};

const ORDER: Record<string, number> = { EN_COURS: 0, PLANIFIE: 1, ANNULE: 2 };
const sortByCourseStatus = (arr: Enriched[]) =>
  [...arr].sort((a, b) => {
    const oa = ORDER[a.etatCoursProgramme ?? ""] ?? 3;
    const ob = ORDER[b.etatCoursProgramme ?? ""] ?? 3;
    return oa !== ob ? oa - ob : serverDateMs(b.dateCoursPrevue) - serverDateMs(a.dateCoursPrevue);
  });

const StudentClassDetailPage = ({ classe, onBack, learnerId }: Props) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { t } = useT();
  const { user } = useUser();
  const userId = learnerId ?? user?.userId;

  const [courses, setCourses] = useState<Enriched[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("TOUS");
  const [page, setPage] = useState(1);
  // A course opens as a full page (CourseViewer), same as from the Courses tab.
  const openCourse = (course: CoursProgramme) => {
    if (!course.coursId) return;
    // A parent reads the chapters with the child's progress, read-only.
    navigation.navigate(
      "CourseViewer",
      learnerId
        ? { coursId: course.coursId, coursProgrammeId: course.id, learnerId, readOnlyProgress: true }
        : { coursId: course.coursId, coursProgrammeId: course.id }
    );
  };
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!userId) return;
      setLoading(true);
      setError("");
      setPage(1);
      try {
        const [scheduledRes, detailsRes] = await Promise.allSettled([
          coursProgrammerService.getByClasse(classe.id),
          coursService.getAccessible(userId).catch(() => []),
        ]);
        if (cancelled) return;
        const scheduled = scheduledRes.status === "fulfilled" ? scheduledRes.value || [] : [];
        const detailsMap = new Map(
          (detailsRes.status === "fulfilled" ? detailsRes.value || [] : []).map((c) => [c.id, c])
        );
        const enriched: Enriched[] = scheduled.map((sc) => {
          const detail = (sc.coursId && detailsMap.get(sc.coursId)) || undefined;
          return {
            ...sc,
            cours: {
              id: sc.coursId,
              titre: detail?.titre || sc.description || t("studentClasses.untitledCourse"),
              description: detail?.description || "",
            },
          };
        });
        setCourses(sortByCourseStatus(enriched));
      } catch (err) {
        if (!cancelled)
          setError(t("studentClasses.coursesLoadError", { message: err instanceof Error ? err.message : "" }));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [classe.id, userId, t]);

  useEffect(() => setPage(1), [searchTerm, statusFilter]);
  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  // Same as web: check for an active session only when the student taps "Rejoindre".
  const handleJoinLive = async (course: Enriched) => {
    const cId = course.cours?.id || course.coursId;
    if (!cId) return;
    try {
      const session = await liveSessionService.getActiveSession(cId);
      if (session) navigation.navigate("LiveSession", { coursId: cId, isHost: false });
      else showToast(t("studentClasses.noActiveSession"));
    } catch {
      showToast(t("studentClasses.sessionCheckError"));
    }
  };

  const q = searchTerm.toLowerCase();
  const filtered = courses.filter((c) => {
    const matchSearch =
      !searchTerm || c.cours.titre.toLowerCase().includes(q) || c.cours.description.toLowerCase().includes(q);
    const matchStatus = statusFilter === "TOUS" || c.etatCoursProgramme === statusFilter;
    return matchSearch && matchStatus;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const stats = {
    planifie: courses.filter((c) => c.etatCoursProgramme === "PLANIFIE").length,
    enCours: courses.filter((c) => c.etatCoursProgramme === "EN_COURS").length,
    termine: courses.filter((c) => c.etatCoursProgramme === "TERMINE").length,
    total: courses.length,
  };

  const goPage = (p: number) => {
    setPage(p);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const filters: { id: StatusFilter; label: TranslationKey }[] = [
    { id: "TOUS", label: "studentClasses.allStatuses" },
    { id: "PLANIFIE", label: "studentClasses.filterPlanned" },
    { id: "EN_COURS", label: "studentClasses.filterLive" },
    { id: "TERMINE", label: "studentClasses.filterDone" },
    { id: "ANNULE", label: "studentClasses.filterCancelled" },
  ];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 150 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.headerCard}>
          <LinearGradient colors={["#2563eb", "#4f46e5"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.hero}>
            <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7} accessibilityLabel={t("common.back")}>
              <FontAwesome5 name="arrow-left" size={14} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.inline}>
                <FontAwesome5 name="graduation-cap" size={13} color="#FFFFFF" />
                <Text style={styles.heroTitle} numberOfLines={1}>{classe.nom}</Text>
              </View>
              <Text style={styles.heroSub} numberOfLines={1}>
                {`${classe.niveau ?? ""} · ${classe.description || t("studentClasses.classSpace")}`}
              </Text>
            </View>
            <Text style={styles.heroCount}>{t("studentClasses.coursesCount", { count: courses.length })}</Text>
          </LinearGradient>

          <View style={styles.toolbar}>
            <View style={styles.searchBox}>
              <FontAwesome5 name="search" size={12} color={colors.textLight} />
              <TextInput
                style={styles.searchInput}
                value={searchTerm}
                onChangeText={setSearchTerm}
                placeholder={t("studentClasses.searchCourse")}
                placeholderTextColor={colors.textLight}
              />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <FontAwesome5 name="filter" size={11} color={colors.textMuted} style={{ alignSelf: "center" }} />
              {filters.map((f) => {
                const active = statusFilter === f.id;
                return (
                  <TouchableOpacity
                    key={f.id}
                    style={[styles.chip, active ? styles.chipActive : null]}
                    onPress={() => setStatusFilter(f.id)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{t(f.label)}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <FontAwesome5 name="exclamation-circle" size={15} color="#dc2626" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <LoadingSpinner label={t("studentClasses.loadingCourses")} />
        ) : filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <FontAwesome5 name="book-open" size={42} color={colors.textLight} />
            <Text style={styles.emptyTitle}>
              {courses.length === 0 ? t("studentClasses.noCourses") : t("studentClasses.noCoursesFound")}
            </Text>
            <Text style={styles.emptyText}>
              {courses.length > 0
                ? t("studentClasses.noCoursesFoundHint")
                : learnerId
                  ? t("studentClasses.noCoursesHintChild")
                  : t("studentClasses.noCoursesHint")}
            </Text>
          </View>
        ) : (
          <>
            {paged.map((course) => {
              const s = STATUS_STYLE[course.etatCoursProgramme ?? ""] || STATUS_STYLE.PLANIFIE;
              const isLive = course.etatCoursProgramme === "EN_COURS";
              const time = formatTime(course.dateCoursPrevue);
              return (
                <View key={course.id} style={[styles.courseCard, isLive && styles.courseCardLive]}>
                  {isLive ? (
                    <View style={styles.liveBanner}>
                      <View style={styles.liveDot} />
                      <Text style={styles.liveBannerText}>{t("studentClasses.liveBanner")}</Text>
                    </View>
                  ) : null}
                  <TouchableOpacity style={styles.courseBody} onPress={() => openCourse(course)} activeOpacity={0.75}>
                    <View style={styles.courseTop}>
                      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                        <View style={styles.titleWrap}>
                          <Text style={styles.courseTitle}>{course.cours.titre}</Text>
                          <View style={[styles.statusPill, { backgroundColor: s.bg, borderColor: s.border }]}>
                            <FontAwesome5 name={s.icon} size={10} color={s.color} />
                            <Text style={[styles.statusText, { color: s.color }]}>{t(s.label)}</Text>
                          </View>
                        </View>
                        {course.cours.description ? (
                          <Text style={styles.courseDesc} numberOfLines={2}>{course.cours.description}</Text>
                        ) : null}
                        <View style={styles.inline}>
                          <FontAwesome5 name="graduation-cap" size={10} color="#4f46e5" />
                          <Text style={styles.className} numberOfLines={1}>{classe.nom}</Text>
                        </View>
                      </View>
                      <FontAwesome5 name="chevron-right" size={13} color={colors.textLight} style={{ marginTop: 4 }} />
                    </View>
                    <View style={styles.metaRow}>
                      <View style={styles.inline}>
                        <FontAwesome5 name="calendar-alt" size={11} color={colors.textMuted} />
                        <Text style={styles.metaText}>
                          {formatDate(
                            course.dateCoursPrevue,
                            { weekday: "long", year: "numeric", month: "long", day: "numeric" },
                            t("studentClasses.dateUndefined")
                          )}
                        </Text>
                      </View>
                      {time ? (
                        <View style={styles.inline}>
                          <FontAwesome5 name="clock" size={11} color={colors.textMuted} />
                          <Text style={styles.metaText}>{time}</Text>
                        </View>
                      ) : null}
                      {course.lieu ? (
                        <View style={styles.inline}>
                          <FontAwesome5 name="map-marker-alt" size={11} color={colors.textMuted} />
                          <Text style={styles.metaText}>{course.lieu}</Text>
                        </View>
                      ) : null}
                    </View>
                  </TouchableOpacity>

                  <View style={styles.courseAction}>
                    {isLive ? (
                      <TouchableOpacity style={styles.liveBtn} onPress={() => handleJoinLive(course)} activeOpacity={0.85}>
                        <FontAwesome5 name="dot-circle" size={14} color="#FFFFFF" />
                        <Text style={styles.liveBtnText}>{t("studentClasses.joinLive")}</Text>
                      </TouchableOpacity>
                    ) : course.etatCoursProgramme === "TERMINE" ? (
                      <TouchableOpacity style={styles.viewBtn} onPress={() => openCourse(course)} activeOpacity={0.8}>
                        <FontAwesome5 name="eye" size={13} color={colors.textMuted} />
                        <Text style={styles.viewBtnText}>{t("studentClasses.viewContent")}</Text>
                      </TouchableOpacity>
                    ) : course.etatCoursProgramme === "ANNULE" ? (
                      <View style={[styles.note, { backgroundColor: "rgba(239,68,68,0.10)" }]}>
                        <FontAwesome5 name="exclamation-circle" size={13} color="#f87171" />
                        <Text style={[styles.noteText, { color: "#ef4444" }]}>{t("studentClasses.cancelledMsg")}</Text>
                      </View>
                    ) : (
                      <View style={[styles.note, { backgroundColor: "rgba(59,130,246,0.10)" }]}>
                        <FontAwesome5 name="clock" size={13} color="#60a5fa" />
                        <Text style={[styles.noteText, { color: "#2563eb" }]}>{t("studentClasses.waitingMsg")}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}

            {totalPages > 1 ? (
              <View style={styles.pagination}>
                <TouchableOpacity
                  style={[styles.pageBtn, safePage <= 1 && { opacity: 0.4 }]}
                  disabled={safePage <= 1}
                  onPress={() => goPage(safePage - 1)}
                  accessibilityLabel={t("common.previous")}
                >
                  <FontAwesome5 name="chevron-left" size={12} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.pageText}>{t("studentClasses.pageOf", { page: safePage, total: totalPages })}</Text>
                <TouchableOpacity
                  style={[styles.pageBtn, safePage >= totalPages && { opacity: 0.4 }]}
                  disabled={safePage >= totalPages}
                  onPress={() => goPage(safePage + 1)}
                  accessibilityLabel={t("common.next")}
                >
                  <FontAwesome5 name="chevron-right" size={12} color={colors.text} />
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={styles.statsCard}>
              <View style={styles.inline}>
                <FontAwesome5 name="book-open" size={13} color="#4f46e5" />
                <Text style={styles.statsTitle}>{t("studentClasses.statsTitle")}</Text>
              </View>
              <View style={styles.statsGrid}>
                {[
                  { label: t("studentClasses.filterPlanned"), value: stats.planifie, color: "#2563eb", bg: "rgba(59,130,246,0.10)" },
                  { label: t("studentClasses.filterLive"), value: stats.enCours, color: "#16a34a", bg: "rgba(34,197,94,0.10)" },
                  { label: t("studentClasses.filterDone"), value: stats.termine, color: "#4b5563", bg: "rgba(107,114,128,0.12)" },
                  { label: t("studentClasses.statTotalCap"), value: stats.total, color: "#9333ea", bg: "rgba(147,51,234,0.10)" },
                ].map((st) => (
                  <View key={st.label} style={[styles.statBox, { backgroundColor: st.bg }]}>
                    <Text style={[styles.statValue, { color: st.color }]}>{st.value}</Text>
                    <Text style={styles.statLabel}>{st.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {toast ? (
        <View style={[styles.toast, { bottom: insets.bottom + 110 }]} pointerEvents="none">
          <View style={styles.toastDot} />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}

    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    content: { paddingHorizontal: 16, paddingTop: spacing.sm, gap: spacing.md },
    inline: { flexDirection: "row", alignItems: "center", gap: 6 },
    headerCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    hero: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
    backBtn: {
      width: 32,
      height: 32,
      borderRadius: radius.sm,
      backgroundColor: "rgba(255,255,255,0.18)",
      alignItems: "center",
      justifyContent: "center",
    },
    heroTitle: { ...typography.h4, color: "#FFFFFF", fontWeight: "800", flexShrink: 1 },
    heroSub: { ...typography.caption, color: "#dbeafe", marginTop: 2 },
    heroCount: { ...typography.caption, color: "#dbeafe" },
    toolbar: { padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surfaceElevated },
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
    chips: { gap: spacing.sm, paddingRight: spacing.sm },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { ...typography.captionBold, color: colors.textMuted },
    chipTextActive: { color: "#FFFFFF" },
    errorBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: "rgba(239,68,68,0.10)",
      borderWidth: 1,
      borderColor: "rgba(239,68,68,0.35)",
      borderRadius: radius.md,
      padding: spacing.md,
    },
    errorText: { ...typography.caption, color: "#dc2626", flex: 1 },
    emptyCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.xl,
      alignItems: "center",
      gap: spacing.sm,
    },
    emptyTitle: { ...typography.h4, color: colors.text, textAlign: "center" },
    emptyText: { ...typography.caption, color: colors.textMuted, textAlign: "center" },
    courseCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 2,
      borderColor: colors.border,
      overflow: "hidden",
    },
    courseCardLive: { borderColor: "#4ade80" },
    liveBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: "#22c55e",
      paddingHorizontal: spacing.lg,
      paddingVertical: 6,
    },
    liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#FFFFFF" },
    liveBannerText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase" },
    courseBody: { padding: spacing.md, gap: spacing.sm },
    courseTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
    titleWrap: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm },
    courseTitle: { ...typography.h4, fontWeight: "700", color: colors.text, flexShrink: 1 },
    statusPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radius.full,
      borderWidth: 1,
    },
    statusText: { fontSize: 11, fontWeight: "600" },
    courseDesc: { ...typography.caption, color: colors.textMuted },
    className: { ...typography.captionBold, color: "#4f46e5", flexShrink: 1 },
    metaRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
    metaText: { ...typography.caption, color: colors.textMuted },
    courseAction: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
    liveBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      backgroundColor: "#16a34a",
      borderRadius: radius.md,
      paddingVertical: 11,
    },
    liveBtnText: { ...typography.bodyBold, color: "#FFFFFF" },
    viewBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.md,
      paddingVertical: 9,
    },
    viewBtnText: { ...typography.body, color: colors.textMuted },
    note: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 9 },
    noteText: { ...typography.captionBold, flex: 1, fontWeight: "600" },
    pagination: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.lg },
    pageBtn: {
      width: 36,
      height: 36,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    pageText: { ...typography.captionBold, color: colors.textMuted },
    statsCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.md,
    },
    statsTitle: { ...typography.bodyBold, color: colors.text },
    statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    statBox: { flexGrow: 1, flexBasis: "45%", alignItems: "center", padding: spacing.md, borderRadius: radius.sm },
    statValue: { fontSize: 20, fontWeight: "800" },
    statLabel: { ...typography.caption, color: colors.textMuted },
    toast: {
      position: "absolute",
      left: 16,
      right: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      backgroundColor: "#2563eb",
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    toastDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#FFFFFF" },
    toastText: { ...typography.bodyBold, color: "#FFFFFF", flex: 1 },
  });

export default StudentClassDetailPage;
