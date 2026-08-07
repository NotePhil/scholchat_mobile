import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { EmptyState, LoadingSpinner } from "../../components/ui";
import { colors, spacing, typography } from "../../styles/theme";
import { accederService } from "../../services/api";
import { ClassEntity } from "../../types";
import { useUser } from "../../context/UserContext";

const StudentClassesBody = () => {
  const { user } = useUser();
  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user?.userId) return;
    setLoading(true);
    setError("");
    try {
      const data = await accederService.getAccessibleClasses(user.userId);
      setClasses(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du chargement des classes.");
    } finally {
      setLoading(false);
    }
  }, [user?.userId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mes classes</Text>
      </View>

      <ScrollView style={styles.list}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? (
          <LoadingSpinner label="Chargement des classes..." />
        ) : classes.length === 0 ? (
          <EmptyState icon="chalkboard" title="Aucune classe" message="Vous n'êtes inscrit à aucune classe pour le moment." />
        ) : (
          classes.map((cls) => (
            <View key={cls.id} style={styles.card}>
              <Text style={styles.cardTitle}>{cls.nom ?? "Classe"}</Text>
              {cls.niveau ? <Text style={styles.cardMeta}>Niveau: {cls.niveau}</Text> : null}
              {cls.etablissement?.nom ? <Text style={styles.cardMeta}>{cls.etablissement.nom}</Text> : null}
            </View>
          ))
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
  list: { flex: 1, paddingHorizontal: 16 },
  error: { color: colors.danger, marginBottom: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginBottom: spacing.md },
  cardTitle: { ...typography.bodyBold, color: colors.text },
  cardMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
});

export default StudentClassesBody;
