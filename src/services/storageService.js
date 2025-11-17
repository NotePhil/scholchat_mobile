import AsyncStorage from '@react-native-async-storage/async-storage';
import { decodeToken, getUserRole } from '../utils/tokenUtils';

const STORAGE_KEYS = {
  USER_TOKEN: 'userToken',
  USER_DATA: 'userData',
};

export const storageService = {
  // Save user login data
  saveUserData: async (loginResponse) => {
    try {
      const decodedToken = decodeToken(loginResponse.accessToken);
      const userRole = getUserRole(loginResponse.accessToken);
      
      const enrichedData = {
        ...loginResponse,
        decodedToken,
        userRole
      };
      
      await AsyncStorage.setItem(STORAGE_KEYS.USER_TOKEN, loginResponse.accessToken);
      await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(enrichedData));
    } catch (error) {
      console.error('Error saving user data:', error);
      throw error;
    }
  },

  // Get user token
  getUserToken: async () => {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.USER_TOKEN);
    } catch (error) {
      console.error('Error getting user token:', error);
      return null;
    }
  },

  // Get user data
  getUserData: async () => {
    try {
      const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error getting user data:', error);
      return null;
    }
  },

  // Clear user data (logout)
  clearUserData: async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.USER_TOKEN);
      await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
    } catch (error) {
      console.error('Error clearing user data:', error);
      throw error;
    }
  },

  // Check if user is logged in
  isLoggedIn: async () => {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.USER_TOKEN);
      return !!token;
    } catch (error) {
      console.error('Error checking login status:', error);
      return false;
    }
  }
};