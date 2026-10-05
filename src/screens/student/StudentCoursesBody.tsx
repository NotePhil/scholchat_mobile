import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { coursProgrammerService, coursService, liveSessionService } from "../../services/api";
import { CoursProgramme } from "../../types";
import { useUser } from "../../context/UserContext";
import { useThemeColors } from "../../styles/theme";
import { useThemeStore } from "../../store/useThemeStore";
import { useT, TranslationKey } from "../../i18n";
import { formatDate, formatTime, serverDateMs } from "../../utils/dates";

type Etat = "PLANIFIE" | "EN_COURS" | "TERMINE" | "ANNULE";
type StatusFilter = "TOUS" | Etat;

interface EnrichedCourse extends CoursProgramme {
  cours: { id?: string; titre: string; description: string };
}

const PAGE_SIZE = 6;

const STATUS: Record<Etat, { labelKey: TranslationKey; icon: string; tone: "info" | "success" | "neutral" | "danger" }> = {
  PLANIFIE: { labelKey: "studentCourses.statusPlanned", icon: "clock", tone: "info" },
  EN_COURS: { labelKey: "studentCourses.statusLive", icon: "play-circle", tone: "success" },
  TERMINE: { labelKey: "studentCourses.statusDone", icon: "check-circle", tone: "neutral" },
  ANNULE: { labelKey: "studentCourses.statusCancelled", icon: "exclamation-circle", tone: "danger" },
};

const FILTERS: { key: StatusFilter; labelKey: TranslationKey }[] = [
  { key: "TOUS", labelKey: "studentCourses.filterAll" },
  { key: "PLANIFIE", labelKey: "studentCourses.filterPlanned" },
  { key: "EN_COURS", labelKey: "studentCourses.filterLive" },
  { key: "TERMINE", labelKey: "studentCourses.filterDone" },
  { key: "ANNULE", labelKey: "studentCourses.filterCancelled" },
];

/** Web's sortByCourseStatus: live first, then planned, cancelled, the rest; newest date first. */
const sortByCourseStatus = (arr: EnrichedCourse[]) => {
  const ORDER: Record<string, number> = { EN_COURS: 0, PLANIFIE: 1, ANNULE: 2 };
  return [...arr].sort((a, b) => {
    const oa = ORDER[a.etatCoursProgramme ?? ""] ?? 3;
    const ob = ORDER[b.etatCoursProgramme ?? ""] ?? 3;
    return oa !== ob ? oa - ob : serverDateMs(b.dateCoursPrevue) - serverDateMs(a.dateCoursPrevue);
  });
};

/**
 * Student "Cours" tab — port of web's InterfaceCours/CoursProgrammeManagement.jsx
 * (Principal.jsx "cours" tab, student branch): scheduled courses accessible to
 * the student, joined locally with /cours/accessibles for titles/descriptions;
 * search + status filter, paginated cards, per-status action, and the stats
 * strip. Opening a course pushes the full-screen CourseViewer page.
 */
interface StudentCoursesBodyProps {
  /**
   * Parent view (web: CoursProgrammeManagement reads `selectedChildId`): whose
   * courses to list — the selected child's id, or null when none is selected.
   * Omitted → the signed-in student.
   */
  learnerId?: string | null;
  /** Parent view: the child's first name, for the header and empty states. */
  childName?: string;
  /** Rendered above the header (the parent's child switcher). */
  topSlot?: React.ReactNode;
}

