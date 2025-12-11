/**
 * Cloud Storage Types & Schema
 * 
 * Shared types for cloud storage providers.
 * Designed to be reusable across projects.
 */

// ============================================================================
// PROVIDER TYPES
// ============================================================================

export type CloudProvider = 
  | 'dropbox' 
  | 'google_drive' 
  | 'onedrive' 
  | 'box' 
  | 'webdav' 
  | 'sftp';

export type AuthMethod = 'oauth' | 'credentials';

export interface ProviderInfo {
  id: CloudProvider;
  name: string;
  icon: string;
  authMethod: AuthMethod;
  description: string;
  setupUrl?: string; // Link to developer console for OAuth setup
}

export const CLOUD_PROVIDERS: Record<CloudProvider, ProviderInfo> = {
  dropbox: {
    id: 'dropbox',
    name: 'Dropbox',
    icon: 'dropbox',
    authMethod: 'oauth',
    description: 'Store files in your Dropbox account',
    setupUrl: 'https://www.dropbox.com/developers/apps',
  },
  google_drive: {
    id: 'google_drive',
    name: 'Google Drive',
    icon: 'google-drive',
    authMethod: 'oauth',
    description: 'Store files in Google Drive',
    setupUrl: 'https://console.cloud.google.com/',
  },
  onedrive: {
    id: 'onedrive',
    name: 'OneDrive',
    icon: 'microsoft-onedrive',
    authMethod: 'oauth',
    description: 'Store files in Microsoft OneDrive',
    setupUrl: 'https://portal.azure.com/',
  },
  box: {
    id: 'box',
    name: 'Box',
    icon: 'box',
    authMethod: 'oauth',
    description: 'Store files in Box cloud storage',
    setupUrl: 'https://developer.box.com/',
  },
  webdav: {
    id: 'webdav',
    name: 'WebDAV',
    icon: 'server',
    authMethod: 'credentials',
    description: 'Connect to any WebDAV server',
  },
  sftp: {
    id: 'sftp',
    name: 'SFTP / SSH',
    icon: 'terminal',
    authMethod: 'credentials',
    description: 'Connect via SFTP to your own server',
  },
};

// ============================================================================
// CONNECTION TYPES
// ============================================================================

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number; // Unix timestamp
  tokenType?: string;
  scope?: string;
}

export interface CredentialAuth {
  serverUrl: string;
  username: string;
  password?: string;
  privateKey?: string; // For SFTP with key auth
  port?: number;
  basePath?: string; // Root folder path on server
}

export interface CloudConnection {
  id: string;
  userId: string;
  provider: CloudProvider;
  displayName: string; // User-friendly name like "My Dropbox"
  
  // Auth data (one of these will be set based on provider)
  oauthTokens?: OAuthTokens;
  credentials?: CredentialAuth;
  
  // Sync settings
  syncFolderPath: string; // Path in cloud storage where app stores files
  isDefault: boolean; // Is this the default connection for this user?
  
  // Status
  isConnected: boolean;
  lastSyncAt?: number;
  lastError?: string;
  
  // Metadata
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// FILE TYPES
// ============================================================================

export interface CloudFile {
  id: string; // Provider's file ID
  name: string;
  path: string; // Full path in cloud storage
  mimeType: string;
  size: number;
  checksum?: string; // MD5 or SHA for conflict detection
  
  // Timestamps
  createdAt?: number;
  modifiedAt: number;
  
  // For folders
  isFolder: boolean;
  
  // Provider-specific metadata
  providerMetadata?: Record<string, unknown>;
}

export interface FileContent {
  data: string | ArrayBuffer;
  encoding: 'utf-8' | 'base64' | 'binary';
  mimeType: string;
}

// ============================================================================
// SYNC TYPES
// ============================================================================

export type SyncStatus = 
  | 'synced' 
  | 'pending' 
  | 'syncing' 
  | 'conflict' 
  | 'error'
  | 'offline';

export interface SyncQueueItem {
  id: string;
  localId: string; // Local file/entry ID
  connectionId: string;
  action: 'upload' | 'download' | 'delete';
  filePath: string;
  status: SyncStatus;
  retryCount: number;
  lastAttempt?: number;
  error?: string;
  createdAt: number;
}

export interface SyncResult {
  success: boolean;
  action: 'uploaded' | 'downloaded' | 'deleted' | 'conflict' | 'skipped';
  localId: string;
  cloudFile?: CloudFile;
  error?: string;
  conflictCopyPath?: string; // Path to conflict copy if created
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface CloudStorageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

export interface ListFilesResponse {
  files: CloudFile[];
  hasMore: boolean;
  cursor?: string; // For pagination
}

// ============================================================================
// FEATURE FLAGS & CONFIG
// ============================================================================

export interface CloudStorageConfig {
  // Feature toggle - can be overridden for testing
  enabled: boolean;
  
  // Require premium subscription (set false for testing)
  requirePremium: boolean;
  
  // Sync settings
  autoSyncEnabled: boolean;
  syncOnFocusLost: boolean;
  syncOnAppStart: boolean;
  syncIntervalMs: number; // Background sync interval
  
  // Offline settings
  offlineQueueEnabled: boolean;
  maxOfflineQueueSize: number; // Max items to queue offline
  
  // Conflict handling
  conflictStrategy: 'create_copy' | 'prefer_local' | 'prefer_cloud' | 'ask_user';
  
  // File settings
  maxFileSizeMb: number;
  allowedMimeTypes: string[]; // Empty = allow all
  
  // App-specific folder name in cloud storage
  appFolderName: string;
}

export const DEFAULT_CLOUD_STORAGE_CONFIG: CloudStorageConfig = {
  enabled: true,
  requirePremium: false, // Set to true for production
  
  autoSyncEnabled: true,
  syncOnFocusLost: true,
  syncOnAppStart: true,
  syncIntervalMs: 30000, // 30 seconds
  
  offlineQueueEnabled: true,
  maxOfflineQueueSize: 100,
  
  conflictStrategy: 'create_copy',
  
  maxFileSizeMb: 50,
  allowedMimeTypes: [], // Allow all
  
  appFolderName: 'Create App',
};
