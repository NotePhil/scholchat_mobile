import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useUser } from "../../context/UserContext";
import { notificationService } from "../../services/api";
import { authService } from "../../services/home/authService";
import { useAuthStore } from "../../store/useAuthStore";
import { useLanguageStore } from "../../store/useLanguageStore";
import { useNotificationsStore } from "../../store/useNotificationsStore";
import { useSelectedChildStore } from "../../store/useSelectedChildStore";
import { useThemeStore } from "../../store/useThemeStore";
import { useUiStore } from "../../store/useUiStore";
import { colors, radius, spacing, typography, useThemeColors } from "../../styles/theme";
import { confirmLogout } from "../../utils/confirmLogout";
import RoleSelectorSheet from "./RoleSelectorSheet";
import { BottomSheet } from "../../components/ui";

interface AppHeaderProps {
  roleLabel: string;
  accentColor?: string;
  onLogout: () => void;
  onNavigateToProfile?: () => void;
}

const AppHeader = ({ roleLabel, accentColor = colors.primary, onLogout, onNavigateToProfile }: AppHeaderProps) => {
  const { user } = useUser();
  const navigation = useNavigation<any>();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showRoleSheet, setShowRoleSheet] = useState(false);
  const [showChildSheet, setShowChildSheet] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);

  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const themeMode = useThemeStore((s) => s.mode);
  const toggleThemeMode = useThemeStore((s) => s.toggleMode);
  const loadThemeMode = useThemeStore((s) => s.loadMode);

  const { items: notifications, unreadCount, setItems, setUnreadCount, markReadLocally } = useNotificationsStore();
  const currentRole = useAuthStore((s) => s.role);
  const roles = useAuthStore((s) => s.roles);
  const authUser = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);

  const { currentLanguage, toggleLanguage, loadLanguage } = useLanguageStore();
  const { children, selectedChildId, setSelectedChildId, loadChildren } = useSelectedChildStore();

  const isParent = currentRole === "parent";
  const selectedChild = children.find((c) => c.id === selectedChildId);

  // Available roles from authResponse or token roles
  const availableRoles: string[] = (authUser?.availableRoles as string[]) || (roles.length > 0 ? roles : [currentRole]);

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
    loadLanguage();
    loadThemeMode();
  }, [loadNotifications, loadLanguage, loadThemeMode]);

  useEffect(() => {
    if (isParent && user?.userId) {
      loadChildren(user.userId);
    }
  }, [isParent, user?.userId, loadChildren]);

  const handleRoleSelect = async (selectedRole: string) => {
    setSwitchingRole(true);
    try {
      const switched = await authService.switchRole(selectedRole);
      login(switched);
    } catch (err) {
      Alert.alert("Changement de rôle", err instanceof Error ? err.message : "Échec du changement de rôle.");
    } finally {
      setSwitchingRole(false);
      setShowRoleSheet(false);
    }
  };

  return (
    <>
      {showNotifications && (
        <TouchableWithoutFeedback onPress={() => setShowNotifications(false)}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>
      )}

      <View style={styles.header}>
        <TouchableOpacity style={styles.left} onPress={onNavigateToProfile} activeOpacity={0.7}>
          <View style={[styles.avatar, { backgroundColor: accentColor }]}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.titleWrap}>
            <Text style={styles.appName}>SchoolChat</Text>
            <Text style={styles.role} numberOfLines={1}>{roleLabel}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.right}>
          {/* Multi-role button if user has > 1 role */}
          {availableRoles.length > 1 && (
            <TouchableOpacity
              style={[styles.roleSwitchBtn, { borderColor: accentColor }]}
              onPress={() => setShowRoleSheet(true)}
              activeOpacity={0.7}
            >
              <FontAwesome5 name="sync-alt" size={11} color={accentColor} />
              <Text style={[styles.roleSwitchText, { color: accentColor }]}>Profil</Text>
            </TouchableOpacity>
          )}

          {/* Child Switcher for Parents */}
          {isParent && children.length > 0 && (
            <TouchableOpacity
              style={styles.childSwitchBtn}
              onPress={() => setShowChildSheet(true)}
              activeOpacity={0.7}
            >
              <FontAwesome5 name="child" size={11} color="#9333EA" />
              <Text style={styles.childSwitchText} numberOfLines={1}>
                {selectedChild ? `${selectedChild.prenom ?? "Enfant"}` : "Enfant"}
              </Text>
              <FontAwesome5 name="chevron-down" size={9} color="#9333EA" />
            </TouchableOpacity>
          )}

          {/* Dark mode toggle */}
          <TouchableOpacity
            style={styles.themeBtn}
            onPress={toggleThemeMode}
            activeOpacity={0.7}
          >
            <FontAwesome5
              name={themeMode === "dark" ? "sun" : "moon"}
              size={13}
              color={themeMode === "dark" ? themeColors.warning : themeColors.primary}
            />
          </TouchableOpacity>

          {/* Language Toggle */}
          <TouchableOpacity
            style={styles.langBtn}
            onPress={toggleLanguage}
            activeOpacity={0.7}
          >
            <Text style={styles.langFlag}>{currentLanguage === "fr" ? "🇫🇷" : "🇬🇧"}</Text>
            <Text style={styles.langText}>{currentLanguage.toUpperCase()}</Text>
          </TouchableOpacity>

          {/* Notifications */}
          <TouchableOpacity style={styles.iconButton} onPress={() => setShowNotifications((v) => !v)}>
            <FontAwesome5 name="bell" size={17} color={themeColors.textMuted} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Logout */}
          <TouchableOpacity style={styles.iconButton} onPress={() => confirmLogout(onLogout)}>
            <FontAwesome5 name="sign-out-alt" size={18} color={themeColors.danger} />
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
              notifications.slice(0, 8).map((n) => (
                <TouchableOpacity
                  key={n.id}
                  style={styles.notificationItem}
                  onPress={() => {
                    markReadLocally(n.id);
                    notificationService.markAsRead(n.id).catch(() => {});
                    if (n.type === "MESSAGE_SENT" || n.relatedEntityType === "MESSAGE") {
                      setShowNotifications(false);
                      useUiStore.getState().requestTab("messages");
                    }
                  }}
                >
                  <Text style={[styles.notificationTitle, !n.isRead && { fontWeight: "700" }]}>
                    {n.title ?? "Notification"}
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

      {/* Role Selection Sheet */}
      <RoleSelectorSheet
        visible={showRoleSheet}
        roles={availableRoles}
        currentRole={currentRole}
        onSelect={handleRoleSelect}
        onClose={() => setShowRoleSheet(false)}
        title="Changer de profil"
        subtitle="Choisissez le profil vers lequel vous souhaitez basculer."
      />

      {/* Child Selection Sheet for Parents */}
      {isParent && (
        <BottomSheet
          visible={showChildSheet}
          onClose={() => setShowChildSheet(false)}
          title="Mes enfants"
        >
          <View style={styles.childList}>
            {children.map((c) => {
              const isSelected = c.id === selectedChildId;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.childCard,
                    isSelected && { borderColor: "#9333EA", backgroundColor: "#FAF5FF" },
                  ]}
                  onPress={() => {
                    setSelectedChildId(c.id);
                    setShowChildSheet(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.childAvatar, isSelected && { backgroundColor: "#9333EA" }]}>
                    <Text style={[styles.childAvatarText, isSelected && { color: themeColors.white }]}>
                      {(c.prenom || "?").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.childName}>{c.prenom} {c.nom}</Text>
                    {c.classeNom ? <Text style={styles.childSub}>{c.classeNom}</Text> : null}
                  </View>
                  {isSelected && <FontAwesome5 name="check-circle" size={16} color="#9333EA" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </BottomSheet>
      )}
    </>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: 48,
    paddingBottom: spacing.sm + 2,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 3,
    zIndex: 1001,
  },
  left: { flexDirection: "row", alignItems: "center", flex: 1, marginRight: spacing.xs },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  avatarText: { color: colors.white, fontSize: 15, fontWeight: "700" },
  titleWrap: { flexShrink: 1 },
  appName: { ...typography.h3, fontSize: 16, color: colors.text, fontWeight: '700' },
  role: { ...typography.caption, color: colors.textMuted, fontSize: 11, marginTop: 1 },
  right: { flexDirection: "row", alignItems: "center", gap: 6 },
  roleSwitchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    backgroundColor: colors.background,
  },
  roleSwitchText: { fontSize: 11, fontWeight: "700" },
  childSwitchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "#D8B4FE",
    backgroundColor: "#FAF5FF",
    maxWidth: 90,
  },
  childSwitchText: { fontSize: 11, fontWeight: "700", color: "#9333EA" },
  themeBtn: {
    padding: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
  },
  langBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
  },
  langFlag: { fontSize: 12 },
  langText: { fontSize: 10, fontWeight: "700", color: colors.textMuted },
  iconButton: { padding: 6, position: "relative" },
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
  badgeText: { color: colors.white, fontSize: 9, fontWeight: "700" },
  dropdown: {
    position: "absolute",
    top: 76,
    right: spacing.md,
    left: spacing.md,
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
  notificationTitle: { ...typography.body, color: colors.text, fontSize: 13 },
  notificationMessage: { ...typography.caption, color: colors.textMuted, fontSize: 11 },
  viewAllButton: { paddingTop: spacing.sm, alignItems: "center" },
  viewAllButtonText: { ...typography.caption, color: colors.primary, fontWeight: "700" },
  childList: { gap: spacing.sm, marginBottom: spacing.md },
  childCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  childAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E9D5FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  childAvatarText: { fontSize: 14, fontWeight: "700", color: "#7C3AED" },
  childName: { ...typography.bodyBold, fontSize: 14, color: colors.text },
  childSub: { ...typography.caption, color: colors.textMuted, fontSize: 11 },
});

export default AppHeader;

