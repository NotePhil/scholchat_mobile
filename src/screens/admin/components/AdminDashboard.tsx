import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import AdminHeader from "./AdminHeader";
import AdminBottomNav from "./AdminBottomNav";
import AdminDashboardBody from "./AdminDashboardBody";
import AdminUsersBody from "./AdminUsersBody";
import AdminClassesBody from "./AdminClassesBody";
import AdminSchoolsBody from "./AdminSchoolsBody";
import AdminSettingsBody from "./AdminSettingsBody";

interface AdminDashboardProps {
  onLogout: () => void;
}

const AdminDashboard = ({ onLogout }: AdminDashboardProps) => {
  const [activeTab, setActiveTab] = useState("dashboard");

  const handleNavigateToProfile = () => {
    setActiveTab("settings");
  };

  const renderBody = () => {
    switch (activeTab) {
      case "dashboard":
        return <AdminDashboardBody />;
      case "users":
        return <AdminUsersBody />;
      case "classes":
        return <AdminClassesBody />;
      case "schools":
        return <AdminSchoolsBody />;
      case "settings":
        return <AdminSettingsBody onLogout={onLogout} />;
      default:
        return <AdminDashboardBody />;
    }
  };

  return (
    <View style={styles.container}>
      <AdminHeader onLogout={onLogout} onNavigateToProfile={handleNavigateToProfile} />
      {renderBody()}
      <AdminBottomNav activeTab={activeTab} onTabPress={setActiveTab} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
});

export default AdminDashboard;
