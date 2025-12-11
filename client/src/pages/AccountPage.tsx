/**
 * Account Page
 * 
 * Displays user account information when logged in,
 * or prompts login/signup when not authenticated.
 */

import React from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, User, Mail, Calendar, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

export function AccountPage(): JSX.Element {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading, logout, setShowAuthModal, setAuthModalMode } = useAuth();

  const handleLogin = () => {
    setAuthModalMode('login');
    setShowAuthModal(true);
  };

  const handleSignup = () => {
    setAuthModalMode('signup');
    setShowAuthModal(true);
  };

  const handleLogout = async () => {
    await logout();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="bg-black w-full min-w-[375px] min-h-screen flex flex-col">
      {/* Header */}
      <header className="w-full h-[60px] bg-[#f3c053] flex items-center px-4 gap-4">
        <button onClick={() => setLocation('/')} className="p-1">
          <ArrowLeft className="w-6 h-6 text-black" />
        </button>
        <h1 className="[font-family:'Dangrek',Helvetica] font-normal text-black text-2xl">
          Account
        </h1>
      </header>

      {/* Content */}
      <main className="flex-1 p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-400">Loading...</div>
          </div>
        ) : isAuthenticated && user ? (
          // Logged in view
          <div className="space-y-4 max-w-md mx-auto">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-white flex items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-[#93b747] flex items-center justify-center text-white text-xl font-bold">
                    {user.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xl">{user.displayName}</div>
                    <div className="text-sm text-gray-400 font-normal">Member</div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 text-gray-300">
                  <Mail className="w-5 h-5 text-gray-500" />
                  <span>{user.email}</span>
                </div>
                <div className="flex items-center gap-3 text-gray-300">
                  <Calendar className="w-5 h-5 text-gray-500" />
                  <span>Joined {formatDate(user.createdAt)}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white text-lg">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start text-gray-300 border-gray-700 hover:bg-gray-800"
                  onClick={() => setLocation('/settings')}
                >
                  Cloud Storage Settings
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-red-400 border-gray-700 hover:bg-gray-800 hover:text-red-300"
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          // Not logged in view
          <div className="max-w-md mx-auto text-center space-y-6 pt-12">
            <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center mx-auto">
              <User className="w-10 h-10 text-gray-500" />
            </div>
            
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Sign in to Create!
              </h2>
              <p className="text-gray-400">
                Create an account to save your journal entries, projects, sketches, and to-do lists.
                Sync across all your devices.
              </p>
            </div>

            <div className="space-y-3">
              <Button
                className="w-full bg-[#f3c053] text-black hover:bg-[#e5b347] font-semibold py-6"
                onClick={handleLogin}
              >
                Sign In
              </Button>
              <Button
                variant="outline"
                className="w-full border-gray-700 text-gray-300 hover:bg-gray-800 py-6"
                onClick={handleSignup}
              >
                Create Account
              </Button>
            </div>

            <p className="text-sm text-gray-500">
              Your data is stored locally until you sign in.
              <br />
              Sign up to enable cloud backup.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
