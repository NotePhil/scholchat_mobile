import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { storageService } from '../services/storageService';
import { AuthUser, LoginResponse } from '../types';

export interface UserContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (userData: LoginResponse) => void;
  logout: () => Promise<void>;
  isLoggedIn: boolean;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

export const useUser = (): UserContextValue => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
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

  const login = (userData: LoginResponse) => {
    const userWithLoginTime: AuthUser = {
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

  const value: UserContextValue = {
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
