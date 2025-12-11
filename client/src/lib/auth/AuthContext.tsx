/**
 * Reusable Authentication Context
 * 
 * Provides authentication state and methods throughout the app.
 * Configure with AuthConfig to customize API endpoints and storage keys.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface AuthConfig {
  /** Base URL for auth API endpoints (default: '/api/auth') */
  apiBaseUrl?: string;
  /** Storage key for caching auth state (default: 'app_auth') */
  storageKey?: string;
  /** Session duration in days (default: 30) */
  sessionDays?: number;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, displayName: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  showAuthModal: boolean;
  setShowAuthModal: (show: boolean) => void;
  authModalMode: 'login' | 'signup';
  setAuthModalMode: (mode: 'login' | 'signup') => void;
  /** Call this to require auth before an action. Returns true if authenticated, shows modal if not. */
  requireAuth: (callback?: () => void) => boolean;
  /** The auth configuration */
  config: Required<AuthConfig>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_CONFIG: Required<AuthConfig> = {
  apiBaseUrl: '/api/auth',
  storageKey: 'app_auth',
  sessionDays: 30,
};

interface AuthProviderProps {
  children: ReactNode;
  config?: AuthConfig;
}

export function AuthProvider({ children, config: userConfig }: AuthProviderProps): JSX.Element {
  const config = { ...DEFAULT_CONFIG, ...userConfig };
  
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
      const cached = localStorage.getItem(config.storageKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setUser(parsed.user);
        } catch (e) {
          localStorage.removeItem(config.storageKey);
        }
      }

      // Then verify with server
      const response = await fetch(`${config.apiBaseUrl}/me`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        localStorage.setItem(config.storageKey, JSON.stringify({ user: data.user }));
      } else {
        setUser(null);
        localStorage.removeItem(config.storageKey);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      // Keep cached user if server is unavailable
    } finally {
      setIsLoading(false);
    }
  }, [config.apiBaseUrl, config.storageKey]);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok && data.user) {
        setUser(data.user);
        localStorage.setItem(config.storageKey, JSON.stringify({ user: data.user }));
        setShowAuthModal(false);
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Login failed' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  }, [config.apiBaseUrl, config.storageKey]);

  const signup = useCallback(async (email: string, password: string, displayName: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, displayName }),
      });

      const data = await response.json();

      if (response.ok && data.user) {
        setUser(data.user);
        localStorage.setItem(config.storageKey, JSON.stringify({ user: data.user }));
        setShowAuthModal(false);
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Signup failed' };
      }
    } catch (error) {
      console.error('Signup error:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  }, [config.apiBaseUrl, config.storageKey]);

  const logout = useCallback(async () => {
    try {
      await fetch(`${config.apiBaseUrl}/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      localStorage.removeItem(config.storageKey);
    }
  }, [config.apiBaseUrl, config.storageKey]);

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
    config,
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
