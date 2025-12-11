/**
 * Cloud Sync Service
 * 
 * Handles file synchronization between local storage and cloud providers.
 * Features:
 * - Background sync on focus lost
 * - Offline queue with automatic retry
 * - Conflict detection and resolution
 * - Sync on app start when connectivity restored
 */

import type { 
  CloudFile, 
  FileContent, 
  SyncQueueItem, 
  SyncResult,
  SyncStatus,
  CloudStorageConfig,
} from '@shared/cloudStorage';
import { ConnectionManager } from './connectionManager';
import { 
  getCloudStorageConfig, 
  getCloudPath, 
  getConflictCopyPath,
  STORAGE_KEYS,
  CLOUD_STORAGE_FLAGS,
} from './config';

// IndexedDB for sync queue
const SYNC_DB_NAME = 'create-cloud-sync';
const SYNC_DB_VERSION = 1;
const QUEUE_STORE = 'sync_queue';
const CACHE_STORE = 'file_cache';

let syncDb: IDBDatabase | null = null;

/**
 * Initialize sync database
 */
async function initSyncDB(): Promise<IDBDatabase> {
  if (syncDb) return syncDb;
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SYNC_DB_NAME, SYNC_DB_VERSION);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      syncDb = request.result;
      resolve(syncDb);
    };
    
    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      
      if (!database.objectStoreNames.contains(QUEUE_STORE)) {
        const queueStore = database.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
        queueStore.createIndex('status', 'status', { unique: false });
        queueStore.createIndex('connectionId', 'connectionId', { unique: false });
      }
      
      if (!database.objectStoreNames.contains(CACHE_STORE)) {
        const cacheStore = database.createObjectStore(CACHE_STORE, { keyPath: 'id' });
        cacheStore.createIndex('connectionId', 'connectionId', { unique: false });
      }
    };
  });
}

/**
 * Check if we're online
 */
function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

/**
 * Compute checksum for content
 */
