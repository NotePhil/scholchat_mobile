import React, { useState } from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

const DashboardUsersBody = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  const users = [
    {
      id: 1,
      name: "Marie Dupont",
      role: "Professeur",
      status: "active",
      email: "marie.dupont@school.com",
    },
    {
      id: 2,
      name: "Jean Martin",
      role: "Élève",
      status: "active",
      email: "jean.martin@student.com",
    },
    {
      id: 3,
      name: "Sophie Bernard",
      role: "Parent",
      status: "inactive",
      email: "sophie.bernard@parent.com",
    },
    {
      id: 4,
      name: "Pierre Durand",
      role: "Professeur",
      status: "active",
      email: "pierre.durand@school.com",
    },
    {
      id: 5,
      name: "Emma Leblanc",
      role: "Élève",
      status: "active",
      email: "emma.leblanc@student.com",
    },
  ];

  const filters = [
    { id: "all", label: "Tous", count: users.length },
    {
      id: "professeur",
      label: "Professeurs",
      count: users.filter((u) => u.role === "Professeur").length,
    },
    {
      id: "eleve",
      label: "Élèves",
      count: users.filter((u) => u.role === "Élève").length,
    },
    {
      id: "parent",
      label: "Parents",
      count: users.filter((u) => u.role === "Parent").length,
    },
  ];

  const getRoleIcon = (role) => {
    switch (role) {
      case "Professeur":
        return "chalkboard-teacher";
      case "Élève":
        return "graduation-cap";
      case "Parent":
        return "user-friends";
      default:
        return "user";
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case "Professeur":
        return "#10B981";
      case "Élève":
        return "#3B82F6";
      case "Parent":
        return "#F59E0B";
      default:
        return "#6B7280";
    }
  };

  return (
    <ScrollView style={usersBodyStyles.content}>
      <View style={usersBodyStyles.pageHeader}>
        <Text style={usersBodyStyles.pageTitle}>Gestion des Utilisateurs</Text>
        <TouchableOpacity style={usersBodyStyles.addButton}>
          <FontAwesome5 name="plus" size={16} color="#FFFFFF" />
          <Text style={usersBodyStyles.addButtonText}>Ajouter</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={usersBodyStyles.searchContainer}>
        <FontAwesome5
          name="search"
          size={16}
          color="#6B7280"
          style={usersBodyStyles.searchIcon}
        />
        <TextInput
          style={usersBodyStyles.searchInput}
          placeholder="Rechercher un utilisateur..."
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholderTextColor="#9CA3AF"
        />
      </View>

      {/* Filter Tabs */}
      <View style={usersBodyStyles.filterContainer}>
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter.id}
            style={[
              usersBodyStyles.filterTab,
              activeFilter === filter.id && usersBodyStyles.activeFilterTab,
            ]}
            onPress={() => setActiveFilter(filter.id)}
          >
            <Text
              style={[
                usersBodyStyles.filterTabText,
                activeFilter === filter.id &&
                  usersBodyStyles.activeFilterTabText,
              ]}
            >
              {filter.label} ({filter.count})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Users List */}
      <View style={usersBodyStyles.usersList}>
        {users.map((user) => (
          <View key={user.id} style={usersBodyStyles.userCard}>
            <View style={usersBodyStyles.userInfo}>
              <View
                style={[
                  usersBodyStyles.userAvatar,
                  { backgroundColor: getRoleColor(user.role) + "20" },
                ]}
              >
                <FontAwesome5
                  name={getRoleIcon(user.role)}
                  size={20}
                  color={getRoleColor(user.role)}
                />
              </View>
              <View style={usersBodyStyles.userDetails}>
                <Text style={usersBodyStyles.userName}>{user.name}</Text>
                <Text style={usersBodyStyles.userEmail}>{user.email}</Text>
                <View style={usersBodyStyles.userMeta}>
                  <Text
                    style={[
                      usersBodyStyles.userRole,
                      { color: getRoleColor(user.role) },
                    ]}
                  >
                    {user.role}
                  </Text>
                  <View
                    style={[
                      usersBodyStyles.statusBadge,
                      user.status === "active"
                        ? usersBodyStyles.activeBadge
                        : usersBodyStyles.inactiveBadge,
                    ]}
                  >
                    <Text
                      style={[
                        usersBodyStyles.statusText,
                        user.status === "active"
                          ? usersBodyStyles.activeText
                          : usersBodyStyles.inactiveText,
                      ]}
                    >
                      {user.status === "active" ? "Actif" : "Inactif"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
            <View style={usersBodyStyles.userActions}>
              <TouchableOpacity style={usersBodyStyles.actionButton}>
                <FontAwesome5 name="edit" size={16} color="#6B7280" />
              </TouchableOpacity>
              <TouchableOpacity style={usersBodyStyles.actionButton}>
                <FontAwesome5 name="trash" size={16} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      {/* Extra space for bottom navigation */}
      <View style={{ height: 80 }} />
    </ScrollView>
  );
};

const usersBodyStyles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  pageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4F46E5",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#111827",
  },
  filterContainer: {
    flexDirection: "row",
    marginBottom: 20,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: "#F3F4F6",
  },
  activeFilterTab: {
    backgroundColor: "#4F46E5",
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
  },
  activeFilterTabText: {
    color: "#FFFFFF",
  },
  usersList: {
    marginBottom: 20,
  },
  userCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 8,
  },
  userMeta: {
    flexDirection: "row",
    alignItems: "center",
  },
  userRole: {
    fontSize: 12,
    fontWeight: "500",
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  activeBadge: {
    backgroundColor: "#D1FAE5",
  },
  inactiveBadge: {
    backgroundColor: "#FEE2E2",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
  },
  activeText: {
    color: "#065F46",
  },
  inactiveText: {
    color: "#991B1B",
  },
  userActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
});

export default DashboardUsersBody;
