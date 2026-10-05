import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { BottomSheet, Button } from "../../components/ui";
import { radius, spacing, typography, useThemeColors } from "../../styles/theme";
import { authService } from "../../services/home/authService";
import { useAuthStore } from "../../store/useAuthStore";
import { LoginResponse } from "../../types";
import { RoleOptionList, normalizeRoleKey, roleDisplay } from "./RoleSelectorSheet";
import { translate, useT } from "../../i18n";

interface RoleSwitchSheetProps {
  visible: boolean;
  onClose: () => void;
  /** New session for the chosen role (already persisted by authService). */
  onSwitched: (session: LoginResponse) => void;
  /** Opens the "add a profile" flow (AddRoleSheet). */
  onAddRole?: () => void;
}

/**
 * In-app role switch for multi-role accounts — mirrors web Principal.jsx's flow
 * (RoleSelectorModal → ReAuthModal → POST /auth/switch-role): pick a profile,
 * confirm with the password, then the whole session is swapped for that role.
 * Both steps live in ONE sheet (stacking two RN Modals is unreliable on iOS).
 */
const RoleSwitchSheet = ({ visible, onClose, onSwitched, onAddRole }: RoleSwitchSheetProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  const authUser = useAuthStore((s) => s.user);
  const tokenRoles = useAuthStore((s) => s.roles);
  const currentRole = useAuthStore((s) => s.role);

  const [pendingRole, setPendingRole] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) {
      setPendingRole(null);
      setPassword("");
      setError("");
      setShowPassword(false);
    }
  }, [visible]);

  const availableRoles: string[] =
    (authUser?.availableRoles as string[] | undefined)?.length
      ? (authUser?.availableRoles as string[])
      : tokenRoles.length > 0
        ? tokenRoles
        : [currentRole];
  const pendingRoles: string[] = (authUser?.pendingRoles as string[] | null | undefined) ?? [];
  const email = (authUser?.userEmail as string | undefined) ?? (authUser?.email as string | undefined) ?? "";

  const handlePick = (role: string) => {
    if (normalizeRoleKey(role) === normalizeRoleKey(currentRole)) {
      onClose(); // already in this profile
      return;
    }
    setError("");
    setPendingRole(role);
  };

  const handleConfirm = async () => {
    if (!pendingRole) return;
    if (!password) {
      setError(t("roles.enterPassword"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      const session = await authService.switchRole(email, password, pendingRole);
      onSwitched(session);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : translate("roles.wrongPassword"));
    } finally {
      setLoading(false);
    }
  };

  const target = pendingRole ? roleDisplay(pendingRole) : undefined;

  return (
    <BottomSheet visible={visible} onClose={onClose} title={pendingRole ? t("roles.confirmIdentity") : t("roles.switchTitle")}>
      {!pendingRole ? (
        <>
          <Text style={styles.subtitle}>{t("roles.switchSubtitle")}</Text>
          <RoleOptionList roles={availableRoles} currentRole={currentRole} pendingRoles={pendingRoles} onSelect={handlePick} />
          {onAddRole ? (
            <TouchableOpacity style={styles.addRow} onPress={onAddRole} activeOpacity={0.75}>
              <FontAwesome5 name="plus-circle" size={16} color={colors.primary} />
              <Text style={styles.addText}>{t("roles.addProfile")}</Text>
            </TouchableOpacity>
          ) : null}
        </>
      ) : (
        <>
          <Text style={styles.subtitle}>
            {t("roles.confirmMessage", { role: target?.label ?? pendingRole, account: email || t("roles.yourAccount") })}
          </Text>
          <View style={styles.passwordRow}>
            <FontAwesome5 name="lock" size={14} color={colors.textMuted} />
            <TextInput
              style={styles.passwordInput}
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                if (error) setError("");
              }}
              placeholder={t("auth.common.password")}
              placeholderTextColor={colors.textMuted}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              onSubmitEditing={handleConfirm}
              returnKeyType="go"
            />
            <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <FontAwesome5 name={showPassword ? "eye-slash" : "eye"} accessibilityLabel={showPassword ? t("auth.common.hidePassword") : t("auth.common.showPassword")} size={14} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          {error ? (
            <View style={styles.errorRow}>
              <FontAwesome5 name="exclamation-circle" size={12} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          <Button label={t("common.confirm")} icon="exchange-alt" onPress={handleConfirm} loading={loading} fullWidth style={{ marginTop: spacing.sm }} />
          <Button
            label={t("common.back")}
            variant="ghost"
            onPress={() => {
              setPendingRole(null);
              setPassword("");
              setError("");
            }}
            disabled={loading}
            fullWidth
            style={{ marginTop: spacing.xs, marginBottom: spacing.sm }}
          />
        </>
      )}
    </BottomSheet>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    subtitle: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md },
    addRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      paddingVertical: spacing.md,
      marginBottom: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: colors.primary,
    },
    addText: { ...typography.bodyBold, color: colors.primary },
    passwordRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.background,
    },
    passwordInput: { flex: 1, paddingVertical: spacing.md, color: colors.text, fontSize: 15 },
    errorRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm },
    errorText: { ...typography.caption, color: colors.danger, flex: 1 },
  });

export default RoleSwitchSheet;
