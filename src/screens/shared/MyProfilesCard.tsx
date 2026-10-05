import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { radius, spacing, typography, useThemeColors } from "../../styles/theme";
import { useAuthStore } from "../../store/useAuthStore";
import AddRoleSheet from "./AddRoleSheet";
import RoleSwitchSheet from "./RoleSwitchSheet";
import { normalizeRoleKey, roleDisplay } from "./RoleSelectorSheet";
import { useT } from "../../i18n";
import { useAddableRoles } from "../../utils/roleRules";

/**
 * "Mes profils" (Paramètres → Mon Profil): every profile of the account, the one in
 * use, the ones awaiting validation, plus "Changer de profil" and "Ajouter un profil".
 * Always reachable — unlike the header's "Profil" button, which only shows once the
 * account has more than one profile.
 */
const MyProfilesCard = () => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  const authUser = useAuthStore((s) => s.user);
  const tokenRoles = useAuthStore((s) => s.roles);
  const currentRole = useAuthStore((s) => s.role);
  const login = useAuthStore((s) => s.login);
  const [showSwitch, setShowSwitch] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const roles: string[] = (authUser?.availableRoles as string[] | undefined)?.length
    ? (authUser?.availableRoles as string[])
    : tokenRoles;
  const activeKeys = roles.map(normalizeRoleKey);
  const pending = ((authUser?.pendingRoles as string[] | null | undefined) ?? []).filter(
    (r) => !activeKeys.includes(normalizeRoleKey(r))
  );
  const canSwitch = roles.length > 1;
  // Student accounts can't add a profile; parent/professor only add the one they lack.
  const canAdd = useAddableRoles().length > 0;

  const row = (role: string, state: "current" | "active" | "pending") => {
    const cfg = roleDisplay(role);
    const tint = cfg?.color ?? colors.primary;
    return (
      <View key={`${state}-${role}`} style={styles.row}>
        <View style={[styles.icon, { backgroundColor: state === "pending" ? colors.grayMid : tint }]}>
          <FontAwesome5 name={cfg?.icon ?? "user"} size={13} color={colors.white} />
        </View>
        <Text style={styles.label} numberOfLines={1}>
          {cfg?.label ?? role}
        </Text>
        <View
          style={[
            styles.pill,
            { backgroundColor: state === "current" ? `${tint}22` : state === "pending" ? `${colors.warning}22` : colors.surfaceElevated },
          ]}
        >
          <Text
            style={[
              styles.pillText,
              { color: state === "current" ? tint : state === "pending" ? colors.warningDark : colors.textMuted },
            ]}
          >
            {state === "current" ? t("profiles.current") : state === "pending" ? t("profiles.pending") : t("profiles.available")}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <FontAwesome5 name="users-cog" size={14} color={colors.text} />
        <Text style={styles.title}>{t("profiles.title")}</Text>
      </View>
      {roles.map((r) => row(r, normalizeRoleKey(r) === normalizeRoleKey(currentRole) ? "current" : "active"))}
      {pending.map((r) => row(r, "pending"))}

      {activeKeys.includes("student") ? <Text style={styles.hint}>{t("profiles.studentExclusive")}</Text> : null}

      <View style={styles.actions}>
        {canSwitch ? (
          <TouchableOpacity style={[styles.btn, { borderColor: colors.primary }]} onPress={() => setShowSwitch(true)} activeOpacity={0.75}>
            <FontAwesome5 name="sync-alt" size={12} color={colors.primary} />
            <Text style={[styles.btnText, { color: colors.primary }]}>{t("roles.switchTitle")}</Text>
          </TouchableOpacity>
        ) : null}
        {canAdd ? (
          <TouchableOpacity style={[styles.btn, { borderColor: colors.primary }]} onPress={() => setShowAdd(true)} activeOpacity={0.75}>
            <FontAwesome5 name="plus-circle" size={12} color={colors.primary} />
            <Text style={[styles.btnText, { color: colors.primary }]}>{t("roles.addProfile")}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <RoleSwitchSheet visible={showSwitch} onClose={() => setShowSwitch(false)} onSwitched={login} />
      {canAdd ? <AddRoleSheet visible={showAdd} onClose={() => setShowAdd(false)} /> : null}
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
    },
    header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing.sm },
    title: { fontSize: 16, fontWeight: "700", color: colors.text },
    row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 6 },
    icon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    label: { ...typography.bodyBold, color: colors.text, flex: 1 },
    pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
    pillText: { fontSize: 11, fontWeight: "700" },
    hint: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
    actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
    btn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
      borderWidth: 1,
    },
    btnText: { fontSize: 13, fontWeight: "700" },
  });

export default MyProfilesCard;
