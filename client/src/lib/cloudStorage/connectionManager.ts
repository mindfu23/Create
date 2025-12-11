/**
 * Cloud Storage Connection Manager
 * 
 * Manages cloud storage connections, including:
 * - Storing/retrieving connections from IndexedDB
 * - OAuth token management and refresh
 * - Connection lifecycle
 */

import type { 
  CloudConnection, 
  CloudProvider, 
  OAuthTokens, 
  CredentialAuth,
  CloudStorageResponse,
} from '@shared/cloudStorage';
import { CLOUD_PROVIDERS } from '@shared/cloudStorage';
import { createProvider, type ICloudStorageProvider, type CloudStorageEnv } from './providers';
import { STORAGE_KEYS, CLOUD_STORAGE_FLAGS, getOAuthRedirectUri, generateOAuthState } from './config';

// IndexedDB for connection storage
const DB_NAME = 'create-cloud-storage';
const DB_VERSION = 1;
const STORE_NAME = 'connections';

let db: IDBDatabase | null = null;

/**
 * Initialize IndexedDB
 */
async function initDB(): Promise<IDBDatabase> {
  if (db) return db;
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('provider', 'provider', { unique: false });
      }
    };
  });
}

/**
 * Connection Manager Class
 */
export class ConnectionManager {
  private userId: string;
  private env: CloudStorageEnv;
  private activeProviders: Map<string, ICloudStorageProvider> = new Map();
  
  constructor(userId: string, env: CloudStorageEnv) {
    this.userId = userId;
    this.env = env;
  }
  
