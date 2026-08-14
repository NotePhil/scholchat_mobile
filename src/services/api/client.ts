import axios, { AxiosError } from 'axios';
import { Alert } from 'react-native';
import { environment } from '../../environment/environment';
import { storageService } from '../storageService';
import { useAuthStore } from '../../store/useAuthStore';

/**
 * Shared authenticated axios instance. Mirrors scholchat_front's
 * utils/axiosConfig.js: every service should import `apiClient` instead of
 * calling fetch/axios directly, so token attachment and session-expiry
 * handling only live in one place.
 */
export const apiClient = axios.create({
  baseURL: environment.baseUrl,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

apiClient.interceptors.request.use(
  async (config) => {
    const token = await storageService.getUserToken();
    if (token) {
      (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * The backend (AuthApi.java) has no `/auth/refresh-token` endpoint at all —
 * a JWT that expires cannot be silently renewed, only re-issued via a fresh
 * login. So instead of chasing a refresh call that would always 404, a
 * 401/403 is treated as a real session expiry: clear the session and tell
 * the user why (a bare kick-back-to-login with no explanation reads as a
 * crash on mobile), then RootNavigator's `isAuthenticated` switch handles
 * the actual navigation back to the login screen — no `window.location`
 * hard-redirect hack like web's axiosConfig.js uses.
 */
let isHandlingSessionExpiry = false;

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;

    if ((status === 401 || status === 403) && !isHandlingSessionExpiry) {
      isHandlingSessionExpiry = true;
      try {
        const wasAuthenticated = useAuthStore.getState().isAuthenticated;
        await useAuthStore.getState().logout();
        if (wasAuthenticated) {
          Alert.alert('Session expirée', 'Votre session a expiré. Veuillez vous reconnecter.');
        }
      } finally {
        isHandlingSessionExpiry = false;
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Normalizes an axios (or generic) error into a user-displayable message,
 * matching the shape of error bodies returned by the ScholChat backend
 * (message / error / details fields, or a plain string body).
 */
export const extractErrorMessage = (
  error: unknown,
  fallback = 'Une erreur est survenue. Veuillez réessayer.'
): string => {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return 'Erreur réseau. Vérifiez votre connexion.';
    }
    const data = error.response.data as
      | { message?: string; error?: string; details?: string }
      | string
      | undefined;
    if (typeof data === 'string' && data.trim().length > 0) {
      return data;
    }
    if (data && typeof data === 'object') {
      return data.message || data.error || data.details || fallback;
    }
    return fallback;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
};
