import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useThemeStore } from "../../../../store/useThemeStore";
import { UIClass } from "./DashboardClassesBody";

interface ClassCardProps {
  classItem: UIClass;
  /** Pending (EN_ATTENTE) access requests — web's "{n} NEW" pulse badge. */
  pendingRequestsCount: number;
  /** Count of accessible cours-programmés targeting this class. */
  programmationsCount: number;
  onManageClass: (classItem: UIClass) => void;
  onMore: (classItem: UIClass) => void;
}

/**
 * Phone-width class card — mirrors ClassesContentMobile's card in
 * scholchat_front's ClassesContent.jsx: graduation-cap tile + name/subtitle,
 * a 2-column Élèves / Cours programmés stat grid, the establishment row, and
 * the "ENTRER DANS LA CLASSE" button with the trailing ellipsis button.
 */
const ClassCard = ({ classItem, pendingRequestsCount, programmationsCount, onManageClass, onMore }: ClassCardProps) => {
  const isDark = useThemeStore((s) => s.mode === "dark");
  const styles = useMemo(() => createStyles(isDark), [isDark]);
  const subtitle = classItem.matiere || classItem.level;
  const hasEtablissement = !!classItem.etablissementDetails?.nom;

  return (
    <View style={styles.card}>
      {pendingRequestsCount > 0 ? (
        <View style={styles.newBadge}>
          <Text style={styles.newBadgeText}>{pendingRequestsCount} NOUV.</Text>
        </View>
      ) : null}

      <View style={styles.headerRow}>
        <View style={styles.iconTile}>
          <FontAwesome5 name="graduation-cap" size={22} color="#2563EB" />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.name} numberOfLines={2}>
            {classItem.name}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statTile}>
          <FontAwesome5 name="users" size={14} color="#3B82F6" />
          <View style={styles.statTextWrap}>
            <Text style={styles.statLabel}>Élèves</Text>
            <Text style={styles.statValue}>{classItem.studentsCount || 0}</Text>
          </View>
        </View>
        <View style={styles.statTile}>
          <FontAwesome5 name="book-open" size={14} color="#3B82F6" />
          <View style={styles.statTextWrap}>
            <Text style={styles.statLabel} numberOfLines={1}>
              Cours programmés
            </Text>
            <Text style={styles.statValue}>{programmationsCount || 0}</Text>
          </View>
        </View>
      </View>

      {hasEtablissement ? (
        <View style={styles.etabRow}>
          <FontAwesome5 name="building" size={14} color="#9CA3AF" />
          <Text style={styles.etabText} numberOfLines={1}>
            {classItem.etablissementDetails?.nom}
          </Text>
        </View>
      ) : null}

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.enterBtn} onPress={() => onManageClass(classItem)} activeOpacity={0.85}>
          <FontAwesome5 name="sign-in-alt" size={16} color="#FFFFFF" />
          <Text style={styles.enterText}>ENTRER DANS LA CLASSE</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.moreBtn}
          onPress={() => onMore(classItem)}
          activeOpacity={0.85}
          accessibilityLabel="Plus d'options"
        >
          <FontAwesome5 name="ellipsis-v" size={16} color={isDark ? "#D1D5DB" : "#4B5563"} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (isDark: boolean) => {
  const card = isDark ? "#1E293B" : "#FFFFFF"; // slate-800 / white
  const border = isDark ? "rgba(255,255,255,0.05)" : "#F3F4F6"; // white/5 / gray-100
  const tile = isDark ? "rgba(15,23,42,0.5)" : "#F9FAFB"; // slate-900/50 / gray-50
  const title = isDark ? "#FFFFFF" : "#111827";
  const muted = "#9CA3AF"; // gray-400

  return StyleSheet.create({
    card: {
      backgroundColor: card,
      padding: 20,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: border,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: isDark ? 0.3 : 0.08,
      shadowRadius: 14,
      elevation: 4,
    },
    newBadge: {
      position: "absolute",
      top: 16,
      right: 16,
      backgroundColor: "#EF4444",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      zIndex: 2,
    },
    newBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
    headerRow: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 20, paddingRight: 64 },
    iconTile: {
      padding: 16,
      backgroundColor: isDark ? "rgba(51,65,85,0.5)" : "#F9FAFB", // slate-700/50 / gray-50
      borderRadius: 24,
      borderWidth: 1,
      borderColor: "rgba(59,130,246,0.1)",
    },
    headerText: { flex: 1, minWidth: 0 },
    name: { fontSize: 18, fontWeight: "900", color: title, lineHeight: 22 },
    subtitle: {
      fontSize: 10,
      fontWeight: "700",
      color: muted,
      textTransform: "uppercase",
      letterSpacing: 1.5,
      marginTop: 2,
    },
    statsGrid: { flexDirection: "row", gap: 12, marginBottom: 24 },
    statTile: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: tile,
      padding: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: border,
    },
    statTextWrap: { flex: 1, minWidth: 0 },
    statLabel: { fontSize: 8, fontWeight: "900", color: muted, textTransform: "uppercase" },
    statValue: { fontSize: 12, fontWeight: "700", color: title },
    etabRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: tile,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: border,
      marginBottom: 24,
    },
    etabText: { flex: 1, fontSize: 10, fontWeight: "700", color: "#6B7280" },
    actionsRow: { flexDirection: "row", gap: 8 },
    enterBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 16,
      backgroundColor: "#2563EB",
      borderRadius: 16,
      shadowColor: "#3B82F6",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 3,
    },
    enterText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
    moreBtn: {
      padding: 16,
      minWidth: 50,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDark ? "#334155" : "#F3F4F6", // slate-700 / gray-100
      borderRadius: 16,
    },
  });
};

export default ClassCard;