  /**
   * Get all connections for the current user
   */
  async getConnections(): Promise<CloudConnection[]> {
    const database = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('userId');
      const request = index.getAll(this.userId);
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Get a specific connection
   */
  async getConnection(connectionId: string): Promise<CloudConnection | null> {
    const database = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(connectionId);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Get the default connection for the user
   */
  async getDefaultConnection(): Promise<CloudConnection | null> {
    const connections = await this.getConnections();
    return connections.find(c => c.isDefault) || connections[0] || null;
  }
  
  /**
   * Save a connection
   */
  async saveConnection(connection: CloudConnection): Promise<void> {
    const database = await initDB();
    
    // If this is the default, unset others
    if (connection.isDefault) {
      const connections = await this.getConnections();
      for (const c of connections) {
        if (c.id !== connection.id && c.isDefault) {
          c.isDefault = false;
          await this.saveConnection(c);
        }
      }
    }
    
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(connection);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Delete a connection
   */
  async deleteConnection(connectionId: string): Promise<void> {
    const database = await initDB();
    
    // Disconnect provider if active
    this.activeProviders.delete(connectionId);
    
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(connectionId);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Start OAuth flow for a provider
   */
  startOAuthFlow(provider: CloudProvider): string {
    const state = generateOAuthState(provider, this.userId);
    
    // Store state for validation on callback
    localStorage.setItem(STORAGE_KEYS.OAUTH_STATE, state);
    
    // Create temporary provider to get auth URL
    const tempProvider = createProvider(provider, this.env);
    if (!tempProvider) {
      throw new Error(`Provider ${provider} not configured`);
    }
    
    const redirectUri = getOAuthRedirectUri(provider);
    return tempProvider.getAuthUrl(redirectUri, state);
  }
  
  /**
   * Complete OAuth flow after callback
   */
  async completeOAuthFlow(
    provider: CloudProvider,
    code: string,
    displayName?: string
  ): Promise<CloudStorageResponse<CloudConnection>> {
    try {
      const tempProvider = createProvider(provider, this.env);
      if (!tempProvider) {
        return { success: false, error: `Provider ${provider} not configured` };
      }
      
      const redirectUri = getOAuthRedirectUri(provider);
      const tokenResult = await tempProvider.handleAuthCallback(code, redirectUri);
      
      if (!tokenResult.success || !tokenResult.data) {
        return { success: false, error: tokenResult.error || 'Failed to get tokens' };
      }
      
      // Get account info for display name
      let accountName = displayName;
      if (!accountName && tempProvider.getAccountInfo) {
        const accountResult = await tempProvider.getAccountInfo();
        if (accountResult.success && accountResult.data) {
          accountName = accountResult.data.name || accountResult.data.email;
        }
      }
      
      // Create connection
      const connection: CloudConnection = {
        id: `${provider}_${Date.now()}`,
        userId: this.userId,
        provider,
        displayName: accountName || CLOUD_PROVIDERS[provider].name,
        oauthTokens: tokenResult.data,
        syncFolderPath: '/Create App',
        isDefault: (await this.getConnections()).length === 0,
        isConnected: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      
      await this.saveConnection(connection);
      
      // Clear OAuth state
      localStorage.removeItem(STORAGE_KEYS.OAUTH_STATE);
      
      return { success: true, data: connection };
    } catch (error) {
      return { success: false, error: `OAuth completion error: ${error}` };
    }
  }
  
  /**
   * Connect with credentials (WebDAV/SFTP)
   */
  async connectWithCredentials(
    provider: CloudProvider,
    credentials: CredentialAuth,
    displayName: string
  ): Promise<CloudStorageResponse<CloudConnection>> {
    try {
      const providerInstance = createProvider(provider, this.env, undefined, credentials);
      if (!providerInstance) {
        return { success: false, error: `Provider ${provider} not supported` };
      }
      
      // Test connection
      if (providerInstance.connectWithCredentials) {
        const connectResult = await providerInstance.connectWithCredentials(credentials);
        if (!connectResult.success) {
          return { success: false, error: connectResult.error || 'Connection failed' };
        }
      }
      
      // Create connection
      const connection: CloudConnection = {
        id: `${provider}_${Date.now()}`,
        userId: this.userId,
        provider,
        displayName,
        credentials,
        syncFolderPath: credentials.basePath || '/Create App',
        isDefault: (await this.getConnections()).length === 0,
        isConnected: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      
      await this.saveConnection(connection);
      
      return { success: true, data: connection };
    } catch (error) {
      return { success: false, error: `Connection error: ${error}` };
    }
  }
  
  /**
   * Get provider instance for a connection
   */
  async getProvider(connectionId: string): Promise<ICloudStorageProvider | null> {
    // Check cache
    if (this.activeProviders.has(connectionId)) {
      const provider = this.activeProviders.get(connectionId)!;
      
      // Check if still authenticated
      if (provider.isAuthenticated()) {
        return provider;
      }
    }
    
    // Load connection
    const connection = await this.getConnection(connectionId);
    if (!connection) {
      return null;
    }
    
    // Create provider
    const provider = createProvider(
      connection.provider,
      this.env,
      connection.oauthTokens,
      connection.credentials
    );
    
    if (!provider) {
      return null;
    }
    
    // Refresh token if needed for OAuth providers
    if (connection.oauthTokens && !provider.isAuthenticated()) {
      if (connection.oauthTokens.refreshToken) {
        const refreshResult = await provider.refreshToken(connection.oauthTokens.refreshToken);
        
        if (refreshResult.success && refreshResult.data) {
          // Update stored tokens
          connection.oauthTokens = refreshResult.data;
          connection.updatedAt = Date.now();
          await this.saveConnection(connection);
        } else {
          // Mark connection as disconnected
          connection.isConnected = false;
          connection.lastError = 'Token refresh failed';
          await this.saveConnection(connection);
          return null;
        }
      } else {
        connection.isConnected = false;
        connection.lastError = 'Token expired and no refresh token';
        await this.saveConnection(connection);
        return null;
      }
    }
    
    // Cache provider
    this.activeProviders.set(connectionId, provider);
    
    return provider;
  }
  
  /**
   * Test a connection
   */
  async testConnection(connectionId: string): Promise<CloudStorageResponse<boolean>> {
    const provider = await this.getProvider(connectionId);
    if (!provider) {
      return { success: false, error: 'Failed to get provider' };
    }
    
    try {
      // Try to list root directory
      const result = await provider.listFiles('/');
      
      if (result.success) {
        // Update connection status
        const connection = await this.getConnection(connectionId);
        if (connection) {
          connection.isConnected = true;
          connection.lastError = undefined;
          connection.updatedAt = Date.now();
          await this.saveConnection(connection);
        }
        
        return { success: true, data: true };
      }
      
      return { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: `Test failed: ${error}` };
    }
  }
  
  /**
   * Disconnect a connection
   */
  async disconnect(connectionId: string): Promise<void> {
    const provider = this.activeProviders.get(connectionId);
    if (provider) {
      await provider.disconnect();
      this.activeProviders.delete(connectionId);
    }
    
    const connection = await this.getConnection(connectionId);
    if (connection) {
      connection.isConnected = false;
      connection.updatedAt = Date.now();
      await this.saveConnection(connection);
    }
  }
  
  /**
   * Set a connection as default
   */
  async setDefault(connectionId: string): Promise<void> {
    const connections = await this.getConnections();
    
    for (const connection of connections) {
      connection.isDefault = connection.id === connectionId;
      connection.updatedAt = Date.now();
      await this.saveConnection(connection);
    }
  }
}
