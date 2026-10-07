import { useAuthStore } from "../store/useAuthStore";
import { normalizeRoleKey } from "../screens/shared/RoleSelectorSheet";

/**
 * ScholChat role rules (enforced server-side too):
 *  - one account may hold the parent, professor and student profiles;
 *  - from a STUDENT session nothing can be switched or added (POST /auth/switch-role and
 *    POST /utilisateurs → 403 CHANGEMENT_PROFIL_INTERDIT_ELEVE): the user logs out and picks
 *    the profile at login (multi-role picker);
 *  - from a PARENT / PROFESSOR session any missing profile can be added (professor: identity
 *    documents + admin validation; student: class code + teacher approval; parent: immediate).
 * A role awaiting validation counts as held.
 */
export type AddableRoleKey = "parent" | "professor" | "student";

const ADDABLE: AddableRoleKey[] = ["parent", "professor", "student"];

/** 403 code of a profile switch / add attempted from a student session. */
export const STUDENT_SWITCH_FORBIDDEN_CODE = "CHANGEMENT_PROFIL_INTERDIT_ELEVE";

export const getAddableRoles = (heldRoles: string[], sessionRole?: string): AddableRoleKey[] => {
  if (sessionRole && normalizeRoleKey(sessionRole) === "student") return [];
  const held = new Set(heldRoles.filter(Boolean).map(normalizeRoleKey));
  return ADDABLE.filter((r) => !held.has(r));
};

/** Active roles of the session's account (availableRoles, else the token's roles, else the session role). */
export const useAccountRoles = (): string[] => {
  const authUser = useAuthStore((s) => s.user);
  const tokenRoles = useAuthStore((s) => s.roles);
  const currentRole = useAuthStore((s) => s.role);
  return (authUser?.availableRoles as string[] | undefined)?.length
    ? (authUser?.availableRoles as string[])
    : tokenRoles.length > 0
      ? (tokenRoles as string[])
      : currentRole
        ? [currentRole as string]
        : [];
};

/** Roles the logged-in account may still add (none from a student session). */
export const useAddableRoles = (): AddableRoleKey[] => {
  const authUser = useAuthStore((s) => s.user);
  const currentRole = useAuthStore((s) => s.role);
  const available = useAccountRoles();
  const pending = (authUser?.pendingRoles as string[] | null | undefined) ?? [];
  return getAddableRoles([...available, ...pending], currentRole);
};
