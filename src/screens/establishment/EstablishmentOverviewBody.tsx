import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Card, LoadingSpinner } from "../../components/ui";
import { colors, spacing, typography } from "../../styles/theme";
import { establishmentService } from "../../services/api";
import { useUser } from "../../context/UserContext";

const EstablishmentOverviewBody = () => {
  const { user } = useUser();
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user?.userId) return;
    setError("");
    try {
      const data = await establishmentService.getByGestionnaire(user.userId);
      setCount(data.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du chargement.");
    }
  }, [user?.userId]);

  useEffect(() => {
    load();
  }, [load]);

  const name = user?.username || `${user?.prenom ?? ""}`.trim() || "Gestionnaire";

  return (
    <ScrollView style={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Bonjour, {name}</Text>
        <Text style={styles.subtitle}>Gérez vos établissements</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {count === null && !error ? <LoadingSpinner label="Chargement..." /> : null}

      {count !== null && (
        <Card style={[styles.statCard, { borderLeftColor: colors.primary }] as any}>
          <FontAwesome5 name="school" size={20} color={colors.primary} />
          <Text style={styles.statNumber}>{count}</Text>
          <Text style={styles.statLabel}>Établissement(s) géré(s)</Text>
        </Card>
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
  statCard: { borderLeftWidth: 4 },
  statNumber: { ...typography.h1, color: colors.text, marginTop: spacing.sm },
  statLabel: { ...typography.caption, color: colors.textMuted },
});

export default EstablishmentOverviewBody;
