import { ArrowLeft, Plus, Save, Lock, Unlock, RefreshCw, Trash2, AlertTriangle, Cloud, CloudOff, Settings } from "lucide-react";
import React, { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useJournalStorage } from "@/hooks/useJournalStorage";
import { useCloudJournalSync } from "@/hooks/useCloudJournalSync";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

// Check premium status
const checkPremiumStatus = (): boolean => {
  const devMode = localStorage.getItem('createcamp_dev_mode');
  if (devMode === 'true') return true;
  const premium = localStorage.getItem('createcamp_premium');
  return premium === 'true';
};

export const JournalPage = (): JSX.Element => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isAuthenticated, requireAuth } = useAuth();
  
  // User info
  const userId = user?.id || 'anonymous';
  const [isPremium] = useState(checkPremiumStatus);
  
  // Storage hook
  const {
    entries,
    isLoading,
    isUnlocked,
    syncStatus,
    error,
    unlock,
    lock,
    createEntry,
    updateEntry,
    removeEntry,
    syncWithServer,
  } = useJournalStorage({ autoSync: true, syncInterval: 30000 });

  // Local state
  const [isWriting, setIsWriting] = useState(false);
  const [newEntry, setNewEntry] = useState({ title: "", content: "" });
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [editContent, setEditContent] = useState({ title: "", content: "" });
  
  // Unlock form state
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [isSettingUp, setIsSettingUp] = useState(false);

  // Cloud sync hook (for premium users)
  const {
    isCloudEnabled,
    hasActiveConnection,
    cloudSyncStatus,
    pendingUploads,
    syncToCloud,
  } = useCloudJournalSync({
    userId,
    isPremiumUser: isPremium,
    entries,
    encryptionKey: isUnlocked ? password : null,
    enabled: isUnlocked,
  });

  // Handle unlock/setup
  const handleUnlock = async () => {
    if (!password || !email) {
      toast({
        title: "Required Fields",
        description: "Please enter your email and encryption password",
        variant: "destructive",
      });
      return;
    }

    const success = await unlock(password, email);
    if (success) {
      toast({
        title: isSettingUp ? "Journal Created" : "Journal Unlocked",
        description: "Your encrypted journal is ready",
      });
      setPassword("");
    } else {
      toast({
        title: "Unlock Failed",
        description: "Wrong password or corrupted data",
        variant: "destructive",
      });
    }
  };

  // Handle save new entry
  const handleSave = async () => {
    // Require authentication to save
    if (!isAuthenticated) {
      requireAuth();
      return;
    }
    
    if (!newEntry.title || !newEntry.content) {
      toast({
        title: "Required Fields",
        description: "Please enter a title and content",
        variant: "destructive",
      });
      return;
    }

    const result = await createEntry(newEntry.title, newEntry.content);
    if (result) {
      toast({
        title: "Saved",
        description: "Your entry has been encrypted and saved",
      });
      setNewEntry({ title: "", content: "" });
      setIsWriting(false);
    }
  };

  // Handle update entry
  const handleUpdate = async () => {
    // Require authentication to update
    if (!isAuthenticated) {
      requireAuth();
      return;
    }
    
    if (!editingEntry || !editContent.title || !editContent.content) return;

    const result = await updateEntry(editingEntry, editContent);
    if (result) {
      toast({
        title: "Updated",
        description: "Your entry has been updated",
      });
      setEditingEntry(null);
      setEditContent({ title: "", content: "" });
    }
  };

  // Handle delete entry
  const handleDelete = async (id: string) => {
    // Require authentication to delete
    if (!isAuthenticated) {
      requireAuth();
      return;
    }
    
    const success = await removeEntry(id);
    if (success) {
      toast({
        title: "Deleted",
        description: "Entry has been removed",
      });
    }
  };

  // Handle manual sync
  const handleSync = async () => {
    const result = await syncWithServer();
    if (result.success) {
      toast({
        title: "Synced",
        description: `Pushed: ${result.pushed}, Pulled: ${result.pulled}${result.conflicts ? `, Conflicts: ${result.conflicts}` : ''}`,
      });
    } else {
      toast({
        title: "Sync Failed",
        description: "Could not sync with server. Will retry.",
        variant: "destructive",
      });
    }
  };

  // Lock screen
  if (!isUnlocked) {
    return (
      <div className="bg-black w-full min-w-[375px] min-h-screen flex flex-col">
        <header className="w-full h-[78px] bg-[#f3c053] flex items-center justify-center relative">
          <button
            onClick={() => setLocation("/")}
            className="absolute left-4 top-1/2 -translate-y-1/2"
          >
            <ArrowLeft className="w-6 h-6 text-black" />
          </button>
          <h1 className="[font-family:'Dangrek',Helvetica] font-normal text-black text-4xl text-center tracking-[0] leading-[normal]">
            Journal
          </h1>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-4 gap-6">
          <Lock className="w-16 h-16 text-[#93b747]" />
          <h2 className="text-white text-2xl [font-family:'Dangrek',Helvetica]">
            {isSettingUp ? "Create Your Encrypted Journal" : "Unlock Your Journal"}
          </h2>
          <p className="text-gray-400 text-center max-w-xs">
            {isSettingUp 
              ? "Set up a password to encrypt your journal. This password is NOT stored - you must remember it!"
              : "Enter your encryption password to access your journal entries."
            }
          </p>

          <Card className="bg-white rounded-[15px] border-0 w-full max-w-sm">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Email (for sync)</label>
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-[#93b747]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Encryption Password</label>
                  <input
                    type="password"
                    placeholder="Enter your secret password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                    className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-[#93b747]"
                  />
                </div>
                {isSettingUp && (
                  <div className="bg-yellow-50 p-3 rounded-lg flex gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-yellow-800">
                      <strong>Important:</strong> Your password is never stored. If you forget it, your data cannot be recovered!
                    </p>
                  </div>
                )}
                <Button
                  onClick={handleUnlock}
                  className="w-full bg-[#93b747] hover:bg-[#7a9a3a] h-12"
                >
                  <Unlock className="w-4 h-4 mr-2" />
                  {isSettingUp ? "Create Journal" : "Unlock"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <button
            onClick={() => setIsSettingUp(!isSettingUp)}
            className="text-[#93b747] hover:underline"
          >
            {isSettingUp ? "Already have a journal? Unlock it" : "First time? Create a journal"}
          </button>
        </main>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-black w-full min-w-[375px] min-h-screen flex flex-col items-center justify-center">
        <RefreshCw className="w-12 h-12 text-[#93b747] animate-spin" />
        <p className="text-white mt-4">Decrypting your journal...</p>
      </div>
    );
  }

  // Main journal view
  return (
    <div className="bg-black w-full min-w-[375px] min-h-screen flex flex-col">
      <header className="w-full h-[78px] bg-[#f3c053] flex items-center justify-center relative">
        <button
          onClick={() => setLocation("/")}
          className="absolute left-4 top-1/2 -translate-y-1/2"
        >
          <ArrowLeft className="w-6 h-6 text-black" />
        </button>
        <h1 className="[font-family:'Dangrek',Helvetica] font-normal text-black text-4xl text-center tracking-[0] leading-[normal]">
          Journal
        </h1>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-2">
          {/* Cloud storage indicator */}
          {isCloudEnabled && hasActiveConnection && (
            <button
              onClick={() => syncToCloud()}
              disabled={cloudSyncStatus === 'syncing'}
              className="p-1"
              title={`Cloud backup ${cloudSyncStatus === 'syncing' ? '(syncing...)' : pendingUploads > 0 ? `(${pendingUploads} pending)` : '(connected)'}`}
            >
              {cloudSyncStatus === 'syncing' ? (
                <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
              ) : cloudSyncStatus === 'error' ? (
                <CloudOff className="w-5 h-5 text-red-600" />
              ) : (
                <Cloud className="w-5 h-5 text-blue-600" />
              )}
            </button>
          )}
          {/* Settings shortcut */}
          <button
            onClick={() => setLocation("/settings")}
            className="p-1"
            title="Settings"
          >
            <Settings className="w-5 h-5 text-black" />
          </button>
          <button
            onClick={handleSync}
            disabled={syncStatus.isSyncing}
            className="p-1"
            title="Sync with server"
          >
            {syncStatus.isSyncing ? (
              <RefreshCw className="w-5 h-5 text-black animate-spin" />
            ) : syncStatus.lastSync ? (
              <Cloud className="w-5 h-5 text-black" />
            ) : (
              <CloudOff className="w-5 h-5 text-black" />
            )}
          </button>
          <button
            onClick={() => setIsWriting(true)}
            className="p-1"
          >
            <Plus className="w-6 h-6 text-black" />
          </button>
        </div>
      </header>

      {/* Cloud sync status bar */}
      {isCloudEnabled && hasActiveConnection && pendingUploads > 0 && (
        <div className="bg-blue-500 text-white text-sm px-4 py-1 text-center">
          {pendingUploads} cloud backup{pendingUploads > 1 ? 's' : ''} pending
        </div>
      )}

      {/* Sync status bar */}
      {syncStatus.error && (
        <div className="bg-red-500 text-white text-sm px-4 py-2 text-center">
          {syncStatus.error}
        </div>
      )}

      <main className="flex-1 flex flex-col px-4 pt-6 gap-4 pb-20">
        {/* Error display */}
        {error && (
          <div className="bg-red-100 text-red-800 p-3 rounded-lg">
            {error}
          </div>
        )}

        {/* New entry form */}
        {isWriting && (
          <Card className="bg-white rounded-[15px] border-0">
            <CardContent className="p-4">
              <input
                type="text"
                placeholder="Title your idea..."
                value={newEntry.title}
                onChange={(e) =>
                  setNewEntry({ ...newEntry, title: e.target.value })
                }
                className="w-full text-xl font-bold mb-2 p-2 border-b border-gray-200 outline-none"
              />
              <textarea
                placeholder="Write your thoughts..."
                value={newEntry.content}
                onChange={(e) =>
                  setNewEntry({ ...newEntry, content: e.target.value })
                }
                className="w-full h-32 p-2 outline-none resize-none"
              />
              <div className="flex gap-2 justify-end mt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsWriting(false);
                    setNewEntry({ title: "", content: "" });
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  className="bg-[#93b747] hover:bg-[#7a9a3a]"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save & Encrypt
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {entries.length === 0 && !isWriting && (
          <div className="flex flex-col items-center justify-center flex-1 text-white">
            <p className="text-lg mb-4">No journal entries yet</p>
            <Button
              onClick={() => setIsWriting(true)}
              className="bg-[#93b747] hover:bg-[#7a9a3a]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Write your first idea
            </Button>
          </div>
        )}

        {/* Entry list */}
        {entries.map((entry) => (
          <Card
            key={entry.id}
            className={`bg-white rounded-[15px] border-0 transition-shadow ${
              entry.id.includes('_conflicted_copy') ? 'border-2 border-yellow-400' : ''
            }`}
          >
            <CardContent className="p-4">
              {editingEntry === entry.id ? (
                // Edit mode
                <>
                  <input
                    type="text"
                    value={editContent.title}
                    onChange={(e) =>
                      setEditContent({ ...editContent, title: e.target.value })
                    }
                    className="w-full text-xl font-bold mb-2 p-2 border-b border-gray-200 outline-none"
                  />
                  <textarea
                    value={editContent.content}
                    onChange={(e) =>
                      setEditContent({ ...editContent, content: e.target.value })
                    }
                    className="w-full h-32 p-2 outline-none resize-none"
                  />
                  <div className="flex gap-2 justify-end mt-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditingEntry(null);
                        setEditContent({ title: "", content: "" });
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleUpdate}
                      className="bg-[#93b747] hover:bg-[#7a9a3a]"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Update
                    </Button>
                  </div>
                </>
              ) : (
                // View mode
                <>
                  {entry.id.includes('_conflicted_copy') && (
                    <div className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded mb-2 inline-block">
                      ⚠️ Conflicted Copy
                    </div>
                  )}
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-bold text-black flex-1">{entry.title}</h3>
                    <span className="text-sm text-gray-500 ml-2">
                      {new Date(entry.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-gray-600 mt-2 whitespace-pre-wrap">{entry.content}</p>
                  <div className="flex gap-2 justify-end mt-3 pt-3 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingEntry(entry.id);
                        setEditContent({ title: entry.title, content: entry.content });
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(entry.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </main>

      {/* Lock button */}
      <div className="fixed bottom-4 right-4">
        <Button
          onClick={lock}
          variant="outline"
          className="bg-black border-white text-white hover:bg-gray-900"
        >
          <Lock className="w-4 h-4 mr-2" />
          Lock
        </Button>
      </div>
    </div>
  );
};
