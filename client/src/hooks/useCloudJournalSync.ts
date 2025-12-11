/**
 * Cloud Journal Sync Hook
 * 
 * Integrates cloud storage with journal entries for backup and sync.
 * Wraps the journal storage hook and adds cloud storage sync capabilities.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useCloudStorage } from '@/lib/cloudStorage';
import { SyncService } from '@/lib/cloudStorage/syncService';
import type { CloudStorageEnv } from '@/lib/cloudStorage/providers';
import type { JournalEntry } from '@/lib/storage';

// Get environment variables for cloud storage
const getCloudEnv = (): CloudStorageEnv => ({
  DROPBOX_CLIENT_ID: import.meta.env.VITE_DROPBOX_CLIENT_ID || '',
  DROPBOX_CLIENT_SECRET: import.meta.env.VITE_DROPBOX_CLIENT_SECRET || '',
  GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: import.meta.env.VITE_GOOGLE_CLIENT_SECRET || '',
  ONEDRIVE_CLIENT_ID: import.meta.env.VITE_ONEDRIVE_CLIENT_ID || '',
  ONEDRIVE_CLIENT_SECRET: import.meta.env.VITE_ONEDRIVE_CLIENT_SECRET || '',
  BOX_CLIENT_ID: import.meta.env.VITE_BOX_CLIENT_ID || '',
  BOX_CLIENT_SECRET: import.meta.env.VITE_BOX_CLIENT_SECRET || '',
});

interface UseCloudJournalSyncOptions {
  userId: string;
  isPremiumUser?: boolean;
  entries: JournalEntry[];
  encryptionKey: string | null;
  enabled?: boolean;
}

interface UseCloudJournalSyncReturn {
  // State
  isCloudEnabled: boolean;
  hasActiveConnection: boolean;
  cloudSyncStatus: 'idle' | 'syncing' | 'error' | 'offline';
  pendingUploads: number;
  
  // Actions
  syncToCloud: () => Promise<void>;
  downloadFromCloud: () => Promise<JournalEntry[]>;
}

// Cloud folder path for journal backups
const CLOUD_JOURNAL_FOLDER = '/CreateCamp/Journal';
const CLOUD_BACKUP_FILE = 'journal-backup.json';

export function useCloudJournalSync(options: UseCloudJournalSyncOptions): UseCloudJournalSyncReturn {
  const { userId, isPremiumUser = false, entries, encryptionKey, enabled = true } = options;
  
  const syncServiceRef = useRef<SyncService | null>(null);
  
  const {
    isAvailable,
    activeConnection,
    syncStatus,
    pendingCount,
  } = useCloudStorage({ userId, isPremiumUser });
  
  // Initialize sync service when connection is available
  useEffect(() => {
    if (!isAvailable || !activeConnection || !enabled) {
      syncServiceRef.current = null;
      return;
    }
    
    // Create sync service for this connection
    syncServiceRef.current = new SyncService(
      userId,
      getCloudEnv(),
      {
        autoSync: true,
        syncOnFocusLost: true,
        syncOnReconnect: true,
        conflictResolution: 'create_copy',
        maxRetries: 3,
      }
    );
    
    return () => {
      syncServiceRef.current?.destroy();
      syncServiceRef.current = null;
    };
  }, [userId, isAvailable, activeConnection, enabled]);
  
  // Sync journal entries to cloud
  const syncToCloud = useCallback(async () => {
    if (!syncServiceRef.current || !activeConnection || !encryptionKey) {
      return;
    }
    
    const syncService = syncServiceRef.current;
    
    // Prepare backup data (entries are already encrypted in storage)
    const backupData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      deviceId: localStorage.getItem('device_id') || 'unknown',
      entries: entries.map(entry => ({
        id: entry.id,
        title: entry.title,
        // Note: Content is encrypted at rest in IndexedDB, 
        // but we're exporting the decrypted view here.
        // For true E2E encryption in cloud, we'd re-encrypt with user's key
        content: entry.content,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      })),
    };
    
    const content = JSON.stringify(backupData, null, 2);
    const filePath = `${CLOUD_JOURNAL_FOLDER}/${CLOUD_BACKUP_FILE}`;
    
    // Queue the sync
    await syncService.queueSync(
      activeConnection.id,
      filePath,
      content,
      'text/json'
    );
  }, [activeConnection, entries, encryptionKey]);
  
  // Download journal entries from cloud
  const downloadFromCloud = useCallback(async (): Promise<JournalEntry[]> => {
    if (!syncServiceRef.current || !activeConnection) {
      return [];
    }
    
    const syncService = syncServiceRef.current;
    const filePath = `${CLOUD_JOURNAL_FOLDER}/${CLOUD_BACKUP_FILE}`;
    
    try {
      const content = await syncService.downloadFile(activeConnection.id, filePath);
      
      if (!content) {
        return [];
      }
      
      const backupData = JSON.parse(content);
      
      if (!backupData.entries || !Array.isArray(backupData.entries)) {
        return [];
      }
      
      return backupData.entries as JournalEntry[];
    } catch (error) {
      console.error('Failed to download from cloud:', error);
      return [];
    }
  }, [activeConnection]);
  
  // Auto-sync on entry changes (debounced)
  useEffect(() => {
    if (!enabled || !activeConnection || entries.length === 0) {
      return;
    }
    
    // Debounce sync by 5 seconds after entry changes
    const timeout = setTimeout(() => {
      syncToCloud();
    }, 5000);
    
    return () => clearTimeout(timeout);
  }, [enabled, activeConnection, entries, syncToCloud]);
  
  // Determine cloud sync status
  const cloudSyncStatus = !isAvailable || !activeConnection 
    ? 'idle'
    : syncStatus === 'syncing' 
      ? 'syncing'
      : syncStatus === 'error'
        ? 'error'
        : syncStatus === 'offline'
          ? 'offline'
          : 'idle';
  
  return {
    isCloudEnabled: isAvailable && enabled,
    hasActiveConnection: !!activeConnection,
    cloudSyncStatus,
    pendingUploads: pendingCount,
    syncToCloud,
    downloadFromCloud,
  };
}
