import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useUser } from "../../context/UserContext";
import { notificationService } from "../../services/api";
import { useAuthStore } from "../../store/useAuthStore";
import { useNotificationsStore } from "../../store/useNotificationsStore";
import { useSelectedChildStore } from "../../store/useSelectedChildStore";
import { useThemeStore } from "../../store/useThemeStore";
import { useUiStore } from "../../store/useUiStore";
import { useNotificationsRealtime } from "../../hooks/useNotificationsRealtime";
import { useMessagesRealtime } from "../../hooks/useMessagesRealtime";
import { formatNotificationDate, getNotificationClassTarget, getNotificationIcon, getNotificationTargetTab } from "../../services/notificationRouting";
import type { NotificationItem } from "../../store/useNotificationsStore";
import { colors, radius, spacing, typography, useThemeColors } from "../../styles/theme";
import { confirmLogout } from "../../utils/confirmLogout";
import RoleSwitchSheet from "./RoleSwitchSheet";
import AddRoleSheet from "./AddRoleSheet";
import { useAddableRoles } from "../../utils/roleRules";
import { BottomSheet } from "../../components/ui";
import LanguageSwitch from "../../components/common/LanguageSwitch";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useT } from "../../i18n";
import { HelpButton, HelpTarget } from "./HelpSheet";
import { handleRoleNotification } from "../../services/roleNotifications";

interface AppHeaderProps {
  roleLabel: string;
  accentColor?: string;
  onLogout: () => void;
  onNavigateToProfile?: () => void;
  /** Guidelines of the current screen ("?" button, top-right) — null hides it. */
  helpTarget?: HelpTarget | null;
}

