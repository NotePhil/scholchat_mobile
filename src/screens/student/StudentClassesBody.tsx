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
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState, LoadingSpinner } from "../../components/ui";
import StudentJoinClassPage from "./StudentJoinClassPage";
import StudentClassDetailPage from "./StudentClassDetailPage";
import { radius, spacing, typography, useThemeColors } from "../../styles/theme";
import { accederService, classAdminService, coursProgrammerService, learningService } from "../../services/api";
import type { ClasseResume } from "../../services/api";
import { ClassEntity } from "../../types";
import { useUser } from "../../context/UserContext";
import { useT } from "../../i18n";
import { useUiStore } from "../../store/useUiStore";
import { formatDate } from "../../utils/dates";

/**
 * Student "Classes" tab — a phone-width port of web's StudentClassList.jsx
 * (isParentView=false), which Principal.jsx renders for `case "classes"` for a
 * student (ParentClassManagement). Same data flow as web:
 *   1. GET /classes (kept: etat === "ACTIF") + GET /acceder/utilisateurs/{id}/classes
 *   2. GET /acceder/utilisateurs/{id}/demandes — the student's own requests
 *      (the per-class endpoint is restricted to class managers)
 *   3. only classes with an access status are listed
 *   4. course counts (GET /cours-programmes/by-classe/{id}) and member counts
 *      (GET /acceder/classes/{id}/utilisateurs)
 * The only way to add a class is "Rejoindre" (activation code), and opening an
 * approved class shows its scheduled courses as a full page (back button).
 */

type AccessStatus = "APPROVED" | "PENDING" | "REJECTED";

export const LEVEL_CONFIG: Record<string, { color: string; bg: string }> = {
  MATERNELLE: { color: "#1976D2", bg: "rgba(25,118,210,0.12)" },
  PRIMAIRE: { color: "#2E7D32", bg: "rgba(46,125,50,0.12)" },
  COLLEGE: { color: "#F57C00", bg: "rgba(245,124,0,0.12)" },
  LYCEE: { color: "#D32F2F", bg: "rgba(211,47,47,0.12)" },
  UNIVERSITE: { color: "#7B1FA2", bg: "rgba(123,31,162,0.12)" },
  AUTRES: { color: "#757575", bg: "rgba(117,117,117,0.14)" },
};

export const getLevelKey = (niveau = "") => {
  if (!niveau) return "AUTRES";
  const n = niveau.toLowerCase();
  if (n.includes("maternelle")) return "MATERNELLE";
  if (n.includes("primaire") || n.includes("cp") || n.includes("ce") || n.includes("cm")) return "PRIMAIRE";
  if (["6ème", "5ème", "4ème", "3ème"].some((v) => n.includes(v))) return "COLLEGE";
  if (["2nde", "1ère", "terminale"].some((v) => n.includes(v))) return "LYCEE";
  if (["licence", "master", "doctorat"].some((v) => n.includes(v))) return "UNIVERSITE";
  return "AUTRES";
};

const ACCESS: Record<AccessStatus, { color: string; bg: string; border: string; icon: string }> = {
  APPROVED: { color: "#16a34a", bg: "rgba(22,163,74,0.10)", border: "rgba(22,163,74,0.35)", icon: "check-circle" },
  PENDING: { color: "#d97706", bg: "rgba(217,119,6,0.10)", border: "rgba(217,119,6,0.35)", icon: "clock" },
  REJECTED: { color: "#dc2626", bg: "rgba(220,38,38,0.10)", border: "rgba(220,38,38,0.35)", icon: "lock" },
};

type View_ = { name: "list" } | { name: "join" } | { name: "detail"; classe: ClassEntity };

