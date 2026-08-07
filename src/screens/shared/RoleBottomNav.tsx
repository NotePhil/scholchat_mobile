import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../styles/theme";

export interface RoleNavItem {
  id: string;
  icon: React.ComponentProps<typeof FontAwesome5>["name"];
  label: string;
}

interface RoleBottomNavProps {
  items: RoleNavItem[];
  activeTab: string;
  onTabPress: (tabId: string) => void;
  accentColor?: string;
}

/** Shared bottom tab bar reused across Parent/Student/Establishment dashboards. */
const RoleBottomNav = ({ items, activeTab, onTabPress, accentColor = colors.primary }: RoleBottomNavProps) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bottomNav, { paddingBottom: insets.bottom }]}>
      {items.map((item) => (
        <TouchableOpacity key={item.id} style={styles.navItem} onPress={() => onTabPress(item.id)}>
          <View style={[styles.iconWrap, activeTab === item.id && { backgroundColor: accentColor }]}>
            <FontAwesome5 name={item.icon} size={16} color={activeTab === item.id ? colors.white : colors.gray} />
          </View>
          <Text style={[styles.label, activeTab === item.id && { color: accentColor, fontWeight: "700" }]}>
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
    backgroundColor: colors.surface,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  navItem: { alignItems: "center", minWidth: 56, paddingBottom: 4 },
  iconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 10, color: colors.gray, marginTop: 2 },
});

export default RoleBottomNav;
