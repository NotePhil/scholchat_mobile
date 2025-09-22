import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

const ClassCard = ({ classItem, onViewDetails, onManageClass }) => {
  const getStateColor = (state) => {
    return state === "ACTIVE" ? "#10B981" : "#6B7280";
  };

  const getStateBackground = (state) => {
    return state === "ACTIVE" ? "#D1FAE5" : "#F3F4F6";
  };

  const getStateText = (state) => {
    return state === "ACTIVE" ? "Active" : "Inactive";
  };

  return (
    <View style={styles.classCard}>
      <View style={styles.classCardHeader}>
        <View style={styles.classCardLeft}>
          <View style={styles.classCardIcon}>
            <Text style={styles.classCardIconText}>
              {classItem.name.substring(0, 2).toUpperCase()}
            </Text>
          </View>
          <View style={styles.classCardInfo}>
            <Text style={styles.classCardName}>{classItem.name}</Text>
            <Text style={styles.classCardLevel}>{classItem.level}</Text>
          </View>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStateBackground(classItem.state) },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              { color: getStateColor(classItem.state) },
            ]}
          >
            {getStateText(classItem.state)}
          </Text>
        </View>
      </View>
      <View style={styles.classCardStats}>
        <View style={styles.statItem}>
          <FontAwesome5 name="user-graduate" size={12} color="#6B7280" />
          <Text style={styles.statItemText}>
            {classItem.studentsCount} étudiants
          </Text>
        </View>
        <View style={styles.statItem}>
          <FontAwesome5 name="users" size={12} color="#6B7280" />
          <Text style={styles.statItemText}>
            {classItem.parentsCount} parents
          </Text>
        </View>
        <View style={styles.statItem}>
          <FontAwesome5 name="calendar" size={12} color="#6B7280" />
          <Text style={styles.statItemText}>
            Créée le{" "}
            {new Date(classItem.creationDate).toLocaleDateString("fr-FR")}
          </Text>
        </View>
      </View>
      <View style={styles.classCardActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.viewButton]}
          onPress={() => onViewDetails(classItem)}
        >
          <FontAwesome5 name="eye" size={14} color="#4F46E5" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.manageButton]}
          onPress={() => onManageClass(classItem)}
        >
          <FontAwesome5 name="cog" size={14} color="#10B981" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  classCard: {
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
  classCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  classCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  classCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#4F46E5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  classCardIconText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  classCardInfo: {
    flex: 1,
  },
  classCardName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  classCardLevel: {
    fontSize: 14,
    color: "#6B7280",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
  },
  classCardStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingVertical: 8,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  statItemText: {
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 4,
  },
  classCardActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
    borderRadius: 6,
  },
  viewButton: {
    backgroundColor: "#EEF2FF",
  },
  manageButton: {
    backgroundColor: "#D1FAE5",
  },
});

export default ClassCard;
