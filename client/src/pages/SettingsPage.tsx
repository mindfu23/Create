/**
 * Settings Page
 * 
 * User settings including cloud storage configuration
 */

import { ArrowLeft, Settings, User, Cloud, Bell, Shield, LogOut } from "lucide-react";
import React, { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CloudStorageSettings } from "@/components/CloudStorageSettings";
import { useToast } from "@/hooks/use-toast";

// For now, we'll use a simple local storage approach for user ID
// In production, this would come from your auth system
const getUserId = (): string => {
  let userId = localStorage.getItem('createcamp_user_id');
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('createcamp_user_id', userId);
  }
  return userId;
};

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
  
  const [userId] = useState(getUserId);
  const [isPremium] = useState(checkPremiumStatus);
  const [activeTab, setActiveTab] = useState("cloud");

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
      <header className="w-full h-[78px] bg-[#f3c053] flex items-center justify-center relative">
        <button
          onClick={() => setLocation("/")}
          className="absolute left-[14px] top-1/2 -translate-y-1/2"
        >
          <ArrowLeft className="w-6 h-6 text-black" />
        </button>
        <h1 className="[font-family:'Dangrek',Helvetica] font-normal text-black text-3xl text-center tracking-[0] leading-[normal]">
          Settings
        </h1>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col px-4 pt-6 pb-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="cloud" className="flex items-center gap-2">
              <Cloud className="h-4 w-4" />
              Cloud Sync
            </TabsTrigger>
            <TabsTrigger value="account" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Account
            </TabsTrigger>
          </TabsList>

          {/* Cloud Storage Tab */}
          <TabsContent value="cloud" className="space-y-4">
            <CloudStorageSettings 
              userId={userId} 
              isPremiumUser={isPremium}
            />
          </TabsContent>

          {/* Account Tab */}
          <TabsContent value="account" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Account Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">User ID</span>
                  <code className="text-xs bg-muted px-2 py-1 rounded">
                    {userId.slice(0, 20)}...
                  </code>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Premium Status</span>
                  <span className={isPremium ? "text-green-500" : "text-muted-foreground"}>
                    {isPremium ? "Active" : "Free"}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Dev Mode Toggle (for testing) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Developer Options
                </CardTitle>
                <CardDescription>
                  Options for testing and development
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">Dev Mode</p>
                    <p className="text-sm text-muted-foreground">
                      Enable premium features for testing
                    </p>
                  </div>
                  <Button 
                    variant={localStorage.getItem('createcamp_dev_mode') === 'true' ? "destructive" : "default"}
                    size="sm"
                    onClick={toggleDevMode}
                  >
                    {localStorage.getItem('createcamp_dev_mode') === 'true' ? 'Disable' : 'Enable'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};
