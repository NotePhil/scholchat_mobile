import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useUser } from "../../../context/UserContext";
import {
  activityFeedService,
  coursProgrammerService,
  coursService,
  exerciseService,
  matiereService,
  participationService,
} from "../../../services/api";
import { classService } from "../../../services/classService";
import { ActivityEvent } from "../../../types";

interface DashboardMainBodyProps {
  onOpenMessages: () => void;
}

interface Stats {
  classesCount: number;
  studentsCount: number;
  coursCount: number;
  coursProgrammesCount: number;
  exercisesCount: number;
  aCorrigerCount: number;
  matieresCount: number;
}

const emptyStats: Stats = {
  classesCount: 0,
  studentsCount: 0,
  coursCount: 0,
  coursProgrammesCount: 0,
  exercisesCount: 0,
  aCorrigerCount: 0,
  matieresCount: 0,
};

const ACTIVITY_ICONS: Record<string, React.ComponentProps<typeof FontAwesome5>["name"]> = {
  COMMENT: "comment",
  LIKE: "heart",
  JOIN: "user-plus",
  UNJOIN: "user-minus",
  LEAVE: "sign-out-alt",
};

const timeAgo = (dateString?: string) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Il y a ${days} j`;
};

const DashboardMainBody = ({ onOpenMessages }: DashboardMainBodyProps) => {
  const { user } = useUser();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [recentActivities, setRecentActivities] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const rotationAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    if (!user?.userId) return;
    setLoading(true);
    try {
      const [classes, cours, coursProgrammes, exercises, aCorriger, activities] = await Promise.all([
        classService.getClasses(user.userId).catch(() => []),
        coursService.getByProfessor(user.userId).catch(() => []),
        coursProgrammerService.getByProfessor(user.userId).catch(() => []),
        exerciseService.getByProfessor(user.userId).catch(() => []),
        participationService.getToCorrectByProfessor(user.userId).catch(() => []),
        activityFeedService.getByProfessor(user.userId).catch(() => []),
      ]);

      const classUsersLists = await Promise.all(
        classes.map((c) => classService.getClassUsers(c.id).catch(() => []))
      );
      const studentIds = new Set<string>();
      classUsersLists.forEach((list) => {
        list.filter((u) => u.type === "eleve").forEach((u) => studentIds.add(u.id));
      });

      const matiereIds = new Set<string>();
      [...cours, ...exercises].forEach((item) => {
        (item.matieres ?? []).forEach((m) => {
          if (m?.id) matiereIds.add(m.id);
        });
      });
      if (matiereIds.size === 0) {
        const allMatieres = await matiereService.getAll().catch(() => []);
        allMatieres.forEach((m) => matiereIds.add(m.id));
      }

      setStats({
        classesCount: classes.length,
        studentsCount: studentIds.size,
        coursCount: cours.length,
        coursProgrammesCount: coursProgrammes.length,
        exercisesCount: exercises.length,
        aCorrigerCount: aCorriger.length,
        matieresCount: matiereIds.size,
      });

      const sortedActivities = [...activities].sort((a, b) => {
        const dateA = a.heureDebut ? new Date(a.heureDebut).getTime() : 0;
        const dateB = b.heureDebut ? new Date(b.heureDebut).getTime() : 0;
        return dateB - dateA;
      });
      setRecentActivities(sortedActivities.slice(0, 4));
    } finally {
      setLoading(false);
    }
  }, [user?.userId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    const rotateAnimation = Animated.loop(
      Animated.timing(rotationAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    );
    rotateAnimation.start();
    await load();
    rotateAnimation.stop();
    rotationAnim.setValue(0);
    setIsRefreshing(false);
  };

  const spin = rotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const displayName = user?.prenom || user?.username || user?.nom || "Professeur";

  return (
    <View style={mainBodyStyles.container}>
      <ScrollView style={mainBodyStyles.content}>
        <View style={mainBodyStyles.welcomeSection}>
          <Text style={mainBodyStyles.welcomeText}>Bienvenue {displayName}</Text>
          <TouchableOpacity
            style={mainBodyStyles.refreshButton}
            onPress={handleRefresh}
            disabled={isRefreshing}
          >
            <Animated.View style={{ transform: [{ rotate: spin }] }}>
              <FontAwesome5 name="sync-alt" size={18} color="#4F46E5" />
            </Animated.View>
          </TouchableOpacity>
        </View>
        <Text style={mainBodyStyles.dashboardDescription}>
          Tableau de bord de gestion de la plateforme
        </Text>
        <View style={mainBodyStyles.statsGrid}>
          <View style={[mainBodyStyles.statCard, mainBodyStyles.classesCard]}>
            <View style={mainBodyStyles.statHeader}>
              <FontAwesome5 name="door-open" size={20} color="#4F46E5" />
              <Text style={mainBodyStyles.statNumber}>{loading ? "-" : stats.classesCount}</Text>
            </View>
            <Text style={mainBodyStyles.statTitle}>Classes</Text>
            <Text style={mainBodyStyles.statSubtitle}>{stats.studentsCount} élèves</Text>
          </View>
          <View style={[mainBodyStyles.statCard, mainBodyStyles.coursCard]}>
            <View style={mainBodyStyles.statHeader}>
              <FontAwesome5 name="book-open" size={20} color="#10B981" />
              <Text style={mainBodyStyles.statNumber}>{loading ? "-" : stats.coursCount}</Text>
            </View>
            <Text style={mainBodyStyles.statTitle}>Cours</Text>
            <Text style={mainBodyStyles.statSubtitle}>{stats.coursProgrammesCount} programmés</Text>
          </View>
          <View style={[mainBodyStyles.statCard, mainBodyStyles.exercisesCard]}>
            <View style={mainBodyStyles.statHeader}>
              <FontAwesome5 name="clipboard-list" size={20} color="#8B5CF6" />
              <Text style={mainBodyStyles.statNumber}>{loading ? "-" : stats.exercisesCount}</Text>
            </View>
            <Text style={mainBodyStyles.statTitle}>Exercices</Text>
            <Text style={mainBodyStyles.statSubtitle}>{stats.aCorrigerCount} à corriger</Text>
          </View>
          <View style={[mainBodyStyles.statCard, mainBodyStyles.subjectsCard]}>
            <View style={mainBodyStyles.statHeader}>
              <FontAwesome5 name="graduation-cap" size={20} color="#F97316" />
              <Text style={mainBodyStyles.statNumber}>{loading ? "-" : stats.matieresCount}</Text>
            </View>
            <Text style={mainBodyStyles.statTitle}>Matières</Text>
            <Text style={mainBodyStyles.statSubtitle}>liées à vos cours</Text>
          </View>
        </View>
        <View style={mainBodyStyles.activitiesSection}>
          <View style={mainBodyStyles.sectionHeader}>
            <Text style={mainBodyStyles.sectionTitle}>Activités Récentes</Text>
          </View>
          <View style={mainBodyStyles.activitiesContainer}>
            {!loading && recentActivities.length === 0 ? (
              <Text style={mainBodyStyles.emptyText}>Aucune activité récente.</Text>
            ) : (
              recentActivities.map((activity) => {
                const lastInteraction = (activity.interactions ?? [])[activity.interactions?.length ? activity.interactions.length - 1 : 0];
                const icon = ACTIVITY_ICONS[lastInteraction?.type ?? ""] ?? "calendar-plus";
                return (
                  <View key={activity.id} style={mainBodyStyles.activityItem}>
                    <View style={[mainBodyStyles.activityIcon, { backgroundColor: "#4F46E5" }]}>
                      <FontAwesome5 name={icon} size={14} color="#FFFFFF" />
                    </View>
                    <View style={mainBodyStyles.activityContent}>
                      <Text style={mainBodyStyles.activityTitle}>{activity.titre}</Text>
                      <Text style={mainBodyStyles.activityTime}>{timeAgo(activity.heureDebut)}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>
        <View style={{ height: 150 }} />
      </ScrollView>
      <TouchableOpacity
        style={mainBodyStyles.floatingButton}
        onPress={onOpenMessages}
      >
        <FontAwesome5 name="comments" size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
};

const mainBodyStyles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  welcomeSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  dashboardDescription: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 24,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  statCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  statHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#111827",
  },
  statTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  statSubtitle: {
    fontSize: 12,
    color: "#6B7280",
  },
  classesCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#4F46E5",
  },
  coursCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#10B981",
  },
  exercisesCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#8B5CF6",
  },
  subjectsCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#F97316",
  },
  activitiesSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 150,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  activitiesContainer: {
    gap: 12,
  },
  emptyText: {
    fontSize: 13,
    color: "#9CA3AF",
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "500",
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 12,
    color: "#6B7280",
  },
  floatingButton: {
    position: "absolute",
    bottom: 120,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#4F46E5",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});

export default DashboardMainBody;
