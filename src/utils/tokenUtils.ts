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
