import axios, { AxiosError } from 'axios';
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

// Separate, interceptor-free instance for the refresh call itself, so a
// failed refresh can't recursively trigger another refresh attempt.
const refreshClient = axios.create({
  baseURL: environment.baseUrl,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

let refreshPromise: Promise<string | null> | null = null;

const attemptTokenRefresh = (): Promise<string | null> => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const refreshToken = await storageService.getRefreshToken();
        if (!refreshToken) return null;
        const { data } = await refreshClient.post<{ accessToken?: string; refreshToken?: string }>(
          '/auth/refresh-token',
          { refreshToken }
        );
        if (!data?.accessToken) return null;
        await storageService.updateTokens(data.accessToken, data.refreshToken);
        return data.accessToken;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
};

let isHandlingSessionExpiry = false;

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const originalRequest = error.config as (typeof error.config & { _retried?: boolean }) | undefined;

    if ((status === 401 || status === 403) && originalRequest && !originalRequest._retried) {
      originalRequest._retried = true;
      const newAccessToken = await attemptTokenRefresh();
      if (newAccessToken) {
        (originalRequest.headers as Record<string, string>).Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      }
    }

    if ((status === 401 || status === 403) && !isHandlingSessionExpiry) {
      isHandlingSessionExpiry = true;
      try {
        await useAuthStore.getState().logout();
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
