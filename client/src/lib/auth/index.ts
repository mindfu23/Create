/**
 * Reusable Authentication Module
 * 
 * This module provides a complete authentication solution that can be
 * easily copied and reused in other React applications.
 * 
 * Usage:
 * 1. Copy the entire `auth` folder to your project's `src/lib/` directory
 * 2. Copy the server auth routes from `server/authRoutes.ts`
 * 3. Configure by creating an AuthConfig and passing to AuthProvider
 * 
 * Required dependencies:
 * - bcryptjs (server-side)
 * - cookie-parser (server-side)
 * 
 * Required UI components (or replace with your own):
 * - Dialog, Button, Input, Label from your UI library
 */

export { AuthProvider, useAuth, type AuthConfig, type User, type AuthContextType } from './AuthContext';
export { AuthModal, type AuthModalConfig } from './AuthModal';
export { createAuthRoutes, type AuthStorage } from './serverRoutes';
