import React, { ReactNode } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { AuthUser, LoginResponse } from '../types';

export interface UserContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (userData: LoginResponse) => void;
  logout: () => Promise<void>;
  isLoggedIn: boolean;
}

/**
 * Back-compat shim: session state now lives in useAuthStore (Zustand), but
 * every existing screen calls useUser() from this module, so it re-exports
 * the same shape backed by the store instead of a separate React Context.
 */
export const useUser = (): UserContextValue => {
  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);

  return {
    user,
    isLoading,
    login,
    logout,
    isLoggedIn: isAuthenticated,
  };
};

/**
 * Kept only so the `<UserProvider>` wrapper in App.tsx doesn't break call
 * sites still importing it. Session restore (hydrate) now happens once in
 * RootNavigator, not here, to avoid double-reading AsyncStorage on boot.
 */
export const UserProvider = ({ children }: { children: ReactNode }) => <>{children}</>;
