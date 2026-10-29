import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../services/api-client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem('sitech_token') || null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(true);

  // Initialize and validate session on application startup
  useEffect(() => {
    let isMounted = true;
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('sitech_token');
      if (!storedToken) {
        if (isMounted) {
          setUser(null);
          setIsLoading(false);
        }
        return;
      }

      try {
        const userData = await authApi.getMe();
        if (isMounted) {
          setUser(userData);
          setToken(storedToken);
        }
      } catch (err) {
        console.warn('Session expired or invalid, resetting authentication state.');
        try {
          localStorage.removeItem('sitech_token');
        } catch {
          // ignore
        }
        if (isMounted) {
          setUser(null);
          setToken(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback((newToken, userData) => {
    try {
      localStorage.setItem('sitech_token', newToken);
    } catch {
      // storage blocked
    }
    setToken(newToken);
    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.warn('Backend logout encountered error:', err.message);
    } finally {
      try {
        localStorage.removeItem('sitech_token');
      } catch {
        // ignore
      }
      setToken(null);
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const updatedUser = await authApi.getMe();
      setUser(updatedUser);
      return updatedUser;
    } catch (err) {
      console.error('Failed to refresh user profile:', err);
      return null;
    }
  }, []);

  const value = {
    user,
    token,
    isAuthenticated: Boolean(user && token),
    isLoading,
    login,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
