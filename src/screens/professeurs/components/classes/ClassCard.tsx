import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { colors, useThemeColors } from "../../../../styles/theme";
import { UIClass } from "./DashboardClassesBody";

interface ClassCardProps {
  classItem: UIClass;
  onViewDetails: (classItem: UIClass) => void;
  onManageClass: (classItem: UIClass) => void;
}

const ClassCard = ({ classItem, onViewDetails, onManageClass }: ClassCardProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isActif = classItem.state === "ACTIVE" || classItem.state === "ACTIF";

  const handleCopyCode = () => {
    if (classItem.codeActivation) {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
        navigator.clipboard.writeText(classItem.codeActivation);
      }
      Alert.alert("Code d'activation", `Code : ${classItem.codeActivation}\n(Ce code permet aux élèves et parents de rejoindre la classe)`);
    }
  };

  return (
    <View style={styles.classCard}>
      <TouchableOpacity activeOpacity={0.7} onPress={() => onManageClass(classItem)}>
        {/* Top Header */}
        <View style={styles.classCardHeader}>
          <View style={styles.classCardLeft}>
            <View style={styles.classCardIcon}>
              <Text style={styles.classCardIconText}>
                {(classItem.name || "CL").substring(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={styles.classCardInfo}>
              <Text style={styles.classCardName} numberOfLines={1}>
                {classItem.name}
              </Text>
              <Text style={styles.classCardLevel}>{classItem.level}</Text>
            </View>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: isActif ? "#D1FAE5" : "#F3F4F6" },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: isActif ? "#059669" : "#6B7280" },
              ]}
            >
              {isActif ? "Active" : "Inactive"}
            </Text>
          </View>
        </View>

        {/* Badges / Indicators */}
        <View style={styles.badgesRow}>
          {classItem.accesMajeur ? (
            <View style={styles.majeureBadge}>
              <FontAwesome5 name="shield-alt" size={10} color="#6D28D9" />
              <Text style={styles.majeureBadgeText}>Classe Majeure</Text>
            </View>
          ) : (
            <View style={styles.standardBadge}>
              <Text style={styles.standardBadgeText}>Accès standard</Text>
            </View>
          )}

          {classItem.codeActivation ? (
            <TouchableOpacity style={styles.codeBadge} onPress={handleCopyCode}>
              <FontAwesome5 name="key" size={10} color="#0284C7" />
              <Text style={styles.codeBadgeText}>{classItem.codeActivation}</Text>
              <FontAwesome5 name="copy" size={10} color="#0284C7" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Metadata: Établissement & Modérateur */}
        <View style={styles.metaRow}>
          {classItem.etablissement && classItem.etablissement !== "Non spécifié" ? (
            <View style={styles.metaItem}>
              <FontAwesome5 name="school" size={11} color="#9CA3AF" />
              <Text style={styles.metaText} numberOfLines={1}>
                {classItem.etablissement}
              </Text>
            </View>
          ) : null}
          {classItem.moderator && classItem.moderator !== "Non spécifié" ? (
            <View style={styles.metaItem}>
              <FontAwesome5 name="user-tie" size={11} color="#9CA3AF" />
              <Text style={styles.metaText} numberOfLines={1}>
                Modérateur : {classItem.moderator}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Stats */}
        <View style={styles.classCardStats}>
          <View style={styles.statItem}>
            <FontAwesome5 name="user-graduate" size={12} color="#6B7280" />
            <Text style={styles.statItemText}>
              {classItem.studentsCount} élèves
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
              {new Date(classItem.creationDate).toLocaleDateString("fr-FR")}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Action Buttons */}
      <View style={styles.classCardActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.viewButton]}
          onPress={() => onViewDetails(classItem)}
        >
          <FontAwesome5 name="eye" size={13} color="#4F46E5" />
          <Text style={styles.viewButtonText}>Détails</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.manageButton]}
          onPress={() => onManageClass(classItem)}
        >
          <FontAwesome5 name="cog" size={13} color="#FFFFFF" />
          <Text style={styles.manageButtonText}>Gérer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  classCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  classCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  classCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  classCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
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
    fontWeight: "700",
    color: "#0F172A",
  },
  classCardLevel: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  majeureBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  majeureBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.text,
  },
  standardBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  standardBadgeText: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
  },
  codeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E0F2FE",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  codeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0369A1",
    fontFamily: "monospace",
  },
  metaRow: {
    gap: 4,
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: "#64748B",
    flex: 1,
  },
  classCardStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  statItemText: {
    fontSize: 12,
    color: "#64748B",
    marginLeft: 5,
  },
  classCardActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  viewButton: {
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  viewButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4338CA",
  },
  manageButton: {
    backgroundColor: "#4F46E5",
  },
  manageButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});

export default ClassCard;
