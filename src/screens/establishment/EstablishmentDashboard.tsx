import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import RoleHeader from "../shared/RoleHeader";
import RoleBottomNav, { RoleNavItem } from "../shared/RoleBottomNav";
import RoleSettingsBody from "../shared/RoleSettingsBody";
import EstablishmentOverviewBody from "./EstablishmentOverviewBody";
import EstablishmentListBody from "./EstablishmentListBody";
import DashboardMessagesBody from "../professeurs/components/messages/DashboardMessagesBody";
import { colors } from "../../styles/theme";

const NAV_ITEMS: RoleNavItem[] = [
  { id: "dashboard", icon: "th-large", label: "Accueil" },
  { id: "establishments", icon: "school", label: "Établissements" },
  { id: "messages", icon: "envelope", label: "Messages" },
  { id: "settings", icon: "cog", label: "Réglages" },
];

interface EstablishmentDashboardProps {
  onLogout: () => void;
  roleLabel?: string;
}

/** Shared shell for both "establishment" and "gestionnaire" roles — same data, same actions. */
const EstablishmentDashboard = ({ onLogout, roleLabel = "Gestionnaire" }: EstablishmentDashboardProps) => {
  const [activeTab, setActiveTab] = useState("dashboard");

  const renderBody = () => {
    switch (activeTab) {
      case "dashboard":
        return <EstablishmentOverviewBody />;
      case "establishments":
        return <EstablishmentListBody />;
      case "messages":
        return <DashboardMessagesBody />;
      case "settings":
        return <RoleSettingsBody onLogout={onLogout} roleLabel={roleLabel} />;
      default:
        return <EstablishmentOverviewBody />;
    }
  };

  return (
    <View style={styles.container}>
      <RoleHeader
        roleLabel={roleLabel}
        accentColor={colors.success}
        onLogout={onLogout}
        onNavigateToProfile={() => setActiveTab("settings")}
      />
      {renderBody()}
      <RoleBottomNav items={NAV_ITEMS} activeTab={activeTab} onTabPress={setActiveTab} accentColor={colors.success} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
});

export default EstablishmentDashboard;
