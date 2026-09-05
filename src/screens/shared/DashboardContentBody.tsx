import React, { useCallback, useEffect, useState } from "react";
import { Dimensions, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { BarChart, LineChart, PieChart } from "react-native-chart-kit";
import { Card, LoadingSpinner } from "../../components/ui";
import { colors, spacing, typography } from "../../styles/theme";
import { classAdminService, matiereService, professorService, userService } from "../../services/api";
import { ClassEntity, Matiere, Professor } from "../../types";

const CHART_WIDTH = Dimensions.get("window").width - 32;
const CHART_COLORS = ["#3B82F6", "#6366F1", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316", "#06B6D4"];

const chartConfig = {
  backgroundGradientFrom: colors.surface,
  backgroundGradientTo: colors.surface,
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(55, 65, 81, ${opacity})`,
  barPercentage: 0.6,
};

interface Stat {
  label: string;
  value: number | string;
  icon: React.ComponentProps<typeof FontAwesome5>["name"];
  color: string;
  trend?: string;
  subtitle?: string;
}

/**
 * "Tableau de Bord" — the exact same component web renders for BOTH Admin
 * and Professor (Principal.jsx's renderContent: anyone who isn't
 * parent/student/gestionnaire falls into the same `else { <DashboardContent
 * .../> }` branch), so this is one shared screen here too, not two.
 *
 * Deliberately pixel-for-pixel matches web's DashboardContent.jsx, INCLUDING
 * its hardcoded/fake pieces (totalCourses/totalExercises/averageProgress/
 * totalStudents/completionRate are always 0 there; "Établissements" is a
 * literal `0` never fetched at all; the course/progression chart values and
 * the four "trend" badges are Math.random()/static; the 5 "recent activity"
 * rows are hardcoded labels with fake relative times) — this is an explicit
 * parity requirement, not an oversight. Only Professeurs/En attente
 * validation/Matières/Classes actives are ever real, exactly as on web.
 */
const DashboardContentBody = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [matieres, setMatieres] = useState<Matiere[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  const load = useCallback(async () => {
    setError("");
    try {
      const [profs, cls, mats, pending] = await Promise.all([
        professorService.getAll().catch(() => []),
        classAdminService.getAll().catch(() => []),
        matiereService.getAll().catch(() => []),
        userService.getPendingProfessors().catch(() => [] as unknown[]),
      ]);
      setProfessors(profs);
      setClasses(cls);
      setMatieres(mats);
      setPendingCount(Array.isArray(pending) ? pending.length : ((pending as any)?.content ?? []).length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors du chargement des données.");
    } finally {
      setLoading(false);
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

  if (loading) {
    return <LoadingSpinner label="Chargement du tableau de bord..." fullScreen />;
  }

  // ── Stats — matches web's `stats` object field-for-field, fakes included ──
  const activeClasses = classes.filter((c) => (c.etat as string) === "ACTIF").length;
  const totalCourses = 0;
  const totalExercises = 0;
  const averageProgress = 0;
  const totalStudents = 0;
  const completionRate = 0;

  const primaryStats: Stat[] = [
    { label: "Cours disponibles", value: totalCourses, icon: "book-open", color: "#3B82F6", trend: "+12%", subtitle: `${matieres.length} matières` },
    { label: "Exercices", value: totalExercises, icon: "bullseye", color: "#10B981", trend: "+18%", subtitle: `${completionRate}% complété` },
    { label: "Classes actives", value: activeClasses, icon: "users", color: "#8B5CF6", trend: "+8%", subtitle: `${totalStudents} élèves` },
    { label: "Progression moyenne", value: `${averageProgress}%`, icon: "chart-bar", color: "#F59E0B", trend: "+5%", subtitle: "Toutes les classes" },
  ];

  const secondaryStats: Stat[] = [
    { label: "Professeurs", value: professors.length, icon: "user-graduate", color: "#3B82F6" },
    { label: "En attente valid.", value: pendingCount, icon: "clock", color: "#F59E0B" },
    { label: "Matières", value: matieres.length, icon: "layer-group", color: "#8B5CF6" },
    { label: "Établissements", value: 0, icon: "school", color: "#10B981" },
  ];

  // ── Chart data — matches web's Math.random()-based fakes exactly ──
  const pieData = matieres.slice(0, 10).map((m, i) => ({
    name: m.nom || `Matière ${i + 1}`,
    population: Math.floor(Math.random() * 40) + 10,
    color: CHART_COLORS[i % CHART_COLORS.length],
    legendFontColor: colors.textMuted,
    legendFontSize: 11,
  }));

  const barLabels = classes.slice(0, 8).map((c) => (c.nom ? (c.nom.length > 10 ? `${c.nom.slice(0, 10)}…` : c.nom) : "Classe"));
  const barValues = classes.slice(0, 8).map(() => Math.floor(Math.random() * 35) + 60);

  const areaLabels = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun"];
  const areaCours = [4, 7, 5, 9, 12, totalCourses || 10];
  const areaExercices = [8, 14, 11, 18, 22, totalExercises || 20];

  const statusData = [
    { name: "Terminés", population: completionRate || 0, color: "#10B981", legendFontColor: colors.textMuted, legendFontSize: 11 },
    { name: "En cours", population: 15, color: "#6366F1", legendFontColor: colors.textMuted, legendFontSize: 11 },
    { name: "Non démarrés", population: 6, color: "#F43F5E", legendFontColor: colors.textMuted, legendFontSize: 11 },
  ];

  const recentItems = [
    { icon: "book-open" as const, color: "#2563EB", label: "Nouveau cours publié", sub: professors[0] ? `${professors[0].prenom} ${professors[0].nom}` : "Professeur", time: "Il y a 2h" },
    { icon: "check-circle" as const, color: "#059669", label: "Exercices complétés", sub: classes[0]?.nom || "Classe 3ème A", time: "Il y a 3h" },
    { icon: "users" as const, color: "#7C3AED", label: "Nouvelle classe créée", sub: "Admin", time: "Il y a 5h" },
    { icon: "trophy" as const, color: "#D97706", label: "Jalon de progression atteint", sub: "Système", time: "Hier" },
    { icon: "file-alt" as const, color: "#4F46E5", label: "Matière mise à jour", sub: professors[1] ? `${professors[1].prenom} ${professors[1].nom}` : "Professeur", time: "Il y a 2j" },
  ];

  return (
    <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
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
            <View style={styles.trendRow}>
              <View style={styles.trendPill}>
                <FontAwesome5 name="arrow-up" size={9} color="#059669" />
                <Text style={styles.trendText}>{stat.trend}</Text>
              </View>
              <Text style={styles.trendCaption}>ce mois</Text>
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

      <Card style={styles.chartCard}>
        <Text style={styles.chartTitle}>Distribution des Cours</Text>
        {pieData.length === 0 ? (
          <Text style={styles.emptyText}>Aucune matière disponible</Text>
        ) : (
          <PieChart
            data={pieData}
            width={CHART_WIDTH}
            height={180}
            chartConfig={chartConfig}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="8"
            absolute
          />
        )}
      </Card>

      <Card style={styles.chartCard}>
        <Text style={styles.chartTitle}>Progression des Élèves</Text>
        {barValues.length === 0 ? (
          <Text style={styles.emptyText}>Aucune classe disponible</Text>
        ) : (
          <BarChart
            data={{ labels: barLabels, datasets: [{ data: barValues }] }}
            width={CHART_WIDTH}
            height={200}
            chartConfig={chartConfig}
            fromZero
            yAxisLabel=""
            yAxisSuffix="%"
            style={{ borderRadius: 12 }}
          />
        )}
      </Card>

      <Card style={styles.chartCard}>
        <Text style={styles.chartTitle}>Tendances Mensuelles</Text>
        <LineChart
          data={{
            labels: areaLabels,
            datasets: [
              { data: areaCours, color: () => "#3B82F6" },
              { data: areaExercices, color: () => "#10B981" },
            ],
            legend: ["Cours", "Exercices"],
          }}
          width={CHART_WIDTH}
          height={200}
          chartConfig={chartConfig}
          bezier
          style={{ borderRadius: 12 }}
        />
      </Card>

      <View style={styles.bottomRow}>
        <Card style={styles.chartCard}>
          <Text style={styles.chartTitle}>Statut des Exercices</Text>
          <PieChart
            data={statusData}
            width={CHART_WIDTH}
            height={160}
            chartConfig={chartConfig}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="8"
            absolute
          />
        </Card>

        <Card style={styles.chartCard}>
          <Text style={styles.chartTitle}>Activités Récentes</Text>
          {recentItems.map((item, i) => (
            <View key={i} style={styles.activityRow}>
              <View style={[styles.activityIcon, { backgroundColor: item.color }]}>
                <FontAwesome5 name={item.icon} size={12} color={colors.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.activityTitle} numberOfLines={1}>
                  {item.label}
                </Text>
                <Text style={styles.activitySub}>{item.sub}</Text>
              </View>
              <Text style={styles.activityTime}>{item.time}</Text>
            </View>
          ))}
        </Card>
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: 16 },
  pageHeader: { flexDirection: "row", alignItems: "flex-start", marginTop: 20, marginBottom: 24 },
  pageTitle: { ...typography.h1, color: colors.text, marginBottom: 4 },
  pageSubtitle: { ...typography.body, color: colors.textMuted, textTransform: "capitalize" },
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
  trendRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.sm },
  trendPill: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: colors.successLight, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  trendText: { fontSize: 10, fontWeight: "700", color: "#059669" },
  trendCaption: { ...typography.caption, color: colors.textMuted, fontSize: 10 },
  primarySubtitle: { ...typography.caption, color: colors.textMuted, marginTop: 4, fontSize: 11 },
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
  bottomRow: { gap: spacing.md },
  chartTitle: { ...typography.bodyBold, color: colors.text, marginBottom: spacing.sm },
  emptyText: { ...typography.caption, color: colors.textMuted },
  activityRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  activityIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", marginRight: spacing.sm },
  activityTitle: { ...typography.bodyBold, color: colors.text },
  activitySub: { ...typography.caption, color: colors.textMuted },
  activityTime: { ...typography.caption, color: colors.textMuted, marginLeft: spacing.sm },
});

export default DashboardContentBody;
