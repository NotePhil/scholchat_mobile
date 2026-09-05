import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Badge, EmptyState, LoadingSpinner } from "../../components/ui";
import { colors, spacing, typography } from "../../styles/theme";
import { ClassEntity } from "../../types";
import { DEVOIR_STATUS_LABEL, DevoirItem, loadDevoirs } from "../../utils/devoirs";
import DevoirAttemptSheet from "./DevoirAttemptSheet";

type FilterId = "all" | "todo" | "soumis" | "corriges";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "todo", label: "À rendre" },
  { id: "soumis", label: "Soumis" },
  { id: "corriges", label: "Corrigés" },
];

const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—");

interface DevoirsBodyProps {
  /** The effective user whose homework this is — the student's own id, or (from Parent) the selected child's id. */
  userId: string | null;
  classes: ClassEntity[];
  classesLoading: boolean;
  emptyMessage?: string;
}

/**
 * Homework tracker shared verbatim between Student's own "Devoirs" screen
 * and Parent's (viewing/attempting on behalf of the selected child) —
 * mirrors web's StudentDevoirsContent.jsx, which is itself one component
 * used by both roles. Replaces the two independent, wrong-endpoint mobile
 * screens that showed a flat "all accessible exercises" list with no status,
 * due date, or grade.
 */
const DevoirsBody = ({ userId, classes, classesLoading, emptyMessage }: DevoirsBodyProps) => {
  const [devoirs, setDevoirs] = useState<DevoirItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterId>("all");
  const [active, setActive] = useState<DevoirItem | null>(null);

  const load = useCallback(async () => {
    if (!userId || classesLoading) return;
    setLoading(true);
    try {
      setDevoirs(await loadDevoirs(userId, classes));
    } catch {
      setDevoirs([]);
    } finally {
      setLoading(false);
    }
  }, [userId, classes, classesLoading]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(
    () => ({
      all: devoirs.length,
      todo: devoirs.filter((d) => !d.isSubmitted).length,
      soumis: devoirs.filter((d) => d.isSubmitted && !d.isGraded).length,
      corriges: devoirs.filter((d) => d.isGraded).length,
    }),
    [devoirs]
  );

  const filtered = devoirs.filter((d) => {
    if (filter === "todo") return !d.isSubmitted;
    if (filter === "soumis") return d.isSubmitted && !d.isGraded;
    if (filter === "corriges") return d.isGraded;
    return true;
  });

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity key={f.id} style={[styles.filterChip, filter === f.id && styles.filterChipActive]} onPress={() => setFilter(f.id)}>
            <Text style={[styles.filterText, filter === f.id && styles.filterTextActive]}>
              {f.label} ({counts[f.id]})
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.list}>
        {!userId ? (
          <EmptyState icon="child" title="Aucun enfant sélectionné" message={emptyMessage ?? "Sélectionnez un enfant pour voir ses devoirs."} />
        ) : loading || classesLoading ? (
          <LoadingSpinner label="Chargement des devoirs..." />
        ) : filtered.length === 0 ? (
          <EmptyState icon="file-alt" title="Aucun devoir" message={filter === "all" ? "Aucun devoir assigné pour le moment." : "Aucun devoir dans cette catégorie."} />
        ) : (
          filtered.map((d) => {
            const ep = d.programme;
            return (
              <TouchableOpacity key={ep.id} style={styles.card} onPress={() => setActive(d)} activeOpacity={0.7}>
                <View style={styles.cardTop}>
                  <View style={styles.cardBadges}>
                    <Badge label="Devoir" tone="info" />
                    {d.overdue ? <Badge label="En retard" tone="danger" /> : null}
                  </View>
                  {d.etat ? (
                    <Badge label={DEVOIR_STATUS_LABEL[d.etat] ?? d.etat} tone={d.isGraded ? "success" : d.isPending ? "warning" : "info"} />
                  ) : (
                    <Text style={styles.dueText}>
                      <FontAwesome5 name="calendar" size={10} /> {fmtDate(ep.dateFinExoEffectif)}
                    </Text>
                  )}
                </View>
                <Text style={styles.cardTitle}>{ep.nom ?? "Devoir"}</Text>
                {ep.description ? (
                  <Text style={styles.cardDescription} numberOfLines={2}>
                    {ep.description}
                  </Text>
                ) : null}
                <View style={styles.dateRow}>
                  <Text style={styles.dateText}>Prévu : {fmtDate(ep.dateExoPrevue)}</Text>
                  <Text style={styles.dateText}>À rendre avant : {fmtDate(ep.dateFinExoEffectif)}</Text>
                </View>
                {d.isGraded && d.participation?.note ? (
                  <View style={styles.gradeBox}>
                    <FontAwesome5 name="trophy" size={12} color={colors.warning} />
                    <Text style={styles.gradeText}>{d.participation.note}</Text>
                    {d.participation.appreciation ? <Text style={styles.appreciation}>"{d.participation.appreciation}"</Text> : null}
                  </View>
                ) : null}
                {d.isPending ? <Text style={styles.pendingText}>En attente de correction du professeur</Text> : null}
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {active && userId ? (
        <DevoirAttemptSheet
          visible
          exerciseProgrammerId={active.programme.id}
          title={active.programme.nom ?? "Devoir"}
          userId={userId}
          onClose={() => setActive(null)}
          onComplete={() => {
            setActive(null);
            load();
          }}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  filterRow: { paddingHorizontal: 16, marginBottom: spacing.md, flexGrow: 0 },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 20, backgroundColor: colors.grayLight, marginRight: spacing.sm },
  filterChipActive: { backgroundColor: colors.primary },
  filterText: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
  filterTextActive: { color: colors.white },
  list: { flex: 1, paddingHorizontal: 16 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginBottom: spacing.md },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs },
  cardBadges: { flexDirection: "row", gap: spacing.xs },
  dueText: { ...typography.caption, color: colors.textMuted },
  cardTitle: { ...typography.bodyBold, color: colors.text, marginBottom: 2 },
  cardDescription: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  dateRow: { gap: 2, marginBottom: spacing.xs },
  dateText: { ...typography.caption, color: colors.textMuted },
  gradeBox: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs, backgroundColor: colors.warningLight, borderRadius: 8, padding: spacing.sm },
  gradeText: { ...typography.bodyBold, color: colors.text },
  appreciation: { ...typography.caption, color: colors.textMuted, fontStyle: "italic", flex: 1 },
  pendingText: { ...typography.caption, color: colors.warning, marginTop: spacing.xs },
});

export default DevoirsBody;
