import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Dimensions } from "react-native";
import { PieChart, BarChart } from "react-native-chart-kit";
import { Card, LoadingSpinner } from "../../../components/ui";
import { colors, spacing, typography } from "../../../styles/theme";
import {
  activityFeedService,
  classAdminService,
  establishmentService,
  gestionnaireService,
  matiereService,
  parentService,
  professorService,
  studentService,
  userService,
} from "../../../services/api";
import { ActivityEvent } from "../../../types";

interface Stat {
  label: string;
  value: number;
  icon: React.ComponentProps<typeof FontAwesome5>["name"];
  color: string;
  subtitle?: string;
}

const CHART_WIDTH = Dimensions.get("window").width - 32;

const ROLE_COLORS: Record<string, string> = {
  Professeurs: "#3B82F6",
  Élèves: "#10B981",
  Parents: "#F59E0B",
  Gestionnaires: "#8B5CF6",
  Admins: "#EF4444",
};

const CLASS_STATUS_COLORS: Record<string, string> = {
  Actif: "#10B981",
  Inactif: "#EF4444",
  "En attente": "#F59E0B",
  Autre: "#6B7280",
};

const chartConfig = {
  backgroundGradientFrom: colors.surface,
  backgroundGradientTo: colors.surface,
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(55, 65, 81, ${opacity})`,
  barPercentage: 0.6,
};

/**
 * Admin's "Tableau de Bord". Every number and chart here is computed from
 * real API responses — web's own DashboardContent.jsx uses Math.random() for
 * its course/progression charts and static arrays for trends/"recent
 * activity", which this deliberately does NOT copy: anything not genuinely
 * derivable from real data is simply left out rather than faked.
 */
const PRIMARY_GRADIENTS = ['#4F46E5', '#7C3AED', '#0EA5E9', '#059669'];

const AdminDashboardBody = () => {
  const [primaryStats, setPrimaryStats] = useState<Stat[] | null>(null);
  const [secondaryStats, setSecondaryStats] = useState<Stat[]>([]);
  const [roleDistribution, setRoleDistribution] = useState<{ name: string; population: number; color: string }[]>([]);
  const [classStatusData, setClassStatusData] = useState<{ name: string; population: number; color: string }[]>([]);
  const [signupsByMonth, setSignupsByMonth] = useState<{ label: string; count: number }[]>([]);
  const [recentActivities, setRecentActivities] = useState<ActivityEvent[]>([]);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const [professors, students, parents, gestionnaires, admins, classes, establishments, matieres, pending, activities] =
        await Promise.all([
          professorService.getAll().catch(() => []),
          studentService.getAll().catch(() => []),
          parentService.getAllSummary().catch(() => []),
          gestionnaireService.getAll().catch(() => []),
          userService.getAdmins().catch(() => []),
          classAdminService.getAll().catch(() => []),
          establishmentService.getAll().catch(() => []),
          matiereService.getAll().catch(() => []),
          userService.getPendingProfessors().catch(() => ({ content: [] as unknown[] })),
          activityFeedService.getAll().catch(() => []),
        ]);

      const pendingCount = Array.isArray(pending)
        ? pending.length
        : Array.isArray((pending as any)?.content)
        ? (pending as any).content.length
        : 0;

      const activeClasses = classes.filter((c) => (c.etat as string) === "ACTIF" || (c.etat as string) === "ACTIVE").length;
      const totalUsers = professors.length + students.length + parents.length + gestionnaires.length + admins.length;

      // Two-tier layout matching web's DashboardContent.jsx: 4 large primary
      // KPI cards, then a row of compact secondary tiles — every number real.
      setPrimaryStats([
        { label: "Utilisateurs", value: totalUsers, icon: "users", color: PRIMARY_GRADIENTS[0], subtitle: `${professors.length} professeurs` },
        { label: "Classes", value: classes.length, icon: "chalkboard", color: PRIMARY_GRADIENTS[1], subtitle: `${activeClasses} actives` },
        { label: "Établissements", value: establishments.length, icon: "school", color: PRIMARY_GRADIENTS[2], subtitle: "Sur la plateforme" },
        { label: "Matières", value: matieres.length, icon: "book", color: PRIMARY_GRADIENTS[3], subtitle: "Au catalogue" },
      ]);
      setSecondaryStats([
        { label: "Professeurs", value: professors.length, icon: "chalkboard-teacher", color: colors.primary },
        { label: "En attente valid.", value: pendingCount, icon: "user-clock", color: colors.warning },
        { label: "Élèves", value: students.length, icon: "user-graduate", color: colors.success },
        { label: "Parents", value: parents.length, icon: "user-friends", color: colors.info },
      ]);

      // ── Répartition des utilisateurs (real counts, no randomization) ──
      setRoleDistribution(
        [
          { name: "Professeurs", population: professors.length },
          { name: "Élèves", population: students.length },
          { name: "Parents", population: parents.length },
          { name: "Gestionnaires", population: gestionnaires.length },
          { name: "Admins", population: admins.length },
        ]
          .filter((r) => r.population > 0)
          .map((r) => ({ ...r, color: ROLE_COLORS[r.name] }))
      );

      // ── Classes par statut (real, from the same list already fetched) ──
      const statusCounts: Record<string, number> = {};
      classes.forEach((c) => {
        const raw = (c.etat as string) ?? "";
        const label = raw === "ACTIF" || raw === "ACTIVE" ? "Actif" : raw === "INACTIF" || raw === "INACTIVE" ? "Inactif" : raw.includes("ATTENTE") || raw === "PENDING" ? "En attente" : "Autre";
        statusCounts[label] = (statusCounts[label] ?? 0) + 1;
      });
      setClassStatusData(
        Object.entries(statusCounts).map(([name, population]) => ({
          name,
          population,
          color: CLASS_STATUS_COLORS[name] ?? CLASS_STATUS_COLORS.Autre,
        }))
      );

      // ── Inscriptions par mois (real dateCreation across all user types, last 6 months) ──
      const allWithDates = [...professors, ...students, ...parents].filter((u: any) => u.dateCreation);
      const months: { label: string; key: string }[] = Array.from({ length: 6 }, (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - (5 - i));
        return { label: d.toLocaleDateString("fr-FR", { month: "short" }), key: `${d.getFullYear()}-${d.getMonth()}` };
      });
      const counts = months.map(({ label, key }) => ({
        label,
        count: allWithDates.filter((u: any) => {
          const d = new Date(u.dateCreation);
          return `${d.getFullYear()}-${d.getMonth()}` === key;
        }).length,
      }));
      setSignupsByMonth(counts);

      // ── Real recent activity (same source as the Activités tab) ──
      const sorted = [...activities].sort((a, b) => {
        const da = a.heureDebut ? new Date(a.heureDebut).getTime() : 0;
        const db = b.heureDebut ? new Date(b.heureDebut).getTime() : 0;
        return db - da;
      });
      setRecentActivities(sorted.slice(0, 5));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du chargement du tableau de bord.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const timeAgo = (dateString?: string) => {
    if (!dateString) return "";
    const minutes = Math.floor((Date.now() - new Date(dateString).getTime()) / 60000);
    if (minutes < 1) return "À l'instant";
    if (minutes < 60) return `Il y a ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Il y a ${hours}h`;
    return `Il y a ${Math.floor(hours / 24)} j`;
  };

  return (
    <ScrollView
      style={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      <View style={styles.pageHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.pageTitle}>Tableau de Bord</Text>
          <Text style={styles.pageSubtitle}>
            {new Date().toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </Text>
        </View>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
          <FontAwesome5 name="sync-alt" size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!primaryStats && !error ? <LoadingSpinner label="Chargement des statistiques..." /> : null}

      {primaryStats && (
        <>
          <View style={styles.primaryGrid}>
            {primaryStats.map((stat) => (
              <View key={stat.label} style={styles.primaryCard}>
                <View style={styles.primaryTopRow}>
                  <View>
                    <Text style={styles.primaryLabel}>{stat.label}</Text>
                    <Text style={styles.primaryNumber}>{stat.value}</Text>
                  </View>
                  <View style={[styles.primaryIconBox, { backgroundColor: stat.color }]}>
                    <FontAwesome5 name={stat.icon} size={16} color={colors.white} />
                  </View>
                </View>
                {stat.subtitle ? <Text style={styles.primarySubtitle}>{stat.subtitle}</Text> : null}
              </View>
            ))}
          </View>

          <View style={styles.secondaryGrid}>
            {secondaryStats.map((stat) => (
              <View key={stat.label} style={styles.secondaryCard}>
                <View style={[styles.secondaryIconBox, { backgroundColor: `${stat.color}20` }]}>
                  <FontAwesome5 name={stat.icon} size={14} color={stat.color} />
                </View>
                <View style={{ minWidth: 0, flex: 1 }}>
                  <Text style={styles.secondaryLabel} numberOfLines={1}>
                    {stat.label}
                  </Text>
                  <Text style={styles.secondaryNumber}>{stat.value}</Text>
                </View>
              </View>
            ))}
          </View>

          {roleDistribution.length > 0 && (
            <Card style={styles.chartCard}>
              <Text style={styles.chartTitle}>Répartition des utilisateurs</Text>
              <PieChart
                data={roleDistribution}
                width={CHART_WIDTH}
                height={180}
                chartConfig={chartConfig}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="8"
                absolute
              />
            </Card>
          )}

          {classStatusData.length > 0 && (
            <Card style={styles.chartCard}>
              <Text style={styles.chartTitle}>Classes par statut</Text>
              <PieChart
                data={classStatusData}
                width={CHART_WIDTH}
                height={180}
                chartConfig={chartConfig}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="8"
                absolute
              />
            </Card>
          )}

          {signupsByMonth.some((m) => m.count > 0) && (
            <Card style={styles.chartCard}>
              <Text style={styles.chartTitle}>Nouvelles inscriptions (6 derniers mois)</Text>
              <BarChart
                data={{
                  labels: signupsByMonth.map((m) => m.label),
                  datasets: [{ data: signupsByMonth.map((m) => m.count) }],
                }}
                width={CHART_WIDTH}
                height={200}
                chartConfig={chartConfig}
                fromZero
                yAxisLabel=""
                yAxisSuffix=""
                style={{ borderRadius: 12 }}
              />
            </Card>
          )}

          <Card style={styles.chartCard}>
            <Text style={styles.chartTitle}>Activités récentes</Text>
            {recentActivities.length === 0 ? (
              <Text style={styles.emptyText}>Aucune activité récente.</Text>
            ) : (
              recentActivities.map((activity) => (
                <View key={activity.id} style={styles.activityRow}>
                  <View style={styles.activityIcon}>
                    <FontAwesome5 name="calendar-alt" size={12} color={colors.white} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activityTitle} numberOfLines={1}>
                      {activity.titre}
                    </Text>
                    <Text style={styles.activitySub}>
                      {`${activity.createurPrenom ?? ""} ${activity.createurNom ?? ""}`.trim() || "Utilisateur"}
                    </Text>
                  </View>
                  <Text style={styles.activityTime}>{timeAgo(activity.heureDebut)}</Text>
                </View>
              ))
            )}
          </Card>
        </>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: 16 },
  pageHeader: { flexDirection: "row", alignItems: "flex-start", marginTop: 20, marginBottom: 24 },
  pageTitle: { ...typography.h1, color: colors.text, marginBottom: 4 },
  pageSubtitle: { ...typography.body, color: colors.textMuted },
  refreshButton: { padding: 8, backgroundColor: colors.grayLight, borderRadius: 20 },
  error: { color: colors.danger, marginBottom: spacing.md },
  primaryGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  primaryCard: {
    width: "48%",
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  primaryTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  primaryLabel: { ...typography.caption, color: colors.textMuted, fontWeight: "700", textTransform: "uppercase", fontSize: 10, marginBottom: 4 },
  primaryNumber: { ...typography.h1, color: colors.text, fontSize: 26 },
  primaryIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  primarySubtitle: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm, fontSize: 11 },
  secondaryGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: spacing.md },
  secondaryCard: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  secondaryIconBox: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  secondaryLabel: { ...typography.caption, color: colors.textMuted, fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  secondaryNumber: { ...typography.bodyBold, color: colors.text, fontSize: 17 },
  chartCard: { marginBottom: spacing.md, padding: spacing.md },
  chartTitle: { ...typography.bodyBold, color: colors.text, marginBottom: spacing.sm },
  emptyText: { ...typography.caption, color: colors.textMuted },
  activityRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  activityIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginRight: spacing.sm },
  activityTitle: { ...typography.bodyBold, color: colors.text },
  activitySub: { ...typography.caption, color: colors.textMuted },
  activityTime: { ...typography.caption, color: colors.textMuted, marginLeft: spacing.sm },
});

export default AdminDashboardBody;
