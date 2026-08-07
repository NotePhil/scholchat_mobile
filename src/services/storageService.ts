import AsyncStorage from '@react-native-async-storage/async-storage';
import { decodeToken, getUserRole } from '../utils/tokenUtils';
import { AuthUser, LoginResponse } from '../types';

const STORAGE_KEYS = {
  USER_TOKEN: 'userToken',
  USER_DATA: 'userData',
};

export const storageService = {
  // Save user login data
  saveUserData: async (loginResponse: LoginResponse): Promise<void> => {
    try {
      const decodedToken = decodeToken(loginResponse.accessToken);
      const userRole = getUserRole(loginResponse.accessToken);

      const enrichedData: AuthUser = {
        ...loginResponse,
        decodedToken,
        userRole,
      };

      await AsyncStorage.setItem(STORAGE_KEYS.USER_TOKEN, loginResponse.accessToken);
      await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(enrichedData));
    } catch (error) {
      console.error('Error saving user data:', error);
      throw error;
    }
  },

  // Get user token
  getUserToken: async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.USER_TOKEN);
    } catch (error) {
      console.error('Error getting user token:', error);
      return null;
    }
  },

  // Get user data
  getUserData: async (): Promise<AuthUser | null> => {
    try {
      const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
      return userData ? (JSON.parse(userData) as AuthUser) : null;
    } catch (error) {
      console.error('Error getting user data:', error);
      return null;
    }
  },

  // Clear user data (logout)
  clearUserData: async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.USER_TOKEN);
      await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
    } catch (error) {
      console.error('Error clearing user data:', error);
      throw error;
    }
  },

  // Check if user is logged in
  isLoggedIn: async (): Promise<boolean> => {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.USER_TOKEN);
      return !!token;
    } catch (error) {
      console.error('Error checking login status:', error);
      return false;
    }
  },

  // Get the stored refresh token (lives inside the persisted user data blob)
  getRefreshToken: async (): Promise<string | null> => {
    try {
      const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
      if (!userData) return null;
      const parsed = JSON.parse(userData) as AuthUser;
      return parsed.refreshToken ?? null;
    } catch (error) {
      console.error('Error getting refresh token:', error);
      return null;
    }
  },

  // Persist a refreshed access token (and optionally a rotated refresh token)
  updateTokens: async (accessToken: string, refreshToken?: string): Promise<void> => {
    try {
      const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
      const parsed: AuthUser | null = userData ? JSON.parse(userData) : null;
      const updated: AuthUser = {
        ...(parsed ?? ({} as AuthUser)),
        accessToken,
        refreshToken: refreshToken ?? parsed?.refreshToken,
      };
      await AsyncStorage.setItem(STORAGE_KEYS.USER_TOKEN, accessToken);
      await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(updated));
    } catch (error) {
      console.error('Error updating tokens:', error);
      throw error;
    }
  },
};
