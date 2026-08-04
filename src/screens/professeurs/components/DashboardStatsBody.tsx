import React from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

const DashboardStatsBody = () => {
  return (
    <ScrollView style={statsBodyStyles.content}>
      <View style={statsBodyStyles.pageHeader}>
        <Text style={statsBodyStyles.pageTitle}>Statistiques Détaillées</Text>
        <Text style={statsBodyStyles.pageSubtitle}>
          Analyse complète des performances
        </Text>
      </View>

      {/* Performance Metrics */}
      <View style={statsBodyStyles.metricsSection}>
        <Text style={statsBodyStyles.sectionTitle}>
          Métriques de Performance
        </Text>

        <View style={statsBodyStyles.metricCard}>
          <View style={statsBodyStyles.metricHeader}>
            <FontAwesome5 name="chart-line" size={24} color="#10B981" />
            <Text style={statsBodyStyles.metricValue}>+24%</Text>
          </View>
          <Text style={statsBodyStyles.metricTitle}>Croissance Mensuelle</Text>
          <Text style={statsBodyStyles.metricDescription}>
            Augmentation du nombre d'utilisateurs actifs ce mois
          </Text>
        </View>

        <View style={statsBodyStyles.metricCard}>
          <View style={statsBodyStyles.metricHeader}>
            <FontAwesome5 name="clock" size={24} color="#3B82F6" />
            <Text style={statsBodyStyles.metricValue}>2.5h</Text>
          </View>
          <Text style={statsBodyStyles.metricTitle}>
            Temps Moyen de Session
          </Text>
          <Text style={statsBodyStyles.metricDescription}>
            Durée moyenne d'utilisation par session utilisateur
          </Text>
        </View>

        <View style={statsBodyStyles.metricCard}>
          <View style={statsBodyStyles.metricHeader}>
            <FontAwesome5 name="star" size={24} color="#F59E0B" />
            <Text style={statsBodyStyles.metricValue}>4.8/5</Text>
          </View>
          <Text style={statsBodyStyles.metricTitle}>
            Satisfaction Utilisateur
          </Text>
          <Text style={statsBodyStyles.metricDescription}>
            Note moyenne basée sur les retours des utilisateurs
          </Text>
        </View>
      </View>

      {/* Activity Timeline */}
      <View style={statsBodyStyles.timelineSection}>
        <Text style={statsBodyStyles.sectionTitle}>Activité Récente</Text>

        <View style={statsBodyStyles.timelineItem}>
          <View style={statsBodyStyles.timelineDot} />
          <View style={statsBodyStyles.timelineContent}>
            <Text style={statsBodyStyles.timelineTitle}>
              Nouveau professeur inscrit
            </Text>
            <Text style={statsBodyStyles.timelineTime}>Il y a 2 heures</Text>
          </View>
        </View>

        <View style={statsBodyStyles.timelineItem}>
          <View style={statsBodyStyles.timelineDot} />
          <View style={statsBodyStyles.timelineContent}>
            <Text style={statsBodyStyles.timelineTitle}>
              5 nouveaux élèves rejoints
            </Text>
            <Text style={statsBodyStyles.timelineTime}>Il y a 4 heures</Text>
          </View>
        </View>

        <View style={statsBodyStyles.timelineItem}>
          <View style={statsBodyStyles.timelineDot} />
          <View style={statsBodyStyles.timelineContent}>
            <Text style={statsBodyStyles.timelineTitle}>
              Mise à jour système effectuée
            </Text>
            <Text style={statsBodyStyles.timelineTime}>Il y a 1 jour</Text>
          </View>
        </View>
      </View>

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
