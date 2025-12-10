/**
 * Local Storage Service for Journal Entries
 * Handles encrypted storage on device using IndexedDB
 * Works on web, iOS (Capacitor), and Android (Capacitor)
 */

import { encrypt, decrypt, hash } from './encryption';

export interface JournalEntry {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  checksum: string; // SHA-256 hash of content for conflict detection
  syncedAt?: string; // Last sync time with server
  isDeleted?: boolean; // Soft delete for sync
}

export interface StorageMetadata {
  version: number;
  lastSync?: string;
  deviceId: string;
}

const DB_NAME = 'create_journal_db';
const DB_VERSION = 1;
const ENTRIES_STORE = 'journal_entries';
const METADATA_STORE = 'metadata';

/**
 * Initialize IndexedDB
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Journal entries store
      if (!db.objectStoreNames.contains(ENTRIES_STORE)) {
        const entriesStore = db.createObjectStore(ENTRIES_STORE, { keyPath: 'id' });
        entriesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        entriesStore.createIndex('syncedAt', 'syncedAt', { unique: false });
      }
      
      // Metadata store
      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        db.createObjectStore(METADATA_STORE, { keyPath: 'key' });
      }
    };
  });
}

/**
 * Generate unique device ID (persisted locally)
 */
async function getOrCreateDeviceId(): Promise<string> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(METADATA_STORE, 'readwrite');
    const store = transaction.objectStore(METADATA_STORE);
    
    const getRequest = store.get('deviceId');
    
    getRequest.onsuccess = () => {
      if (getRequest.result) {
        resolve(getRequest.result.value);
      } else {
        const deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        store.put({ key: 'deviceId', value: deviceId });
        resolve(deviceId);
      }
    };
    
    getRequest.onerror = () => reject(getRequest.error);
  });
}

/**
 * Save encrypted journal entry to local storage
 */
export async function saveEntry(entry: Omit<JournalEntry, 'checksum'>, encryptionKey: string): Promise<JournalEntry> {
  const db = await openDatabase();
  
  // Generate checksum of content
  const checksum = await hash(entry.content);
  
  // Encrypt sensitive fields
  const encryptedTitle = await encrypt(entry.title, encryptionKey);
  const encryptedContent = await encrypt(entry.content, encryptionKey);
  
  const encryptedEntry: JournalEntry = {
    ...entry,
    title: encryptedTitle,
    content: encryptedContent,
    checksum,
    updatedAt: new Date().toISOString(),
  };
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ENTRIES_STORE, 'readwrite');
    const store = transaction.objectStore(ENTRIES_STORE);
    
    const request = store.put(encryptedEntry);
    
    request.onsuccess = () => resolve(encryptedEntry);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all journal entries (decrypted)
 */
export async function getAllEntries(encryptionKey: string): Promise<JournalEntry[]> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ENTRIES_STORE, 'readonly');
    const store = transaction.objectStore(ENTRIES_STORE);
    
    const request = store.getAll();
    
    request.onsuccess = async () => {
      const entries = request.result.filter((e: JournalEntry) => !e.isDeleted);
      
      // Decrypt all entries
      const decryptedEntries = await Promise.all(
        entries.map(async (entry: JournalEntry) => {
          try {
            return {
              ...entry,
              title: await decrypt(entry.title, encryptionKey),
              content: await decrypt(entry.content, encryptionKey),
            };
          } catch (error) {
            console.error('Failed to decrypt entry:', entry.id, error);
            return null;
          }
        })
      );
      
      resolve(decryptedEntries.filter(Boolean) as JournalEntry[]);
    };
    
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get single entry by ID (decrypted)
 */
export async function getEntry(id: string, encryptionKey: string): Promise<JournalEntry | null> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ENTRIES_STORE, 'readonly');
    const store = transaction.objectStore(ENTRIES_STORE);
    
    const request = store.get(id);
    
    request.onsuccess = async () => {
      if (!request.result || request.result.isDeleted) {
        resolve(null);
        return;
      }
      
      try {
        const entry = request.result;
        resolve({
          ...entry,
          title: await decrypt(entry.title, encryptionKey),
          content: await decrypt(entry.content, encryptionKey),
        });
      } catch (error) {
        console.error('Failed to decrypt entry:', id, error);
        resolve(null);
      }
    };
    
    request.onerror = () => reject(request.error);
  });
}

/**
 * Soft delete entry (marks as deleted for sync)
 */
export async function deleteEntry(id: string): Promise<void> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ENTRIES_STORE, 'readwrite');
    const store = transaction.objectStore(ENTRIES_STORE);
    
    const getRequest = store.get(id);
    
    getRequest.onsuccess = () => {
      if (getRequest.result) {
        const entry = getRequest.result;
        entry.isDeleted = true;
        entry.updatedAt = new Date().toISOString();
        
        const putRequest = store.put(entry);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        resolve();
      }
    };
    
    getRequest.onerror = () => reject(getRequest.error);
  });
}

