import axios, { AxiosError } from 'axios';
import { environment } from '../../environment/environment';
import { storageService } from '../storageService';
import { isTokenExpired } from '../../utils/tokenUtils';
import { getDeviceTimeZone } from '../../utils/dates';
import { useAuthStore } from '../../store/useAuthStore';
import { translate } from '../../i18n';

/**
 * Shared authenticated axios instance. Mirrors scholchat_front's
 * utils/axiosConfig.js: every service should import `apiClient` instead of
 * calling fetch/axios directly, so token attachment and session-expiry
 * handling only live in one place.
 */
export const apiClient = axios.create({
  baseURL: environment.baseUrl,
  timeout: 25000,
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
    // Lets the server interpret any naive (offset-less) date-time in the
    // device's zone. Omitted when the zone can't be resolved (server → UTC).
    const timeZone = getDeviceTimeZone();
    if (timeZone) {
      (config.headers as Record<string, string>)['X-Timezone'] = timeZone;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/** 403 body code sent for every professor action while the profile awaits admin validation. */
export const PROFESSOR_NOT_VALIDATED_CODE = 'PROFIL_PROFESSEUR_NON_VALIDE';

/** 403 body code sent while the account still uses its temporary password (first login). */
export const MUST_CHANGE_PASSWORD_CODE = 'MOT_DE_PASSE_A_CHANGER';

/** Backend error `code` field of an axios error body, if any. */
export const getErrorCode = (error: unknown): string | undefined => {
  const body = (error as { response?: { data?: unknown } })?.response?.data;
  if (body && typeof body === 'object' && typeof (body as { code?: unknown }).code === 'string') {
    return (body as { code: string }).code;
  }
  return undefined;
};

/**
 * The backend (AuthApi.java) has no `/auth/refresh-token` endpoint at all —
 * a JWT that expires cannot be silently renewed, only re-issued via a fresh
 * login. So, like web's axiosConfig.js, a 401/403 is treated as a session
 * expiry: flag it, and SessionExpiredModal shows the "Session Expirée" popup
 * over the current screen. The actual logout (and RootNavigator's switch back
 * to login) happens when the user taps "Se reconnecter".
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status;
    // Spring Security answers an expired/invalid JWT with 403 as well, but a
    // 403 also means "your role can't call this" (e.g. a professor hitting an
    // admin-only endpoint) — so a 403 only counts as expiry when the token
    // itself has expired. markSessionExpired is a no-op when not logged in.
    const { token, markSessionExpired, markProfessorNotValidated, markMustChangePassword } = useAuthStore.getState();
    if (status === 401 || (status === 403 && (!token || isTokenExpired(token)))) {
      markSessionExpired();
    } else if (status === 403 && getErrorCode(error) === PROFESSOR_NOT_VALIDATED_CODE) {
      // Professor profile not (or no longer) validated by the admin: the shell must show the
      // verification status screen instead of the dashboard.
      markProfessorNotValidated();
    } else if (status === 403 && getErrorCode(error) === MUST_CHANGE_PASSWORD_CODE) {
      // Temporary password not changed yet: RootNavigator swaps to the forced change screen.
      markMustChangePassword();
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
  fallback = translate('errors.generic')
): string => {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED' || (error.message && error.message.toLowerCase().includes('timeout'))) {
      return translate('errors.timeout');
    }
    if (!error.response) {
      return translate('errors.network');
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