const StudentClassesBody = () => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { user } = useUser();
  const userId = user?.userId;

  const [allClasses, setAllClasses] = useState<ClassEntity[]>([]);
  const [userClasses, setUserClasses] = useState<ClassEntity[]>([]);
  const [accessMap, setAccessMap] = useState<Record<string, AccessStatus>>({});
  const [courseCounts, setCourseCounts] = useState<Record<string, number>>({});
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  /** GET /utilisateurs/{id}/classes/resume (course + homework counts); empty when unavailable. */
  const [summaries, setSummaries] = useState<Record<string, ClasseResume>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [pendingMsg, setPendingMsg] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [view, setView] = useState<View_>({ name: "list" });

  const fetchData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError("");
    try {
      const [allData, approvedData, summaryList] = await Promise.all([
        classAdminService.getAll(),
        accederService.getAccessibleClasses(userId),
        learningService.getLearnerClassesSummary(userId).catch(() => [] as ClasseResume[]),
      ]);
      const summaryMap: Record<string, ClasseResume> = {};
      summaryList.forEach((r) => {
        summaryMap[r.classeId] = r;
      });
      setSummaries(summaryMap);
      const active = (allData || []).filter((c) => c.etat === "ACTIF");
      setAllClasses(active);

      const map: Record<string, AccessStatus> = {};
      (approvedData || []).forEach((c) => {
        map[c.id] = "APPROVED";
      });

      // The student's own requests in one call; the latest one per class wins.
      const myRequests = await accederService.getMyRequests(userId).catch(() => []);
      const latestByClass: Record<string, (typeof myRequests)[number]> = {};
      (myRequests || []).forEach((req) => {
        const cid = (req as any).classeId ?? (req as any).classe?.id;
        if (cid) latestByClass[String(cid)] = req;
      });
      Object.entries(latestByClass).forEach(([classId, latest]) => {
        if (map[classId]) return;
        const etat = (latest as any).etat || "";
        if (etat === "APPROUVEE") map[classId] = "APPROVED";
        else if (etat === "REJETEE") map[classId] = "REJECTED";
        else map[classId] = "PENDING";
      });
      setAccessMap(map);

      const myClasses = active.filter((c) => map[c.id]);
      setUserClasses(myClasses);

      const countMap: Record<string, number> = {};
      const memberMap: Record<string, number> = {};
      await Promise.all([
        // Course counts: from the summary when present, else one call per class (fallback).
        ...myClasses.map(async (c) => {
          if (summaryMap[c.id]) {
            countMap[c.id] = summaryMap[c.id].nbCours;
            return;
          }
          try {
            countMap[c.id] = ((await coursProgrammerService.getByClasse(c.id)) || []).length;
          } catch {
            countMap[c.id] = 0;
          }
        }),
        ...myClasses.map(async (c) => {
          try {
            memberMap[c.id] = ((await accederService.getUsersWithAccess(c.id)) || []).length;
          } catch {
            memberMap[c.id] = c.eleves?.length || 0;
          }
        }),
      ]);
      setCourseCounts(countMap);
      setMemberCounts(memberMap);
    } catch {
      setError(t("studentClasses.loadError"));
    } finally {
      setLoading(false);
    }
  }, [userId, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Opened from a notification tap (useUiStore.requestClass): once the classes and access
  // statuses are loaded, open that class — or explain why it can't be (request pending /
  // declined, class gone or no longer accessible) instead of silently showing the list.
  const pendingClass = useUiStore((s) => s.pendingClass);
  useEffect(() => {
    if (!pendingClass || loading) return;
    const { classId } = pendingClass;
    useUiStore.getState().clearPendingClass();
    const cls = userClasses.find((c) => String(c.id) === classId);
    const status = cls ? accessMap[cls.id] : undefined;
    if (cls && status === "APPROVED") setView({ name: "detail", classe: cls });
    else if (cls && status === "PENDING") Alert.alert(t("parentClasses.pendingTitle"), t("notifications.classPending", { name: cls.nom ?? "" }));
    else if (cls && status === "REJECTED") Alert.alert(t("parentClasses.rejectedTitle"), t("notifications.classRejected", { name: cls.nom ?? "" }));
    else Alert.alert(t("notifications.unavailableTitle"), t("notifications.classUnavailable"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingClass, loading]);

  // Dashboard "Rejoindre une classe" CTA: open the join page on arrival.
  const pendingJoinClass = useUiStore((s) => s.pendingJoinClass);
  useEffect(() => {
    if (!pendingJoinClass) return;
    useUiStore.getState().clearPendingJoinClass();
    setView({ name: "join" });
  }, [pendingJoinClass]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  // Called by the join page once POST /acceder/demandes succeeded — same
  // local update as web's handleRequestAccess.
  const handleRequested = (classe: ClassEntity) => {
    setAccessMap((prev) => ({ ...prev, [classe.id]: "PENDING" }));
    setUserClasses((prev) => (prev.some((c) => c.id === classe.id) ? prev : [...prev, classe]));
    setFlash(t("studentClasses.requestSent"));
    setView({ name: "list" });
  };

  if (view.name === "join") {
    return (
      <StudentJoinClassPage
        allClasses={allClasses}
        userId={userId}
        onBack={() => setView({ name: "list" })}
        onRequested={handleRequested}
      />
    );
  }

  if (view.name === "detail") {
    return <StudentClassDetailPage classe={view.classe} onBack={() => setView({ name: "list" })} />;
  }

  const q = search.toLowerCase();
  const filtered = userClasses.filter(
    (c) => !search || c.nom?.toLowerCase().includes(q) || c.niveau?.toLowerCase().includes(q)
  );
  const approvedCount = userClasses.filter((c) => accessMap[c.id] === "APPROVED").length;
  const pendingCount = userClasses.filter((c) => accessMap[c.id] === "PENDING").length;
  const accessLabel = (s: AccessStatus) =>
    s === "APPROVED"
      ? t("studentClasses.accessApproved")
      : s === "PENDING"
      ? t("studentClasses.accessPending")
      : t("studentClasses.accessRejected");

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 150 }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />}
    >
      {/* Header */}
      <LinearGradient colors={["#1d3557", "#457b9d"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroIcon}>
            <FontAwesome5 name="book" size={17} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.heroTitle}>{t("studentClasses.title")}</Text>
            <Text style={styles.heroSub}>{t("studentClasses.available", { count: userClasses.length })}</Text>
          </View>
          <TouchableOpacity
            style={styles.heroIconBtn}
            onPress={handleRefresh}
            disabled={refreshing}
            activeOpacity={0.75}
            accessibilityLabel={t("studentClasses.refresh")}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <FontAwesome5 name="sync-alt" size={12} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>

        {/* Prominent "Rejoindre une classe" — first thing visible, no scrolling needed. */}
        <TouchableOpacity
          style={styles.joinBtn}
          onPress={() => setView({ name: "join" })}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={t("joinClass.cta")}
        >
          <View style={styles.joinBtnIcon}>
            <FontAwesome5 name="user-plus" size={14} color="#1d3557" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.joinBtnText}>{t("joinClass.cta")}</Text>
            <Text style={styles.joinBtnSub} numberOfLines={1}>{t("joinClass.ctaSubtitle")}</Text>
          </View>
          <FontAwesome5 name="chevron-right" size={12} color="#1d3557" />
        </TouchableOpacity>

        <View style={styles.statsStrip}>
          {[
            { icon: "book", val: userClasses.length, label: t("studentClasses.statTotal") },
            { icon: "check-circle", val: approvedCount, label: t("studentClasses.statActive") },
            { icon: "clock", val: pendingCount, label: t("studentClasses.statPending") },
          ].map((s) => (
            <View key={s.icon} style={styles.statChip}>
              <FontAwesome5 name={s.icon} size={11} color="#FFFFFF" />
              <Text style={styles.statVal}>{s.val}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.filterBox}>
          <FontAwesome5 name="search" size={12} color="rgba(255,255,255,0.65)" />
          <TextInput
            style={styles.filterInput}
            value={search}
            onChangeText={setSearch}
            placeholder={t("studentClasses.filterPlaceholder")}
            placeholderTextColor="rgba(255,255,255,0.6)"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
              <FontAwesome5 name="times-circle" size={13} color="rgba(255,255,255,0.75)" solid />
            </TouchableOpacity>
          ) : null}
        </View>
      </LinearGradient>

      {flash ? (
        <View style={[styles.banner, { backgroundColor: ACCESS.APPROVED.bg, borderColor: ACCESS.APPROVED.border }]}>
          <FontAwesome5 name="check-circle" size={13} color={ACCESS.APPROVED.color} />
          <Text style={[styles.bannerText, { color: ACCESS.APPROVED.color }]}>{flash}</Text>
          <TouchableOpacity onPress={() => setFlash(null)} hitSlop={8}>
            <Text style={[styles.bannerClose, { color: ACCESS.APPROVED.color }]}>{t("studentClasses.close")}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {pendingMsg ? (
        <View style={[styles.banner, { backgroundColor: ACCESS.PENDING.bg, borderColor: ACCESS.PENDING.border }]}>
          <FontAwesome5 name="clock" size={13} color={ACCESS.PENDING.color} />
          <Text style={[styles.bannerText, { color: ACCESS.PENDING.color }]}>
            {t("studentClasses.pendingMsg", { name: pendingMsg })}
          </Text>
          <TouchableOpacity onPress={() => setPendingMsg(null)} hitSlop={8}>
            <Text style={[styles.bannerClose, { color: ACCESS.PENDING.color }]}>{t("studentClasses.close")}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {error && userClasses.length > 0 ? <Text style={styles.error}>{error}</Text> : null}

      {loading && !refreshing ? (
        <LoadingSpinner label={t("studentClasses.loading")} />
      ) : error && userClasses.length === 0 ? (
        // Failed load: error + retry, never the "no class" empty state.
        <EmptyState
          icon="exclamation-triangle"
          title={t("classDetails.error.classes")}
          message={error}
          actionLabel={t("classDetails.retry")}
          onAction={fetchData}
        />
      ) : filtered.length === 0 ? (
        <View style={styles.emptyCard}>
          <FontAwesome5 name="book" size={44} color={colors.grayLight} />
          <Text style={styles.emptyTitle}>
            {userClasses.length === 0 ? t("studentClasses.emptyNone") : t("studentClasses.emptyFiltered")}
          </Text>
          <Text style={styles.emptyText}>
            {userClasses.length === 0 ? t("studentClasses.emptyNoneHint") : t("studentClasses.emptyFilteredHint")}
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setView({ name: "join" })} activeOpacity={0.85}>
            <FontAwesome5 name="search" size={12} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>{t("studentClasses.joinClass")}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        filtered.map((classe) => {
          const status = accessMap[classe.id];
          const isApproved = status === "APPROVED";
          const isPending = status === "PENDING";
          const levelCfg = LEVEL_CONFIG[getLevelKey(classe.niveau)];
          const accessCfg = status ? ACCESS[status] : null;
          const courseCount = courseCounts[classe.id] ?? "—";
          const memberCount = memberCounts[classe.id] ?? (classe.eleves?.length || 0);
          const toDo = summaries[classe.id]?.nbDevoirsAFaire ?? 0;
          return (
            <View key={classe.id} style={[styles.card, isApproved && { borderColor: "rgba(37,99,235,0.35)" }]}>
              {isApproved ? (
                <LinearGradient colors={["#2563eb", "#4f46e5"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.accent} />
              ) : (
                <View style={[styles.accent, { backgroundColor: colors.border }]} />
              )}
              <View style={styles.cardBody}>
                <View style={styles.titleRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{classe.nom}</Text>
                    {classe.etablissement?.nom ? (
                      <View style={styles.inlineRow}>
                        <FontAwesome5 name="university" size={10} color={colors.textLight} />
                        <Text style={styles.cardSub} numberOfLines={1}>{classe.etablissement.nom}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={[styles.levelPill, { backgroundColor: levelCfg.bg }]}>
                    <Text style={[styles.levelPillText, { color: levelCfg.color }]} numberOfLines={1}>
                      {classe.niveau || "—"}
                    </Text>
                  </View>
                </View>

                <View style={styles.statsRow}>
                  <View style={styles.inlineRow}>
                    <View style={[styles.miniIcon, { backgroundColor: "rgba(37,99,235,0.12)" }]}>
                      <FontAwesome5 name="book" size={10} color="#2563eb" />
                    </View>
                    <Text style={styles.statText}>
                      <Text style={styles.statStrong}>{courseCount}</Text> {t("studentClasses.courses")}
                    </Text>
                  </View>
                  <View style={styles.inlineRow}>
                    <View style={[styles.miniIcon, { backgroundColor: "rgba(22,163,74,0.12)" }]}>
                      <FontAwesome5 name="user-friends" size={10} color="#16a34a" />
                    </View>
                    <Text style={styles.statText}>
                      <Text style={styles.statStrong}>{memberCount}</Text> {t("studentClasses.members")}
                    </Text>
                  </View>
                  {isApproved && toDo > 0 ? (
                    <View style={styles.inlineRow}>
                      <View style={[styles.miniIcon, { backgroundColor: "rgba(217,119,6,0.12)" }]}>
                        <FontAwesome5 name="tasks" size={10} color="#d97706" />
                      </View>
                      <Text style={styles.statText}>{t("learning.classes.devoirsToDo", { count: toDo })}</Text>
                    </View>
                  ) : null}
                  {classe.dateCreation ? (
                    <View style={[styles.inlineRow, { marginLeft: "auto" }]}>
                      <FontAwesome5 name="calendar-alt" size={10} color={colors.textLight} />
                      <Text style={styles.cardSub}>{formatDate(classe.dateCreation, { day: "2-digit", month: "short" })}</Text>
                    </View>
                  ) : null}
                </View>

                {accessCfg && status ? (
                  <View style={[styles.accessBadge, { backgroundColor: accessCfg.bg, borderColor: accessCfg.border }]}>
                    <FontAwesome5 name={accessCfg.icon} size={10} color={accessCfg.color} />
                    <Text style={[styles.accessBadgeText, { color: accessCfg.color }]}>{accessLabel(status)}</Text>
                  </View>
                ) : null}

                <View style={styles.actionArea}>
                  {isApproved ? (
                    <TouchableOpacity onPress={() => setView({ name: "detail", classe })} activeOpacity={0.85}>
                      <LinearGradient colors={["#2563eb", "#4f46e5"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionBtn}>
                        <FontAwesome5 name="sign-in-alt" size={13} color="#FFFFFF" />
                        <Text style={styles.actionBtnTextWhite}>{t("learning.classes.enter")}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  ) : isPending ? (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: ACCESS.PENDING.bg, borderWidth: 1, borderColor: ACCESS.PENDING.border }]}
                      onPress={() => setPendingMsg(classe.nom ?? "")}
                      activeOpacity={0.8}
                    >
                      <FontAwesome5 name="clock" size={11} color={ACCESS.PENDING.color} />
                      <Text style={[styles.actionBtnText, { color: ACCESS.PENDING.color }]}>{t("studentClasses.requestPending")}</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: "rgba(37,99,235,0.10)", borderWidth: 1, borderColor: "rgba(37,99,235,0.35)" }]}
                      onPress={() => setView({ name: "join" })}
                      activeOpacity={0.8}
                    >
                      <FontAwesome5 name="lock" size={11} color="#2563eb" />
                      <Text style={[styles.actionBtnText, { color: "#2563eb" }]}>{t("studentClasses.requestAccess")}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: { flex: 1 },
    content: { paddingHorizontal: 16, paddingTop: spacing.sm, gap: spacing.md },
    hero: { borderRadius: radius.md, overflow: "hidden", padding: spacing.lg, gap: spacing.md },
    heroTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    joinBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: "#FFFFFF",
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
    },
    joinBtnIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: "rgba(29,53,87,0.12)", alignItems: "center", justifyContent: "center" },
    joinBtnText: { color: "#1d3557", fontSize: 15, fontWeight: "700" },
    joinBtnSub: { color: "#457b9d", fontSize: 12, marginTop: 1 },
    heroIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: "rgba(255,255,255,0.2)",
      alignItems: "center",
      justifyContent: "center",
    },
    heroTitle: { ...typography.h4, color: "#FFFFFF", fontWeight: "800" },
    heroSub: { ...typography.caption, color: "rgba(255,255,255,0.8)" },
    heroBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: radius.sm,
      backgroundColor: "rgba(255,255,255,0.2)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.3)",
    },
    heroBtnText: { ...typography.captionBold, color: "#FFFFFF" },
    heroIconBtn: {
      width: 32,
      height: 32,
      borderRadius: radius.sm,
      backgroundColor: "rgba(255,255,255,0.2)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.3)",
      alignItems: "center",
      justifyContent: "center",
    },
    statsStrip: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    statChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "rgba(255,255,255,0.15)",
      borderRadius: radius.sm,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    statVal: { ...typography.bodyBold, color: "#FFFFFF" },
    statLabel: { ...typography.caption, color: "rgba(255,255,255,0.8)" },
    filterBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: "rgba(255,255,255,0.15)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.25)",
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
    },
    filterInput: { flex: 1, color: "#FFFFFF", fontSize: 14, paddingVertical: 8 },
    banner: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      borderWidth: 1,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    bannerText: { ...typography.caption, flex: 1, fontWeight: "600" },
    bannerClose: { ...typography.captionBold },
    error: { ...typography.caption, color: colors.danger },
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
    emptyText: { ...typography.caption, color: colors.textMuted, textAlign: "center", marginBottom: spacing.sm },
    primaryBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.lg,
      paddingVertical: 10,
      borderRadius: radius.sm,
    },
    primaryBtnText: { ...typography.bodyBold, color: "#FFFFFF" },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    accent: { height: 6, width: "100%" },
    cardBody: { padding: spacing.lg, gap: spacing.md },
    titleRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
    cardTitle: { ...typography.bodyBold, color: colors.text },
    cardSub: { ...typography.caption, color: colors.textLight, flexShrink: 1 },
    inlineRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    levelPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full, maxWidth: 140 },
    levelPillText: { ...typography.captionBold },
    statsRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, flexWrap: "wrap" },
    miniIcon: { width: 24, height: 24, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    statText: { ...typography.caption, color: colors.textMuted },
    statStrong: { fontWeight: "700", color: colors.text },
    accessBadge: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radius.full,
      borderWidth: 1,
    },
    accessBadgeText: { ...typography.captionBold },
    actionArea: { paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
    actionBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      paddingVertical: 10,
      borderRadius: radius.sm,
    },
    actionBtnText: { ...typography.bodyBold, fontSize: 13 },
    actionBtnTextWhite: { ...typography.bodyBold, fontSize: 13, color: "#FFFFFF" },
  });

export default StudentClassesBody;
