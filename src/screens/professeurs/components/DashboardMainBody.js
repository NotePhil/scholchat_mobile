import React from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

const DashboardMainBody = () => {
  const handleMessagePress = () => {
    console.log("Opening messages...");
    // Add your message navigation logic here
  };

  return (
    <View style={mainBodyStyles.container}>
      <ScrollView style={mainBodyStyles.content}>
        {/* Welcome Section */}
        <View style={mainBodyStyles.welcomeSection}>
          <Text style={mainBodyStyles.welcomeText}>Bienvenue Mr Simo</Text>
          <TouchableOpacity style={mainBodyStyles.updateButton}>
            <Text style={mainBodyStyles.updateButtonText}>Actualiser</Text>
          </TouchableOpacity>
        </View>
        {/* Dashboard Description */}
        <Text style={mainBodyStyles.dashboardDescription}>
          Tableau de bord de gestion de la plateforme
        </Text>
        {/* Statistics Grid */}
        <View style={mainBodyStyles.statsGrid}>
          {/* Total Users */}
          <View
            style={[mainBodyStyles.statCard, mainBodyStyles.totalUsersCard]}
          >
            <View style={mainBodyStyles.statHeader}>
              <FontAwesome5 name="users" size={20} color="#4F46E5" />
              <Text style={mainBodyStyles.statGrowth}>+12% ce mois</Text>
            </View>
            <Text style={mainBodyStyles.statNumber}>16</Text>
            <Text style={mainBodyStyles.statTitle}>Total Utilisateurs</Text>
            <Text style={mainBodyStyles.statSubtitle}>
              Tous les utilisateurs
            </Text>
          </View>
          {/* Teachers */}
          <View style={[mainBodyStyles.statCard, mainBodyStyles.teachersCard]}>
            <View style={mainBodyStyles.statHeader}>
              <FontAwesome5
                name="chalkboard-teacher"
                size={20}
                color="#10B981"
              />
              <Text style={mainBodyStyles.statGrowth}>+8% ce mois</Text>
            </View>
            <Text style={mainBodyStyles.statNumber}>4</Text>
            <Text style={mainBodyStyles.statTitle}>Professeurs</Text>
            <Text style={mainBodyStyles.statSubtitle}>3 actifs</Text>
          </View>
          {/* Classes */}
          <View style={[mainBodyStyles.statCard, mainBodyStyles.classesCard]}>
            <View style={mainBodyStyles.statHeader}>
              <FontAwesome5 name="door-open" size={20} color="#8B5CF6" />
              <Text style={mainBodyStyles.statGrowth}>+15% ce mois</Text>
            </View>
            <Text style={mainBodyStyles.statNumber}>6</Text>
            <Text style={mainBodyStyles.statTitle}>Classes</Text>
            <Text style={mainBodyStyles.statSubtitle}>2 actives</Text>
          </View>
          {/* Establishments */}
          <View
            style={[mainBodyStyles.statCard, mainBodyStyles.establishmentsCard]}
          >
            <View style={mainBodyStyles.statHeader}>
              <FontAwesome5 name="building" size={20} color="#F97316" />
              <Text style={mainBodyStyles.statGrowth}>+5% ce mois</Text>
            </View>
            <Text style={mainBodyStyles.statNumber}>2</Text>
            <Text style={mainBodyStyles.statTitle}>Établissements</Text>
            <Text style={mainBodyStyles.statSubtitle}>1 actif</Text>
          </View>
        </View>
        {/* User Distribution Chart */}
        <View style={mainBodyStyles.chartSection}>
          <Text style={mainBodyStyles.chartTitle}>
            Répartition des Utilisateurs
          </Text>
          <View style={mainBodyStyles.chartContainer}>
            <Text style={mainBodyStyles.chartPlaceholder}>
              Graphique en secteurs sera affiché ici
            </Text>
          </View>
        </View>
        {/* Extra space for bottom navigation */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Floating Action Button for Messages */}
      <TouchableOpacity
        style={mainBodyStyles.floatingButton}
        onPress={handleMessagePress}
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
  updateButton: {
    backgroundColor: "#4F46E5",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  updateButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
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
    alignItems: "flex-start",
    marginBottom: 12,
  },
  statGrowth: {
    fontSize: 12,
    color: "#10B981",
    fontWeight: "500",
  },
  statNumber: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 4,
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
  totalUsersCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#4F46E5",
  },
  teachersCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#10B981",
  },
  classesCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#8B5CF6",
  },
  establishmentsCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#F97316",
  },
  chartSection: {
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
  chartTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 16,
  },
  chartContainer: {
    alignItems: "center",
    justifyContent: "center",
    height: 200,
  },
  chartPlaceholder: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
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
