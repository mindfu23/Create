/**
 * Authentication Context
 * 
 * Provides authentication state and methods throughout the app.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  createdAt: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, displayName: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  showAuthModal: boolean;
  setShowAuthModal: (show: boolean) => void;
  authModalMode: 'login' | 'signup';
  setAuthModalMode: (mode: 'login' | 'signup') => void;
  requireAuth: (callback?: () => void) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Storage key for persisting auth state
const AUTH_STORAGE_KEY = 'createcamp_auth';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login');
  const [pendingCallback, setPendingCallback] = useState<(() => void) | null>(null);

  const isAuthenticated = !!user;

  // Check for existing session on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Execute pending callback after successful auth
  useEffect(() => {
    if (isAuthenticated && pendingCallback) {
      pendingCallback();
      setPendingCallback(null);
    }
  }, [isAuthenticated, pendingCallback]);

  const checkAuth = useCallback(async () => {
    setIsLoading(true);
    try {
      // First check local storage for cached user
      const cached = localStorage.getItem(AUTH_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        setUser(parsed.user);
      }

      // Then verify with server
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user: data.user }));
      } else {
        setUser(null);
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      // Keep cached user if server is unavailable
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok && data.user) {
        setUser(data.user);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user: data.user }));
        setShowAuthModal(false);
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Login failed' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  }, []);

  const signup = useCallback(async (email: string, password: string, displayName: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, displayName }),
      });

      const data = await response.json();

      if (response.ok && data.user) {
        setUser(data.user);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user: data.user }));
        setShowAuthModal(false);
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Signup failed' };
      }
    } catch (error) {
      console.error('Signup error:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, []);

  // Require auth - returns true if authenticated, otherwise shows modal
  const requireAuth = useCallback((callback?: () => void): boolean => {
    if (isAuthenticated) {
      return true;
    }
    
    if (callback) {
      setPendingCallback(() => callback);
    }
    setAuthModalMode('login');
    setShowAuthModal(true);
    return false;
  }, [isAuthenticated]);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    login,
    signup,
    logout,
    checkAuth,
    showAuthModal,
    setShowAuthModal,
    authModalMode,
    setAuthModalMode,
    requireAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
