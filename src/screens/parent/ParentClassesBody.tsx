import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Badge, EmptyState, LoadingSpinner } from "../../components/ui";
import JoinClassSheet from "../shared/JoinClassSheet";
import StudentClassDetailModal, { getLevelStyle } from "../shared/StudentClassDetailModal";
import ChildSelectorRow from "./ChildSelectorRow";
import { colors, radius, spacing, typography, useThemeColors } from "../../styles/theme";
import { parentService } from "../../services/api";
import { ClassEntity } from "../../types";
import { useUser } from "../../context/UserContext";
import { useSelectedChildStore } from "../../store/useSelectedChildStore";

const ParentClassesBody = () => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useUser();
  const navigation = useNavigation<any>();
  const { children, selectedChildId, loadChildren } = useSelectedChildStore();
  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [showJoin, setShowJoin] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassEntity | null>(null);

  useEffect(() => {
    if (user?.userId) loadChildren(user.userId);
  }, [user?.userId, loadChildren]);

  const loadClasses = useCallback(async () => {
    if (!selectedChildId) {
      setClasses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setClasses(await parentService.getChildClasses(selectedChildId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du chargement des classes.");
    } finally {
      setLoading(false);
    }
  }, [selectedChildId]);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadClasses();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Classes</Text>
        {selectedChildId ? (
          <TouchableOpacity style={styles.addButton} onPress={() => setShowJoin(true)} activeOpacity={0.7}>
            <FontAwesome5 name="plus" size={14} color={colors.white} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ChildSelectorRow />

      <ScrollView
        style={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />}
      >
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {children.length === 0 ? (
          <EmptyState icon="child" title="Aucun enfant" message="Ajoutez un enfant depuis l'onglet 'Mes enfants'." />
        ) : loading && !refreshing ? (
          <LoadingSpinner label="Chargement des classes..." />
        ) : classes.length === 0 ? (
          <EmptyState
            icon="chalkboard"
            title="Aucune classe"
            message="Cet enfant n'est inscrit à aucune classe."
            actionLabel="Rejoindre une classe"
            onAction={() => setShowJoin(true)}
          />
        ) : (
          classes.map((cls) => {
            const levelStyle = getLevelStyle(cls.niveau);
            return (
              <TouchableOpacity
                key={cls.id}
                style={styles.classCard}
                onPress={() => setSelectedClass(cls)}
                activeOpacity={0.7}
              >
                <View style={styles.cardTop}>
                  <View style={styles.classIconWrap}>
                    <FontAwesome5 name="graduation-cap" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.className}>{cls.nom ?? "Classe"}</Text>
                    {cls.niveau && (
                      <View style={[styles.levelBadge, { backgroundColor: levelStyle.bg }]}>
                        <Text style={[styles.levelBadgeText, { color: levelStyle.text }]}>{cls.niveau}</Text>
                      </View>
                    )}
                  </View>
                  <Badge label="Inscrit" tone="success" />
                </View>

                {cls.etablissement?.nom ? (
                  <View style={styles.metaRow}>
                    <FontAwesome5 name="school" size={12} color={colors.textMuted} />
                    <Text style={styles.classMeta} numberOfLines={1}>{cls.etablissement.nom}</Text>
                  </View>
                ) : null}

                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => setSelectedClass(cls)}>
                    <FontAwesome5 name="eye" size={12} color={colors.primary} />
                    <Text style={styles.actionBtnText}>Voir les détails</Text>
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
