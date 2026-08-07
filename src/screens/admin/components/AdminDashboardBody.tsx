import React, { useEffect, useState, useCallback } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Card, LoadingSpinner } from "../../../components/ui";
import { colors, spacing, typography } from "../../../styles/theme";
import {
  classAdminService,
  establishmentService,
  matiereService,
  userService,
} from "../../../services/api";

interface Stat {
  label: string;
  value: number;
  icon: React.ComponentProps<typeof FontAwesome5>["name"];
  color: string;
}

const AdminDashboardBody = () => {
  const [stats, setStats] = useState<Stat[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [users, classes, establishments, matieres, pending] = await Promise.all([
        userService.getAllUsers().catch(() => []),
        classAdminService.getAll().catch(() => []),
        establishmentService.getAll().catch(() => []),
        matiereService.getAll().catch(() => []),
        userService.getPendingProfessors().catch(() => ({ content: [] as unknown[] })),
      ]);

      const pendingCount = Array.isArray(pending)
        ? pending.length
        : Array.isArray((pending as any)?.content)
        ? (pending as any).content.length
        : 0;

      const activeClasses = classes.filter((c) => (c as any).etat === "ACTIVE" || (c as any).etat === "APPROVED").length;

      setStats([
        { label: "Utilisateurs", value: users.length, icon: "users", color: colors.danger },
        { label: "Classes", value: classes.length, icon: "chalkboard", color: colors.info },
        { label: "Classes actives", value: activeClasses, icon: "check-circle", color: colors.success },
        { label: "Établissements", value: establishments.length, icon: "school", color: colors.primary },
        { label: "Matières", value: matieres.length, icon: "book", color: colors.warning },
        { label: "Professeurs en attente", value: pendingCount, icon: "user-clock", color: colors.danger },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du chargement du tableau de bord.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ScrollView style={styles.content}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Tableau de bord Admin</Text>
        <Text style={styles.pageSubtitle}>Gérez votre plateforme éducative</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!stats && !error ? <LoadingSpinner label="Chargement des statistiques..." /> : null}

      {stats && (
        <View style={styles.grid}>
          {stats.map((stat) => (
            <Card key={stat.label} style={[styles.statCard, { borderLeftColor: stat.color }] as any}>
              <View style={styles.statTopRow}>
                <FontAwesome5 name={stat.icon} size={20} color={stat.color} />
                <Text style={styles.statNumber}>{stat.value}</Text>
              </View>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </Card>
          ))}
        </View>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: 16 },
  pageHeader: { marginTop: 20, marginBottom: 24 },
  pageTitle: { ...typography.h1, color: colors.text, marginBottom: 4 },
  pageSubtitle: { ...typography.body, color: colors.textMuted },
  error: { color: colors.danger, marginBottom: spacing.md },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  statCard: {
    width: "48%",
    marginBottom: spacing.md,
    borderLeftWidth: 4,
  },
  statTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  statNumber: { ...typography.h1, color: colors.text },
  statLabel: { ...typography.caption, color: colors.textMuted },
});

export default AdminDashboardBody;
