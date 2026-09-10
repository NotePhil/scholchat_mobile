import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Dimensions, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { BarChart, PieChart } from "react-native-chart-kit";
import { Badge, Card, EmptyState, HeroCard, LoadingSpinner, QuickActionGrid } from "../../components/ui";
import { colors, spacing, typography, useThemeColors } from "../../styles/theme";
import { accederService, coursProgrammerService, notificationService, parentService } from "../../services/api";
import { ClassEntity, CoursProgramme } from "../../types";
import { NotificationItem } from "../../store/useNotificationsStore";
import { useUser } from "../../context/UserContext";
import { useSelectedChildStore } from "../../store/useSelectedChildStore";
import ChildSelectorRow from "../parent/ChildSelectorRow";
import type { QuickAction } from "./QuickActionsSheet";

const CHART_WIDTH = Dimensions.get("window").width - 32;
const chartConfig = {
  backgroundGradientFrom: colors.surface,
  backgroundGradientTo: colors.surface,
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(55, 65, 81, ${opacity})`,
  barPercentage: 0.6,
};

interface StudentParentStatsBodyProps {
  userRole: "parent" | "student";
  onNavigate?: (tab: string) => void;
  accentColor?: string;
  quickActions?: QuickAction[];
  onQuickAction?: (item: QuickAction) => void;
}

/**
 * "Suivi Scolaire" (parent) / "Mon Tableau de Bord" (student) — the exact
 * same web component, StudentParentStats.jsx, used for both roles there
 * (only its `userRole` prop differs), so this is one shared screen here
 * too. Every number here is genuinely real on web (no Math.random(), unlike
 * DashboardContent.jsx) — this replaces mobile's much thinner
 * ParentOverviewBody/StudentOverviewBody stat-only screens with the same
 * stat cards, the same two charts, and the same Classes/Cours à
 * Venir/Notifications three-column bottom section.
 */
const StudentParentStatsBody = ({ userRole, onNavigate, accentColor = colors.primary, quickActions = [], onQuickAction }: StudentParentStatsBodyProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useUser();
  const isParent = userRole === "parent";
  const { children, selectedChildId, loading: childrenLoading, loadChildren } = useSelectedChildStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [courses, setCourses] = useState<CoursProgramme[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    if (isParent && user?.userId) loadChildren(user.userId);
  }, [isParent, user?.userId, loadChildren]);

  const load = useCallback(async () => {
    if (!user?.userId) return;
    if (isParent && !selectedChildId) {
      setClasses([]);
      setCourses([]);
      setNotifications([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const targetId = isParent ? (selectedChildId as string) : user.userId;
      if (isParent) {
        const [cls, crs, notifs] = await Promise.all([
          parentService.getChildClasses(targetId).catch(() => []),
          coursProgrammerService.getByParticipant(targetId).catch(() => []),
          notificationService.getAll().catch(() => []),
        ]);
        setClasses(cls);
        setCourses(crs);
        setNotifications(notifs);
      } else {
        const [cls, crs] = await Promise.all([
          accederService.getAccessibleClasses(targetId).catch(() => []),
          coursProgrammerService.getByParticipant(targetId).catch(() => []),
        ]);
        setClasses(cls);
        setCourses(crs);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  }, [user?.userId, isParent, selectedChildId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading || (isParent && childrenLoading)) {
    return <LoadingSpinner label="Chargement des données..." fullScreen />;
  }

  const upcomingCourses = courses.filter((c) => {
    const d = c.dateCoursPrevue ? new Date(c.dateCoursPrevue) : null;
    return d && d > new Date() && c.etatCoursProgramme === "PLANIFIE";
  });
  const completedCourses = courses.filter((c) => c.etatCoursProgramme === "TERMINE");
  const inProgressCourses = courses.filter((c) => c.etatCoursProgramme === "EN_COURS");
  const unreadNotifications = notifications.filter((n) => !n.isRead);

  const coursesByClassData = classes.map((cls) => ({
    name: cls.nom && cls.nom.length > 12 ? `${cls.nom.slice(0, 12)}…` : cls.nom || "Classe",
    courses: courses.filter((c) => c.classesIds?.includes(cls.id) || (c as any).classeId === cls.id).length,
  }));

  const courseStatusData = [
    { name: "Terminés", population: completedCourses.length, color: "#10B981", legendFontColor: colors.textMuted, legendFontSize: 11 },
    { name: "En cours", population: inProgressCourses.length, color: "#3B82F6", legendFontColor: colors.textMuted, legendFontSize: 11 },
    { name: "Planifiés", population: upcomingCourses.length, color: "#F59E0B", legendFontColor: colors.textMuted, legendFontSize: 11 },
  ].filter((d) => d.population > 0);

  const showContent = !isParent || children.length > 0;
  const activeClassesCount = classes.filter((c) => (c.etat as string) === "ACTIF").length;

  const primaryStats = [
    {
      label: "Classes",
      value: classes.length,
      icon: "book-open" as const,
      color: "#3B82F6",
      subtitle: `${activeClassesCount} active${activeClassesCount > 1 ? "s" : ""}`,
      onPress: () => onNavigate?.("classes"),
    },
    {
      label: "Cours Programmés",
      value: courses.length,
      icon: "calendar-alt" as const,
      color: "#10B981",
      subtitle: `${upcomingCourses.length} à venir`,
      onPress: () => onNavigate?.("courses"),
    },
    {
      label: "Cours Terminés",
      value: completedCourses.length,
      icon: "check-circle" as const,
      color: "#8B5CF6",
      subtitle: courses.length > 0 ? `${Math.round((completedCourses.length / courses.length) * 100)}% du total` : "Aucun cours",
    },
    isParent
      ? { label: "Notifications", value: unreadNotifications.length, icon: "bell" as const, color: "#F97316", subtitle: `${notifications.length} au total` }
      : { label: "En Cours", value: inProgressCourses.length, icon: "clock" as const, color: "#F97316", subtitle: "Cours en cours" },
  ];

  const firstName = user?.prenom || user?.username || "";
  const heroSubtitle = isParent
    ? children.find((c) => c.id === selectedChildId)
      ? `Suivi de ${children.find((c) => c.id === selectedChildId)?.prenom} ${children.find((c) => c.id === selectedChildId)?.nom ?? ""}`
      : "Sélectionnez un enfant pour voir ses données"
    : "Suivez vos progrès et activités scolaires";

  return (
    <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
      <View style={styles.header}>
        <HeroCard
          title={`Bonjour${firstName ? `, ${firstName}` : ""} 👋`}
          subtitle={heroSubtitle}
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

      {isParent ? <ChildSelectorRow /> : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {isParent && children.length === 0 ? (
        <EmptyState
          icon="users"
          title="Aucun enfant associé"
          message="Pour suivre la scolarité de vos enfants, veuillez d'abord demander l'accès à leurs classes via un code d'activation."
          actionLabel="Accéder aux Classes"
          onAction={() => onNavigate?.("classes")}
        />
      ) : null}

      {showContent && (
        <>
          <View style={styles.grid}>
            {primaryStats.map((stat) => (
              <TouchableOpacity
                key={stat.label}
                style={styles.statCard}
                activeOpacity={stat.onPress ? 0.7 : 1}
                onPress={stat.onPress}
                disabled={!stat.onPress}
              >
                <View style={[styles.statIconBox, { backgroundColor: stat.color }]}>
                  <FontAwesome5 name={stat.icon} size={16} color={colors.white} />
                </View>
                <Text style={styles.statLabel}>{stat.label}</Text>
                <Text style={styles.statNumber}>{stat.value}</Text>
                <Text style={styles.statSubtitle}>{stat.subtitle}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {courses.length > 0 && (
            <>
              {coursesByClassData.length > 0 && (
                <Card style={styles.chartCard}>
                  <Text style={styles.chartTitle}>Cours par Classe</Text>
                  <BarChart
                    data={{ labels: coursesByClassData.map((d) => d.name), datasets: [{ data: coursesByClassData.map((d) => d.courses) }] }}
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

              {courseStatusData.length > 0 && (
                <Card style={styles.chartCard}>
                  <Text style={styles.chartTitle}>État des Cours</Text>
                  <PieChart
                    data={courseStatusData}
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
            </>
          )}

          <Card style={styles.chartCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.chartTitle}>Classes ({classes.length})</Text>
              <TouchableOpacity onPress={() => onNavigate?.("classes")}>
                <Text style={styles.linkText}>Gérer</Text>
              </TouchableOpacity>
            </View>
            {classes.length === 0 ? (
              <EmptyState
                icon="users"
                title={isParent ? "Cet enfant n'est inscrit dans aucune classe" : "Vous n'êtes inscrit dans aucune classe"}
                actionLabel={isParent ? "Inscrire mon enfant" : "Rechercher une classe"}
                onAction={() => onNavigate?.(isParent ? "children" : "classes")}
              />
            ) : (
              classes.map((cls) => {
                const count = courses.filter((c) => c.classesIds?.includes(cls.id) || (c as any).classeId === cls.id).length;
                const etat = cls.etat as string | undefined;
                return (
                  <View key={cls.id} style={styles.listRow}>
                    <View style={styles.listAvatar}>
                      <Text style={styles.listAvatarText}>{(cls.nom || "C")[0].toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listTitle} numberOfLines={1}>
                        {cls.nom}
                      </Text>
                      <Text style={styles.listSub}>
                        {cls.niveau ?? ""} {count > 0 ? `- ${count} cours` : ""}
                      </Text>
                    </View>
                    <Badge
                      label={etat === "ACTIF" ? "Actif" : etat === "EN_ATTENTE" ? "En attente" : etat || "Inscrit"}
                      tone={etat === "ACTIF" ? "success" : etat === "EN_ATTENTE" ? "warning" : "info"}
                    />
                  </View>
                );
              })
            )}
          </Card>

          <Card style={styles.chartCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.chartTitle}>Cours à Venir</Text>
              <TouchableOpacity onPress={() => onNavigate?.("courses")}>
                <Text style={styles.linkText}>Voir tout</Text>
              </TouchableOpacity>
            </View>
            {upcomingCourses.length === 0 ? (
              <EmptyState icon="calendar" title="Aucun cours planifié pour le moment" />
            ) : (
              upcomingCourses.slice(0, 5).map((course) => {
                const d = course.dateCoursPrevue ? new Date(course.dateCoursPrevue) : null;
                return (
                  <View key={course.id} style={styles.listRow}>
                    <View style={[styles.listAvatar, { backgroundColor: colors.primaryLight }]}>
                      <FontAwesome5 name="book-open" size={14} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listTitle} numberOfLines={1}>
                        {(course as any).coursNom || course.description || "Cours programmé"}
                      </Text>
                      {course.lieu ? <Text style={styles.listSub}>{course.lieu}</Text> : null}
                    </View>
                    {d ? (
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={styles.listSub}>{d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</Text>
                        <Text style={styles.listTime}>{d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })
            )}
          </Card>

          {isParent ? (
            <Card style={styles.chartCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.chartTitle}>
                  Notifications{unreadNotifications.length > 0 ? ` (${unreadNotifications.length})` : ""}
                </Text>
              </View>
              {notifications.length === 0 ? (
                <EmptyState icon="bell" title="Aucune notification" />
              ) : (
                notifications.slice(0, 5).map((n) => (
                  <View key={n.id} style={[styles.listRow, !n.isRead && styles.listRowUnread]}>
                    <View style={[styles.listAvatar, { backgroundColor: !n.isRead ? colors.primaryLight : colors.grayLight }]}>
                      <FontAwesome5 name="bell" size={12} color={!n.isRead ? colors.primary : colors.textMuted} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listTitle} numberOfLines={1}>
                        {n.title || "Notification"}
                      </Text>
                      <Text style={styles.listSub} numberOfLines={1}>
                        {n.message}
                      </Text>
                    </View>
                    {n.createdAt ? (
                      <Text style={styles.listTime}>{new Date(n.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</Text>
                    ) : null}
                  </View>
                ))
              )}
            </Card>
          ) : null}
        </>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  content: { flex: 1, paddingHorizontal: 16 },
  header: { flexDirection: "row", alignItems: "flex-start", marginTop: 20, marginBottom: spacing.md },
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
  statNumber: { ...typography.h1, color: colors.text, fontSize: 24, marginTop: 2 },
  statSubtitle: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs, fontSize: 11 },
  chartCard: { marginBottom: spacing.md, padding: spacing.md },
  chartTitle: { ...typography.bodyBold, color: colors.text },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  linkText: { ...typography.caption, color: colors.primary, fontWeight: "700" },
  listRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  listRowUnread: { backgroundColor: colors.primaryLight, borderRadius: 8, borderTopWidth: 0, marginTop: 2, paddingHorizontal: spacing.sm },
  listAvatar: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.grayLight, alignItems: "center", justifyContent: "center" },
  listAvatarText: { ...typography.bodyBold, color: colors.text },
  listTitle: { ...typography.bodyBold, color: colors.text, fontSize: 13 },
  listSub: { ...typography.caption, color: colors.textMuted },
  listTime: { ...typography.caption, color: colors.textMuted, fontSize: 10 },
});

export default StudentParentStatsBody;
