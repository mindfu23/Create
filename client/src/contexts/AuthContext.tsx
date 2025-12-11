/**
 * Authentication Context
 * 
 * Re-exports from the reusable auth module with app-specific configuration.
 * See client/src/lib/auth/README.md for documentation.
 */

import { AuthProvider as BaseAuthProvider, useAuth as baseUseAuth, type AuthConfig, type User, type AuthContextType } from '@/lib/auth/AuthContext';
import { AuthModal as BaseAuthModal, type AuthModalConfig } from '@/lib/auth/AuthModal';
import React, { ReactNode } from 'react';

// Re-export types and hook from the base module
export type { User, AuthContextType };
export const useAuth = baseUseAuth;

// App-specific configuration
const APP_AUTH_CONFIG: AuthConfig = {
  apiBaseUrl: '/api/auth',
  storageKey: 'createcamp_auth',
  sessionDays: 30,
};

const APP_MODAL_CONFIG: AuthModalConfig = {
  loginTitle: 'Welcome Back!',
  signupTitle: 'Create Account',
  loginDescription: 'Sign in to save your work and sync across devices',
  signupDescription: 'Sign up to save your journal, projects, and sketches',
  primaryColor: '#f3c053',
  primaryHoverColor: '#e5b347',
  primaryTextColor: 'black',
  minPasswordLength: 8,
};

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * App-specific AuthProvider with pre-configured settings
 */
export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  return (
    <BaseAuthProvider config={APP_AUTH_CONFIG}>
      {children}
      <AuthModal />
    </BaseAuthProvider>
  );
}

/**
 * App-specific AuthModal with pre-configured styling
 */
export function AuthModal(): JSX.Element {
  return <BaseAuthModal config={APP_MODAL_CONFIG} />;
}
