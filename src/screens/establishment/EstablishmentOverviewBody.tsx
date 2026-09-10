import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Dimensions, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { BarChart, PieChart } from "react-native-chart-kit";
import { Card, HeroCard, LoadingSpinner, QuickActionGrid } from "../../components/ui";
import { colors, spacing, typography, useThemeColors } from "../../styles/theme";
import { classAdminService, establishmentService } from "../../services/api";
import { useUser } from "../../context/UserContext";
import type { QuickAction } from "../shared/QuickActionsSheet";

const CHART_WIDTH = Dimensions.get("window").width - 32;
const DIST_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

const chartConfig = {
  backgroundGradientFrom: colors.surface,
  backgroundGradientTo: colors.surface,
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(55, 65, 81, ${opacity})`,
  barPercentage: 0.6,
};

interface EstablishmentOverviewBodyProps {
  onNavigate?: (tab: "classes" | "establishments") => void;
  accentColor?: string;
  quickActions?: QuickAction[];
  onQuickAction?: (item: QuickAction) => void;
}

/**
 * Gestionnaire's "Tableau de bord" — pixel-for-pixel matches web's
 * GestionnaireDashboardContent.jsx: same 4 stat cards (including its one
 * hardcoded "+12%" trend on Élèves inscrits), same "Distribution des
 * Classes"/"État du Réseau" charts, the same "Vue d'ensemble rapide" 4-item
 * list (a real-data snapshot presented as activity, exactly as web frames
 * it — not a real timestamped activity log there either), and the same
 * "Actions Prioritaires" 4 buttons. Used to show only a single
 * établissement-count card with none of this.
 */
const EstablishmentOverviewBody = ({ onNavigate, accentColor = colors.primary, quickActions = [], onQuickAction }: EstablishmentOverviewBodyProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [establishments, setEstablishments] = useState<{ id: string; nom?: string; etat?: string }[]>([]);
  const [classes, setClasses] = useState<{ id: string; nom?: string; etat?: string; etablissement?: { id: string }; eleves?: unknown[] }[]>([]);

  const load = useCallback(async () => {
    if (!user?.userId) return;
    setError("");
    try {
      const ests = await establishmentService.getByGestionnaire(user.userId);
      const estIds = new Set(ests.map((e) => e.id));
      const allClasses = await classAdminService.getAll().catch(() => []);
      const gestClasses = allClasses.filter((c) => c.etablissement?.id && estIds.has(c.etablissement.id));
      setEstablishments(ests);
      setClasses(gestClasses as typeof classes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors du chargement des données");
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

  if (loading) {
    return <LoadingSpinner label="Chargement de votre espace personnel..." fullScreen />;
  }

  // ── stats — matches web's `calculatedStats` field-for-field ──
  const totalStudents = classes.reduce((sum, c) => sum + (Array.isArray(c.eleves) ? c.eleves.length : 0), 0);
  const activeEstablishments = establishments.filter((e) => e.etat === "ACTIF" || !e.etat).length;
  const pendingClasses = classes.filter((c) => c.etat === "EN_ATTENTE_APPROBATION").length;
  const activeClasses = classes.filter((c) => c.etat === "ACTIF").length;

  const distributionData = establishments.map((e, i) => ({
    name: e.nom || `Établissement ${i + 1}`,
    classes: classes.filter((c) => c.etablissement?.id === e.id).length,
    color: DIST_COLORS[i % DIST_COLORS.length],
  }));

  const statusData = [
    { name: "Actives", population: activeClasses, color: "#10B981", legendFontColor: colors.textMuted, legendFontSize: 12 },
    { name: "En attente", population: pendingClasses, color: "#F59E0B", legendFontColor: colors.textMuted, legendFontSize: 12 },
  ];

  const activityItems = [
    { icon: "school" as const, color: "#2563EB", title: "Dernier établissement", sub: establishments[0]?.nom || "Aucun établissement", time: "Actualisé" },
    { icon: "check-circle" as const, color: "#059669", title: "Dernière classe active", sub: classes.find((c) => c.etat === "ACTIF")?.nom || "Aucune classe active", time: "Vérifié" },
    { icon: "clock" as const, color: "#D97706", title: "Classes à approuver", sub: `${pendingClasses} classe(s) en attente`, time: "Action requise" },
    { icon: "users" as const, color: "#7C3AED", title: "Impact Total", sub: `${totalStudents} élèves supervisés`, time: "Global" },
  ];

  const name = user?.username || `${user?.prenom ?? ""}`.trim() || "Gestionnaire";

  return (
    <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
      <View style={styles.header}>
        <HeroCard
          title={`Bonjour, ${name}`}
          subtitle={`Gérez vos ${establishments.length} établissements et supervisez vos classes en temps réel.`}
          accentColor={accentColor}
          topRight={
            <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
              <FontAwesome5 name="sync-alt" size={16} color={colors.primary} />
            </TouchableOpacity>
          }
        >
          {quickActions.length > 0 && onQuickAction ? <QuickActionGrid items={quickActions} onSelect={onQuickAction} /> : null}
        </HeroCard>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.grid}>
        <TouchableOpacity style={styles.statCard} onPress={() => onNavigate?.("establishments")}>
          <View style={[styles.statIconBox, { backgroundColor: "#2563EB" }]}>
            <FontAwesome5 name="school" size={16} color={colors.white} />
          </View>
          <Text style={styles.statLabel}>Établissements</Text>
          <Text style={styles.statNumber}>{establishments.length}</Text>
          <Text style={styles.statSubtitle}>{activeEstablishments} établissements actifs</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.statCard} onPress={() => onNavigate?.("classes")}>
          <View style={[styles.statIconBox, { backgroundColor: "#059669" }]}>
            <FontAwesome5 name="building" size={16} color={colors.white} />
          </View>
          <Text style={styles.statLabel}>Classes</Text>
          <Text style={styles.statNumber}>{classes.length}</Text>
          <Text style={styles.statSubtitle}>{activeClasses} classes déjà activées</Text>
        </TouchableOpacity>

        <View style={styles.statCard}>
          <View style={[styles.statIconBox, { backgroundColor: "#4F46E5" }]}>
            <FontAwesome5 name="users" size={16} color={colors.white} />
          </View>
          <Text style={styles.statLabel}>Élèves inscrits</Text>
          <Text style={styles.statNumber}>{totalStudents}</Text>
          <View style={styles.trendRow}>
            <FontAwesome5 name="arrow-up" size={9} color="#059669" />
            <Text style={styles.trendText}>+12%</Text>
            <Text style={styles.trendCaption}>ce mois</Text>
          </View>
          <Text style={styles.statSubtitle}>Nombre total d'élèves</Text>
        </View>

        <TouchableOpacity style={styles.statCard} onPress={() => onNavigate?.("classes")}>
          <View style={[styles.statIconBox, { backgroundColor: "#D97706" }]}>
            <FontAwesome5 name="clock" size={16} color={colors.white} />
          </View>
          <Text style={styles.statLabel}>À Approuver</Text>
          <Text style={styles.statNumber}>{pendingClasses}</Text>
          <Text style={styles.statSubtitle}>Classes nécessitant votre attention</Text>
        </TouchableOpacity>
      </View>

      <Card style={styles.chartCard}>
        <Text style={styles.chartTitle}>Distribution des Classes</Text>
        <Text style={styles.chartCaption}>Nombre de classes par établissement</Text>
        {distributionData.length === 0 ? (
          <Text style={styles.emptyText}>Aucun établissement</Text>
        ) : (
          <BarChart
            data={{ labels: distributionData.map((d) => d.name), datasets: [{ data: distributionData.map((d) => d.classes) }] }}
            width={CHART_WIDTH}
            height={200}
            chartConfig={chartConfig}
            fromZero
            yAxisLabel=""
            yAxisSuffix=""
            style={{ borderRadius: 12 }}
          />
        )}
      </Card>

      <Card style={styles.chartCard}>
        <Text style={styles.chartTitle}>État du Réseau</Text>
        <Text style={styles.chartCaption}>Proportion des classes actives vs en attente</Text>
        {activeClasses + pendingClasses === 0 ? (
          <Text style={styles.emptyText}>Aucune classe</Text>
        ) : (
          <PieChart
            data={statusData}
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
        <Text style={styles.chartTitle}>Vue d'ensemble rapide</Text>
        {activityItems.map((item, i) => (
          <View key={i} style={styles.activityRow}>
            <View style={[styles.activityIcon, { backgroundColor: item.color }]}>
              <FontAwesome5 name={item.icon} size={13} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.activityTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.activitySub} numberOfLines={1}>
                {item.sub}
              </Text>
            </View>
            <Text style={styles.activityTime}>{item.time}</Text>
          </View>
        ))}
      </Card>

      <Card style={styles.chartCard}>
        <Text style={styles.chartTitle}>Actions Prioritaires</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.primaryLight }]} onPress={() => onNavigate?.("establishments")}>
            <View style={[styles.actionIconBox, { backgroundColor: "#2563EB" }]}>
              <FontAwesome5 name="school" size={16} color={colors.white} />
            </View>
            <Text style={styles.actionLabel}>Nouvel Établissement</Text>
            <Text style={styles.actionSub}>Ajouter une structure</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, { backgroundColor: "#D1FAE5" }]} onPress={() => onNavigate?.("classes")}>
            <View style={[styles.actionIconBox, { backgroundColor: "#059669" }]}>
              <FontAwesome5 name="building" size={16} color={colors.white} />
            </View>
            <Text style={styles.actionLabel}>Créer une Classe</Text>
            <Text style={styles.actionSub}>Lancer un programme</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, { backgroundColor: "#E0E7FF" }]} onPress={() => onNavigate?.("classes")}>
            <View style={[styles.actionIconBox, { backgroundColor: "#4F46E5" }]}>
              <FontAwesome5 name="users" size={16} color={colors.white} />
            </View>
            <Text style={styles.actionLabel}>Gérer les Élèves</Text>
            <Text style={styles.actionSub}>Superviser les inscrits</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.warningLight }]} onPress={() => onNavigate?.("classes")}>
            <View style={[styles.actionIconBox, { backgroundColor: "#D97706" }]}>
              <FontAwesome5 name="exclamation-circle" size={16} color={colors.white} />
              {pendingClasses > 0 ? <View style={styles.actionBadgeDot} /> : null}
            </View>
            <Text style={styles.actionLabel}>Approbations</Text>
            <Text style={styles.actionSub}>{pendingClasses} en attente</Text>
          </TouchableOpacity>
        </View>
      </Card>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  content: { flex: 1, paddingHorizontal: 16 },
  header: { flexDirection: "row", alignItems: "flex-start", marginTop: 20, marginBottom: spacing.lg },
  title: { ...typography.h1, color: colors.text, marginBottom: 4 },
  subtitle: { ...typography.body, color: colors.textMuted },
  refreshButton: { padding: 8, backgroundColor: colors.grayLight, borderRadius: 20 },
  error: { color: colors.danger, marginBottom: spacing.md },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  statCard: {
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
  statIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  statLabel: { ...typography.caption, color: colors.textMuted, fontWeight: "700", textTransform: "uppercase", fontSize: 10 },
  statNumber: { ...typography.h1, color: colors.text, fontSize: 26, marginTop: 2 },
  statSubtitle: { ...typography.caption, color: colors.primary, marginTop: spacing.xs, fontSize: 11, fontWeight: "600" },
  trendRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: spacing.xs },
  trendText: { fontSize: 11, fontWeight: "700", color: "#059669" },
  trendCaption: { ...typography.caption, color: colors.textMuted, fontSize: 10, fontStyle: "italic" },
  chartCard: { marginBottom: spacing.md, padding: spacing.md },
  chartTitle: { ...typography.bodyBold, color: colors.text },
  chartCaption: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  emptyText: { ...typography.caption, color: colors.textMuted },
  activityRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  activityIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", marginRight: spacing.sm },
  activityTitle: { ...typography.bodyBold, color: colors.text },
  activitySub: { ...typography.caption, color: colors.textMuted },
  activityTime: { ...typography.caption, color: colors.textMuted, marginLeft: spacing.sm, fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: spacing.sm },
  actionButton: { width: "48%", borderRadius: 16, padding: spacing.md, marginBottom: spacing.md },
  actionIconBox: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  actionBadgeDot: { position: "absolute", top: -2, right: -2, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger, borderWidth: 2, borderColor: colors.white },
  actionLabel: { ...typography.bodyBold, color: colors.text, fontSize: 13 },
  actionSub: { ...typography.caption, color: colors.textMuted, fontSize: 11, marginTop: 2 },
});

export default EstablishmentOverviewBody;
