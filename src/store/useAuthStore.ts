import { create } from 'zustand';
import { storageService } from '../services/storageService';
import { stompClient } from '../services/realtime/stompClient';
import { decodeToken, getUserRoles, isTokenExpired, normalizeRole, resolveSessionRole } from '../utils/tokenUtils';
import { AppRole, AuthUser, LoginResponse } from '../types';

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  role: AppRole;
  roles: AppRole[];
  isAuthenticated: boolean;
  /** True while the initial session restore (hydrate) is in flight. */
  isLoading: boolean;
  /** Restores session state from AsyncStorage on app boot. */
  hydrate: () => Promise<void>;
  /**
   * Registers an already-persisted login. Persistence itself happens in
   * authService.login()/storageService.saveUserData() — this just brings
   * the in-memory store in sync so screens re-render immediately. Also used
   * after a role switch (authService.switchRole) and after adding a role
   * (authService.refreshSession): role, roles and user are all re-derived.
   */
  login: (loginResponse: LoginResponse) => void;
  /** Clears AsyncStorage and resets in-memory state. */
  logout: () => Promise<void>;
  /**
   * Set when the backend rejects the token (401/403) or it passes its expiry
   * while the app is open. The session stays in place underneath and the
   * "Session Expirée" popup is shown until the user taps "Se reconnecter"
   * (which calls logout) — same as web's showTokenExpiredModal.
   */
  sessionExpired: boolean;
  markSessionExpired: () => void;
  /** Merges a partial profile update (e.g. after editing Settings) into the in-memory user. */
  updateUser: (patch: Partial<AuthUser>) => void;
  /**
   * The server refused a call with PROFIL_PROFESSEUR_NON_VALIDE while the session believed the
   * professor profile was validated: forget the (stale) status so DashboardShell swaps the
   * dashboard for the verification status screen, which re-reads it from GET /utilisateurs/{id}.
   */
  markProfessorNotValidated: () => void;
}

const deriveAuthState = (loginResponse: LoginResponse) => {
  const decodedToken = decodeToken(loginResponse.accessToken);
  // The token carries every active role; the response's selectedRole is the one chosen.
  const role = resolveSessionRole(loginResponse.accessToken, loginResponse.selectedRole);
  const roles = getUserRoles(loginResponse.accessToken).map(normalizeRole);
  const user: AuthUser = {
    ...loginResponse,
    decodedToken,
    userRole: role,
    loginTime: new Date().toISOString(),
  };
  return { user, role, roles };
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  role: 'unknown',
  roles: [],
  isAuthenticated: false,
  isLoading: true,
  sessionExpired: false,

  markSessionExpired: () => {
    if (get().isAuthenticated) set({ sessionExpired: true });
  },

  hydrate: async () => {
    try {
      const [token, userData] = await Promise.all([
        storageService.getUserToken(),
        storageService.getUserData(),
      ]);

      if (token && userData && !isTokenExpired(token)) {
        const role = resolveSessionRole(token, userData.selectedRole);
        const roles = getUserRoles(token).map(normalizeRole);
        set({
          user: userData,
          token,
          role,
          roles,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        if (token) {
          // A token was found but has already expired — matches web's
          // clearAuthData() path in loadUserFromStorage(): don't leave a
          // stale session sitting in storage for the next boot to trip over.
          await storageService.clearUserData().catch(() => {});
        }
        set({ isLoading: false, isAuthenticated: false });
      }
    } catch (error) {
      console.error('useAuthStore.hydrate error:', error);
      set({ isLoading: false, isAuthenticated: false });
    }
  },

  login: (loginResponse: LoginResponse) => {
    const { user, role, roles } = deriveAuthState(loginResponse);
    // Role switch / roles refresh reissue the JWT: the shared realtime socket must use the
    // new one on its next (re)connect. Same user id, so the live session itself is kept.
    stompClient.updateToken(loginResponse.accessToken);
    set({
      user,
      token: loginResponse.accessToken,
      role,
      roles,
      isAuthenticated: true,
      isLoading: false,
      sessionExpired: false,
    });
  },

  logout: async () => {
    // Close the shared realtime socket right away (don't wait for AppHeader to unmount).
    stompClient.disconnect();
    try {
      await storageService.clearUserData();
    } catch (error) {
      console.error('useAuthStore.logout error:', error);
    } finally {
      set({
        user: null,
        token: null,
        role: 'unknown',
        roles: [],
        isAuthenticated: false,
        isLoading: false,
        sessionExpired: false,
      });
    }
  },

  updateUser: (patch: Partial<AuthUser>) => {
    const current = get().user;
    if (!current) return;
    const updated = { ...current, ...patch };
    set({ user: updated });
    storageService.saveUserData(updated as LoginResponse).catch(() => {
      // Non-fatal — the in-memory state is already updated; next hydrate will re-sync from server data.
    });
  },

  markProfessorNotValidated: () => {
    const { user, role, isAuthenticated } = get();
    if (!isAuthenticated || !user || role !== 'professor') return;
    if (user.professeurStatutVerification !== 'VALIDE') return; // already gated
    get().updateUser({ professeurStatutVerification: undefined, professeurMotifRejet: undefined });
  },
}));
