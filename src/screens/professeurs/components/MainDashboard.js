import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import DashboardHeader from "./DashboardHeader";
import DashboardBottomNav from "./DashboardBottomNav";
import DashboardMainBody from "./DashboardMainBody";
import DashboardMessagesBody from "./messages/DashboardMessagesBody";
import DashboardStatsBody from "./DashboardStatsBody";
import DashboardUsersBody from "./DashboardUsersBody";
import DashboardActivitiesBody from "./DashboardActivitiesBody";
import DashboardCoursBody from "./cours/DashboardCoursBody";
import CreateCoursBody from "./cours/CreateCoursBody";
import DashboardExercisesBody from "./exercise/DashboardExercisesBody";
import DashboardClassesBody from "./classes/DashboardClassesBody";

const MainDashboard = ({ navigation, onLogout }) => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [coursViewMode, setCoursViewMode] = useState("list");
  const [coursData, setCoursData] = useState([]);
  const [showMessages, setShowMessages] = useState(false);

  const handleTabPress = (tabId) => {
    setActiveTab(tabId);
    if (tabId !== "cours") {
      setCoursViewMode("list");
    }
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

  const handleOpenMessages = () => {
    setShowMessages(true);
  };

  const handleBackFromMessages = () => {
    setShowMessages(false);
  };

  const renderBody = () => {
    if (showMessages) {
      return <DashboardMessagesBody onBack={handleBackFromMessages} />;
    }
    switch (activeTab) {
      case "dashboard":
        return <DashboardMainBody onOpenMessages={handleOpenMessages} />;
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
      case "exercises":
        return <DashboardExercisesBody />;
      case "class":
        return <DashboardClassesBody />;
      case "settings":
        return (
          <View style={mainDashboardStyles.placeholderContainer}>
            <Text style={mainDashboardStyles.placeholderText}>
              Paramètres - À venir
            </Text>
          </View>
        );
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
        return <DashboardMainBody onOpenMessages={handleOpenMessages} />;
    }
  };

  return (
    <View style={mainDashboardStyles.container}>
      <DashboardHeader onLogout={onLogout} />
      {renderBody()}
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
