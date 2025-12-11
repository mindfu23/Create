/**
 * Box Provider
 * 
 * Implements cloud storage interface for Box.
 * Uses Box API v2.0.
 * 
 * Setup: Create app at https://developer.box.com/
 * Required scopes: root_readwrite
 */

import { OAuthProvider } from './base';
import type { 
  CloudFile, 
  FileContent, 
  ListFilesResponse, 
  CloudStorageResponse,
  OAuthTokens,
} from '@shared/cloudStorage';

const BOX_AUTH_URL = 'https://account.box.com/api/oauth2/authorize';
const BOX_TOKEN_URL = 'https://api.box.com/oauth2/token';
const BOX_API_URL = 'https://api.box.com/2.0';
const BOX_UPLOAD_URL = 'https://upload.box.com/api/2.0';

export class BoxProvider extends OAuthProvider {
  readonly providerId = 'box';
  readonly displayName = 'Box';
  
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
    });
    
    return `${BOX_AUTH_URL}?${params.toString()}`;
  }
  
  async handleAuthCallback(code: string, redirectUri: string): Promise<CloudStorageResponse<OAuthTokens>> {
    try {
      const response = await fetch(BOX_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
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
      };
      
      this.setTokens(tokens);
      return { success: true, data: tokens };
    } catch (error) {
      return { success: false, error: `Auth error: ${error}` };
    }
  }
  
  async refreshToken(refreshToken: string): Promise<CloudStorageResponse<OAuthTokens>> {
    try {
      const response = await fetch(BOX_TOKEN_URL, {
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
        refreshToken: data.refresh_token, // Box gives new refresh token
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
      // Box uses folder IDs, '0' is root
      let folderId = '0';
      
      if (path && path !== '/') {
        const folderResult = await this.getFileByPath(path);
        if (folderResult.success && folderResult.data) {
          folderId = folderResult.data.id;
        }
      }
      
      const params = new URLSearchParams({
        fields: 'id,name,type,size,modified_at,created_at,sha1',
        limit: '100',
      });
      
      if (cursor) {
        params.append('offset', cursor);
      }
      
      const response = await fetch(
        `${BOX_API_URL}/folders/${folderId}/items?${params}`,
        {
          headers: { 'Authorization': this.getAuthHeader() },
        }
      );
      
      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `List failed: ${error}` };
      }
      
      const data = await response.json();
      
      const files: CloudFile[] = data.entries.map((item: any) => this.mapToCloudFile(item, path));
      
      return {
        success: true,
        data: {
          files,
          hasMore: data.offset + data.limit < data.total_count,
          cursor: data.offset + data.limit < data.total_count 
            ? String(data.offset + data.limit) 
            : undefined,
        },
      };
    } catch (error) {
      return { success: false, error: `List error: ${error}` };
    }
  }
  
  async getFile(fileId: string): Promise<CloudStorageResponse<CloudFile>> {
    try {
      const response = await fetch(
        `${BOX_API_URL}/files/${fileId}?fields=id,name,type,size,modified_at,created_at,sha1,parent`,
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
      // Box doesn't have a direct path lookup, so we traverse
      const parts = path.split('/').filter(p => p);
      let currentId = '0'; // Root folder
      let currentType = 'folder';
      
      for (const part of parts) {
        const response = await fetch(
          `${BOX_API_URL}/folders/${currentId}/items?fields=id,name,type`,
          {
            headers: { 'Authorization': this.getAuthHeader() },
          }
        );
        
        if (!response.ok) {
          return { success: false, error: 'Path traversal failed' };
        }
        
        const data = await response.json();
        const found = data.entries.find((item: any) => item.name === part);
        
        if (!found) {
          return { success: false, error: `Path not found: ${path}` };
        }
        
        currentId = found.id;
        currentType = found.type;
      }
      
      // Get full details
      const endpoint = currentType === 'folder' ? 'folders' : 'files';
      return this.getFileOrFolder(currentId, endpoint);
    } catch (error) {
      return { success: false, error: `Get by path error: ${error}` };
    }
  }
  
  private async getFileOrFolder(id: string, type: 'files' | 'folders'): Promise<CloudStorageResponse<CloudFile>> {
    try {
      const response = await fetch(
        `${BOX_API_URL}/${type}/${id}?fields=id,name,type,size,modified_at,created_at,sha1,parent`,
        {
          headers: { 'Authorization': this.getAuthHeader() },
        }
      );
      
      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Get item failed: ${error}` };
      }
      
      const data = await response.json();
      return { success: true, data: this.mapToCloudFile(data) };
    } catch (error) {
      return { success: false, error: `Get item error: ${error}` };
    }
  }
  
  async readFile(fileId: string): Promise<CloudStorageResponse<FileContent>> {
    try {
      // Get file metadata first
      const metaResponse = await fetch(
        `${BOX_API_URL}/files/${fileId}?fields=name`,
        {
          headers: { 'Authorization': this.getAuthHeader() },
        }
      );
      
      if (!metaResponse.ok) {
        return { success: false, error: 'Failed to get file metadata' };
      }
      
      const meta = await metaResponse.json();
      const mimeType = this.getMimeType(meta.name);
      
      // Download content
      const response = await fetch(
        `${BOX_API_URL}/files/${fileId}/content`,
        {
          headers: { 'Authorization': this.getAuthHeader() },
        }
      );
      
      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Read failed: ${error}` };
      }
      
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
      // Parse path
      const parts = path.split('/').filter(p => p);
      const fileName = parts.pop() || 'untitled';
      const parentPath = '/' + parts.join('/');
      
      // Get or create parent folder
      let parentId = '0';
      if (parts.length > 0) {
        const parentResult = await this.getFileByPath(parentPath);
        if (parentResult.success && parentResult.data) {
          parentId = parentResult.data.id;
        } else {
          const folderResult = await this.createFolder(parentPath);
          if (folderResult.success && folderResult.data) {
            parentId = folderResult.data.id;
          }
        }
      }
      
      // Prepare body
      let fileBlob: Blob;
      if (content.encoding === 'utf-8' && typeof content.data === 'string') {
        fileBlob = new Blob([content.data], { type: content.mimeType });
      } else if (content.encoding === 'base64' && typeof content.data === 'string') {
        const binary = atob(content.data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        fileBlob = new Blob([bytes], { type: content.mimeType });
      } else if (content.data instanceof ArrayBuffer) {
        fileBlob = new Blob([content.data], { type: content.mimeType });
      } else {
        return { success: false, error: 'Invalid content format' };
      }
      
      // Check if file exists
      const existingResult = await this.getFileByPath(path);
      
      if (existingResult.success && existingResult.data && overwrite) {
        // Update existing file
        const form = new FormData();
        form.append('file', fileBlob, fileName);
        
        const response = await fetch(
          `${BOX_UPLOAD_URL}/files/${existingResult.data.id}/content`,
          {
            method: 'POST',
            headers: { 'Authorization': this.getAuthHeader() },
            body: form,
          }
        );
        
        if (!response.ok) {
          const error = await response.text();
          return { success: false, error: `Update failed: ${error}` };
        }
        
        const data = await response.json();
        return { success: true, data: this.mapToCloudFile(data.entries[0]) };
      } else {
        // Upload new file
        const attributes = JSON.stringify({
          name: fileName,
          parent: { id: parentId },
        });
        
        const form = new FormData();
        form.append('attributes', attributes);
        form.append('file', fileBlob, fileName);
        
        const response = await fetch(
          `${BOX_UPLOAD_URL}/files/content`,
          {
            method: 'POST',
            headers: { 'Authorization': this.getAuthHeader() },
            body: form,
          }
        );
        
        if (!response.ok) {
          const error = await response.text();
          return { success: false, error: `Upload failed: ${error}` };
        }
        
        const data = await response.json();
        return { success: true, data: this.mapToCloudFile(data.entries[0]) };
      }
    } catch (error) {
      return { success: false, error: `Write error: ${error}` };
    }
  }
  
  async deleteFile(fileId: string): Promise<CloudStorageResponse<boolean>> {
    try {
      const response = await fetch(`${BOX_API_URL}/files/${fileId}`, {
        method: 'DELETE',
        headers: { 'Authorization': this.getAuthHeader() },
      });
      
      if (!response.ok && response.status !== 204) {
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
      // Parse new path
      const parts = newPath.split('/').filter(p => p);
      const newName = parts.pop();
      const newParentPath = parts.length > 0 ? '/' + parts.join('/') : '/';
      
      // Get new parent folder
      let newParentId = '0';
      if (newParentPath !== '/') {
        const parentResult = await this.getFileByPath(newParentPath);
        if (parentResult.success && parentResult.data) {
          newParentId = parentResult.data.id;
        }
      }
      
      const response = await fetch(`${BOX_API_URL}/files/${fileId}`, {
        method: 'PUT',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newName,
          parent: { id: newParentId },
        }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Move failed: ${error}` };
      }
      
      const data = await response.json();
      return { success: true, data: this.mapToCloudFile(data) };
    } catch (error) {
      return { success: false, error: `Move error: ${error}` };
    }
  }
  
  async copyFile(fileId: string, newPath: string): Promise<CloudStorageResponse<CloudFile>> {
    try {
      // Parse new path
      const parts = newPath.split('/').filter(p => p);
      const newName = parts.pop();
      const newParentPath = parts.length > 0 ? '/' + parts.join('/') : '/';
      
      // Get new parent folder
      let newParentId = '0';
      if (newParentPath !== '/') {
        const parentResult = await this.getFileByPath(newParentPath);
        if (parentResult.success && parentResult.data) {
          newParentId = parentResult.data.id;
        }
      }
      
      const response = await fetch(`${BOX_API_URL}/files/${fileId}/copy`, {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newName,
          parent: { id: newParentId },
        }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Copy failed: ${error}` };
      }
      
      const data = await response.json();
      return { success: true, data: this.mapToCloudFile(data) };
    } catch (error) {
      return { success: false, error: `Copy error: ${error}` };
    }
  }
  
  async createFolder(path: string): Promise<CloudStorageResponse<CloudFile>> {
    try {
      const parts = path.split('/').filter(p => p);
      let currentParentId = '0';
      let lastFolder: CloudFile | null = null;
      
      for (const folderName of parts) {
        // Check if folder exists
        const listResponse = await fetch(
          `${BOX_API_URL}/folders/${currentParentId}/items?fields=id,name,type`,
          {
            headers: { 'Authorization': this.getAuthHeader() },
          }
        );
        
        if (listResponse.ok) {
          const data = await listResponse.json();
          const existing = data.entries.find(
            (item: any) => item.name === folderName && item.type === 'folder'
          );
          
          if (existing) {
            currentParentId = existing.id;
            lastFolder = this.mapToCloudFile({ ...existing, type: 'folder' });
            continue;
          }
        }
        
        // Create folder
        const response = await fetch(`${BOX_API_URL}/folders`, {
          method: 'POST',
          headers: {
            'Authorization': this.getAuthHeader(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: folderName,
            parent: { id: currentParentId },
          }),
        });
        
        if (!response.ok) {
          const error = await response.text();
          // Check if folder already exists (409 conflict)
          if (response.status === 409) {
            continue;
          }
          return { success: false, error: `Create folder failed: ${error}` };
        }
        
        const folder = await response.json();
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
      const response = await fetch(`${BOX_API_URL}/users/me?fields=space_used,space_amount`, {
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
          used: data.space_used || 0,
          total: data.space_amount || 0,
        },
      };
    } catch (error) {
      return { success: false, error: `Get quota error: ${error}` };
    }
  }
  
  async getAccountInfo(): Promise<CloudStorageResponse<{ email?: string; name?: string }>> {
    try {
      const response = await fetch(`${BOX_API_URL}/users/me?fields=login,name`, {
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
          email: data.login,
          name: data.name,
        },
      };
    } catch (error) {
      return { success: false, error: `Get account error: ${error}` };
    }
  }
  
  private mapToCloudFile(item: any, parentPath?: string): CloudFile {
    const isFolder = item.type === 'folder';
    
    return {
      id: item.id,
      name: item.name,
      path: parentPath ? `${parentPath}/${item.name}` : `/${item.name}`,
      mimeType: isFolder ? 'folder' : this.getMimeType(item.name),
      size: item.size || 0,
      checksum: item.sha1,
      createdAt: item.created_at ? new Date(item.created_at).getTime() : undefined,
      modifiedAt: item.modified_at ? new Date(item.modified_at).getTime() : Date.now(),
      isFolder,
      providerMetadata: {
        parent: item.parent,
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
