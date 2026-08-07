import { create } from 'zustand';
import { storageService } from '../services/storageService';
import { decodeToken, getAppRole, getUserRoles, normalizeRole } from '../utils/tokenUtils';
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
   * the in-memory store in sync so screens re-render immediately.
   */
  login: (loginResponse: LoginResponse) => void;
  /** Clears AsyncStorage and resets in-memory state. */
  logout: () => Promise<void>;
}

const deriveAuthState = (loginResponse: LoginResponse) => {
  const decodedToken = decodeToken(loginResponse.accessToken);
  const role = getAppRole(loginResponse.accessToken);
  const roles = getUserRoles(loginResponse.accessToken).map(normalizeRole);
  const user: AuthUser = {
    ...loginResponse,
    decodedToken,
    userRole: role,
    loginTime: new Date().toISOString(),
  };
  return { user, role, roles };
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  role: 'unknown',
  roles: [],
  isAuthenticated: false,
  isLoading: true,

  hydrate: async () => {
    try {
      const [token, userData] = await Promise.all([
        storageService.getUserToken(),
        storageService.getUserData(),
      ]);

      if (token && userData) {
        const role = getAppRole(token);
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
        set({ isLoading: false, isAuthenticated: false });
      }
    } catch (error) {
      console.error('useAuthStore.hydrate error:', error);
      set({ isLoading: false, isAuthenticated: false });
    }
  },

  login: (loginResponse: LoginResponse) => {
    const { user, role, roles } = deriveAuthState(loginResponse);
    set({
      user,
      token: loginResponse.accessToken,
      role,
      roles,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  logout: async () => {
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
      });
    }
  },
}));
