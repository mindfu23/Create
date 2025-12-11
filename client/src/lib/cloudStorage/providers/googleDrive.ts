/**
 * Google Drive Provider
 * 
 * Implements cloud storage interface for Google Drive.
 * Uses Google Drive API v3.
 * 
 * Setup: Create app at https://console.cloud.google.com/
 * Required scopes: https://www.googleapis.com/auth/drive.file
 */

import { OAuthProvider } from './base';
import type { 
  CloudFile, 
  FileContent, 
  ListFilesResponse, 
  CloudStorageResponse,
  OAuthTokens,
} from '@shared/cloudStorage';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_API_URL = 'https://www.googleapis.com/drive/v3';
const GOOGLE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3';

export class GoogleDriveProvider extends OAuthProvider {
  readonly providerId = 'google_drive';
  readonly displayName = 'Google Drive';
  
  private clientId: string;
  private clientSecret: string;
  private appFolderId: string | null = null;
  
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
      scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email',
      access_type: 'offline',
      prompt: 'consent', // Force consent to get refresh token
    });
    
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }
  
  async handleAuthCallback(code: string, redirectUri: string): Promise<CloudStorageResponse<OAuthTokens>> {
    try {
      const response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
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
      const response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Token refresh failed: ${error}` };
      }
      
      const data = await response.json();
      
      const tokens: OAuthTokens = {
        accessToken: data.access_token,
        refreshToken: refreshToken, // Google keeps the same refresh token
        expiresAt: data.expires_in ? Date.now() + (data.expires_in * 1000) : undefined,
        tokenType: data.token_type,
      };
      
      this.setTokens(tokens);
      return { success: true, data: tokens };
    } catch (error) {
      return { success: false, error: `Token refresh error: ${error}` };
    }
  }
  
  /**
   * Get or create the app folder in Google Drive
   */
  private async getOrCreateAppFolder(folderName: string): Promise<string> {
    if (this.appFolderId) return this.appFolderId;
    
    // Search for existing folder
    const searchResponse = await fetch(
      `${GOOGLE_API_URL}/files?q=name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`,
      {
        headers: { 'Authorization': this.getAuthHeader() },
      }
    );
    
    if (searchResponse.ok) {
      const data = await searchResponse.json();
      if (data.files && data.files.length > 0) {
        this.appFolderId = data.files[0].id;
        return this.appFolderId;
      }
    }
    
    // Create folder if it doesn't exist
    const createResponse = await fetch(`${GOOGLE_API_URL}/files`, {
      method: 'POST',
      headers: {
        'Authorization': this.getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });
    
    if (!createResponse.ok) {
      throw new Error('Failed to create app folder');
    }
    
    const folder = await createResponse.json();
    this.appFolderId = folder.id;
    return this.appFolderId;
  }
  
  async listFiles(path: string, cursor?: string): Promise<CloudStorageResponse<ListFilesResponse>> {
    try {
      let folderId = 'root';
      
      // If path is not root, we need to find the folder ID
      if (path && path !== '/') {
        const folderResult = await this.getFileByPath(path);
        if (folderResult.success && folderResult.data) {
          folderId = folderResult.data.id;
        }
      }
      
      const params = new URLSearchParams({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'nextPageToken,files(id,name,mimeType,size,modifiedTime,createdTime,md5Checksum)',
        pageSize: '100',
      });
      
      if (cursor) {
        params.append('pageToken', cursor);
      }
      
      const response = await fetch(`${GOOGLE_API_URL}/files?${params}`, {
        headers: { 'Authorization': this.getAuthHeader() },
      });
      
      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `List failed: ${error}` };
      }
      
      const data = await response.json();
      
      const files: CloudFile[] = data.files.map((file: any) => this.mapToCloudFile(file, path));
      
      return {
        success: true,
        data: {
          files,
          hasMore: !!data.nextPageToken,
          cursor: data.nextPageToken,
        },
      };
    } catch (error) {
      return { success: false, error: `List error: ${error}` };
    }
  }
  
  async getFile(fileId: string): Promise<CloudStorageResponse<CloudFile>> {
    try {
      const response = await fetch(
        `${GOOGLE_API_URL}/files/${fileId}?fields=id,name,mimeType,size,modifiedTime,createdTime,md5Checksum,parents`,
        {
          headers: { 'Authorization': this.getAuthHeader() },
        }
      );
      
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
    try {
      // Google Drive doesn't use paths natively, so we need to traverse
      const parts = path.split('/').filter(p => p);
      let currentId = 'root';
      
      for (const part of parts) {
        const response = await fetch(
          `${GOOGLE_API_URL}/files?q=name='${part}' and '${currentId}' in parents and trashed=false&fields=files(id,name,mimeType)`,
          {
            headers: { 'Authorization': this.getAuthHeader() },
          }
        );
        
        if (!response.ok) {
          return { success: false, error: 'Path traversal failed' };
        }
        
        const data = await response.json();
        if (!data.files || data.files.length === 0) {
          return { success: false, error: `Path not found: ${path}` };
        }
        
        currentId = data.files[0].id;
      }
      
      return this.getFile(currentId);
    } catch (error) {
      return { success: false, error: `Get by path error: ${error}` };
    }
  }
  
  async readFile(fileId: string): Promise<CloudStorageResponse<FileContent>> {
    try {
      // First get file metadata
      const metaResponse = await fetch(
        `${GOOGLE_API_URL}/files/${fileId}?fields=mimeType`,
        {
          headers: { 'Authorization': this.getAuthHeader() },
        }
      );
      
      if (!metaResponse.ok) {
        return { success: false, error: 'Failed to get file metadata' };
      }
      
      const meta = await metaResponse.json();
      
      // Download file content
      const response = await fetch(
        `${GOOGLE_API_URL}/files/${fileId}?alt=media`,
        {
          headers: { 'Authorization': this.getAuthHeader() },
        }
      );
      
      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Read failed: ${error}` };
      }
      
      const mimeType = meta.mimeType || 'application/octet-stream';
      const isText = mimeType.startsWith('text/') || 
                     mimeType.includes('json') || 
                     mimeType.includes('xml');
      
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
        data: { data, encoding, mimeType },
      };
    } catch (error) {
      return { success: false, error: `Read error: ${error}` };
    }
  }
  
  async writeFile(path: string, content: FileContent, overwrite = true): Promise<CloudStorageResponse<CloudFile>> {
    try {
      // Parse path to get parent folder and filename
      const parts = path.split('/').filter(p => p);
      const fileName = parts.pop() || 'untitled';
      const parentPath = '/' + parts.join('/');
      
      // Get or create parent folder
      let parentId = 'root';
      if (parts.length > 0) {
        const parentResult = await this.getFileByPath(parentPath);
        if (parentResult.success && parentResult.data) {
          parentId = parentResult.data.id;
        } else {
          // Create parent folders
          const folderResult = await this.createFolder(parentPath);
          if (folderResult.success && folderResult.data) {
            parentId = folderResult.data.id;
          }
        }
      }
      
      // Check if file exists
      let existingFileId: string | null = null;
      if (overwrite) {
        const existingResult = await this.getFileByPath(path);
        if (existingResult.success && existingResult.data) {
          existingFileId = existingResult.data.id;
        }
      }
      
      // Prepare body
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
      
      let response;
      
      if (existingFileId) {
        // Update existing file
        response = await fetch(
          `${GOOGLE_UPLOAD_URL}/files/${existingFileId}?uploadType=media`,
          {
            method: 'PATCH',
            headers: {
              'Authorization': this.getAuthHeader(),
              'Content-Type': content.mimeType,
            },
            body,
          }
        );
      } else {
        // Create new file with metadata
        const metadata = {
          name: fileName,
          parents: [parentId],
        };
        
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', body);
        
        response = await fetch(
          `${GOOGLE_UPLOAD_URL}/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime`,
          {
            method: 'POST',
            headers: {
              'Authorization': this.getAuthHeader(),
            },
            body: form,
          }
        );
      }
      
      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Write failed: ${error}` };
      }
      
      const data = await response.json();
      return { success: true, data: this.mapToCloudFile(data, parentPath) };
    } catch (error) {
      return { success: false, error: `Write error: ${error}` };
    }
  }
  
  async deleteFile(fileId: string): Promise<CloudStorageResponse<boolean>> {
    try {
      const response = await fetch(`${GOOGLE_API_URL}/files/${fileId}`, {
        method: 'DELETE',
        headers: { 'Authorization': this.getAuthHeader() },
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
      // Get current parents
      const fileResult = await this.getFile(fileId);
      if (!fileResult.success || !fileResult.data) {
        return { success: false, error: 'File not found' };
      }
      
      // Parse new path
      const parts = newPath.split('/').filter(p => p);
      const newName = parts.pop();
      const newParentPath = '/' + parts.join('/');
      
      // Get new parent folder
      let newParentId = 'root';
      if (parts.length > 0) {
        const parentResult = await this.getFileByPath(newParentPath);
        if (parentResult.success && parentResult.data) {
          newParentId = parentResult.data.id;
        }
      }
      
      const response = await fetch(
        `${GOOGLE_API_URL}/files/${fileId}?addParents=${newParentId}&removeParents=${(fileResult.data.providerMetadata as any)?.parents?.join(',') || 'root'}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': this.getAuthHeader(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: newName }),
        }
      );
      
      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Move failed: ${error}` };
      }
      
      const data = await response.json();
      return { success: true, data: this.mapToCloudFile(data, newParentPath) };
    } catch (error) {
      return { success: false, error: `Move error: ${error}` };
    }
  }
  
  async copyFile(fileId: string, newPath: string): Promise<CloudStorageResponse<CloudFile>> {
    try {
      // Parse new path
      const parts = newPath.split('/').filter(p => p);
      const newName = parts.pop();
      const newParentPath = '/' + parts.join('/');
      
      // Get new parent folder
      let newParentId = 'root';
      if (parts.length > 0) {
        const parentResult = await this.getFileByPath(newParentPath);
        if (parentResult.success && parentResult.data) {
          newParentId = parentResult.data.id;
        }
      }
      
      const response = await fetch(`${GOOGLE_API_URL}/files/${fileId}/copy`, {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newName,
          parents: [newParentId],
        }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Copy failed: ${error}` };
      }
      
      const data = await response.json();
      return { success: true, data: this.mapToCloudFile(data, newParentPath) };
    } catch (error) {
      return { success: false, error: `Copy error: ${error}` };
    }
  }
  
  async createFolder(path: string): Promise<CloudStorageResponse<CloudFile>> {
    try {
      const parts = path.split('/').filter(p => p);
      let currentParentId = 'root';
      let lastFolder: CloudFile | null = null;
      
      // Create each folder in the path
      for (const folderName of parts) {
        // Check if folder exists
        const searchResponse = await fetch(
          `${GOOGLE_API_URL}/files?q=name='${folderName}' and '${currentParentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name,mimeType,modifiedTime)`,
          {
            headers: { 'Authorization': this.getAuthHeader() },
          }
        );
        
        if (searchResponse.ok) {
          const data = await searchResponse.json();
          if (data.files && data.files.length > 0) {
            currentParentId = data.files[0].id;
            lastFolder = this.mapToCloudFile(data.files[0]);
            continue;
          }
        }
        
        // Create folder
        const createResponse = await fetch(`${GOOGLE_API_URL}/files`, {
          method: 'POST',
          headers: {
            'Authorization': this.getAuthHeader(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [currentParentId],
          }),
        });
        
        if (!createResponse.ok) {
          const error = await createResponse.text();
          return { success: false, error: `Create folder failed: ${error}` };
        }
        
        const folder = await createResponse.json();
        currentParentId = folder.id;
        lastFolder = this.mapToCloudFile(folder);
      }
      
      if (!lastFolder) {
        return { success: false, error: 'No folder created' };
      }
      
      return { success: true, data: lastFolder };
    } catch (error) {
      return { success: false, error: `Create folder error: ${error}` };
    }
  }
  
  async getQuota(): Promise<CloudStorageResponse<{ used: number; total: number }>> {
    try {
      const response = await fetch(`${GOOGLE_API_URL}/about?fields=storageQuota`, {
        headers: { 'Authorization': this.getAuthHeader() },
      });
      
      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Get quota failed: ${error}` };
      }
      
      const data = await response.json();
      return {
        success: true,
        data: {
          used: parseInt(data.storageQuota?.usage || '0'),
          total: parseInt(data.storageQuota?.limit || '0'),
        },
      };
    } catch (error) {
      return { success: false, error: `Get quota error: ${error}` };
    }
  }
  
  async getAccountInfo(): Promise<CloudStorageResponse<{ email?: string; name?: string }>> {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { 'Authorization': this.getAuthHeader() },
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
          name: data.name,
        },
      };
    } catch (error) {
      return { success: false, error: `Get account error: ${error}` };
    }
  }
  
  private mapToCloudFile(file: any, parentPath?: string): CloudFile {
    const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
    
    return {
      id: file.id,
      name: file.name,
      path: parentPath ? `${parentPath}/${file.name}` : `/${file.name}`,
      mimeType: file.mimeType || 'application/octet-stream',
      size: parseInt(file.size || '0'),
      checksum: file.md5Checksum,
      createdAt: file.createdTime ? new Date(file.createdTime).getTime() : undefined,
      modifiedAt: file.modifiedTime ? new Date(file.modifiedTime).getTime() : Date.now(),
      isFolder,
      providerMetadata: {
        parents: file.parents,
      },
    };
  }
}
