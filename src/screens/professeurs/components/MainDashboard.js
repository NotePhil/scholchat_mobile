import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import DashboardHeader from "./DashboardHeader";
import DashboardBottomNav from "./DashboardBottomNav";
import DashboardMainBody from "./DashboardMainBody";
import DashboardStatsBody from "./DashboardStatsBody";
import DashboardUsersBody from "./DashboardUsersBody";
import DashboardActivitiesBody from "./DashboardActivitiesBody";
import DashboardCoursBody from "./cours/DashboardCoursBody";
import CreateCoursBody from "./cours/CreateCoursBody";

const MainDashboard = ({ navigation, onLogout }) => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [coursViewMode, setCoursViewMode] = useState("list"); // 'list' or 'create'
  const [coursData, setCoursData] = useState([]);

  const handleTabPress = (tabId) => {
    setActiveTab(tabId);
    // Reset cours view mode when switching tabs
    if (tabId !== "cours") {
      setCoursViewMode("list");
    }
    console.log(`Switched to ${tabId} tab`);
  };

  const handleNavigateToCreateCours = () => {
    setCoursViewMode("create");
  };

  const handleBackToCourssList = () => {
    setCoursViewMode("list");
  };

  const handleCreateCours = (newCours) => {
    setCoursData((prev) => [newCours, ...prev]);
    setCoursViewMode("list");
  };

  // Function to render the appropriate body component based on active tab
  const renderBody = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardMainBody />;

      case "activities":
        return <DashboardActivitiesBody />;

      case "cours":
        if (coursViewMode === "create") {
          return (
            <CreateCoursBody
              onBack={handleBackToCourssList}
              onCreateCours={handleCreateCours}
            />
          );
        } else {
          return (
            <DashboardCoursBody
              onNavigateToCreate={handleNavigateToCreateCours}
              onCreateCours={handleCreateCours}
            />
          );
        }

      case "class":
        return (
          <View style={mainDashboardStyles.placeholderContainer}>
            <Text style={mainDashboardStyles.placeholderText}>
              Classes - À venir
            </Text>
          </View>
        );

      case "settings":
        return (
          <View style={mainDashboardStyles.placeholderContainer}>
            <Text style={mainDashboardStyles.placeholderText}>
              Paramètres - À venir
            </Text>
          </View>
        );

      // Keep the old tabs for backward compatibility
      case "stats":
        return <DashboardStatsBody />;

      case "users":
        return <DashboardUsersBody />;

      case "trophy":
        return (
          <View style={mainDashboardStyles.placeholderContainer}>
            <Text style={mainDashboardStyles.placeholderText}>
              Trophées et Récompenses - À venir
            </Text>
          </View>
        );

      default:
        return <DashboardMainBody />;
    }
  };

  return (
    <View style={mainDashboardStyles.container}>
      {/* Header - Always visible */}
      <DashboardHeader onLogout={onLogout} />

      {/* Dynamic Body Content */}
      {renderBody()}

      {/* Bottom Navigation - Always visible */}
      <DashboardBottomNav activeTab={activeTab} onTabPress={handleTabPress} />
    </View>
  );
};

const mainDashboardStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
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
  },
});

export default MainDashboard;
