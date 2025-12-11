/**
 * Cloud Storage Module - Main Export
 * 
 * This module provides cloud storage integration for the Create app.
 * Supports: Dropbox, Google Drive, OneDrive, Box, WebDAV, SFTP
 */

// Types and schemas
export * from '@shared/cloudStorage';

// Configuration
export {
  CLOUD_STORAGE_FLAGS,
  getCloudStorageConfig,
  updateCloudStorageConfig,
  isCloudStorageAvailable,
  getEnabledProviders,
  getOAuthRedirectUri,
  generateOAuthState,
  parseOAuthState,
  getAppFolderPath,
  getCloudPath,
  getConflictCopyPath,
  STORAGE_KEYS,
} from './config';

// Connection management
export { ConnectionManager } from './connectionManager';

// Sync service
export { CloudSyncService } from './syncService';

// Providers
export {
  createProvider,
  DropboxProvider,
  GoogleDriveProvider,
  OneDriveProvider,
  BoxProvider,
  WebDAVProvider,
  SFTPProvider,
} from './providers';

export type { ICloudStorageProvider, CloudStorageEnv } from './providers';

// React hooks
export { useCloudStorage, useCloudProviders } from './useCloudStorage';
