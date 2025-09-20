import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const DashboardBottomNav = ({ activeTab = "dashboard", onTabPress }) => {
  const insets = useSafeAreaInsets();

  const navItems = [
    { id: "activities", icon: "tasks" }, // Activités
    { id: "cours", icon: "book-open" }, // Cours
    { id: "dashboard", icon: "th-large" }, // Tableau de bord
    { id: "class", icon: "door-open" }, // Class
    { id: "settings", icon: "cog" }, // Paramètres
  ];

  const handleTabPress = (tabId) => {
    if (onTabPress) {
      onTabPress(tabId);
    }
  };

  return (
    <View style={[bottomNavStyles.bottomNav, { paddingBottom: insets.bottom }]}>
      {navItems.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={[
            bottomNavStyles.navItem,
            activeTab === item.id && bottomNavStyles.activeNavItem,
          ]}
          onPress={() => handleTabPress(item.id)}
        >
          <FontAwesome5
            name={item.icon}
            size={20}
            color={activeTab === item.id ? "#FFFFFF" : "#9CA3AF"}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
};

const bottomNavStyles = StyleSheet.create({
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
  },
  activeNavItem: {
    backgroundColor: "#4F46E5",
    borderRadius: 8,
    padding: 12,
  },
});

export default DashboardBottomNav;
