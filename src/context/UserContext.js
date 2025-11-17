import React, { createContext, useContext, useState, useEffect } from 'react';
import { storageService } from '../services/storageService';

const UserContext = createContext();

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkUserSession();
  }, []);

  const checkUserSession = async () => {
    try {
      const userData = await storageService.getUserData();
      if (userData) {
        setUser(userData);
      }
    } catch (error) {
      console.error('Error checking user session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = (userData) => {
    const userWithLoginTime = {
      ...userData,
      loginTime: new Date().toISOString()
    };
    setUser(userWithLoginTime);
  };

  const logout = async () => {
    try {
      await storageService.clearUserData();
      setUser(null);
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const value = {
    user,
    isLoading,
    login,
    logout,
    isLoggedIn: !!user,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};