async function computeChecksum(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Cloud Sync Service
 */
export class CloudSyncService {
  private connectionManager: ConnectionManager;
  private config: CloudStorageConfig;
  private syncInProgress: boolean = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private listeners: Set<(status: SyncStatus) => void> = new Set();
  
  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
    this.config = getCloudStorageConfig();
    
    // Initialize event listeners
    this.setupEventListeners();
  }
  
  /**
   * Set up event listeners for sync triggers
   */
  private setupEventListeners(): void {
    if (typeof window === 'undefined') return;
    
    // Sync on visibility change (focus lost)
    if (this.config.syncOnFocusLost) {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.syncAll().catch(console.error);
        }
      });
      
      // Also sync on blur
      window.addEventListener('blur', () => {
        this.syncAll().catch(console.error);
      });
    }
    
    // Sync on online status change
    window.addEventListener('online', () => {
      if (CLOUD_STORAGE_FLAGS.debugMode) {
        console.log('[CloudSync] Online - processing queue');
      }
      this.processQueue().catch(console.error);
    });
    
    // Handle app start sync
    if (this.config.syncOnAppStart) {
      this.syncOnAppStart();
    }
  }
  
  /**
   * Sync on app start
   */
  private async syncOnAppStart(): Promise<void> {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.syncOnAppStart());
      return;
    }
    
    // Process any pending queue items
    if (isOnline()) {
      await this.processQueue();
      await this.syncAll();
    }
  }
  
  /**
   * Start periodic background sync
   */
  startPeriodicSync(): void {
    if (this.syncInterval) return;
    
    this.syncInterval = setInterval(() => {
      if (isOnline() && !this.syncInProgress) {
        this.syncAll().catch(console.error);
      }
    }, this.config.syncIntervalMs);
  }
  
  /**
   * Stop periodic sync
   */
  stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
  
  /**
   * Add a status listener
   */
  onStatusChange(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  /**
   * Notify status listeners
   */
  private notifyStatus(status: SyncStatus): void {
    this.listeners.forEach(listener => listener(status));
  }
  
  /**
   * Queue a file for sync
   */
  async queueSync(
    localId: string,
    connectionId: string,
    action: 'upload' | 'download' | 'delete',
    filePath: string
  ): Promise<void> {
    const database = await initSyncDB();
    
    const item: SyncQueueItem = {
      id: `${connectionId}_${localId}_${Date.now()}`,
      localId,
      connectionId,
      action,
      filePath,
      status: isOnline() ? 'pending' : 'offline',
      retryCount: 0,
      createdAt: Date.now(),
    };
    
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(QUEUE_STORE, 'readwrite');
      const store = transaction.objectStore(QUEUE_STORE);
      const request = store.put(item);
      
      request.onsuccess = () => {
        if (CLOUD_STORAGE_FLAGS.debugMode) {
          console.log('[CloudSync] Queued:', item);
        }
        
        // Process immediately if online
        if (isOnline()) {
          this.processQueue().catch(console.error);
        }
        
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Get pending queue items
   */
  async getQueueItems(connectionId?: string): Promise<SyncQueueItem[]> {
    const database = await initSyncDB();
    
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(QUEUE_STORE, 'readonly');
      const store = transaction.objectStore(QUEUE_STORE);
      
      let request: IDBRequest;
      if (connectionId) {
        const index = store.index('connectionId');
        request = index.getAll(connectionId);
      } else {
        request = store.getAll();
      }
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Remove item from queue
   */
  private async removeFromQueue(itemId: string): Promise<void> {
    const database = await initSyncDB();
    
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(QUEUE_STORE, 'readwrite');
      const store = transaction.objectStore(QUEUE_STORE);
      const request = store.delete(itemId);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Update queue item
   */
  private async updateQueueItem(item: SyncQueueItem): Promise<void> {
    const database = await initSyncDB();
    
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(QUEUE_STORE, 'readwrite');
      const store = transaction.objectStore(QUEUE_STORE);
      const request = store.put(item);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Process the sync queue
   */
  async processQueue(): Promise<void> {
    if (this.syncInProgress || !isOnline()) return;
    
    this.syncInProgress = true;
    this.notifyStatus('syncing');
    
    try {
      const items = await this.getQueueItems();
      
      for (const item of items) {
        // Skip items that have failed too many times
        if (item.retryCount >= 3) {
          item.status = 'error';
          item.error = 'Max retries exceeded';
          await this.updateQueueItem(item);
          continue;
        }
        
        try {
          const result = await this.processQueueItem(item);
          
          if (result.success) {
            await this.removeFromQueue(item.id);
          } else {
            item.retryCount++;
            item.lastAttempt = Date.now();
            item.error = result.error;
            await this.updateQueueItem(item);
          }
        } catch (error) {
          item.retryCount++;
          item.lastAttempt = Date.now();
          item.error = String(error);
          await this.updateQueueItem(item);
        }
      }
      
      this.notifyStatus('synced');
    } catch (error) {
      console.error('[CloudSync] Queue processing error:', error);
      this.notifyStatus('error');
    } finally {
      this.syncInProgress = false;
    }
  }
  
  /**
   * Process a single queue item
   */
  private async processQueueItem(item: SyncQueueItem): Promise<SyncResult> {
    const provider = await this.connectionManager.getProvider(item.connectionId);
    
    if (!provider) {
      return { 
        success: false, 
        action: 'skipped', 
        localId: item.localId,
        error: 'Provider not available',
      };
    }
    
    switch (item.action) {
      case 'upload':
        return this.uploadFile(provider, item);
        
      case 'download':
        return this.downloadFile(provider, item);
        
      case 'delete':
        return this.deleteFile(provider, item);
        
      default:
        return { 
          success: false, 
          action: 'skipped', 
          localId: item.localId,
          error: 'Unknown action',
        };
    }
  }
  
  /**
   * Upload a file to cloud storage
   */
  private async uploadFile(
    provider: any, // ICloudStorageProvider
    item: SyncQueueItem
  ): Promise<SyncResult> {
    // Get local file content (this would come from your local storage)
    // For now, we'll assume it's passed via the queue item or cached
    
    // This is a placeholder - you'll need to integrate with your local storage
    const localContent = await this.getLocalFileContent(item.localId);
    
    if (!localContent) {
      return {
        success: false,
        action: 'skipped',
        localId: item.localId,
        error: 'Local file not found',
      };
    }
    
    // Check for conflicts
    const existingFile = await provider.getFileByPath(item.filePath);
    
    if (existingFile.success && existingFile.data) {
      // File exists - check for conflict
      const localChecksum = await computeChecksum(
        typeof localContent.data === 'string' 
          ? localContent.data 
          : JSON.stringify(localContent.data)
      );
      
      if (existingFile.data.checksum && existingFile.data.checksum !== localChecksum) {
        // Conflict detected
        if (this.config.conflictStrategy === 'create_copy') {
          // Upload as conflict copy
          const conflictPath = getConflictCopyPath(item.filePath);
          const writeResult = await provider.writeFile(conflictPath, localContent);
          
          if (writeResult.success) {
            return {
              success: true,
              action: 'conflict',
              localId: item.localId,
              cloudFile: writeResult.data,
              conflictCopyPath: conflictPath,
            };
          }
        }
        // For other strategies, let the upload proceed (will overwrite)
      }
    }
    
    // Upload file
    const writeResult = await provider.writeFile(item.filePath, localContent, true);
    
    if (writeResult.success) {
      return {
        success: true,
        action: 'uploaded',
        localId: item.localId,
        cloudFile: writeResult.data,
      };
    }
    
    return {
      success: false,
      action: 'skipped',
      localId: item.localId,
      error: writeResult.error,
    };
  }
  
  /**
   * Download a file from cloud storage
   */
  private async downloadFile(
    provider: any,
    item: SyncQueueItem
  ): Promise<SyncResult> {
    const readResult = await provider.readFile(item.filePath);
    
    if (!readResult.success || !readResult.data) {
      return {
        success: false,
        action: 'skipped',
        localId: item.localId,
        error: readResult.error || 'Failed to read file',
      };
    }
    
    // Save to local storage
    await this.saveLocalFileContent(item.localId, readResult.data);
    
    return {
      success: true,
      action: 'downloaded',
      localId: item.localId,
    };
  }
  
  /**
   * Delete a file from cloud storage
   */
  private async deleteFile(
    provider: any,
    item: SyncQueueItem
  ): Promise<SyncResult> {
    // First, get the file to find its ID
    const fileResult = await provider.getFileByPath(item.filePath);
    
    if (!fileResult.success || !fileResult.data) {
      // File doesn't exist - consider this a success
      return {
        success: true,
        action: 'deleted',
        localId: item.localId,
      };
    }
    
    const deleteResult = await provider.deleteFile(fileResult.data.id);
    
    if (deleteResult.success) {
      return {
        success: true,
        action: 'deleted',
        localId: item.localId,
      };
    }
    
    return {
      success: false,
      action: 'skipped',
      localId: item.localId,
      error: deleteResult.error,
    };
  }
  
  /**
   * Sync all pending changes
   */
  async syncAll(): Promise<void> {
    if (!isOnline()) {
      this.notifyStatus('offline');
      return;
    }
    
    await this.processQueue();
  }
  
  /**
   * Get local file content
   * Override this method to integrate with your local storage
   */
  protected async getLocalFileContent(localId: string): Promise<FileContent | null> {
    // This is a placeholder - integrate with your local storage
    // For example, read from IndexedDB for journals, projects, etc.
    
    const database = await initSyncDB();
    
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(CACHE_STORE, 'readonly');
      const store = transaction.objectStore(CACHE_STORE);
      const request = store.get(localId);
      
      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          resolve({
            data: result.content,
            encoding: 'utf-8',
            mimeType: result.mimeType || 'application/json',
          });
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Save local file content
   * Override this method to integrate with your local storage
   */
  protected async saveLocalFileContent(localId: string, content: FileContent): Promise<void> {
    // This is a placeholder - integrate with your local storage
    
    const database = await initSyncDB();
    
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(CACHE_STORE, 'readwrite');
      const store = transaction.objectStore(CACHE_STORE);
      const request = store.put({
        id: localId,
        content: content.data,
        mimeType: content.mimeType,
        updatedAt: Date.now(),
      });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Cache content for upload
   */
  async cacheForSync(
    localId: string,
    content: any,
    mimeType = 'application/json'
  ): Promise<void> {
    const database = await initSyncDB();
    
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(CACHE_STORE, 'readwrite');
      const store = transaction.objectStore(CACHE_STORE);
      const request = store.put({
        id: localId,
        content: typeof content === 'string' ? content : JSON.stringify(content),
        mimeType,
        updatedAt: Date.now(),
      });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Get sync status for a local item
   */
  async getSyncStatus(localId: string): Promise<SyncStatus> {
    const items = await this.getQueueItems();
    const item = items.find(i => i.localId === localId);
    
    if (!item) {
      return 'synced';
    }
    
    return item.status;
  }
  
  /**
   * Get overall sync status
   */
  async getOverallStatus(): Promise<{ 
    status: SyncStatus; 
    pendingCount: number; 
    errorCount: number;
  }> {
    const items = await this.getQueueItems();
    
    const pendingCount = items.filter(
      i => i.status === 'pending' || i.status === 'offline'
    ).length;
    
    const errorCount = items.filter(i => i.status === 'error').length;
    
    let status: SyncStatus = 'synced';
    
    if (!isOnline()) {
      status = 'offline';
    } else if (this.syncInProgress) {
      status = 'syncing';
    } else if (errorCount > 0) {
      status = 'error';
    } else if (pendingCount > 0) {
      status = 'pending';
    }
    
    return { status, pendingCount, errorCount };
  }
}