/**
 * Get entries that need syncing (updated since last sync)
 */
export async function getUnsyncedEntries(): Promise<JournalEntry[]> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ENTRIES_STORE, 'readonly');
    const store = transaction.objectStore(ENTRIES_STORE);
    
    const request = store.getAll();
    
    request.onsuccess = () => {
      const entries = request.result.filter((entry: JournalEntry) => {
        // Entry needs sync if never synced or updated after last sync
        if (!entry.syncedAt) return true;
        return new Date(entry.updatedAt) > new Date(entry.syncedAt);
      });
      
      resolve(entries);
    };
    
    request.onerror = () => reject(request.error);
  });
}

/**
 * Mark entry as synced
 */
export async function markAsSynced(id: string): Promise<void> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ENTRIES_STORE, 'readwrite');
    const store = transaction.objectStore(ENTRIES_STORE);
    
    const getRequest = store.get(id);
    
    getRequest.onsuccess = () => {
      if (getRequest.result) {
        const entry = getRequest.result;
        entry.syncedAt = new Date().toISOString();
        
        const putRequest = store.put(entry);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        resolve();
      }
    };
    
    getRequest.onerror = () => reject(getRequest.error);
  });
}

/**
 * Handle conflict by creating a conflicted copy
 */
export async function createConflictedCopy(
  originalEntry: JournalEntry, 
  conflictingEntry: JournalEntry,
  encryptionKey: string
): Promise<JournalEntry> {
  // Decrypt the conflicting entry's title
  let decryptedTitle: string;
  try {
    decryptedTitle = await decrypt(conflictingEntry.title, encryptionKey);
  } catch {
    decryptedTitle = conflictingEntry.title;
  }
  
  const conflictedEntry: Omit<JournalEntry, 'checksum'> = {
    id: `${conflictingEntry.id}_conflicted_copy_${Date.now()}`,
    title: `${decryptedTitle}_conflicted_copy`,
    content: conflictingEntry.content, // Keep encrypted content
    createdAt: conflictingEntry.createdAt,
    updatedAt: new Date().toISOString(),
  };
  
  // Re-encrypt the title
  const db = await openDatabase();
  const checksum = await hash(conflictingEntry.content);
  const encryptedTitle = await encrypt(conflictedEntry.title, encryptionKey);
  
  const finalEntry: JournalEntry = {
    ...conflictedEntry,
    title: encryptedTitle,
    checksum,
  };
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ENTRIES_STORE, 'readwrite');
    const store = transaction.objectStore(ENTRIES_STORE);
    
    const request = store.put(finalEntry);
    
    request.onsuccess = () => resolve(finalEntry);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Import entries from server (for sync)
 */
export async function importEntries(
  serverEntries: JournalEntry[], 
  encryptionKey: string
): Promise<{ imported: number; conflicts: number }> {
  const db = await openDatabase();
  let imported = 0;
  let conflicts = 0;
  
  for (const serverEntry of serverEntries) {
    const localEntry = await new Promise<JournalEntry | null>((resolve, reject) => {
      const transaction = db.transaction(ENTRIES_STORE, 'readonly');
      const store = transaction.objectStore(ENTRIES_STORE);
      const request = store.get(serverEntry.id);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    
    if (!localEntry) {
      // No local version, just import
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(ENTRIES_STORE, 'readwrite');
        const store = transaction.objectStore(ENTRIES_STORE);
        const request = store.put({
          ...serverEntry,
          syncedAt: new Date().toISOString(),
        });
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      imported++;
    } else if (localEntry.checksum !== serverEntry.checksum) {
      // Content differs - check which is newer
      const localUpdated = new Date(localEntry.updatedAt);
      const serverUpdated = new Date(serverEntry.updatedAt);
      
      if (serverUpdated > localUpdated) {
        // Server is newer - create conflicted copy of local, import server
        await createConflictedCopy(serverEntry, localEntry, encryptionKey);
        
        await new Promise<void>((resolve, reject) => {
          const transaction = db.transaction(ENTRIES_STORE, 'readwrite');
          const store = transaction.objectStore(ENTRIES_STORE);
          const request = store.put({
            ...serverEntry,
            syncedAt: new Date().toISOString(),
          });
          
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
        conflicts++;
      } else {
        // Local is newer - keep local, will be pushed on next sync
        conflicts++;
      }
    }
    // If checksums match, entries are identical - no action needed
  }
  
  return { imported, conflicts };
}

/**
 * Export device ID for sync identification
 */
export { getOrCreateDeviceId };

/**
 * Clear all local data (for logout/reset)
 */
export async function clearAllData(): Promise<void> {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([ENTRIES_STORE, METADATA_STORE], 'readwrite');
    
    transaction.objectStore(ENTRIES_STORE).clear();
    transaction.objectStore(METADATA_STORE).clear();
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
