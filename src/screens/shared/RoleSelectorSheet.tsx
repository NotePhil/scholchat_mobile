import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { BottomSheet } from "../../components/ui";
import { radius, spacing, typography, useThemeColors } from "../../styles/theme";
import { translate, useT } from "../../i18n";

export interface RoleOptionConfig {
  label: string;
  subtitle: string;
  icon: React.ComponentProps<typeof FontAwesome5>["name"];
  color: string;
  bgColor: string;
}

type RoleKey = "admin" | "professor" | "parent" | "student" | "gestionnaire" | "tutor";

const ROLE_STYLE: Record<RoleKey, Pick<RoleOptionConfig, "icon" | "color" | "bgColor">> = {
  admin: { icon: "user-shield", color: "#DC2626", bgColor: "#FEF2F2" },
  professor: { icon: "chalkboard-teacher", color: "#2563EB", bgColor: "#EFF6FF" },
  parent: { icon: "user-friends", color: "#D97706", bgColor: "#FFFBEB" },
  student: { icon: "user-graduate", color: "#059669", bgColor: "#ECFDF5" },
  gestionnaire: { icon: "building", color: "#0D9488", bgColor: "#F0FDFA" },
  tutor: { icon: "chalkboard-teacher", color: "#0284C7", bgColor: "#F0F9FF" },
};

const isRoleKey = (key: string): key is RoleKey => Object.prototype.hasOwnProperty.call(ROLE_STYLE, key);

export const normalizeRoleKey = (raw: string): string => {
  const clean = raw.replace(/^ROLE_/i, "").toLowerCase();
  if (clean === "eleve") return "student";
  if (clean === "professeur") return "professor";
  if (clean === "repetiteur") return "tutor";
  return clean;
};

/** Label/subtitle in the current language (read at call time) + icon/colours. */
export const roleDisplay = (role: string): RoleOptionConfig | undefined => {
  const key = normalizeRoleKey(role);
  if (!isRoleKey(key)) return undefined;
  return { ...ROLE_STYLE[key], label: translate(`roles.${key}`), subtitle: translate(`roles.subtitles.${key}`) };
};

interface RoleOptionListProps {
  roles: string[];
  currentRole?: string;
  /** Requested roles not usable yet (e.g. PROFESSOR awaiting admin validation) — shown disabled. */
  pendingRoles?: string[];
  onSelect: (role: string) => void;
  disabled?: boolean;
}

/** The role cards themselves — shared by RoleSelectorSheet (login) and RoleSwitchSheet (in-app). */
export const RoleOptionList = ({ roles, currentRole, pendingRoles = [], onSelect, disabled }: RoleOptionListProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  const normCurrent = currentRole ? normalizeRoleKey(currentRole) : null;
  const activeKeys = roles.map(normalizeRoleKey);
  const pendingOnly = pendingRoles.filter((r) => !activeKeys.includes(normalizeRoleKey(r)));

  const renderCard = (role: string, pending: boolean) => {
    const key = normalizeRoleKey(role);
    const config = roleDisplay(role) || {
      label: role.charAt(0).toUpperCase() + role.slice(1).toLowerCase(),
      subtitle: t("roles.space", { role: role.toLowerCase() }),
      icon: "user",
      color: colors.primary,
      bgColor: colors.surface,
    };
    const isSelected = !pending && normCurrent === key;
    return (
      <TouchableOpacity
        key={`${pending ? "pending-" : ""}${role}`}
        style={[
          styles.roleCard,
          // Light tint of the role colour works on both light and dark surfaces.
          { backgroundColor: `${config.color}14`, borderColor: isSelected ? config.color : colors.border },
          pending && styles.roleCardPending,
        ]}
        onPress={() => onSelect(role)}
        disabled={pending || disabled}
        activeOpacity={0.7}
      >
        <View style={[styles.iconWrap, { backgroundColor: pending ? colors.grayMid : config.color }]}>
          <FontAwesome5 name={config.icon} size={20} color={colors.white} />
        </View>

        <View style={styles.cardInfo}>
          <Text style={[styles.roleLabel, { color: pending ? colors.textMuted : config.color }]}>{config.label}</Text>
          <Text style={styles.roleSub} numberOfLines={1}>
            {pending ? t("roles.pendingValidation") : config.subtitle}
          </Text>
        </View>

        <FontAwesome5
          name={pending ? "hourglass-half" : isSelected ? "check-circle" : "chevron-right"}
          size={16}
          color={pending ? colors.textMuted : isSelected ? config.color : colors.textMuted}
        />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.list}>
      {roles.map((role) => renderCard(role, false))}
      {pendingOnly.map((role) => renderCard(role, true))}
    </View>
  );
};

interface RoleSelectorSheetProps {
  visible: boolean;
  roles: string[];
  currentRole?: string;
  pendingRoles?: string[];
  /** Called with the picked role. The caller closes the sheet (it is NOT closed automatically). */
  onSelect: (role: string) => void;
  /** Dismissed without choosing. */
  onClose: () => void;
  title?: string;
  subtitle?: string;
}

export const RoleSelectorSheet = ({
  visible,
  roles = [],
  currentRole,
  pendingRoles,
  onSelect,
  onClose,
  title,
  subtitle,
}: RoleSelectorSheetProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  if (roles.length === 0) return null;

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title ?? t("roles.switchTitle")}>
      <Text style={styles.subtitle}>{subtitle ?? t("roles.switchSubtitle")}</Text>
      <RoleOptionList roles={roles} currentRole={currentRole} pendingRoles={pendingRoles} onSelect={onSelect} />
    </BottomSheet>
  );
};

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  list: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  roleCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  roleCardPending: {
    opacity: 0.75,
    borderStyle: "dashed",
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  cardInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  roleLabel: {
    ...typography.bodyBold,
    fontSize: 15,
  },
  roleSub: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
});

export default RoleSelectorSheet;
