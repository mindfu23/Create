/**
 * Dropbox Provider
 * 
 * Implements cloud storage interface for Dropbox.
 * Uses Dropbox API v2.
 * 
 * Setup: Create app at https://www.dropbox.com/developers/apps
 * Required scopes: files.metadata.read, files.content.read, files.content.write
 */

import { OAuthProvider } from './base';
import type { 
  CloudFile, 
  FileContent, 
  ListFilesResponse, 
  CloudStorageResponse,
  OAuthTokens,
} from '@shared/cloudStorage';

const DROPBOX_AUTH_URL = 'https://www.dropbox.com/oauth2/authorize';
const DROPBOX_TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';
const DROPBOX_API_URL = 'https://api.dropboxapi.com/2';
const DROPBOX_CONTENT_URL = 'https://content.dropboxapi.com/2';

export class DropboxProvider extends OAuthProvider {
  readonly providerId = 'dropbox';
  readonly displayName = 'Dropbox';
  
  private clientId: string;
  private clientSecret: string;
  
  constructor(clientId: string, clientSecret: string, tokens?: OAuthTokens) {
    super(tokens);
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }
  
  getAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state: state,
      token_access_type: 'offline', // Get refresh token
    });
    
    return `${DROPBOX_AUTH_URL}?${params.toString()}`;
  }
  
  async handleAuthCallback(code: string, redirectUri: string): Promise<CloudStorageResponse<OAuthTokens>> {
    try {
      const response = await fetch(DROPBOX_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Auth failed: ${error}` };
      }
      
      const data = await response.json();
      
      const tokens: OAuthTokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_in ? Date.now() + (data.expires_in * 1000) : undefined,
        tokenType: data.token_type,
        scope: data.scope,
      };
      
      this.setTokens(tokens);
      return { success: true, data: tokens };
    } catch (error) {
      return { success: false, error: `Auth error: ${error}` };
    }
  }
  
  async refreshToken(refreshToken: string): Promise<CloudStorageResponse<OAuthTokens>> {
    try {
      const response = await fetch(DROPBOX_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Token refresh failed: ${error}` };
      }
      
      const data = await response.json();
      
      const tokens: OAuthTokens = {
        accessToken: data.access_token,
        refreshToken: refreshToken, // Dropbox keeps the same refresh token
        expiresAt: data.expires_in ? Date.now() + (data.expires_in * 1000) : undefined,
        tokenType: data.token_type,
      };
      
      this.setTokens(tokens);
      return { success: true, data: tokens };
    } catch (error) {
      return { success: false, error: `Token refresh error: ${error}` };
    }
  }
  
  async listFiles(path: string, cursor?: string): Promise<CloudStorageResponse<ListFilesResponse>> {
    try {
      let response;
      
      if (cursor) {
        // Continue listing with cursor
        response = await fetch(`${DROPBOX_API_URL}/files/list_folder/continue`, {
          method: 'POST',
          headers: {
            'Authorization': this.getAuthHeader(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ cursor }),
        });
      } else {
        // Initial list
        response = await fetch(`${DROPBOX_API_URL}/files/list_folder`, {
          method: 'POST',
          headers: {
            'Authorization': this.getAuthHeader(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            path: path === '/' ? '' : path,
            recursive: false,
            include_media_info: false,
            include_deleted: false,
          }),
        });
      }
      
      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `List failed: ${error}` };
      }
      
      const data = await response.json();
      
      const files: CloudFile[] = data.entries.map((entry: any) => this.mapToCloudFile(entry));
      
      return {
        success: true,
        data: {
          files,
          hasMore: data.has_more,
          cursor: data.cursor,
        },
      };
    } catch (error) {
      return { success: false, error: `List error: ${error}` };
    }
  }
  
  async getFile(fileId: string): Promise<CloudStorageResponse<CloudFile>> {
    try {
      const response = await fetch(`${DROPBOX_API_URL}/files/get_metadata`, {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: fileId }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Get file failed: ${error}` };
      }
      
      const data = await response.json();
      return { success: true, data: this.mapToCloudFile(data) };
    } catch (error) {
      return { success: false, error: `Get file error: ${error}` };
    }
  }
  
  async getFileByPath(path: string): Promise<CloudStorageResponse<CloudFile>> {
    return this.getFile(path); // Dropbox uses path as ID
  }
  
  async readFile(fileId: string): Promise<CloudStorageResponse<FileContent>> {
    try {
      const response = await fetch(`${DROPBOX_CONTENT_URL}/files/download`, {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Dropbox-API-Arg': JSON.stringify({ path: fileId }),
        },
      });
      
      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Read failed: ${error}` };
      }
      
      const metadata = JSON.parse(response.headers.get('Dropbox-API-Result') || '{}');
      const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
      
      // Determine if text or binary
      const isText = contentType.startsWith('text/') || 
                     contentType.includes('json') || 
                     contentType.includes('xml');
      
      let data: string | ArrayBuffer;
      let encoding: 'utf-8' | 'base64' | 'binary';
      
      if (isText) {
        data = await response.text();
        encoding = 'utf-8';
      } else {
        data = await response.arrayBuffer();
        encoding = 'binary';
      }
      
      return {
        success: true,
        data: {
          data,
          encoding,
          mimeType: contentType,
        },
      };
    } catch (error) {
      return { success: false, error: `Read error: ${error}` };
    }
  }
  
  async writeFile(path: string, content: FileContent, overwrite = true): Promise<CloudStorageResponse<CloudFile>> {
    try {
      let body: Blob;
      
      if (content.encoding === 'utf-8' && typeof content.data === 'string') {
        body = new Blob([content.data], { type: content.mimeType });
      } else if (content.encoding === 'base64' && typeof content.data === 'string') {
        const binary = atob(content.data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        body = new Blob([bytes], { type: content.mimeType });
      } else if (content.data instanceof ArrayBuffer) {
        body = new Blob([content.data], { type: content.mimeType });
      } else {
        return { success: false, error: 'Invalid content format' };
      }
      
      const response = await fetch(`${DROPBOX_CONTENT_URL}/files/upload`, {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/octet-stream',
          'Dropbox-API-Arg': JSON.stringify({
            path: path,
            mode: overwrite ? 'overwrite' : 'add',
            autorename: !overwrite,
            mute: false,
          }),
        },
        body,
      });
      
      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Write failed: ${error}` };
      }
      
      const data = await response.json();
      return { success: true, data: this.mapToCloudFile(data) };
    } catch (error) {
      return { success: false, error: `Write error: ${error}` };
    }
  }
  
  async deleteFile(fileId: string): Promise<CloudStorageResponse<boolean>> {
    try {
      const response = await fetch(`${DROPBOX_API_URL}/files/delete_v2`, {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: fileId }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Delete failed: ${error}` };
      }
      
      return { success: true, data: true };
    } catch (error) {
      return { success: false, error: `Delete error: ${error}` };
    }
  }
  
  async moveFile(fileId: string, newPath: string): Promise<CloudStorageResponse<CloudFile>> {
    try {
      const response = await fetch(`${DROPBOX_API_URL}/files/move_v2`, {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from_path: fileId,
          to_path: newPath,
          autorename: false,
        }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Move failed: ${error}` };
      }
      
      const data = await response.json();
      return { success: true, data: this.mapToCloudFile(data.metadata) };
    } catch (error) {
      return { success: false, error: `Move error: ${error}` };
    }
  }
  
  async copyFile(fileId: string, newPath: string): Promise<CloudStorageResponse<CloudFile>> {
    try {
      const response = await fetch(`${DROPBOX_API_URL}/files/copy_v2`, {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from_path: fileId,
          to_path: newPath,
          autorename: false,
        }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Copy failed: ${error}` };
      }
      
      const data = await response.json();
      return { success: true, data: this.mapToCloudFile(data.metadata) };
    } catch (error) {
      return { success: false, error: `Copy error: ${error}` };
    }
  }
  
  async createFolder(path: string): Promise<CloudStorageResponse<CloudFile>> {
    try {
      const response = await fetch(`${DROPBOX_API_URL}/files/create_folder_v2`, {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: path,
          autorename: false,
        }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        // Check if folder already exists
        if (error.includes('conflict')) {
          return this.getFileByPath(path);
        }
        return { success: false, error: `Create folder failed: ${error}` };
      }
      
      const data = await response.json();
      return { success: true, data: this.mapToCloudFile(data.metadata) };
    } catch (error) {
      return { success: false, error: `Create folder error: ${error}` };
    }
  }
  
  async getQuota(): Promise<CloudStorageResponse<{ used: number; total: number }>> {
    try {
      const response = await fetch(`${DROPBOX_API_URL}/users/get_space_usage`, {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
        },
      });
      
      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Get quota failed: ${error}` };
      }
      
      const data = await response.json();
      return {
        success: true,
        data: {
          used: data.used,
          total: data.allocation?.allocated || 0,
        },
      };
    } catch (error) {
      return { success: false, error: `Get quota error: ${error}` };
    }
  }
  
  async getAccountInfo(): Promise<CloudStorageResponse<{ email?: string; name?: string }>> {
    try {
      const response = await fetch(`${DROPBOX_API_URL}/users/get_current_account`, {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
        },
      });
      
      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Get account failed: ${error}` };
      }
      
      const data = await response.json();
      return {
        success: true,
        data: {
          email: data.email,
          name: data.name?.display_name,
        },
      };
    } catch (error) {
      return { success: false, error: `Get account error: ${error}` };
    }
  }
  
  private mapToCloudFile(entry: any): CloudFile {
    const isFolder = entry['.tag'] === 'folder';
    
    return {
      id: entry.id || entry.path_lower,
      name: entry.name,
      path: entry.path_display || entry.path_lower,
      mimeType: isFolder ? 'folder' : this.getMimeType(entry.name),
      size: entry.size || 0,
      checksum: entry.content_hash,
      modifiedAt: entry.server_modified ? new Date(entry.server_modified).getTime() : Date.now(),
      isFolder,
      providerMetadata: {
        rev: entry.rev,
        pathLower: entry.path_lower,
      },
    };
  }
  
  private getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      'md': 'text/markdown',
      'txt': 'text/plain',
      'json': 'application/json',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'pdf': 'application/pdf',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }
}
