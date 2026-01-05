/**
 * Reusable Auth Modal Component
 * 
 * A configurable login/signup modal that works with the AuthContext.
 * Customize appearance via AuthModalConfig.
 */

import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, EyeOff } from 'lucide-react';

export interface AuthModalConfig {
  /** Title for login mode (default: 'Welcome Back!') */
  loginTitle?: string;
  /** Title for signup mode (default: 'Create Account') */
  signupTitle?: string;
  /** Description for login mode */
  loginDescription?: string;
  /** Description for signup mode */
  signupDescription?: string;
  /** Primary button color (default: '#f3c053') */
  primaryColor?: string;
  /** Primary button hover color (default: '#e5b347') */
  primaryHoverColor?: string;
  /** Primary button text color (default: 'black') */
  primaryTextColor?: string;
  /** Minimum password length (default: 8) */
  minPasswordLength?: number;
}

const DEFAULT_MODAL_CONFIG: Required<AuthModalConfig> = {
  loginTitle: 'Welcome Back!',
  signupTitle: 'Create Account',
  loginDescription: 'Sign in to save your work and sync across devices',
  signupDescription: 'Sign up to save and sync your data',
  primaryColor: '#f3c053',
  primaryHoverColor: '#e5b347',
  primaryTextColor: 'black',
  minPasswordLength: 8,
};

interface AuthModalProps {
  config?: AuthModalConfig;
}

export function AuthModal({ config: userConfig }: AuthModalProps = {}): JSX.Element {
  const modalConfig = { ...DEFAULT_MODAL_CONFIG, ...userConfig };
  
  const {
    showAuthModal,
    setShowAuthModal,
    authModalMode,
    setAuthModalMode,
    login,
    signup,
    requestPasswordReset,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const isLogin = authModalMode === 'login';
  const isSignup = authModalMode === 'signup';
  const isForgotPassword = authModalMode === 'forgot-password';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    // Validation
    if (!email) {
      setError('Please enter your email');
      return;
    }

    if (isForgotPassword) {
      setIsSubmitting(true);
      try {
        const result = await requestPasswordReset(email);
        if (!result.success) {
          setError(result.error || 'An error occurred');
        } else {
          setSuccessMessage('If an account exists with this email, you will receive a password reset link shortly.');
        }
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!password) {
      setError('Please fill in all required fields');
      return;
    }

    if (isSignup) {
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (password.length < modalConfig.minPasswordLength) {
        setError(`Password must be at least ${modalConfig.minPasswordLength} characters`);
        return;
      }
      if (!displayName.trim()) {
        setError('Please enter your name');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const result = isLogin
        ? await login(email, password)
        : await signup(email, password, displayName);

      if (!result.success) {
        setError(result.error || 'An error occurred');
      } else {
        // Clear form on success
        clearForm();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = (mode: 'login' | 'signup' | 'forgot-password') => {
    setAuthModalMode(mode);
    setError('');
    setSuccessMessage('');
  };

  const clearForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setDisplayName('');
    setError('');
    setSuccessMessage('');
  };

  const handleClose = () => {
    setShowAuthModal(false);
    clearForm();
  };

  const buttonStyle = {
    backgroundColor: modalConfig.primaryColor,
    color: modalConfig.primaryTextColor,
  };

  return (
    <Dialog open={showAuthModal} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            {isLogin && modalConfig.loginTitle}
            {isSignup && modalConfig.signupTitle}
            {isForgotPassword && 'Reset Password'}
          </DialogTitle>
          <DialogDescription className="text-center">
            {isLogin && modalConfig.loginDescription}
            {isSignup && modalConfig.signupDescription}
            {isForgotPassword && 'Enter your email to receive a reset link'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {isSignup && (
            <div className="space-y-2">
              <Label htmlFor="displayName">Name</Label>
              <Input
                id="displayName"
                type="text"
                placeholder="Your name"
                value={displayName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              disabled={isSubmitting}
              autoComplete="email"
            />
          </div>

          {!isForgotPassword && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              {isLogin && (
                <button
                  type="button"
                  onClick={() => switchMode('forgot-password')}
                  className="text-xs hover:underline"
                  style={{ color: modalConfig.primaryColor }}
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder={isLogin ? 'Your password' : `At least ${modalConfig.minPasswordLength} characters`}
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                disabled={isSubmitting}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          )}

          {isSignup && (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                disabled={isSubmitting}
                autoComplete="new-password"
              />
            </div>
          )}

          {error && (
            <div className="p-3 rounded-md bg-red-50 text-red-600 text-sm">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-md bg-green-50 text-green-600 text-sm">
              {successMessage}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            style={buttonStyle}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              isLogin ? 'Sign In' : isSignup ? 'Create Account' : 'Send Reset Link'
            )}
          </Button>

          <div className="text-center text-sm text-gray-600">
            {isLogin ? (
              <>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className="font-semibold hover:underline"
                  style={{ color: modalConfig.primaryColor }}
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="font-semibold hover:underline"
                  style={{ color: modalConfig.primaryColor }}
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