const StudentCoursesBody = ({ learnerId, childName, topSlot }: StudentCoursesBodyProps = {}) => {
  const { user } = useUser();
  const colors = useThemeColors();
  const isDark = useThemeStore((s) => s.mode) === "dark";
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const { t } = useT();
  const navigation = useNavigation<any>();
  const [courses, setCourses] = useState<EnrichedCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("TOUS");
  const [page, setPage] = useState(1);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const parentView = learnerId !== undefined;
  const userId = parentView ? learnerId ?? undefined : user?.userId;

  const load = useCallback(
    async (isRefresh = false) => {
      if (!userId) {
        setCourses([]);
        setLoading(false);
        return;
      }
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError("");
      try {
        // Same strategy as web: two parallel requests, joined locally.
        const [scheduledRes, detailsRes] = await Promise.allSettled([
          coursProgrammerService.getAccessible(userId),
          coursService.getAccessible(userId),
        ]);
        if (scheduledRes.status === "rejected") throw scheduledRes.reason;
        const scheduled = scheduledRes.value ?? [];
        const details = new Map(
          (detailsRes.status === "fulfilled" ? detailsRes.value ?? [] : []).map((c) => [c.id, c])
        );
        const enriched: EnrichedCourse[] = scheduled.map((sc) => {
          const d = (sc.coursId && details.get(sc.coursId)) || undefined;
          return {
            ...sc,
            cours: {
              id: sc.coursId,
              titre: d?.titre || sc.description || t("studentCourses.untitled"),
              description: d?.description || "",
            },
          };
        });
        setCourses(sortByCourseStatus(enriched));
      } catch (err) {
        setError(err instanceof Error ? err.message : t("studentCourses.loadFailed"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter]);

  const openCourse = (course: EnrichedCourse) => {
    const coursId = course.cours?.id || course.coursId;
    if (!coursId) return;
    // A parent reads the chapters with the child's progress, read-only (only the learner ticks chapters).
    navigation.navigate(
      "CourseViewer",
      parentView && userId
        ? { coursId, coursProgrammeId: course.id, learnerId: userId, readOnlyProgress: true }
        : { coursId, coursProgrammeId: course.id }
    );
  };

  /** Web checks the active session on demand before opening the live room. */
  const handleJoinLive = async (course: EnrichedCourse) => {
    const coursId = course.cours?.id || course.coursId;
    if (!coursId || joiningId) return;
    setJoiningId(course.id);
    try {
      const session = await liveSessionService.getActiveSession(coursId).catch(() => null);
      if (session) navigation.navigate("LiveSession", { coursId, isHost: false });
      else Alert.alert(t("studentCourses.liveBanner"), t("studentCourses.noActiveSession"));
    } catch {
      Alert.alert(t("common.error"), t("studentCourses.sessionCheckFailed"));
    } finally {
      setJoiningId(null);
    }
  };

  const toneColors = (tone: "info" | "success" | "neutral" | "danger") => {
    switch (tone) {
      case "success":
        return { fg: colors.successDark, bg: isDark ? "rgba(16,185,129,0.18)" : colors.successLight };
      case "danger":
        return { fg: colors.dangerDark, bg: isDark ? "rgba(239,68,68,0.18)" : colors.dangerLight };
      case "neutral":
        return { fg: colors.textMuted, bg: colors.surfaceElevated };
      default:
        return { fg: colors.infoDark, bg: isDark ? "rgba(59,130,246,0.18)" : colors.infoLight };
    }
  };

  const q = searchTerm.trim().toLowerCase();
  const filtered = courses.filter((c) => {
    const matchSearch =
      !q || c.cours.titre.toLowerCase().includes(q) || c.cours.description.toLowerCase().includes(q);
    const matchStatus = statusFilter === "TOUS" || c.etatCoursProgramme === statusFilter;
    return matchSearch && matchStatus;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const stats = [
    { label: t("studentCourses.filterPlanned"), value: courses.filter((c) => c.etatCoursProgramme === "PLANIFIE").length, color: colors.infoDark },
    { label: t("studentCourses.filterLive"), value: courses.filter((c) => c.etatCoursProgramme === "EN_COURS").length, color: colors.successDark },
    { label: t("studentCourses.filterDone"), value: courses.filter((c) => c.etatCoursProgramme === "TERMINE").length, color: colors.textMuted },
    { label: t("studentCourses.statsTotal"), value: courses.length, color: colors.purple },
  ];

  const className = (c: EnrichedCourse) => (c.classes && c.classes.length > 0 ? c.classes[0].nom || "" : "");

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} colors={[colors.primary]} />
      }
    >
      {topSlot}
      {/* Header */}
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View style={styles.headerIcon}>
            <FontAwesome5 name="graduation-cap" size={16} color={colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>
              {parentView && childName ? t("studentCourses.childTitle", { name: childName }) : t("studentCourses.title")}
            </Text>
            <Text style={styles.headerSubtitle}>{parentView ? t("studentCourses.childSubtitle") : t("studentCourses.subtitle")}</Text>
          </View>
          <Text style={styles.headerCount}>{t("studentCourses.count", { count: courses.length })}</Text>
        </View>

        <View style={styles.searchBox}>
          <FontAwesome5 name="search" size={13} color={colors.textLight} />
          <TextInput
            style={styles.searchInput}
            placeholder={t("studentCourses.searchPlaceholder")}
            placeholderTextColor={colors.textLight}
            value={searchTerm}
            onChangeText={setSearchTerm}
            returnKeyType="search"
          />
          {searchTerm ? (
            <TouchableOpacity onPress={() => setSearchTerm("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <FontAwesome5 name="times-circle" size={14} color={colors.textLight} />
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map((f) => {
            const active = statusFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setStatusFilter(f.key)}
                activeOpacity={0.8}
              >
                {f.key === "TOUS" ? (
                  <FontAwesome5 name="filter" size={10} color={active ? colors.white : colors.textMuted} />
                ) : null}
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{t(f.labelKey)}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <FontAwesome5 name="exclamation-circle" size={15} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.mutedText}>{t("studentCourses.loading")}</Text>
        </View>
      ) : parentView && !userId ? (
        <View style={styles.emptyCard}>
          <FontAwesome5 name="child" size={40} color={colors.textLight} />
          <Text style={styles.emptyTitle}>{t("studentCourses.noChildTitle")}</Text>
          <Text style={styles.mutedText}>{t("studentCourses.noChildText")}</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyCard}>
          <FontAwesome5 name="book-open" size={40} color={colors.textLight} />
          <Text style={styles.emptyTitle}>
            {courses.length === 0 ? t("studentCourses.emptyTitle") : t("studentCourses.noMatchTitle")}
          </Text>
          <Text style={styles.mutedText}>
            {courses.length > 0
              ? t("studentCourses.noMatchText")
              : parentView
                ? t("studentCourses.emptyChildText", { name: childName || "" })
                : t("studentCourses.emptyText")}
          </Text>
          {courses.length > 0 ? (
            <TouchableOpacity
              style={styles.resetButton}
              onPress={() => {
                setSearchTerm("");
                setStatusFilter("TOUS");
              }}
            >
              <Text style={styles.resetText}>{t("studentCourses.resetFilters")}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <>
          <View style={styles.list}>
            {paged.map((course) => {
              const etat = (course.etatCoursProgramme as Etat) || "PLANIFIE";
              const s = STATUS[etat] ?? STATUS.PLANIFIE;
              const tone = toneColors(s.tone);
              const isLive = etat === "EN_COURS";
              const cls = className(course);
              const date = formatDate(
                course.dateCoursPrevue,
                { weekday: "long", year: "numeric", month: "long", day: "numeric" },
                t("studentCourses.noDate")
              );
              const time = formatTime(course.dateCoursPrevue);
              return (
                <View key={course.id} style={[styles.card, isLive && styles.cardLive]}>
                  {isLive ? (
                    <View style={styles.liveBanner}>
                      <View style={styles.liveDot} />
                      <Text style={styles.liveBannerText}>{t("studentCourses.liveBanner").toUpperCase()}</Text>
                    </View>
                  ) : null}

                  <TouchableOpacity style={styles.cardBody} onPress={() => openCourse(course)} activeOpacity={0.75}>
                    <View style={styles.cardTop}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.titleRow}>
                          <Text style={styles.cardTitle}>{course.cours.titre}</Text>
                          <View style={[styles.statusBadge, { backgroundColor: tone.bg }]}>
                            <FontAwesome5 name={s.icon} size={9} color={tone.fg} />
                            <Text style={[styles.statusText, { color: tone.fg }]}>{t(s.labelKey)}</Text>
                          </View>
                        </View>
                        {course.cours.description ? (
                          <Text style={styles.description} numberOfLines={2}>
                            {course.cours.description}
                          </Text>
                        ) : null}
                        {cls ? (
                          <View style={styles.classRow}>
                            <FontAwesome5 name="graduation-cap" size={10} color={colors.purple} />
                            <Text style={styles.classText}>{cls}</Text>
                          </View>
                        ) : null}
                      </View>
                      <FontAwesome5 name="chevron-right" size={13} color={colors.textLight} style={{ marginTop: 3 }} />
                    </View>

                    <View style={styles.metaRow}>
                      <View style={styles.metaItem}>
                        <FontAwesome5 name="calendar-alt" size={11} color={colors.textMuted} />
                        <Text style={styles.metaText}>{date}</Text>
                      </View>
                      {time ? (
                        <View style={styles.metaItem}>
                          <FontAwesome5 name="clock" size={11} color={colors.textMuted} />
                          <Text style={styles.metaText}>{time}</Text>
                        </View>
                      ) : null}
                      {course.lieu ? (
                        <View style={styles.metaItem}>
                          <FontAwesome5 name="map-marker-alt" size={11} color={colors.textMuted} />
                          <Text style={styles.metaText}>{course.lieu}</Text>
                        </View>
                      ) : null}
                    </View>
                  </TouchableOpacity>

                  <View style={styles.cardAction}>
                    {isLive ? (
                      <TouchableOpacity style={styles.joinButton} onPress={() => handleJoinLive(course)} activeOpacity={0.85}>
                        {joiningId === course.id ? (
                          <ActivityIndicator size="small" color={colors.white} />
                        ) : (
                          <FontAwesome5 name="dot-circle" size={14} color={colors.white} />
                        )}
                        <Text style={styles.joinText}>{t("studentCourses.joinLive")}</Text>
                      </TouchableOpacity>
                    ) : etat === "TERMINE" ? (
                      <TouchableOpacity style={styles.viewButton} onPress={() => openCourse(course)} activeOpacity={0.8}>
                        <FontAwesome5 name="eye" size={13} color={colors.textMuted} />
                        <Text style={styles.viewText}>{t("studentCourses.viewContent")}</Text>
                      </TouchableOpacity>
                    ) : etat === "ANNULE" ? (
                      <View style={[styles.note, { backgroundColor: toneColors("danger").bg }]}>
                        <FontAwesome5 name="exclamation-circle" size={13} color={colors.danger} />
                        <Text style={[styles.noteText, { color: colors.dangerDark }]}>{t("studentCourses.cancelledNote")}</Text>
                      </View>
                    ) : (
                      <View style={[styles.note, { backgroundColor: toneColors("info").bg }]}>
                        <FontAwesome5 name="clock" size={13} color={colors.primary} />
                        <Text style={[styles.noteText, { color: colors.infoDark }]}>{t("studentCourses.waitingNote")}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          {totalPages > 1 ? (
            <View style={styles.pagination}>
              <Text style={styles.pageInfo}>
                {t("studentCourses.pageInfo", { count: filtered.length, page: safePage, pages: totalPages })}
              </Text>
              <View style={styles.pageButtons}>
                <TouchableOpacity
                  style={[styles.pageButton, safePage === 1 && styles.pageButtonDisabled]}
                  disabled={safePage === 1}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                  accessibilityLabel={t("common.previous")}
                >
                  <FontAwesome5 name="chevron-left" size={11} color={colors.text} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pageButton, safePage === totalPages && styles.pageButtonDisabled]}
                  disabled={safePage === totalPages}
                  onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                  accessibilityLabel={t("common.next")}
                >
                  <FontAwesome5 name="chevron-right" size={11} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          <View style={styles.statsCard}>
            <View style={styles.statsHead}>
              <FontAwesome5 name="book-open" size={13} color={colors.purple} />
              <Text style={styles.statsTitle}>{t("studentCourses.statsTitle")}</Text>
            </View>
            <View style={styles.statsGrid}>
              {stats.map((s) => (
                <View key={s.label} style={styles.statTile}>
                  <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>, isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 120, gap: 12 },
    headerCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      gap: 10,
    },
    headerTop: { flexDirection: "row", alignItems: "center", gap: 10 },
    headerIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: { fontSize: 17, fontWeight: "800", color: colors.text },
    headerSubtitle: { fontSize: 12, color: colors.textMuted },
    resetButton: { marginTop: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.primary },
    resetText: { fontSize: 12, fontWeight: "700", color: colors.primary },
    headerCount: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      height: 42,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    searchInput: { flex: 1, fontSize: 14, color: colors.text, paddingVertical: 0 },
    filterRow: { gap: 6 },
    filterChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterText: { fontSize: 12, fontWeight: "600", color: colors.textMuted },
    filterTextActive: { color: colors.white },
    errorBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? "rgba(239,68,68,0.4)" : "#FECACA",
      backgroundColor: isDark ? "rgba(239,68,68,0.12)" : colors.dangerLight,
    },
    errorText: { flex: 1, fontSize: 13, color: colors.danger },
    loadingBox: { alignItems: "center", paddingVertical: 48, gap: 10 },
    mutedText: { fontSize: 13, color: colors.textMuted, textAlign: "center" },
    emptyCard: {
      alignItems: "center",
      gap: 8,
      paddingVertical: 36,
      paddingHorizontal: 20,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    emptyTitle: { fontSize: 15, fontWeight: "700", color: colors.text, textAlign: "center" },
    list: { gap: 12 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.border,
      overflow: "hidden",
    },
    cardLive: { borderColor: colors.success },
    liveBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.success,
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.white },
    liveBannerText: { color: colors.white, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
    cardBody: { padding: 12, gap: 8 },
    cardTop: { flexDirection: "row", gap: 8 },
    titleRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: 2 },
    cardTitle: { fontSize: 15, fontWeight: "800", color: colors.text, flexShrink: 1 },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    statusText: { fontSize: 11, fontWeight: "700" },
    description: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
    classRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
    classText: { fontSize: 12, fontWeight: "600", color: colors.purple },
    metaRow: { flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 4 },
    metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    metaText: { fontSize: 12, color: colors.textMuted },
    cardAction: { paddingHorizontal: 12, paddingBottom: 12 },
    joinButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.successDark,
      borderRadius: 12,
      paddingVertical: 11,
    },
    joinText: { color: colors.white, fontSize: 14, fontWeight: "800" },
    viewButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.surfaceElevated,
      borderRadius: 12,
      paddingVertical: 10,
    },
    viewText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
    note: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12 },
    noteText: { flex: 1, fontSize: 12, fontWeight: "600" },
    pagination: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    pageInfo: { fontSize: 12, color: colors.textMuted, flexShrink: 1 },
    pageButtons: { flexDirection: "row", gap: 6 },
    pageButton: {
      width: 34,
      height: 34,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    pageButtonDisabled: { opacity: 0.4 },
    statsCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 10,
    },
    statsHead: { flexDirection: "row", alignItems: "center", gap: 8 },
    statsTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
    statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    statTile: {
      flexGrow: 1,
      flexBasis: "45%",
      alignItems: "center",
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: colors.background,
    },
    statValue: { fontSize: 20, fontWeight: "800" },
    statLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  });

export default StudentCoursesBody;
