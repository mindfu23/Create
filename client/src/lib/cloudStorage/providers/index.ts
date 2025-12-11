/**
 * Cloud Storage Providers - Index
 * 
 * Exports all cloud storage providers and factory function.
 */

export { OAuthProvider, CredentialProvider } from './base';
export type { ICloudStorageProvider } from './base';

export { DropboxProvider } from './dropbox';
export { GoogleDriveProvider } from './googleDrive';
export { OneDriveProvider } from './onedrive';
export { BoxProvider } from './box';
export { WebDAVProvider } from './webdav';
export { SFTPProvider } from './sftp';

import type { CloudProvider, OAuthTokens, CredentialAuth } from '@shared/cloudStorage';
import type { ICloudStorageProvider } from './base';
import { DropboxProvider } from './dropbox';
import { GoogleDriveProvider } from './googleDrive';
import { OneDriveProvider } from './onedrive';
import { BoxProvider } from './box';
import { WebDAVProvider } from './webdav';
import { SFTPProvider } from './sftp';

/**
 * Environment variables for OAuth credentials
 * These should be set in your .env file or Netlify environment
 */
export interface CloudStorageEnv {
  DROPBOX_CLIENT_ID?: string;
  DROPBOX_CLIENT_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  ONEDRIVE_CLIENT_ID?: string;
  ONEDRIVE_CLIENT_SECRET?: string;
  BOX_CLIENT_ID?: string;
  BOX_CLIENT_SECRET?: string;
}

/**
 * Create a provider instance
 */
export function createProvider(
  providerId: CloudProvider,
  env: CloudStorageEnv,
  tokens?: OAuthTokens,
  credentials?: CredentialAuth
): ICloudStorageProvider | null {
  switch (providerId) {
    case 'dropbox':
      if (!env.DROPBOX_CLIENT_ID || !env.DROPBOX_CLIENT_SECRET) {
        console.error('Dropbox credentials not configured');
        return null;
      }
      return new DropboxProvider(
        env.DROPBOX_CLIENT_ID,
        env.DROPBOX_CLIENT_SECRET,
        tokens
      );
      
    case 'google_drive':
      if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
        console.error('Google Drive credentials not configured');
        return null;
      }
      return new GoogleDriveProvider(
        env.GOOGLE_CLIENT_ID,
        env.GOOGLE_CLIENT_SECRET,
        tokens
      );
      
    case 'onedrive':
      if (!env.ONEDRIVE_CLIENT_ID || !env.ONEDRIVE_CLIENT_SECRET) {
        console.error('OneDrive credentials not configured');
        return null;
      }
      return new OneDriveProvider(
        env.ONEDRIVE_CLIENT_ID,
        env.ONEDRIVE_CLIENT_SECRET,
        tokens
      );
      
    case 'box':
      if (!env.BOX_CLIENT_ID || !env.BOX_CLIENT_SECRET) {
        console.error('Box credentials not configured');
        return null;
      }
      return new BoxProvider(
        env.BOX_CLIENT_ID,
        env.BOX_CLIENT_SECRET,
        tokens
      );
      
    case 'webdav':
      const webdav = new WebDAVProvider();
      if (credentials) {
        webdav.setCredentials(credentials);
      }
      return webdav;
      
    case 'sftp':
      const sftp = new SFTPProvider();
      if (credentials) {
        sftp.setCredentials(credentials);
      }
      return sftp;
      
    default:
      console.error(`Unknown provider: ${providerId}`);
      return null;
  }
}
