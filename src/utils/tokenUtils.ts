import { jwtDecode } from 'jwt-decode';
import { DecodedToken, NavigationRoute } from '../types';

export const decodeToken = (token: string): DecodedToken | null => {
  try {
    return jwtDecode<DecodedToken>(token);
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
};

export const getUserRole = (token: string): string | null => {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.roles) return null;

  // Find the role that's not ROLE_USER
  const userRole = decoded.roles.find(role => role !== 'ROLE_USER');
  return userRole ?? null;
};

export const getNavigationRoute = (token: string): NavigationRoute => {
  const role = getUserRole(token);

  switch (role) {
    case 'ROLE_ADMIN':
      return 'admin';
    case 'ROLE_PROFESSOR':
      return 'professor';
    default:
      return 'professor'; // Default fallback
  }
};
