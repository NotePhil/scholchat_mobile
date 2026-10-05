import { useAuthStore } from "../store/useAuthStore";
import { normalizeRoleKey } from "../screens/shared/RoleSelectorSheet";

/**
 * ScholChat role-combination rule (enforced server-side too, POST /utilisateurs → 409 ROLE_INCOMPATIBLE):
 *  - a student (élève) account holds no other profile and cannot add one;
 *  - parent and professor can be combined: an account may add whichever of the two it lacks;
 *  - nobody can add the student profile to an existing account.
 * A role awaiting validation (pending professor) counts as held.
 */
export type AddableRoleKey = "parent" | "professor";

const COMBINABLE: AddableRoleKey[] = ["parent", "professor"];

export const getAddableRoles = (heldRoles: string[]): AddableRoleKey[] => {
  const held = new Set(heldRoles.filter(Boolean).map(normalizeRoleKey));
  if (held.has("student")) return [];
  return COMBINABLE.filter((r) => !held.has(r));
};

/** Roles the logged-in account may still add (active + pending roles from the auth store). */
export const useAddableRoles = (): AddableRoleKey[] => {
  const authUser = useAuthStore((s) => s.user);
  const tokenRoles = useAuthStore((s) => s.roles);
  const currentRole = useAuthStore((s) => s.role);
  const available = (authUser?.availableRoles as string[] | undefined)?.length
    ? (authUser?.availableRoles as string[])
    : tokenRoles.length > 0
      ? (tokenRoles as string[])
      : currentRole
        ? [currentRole as string]
        : [];
  const pending = (authUser?.pendingRoles as string[] | null | undefined) ?? [];
  return getAddableRoles([...available, ...pending]);
};
