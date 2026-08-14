import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Badge, EmptyState, LoadingSpinner } from "../../components/ui";
import { colors, spacing, typography } from "../../styles/theme";
import { exerciseService, participationService } from "../../services/api";
import { parentService } from "../../services/api";
import { Exercise, Participation, StudentProfile } from "../../types";
import { useUser } from "../../context/UserContext";

const NIVEAU_LABELS: Record<string, string> = {
  MATERNELLE: "Maternelle",
  PRIMAIRE: "Primaire",
  COLLEGE: "Collège",
  LYCEE: "Lycée",
  UNIVERSITE: "Université",
  AUTRE: "Autre",
};

/** Read-only view of a child's exercises/devoirs and grades — mirrors web's "Exercices"/"Mes Devoirs" parent sidebar tabs. */
const ParentExercisesBody = () => {
  const { user } = useUser();
  const [children, setChildren] = useState<StudentProfile[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadChildren = useCallback(async () => {
    if (!user?.userId) return;
    try {
      const data = await parentService.getChildren(user.userId);
      setChildren(data);
      if (data.length > 0) setSelectedChildId(data[0].id);
      else setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du chargement.");
      setLoading(false);
    }
  }, [user?.userId]);

  useEffect(() => {
    loadChildren();
  }, [loadChildren]);

  useEffect(() => {
    const load = async () => {
      if (!selectedChildId) return;
      setLoading(true);
      setError("");
      try {
        const [exData, partData] = await Promise.all([
          exerciseService.getAccessible(selectedChildId),
          participationService.getByUser(selectedChildId).catch(() => []),
        ]);
        setExercises(exData);
        setParticipations(partData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Échec du chargement des exercices.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedChildId]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Exercices & Devoirs</Text>
      </View>

      {children.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.childRow}>
          {children.map((child) => (
            <TouchableOpacity
              key={child.id}
              style={[styles.childChip, selectedChildId === child.id && styles.childChipActive]}
              onPress={() => setSelectedChildId(child.id)}
            >
              <Text style={[styles.childChipText, selectedChildId === child.id && styles.childChipTextActive]}>
                {child.prenom} {child.nom}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView style={styles.list}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {children.length === 0 ? (
          <EmptyState icon="child" title="Aucun enfant" message="Ajoutez un enfant depuis l'onglet 'Enfants'." />
        ) : loading ? (
          <LoadingSpinner label="Chargement des exercices..." />
        ) : exercises.length === 0 ? (
          <EmptyState icon="clipboard-list" title="Aucun exercice" message="Aucun exercice n'est assigné à cet enfant pour le moment." />
        ) : (
          exercises.map((ex) => {
            const participation = participations.find((p) => p.exerciseProgrammerNom === ex.nom) ?? null;
            return (
              <View key={ex.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{ex.nom}</Text>
                  {ex.etat ? <Badge label={ex.etat} tone="info" /> : null}
                </View>
                {ex.description ? (
                  <Text style={styles.cardDescription} numberOfLines={2}>
                    {ex.description}
                  </Text>
                ) : null}
                <View style={styles.cardFooter}>
                  <FontAwesome5 name="graduation-cap" size={12} color={colors.textMuted} />
                  <Text style={styles.cardMeta}>{NIVEAU_LABELS[ex.niveau ?? ""] ?? ex.niveau ?? "-"}</Text>
                </View>
                {participation && (
                  <View style={styles.gradeBox}>
                    <View style={styles.gradeRow}>
                      <Text style={styles.gradeLabel}>Statut</Text>
                      <Badge
                        label={participation.etatSoumission ?? "EN_COURS"}
                        tone={participation.etatSoumission === "CORRIGE" ? "success" : "warning"}
                      />
                    </View>
                    {participation.note ? (
                      <View style={styles.gradeRow}>
                        <Text style={styles.gradeLabel}>Note</Text>
                        <Text style={styles.gradeValue}>{participation.note}</Text>
                      </View>
                    ) : null}
                    {participation.appreciation ? (
                      <Text style={styles.appreciation}>{participation.appreciation}</Text>
                    ) : null}
                  </View>
                )}
              </View>
            );
          })
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, marginTop: 20, marginBottom: spacing.md },
  title: { ...typography.h1, color: colors.text },
  childRow: { paddingHorizontal: 16, marginBottom: spacing.md, flexGrow: 0 },
  childChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 20, backgroundColor: colors.grayLight, marginRight: spacing.sm },
  childChipActive: { backgroundColor: colors.primary },
  childChipText: { ...typography.caption, color: colors.text, fontWeight: "600" },
  childChipTextActive: { color: colors.white },
  list: { flex: 1, paddingHorizontal: 16 },
  error: { color: colors.danger, marginBottom: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginBottom: spacing.md },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs },
  cardTitle: { ...typography.bodyBold, color: colors.text, flex: 1, marginRight: spacing.sm },
  cardDescription: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  cardFooter: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  cardMeta: { ...typography.caption, color: colors.textMuted },
  gradeBox: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, gap: 4 },
  gradeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  gradeLabel: { ...typography.caption, color: colors.textMuted },
  gradeValue: { ...typography.bodyBold, color: colors.text },
  appreciation: { ...typography.caption, color: colors.text, fontStyle: "italic", marginTop: 4 },
});

export default ParentExercisesBody;
