import { jwtDecode } from 'jwt-decode';

export const decodeToken = (token) => {
  try {
    return jwtDecode(token);
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
};

export const getUserRole = (token) => {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.roles) return null;
  
  // Find the role that's not ROLE_USER
  const userRole = decoded.roles.find(role => role !== 'ROLE_USER');
  return userRole;
};

export const getNavigationRoute = (token) => {
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