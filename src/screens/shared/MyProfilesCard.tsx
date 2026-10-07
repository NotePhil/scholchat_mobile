import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { radius, spacing, typography, useThemeColors } from "../../styles/theme";
import { useAuthStore } from "../../store/useAuthStore";
import { userService } from "../../services/api";
import AddRoleSheet from "./AddRoleSheet";
import RoleSwitchSheet from "./RoleSwitchSheet";
import { normalizeRoleKey, roleDisplay } from "./RoleSelectorSheet";
import { TranslationKey, useT } from "../../i18n";
import { useAccountRoles, useAddableRoles } from "../../utils/roleRules";

type RoleState = "active" | "pendingValidation" | "pendingClass" | "documentsMissing" | "rejected";

interface RoleRow {
  key: string;
  raw: string;
  state: RoleState;
  reason?: string | null;
}

const STATE_KEYS: Record<RoleState, TranslationKey> = {
  active: "roleStatus.active",
  pendingValidation: "roleStatus.pendingValidation",
  pendingClass: "roleStatus.pendingClass",
  documentsMissing: "roleStatus.documentsMissing",
  rejected: "roleStatus.rejected",
};

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Maps any backend role / verification status wording to a display state. */
const toState = (raw: string | null, roleKey: string): RoleState | null => {
  if (!raw) return null;
  const s = raw.toUpperCase();
  if (/DOCUMENT/.test(s)) return "documentsMissing";
  if (/REJET|REFUS|REJECT/.test(s)) return "rejected";
  if (/ATTENTE|PENDING|AWAITING|DEMANDE/.test(s)) return roleKey === "student" ? "pendingClass" : "pendingValidation";
  if (/ACTI|VALID|APPROU|APPROV/.test(s)) return "active";
  return null;
};

/**
 * Per-role status entries of GET /utilisateurs/{id}, read defensively: `roles` may be a list of
 * strings or of objects ({role|type|nom, statut|statutVerification|roleStatus|etat, motifRejet…}).
 */
const parseProfileRoles = (profile: Record<string, any> | null): Record<string, { status: string | null; reason: string | null }> => {
  const out: Record<string, { status: string | null; reason: string | null }> = {};
  const list = profile?.roles ?? profile?.profils ?? profile?.roleStatuses;
  if (!Array.isArray(list)) return out;
  list.forEach((entry: any) => {
    if (typeof entry === "string") {
      out[normalizeRoleKey(entry)] = { status: null, reason: null };
      return;
    }
    if (!entry || typeof entry !== "object") return;
    const name = str(entry.role) ?? str(entry.type) ?? str(entry.nom) ?? str(entry.code) ?? str(entry.name);
    if (!name) return;
    out[normalizeRoleKey(name)] = {
      status: str(entry.statut) ?? str(entry.statutVerification) ?? str(entry.roleStatus) ?? str(entry.status) ?? str(entry.etat),
      reason: str(entry.motifRejet) ?? str(entry.motif) ?? str(entry.motifRejetVerification) ?? str(entry.reason),
    };
  });
  return out;
};

/**
 * "Mes profils" (Paramètres → Mon Profil): every profile of the account with its status
 * (actif / en attente de validation / documents manquants / refusée + motif), plus
 * "Changer de profil" and "Ajouter un profil" for parent / professor sessions. A student
 * session can do neither: the note explains to log out and pick the profile at login.
 */
