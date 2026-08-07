import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useUser } from "../../../context/UserContext";
import {
  activityFeedService,
  exerciseService,
  participationService,
} from "../../../services/api";
import { classService } from "../../../services/classService";
import { LoadingSpinner } from "../../../components/ui";
import { ActivityEvent } from "../../../types";

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

const DashboardStatsBody = () => {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [classesCount, setClassesCount] = useState(0);
  const [studentsCount, setStudentsCount] = useState(0);
  const [exercisesCount, setExercisesCount] = useState(0);
  const [correctedCount, setCorrectedCount] = useState(0);
  const [toCorrectCount, setToCorrectCount] = useState(0);
  const [timeline, setTimeline] = useState<ActivityEvent[]>([]);

  const load = useCallback(async () => {
    if (!user?.userId) return;
    setLoading(true);
    try {
      const [classes, exercises, toCorrect, activities] = await Promise.all([
        classService.getClasses(user.userId).catch(() => []),
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

      setClassesCount(classes.length);
      setStudentsCount(studentIds.size);
      setExercisesCount(exercises.length);
      setToCorrectCount(toCorrect.length);
      setCorrectedCount(
        exercises.filter((e) => (e.etat ?? "").toUpperCase() === "CORRIGE" || (e.etat ?? "").toUpperCase() === "ACTIF").length
      );

      const sorted = [...activities].sort((a, b) => {
        const dateA = a.heureDebut ? new Date(a.heureDebut).getTime() : 0;
        const dateB = b.heureDebut ? new Date(b.heureDebut).getTime() : 0;
        return dateB - dateA;
      });
      setTimeline(sorted.slice(0, 6));
    } finally {
      setLoading(false);
    }
  }, [user?.userId]);

  useEffect(() => {
    load();
  }, [load]);

  const correctionRate =
    exercisesCount + toCorrectCount > 0
      ? Math.round((correctedCount / (correctedCount + toCorrectCount || 1)) * 100)
      : 0;

  return (
    <ScrollView style={statsBodyStyles.content}>
      <View style={statsBodyStyles.pageHeader}>
        <Text style={statsBodyStyles.pageTitle}>Statistiques Détaillées</Text>
        <Text style={statsBodyStyles.pageSubtitle}>
          Analyse complète de votre activité
        </Text>
      </View>

      {loading ? (
        <LoadingSpinner label="Chargement des statistiques..." />
      ) : (
        <>
          {/* Performance Metrics */}
          <View style={statsBodyStyles.metricsSection}>
            <Text style={statsBodyStyles.sectionTitle}>
              Métriques de Performance
            </Text>

            <View style={statsBodyStyles.metricCard}>
              <View style={statsBodyStyles.metricHeader}>
                <FontAwesome5 name="chalkboard-teacher" size={24} color="#10B981" />
                <Text style={statsBodyStyles.metricValue}>{classesCount}</Text>
              </View>
              <Text style={statsBodyStyles.metricTitle}>Classes Gérées</Text>
              <Text style={statsBodyStyles.metricDescription}>
                Nombre de classes sous votre responsabilité
              </Text>
            </View>

            <View style={statsBodyStyles.metricCard}>
              <View style={statsBodyStyles.metricHeader}>
                <FontAwesome5 name="user-graduate" size={24} color="#3B82F6" />
                <Text style={statsBodyStyles.metricValue}>{studentsCount}</Text>
              </View>
              <Text style={statsBodyStyles.metricTitle}>Élèves Suivis</Text>
              <Text style={statsBodyStyles.metricDescription}>
                Nombre total d'élèves dans vos classes
              </Text>
            </View>

            <View style={statsBodyStyles.metricCard}>
              <View style={statsBodyStyles.metricHeader}>
                <FontAwesome5 name="check-double" size={24} color="#F59E0B" />
                <Text style={statsBodyStyles.metricValue}>{correctionRate}%</Text>
              </View>
              <Text style={statsBodyStyles.metricTitle}>
                Taux de Correction
              </Text>
              <Text style={statsBodyStyles.metricDescription}>
                {toCorrectCount} copie(s) en attente de correction
              </Text>
            </View>
          </View>

          {/* Activity Timeline */}
          <View style={statsBodyStyles.timelineSection}>
            <Text style={statsBodyStyles.sectionTitle}>Activité Récente</Text>

            {timeline.length === 0 ? (
              <Text style={statsBodyStyles.emptyText}>Aucune activité récente.</Text>
            ) : (
              timeline.map((activity) => (
                <View key={activity.id} style={statsBodyStyles.timelineItem}>
                  <View style={statsBodyStyles.timelineDot} />
                  <View style={statsBodyStyles.timelineContent}>
                    <Text style={statsBodyStyles.timelineTitle}>{activity.titre}</Text>
                    <Text style={statsBodyStyles.timelineTime}>{timeAgo(activity.heureDebut)}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </>
      )}

      {/* Extra space for bottom navigation */}
      <View style={{ height: 80 }} />
    </ScrollView>
  );
};

const statsBodyStyles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  pageHeader: {
    marginTop: 20,
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 16,
    color: "#6B7280",
  },
  metricsSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 16,
  },
  metricCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  metricHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
  },
  metricTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  metricDescription: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
  },
  timelineSection: {
    marginBottom: 24,
  },
  emptyText: {
    fontSize: 14,
    color: "#9CA3AF",
  },
  timelineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#4F46E5",
    marginRight: 12,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#111827",
    marginBottom: 4,
  },
  timelineTime: {
    fontSize: 14,
    color: "#6B7280",
  },
});

export default DashboardStatsBody;
