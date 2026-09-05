import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { BottomSheet } from "../../components/ui";
import { colors, radius, spacing, typography } from "../../styles/theme";

export interface RoleOptionConfig {
  label: string;
  subtitle: string;
  icon: React.ComponentProps<typeof FontAwesome5>["name"];
  color: string;
  bgColor: string;
}

const ROLE_DISPLAY: Record<string, RoleOptionConfig> = {
  admin: {
    label: "Administrateur",
    subtitle: "Gestion globale de la plateforme",
    icon: "user-shield",
    color: "#DC2626",
    bgColor: "#FEF2F2",
  },
  professor: {
    label: "Professeur",
    subtitle: "Gestion des cours, devoirs et classes",
    icon: "chalkboard-teacher",
    color: "#2563EB",
    bgColor: "#EFF6FF",
  },
  parent: {
    label: "Parent",
    subtitle: "Suivi des devoirs et activités des enfants",
    icon: "user-friends",
    color: "#D97706",
    bgColor: "#FFFBEB",
  },
  student: {
    label: "Élève",
    subtitle: "Accès aux cours, devoirs et exercices",
    icon: "user-graduate",
    color: "#059669",
    bgColor: "#ECFDF5",
  },
  gestionnaire: {
    label: "Gestionnaire",
    subtitle: "Gestion des établissements et classes",
    icon: "building",
    color: "#0D9488",
    bgColor: "#F0FDFA",
  },
  tutor: {
    label: "Répétiteur",
    subtitle: "Accompagnement et soutien scolaire",
    icon: "chalkboard-teacher",
    color: "#7C3AED",
    bgColor: "#F5F3FF",
  },
};

const normalizeRoleKey = (raw: string): string => {
  const clean = raw.replace(/^ROLE_/i, "").toLowerCase();
  if (clean === "eleve") return "student";
  if (clean === "professeur") return "professor";
  if (clean === "repetiteur") return "tutor";
  return clean;
};

interface RoleSelectorSheetProps {
  visible: boolean;
  roles: string[];
  currentRole?: string;
  onSelect: (role: string) => void;
  onClose: () => void;
  title?: string;
  subtitle?: string;
}

export const RoleSelectorSheet = ({
  visible,
  roles = [],
  currentRole,
  onSelect,
  onClose,
  title = "Changer de profil",
  subtitle = "Choisissez le profil vers lequel vous souhaitez basculer.",
}: RoleSelectorSheetProps) => {
  if (roles.length === 0) return null;

  const normCurrent = currentRole ? normalizeRoleKey(currentRole) : null;

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <Text style={styles.subtitle}>{subtitle}</Text>

      <View style={styles.list}>
        {roles.map((role) => {
          const key = normalizeRoleKey(role);
          const config = ROLE_DISPLAY[key] || {
            label: role.charAt(0).toUpperCase() + role.slice(1).toLowerCase(),
            subtitle: `Espace ${role.toLowerCase()}`,
            icon: "user",
            color: colors.primary,
            bgColor: colors.surface,
          };
          const isSelected = normCurrent === key;

          return (
            <TouchableOpacity
              key={role}
              style={[
                styles.roleCard,
                { backgroundColor: config.bgColor, borderColor: isSelected ? config.color : colors.border },
              ]}
              onPress={() => {
                onSelect(role);
                onClose();
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: config.color }]}>
                <FontAwesome5 name={config.icon} size={20} color={colors.white} />
              </View>

              <View style={styles.cardInfo}>
                <Text style={[styles.roleLabel, { color: config.color }]}>{config.label}</Text>
                <Text style={styles.roleSub} numberOfLines={1}>{config.subtitle}</Text>
              </View>

              <FontAwesome5
                name={isSelected ? "check-circle" : "chevron-right"}
                size={16}
                color={isSelected ? config.color : colors.textMuted}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
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
