import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Card, LoadingSpinner } from "../../components/ui";
import { colors, spacing, typography } from "../../styles/theme";
import { accederService, exerciseService } from "../../services/api";
import { useUser } from "../../context/UserContext";

const StudentOverviewBody = () => {
  const { user } = useUser();
  const [classCount, setClassCount] = useState<number | null>(null);
  const [exerciseCount, setExerciseCount] = useState<number | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user?.userId) return;
    setError("");
    try {
      const [classes, exercises] = await Promise.all([
        accederService.getAccessibleClasses(user.userId).catch(() => []),
        exerciseService.getAccessible(user.userId).catch(() => []),
      ]);
      setClassCount(classes.length);
      setExerciseCount(exercises.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du chargement.");
    }
  }, [user?.userId]);

  useEffect(() => {
    load();
  }, [load]);

  const name = user?.username || `${user?.prenom ?? ""}`.trim() || "Élève";

  return (
    <ScrollView style={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Bonjour, {name}</Text>
        <Text style={styles.subtitle}>Voici votre espace scolaire</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {classCount === null && !error ? <LoadingSpinner label="Chargement..." /> : null}

      {classCount !== null && (
        <View style={styles.grid}>
          <Card style={[styles.statCard, { borderLeftColor: colors.primary }] as any}>
            <FontAwesome5 name="chalkboard" size={20} color={colors.primary} />
            <Text style={styles.statNumber}>{classCount}</Text>
            <Text style={styles.statLabel}>Classe(s)</Text>
          </Card>
          <Card style={[styles.statCard, { borderLeftColor: colors.warning }] as any}>
            <FontAwesome5 name="clipboard-list" size={20} color={colors.warning} />
            <Text style={styles.statNumber}>{exerciseCount}</Text>
            <Text style={styles.statLabel}>Devoir(s)</Text>
          </Card>
        </View>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: 16 },
  header: { marginTop: 20, marginBottom: 24 },
  title: { ...typography.h1, color: colors.text, marginBottom: 4 },
  subtitle: { ...typography.body, color: colors.textMuted },
  error: { color: colors.danger, marginBottom: spacing.md },
  grid: { flexDirection: "row", gap: spacing.md },
  statCard: { flex: 1, borderLeftWidth: 4 },
  statNumber: { ...typography.h1, color: colors.text, marginTop: spacing.sm },
  statLabel: { ...typography.caption, color: colors.textMuted },
});

export default StudentOverviewBody;
