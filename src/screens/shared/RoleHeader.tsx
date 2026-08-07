import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, TouchableWithoutFeedback } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useUser } from "../../context/UserContext";
import { notificationService } from "../../services/api";
import { useNotificationsStore } from "../../store/useNotificationsStore";
import { colors, spacing, typography } from "../../styles/theme";

interface RoleHeaderProps {
  roleLabel: string;
  accentColor?: string;
  onLogout: () => void;
  onNavigateToProfile?: () => void;
}

/** Shared header (avatar + app name/role + notifications bell + logout) reused across Parent/Student/Establishment dashboards. */
const RoleHeader = ({ roleLabel, accentColor = colors.primary, onLogout, onNavigateToProfile }: RoleHeaderProps) => {
  const { user } = useUser();
  const navigation = useNavigation<any>();
  const [showNotifications, setShowNotifications] = useState(false);
  const { items: notifications, unreadCount, setItems, setUnreadCount, markReadLocally } = useNotificationsStore();

  const name = user?.username || `${user?.prenom ?? ""} ${user?.nom ?? ""}`.trim() || roleLabel;
  const initial = name.charAt(0).toUpperCase();

  const loadNotifications = useCallback(async () => {
    try {
      const [list, count] = await Promise.all([
        notificationService.getAll(),
        notificationService.getUnreadCount(),
      ]);
      setItems(list);
      setUnreadCount(count);
    } catch {
      // best-effort
    }
  }, [setItems, setUnreadCount]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  return (
    <>
      {showNotifications && (
        <TouchableWithoutFeedback onPress={() => setShowNotifications(false)}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>
      )}
      <View style={styles.header}>
        <TouchableOpacity style={styles.left} onPress={onNavigateToProfile}>
          <View style={[styles.avatar, { backgroundColor: accentColor }]}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View>
            <Text style={styles.appName}>SchoolChat</Text>
            <Text style={styles.role}>{roleLabel}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.right}>
          <TouchableOpacity style={styles.iconButton} onPress={() => setShowNotifications((v) => !v)}>
            <FontAwesome5 name="bell" size={18} color={colors.textMuted} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={onLogout}>
            <FontAwesome5 name="sign-out-alt" size={20} color={colors.danger} />
          </TouchableOpacity>
        </View>

        {showNotifications && (
          <View style={styles.dropdown}>
            <View style={styles.dropdownHeader}>
              <Text style={styles.dropdownTitle}>Notifications</Text>
            </View>
            {notifications.length === 0 ? (
              <Text style={styles.emptyText}>Aucune notification</Text>
            ) : (
              notifications.slice(0, 10).map((n) => (
                <TouchableOpacity
                  key={n.id}
                  style={styles.notificationItem}
                  onPress={() => {
                    markReadLocally(n.id);
                    notificationService.markAsRead(n.id).catch(() => {});
                  }}
                >
                  <Text style={[styles.notificationTitle, !n.lu && { fontWeight: "700" }]}>
                    {n.titre ?? "Notification"}
                  </Text>
                  <Text style={styles.notificationMessage} numberOfLines={2}>
                    {n.message}
                  </Text>
                </TouchableOpacity>
              ))
            )}
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => {
                setShowNotifications(false);
                navigation.navigate("Notifications");
              }}
            >
              <Text style={styles.viewAllButtonText}>Voir toutes les notifications</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: 50,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    zIndex: 1001,
  },
  left: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginRight: spacing.md },
  avatarText: { color: colors.white, fontSize: 18, fontWeight: "700" },
  appName: { ...typography.h3, color: colors.text },
  role: { ...typography.caption, color: colors.textMuted },
  right: { flexDirection: "row", alignItems: "center" },
  iconButton: { padding: spacing.sm, marginLeft: spacing.xs },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: colors.danger,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: "700" },
  dropdown: {
    position: "absolute",
    top: 76,
    right: spacing.lg,
    left: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1002,
    maxHeight: 320,
  },
  dropdownHeader: { marginBottom: spacing.sm },
  dropdownTitle: { ...typography.h3, color: colors.text },
  emptyText: { ...typography.body, color: colors.textMuted, paddingVertical: spacing.md },
  notificationItem: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  notificationTitle: { ...typography.body, color: colors.text },
  notificationMessage: { ...typography.caption, color: colors.textMuted },
  viewAllButton: { paddingTop: spacing.sm, alignItems: "center" },
  viewAllButtonText: { ...typography.caption, color: colors.primary, fontWeight: "700" },
});

export default RoleHeader;
