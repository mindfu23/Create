/**
 * Cloud Storage React Hook
 * 
 * Provides React components access to cloud storage functionality.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { 
  CloudConnection, 
  CloudProvider, 
  SyncStatus,
  CredentialAuth,
  CloudFile,
} from '@shared/cloudStorage';
import { CLOUD_PROVIDERS } from '@shared/cloudStorage';
import { ConnectionManager } from './connectionManager';
import { CloudSyncService } from './syncService';
import { 
  getCloudStorageConfig, 
  isCloudStorageAvailable, 
  getEnabledProviders,
  CLOUD_STORAGE_FLAGS,
} from './config';
import type { CloudStorageEnv } from './providers';

// Get environment variables (these should be set in your Vite config or similar)
const getEnv = (): CloudStorageEnv => ({
  DROPBOX_CLIENT_ID: import.meta.env.VITE_DROPBOX_CLIENT_ID,
  DROPBOX_CLIENT_SECRET: import.meta.env.VITE_DROPBOX_CLIENT_SECRET,
  GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: import.meta.env.VITE_GOOGLE_CLIENT_SECRET,
  ONEDRIVE_CLIENT_ID: import.meta.env.VITE_ONEDRIVE_CLIENT_ID,
  ONEDRIVE_CLIENT_SECRET: import.meta.env.VITE_ONEDRIVE_CLIENT_SECRET,
  BOX_CLIENT_ID: import.meta.env.VITE_BOX_CLIENT_ID,
  BOX_CLIENT_SECRET: import.meta.env.VITE_BOX_CLIENT_SECRET,
});

interface UseCloudStorageOptions {
  userId: string;
  isPremiumUser?: boolean;
  autoSync?: boolean;
}

interface UseCloudStorageReturn {
  // Feature availability
  isAvailable: boolean;
  enabledProviders: CloudProvider[];
  
  // Connections
  connections: CloudConnection[];
  activeConnection: CloudConnection | null;
  isLoading: boolean;
  
  // Sync status
  syncStatus: SyncStatus;
  pendingCount: number;
  errorCount: number;
  
  // Actions
  connectProvider: (provider: CloudProvider) => void;
  connectWithCredentials: (
    provider: CloudProvider,
    credentials: CredentialAuth,
    displayName: string
  ) => Promise<boolean>;
  disconnect: (connectionId: string) => Promise<void>;
  deleteConnection: (connectionId: string) => Promise<void>;
  setDefaultConnection: (connectionId: string) => Promise<void>;
  testConnection: (connectionId: string) => Promise<boolean>;
  
  // Sync operations
  syncNow: () => Promise<void>;
  queueSync: (
    localId: string,
    action: 'upload' | 'download' | 'delete',
    fileType: 'journal' | 'project' | 'todo' | 'graphic'
  ) => Promise<void>;
  
  // File operations
  listFiles: (path?: string) => Promise<CloudFile[]>;
  uploadFile: (localId: string, content: any, filePath: string) => Promise<boolean>;
  downloadFile: (cloudPath: string) => Promise<any | null>;
  
  // Refresh
  refresh: () => Promise<void>;
}

export function useCloudStorage(options: UseCloudStorageOptions): UseCloudStorageReturn {
  const { userId, isPremiumUser = false, autoSync = true } = options;
  
  const [connections, setConnections] = useState<CloudConnection[]>([]);
  const [activeConnection, setActiveConnection] = useState<CloudConnection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [pendingCount, setPendingCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  
  const connectionManagerRef = useRef<ConnectionManager | null>(null);
  const syncServiceRef = useRef<CloudSyncService | null>(null);
  
  // Feature availability
  const isAvailable = isCloudStorageAvailable(isPremiumUser);
  const enabledProviders = getEnabledProviders();
  
  // Initialize managers
  useEffect(() => {
    if (!isAvailable || !userId) return;
    
    const env = getEnv();
    connectionManagerRef.current = new ConnectionManager(userId, env);
    syncServiceRef.current = new CloudSyncService(connectionManagerRef.current);
    
    // Set up sync status listener
    const unsubscribe = syncServiceRef.current.onStatusChange((status) => {
      setSyncStatus(status);
    });
    
    // Start periodic sync if enabled
    if (autoSync) {
      syncServiceRef.current.startPeriodicSync();
    }
    
    // Load connections
    loadConnections();
    
    return () => {
      unsubscribe();
      syncServiceRef.current?.stopPeriodicSync();
    };
  }, [userId, isAvailable, autoSync]);
  
  // Handle OAuth callback
  useEffect(() => {
    if (!isAvailable) return;
    
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const tokens = params.get('tokens');
    const error = params.get('error');
    
    if (error) {
      console.error('OAuth error:', decodeURIComponent(error));
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }
    
    if (success === 'true' && tokens) {
      // Complete OAuth flow
      handleOAuthComplete(tokens);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [isAvailable]);
  
  // Load connections
  const loadConnections = useCallback(async () => {
    if (!connectionManagerRef.current) return;
    
    setIsLoading(true);
    try {
      const conns = await connectionManagerRef.current.getConnections();
      setConnections(conns);
      
      const defaultConn = conns.find(c => c.isDefault) || conns[0] || null;
      setActiveConnection(defaultConn);
      
      // Update sync status
      if (syncServiceRef.current) {
        const status = await syncServiceRef.current.getOverallStatus();
        setSyncStatus(status.status);
        setPendingCount(status.pendingCount);
        setErrorCount(status.errorCount);
      }
    } catch (error) {
      console.error('Failed to load connections:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Handle OAuth completion
  const handleOAuthComplete = useCallback(async (encodedTokens: string) => {
    if (!connectionManagerRef.current) return;
    
    try {
      const tokenData = JSON.parse(atob(encodedTokens));
      
      // The oauth-callback function returns tokens directly
      // We need to complete the connection creation
      const result = await connectionManagerRef.current.completeOAuthFlow(
        tokenData.provider,
        tokenData.accessToken, // This is actually the code from the callback
        undefined
      );
      
      if (result.success) {
        await loadConnections();
      } else {
        console.error('Failed to complete OAuth:', result.error);
      }
    } catch (error) {
      console.error('Failed to handle OAuth completion:', error);
    }
  }, [loadConnections]);
  
  // Connect to OAuth provider
  const connectProvider = useCallback((provider: CloudProvider) => {
    if (!connectionManagerRef.current) return;
    
    try {
      const authUrl = connectionManagerRef.current.startOAuthFlow(provider);
      window.location.href = authUrl;
    } catch (error) {
      console.error('Failed to start OAuth:', error);
    }
  }, []);
  
  // Connect with credentials
  const connectWithCredentials = useCallback(async (
    provider: CloudProvider,
    credentials: CredentialAuth,
    displayName: string
  ): Promise<boolean> => {
    if (!connectionManagerRef.current) return false;
    
    try {
      const result = await connectionManagerRef.current.connectWithCredentials(
        provider,
        credentials,
        displayName
      );
      
      if (result.success) {
        await loadConnections();
        return true;
      } else {
        console.error('Connection failed:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Failed to connect:', error);
      return false;
    }
  }, [loadConnections]);
  
  // Disconnect
  const disconnect = useCallback(async (connectionId: string) => {
    if (!connectionManagerRef.current) return;
    
    await connectionManagerRef.current.disconnect(connectionId);
    await loadConnections();
  }, [loadConnections]);
  
  // Delete connection
  const deleteConnection = useCallback(async (connectionId: string) => {
    if (!connectionManagerRef.current) return;
    
    await connectionManagerRef.current.deleteConnection(connectionId);
    await loadConnections();
  }, [loadConnections]);
  
  // Set default connection
  const setDefaultConnection = useCallback(async (connectionId: string) => {
    if (!connectionManagerRef.current) return;
    
    await connectionManagerRef.current.setDefault(connectionId);
    await loadConnections();
  }, [loadConnections]);
  
  // Test connection
  const testConnection = useCallback(async (connectionId: string): Promise<boolean> => {
    if (!connectionManagerRef.current) return false;
    
    const result = await connectionManagerRef.current.testConnection(connectionId);
    await loadConnections();
    return result.success;
  }, [loadConnections]);
  
  // Sync now
  const syncNow = useCallback(async () => {
    if (!syncServiceRef.current) return;
    await syncServiceRef.current.syncAll();
  }, []);
  
  // Queue sync
  const queueSync = useCallback(async (
    localId: string,
    action: 'upload' | 'download' | 'delete',
    fileType: 'journal' | 'project' | 'todo' | 'graphic'
  ) => {
    if (!syncServiceRef.current || !activeConnection) return;
    
    const config = getCloudStorageConfig();
    const filePath = `/${config.appFolderName}/${fileType}s/${localId}.json`;
    
    await syncServiceRef.current.queueSync(
      localId,
      activeConnection.id,
      action,
      filePath
    );
  }, [activeConnection]);
  
  // List files
  const listFiles = useCallback(async (path = '/'): Promise<CloudFile[]> => {
    if (!connectionManagerRef.current || !activeConnection) return [];
    
    const provider = await connectionManagerRef.current.getProvider(activeConnection.id);
    if (!provider) return [];
    
    const result = await provider.listFiles(path);
    return result.success ? result.data?.files || [] : [];
  }, [activeConnection]);
  
  // Upload file
  const uploadFile = useCallback(async (
    localId: string,
    content: any,
    filePath: string
  ): Promise<boolean> => {
    if (!connectionManagerRef.current || !activeConnection) return false;
    
    const provider = await connectionManagerRef.current.getProvider(activeConnection.id);
    if (!provider) return false;
    
    const result = await provider.writeFile(filePath, {
      data: typeof content === 'string' ? content : JSON.stringify(content),
      encoding: 'utf-8',
      mimeType: 'application/json',
    });
    
    return result.success;
  }, [activeConnection]);
  
  // Download file
  const downloadFile = useCallback(async (cloudPath: string): Promise<any | null> => {
    if (!connectionManagerRef.current || !activeConnection) return null;
    
    const provider = await connectionManagerRef.current.getProvider(activeConnection.id);
    if (!provider) return null;
    
    // First get the file by path
    const fileResult = await provider.getFileByPath(cloudPath);
    if (!fileResult.success || !fileResult.data) return null;
    
    const result = await provider.readFile(fileResult.data.id);
    if (!result.success || !result.data) return null;
    
    try {
      return typeof result.data.data === 'string' 
        ? JSON.parse(result.data.data)
        : result.data.data;
    } catch {
      return result.data.data;
    }
  }, [activeConnection]);
  
  // Refresh
  const refresh = useCallback(async () => {
    await loadConnections();
  }, [loadConnections]);
  
  return {
    isAvailable,
    enabledProviders,
    connections,
    activeConnection,
    isLoading,
    syncStatus,
    pendingCount,
    errorCount,
    connectProvider,
    connectWithCredentials,
    disconnect,
    deleteConnection,
    setDefaultConnection,
    testConnection,
    syncNow,
    queueSync,
    listFiles,
    uploadFile,
    downloadFile,
    refresh,
  };
}

/**
 * Hook for getting provider info
 */
export function useCloudProviders() {
  const enabledProviders = getEnabledProviders();
  
  return enabledProviders.map(id => ({
    ...CLOUD_PROVIDERS[id],
    isConfigured: isProviderConfigured(id),
  }));
}

/**
 * Check if a provider has its credentials configured
 */
function isProviderConfigured(provider: CloudProvider): boolean {
  const env = getEnv();
  
  switch (provider) {
    case 'dropbox':
      return !!(env.DROPBOX_CLIENT_ID && env.DROPBOX_CLIENT_SECRET);
    case 'google_drive':
      return !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
    case 'onedrive':
      return !!(env.ONEDRIVE_CLIENT_ID && env.ONEDRIVE_CLIENT_SECRET);
    case 'box':
      return !!(env.BOX_CLIENT_ID && env.BOX_CLIENT_SECRET);
    case 'webdav':
    case 'sftp':
      return true; // Credential-based, always "configured"
    default:
      return false;
  }
}
