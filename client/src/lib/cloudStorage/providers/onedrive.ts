/**
 * OneDrive Provider
 * 
 * Implements cloud storage interface for Microsoft OneDrive.
 * Uses Microsoft Graph API.
 * 
 * Setup: Create app at https://portal.azure.com/
 * Required scopes: Files.ReadWrite, User.Read, offline_access
 */

import { OAuthProvider } from './base';
import type { 
  CloudFile, 
  FileContent, 
  ListFilesResponse, 
  CloudStorageResponse,
  OAuthTokens,
} from '@shared/cloudStorage';

const MS_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const GRAPH_API_URL = 'https://graph.microsoft.com/v1.0';

export class OneDriveProvider extends OAuthProvider {
  readonly providerId = 'onedrive';
  readonly displayName = 'OneDrive';
  
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
      scope: 'Files.ReadWrite User.Read offline_access',
      response_mode: 'query',
    });
    
    return `${MS_AUTH_URL}?${params.toString()}`;
  }
  
  async handleAuthCallback(code: string, redirectUri: string): Promise<CloudStorageResponse<OAuthTokens>> {
    try {
      const response = await fetch(MS_TOKEN_URL, {
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
      const response = await fetch(MS_TOKEN_URL, {
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
        refreshToken: data.refresh_token || refreshToken,
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
      let url: string;
      
      if (cursor) {
        url = cursor; // OneDrive uses full URL as cursor
      } else if (path === '/' || path === '') {
        url = `${GRAPH_API_URL}/me/drive/root/children?$select=id,name,size,file,folder,lastModifiedDateTime,createdDateTime`;
      } else {
        const encodedPath = encodeURIComponent(path.startsWith('/') ? path.substring(1) : path);
        url = `${GRAPH_API_URL}/me/drive/root:/${encodedPath}:/children?$select=id,name,size,file,folder,lastModifiedDateTime,createdDateTime`;
      }
      
      const response = await fetch(url, {
        headers: { 'Authorization': this.getAuthHeader() },
      });
      
      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `List failed: ${error}` };
      }
      
      const data = await response.json();
      
      const files: CloudFile[] = data.value.map((item: any) => this.mapToCloudFile(item, path));
      
      return {
        success: true,
        data: {
          files,
          hasMore: !!data['@odata.nextLink'],
          cursor: data['@odata.nextLink'],
        },
      };
    } catch (error) {
      return { success: false, error: `List error: ${error}` };
    }
  }
  
  async getFile(fileId: string): Promise<CloudStorageResponse<CloudFile>> {
    try {
      const response = await fetch(
        `${GRAPH_API_URL}/me/drive/items/${fileId}?$select=id,name,size,file,folder,lastModifiedDateTime,createdDateTime,parentReference`,
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
      const encodedPath = encodeURIComponent(path.startsWith('/') ? path.substring(1) : path);
      const response = await fetch(
        `${GRAPH_API_URL}/me/drive/root:/${encodedPath}?$select=id,name,size,file,folder,lastModifiedDateTime,createdDateTime,parentReference`,
        {
          headers: { 'Authorization': this.getAuthHeader() },
        }
      );
      
      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Get file by path failed: ${error}` };
      }
      
      const data = await response.json();
      return { success: true, data: this.mapToCloudFile(data) };
    } catch (error) {
      return { success: false, error: `Get file by path error: ${error}` };
    }
  }
  
  async readFile(fileId: string): Promise<CloudStorageResponse<FileContent>> {
    try {
      // Get file metadata first
      const metaResponse = await fetch(
        `${GRAPH_API_URL}/me/drive/items/${fileId}?$select=file`,
        {
          headers: { 'Authorization': this.getAuthHeader() },
        }
      );
      
      if (!metaResponse.ok) {
        return { success: false, error: 'Failed to get file metadata' };
      }
      
      const meta = await metaResponse.json();
      const mimeType = meta.file?.mimeType || 'application/octet-stream';
      
      // Download content
      const response = await fetch(
        `${GRAPH_API_URL}/me/drive/items/${fileId}/content`,
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
      
      const encodedPath = encodeURIComponent(path.startsWith('/') ? path.substring(1) : path);
      const conflictBehavior = overwrite ? 'replace' : 'rename';
      
      const response = await fetch(
        `${GRAPH_API_URL}/me/drive/root:/${encodedPath}:/content?@microsoft.graph.conflictBehavior=${conflictBehavior}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': this.getAuthHeader(),
            'Content-Type': content.mimeType,
          },
          body,
        }
      );
      
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
      const response = await fetch(`${GRAPH_API_URL}/me/drive/items/${fileId}`, {
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
      // Parse new path to get parent and name
      const parts = newPath.split('/').filter(p => p);
      const newName = parts.pop();
      const newParentPath = parts.length > 0 ? '/' + parts.join('/') : '/';
      
      // Get parent folder
      let parentReference: any;
      if (newParentPath === '/') {
        parentReference = { path: '/drive/root' };
      } else {
        const parentResult = await this.getFileByPath(newParentPath);
        if (!parentResult.success || !parentResult.data) {
          return { success: false, error: 'Parent folder not found' };
        }
        parentReference = { id: parentResult.data.id };
      }
      
      const response = await fetch(`${GRAPH_API_URL}/me/drive/items/${fileId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parentReference,
          name: newName,
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
      
      // Get parent folder
      let parentReference: any;
      if (newParentPath === '/') {
        parentReference = { path: '/drive/root' };
      } else {
        const parentResult = await this.getFileByPath(newParentPath);
        if (!parentResult.success || !parentResult.data) {
          return { success: false, error: 'Parent folder not found' };
        }
        parentReference = { driveId: 'me', id: parentResult.data.id };
      }
      
      const response = await fetch(`${GRAPH_API_URL}/me/drive/items/${fileId}/copy`, {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parentReference,
          name: newName,
        }),
      });
      
      // Copy is async in OneDrive, returns 202 with location header
      if (response.status === 202) {
        // For simplicity, we'll return a placeholder
        // In production, you'd poll the location header
        return {
          success: true,
          data: {
            id: 'pending',
            name: newName || '',
            path: newPath,
            mimeType: 'application/octet-stream',
            size: 0,
            modifiedAt: Date.now(),
            isFolder: false,
          },
        };
      }
      
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
      let currentParentPath = '';
      let lastFolder: CloudFile | null = null;
      
      for (const folderName of parts) {
        const folderPath = currentParentPath ? `${currentParentPath}/${folderName}` : folderName;
        
        // Check if folder exists
        const existingResult = await this.getFileByPath(folderPath);
        if (existingResult.success && existingResult.data?.isFolder) {
          currentParentPath = folderPath;
          lastFolder = existingResult.data;
          continue;
        }
        
        // Create folder
        const url = currentParentPath
          ? `${GRAPH_API_URL}/me/drive/root:/${encodeURIComponent(currentParentPath)}:/children`
          : `${GRAPH_API_URL}/me/drive/root/children`;
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': this.getAuthHeader(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: folderName,
            folder: {},
            '@microsoft.graph.conflictBehavior': 'fail',
          }),
        });
        
        if (!response.ok) {
          const error = await response.text();
          return { success: false, error: `Create folder failed: ${error}` };
        }
        
        const folder = await response.json();
        currentParentPath = folderPath;
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
      const response = await fetch(`${GRAPH_API_URL}/me/drive?$select=quota`, {
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
          used: data.quota?.used || 0,
          total: data.quota?.total || 0,
        },
      };
    } catch (error) {
      return { success: false, error: `Get quota error: ${error}` };
    }
  }
  
  async getAccountInfo(): Promise<CloudStorageResponse<{ email?: string; name?: string }>> {
    try {
      const response = await fetch(`${GRAPH_API_URL}/me?$select=mail,displayName,userPrincipalName`, {
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
          email: data.mail || data.userPrincipalName,
          name: data.displayName,
        },
      };
    } catch (error) {
      return { success: false, error: `Get account error: ${error}` };
    }
  }
  
  private mapToCloudFile(item: any, parentPath?: string): CloudFile {
    const isFolder = !!item.folder;
    const path = item.parentReference?.path
      ? `${item.parentReference.path.replace('/drive/root:', '')}/${item.name}`
      : parentPath
        ? `${parentPath}/${item.name}`
        : `/${item.name}`;
    
    return {
      id: item.id,
      name: item.name,
      path: path,
      mimeType: isFolder ? 'folder' : (item.file?.mimeType || 'application/octet-stream'),
      size: item.size || 0,
      checksum: item.file?.hashes?.sha256Hash || item.file?.hashes?.quickXorHash,
      createdAt: item.createdDateTime ? new Date(item.createdDateTime).getTime() : undefined,
      modifiedAt: item.lastModifiedDateTime ? new Date(item.lastModifiedDateTime).getTime() : Date.now(),
      isFolder,
      providerMetadata: {
        parentReference: item.parentReference,
        webUrl: item.webUrl,
      },
    };
  }
}
