import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Badge, EmptyState, LoadingSpinner } from "../../components/ui";
import JoinClassSheet from "../shared/JoinClassSheet";
import StudentClassDetailModal, { getLevelStyle } from "../shared/StudentClassDetailModal";
import { colors, radius, spacing, typography, useThemeColors } from "../../styles/theme";
import { accederService, classAdminService } from "../../services/api";
import { ClassEntity } from "../../types";
import { useUser } from "../../context/UserContext";

type AccessState = "APPROVED" | "EN_ATTENTE" | "REJETEE" | "NONE";

interface ClassWithAccess {
  cls: ClassEntity;
  access: AccessState;
  motifRejet?: string;
}

const StudentClassesBody = () => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useUser();
  const navigation = useNavigation<any>();
  const [rows, setRows] = useState<ClassWithAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [showJoin, setShowJoin] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassEntity | null>(null);

  // Mirrors web's StudentClassList.jsx (isParentView=false, same component
  // web serves to both students and parents): every class is shown, not just
  // the ones already joined, with a per-class access status — mobile
  // previously only fetched the approved subset (same fix already applied
  // to ParentClassesBody.tsx for the parent role).
  const load = useCallback(async () => {
    if (!user?.userId) return;
    setLoading(true);
    setError("");
    try {
      const [approved, all] = await Promise.all([
        accederService.getAccessibleClasses(user.userId),
        classAdminService.getAll(),
      ]);
      const approvedIds = new Set(approved.map((c) => c.id));
      const pending = all.filter((c) => !approvedIds.has(c.id));

      const requestResults = await Promise.all(
        pending.map((c) => accederService.getRequestsForClass(c.id).catch(() => []))
      );

      const built: ClassWithAccess[] = all.map((cls) => {
        if (approvedIds.has(cls.id)) {
          return { cls, access: "APPROVED" as const };
        }
        const idx = pending.findIndex((c) => c.id === cls.id);
        const requests = idx >= 0 ? requestResults[idx] : [];
        const mine = requests
          .filter((r) => r.utilisateurId === user.userId)
          .sort((a, b) => new Date(b.dateDemande ?? 0).getTime() - new Date(a.dateDemande ?? 0).getTime())[0];
        if (!mine) return { cls, access: "NONE" as const };
        if (mine.etat === "APPROUVEE") return { cls, access: "APPROVED" as const };
        if (mine.etat === "REJETEE") return { cls, access: "REJETEE" as const, motifRejet: mine.motifRejet };
        return { cls, access: "EN_ATTENTE" as const };
      });

      setRows(built);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du chargement des classes.");
    } finally {
      setLoading(false);
    }
  }, [user?.userId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleRowPress = (row: ClassWithAccess) => {
    if (row.access === "APPROVED") {
      setSelectedClass(row.cls);
    } else if (row.access === "EN_ATTENTE") {
      Alert.alert("Demande en attente", `Votre demande d'accès à "${row.cls.nom}" est en attente de validation par le modérateur.`);
    } else if (row.access === "REJETEE") {
      Alert.alert(
        "Demande refusée",
        row.motifRejet
          ? `Votre demande d'accès à "${row.cls.nom}" a été refusée : ${row.motifRejet}`
          : `Votre demande d'accès à "${row.cls.nom}" a été refusée.`
      );
    } else {
      setShowJoin(true);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mes classes</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowJoin(true)} activeOpacity={0.7}>
          <FontAwesome5 name="plus" size={14} color={colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />}
      >
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading && !refreshing ? (
          <LoadingSpinner label="Chargement des classes..." />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="chalkboard"
            title="Aucune classe"
            message="Aucune classe n'est disponible pour le moment."
            actionLabel="Rejoindre une classe"
            onAction={() => setShowJoin(true)}
          />
        ) : (
          rows.map(({ cls, access, motifRejet }) => {
            const levelStyle = getLevelStyle(cls.niveau);
            const badge =
              access === "APPROVED"
                ? { label: "Inscrit", tone: "success" as const }
                : access === "EN_ATTENTE"
                ? { label: "Demande en attente", tone: "warning" as const }
                : access === "REJETEE"
                ? { label: "Demande refusée", tone: "danger" as const }
                : null;
            const actionLabel =
              access === "APPROVED"
                ? "Voir les détails"
                : access === "EN_ATTENTE"
                ? "Demande en attente"
                : access === "REJETEE"
                ? "Voir le motif"
                : "Demander l'accès";
            const actionIcon =
              access === "APPROVED" ? "eye" : access === "EN_ATTENTE" ? "clock" : access === "REJETEE" ? "info-circle" : "paper-plane";
            return (
              <TouchableOpacity
                key={cls.id}
                style={styles.card}
                onPress={() => handleRowPress({ cls, access, motifRejet })}
                activeOpacity={0.7}
              >
                <View style={styles.cardTop}>
                  <View style={styles.classIconWrap}>
                    <FontAwesome5 name="graduation-cap" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{cls.nom ?? "Classe"}</Text>
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
                    <Text style={styles.cardMeta} numberOfLines={1}>{cls.etablissement.nom}</Text>
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
        onSubmitted={load}
        utilisateurId={user?.userId}
      />

      <StudentClassDetailModal
        visible={!!selectedClass}
        classe={selectedClass}
        onClose={() => setSelectedClass(null)}
        onOpenLiveSession={(coursId) => navigation.navigate("LiveSession", { coursId, isHost: false })}
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
  title: { ...typography.h1, color: colors.text },
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
  card: {
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
  cardTitle: { ...typography.bodyBold, fontSize: 15, color: colors.text },
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
  cardMeta: { ...typography.caption, color: colors.textMuted },
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

export default StudentClassesBody;

