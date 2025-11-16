import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import AdminHeader from "./AdminHeader";
import AdminBottomNav from "./AdminBottomNav";

const AdminDashboard = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState("dashboard");

  const handleTabPress = (tabId) => {
    setActiveTab(tabId);
  };

  const handleNavigateToProfile = () => {
    setActiveTab("settings");
  };

  const renderBody = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardMainBody />;
      case "users":
        return <UsersManagementBody />;
      case "schools":
        return <SchoolsManagementBody />;
      case "reports":
        return <ReportsBody />;
      case "settings":
        return <AdminSettingsBody onLogout={onLogout} />;
      default:
        return <DashboardMainBody />;
    }
  };

  return (
    <View style={styles.container}>
      <AdminHeader onLogout={onLogout} onNavigateToProfile={handleNavigateToProfile} />
      {renderBody()}
      <AdminBottomNav activeTab={activeTab} onTabPress={handleTabPress} />
    </View>
  );
};

const DashboardMainBody = () => {
  return (
    <ScrollView style={styles.content}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Tableau de bord Admin</Text>
        <Text style={styles.pageSubtitle}>
          Gérez votre plateforme éducative
        </Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={[styles.statCard, styles.usersCard]}>
          <View style={styles.statHeader}>
            <FontAwesome5 name="users" size={20} color="#DC2626" />
            <Text style={styles.statNumber}>1,247</Text>
          </View>
          <Text style={styles.statTitle}>Utilisateurs</Text>
          <Text style={styles.statSubtitle}>+12% ce mois</Text>
        </View>

        <View style={[styles.statCard, styles.schoolsCard]}>
          <View style={styles.statHeader}>
            <FontAwesome5 name="school" size={20} color="#059669" />
            <Text style={styles.statNumber}>45</Text>
          </View>
          <Text style={styles.statTitle}>Écoles</Text>
          <Text style={styles.statSubtitle}>3 nouvelles</Text>
        </View>

        <View style={[styles.statCard, styles.coursesCard]}>
          <View style={styles.statHeader}>
            <FontAwesome5 name="book" size={20} color="#7C3AED" />
            <Text style={styles.statNumber}>892</Text>
          </View>
          <Text style={styles.statTitle}>Cours</Text>
          <Text style={styles.statSubtitle}>156 actifs</Text>
        </View>

        <View style={[styles.statCard, styles.reportsCard]}>
          <View style={styles.statHeader}>
            <FontAwesome5 name="chart-bar" size={20} color="#EA580C" />
            <Text style={styles.statNumber}>23</Text>
          </View>
          <Text style={styles.statTitle}>Rapports</Text>
          <Text style={styles.statSubtitle}>5 en attente</Text>
        </View>
      </View>

      <View style={styles.recentActivity}>
        <Text style={styles.sectionTitle}>Activité récente</Text>
        <View style={styles.activityList}>
          <View style={styles.activityItem}>
            <View style={styles.activityIcon}>
              <FontAwesome5 name="user-plus" size={14} color="#059669" />
            </View>
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>Nouvel utilisateur inscrit</Text>
              <Text style={styles.activityTime}>Il y a 5 minutes</Text>
            </View>
          </View>

          <View style={styles.activityItem}>
            <View style={styles.activityIcon}>
              <FontAwesome5 name="school" size={14} color="#7C3AED" />
            </View>
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>École ajoutée au système</Text>
              <Text style={styles.activityTime}>Il y a 2 heures</Text>
            </View>
          </View>

          <View style={styles.activityItem}>
            <View style={styles.activityIcon}>
              <FontAwesome5 name="exclamation-triangle" size={14} color="#EA580C" />
            </View>
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>Rapport de sécurité généré</Text>
              <Text style={styles.activityTime}>Il y a 4 heures</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

const UsersManagementBody = () => (
  <View style={styles.placeholderContainer}>
    <FontAwesome5 name="users" size={48} color="#D1D5DB" />
    <Text style={styles.placeholderText}>Gestion des utilisateurs - À venir</Text>
  </View>
);

const SchoolsManagementBody = () => (
  <View style={styles.placeholderContainer}>
    <FontAwesome5 name="school" size={48} color="#D1D5DB" />
    <Text style={styles.placeholderText}>Gestion des écoles - À venir</Text>
  </View>
);

const ReportsBody = () => (
  <View style={styles.placeholderContainer}>
    <FontAwesome5 name="chart-bar" size={48} color="#D1D5DB" />
    <Text style={styles.placeholderText}>Rapports et analyses - À venir</Text>
  </View>
);

const AdminSettingsBody = ({ onLogout }) => (
  <View style={styles.placeholderContainer}>
    <FontAwesome5 name="cog" size={48} color="#D1D5DB" />
    <Text style={styles.placeholderText}>Paramètres admin - À venir</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
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
  usersCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#DC2626",
  },
  schoolsCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#059669",
  },
  coursesCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#7C3AED",
  },
  reportsCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#EA580C",
  },
  recentActivity: {
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
  activityList: {
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
    backgroundColor: "#F3F4F6",
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
  placeholderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  placeholderText: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 16,
  },
});

export default AdminDashboard;