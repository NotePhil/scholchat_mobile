import { useAuthStore } from '../store/useAuthStore';
import { statusesHaveApprovedChild, useSelectedChildStore } from '../store/useSelectedChildStore';
import { userService } from './api/userService';
import type { AppRole, AuthUser } from '../types';

/** Dashboard tabs a parent can use while no child is approved (plus notifications and logout). */
export const PARENT_LIMITED_TABS = new Set(['children', 'my-children', 'settings']);

/** Parent in limited mode: the session says no child has an approved class yet. */
export const isParentLimited = (role: AppRole, user: AuthUser | null | undefined) =>
  role === 'parent' && user?.parentAEnfantValide === false;

/** Hook form of isParentLimited (re-renders when the flag changes). */
export const useParentLimited = () => useAuthStore((s) => isParentLimited(s.role, s.user));

let inFlight: Promise<void> | null = null;

/**
 * Re-reads the parent's access (GET /utilisateurs/{id} → parentAEnfantValide) and the children with
 * their class statuses. When a child gets approved the session leaves limited mode and the store
 * selects the first approved child; `selectChildId` (approval notification) is selected when it
 * is among the approved children. No-op for any other role. Never throws.
 */
export const refreshParentAccess = async (options?: { selectChildId?: string | null }): Promise<void> => {
  const { role, user } = useAuthStore.getState();
  const parentId = user?.userId ?? user?.id;
  if (role !== 'parent' || !parentId) return;
  if (!inFlight) {
    inFlight = (async () => {
      const [profile] = await Promise.allSettled([
        userService.getUserById(String(parentId)),
        useSelectedChildStore.getState().loadChildren(String(parentId)),
      ]);
      const auth = useAuthStore.getState();
      if (auth.role !== 'parent' || !auth.user) return;
      let valid: boolean | undefined;
      const fromServer = profile.status === 'fulfilled' ? profile.value?.parentAEnfantValide : undefined;
      if (typeof fromServer === 'boolean') {
        valid = fromServer;
      } else if (typeof auth.user.parentAEnfantValide === 'boolean' && useSelectedChildStore.getState().statuses) {
        // Profile without the flag: fall back on the statuses (an approved class = unlocked).
        valid = statusesHaveApprovedChild(useSelectedChildStore.getState().statuses);
      }
      if (valid !== undefined && valid !== auth.user.parentAEnfantValide) auth.updateUser({ parentAEnfantValide: valid });
    })().finally(() => {
      inFlight = null;
    });
  }
  await inFlight;
  const childId = options?.selectChildId ? String(options.selectChildId) : null;
  if (childId) {
    const store = useSelectedChildStore.getState();
    if (store.children.some((c) => c.id === childId)) store.setSelectedChildId(childId);
  }
};
