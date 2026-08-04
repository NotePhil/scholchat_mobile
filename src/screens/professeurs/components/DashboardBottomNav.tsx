import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface DashboardBottomNavProps {
  activeTab?: string;
  onTabPress: (tabId: string) => void;
}

const DashboardBottomNav = ({ activeTab = "dashboard", onTabPress }: DashboardBottomNavProps) => {
  const insets = useSafeAreaInsets();

  const navItems: Array<{
    id: string;
    icon: React.ComponentProps<typeof FontAwesome5>['name'];
    label: string;
  }> = [
    { id: "activities", icon: "tasks", label: "Activités" },
    { id: "cours", icon: "book-open", label: "Cours" },
    { id: "dashboard", icon: "th-large", label: "Accueil" },
    { id: "exercises", icon: "clipboard-list", label: "Exercices" },
    { id: "class", icon: "door-open", label: "Classes" },
    { id: "settings", icon: "cog", label: "Profil" },
  ];

  const handleTabPress = (tabId: string) => {
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
            size={18}
            color={activeTab === item.id ? "#FFFFFF" : "#9CA3AF"}
          />
          <Text
            style={[
              bottomNavStyles.navLabel,
              activeTab === item.id && bottomNavStyles.activeNavLabel,
            ]}
          >
            {item.label}
          </Text>
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
    alignItems: "center",
    minWidth: 50,
  },
  activeNavItem: {
    backgroundColor: "#4F46E5",
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

export default DashboardBottomNav;
