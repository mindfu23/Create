/**
 * Settings Page
 * 
 * User settings including cloud storage configuration
 */

import { ArrowLeft, Settings, Cloud, HardDrive } from "lucide-react";
import React, { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CloudStorageSettings } from "@/components/CloudStorageSettings";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

// Check if user has premium (for now, check localStorage or default to dev mode)
const checkPremiumStatus = (): boolean => {
  // In dev mode, always return true for testing
  const devMode = localStorage.getItem('createcamp_dev_mode');
  if (devMode === 'true') return true;
  
  // Check actual premium status
  const premium = localStorage.getItem('createcamp_premium');
  return premium === 'true';
};

export const SettingsPage = (): JSX.Element => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isAuthenticated, requireAuth } = useAuth();
  
  const userId = user?.id || 'anonymous';
  const [isPremium] = useState(checkPremiumStatus);

  // Enable dev mode for testing
  const toggleDevMode = () => {
    const current = localStorage.getItem('createcamp_dev_mode');
    const newValue = current === 'true' ? 'false' : 'true';
    localStorage.setItem('createcamp_dev_mode', newValue);
    toast({
      title: newValue === 'true' ? 'Dev Mode Enabled' : 'Dev Mode Disabled',
      description: newValue === 'true' 
        ? 'Premium features are now available for testing' 
        : 'Premium features require subscription',
    });
    // Reload to apply changes
    window.location.reload();
  };

  return (
    <div className="bg-black w-full min-w-[375px] min-h-screen flex flex-col">
      {/* Header */}
      <header className="w-full h-[60px] bg-[#f3c053] flex items-center px-4 gap-4">
        <button onClick={() => setLocation("/")} className="p-1">
          <ArrowLeft className="w-6 h-6 text-black" />
        </button>
        <h1 className="[font-family:'Dangrek',Helvetica] font-normal text-black text-2xl">
          Settings
        </h1>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col px-4 pt-6 pb-8 space-y-6">
        {/* Cloud Storage Section */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Cloud className="w-5 h-5" />
            Cloud Storage
          </h2>
          
          {isAuthenticated ? (
            <CloudStorageSettings 
              userId={userId} 
              isPremiumUser={isPremium}
            />
          ) : (
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="p-6 text-center">
                <Cloud className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">
                  Sign in to enable Cloud Sync
                </h3>
                <p className="text-gray-400 text-sm mb-4">
                  Connect your Dropbox, Google Drive, or other cloud storage to backup your data automatically.
                </p>
                <Button
                  className="bg-[#f3c053] text-black hover:bg-[#e5b347]"
                  onClick={() => requireAuth()}
                >
                  Sign In
                </Button>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Local Storage Section */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            Local Storage
          </h2>
          
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Data stored locally in browser</span>
                <span className="text-green-500">Active</span>
              </div>
              <p className="text-xs text-gray-500">
                Your journal entries, projects, sketches, and to-dos are saved locally in IndexedDB. 
                This data persists even when offline but is only available on this device.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Developer Options */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Developer Options
          </h2>
          
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-white">Dev Mode</CardTitle>
              <CardDescription>
                Enable premium features for testing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">
                  {localStorage.getItem('createcamp_dev_mode') === 'true' ? 'Enabled' : 'Disabled'}
                </span>
                <Button 
                  variant={localStorage.getItem('createcamp_dev_mode') === 'true' ? "destructive" : "secondary"}
                  size="sm"
                  onClick={toggleDevMode}
                >
                  {localStorage.getItem('createcamp_dev_mode') === 'true' ? 'Disable' : 'Enable'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
};
