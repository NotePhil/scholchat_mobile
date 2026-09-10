import { jwtDecode } from 'jwt-decode';
import { AppRole, DecodedToken, NavigationRoute } from '../types';

export const decodeToken = (token: string): DecodedToken | null => {
  try {
    return jwtDecode<DecodedToken>(token);
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
};

/**
 * Matches web's AuthContext.js `isTokenValid()`: a stored token is only
 * trusted on app boot if its `exp` claim is still in the future. Without
 * this, a token that expired while the app was closed would still be
 * treated as a valid session until the first real API call 401s.
 */
export const isTokenExpired = (token: string): boolean => {
  const decoded = decodeToken(token);
  if (!decoded?.exp) return true;
  return decoded.exp <= Date.now() / 1000;
};

/** All roles on the token except the generic ROLE_USER, in token order. */
export const getUserRoles = (token: string): string[] => {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.roles) return [];
  return decoded.roles.filter((role) => role !== 'ROLE_USER');
};

export const getUserRole = (token: string): string | null => {
  return getUserRoles(token)[0] ?? null;
};

/** Maps a raw backend role string (with or without the ROLE_ prefix) to an AppRole. */
export const normalizeRole = (rawRole: string | null | undefined): AppRole => {
  if (!rawRole) return 'unknown';
  const role = rawRole.toUpperCase().replace(/^ROLE_/, '');
  switch (role) {
    case 'ADMIN':
      return 'admin';
    case 'PROFESSOR':
    case 'PROFESSEUR':
      return 'professor';
    case 'PARENT':
      return 'parent';
    case 'STUDENT':
    case 'ELEVE':
      return 'student';
    case 'ETABLISSEMENT':
    case 'ESTABLISHMENT':
      return 'establishment';
    case 'GESTIONNAIRE':
      return 'gestionnaire';
    case 'TUTOR':
    case 'REPETITEUR':
      return 'tutor';
    default:
      return 'unknown';
  }
};

export const getAppRole = (token: string): AppRole => normalizeRole(getUserRole(token));

export const getNavigationRoute = (token: string): NavigationRoute => {
  const role = getAppRole(token);
  return role === 'admin' ? 'admin' : 'professor';
};
