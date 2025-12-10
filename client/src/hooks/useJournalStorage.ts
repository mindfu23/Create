/**
 * React Hook for Journal Storage with Encryption and Sync
 * Handles local encrypted storage + server sync
 */

import { useState, useEffect, useCallback } from 'react';
import {
  JournalEntry,
  saveEntry,
  getAllEntries,
  getEntry,
  deleteEntry,
  getUnsyncedEntries,
  markAsSynced,
  importEntries,
  getOrCreateDeviceId,
  clearAllData,
} from '@/lib/storage';
import { verifyPassword } from '@/lib/encryption';

interface UseJournalStorageOptions {
  autoSync?: boolean;
  syncInterval?: number; // ms
}

interface SyncStatus {
  isSyncing: boolean;
  lastSync?: string;
  error?: string;
}

export function useJournalStorage(options: UseJournalStorageOptions = {}) {
  const { autoSync = true, syncInterval = 60000 } = options;

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [encryptionKey, setEncryptionKey] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ isSyncing: false });
  const [error, setError] = useState<string | null>(null);

  // Initialize device ID
  useEffect(() => {
    getOrCreateDeviceId().then(setDeviceId);
  }, []);

  // Load entries when unlocked
  const loadEntries = useCallback(async () => {
    if (!encryptionKey) return;

    setIsLoading(true);
    setError(null);

    try {
      const loadedEntries = await getAllEntries(encryptionKey);
      // Sort by updatedAt descending
      loadedEntries.sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      setEntries(loadedEntries);
    } catch (err) {
      console.error('Failed to load entries:', err);
      setError('Failed to load entries. Wrong password?');
    } finally {
      setIsLoading(false);
    }
  }, [encryptionKey]);

  // Unlock storage with password
  const unlock = useCallback(async (password: string, userIdentifier: string): Promise<boolean> => {
    try {
      // Try to load existing entries to verify password
      const existingEntries = await getAllEntries(password);
      
      setEncryptionKey(password);
      setUserId(userIdentifier);
      setIsUnlocked(true);
      setEntries(existingEntries.sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ));
      setIsLoading(false);
      
      return true;
    } catch (err) {
      // If there are existing entries and decryption failed, wrong password
      // If no entries exist, this is a new setup
      setEncryptionKey(password);
      setUserId(userIdentifier);
      setIsUnlocked(true);
      setEntries([]);
      setIsLoading(false);
      
      return true;
    }
  }, []);

  // Lock storage (clear key from memory)
  const lock = useCallback(() => {
    setEncryptionKey(null);
    setIsUnlocked(false);
    setEntries([]);
    setUserId(null);
  }, []);

  // Create new entry
  const createEntry = useCallback(async (title: string, content: string): Promise<JournalEntry | null> => {
    if (!encryptionKey) {
      setError('Storage is locked');
      return null;
    }

    try {
      const now = new Date().toISOString();
      const newEntry = await saveEntry(
        {
          id: `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title,
          content,
          createdAt: now,
          updatedAt: now,
        },
        encryptionKey
      );

      // Reload entries to get decrypted version
      await loadEntries();
      
      return newEntry;
    } catch (err) {
      console.error('Failed to create entry:', err);
      setError('Failed to save entry');
      return null;
    }
  }, [encryptionKey, loadEntries]);

  // Update entry
  const updateEntry = useCallback(async (
    id: string, 
    updates: Partial<Pick<JournalEntry, 'title' | 'content'>>
  ): Promise<JournalEntry | null> => {
    if (!encryptionKey) {
      setError('Storage is locked');
      return null;
    }

    try {
      const existing = await getEntry(id, encryptionKey);
      if (!existing) {
        setError('Entry not found');
        return null;
      }

      const updatedEntry = await saveEntry(
        {
          ...existing,
          ...updates,
          updatedAt: new Date().toISOString(),
        },
        encryptionKey
      );

      await loadEntries();
      
      return updatedEntry;
    } catch (err) {
      console.error('Failed to update entry:', err);
      setError('Failed to update entry');
      return null;
    }
  }, [encryptionKey, loadEntries]);

  // Delete entry
  const removeEntry = useCallback(async (id: string): Promise<boolean> => {
    try {
      await deleteEntry(id);
      await loadEntries();
      return true;
    } catch (err) {
      console.error('Failed to delete entry:', err);
      setError('Failed to delete entry');
      return false;
    }
  }, [loadEntries]);

  // Sync with server
  const syncWithServer = useCallback(async (): Promise<{ success: boolean; pushed?: number; pulled?: number; conflicts?: number }> => {
    if (!encryptionKey || !userId || !deviceId) {
      return { success: false };
    }

    setSyncStatus(prev => ({ ...prev, isSyncing: true, error: undefined }));

    try {
      // Get unsynced local entries
      const unsyncedEntries = await getUnsyncedEntries();

      // Push to server
      if (unsyncedEntries.length > 0) {
        const pushResponse = await fetch('/api/journal-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'push',
            userId,
            deviceId,
            entries: unsyncedEntries,
          }),
        });

        if (pushResponse.ok) {
          const pushResult = await pushResponse.json();
          
          // Mark successfully pushed entries as synced
          for (const entry of unsyncedEntries) {
            const isConflict = pushResult.conflicts?.some((c: any) => c.id === entry.id);
            if (!isConflict) {
              await markAsSynced(entry.id);
            }
          }
        }
      }

      // Pull from server
      const pullResponse = await fetch('/api/journal-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pull',
          userId,
          deviceId,
          lastSyncTime: syncStatus.lastSync,
        }),
      });

      let pulled = 0;
      let conflicts = 0;

      if (pullResponse.ok) {
        const pullResult = await pullResponse.json();
        
        if (pullResult.entries && pullResult.entries.length > 0) {
          const importResult = await importEntries(pullResult.entries, encryptionKey);
          pulled = importResult.imported;
          conflicts = importResult.conflicts;
        }
      }

      // Reload entries
      await loadEntries();

      const syncTime = new Date().toISOString();
      setSyncStatus({
        isSyncing: false,
        lastSync: syncTime,
      });

      return {
        success: true,
        pushed: unsyncedEntries.length,
        pulled,
        conflicts,
      };

    } catch (err) {
      console.error('Sync failed:', err);
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        error: 'Sync failed. Will retry.',
      }));
      return { success: false };
    }
  }, [encryptionKey, userId, deviceId, syncStatus.lastSync, loadEntries]);

  // Auto-sync
  useEffect(() => {
    if (!autoSync || !isUnlocked || !encryptionKey) return;

    // Initial sync
    syncWithServer();

    // Periodic sync
    const interval = setInterval(syncWithServer, syncInterval);
    
    return () => clearInterval(interval);
  }, [autoSync, isUnlocked, encryptionKey, syncInterval, syncWithServer]);

  // Clear all data
  const resetStorage = useCallback(async () => {
    await clearAllData();
    setEntries([]);
    setIsUnlocked(false);
    setEncryptionKey(null);
    setUserId(null);
  }, []);

  return {
    // State
    entries,
    isLoading,
    isUnlocked,
    syncStatus,
    error,
    deviceId,

    // Actions
    unlock,
    lock,
    createEntry,
    updateEntry,
    removeEntry,
    syncWithServer,
    resetStorage,
    loadEntries,
  };
}
