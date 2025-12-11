/**
 * Cloud Storage Provider Interface
 * 
 * Base interface that all cloud storage providers must implement.
 * This allows for consistent API across different providers.
 */

import type { 
  CloudFile, 
  FileContent, 
  ListFilesResponse, 
  CloudStorageResponse,
  OAuthTokens,
  CredentialAuth,
} from '@shared/cloudStorage';

export interface ICloudStorageProvider {
  // Provider identification
  readonly providerId: string;
  readonly displayName: string;
  
  // Authentication
  isAuthenticated(): boolean;
  getAuthUrl(redirectUri: string, state: string): string;
  handleAuthCallback(code: string, redirectUri: string): Promise<CloudStorageResponse<OAuthTokens>>;
  refreshToken(refreshToken: string): Promise<CloudStorageResponse<OAuthTokens>>;
  disconnect(): Promise<void>;
  
  // For credential-based auth (WebDAV, SFTP)
  connectWithCredentials?(credentials: CredentialAuth): Promise<CloudStorageResponse<boolean>>;
  testConnection?(): Promise<CloudStorageResponse<boolean>>;
  
  // File operations
  listFiles(path: string, cursor?: string): Promise<CloudStorageResponse<ListFilesResponse>>;
  getFile(fileId: string): Promise<CloudStorageResponse<CloudFile>>;
  getFileByPath(path: string): Promise<CloudStorageResponse<CloudFile>>;
  readFile(fileId: string): Promise<CloudStorageResponse<FileContent>>;
  writeFile(path: string, content: FileContent, overwrite?: boolean): Promise<CloudStorageResponse<CloudFile>>;
  deleteFile(fileId: string): Promise<CloudStorageResponse<boolean>>;
  moveFile(fileId: string, newPath: string): Promise<CloudStorageResponse<CloudFile>>;
  copyFile(fileId: string, newPath: string): Promise<CloudStorageResponse<CloudFile>>;
  
  // Folder operations
  createFolder(path: string): Promise<CloudStorageResponse<CloudFile>>;
  
  // Metadata
  getQuota?(): Promise<CloudStorageResponse<{ used: number; total: number }>>;
  getAccountInfo?(): Promise<CloudStorageResponse<{ email?: string; name?: string }>>;
}

/**
 * Base class with common functionality for OAuth-based providers
 */
export abstract class OAuthProvider implements ICloudStorageProvider {
  abstract readonly providerId: string;
  abstract readonly displayName: string;
  
  protected tokens: OAuthTokens | null = null;
  
  constructor(tokens?: OAuthTokens) {
    if (tokens) {
      this.tokens = tokens;
    }
  }
  
  setTokens(tokens: OAuthTokens): void {
    this.tokens = tokens;
  }
  
  getTokens(): OAuthTokens | null {
    return this.tokens;
  }
  
  isAuthenticated(): boolean {
    if (!this.tokens?.accessToken) return false;
    
    // Check if token is expired
    if (this.tokens.expiresAt && Date.now() > this.tokens.expiresAt) {
      return false;
    }
    
    return true;
  }
  
  async disconnect(): Promise<void> {
    this.tokens = null;
  }
  
  protected getAuthHeader(): string {
    if (!this.tokens?.accessToken) {
      throw new Error('Not authenticated');
    }
    return `Bearer ${this.tokens.accessToken}`;
  }
  
  // Abstract methods that each provider must implement
  abstract getAuthUrl(redirectUri: string, state: string): string;
  abstract handleAuthCallback(code: string, redirectUri: string): Promise<CloudStorageResponse<OAuthTokens>>;
  abstract refreshToken(refreshToken: string): Promise<CloudStorageResponse<OAuthTokens>>;
  abstract listFiles(path: string, cursor?: string): Promise<CloudStorageResponse<ListFilesResponse>>;
  abstract getFile(fileId: string): Promise<CloudStorageResponse<CloudFile>>;
  abstract getFileByPath(path: string): Promise<CloudStorageResponse<CloudFile>>;
  abstract readFile(fileId: string): Promise<CloudStorageResponse<FileContent>>;
  abstract writeFile(path: string, content: FileContent, overwrite?: boolean): Promise<CloudStorageResponse<CloudFile>>;
  abstract deleteFile(fileId: string): Promise<CloudStorageResponse<boolean>>;
  abstract moveFile(fileId: string, newPath: string): Promise<CloudStorageResponse<CloudFile>>;
  abstract copyFile(fileId: string, newPath: string): Promise<CloudStorageResponse<CloudFile>>;
  abstract createFolder(path: string): Promise<CloudStorageResponse<CloudFile>>;
}

/**
 * Base class for credential-based providers (WebDAV, SFTP)
 */
export abstract class CredentialProvider implements ICloudStorageProvider {
  abstract readonly providerId: string;
  abstract readonly displayName: string;
  
  protected credentials: CredentialAuth | null = null;
  protected connected: boolean = false;
  
  setCredentials(credentials: CredentialAuth): void {
    this.credentials = credentials;
  }
  
  isAuthenticated(): boolean {
    return this.connected && this.credentials !== null;
  }
  
  async disconnect(): Promise<void> {
    this.credentials = null;
    this.connected = false;
  }
  
  // OAuth methods not applicable - throw errors
  getAuthUrl(): string {
    throw new Error('OAuth not supported for credential-based providers');
  }
  
  async handleAuthCallback(): Promise<CloudStorageResponse<OAuthTokens>> {
    throw new Error('OAuth not supported for credential-based providers');
  }
  
  async refreshToken(): Promise<CloudStorageResponse<OAuthTokens>> {
    throw new Error('OAuth not supported for credential-based providers');
  }
  
  // Abstract methods
  abstract connectWithCredentials(credentials: CredentialAuth): Promise<CloudStorageResponse<boolean>>;
  abstract testConnection(): Promise<CloudStorageResponse<boolean>>;
  abstract listFiles(path: string, cursor?: string): Promise<CloudStorageResponse<ListFilesResponse>>;
  abstract getFile(fileId: string): Promise<CloudStorageResponse<CloudFile>>;
  abstract getFileByPath(path: string): Promise<CloudStorageResponse<CloudFile>>;
  abstract readFile(fileId: string): Promise<CloudStorageResponse<FileContent>>;
  abstract writeFile(path: string, content: FileContent, overwrite?: boolean): Promise<CloudStorageResponse<CloudFile>>;
  abstract deleteFile(fileId: string): Promise<CloudStorageResponse<boolean>>;
  abstract moveFile(fileId: string, newPath: string): Promise<CloudStorageResponse<CloudFile>>;
  abstract copyFile(fileId: string, newPath: string): Promise<CloudStorageResponse<CloudFile>>;
  abstract createFolder(path: string): Promise<CloudStorageResponse<CloudFile>>;
}
