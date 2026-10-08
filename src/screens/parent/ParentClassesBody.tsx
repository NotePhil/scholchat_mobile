import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Badge, EmptyState, LoadingSpinner } from "../../components/ui";
import JoinClassSheet from "../shared/JoinClassSheet";
import { getLevelStyle } from "../shared/StudentClassDetailModal";
import StudentClassDetailPage from "../student/StudentClassDetailPage";
import ChildSelectorRow from "./ChildSelectorRow";
import AddChildSheet from "./AddChildSheet";
import { radius, spacing, typography, useThemeColors } from "../../styles/theme";
import { accederService, classAdminService, parentService } from "../../services/api";
import { ClassEntity } from "../../types";
import { useUser } from "../../context/UserContext";
import { useSelectedChildStore } from "../../store/useSelectedChildStore";
import { serverDateMs } from "../../utils/dates";
import { useT } from "../../i18n";
import { useUiStore } from "../../store/useUiStore";
import { useMountedRef } from "../../hooks/useMountedRef";

type AccessState = "APPROVED" | "EN_ATTENTE" | "REJETEE" | "NONE";

interface ClassWithAccess {
  cls: ClassEntity;
  access: AccessState;
  motifRejet?: string;
}

const ParentClassesBody = () => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useUser();
  const { t } = useT();
  const { children, selectedChildId, loadChildren } = useSelectedChildStore();
  const [rows, setRows] = useState<ClassWithAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [showJoin, setShowJoin] = useState(false);
  const [showAddChild, setShowAddChild] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassEntity | null>(null);

  useEffect(() => {
    if (user?.userId) loadChildren(user.userId);
  }, [user?.userId, loadChildren]);

  // Dashboard "Rejoindre une classe" CTA: open the join flow on arrival.
  const pendingJoinClass = useUiStore((s) => s.pendingJoinClass);
  useEffect(() => {
    if (!pendingJoinClass) return;
    useUiStore.getState().clearPendingJoinClass();
    setSelectedClass(null);
    setTimeout(() => (useSelectedChildStore.getState().selectedChildId ? setShowJoin(true) : setShowAddChild(true)), 250);
  }, [pendingJoinClass]);

  // Mirrors web's StudentClassList.jsx (isParentView): only the child's classes are
  // listed — the ones they're in, plus those with a pending/rejected request — each with
  // its access status. Other classes are joined with the class code via "+".
  // Requests come from GET /acceder/utilisateurs/{id}/demandes: the parent's own requests
  // made for this child (minor classes: eleveAssocieId) and the child's own (adult).
  const loadClasses = useCallback(async () => {
    if (!selectedChildId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [approved, all, parentRequests, childRequests] = await Promise.all([
        parentService.getChildClasses(selectedChildId),
        classAdminService.getAll(),
        user?.userId ? accederService.getMyRequests(user.userId).catch(() => []) : Promise.resolve([]),
        accederService.getMyRequests(selectedChildId).catch(() => []),
      ]);
      const approvedIds = new Set(approved.map((c) => c.id));
      const requests = [
        ...parentRequests.filter((r) => r.eleveAssocieId === selectedChildId),
        ...childRequests,
      ];

      const built: ClassWithAccess[] = [];
      all
        .filter((cls) => cls.etat === "ACTIF" || approvedIds.has(cls.id))
        .forEach((cls) => {
          if (approvedIds.has(cls.id)) {
            built.push({ cls, access: "APPROVED" });
            return;
          }
          const mine = requests
            .filter((r) => r.classeId === cls.id)
            .sort((a, b) => serverDateMs(b.dateDemande ?? 0) - serverDateMs(a.dateDemande ?? 0))[0];
          if (!mine) return;
          if (mine.etat === "APPROUVEE") built.push({ cls, access: "APPROVED" });
          else if (mine.etat === "REJETEE") built.push({ cls, access: "REJETEE", motifRejet: mine.motifRejet });
          else built.push({ cls, access: "EN_ATTENTE" });
        });

      setRows(built);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("studentClasses.loadError"));
    } finally {
      setLoading(false);
    }
  }, [selectedChildId, user?.userId, t]);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  // Switching child closes the class that was open for the previous one.
  useEffect(() => setSelectedClass(null), [selectedChildId]);

  // Opened from a notification tap (useUiStore.requestClass): find the child concerned by that
  // class (selected child first), select them and open the class; a request still pending /
  // declined, or a class no longer reachable, is explained instead of silently showing the list.
  const pendingClass = useUiStore((s) => s.pendingClass);
  const mountedRef = useMountedRef();
  const [openingClass, setOpeningClass] = useState(false);
  const [openAfterSwitch, setOpenAfterSwitch] = useState<{ childId: string; cls: ClassEntity } | null>(null);
  useEffect(() => {
    if (!pendingClass) return;
    const { classId } = pendingClass;
    useUiStore.getState().clearPendingClass();
    setOpeningClass(true);
    (async () => {
      const parentId = user?.userId;
      const store = useSelectedChildStore.getState();
      if (!store.loaded && parentId) await store.loadChildren(parentId);
      const { children: kids, selectedChildId: current } = useSelectedChildStore.getState();
      const ordered = [...kids].sort((a, b) => (a.id === current ? -1 : b.id === current ? 1 : 0));
      let found: { childId: string; cls: ClassEntity } | null = null;
      for (const kid of ordered) {
        const classes = await parentService.getChildClasses(kid.id).catch(() => [] as ClassEntity[]);
        const cls = classes.find((c) => String(c.id) === classId);
        if (cls) {
          found = { childId: kid.id, cls };
          break;
        }
      }
      if (!mountedRef.current) return;
      if (found) {
        setOpeningClass(false);
        if (found.childId !== current) {
          setOpenAfterSwitch(found);
          useSelectedChildStore.getState().setSelectedChildId(found.childId);
        } else {
          setSelectedClass(found.cls);
        }
        return;
      }
      // Not (yet) a member: the parent's latest request for that class tells why.
      const requests = parentId ? await accederService.getMyRequests(parentId).catch(() => []) : [];
      if (!mountedRef.current) return;
      setOpeningClass(false);
      const req = requests
        .filter((r) => String(r.classeId) === classId)
        .sort((a, b) => serverDateMs(b.dateDemande ?? 0) - serverDateMs(a.dateDemande ?? 0))[0];
      if (req?.eleveAssocieId && req.eleveAssocieId !== current && kids.some((k) => k.id === req.eleveAssocieId)) {
        useSelectedChildStore.getState().setSelectedChildId(req.eleveAssocieId);
      }
      const name = (req?.classeNom as string | undefined) ?? "";
      if (req && req.etat === "REJETEE") Alert.alert(t("parentClasses.rejectedTitle"), t("notifications.classRejected", { name }));
      else if (req && req.etat !== "APPROUVEE") Alert.alert(t("parentClasses.pendingTitle"), t("notifications.classPending", { name }));
      else Alert.alert(t("notifications.unavailableTitle"), t("notifications.classUnavailable"));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingClass]);
  // Declared after the "switching child closes the class" reset so that it wins in the same commit.
  useEffect(() => {
    if (openAfterSwitch && openAfterSwitch.childId === selectedChildId) {
      setSelectedClass(openAfterSwitch.cls);
      setOpenAfterSwitch(null);
    }
  }, [openAfterSwitch, selectedChildId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadClasses();
    setRefreshing(false);
  };

  const handleRowPress = (row: ClassWithAccess) => {
    if (row.access === "APPROVED") {
      setSelectedClass(row.cls);
    } else if (row.access === "EN_ATTENTE") {
      Alert.alert(t("parentClasses.pendingTitle"), t("parentClasses.pendingMsg", { name: row.cls.nom ?? "" }));
    } else if (row.access === "REJETEE") {
      Alert.alert(
        t("parentClasses.rejectedTitle"),
        row.motifRejet
          ? t("parentClasses.rejectedMsgReason", { name: row.cls.nom ?? "", reason: row.motifRejet })
          : t("parentClasses.rejectedMsg", { name: row.cls.nom ?? "" })
      );
    } else {
      setShowJoin(true);
    }
  };

  const child = children.find((c) => c.id === selectedChildId);
  const childName = child?.prenom || child?.nom || "";

  // Entering an approved class: same full page as the student (web: StudentClassList → CoursProgrammeManagement), fed with the child's id.
  if (openingClass) {
    return <LoadingSpinner label={t("notifications.opening")} fullScreen />;
  }

  if (selectedClass && selectedChildId) {
    return <StudentClassDetailPage classe={selectedClass} learnerId={selectedChildId} onBack={() => setSelectedClass(null)} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {childName ? t("parentClasses.childTitle", { name: childName }) : t("parentClasses.title")}
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => setShowAddChild(true)}
            activeOpacity={0.7}
            accessibilityLabel={t("parentClasses.addChild")}
          >
            <FontAwesome5 name="child" size={14} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Prominent "Rejoindre une classe" — visible without scrolling. */}
      <TouchableOpacity
        style={styles.joinBtn}
        onPress={() => (selectedChildId ? setShowJoin(true) : setShowAddChild(true))}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={t("joinClass.cta")}
      >
        <FontAwesome5 name="user-plus" size={14} color={colors.white} />
        <View style={{ flex: 1 }}>
          <Text style={styles.joinBtnText}>{t("joinClass.cta")}</Text>
          <Text style={styles.joinBtnSub} numberOfLines={1}>
            {selectedChildId ? t("joinClass.ctaSubtitleParent") : t("joinClass.noChild")}
          </Text>
        </View>
        <FontAwesome5 name="chevron-right" size={12} color={colors.white} />
      </TouchableOpacity>

      <ChildSelectorRow />

      <ScrollView
        style={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />}
      >
        {error && rows.length > 0 ? <Text style={styles.error}>{error}</Text> : null}
        {children.length === 0 ? (
          <EmptyState
            icon="child"
            title={t("parentClasses.noChildrenTitle")}
            message={t("parentClasses.noChildrenText")}
            actionLabel={t("parentClasses.addChild")}
            onAction={() => setShowAddChild(true)}
          />
        ) : loading && !refreshing ? (
          <LoadingSpinner label={t("studentClasses.loading")} />
        ) : error && rows.length === 0 ? (
          // Failed load: error + retry, never the "no class" empty state.
          <EmptyState
            icon="exclamation-triangle"
            title={t("classDetails.error.classes")}
            message={error}
            actionLabel={t("classDetails.retry")}
            onAction={loadClasses}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="chalkboard"
            title={t("parentClasses.emptyTitle")}
            message={t("parentClasses.emptyText", { name: childName || t("parentClasses.yourChild") })}
            actionLabel={t("studentClasses.joinClass")}
            onAction={() => setShowJoin(true)}
          />
        ) : (
          rows.map(({ cls, access, motifRejet }) => {
            const levelStyle = getLevelStyle(cls.niveau);
            const badge =
              access === "APPROVED"
                ? { label: t("parentClasses.enrolled"), tone: "success" as const }
                : access === "EN_ATTENTE"
                ? { label: t("studentClasses.requestPending"), tone: "warning" as const }
                : access === "REJETEE"
                ? { label: t("parentClasses.rejectedTitle"), tone: "danger" as const }
                : null;
            const actionLabel =
              access === "APPROVED"
                ? t("parentClasses.viewCourses")
                : access === "EN_ATTENTE"
                ? t("parentClasses.pendingAction")
                : access === "REJETEE"
                ? t("parentClasses.seeReason")
                : t("studentClasses.requestAccess");
            const actionIcon =
              access === "APPROVED" ? "eye" : access === "EN_ATTENTE" ? "clock" : access === "REJETEE" ? "info-circle" : "paper-plane";
            return (
              <TouchableOpacity
                key={cls.id}
                style={styles.classCard}
                onPress={() => handleRowPress({ cls, access, motifRejet })}
                activeOpacity={0.7}
              >
                <View style={styles.cardTop}>
                  <View style={styles.classIconWrap}>
                    <FontAwesome5 name="graduation-cap" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.className}>{cls.nom ?? t("parentClasses.classFallback")}</Text>
                    {cls.niveau && (
                      <View style={[styles.levelBadge, { backgroundColor: levelStyle.bg }]}>
                        <Text style={[styles.levelBadgeText, { color: levelStyle.text }]}>{cls.niveau}</Text>
                      </View>
                    )}
                  </View>
                  {badge ? <Badge label={badge.label} tone={badge.tone} /> : null}
                </View>

                {cls.etablissement?.nom ? (
                  <View style={styles.metaRow}>
                    <FontAwesome5 name="school" size={12} color={colors.textMuted} />
                    <Text style={styles.classMeta} numberOfLines={1}>{cls.etablissement.nom}</Text>
                  </View>
                ) : null}

                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => handleRowPress({ cls, access, motifRejet })}>
                    <FontAwesome5 name={actionIcon} size={12} color={colors.primary} />
                    <Text style={styles.actionBtnText}>{actionLabel}</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <JoinClassSheet
        visible={showJoin}
        onClose={() => setShowJoin(false)}
        onSubmitted={loadClasses}
        utilisateurId={selectedChildId ?? undefined}
        estParent
      />

      <AddChildSheet
        visible={showAddChild}
        onClose={() => setShowAddChild(false)}
        onAdded={() => user?.userId && loadChildren(user.userId)}
        parentId={user?.userId}
      />
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: spacing.md,
  },
  title: { ...typography.h1, color: colors.text, flex: 1, marginRight: spacing.sm },
  joinBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: 16,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    elevation: 2,
  },
  joinBtnText: { color: colors.white, fontSize: 15, fontWeight: "700" },
  joinBtnSub: { color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 1 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  list: { flex: 1, paddingHorizontal: 16 },
  error: { color: colors.danger, marginBottom: spacing.md },
  classCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  classIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  className: { ...typography.bodyBold, fontSize: 15, color: colors.text },
  levelBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 2,
  },
  levelBadgeText: { fontSize: 10, fontWeight: "700" },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  classMeta: { ...typography.caption, color: colors.textMuted },
  cardActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 2,
  },
  actionBtnText: { ...typography.caption, color: colors.primary, fontWeight: "700" },
});

export default ParentClassesBody;