const MyProfilesCard = () => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  const authUser = useAuthStore((s) => s.user);
  const currentRole = useAuthStore((s) => s.role);
  const login = useAuthStore((s) => s.login);
  const [showSwitch, setShowSwitch] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addType, setAddType] = useState<"professeur" | undefined>(undefined);
  const [profile, setProfile] = useState<Record<string, any> | null>(null);

  const userId = (authUser?.userId as string | undefined) ?? "";
  const loadProfile = useCallback(() => {
    if (!userId) return;
    userService
      .getUserById(userId)
      .then((p) => setProfile(p as Record<string, any>))
      .catch(() => {});
  }, [userId]);
  useEffect(() => {
    loadProfile();
  }, [loadProfile, authUser?.pendingRoles, authUser?.availableRoles]);

  const roles = useAccountRoles();
  const isStudentSession = currentRole === "student";
  const canAdd = useAddableRoles().length > 0;

  const rows: RoleRow[] = useMemo(() => {
    const activeKeys = roles.map(normalizeRoleKey);
    const pending = ((authUser?.pendingRoles as string[] | null | undefined) ?? []).map((r) => r);
    const fromProfile = parseProfileRoles(profile);
    const result: RoleRow[] = roles.map((r) => ({ key: normalizeRoleKey(r), raw: r, state: "active" as RoleState }));
    const extraKeys = new Set<string>();
    pending.forEach((r) => extraKeys.add(normalizeRoleKey(r)));
    Object.entries(fromProfile).forEach(([k, v]) => {
      if (toState(v.status, k) && toState(v.status, k) !== "active") extraKeys.add(k);
    });
    // Professor request known from the session / profile verification status.
    const profStatus = str(authUser?.professeurStatutVerification) ?? (activeKeys.includes("professor") ? null : str(profile?.statutVerification));
    if (profStatus && profStatus !== "VALIDE") extraKeys.add("professor");

    extraKeys.forEach((k) => {
      if (activeKeys.includes(k)) return;
      const entry = fromProfile[k];
      let state = toState(entry?.status ?? null, k);
      let reason = entry?.reason ?? null;
      if (k === "professor") {
        state = state && state !== "active" ? state : toState(profStatus, k);
        reason = reason ?? str(authUser?.professeurMotifRejet) ?? str(profile?.motifRejetVerification);
      }
      if (!state || state === "active") state = k === "student" ? "pendingClass" : "pendingValidation";
      result.push({ key: k, raw: k, state, reason: state === "rejected" ? reason : null });
    });
    return result;
  }, [roles, authUser?.pendingRoles, authUser?.professeurStatutVerification, authUser?.professeurMotifRejet, profile]);

  const canSwitch = !isStudentSession && roles.length > 1;
  const hasOtherProfiles = rows.length > 1;

  const pillColors = (state: RoleState, isCurrent: boolean, tint: string) => {
    if (isCurrent) return { bg: `${tint}22`, fg: tint };
    switch (state) {
      case "active":
        return { bg: `${colors.success}1F`, fg: colors.successDark };
      case "rejected":
        return { bg: `${colors.danger}1F`, fg: colors.dangerDark };
      case "documentsMissing":
        return { bg: `${colors.warning}26`, fg: colors.warningDark };
      default:
        return { bg: `${colors.warning}22`, fg: colors.warningDark };
    }
  };

  const renderRow = (row: RoleRow) => {
    const cfg = roleDisplay(row.raw);
    const tint = cfg?.color ?? colors.primary;
    const isCurrent = row.state === "active" && row.key === normalizeRoleKey(currentRole);
    const pc = pillColors(row.state, isCurrent, tint);
    const canComplete = row.key === "professor" && (row.state === "documentsMissing" || row.state === "rejected") && !isStudentSession;
    return (
      <View key={`${row.state}-${row.key}`} style={styles.rowWrap}>
        <View style={styles.row}>
          <View style={[styles.icon, { backgroundColor: row.state === "active" ? tint : colors.grayMid }]}>
            <FontAwesome5 name={cfg?.icon ?? "user"} size={13} color={colors.white} />
          </View>
          <Text style={styles.label} numberOfLines={1}>
            {cfg?.label ?? row.raw}
          </Text>
          <View style={[styles.pill, { backgroundColor: pc.bg }]}>
            <Text style={[styles.pillText, { color: pc.fg }]}>{isCurrent ? t("roleStatus.current") : t(STATE_KEYS[row.state])}</Text>
          </View>
        </View>
        {row.reason ? <Text style={styles.reason}>{t("roleStatus.reason", { reason: row.reason })}</Text> : null}
        {canComplete ? (
          <TouchableOpacity
            style={styles.completeBtn}
            onPress={() => {
              setAddType("professeur");
              setShowAdd(true);
            }}
            activeOpacity={0.75}
          >
            <FontAwesome5 name="id-card" size={11} color={colors.primary} />
            <Text style={styles.completeText}>{t("roleStatus.completeDocuments")}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <FontAwesome5 name="users-cog" size={14} color={colors.text} />
        <Text style={styles.title}>{t("profiles.title")}</Text>
      </View>
      {rows.map(renderRow)}

      {isStudentSession && hasOtherProfiles ? (
        <View style={styles.noteBox}>
          <FontAwesome5 name="info-circle" size={12} color={colors.infoDark} />
          <Text style={styles.noteText}>{t("roleStatus.studentSwitchNote")}</Text>
        </View>
      ) : null}

      {!isStudentSession ? (
        <View style={styles.actions}>
          {canSwitch ? (
            <TouchableOpacity style={[styles.btn, { borderColor: colors.primary }]} onPress={() => setShowSwitch(true)} activeOpacity={0.75}>
              <FontAwesome5 name="sync-alt" size={12} color={colors.primary} />
              <Text style={[styles.btnText, { color: colors.primary }]}>{t("roles.switchTitle")}</Text>
            </TouchableOpacity>
          ) : null}
          {canAdd ? (
            <TouchableOpacity
              style={[styles.btn, { borderColor: colors.primary }]}
              onPress={() => {
                setAddType(undefined);
                setShowAdd(true);
              }}
              activeOpacity={0.75}
            >
              <FontAwesome5 name="plus-circle" size={12} color={colors.primary} />
              <Text style={[styles.btnText, { color: colors.primary }]}>{t("roles.addProfile")}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {!isStudentSession ? (
        <>
          <RoleSwitchSheet visible={showSwitch} onClose={() => setShowSwitch(false)} onSwitched={login} />
          <AddRoleSheet visible={showAdd} onClose={() => setShowAdd(false)} initialType={addType} onDone={loadProfile} />
        </>
      ) : null}
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
    rowWrap: { paddingVertical: 6 },
    row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    icon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    label: { ...typography.bodyBold, color: colors.text, flex: 1 },
    pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, maxWidth: "55%" },
    pillText: { fontSize: 11, fontWeight: "700" },
    reason: { ...typography.caption, color: colors.dangerDark, marginLeft: 36, marginTop: 4 },
    completeBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginLeft: 36, marginTop: 6 },
    completeText: { fontSize: 12, fontWeight: "700", color: colors.primary },
    noteBox: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.sm,
      padding: spacing.sm,
      borderRadius: radius.sm,
      backgroundColor: `${colors.info}14`,
    },
    noteText: { ...typography.caption, color: colors.text, flex: 1 },
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
