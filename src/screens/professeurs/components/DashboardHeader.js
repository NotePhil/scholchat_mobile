import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

const DashboardHeader = ({ onLogout }) => {
  return (
    <View style={headerStyles.header}>
      <View style={headerStyles.headerLeft}>
        <View style={headerStyles.userAvatarContainer}>
          <Text style={headerStyles.userInitial}>P</Text>
        </View>
        <View style={headerStyles.headerInfo}>
          <Text style={headerStyles.appName}>SchoolChat</Text>
          <Text style={headerStyles.userRole}>Professeur</Text>
        </View>
      </View>
      <View style={headerStyles.headerRight}>
        <TouchableOpacity style={headerStyles.notificationButton}>
          <FontAwesome5 name="bell" size={18} color="#6B7280" />
          <View style={headerStyles.notificationBadge}>
            <Text style={headerStyles.notificationText}>3</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={headerStyles.logoutButton} onPress={onLogout}>
          <FontAwesome5 name="sign-out-alt" size={18} color="#6B7280" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const headerStyles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingTop: 50, // Account for status bar
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#4F46E5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  logoText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  userAvatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EC4899",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  userInitial: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  headerInfo: {
    flexDirection: "column",
  },
  appName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  userRole: {
    fontSize: 12,
    color: "#6B7280",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  notificationButton: {
    position: "relative",
    marginRight: 16,
    padding: 8,
  },
  notificationBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "#EF4444",
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  notificationText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
  },
  profileContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EC4899",
    justifyContent: "center",
    alignItems: "center",
  },
  profileAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EC4899",
    justifyContent: "center",
    alignItems: "center",
  },
  profileInitial: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  logoutButton: {
    padding: 8,
    marginLeft: 8,
  },
});

export default DashboardHeader;
