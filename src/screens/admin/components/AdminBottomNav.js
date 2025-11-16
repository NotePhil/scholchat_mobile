import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const AdminBottomNav = ({ activeTab = "dashboard", onTabPress }) => {
  const insets = useSafeAreaInsets();

  const navItems = [
    { id: "users", icon: "users", label: "Utilisateurs" },
    { id: "schools", icon: "school", label: "Écoles" },
    { id: "dashboard", icon: "th-large", label: "Accueil" },
    { id: "reports", icon: "chart-bar", label: "Rapports" },
    { id: "settings", icon: "cog", label: "Paramètres" },
  ];

  const handleTabPress = (tabId) => {
    if (onTabPress) {
      onTabPress(tabId);
    }
  };

  return (
    <View style={[styles.bottomNav, { paddingBottom: insets.bottom }]}>
      {navItems.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={[
            styles.navItem,
            activeTab === item.id && styles.activeNavItem,
          ]}
          onPress={() => handleTabPress(item.id)}
        >
          <FontAwesome5
            name={item.icon}
            size={18}
            color={activeTab === item.id ? "#FFFFFF" : "#9CA3AF"}
          />
          <Text
            style={[
              styles.navLabel,
              activeTab === item.id && styles.activeNavLabel,
            ]}
          >
            {item.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  bottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  navItem: {
    padding: 8,
    alignItems: "center",
    minWidth: 50,
  },
  activeNavItem: {
    backgroundColor: "#DC2626",
    borderRadius: 8,
    padding: 8,
  },
  navLabel: {
    fontSize: 10,
    color: "#9CA3AF",
    marginTop: 2,
    textAlign: "center",
  },
  activeNavLabel: {
    color: "#FFFFFF",
  },
});

export default AdminBottomNav;