import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import RoleHeader from "../shared/RoleHeader";
import RoleBottomNav, { RoleNavItem } from "../shared/RoleBottomNav";
import RoleSettingsBody from "../shared/RoleSettingsBody";
import StudentOverviewBody from "./StudentOverviewBody";
import StudentClassesBody from "./StudentClassesBody";
import StudentExercisesBody from "./StudentExercisesBody";
import DashboardMessagesBody from "../professeurs/components/messages/DashboardMessagesBody";
import { colors } from "../../styles/theme";

const NAV_ITEMS: RoleNavItem[] = [
  { id: "dashboard", icon: "th-large", label: "Accueil" },
  { id: "classes", icon: "chalkboard", label: "Classes" },
  { id: "exercises", icon: "clipboard-list", label: "Devoirs" },
  { id: "messages", icon: "envelope", label: "Messages" },
  { id: "settings", icon: "cog", label: "Réglages" },
];

interface StudentDashboardProps {
  onLogout: () => void;
}

const StudentDashboard = ({ onLogout }: StudentDashboardProps) => {
  const [activeTab, setActiveTab] = useState("dashboard");

  const renderBody = () => {
    switch (activeTab) {
      case "dashboard":
        return <StudentOverviewBody />;
      case "classes":
        return <StudentClassesBody />;
      case "exercises":
        return <StudentExercisesBody />;
      case "messages":
        return <DashboardMessagesBody />;
      case "settings":
        return <RoleSettingsBody onLogout={onLogout} roleLabel="Élève" />;
      default:
        return <StudentOverviewBody />;
    }
  };

  return (
    <View style={styles.container}>
      <RoleHeader
        roleLabel="Élève"
        accentColor={colors.info}
        onLogout={onLogout}
        onNavigateToProfile={() => setActiveTab("settings")}
      />
      {renderBody()}
      <RoleBottomNav items={NAV_ITEMS} activeTab={activeTab} onTabPress={setActiveTab} accentColor={colors.info} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
});

export default StudentDashboard;