const AppHeader = ({ roleLabel, accentColor = colors.primary, onLogout, onNavigateToProfile, helpTarget = null }: AppHeaderProps) => {
  const { user } = useUser();
  const navigation = useNavigation<any>();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showRoleSheet, setShowRoleSheet] = useState(false);
  const [showChildSheet, setShowChildSheet] = useState(false);
  const [showAddRoleSheet, setShowAddRoleSheet] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const insets = useSafeAreaInsets();
  const { t } = useT();

  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const themeMode = useThemeStore((s) => s.mode);
  const toggleThemeMode = useThemeStore((s) => s.toggleMode);
  const loadThemeMode = useThemeStore((s) => s.loadMode);

  const notifications = useNotificationsStore((s) => s.items);
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const markReadLocally = useNotificationsStore((s) => s.markReadLocally);
  const markAllReadLocally = useNotificationsStore((s) => s.markAllReadLocally);
  const currentRole = useAuthStore((s) => s.role);
  const roles = useAuthStore((s) => s.roles);
  const authUser = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);

  const { children, selectedChildId, setSelectedChildId, loadChildren } = useSelectedChildStore();

  const isParent = currentRole === "parent";
  const selectedChild = children.find((c) => c.id === selectedChildId);

  // Available roles from authResponse or token roles (+ roles awaiting validation, shown greyed out)
  const availableRoles: string[] = (authUser?.availableRoles as string[]) || (roles.length > 0 ? roles : [currentRole]);
  const pendingRoles: string[] = (authUser?.pendingRoles as string[] | null | undefined) ?? [];
  // "Ajouter un profil" only while a profile is missing — never from a student session.
  const canAddRole = useAddableRoles().length > 0;
  // A student session can't switch profile (POST /auth/switch-role → 403
  // CHANGEMENT_PROFIL_INTERDIT_ELEVE): log out and pick the profile at login instead.
  const canSwitchRole = currentRole !== "student" && (availableRoles.length > 1 || pendingRoles.length > 0);

  const name = user?.username || `${user?.prenom ?? ""} ${user?.nom ?? ""}`.trim() || roleLabel;
  const initial = name.charAt(0).toUpperCase();

  // Real-time push for notifications AND messages over the app's single shared STOMP
  // connection (initial fetch + one catch-up re-fetch after a reconnect, no polling) — for
  // the logged-in user's id (login response field `userId`, not `id`).
  const notificationsUserId = (authUser?.userId as string | undefined) ?? user?.userId;
  const { refresh: refreshNotifications } = useNotificationsRealtime(notificationsUserId);
  useMessagesRealtime(notificationsUserId);

  // The language itself is loaded at boot (RootNavigator), before any screen renders.
  useEffect(() => {
    loadThemeMode();
  }, [loadThemeMode]);

  const handleNotificationPress = (n: NotificationItem) => {
    if (!n.isRead) {
      markReadLocally(n.id);
      notificationService.markAsRead(n.id).catch(() => {});
    }
    setShowNotifications(false);
    // Profile validated/rejected (e.g. PROFESSOR_ROLE_VALIDATED): refresh the session's roles, open the profile.
    if (handleRoleNotification(n, currentRole, login)) return;
    // A live session started: go straight to the join screen.
    if ((n.type ?? "").toUpperCase() === "LIVE_SESSION_STARTED" && n.relatedEntityId && currentRole !== "professor" && currentRole !== "tutor") {
      navigation.navigate("LiveSession", { coursId: n.relatedEntityId, isHost: false });
      return;
    }
    const tab = getNotificationTargetTab(n, currentRole);
    if (tab) {
      useUiStore.getState().requestTab(tab);
      const cls = getNotificationClassTarget(n, currentRole);
      if (cls) useUiStore.getState().requestClass(cls.classId, cls.tab);
    }
  };

  const handleMarkAllRead = () => {
    markAllReadLocally();
    notificationService.markAllAsRead().catch(() => refreshNotifications());
  };

  useEffect(() => {
    if (isParent && user?.userId) {
      loadChildren(user.userId);
    }
  }, [isParent, user?.userId, loadChildren]);

  // After a switch the whole session is replaced (token in storage + store role/roles/user);
  // DashboardShell reacts to the role change (menus, landing tab), the parent child list is
  // (re)loaded by the effect above, and the shared STOMP socket keeps running for the same user.
  const handleRoleSwitched = (session: Parameters<typeof login>[0]) => {
    setShowNotifications(false);
    login(session);
  };

  const openAddRole = () => {
    setShowRoleSheet(false);
    // Let the first sheet finish dismissing (iOS can't present two RN Modals at once).
    setTimeout(() => setShowAddRoleSheet(true), 350);
  };

  return (
    <>
      {showNotifications && (
        <TouchableWithoutFeedback onPress={() => setShowNotifications(false)}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>
      )}

      <View
        style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 2 }]}
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
      >
        {/* Top-middle language switch (own slim row so the action row stays uncluttered on 360 px phones). */}
        <View style={styles.langRow}>
          <View style={styles.langSide} />
          <LanguageSwitch />
          <View style={[styles.langSide, styles.langSideRight]}>
            <HelpButton target={helpTarget} />
          </View>
        </View>
        <View style={styles.mainRow}>
          <TouchableOpacity
            style={styles.left}
            onPress={onNavigateToProfile}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t("header.openProfile")}
          >
            <View style={[styles.avatar, { backgroundColor: accentColor }]}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <View style={styles.titleWrap}>
              <Text style={styles.appName}>ScholChat</Text>
              <Text style={styles.role} numberOfLines={1}>{roleLabel}</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.right}>
            {/* Multi-role button if user has > 1 role */}
            {canSwitchRole && (
              <TouchableOpacity
                style={[styles.roleSwitchBtn, { borderColor: accentColor }]}
                onPress={() => setShowRoleSheet(true)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t("roles.switchTitle")}
              >
                <FontAwesome5 name="sync-alt" size={11} color={accentColor} />
                <Text style={[styles.roleSwitchText, { color: accentColor }]}>{t("header.profile")}</Text>
              </TouchableOpacity>
            )}

            {/* Child Switcher for Parents */}
            {isParent && children.length > 0 && (
              <TouchableOpacity
                style={styles.childSwitchBtn}
                onPress={() => setShowChildSheet(true)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t("header.myChildren")}
              >
                <FontAwesome5 name="child" size={11} color="#9333EA" />
                <Text style={styles.childSwitchText} numberOfLines={1}>
                  {selectedChild ? `${selectedChild.prenom ?? t("header.child")}` : t("header.child")}
                </Text>
                <FontAwesome5 name="chevron-down" size={9} color="#9333EA" />
              </TouchableOpacity>
            )}

            {/* Dark mode toggle */}
            <TouchableOpacity
              style={styles.themeBtn}
              onPress={toggleThemeMode}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={themeMode === "dark" ? t("header.lightMode") : t("header.darkMode")}
            >
              <FontAwesome5
                name={themeMode === "dark" ? "sun" : "moon"}
                size={13}
                color={themeMode === "dark" ? themeColors.warning : themeColors.primary}
              />
            </TouchableOpacity>

            {/* Notifications */}
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => {
                if (!showNotifications) refreshNotifications();
                setShowNotifications(!showNotifications);
              }}
              accessibilityLabel={t("notifications.title")}
            >
              <FontAwesome5 name="bell" size={17} color={themeColors.textMuted} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Logout */}
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => confirmLogout(onLogout)}
              accessibilityRole="button"
              accessibilityLabel={t("logout.title")}
            >
              <FontAwesome5 name="sign-out-alt" size={18} color={themeColors.danger} />
            </TouchableOpacity>
          </View>
        </View>

        {showNotifications && (
          <View style={[styles.dropdown, headerHeight > 0 && { top: headerHeight - 20 }]}>
            <View style={styles.dropdownHeader}>
              <Text style={styles.dropdownTitle}>{t("notifications.title")}</Text>
              {unreadCount > 0 && (
                <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn} activeOpacity={0.7}>
                  <FontAwesome5 name="check-double" size={11} color={themeColors.primary} />
                  <Text style={styles.markAllText}>{t("notifications.markAllRead")}</Text>
                </TouchableOpacity>
              )}
            </View>
            {notifications.length === 0 ? (
              <View style={styles.emptyWrap}>
                <FontAwesome5 name="bell-slash" size={20} color={themeColors.textLight} />
                <Text style={styles.emptyText}>{t("notifications.empty")}</Text>
              </View>
            ) : (
              <ScrollView style={styles.dropdownList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                {notifications.slice(0, 15).map((n) => {
                  const meta = getNotificationIcon(n.type);
                  return (
                    <TouchableOpacity
                      key={n.id}
                      style={[styles.notificationItem, !n.isRead && styles.notificationItemUnread]}
                      onPress={() => handleNotificationPress(n)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.notificationIcon, { backgroundColor: `${meta.color}22` }]}>
                        <FontAwesome5 name={meta.icon} size={12} color={meta.color} />
                      </View>
                      <View style={styles.notificationBody}>
                        <Text style={[styles.notificationTitle, !n.isRead && { fontWeight: "700" }]} numberOfLines={1}>
                          {n.title ?? t("notifications.fallbackTitle")}
                        </Text>
                        {n.message ? (
                          <Text style={styles.notificationMessage} numberOfLines={2}>
                            {String(n.message)}
                          </Text>
                        ) : null}
                        <Text style={styles.notificationDate}>{formatNotificationDate(n.createdAt)}</Text>
                      </View>
                      {!n.isRead && <View style={styles.unreadDot} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => {
                setShowNotifications(false);
                navigation.navigate("Notifications");
              }}
            >
              <Text style={styles.viewAllButtonText}>{t("notifications.viewAll")}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Role switch (pick a profile → confirm password) + add a profile */}
      <RoleSwitchSheet
        visible={showRoleSheet}
        onClose={() => setShowRoleSheet(false)}
        onSwitched={handleRoleSwitched}
        onAddRole={canAddRole ? openAddRole : undefined}
      />
      <AddRoleSheet visible={showAddRoleSheet} onClose={() => setShowAddRoleSheet(false)} />

      {/* Child Selection Sheet for Parents */}
      {isParent && (
        <BottomSheet
          visible={showChildSheet}
          onClose={() => setShowChildSheet(false)}
          title={t("header.myChildren")}
        >
          <View style={styles.childList}>
            {children.map((c) => {
              const isSelected = c.id === selectedChildId;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.childCard,
                    isSelected && { borderColor: "#9333EA", backgroundColor: "#9333EA1A" },
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
  langRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  langSide: { flex: 1, flexDirection: "row" },
  langSideRight: { justifyContent: "flex-end" },
  mainRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
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
    backgroundColor: "#9333EA1A",
    maxWidth: 90,
  },
  childSwitchText: { fontSize: 11, fontWeight: "700", color: "#9333EA" },
  themeBtn: {
    padding: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
  },
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
    maxHeight: 440,
  },
  dropdownHeader: { marginBottom: spacing.sm, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  markAllBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: spacing.sm },
  markAllText: { ...typography.caption, color: colors.primary, fontWeight: "700" },
  dropdownList: { maxHeight: 300 },
  emptyWrap: { alignItems: "center", paddingVertical: spacing.md, gap: spacing.xs },
  notificationItemUnread: { backgroundColor: colors.surfaceElevated },
  notificationIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", marginRight: spacing.sm },
  notificationBody: { flex: 1 },
  notificationDate: { ...typography.caption, color: colors.textLight, fontSize: 10, marginTop: 2 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginLeft: spacing.xs, marginTop: 6 },
  dropdownTitle: { ...typography.h3, color: colors.text },
  emptyText: { ...typography.body, color: colors.textMuted, paddingVertical: spacing.md },
  notificationItem: { flexDirection: "row", alignItems: "flex-start", paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border, borderRadius: 6 },
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

