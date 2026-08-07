import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import RoleHeader from "../shared/RoleHeader";
import RoleBottomNav, { RoleNavItem } from "../shared/RoleBottomNav";
import RoleSettingsBody from "../shared/RoleSettingsBody";
import ParentOverviewBody from "./ParentOverviewBody";
import ParentChildrenBody from "./ParentChildrenBody";
import ParentClassesBody from "./ParentClassesBody";
import ParentCoursesBody from "./ParentCoursesBody";
import DashboardMessagesBody from "../professeurs/components/messages/DashboardMessagesBody";
import { colors } from "../../styles/theme";

const NAV_ITEMS: RoleNavItem[] = [
  { id: "dashboard", icon: "th-large", label: "Accueil" },
  { id: "children", icon: "child", label: "Enfants" },
  { id: "classes", icon: "chalkboard", label: "Classes" },
  { id: "courses", icon: "calendar-alt", label: "Cours" },
  { id: "messages", icon: "envelope", label: "Messages" },
  { id: "settings", icon: "cog", label: "Réglages" },
];

interface ParentDashboardProps {
  onLogout: () => void;
}

const ParentDashboard = ({ onLogout }: ParentDashboardProps) => {
  const [activeTab, setActiveTab] = useState("dashboard");

  const renderBody = () => {
    switch (activeTab) {
      case "dashboard":
        return <ParentOverviewBody />;
      case "children":
        return <ParentChildrenBody />;
      case "classes":
        return <ParentClassesBody />;
      case "courses":
        return <ParentCoursesBody />;
      case "messages":
        return <DashboardMessagesBody />;
      case "settings":
        return <RoleSettingsBody onLogout={onLogout} roleLabel="Parent" />;
      default:
        return <ParentOverviewBody />;
    }
  };

  return (
    <View style={styles.container}>
      <RoleHeader
        roleLabel="Parent"
        accentColor={colors.warning}
        onLogout={onLogout}
        onNavigateToProfile={() => setActiveTab("settings")}
      />
      {renderBody()}
      <RoleBottomNav items={NAV_ITEMS} activeTab={activeTab} onTabPress={setActiveTab} accentColor={colors.warning} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
});

export default ParentDashboard;
