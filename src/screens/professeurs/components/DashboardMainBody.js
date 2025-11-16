import React, { useState, useRef, useEffect } from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

const DashboardMainBody = ({ onOpenMessages }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const rotationAnim = useRef(new Animated.Value(0)).current;

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
    setTimeout(() => {
      setIsRefreshing(false);
      rotateAnimation.stop();
      rotationAnim.setValue(0);
    }, 2000);
  };

  const spin = rotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const recentActivities = [
    {
      id: 1,
      type: "course",
      title: "Nouveau cours de Mathématiques ajouté",
      time: "Il y a 2h",
      icon: "book-open",
      color: "#4F46E5",
    },
    {
      id: 2,
      type: "exercise",
      title: "Exercice de Physique soumis par Marie",
      time: "Il y a 4h",
      icon: "clipboard-list",
      color: "#10B981",
    },
    {
      id: 3,
      type: "student",
      title: "3 nouveaux élèves inscrits",
      time: "Il y a 6h",
      icon: "user-plus",
      color: "#8B5CF6",
    },
    {
      id: 4,
      type: "scheduled",
      title: "Cours de Français programmé pour demain",
      time: "Il y a 1 jour",
      icon: "calendar-plus",
      color: "#F97316",
    },
  ];

  return (
    <View style={mainBodyStyles.container}>
      <ScrollView style={mainBodyStyles.content}>
        <View style={mainBodyStyles.welcomeSection}>
          <Text style={mainBodyStyles.welcomeText}>Bienvenue Mr Simo</Text>
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
              <Text style={mainBodyStyles.statNumber}>12</Text>
            </View>
            <Text style={mainBodyStyles.statTitle}>Classes</Text>
            <Text style={mainBodyStyles.statSubtitle}>248 élèves</Text>
          </View>
          <View style={[mainBodyStyles.statCard, mainBodyStyles.coursCard]}>
            <View style={mainBodyStyles.statHeader}>
              <FontAwesome5 name="book-open" size={20} color="#10B981" />
              <Text style={mainBodyStyles.statNumber}>34</Text>
            </View>
            <Text style={mainBodyStyles.statTitle}>Cours</Text>
            <Text style={mainBodyStyles.statSubtitle}>15 programmés</Text>
          </View>
          <View style={[mainBodyStyles.statCard, mainBodyStyles.exercisesCard]}>
            <View style={mainBodyStyles.statHeader}>
              <FontAwesome5 name="clipboard-list" size={20} color="#8B5CF6" />
              <Text style={mainBodyStyles.statNumber}>87</Text>
            </View>
            <Text style={mainBodyStyles.statTitle}>Exercices</Text>
            <Text style={mainBodyStyles.statSubtitle}>23 en attente</Text>
          </View>
          <View style={[mainBodyStyles.statCard, mainBodyStyles.subjectsCard]}>
            <View style={mainBodyStyles.statHeader}>
              <FontAwesome5 name="graduation-cap" size={20} color="#F97316" />
              <Text style={mainBodyStyles.statNumber}>8</Text>
            </View>
            <Text style={mainBodyStyles.statTitle}>Matières</Text>
            <Text style={mainBodyStyles.statSubtitle}>6 actives</Text>
          </View>
        </View>
        <View style={mainBodyStyles.progressSection}>
          <Text style={mainBodyStyles.sectionTitle}>Progrès des Élèves</Text>
          <View style={mainBodyStyles.progressContainer}>
            <View style={mainBodyStyles.progressItem}>
              <Text style={mainBodyStyles.progressLabel}>Mathématiques</Text>
              <View style={mainBodyStyles.progressBarContainer}>
                <View
                  style={[
                    mainBodyStyles.progressBar,
                    { width: "78%", backgroundColor: "#4F46E5" },
                  ]}
                />
              </View>
              <Text style={mainBodyStyles.progressPercentage}>78%</Text>
            </View>
            <View style={mainBodyStyles.progressItem}>
              <Text style={mainBodyStyles.progressLabel}>Français</Text>
              <View style={mainBodyStyles.progressBarContainer}>
                <View
                  style={[
                    mainBodyStyles.progressBar,
                    { width: "65%", backgroundColor: "#10B981" },
                  ]}
                />
              </View>
              <Text style={mainBodyStyles.progressPercentage}>65%</Text>
            </View>
            <View style={mainBodyStyles.progressItem}>
              <Text style={mainBodyStyles.progressLabel}>Sciences</Text>
              <View style={mainBodyStyles.progressBarContainer}>
                <View
                  style={[
                    mainBodyStyles.progressBar,
                    { width: "82%", backgroundColor: "#8B5CF6" },
                  ]}
                />
              </View>
              <Text style={mainBodyStyles.progressPercentage}>82%</Text>
            </View>
            <View style={mainBodyStyles.progressItem}>
              <Text style={mainBodyStyles.progressLabel}>Histoire</Text>
              <View style={mainBodyStyles.progressBarContainer}>
                <View
                  style={[
                    mainBodyStyles.progressBar,
                    { width: "71%", backgroundColor: "#F97316" },
                  ]}
                />
              </View>
              <Text style={mainBodyStyles.progressPercentage}>71%</Text>
            </View>
          </View>
        </View>
        <View style={mainBodyStyles.activitiesSection}>
          <View style={mainBodyStyles.sectionHeader}>
            <Text style={mainBodyStyles.sectionTitle}>Activités Récentes</Text>
            <TouchableOpacity>
              <Text style={mainBodyStyles.seeAllText}>Voir tout</Text>
            </TouchableOpacity>
          </View>
          <View style={mainBodyStyles.activitiesContainer}>
            {recentActivities.map((activity) => (
              <View key={activity.id} style={mainBodyStyles.activityItem}>
                <View
                  style={[
                    mainBodyStyles.activityIcon,
                    { backgroundColor: activity.color },
                  ]}
                >
                  <FontAwesome5
                    name={activity.icon}
                    size={14}
                    color="#FFFFFF"
                  />
                </View>
                <View style={mainBodyStyles.activityContent}>
                  <Text style={mainBodyStyles.activityTitle}>
                    {activity.title}
                  </Text>
                  <Text style={mainBodyStyles.activityTime}>
                    {activity.time}
                  </Text>
                </View>
              </View>
            ))}
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
  progressSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
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
  progressContainer: {
    gap: 12,
  },
  progressItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  progressLabel: {
    fontSize: 14,
    color: "#374151",
    width: 80,
    fontWeight: "500",
  },
  progressBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 4,
  },
  progressPercentage: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
    width: 35,
    textAlign: "right",
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
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  seeAllText: {
    fontSize: 14,
    color: "#4F46E5",
    fontWeight: "500",
  },
  activitiesContainer: {
    gap: 12,
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
