/**
 * SFTP Provider
 * 
 * Implements cloud storage interface for SFTP/SSH connections.
 * 
 * Note: SFTP operations must go through server proxy as they require
 * Node.js ssh2 library which can't run in browser.
 */

import { CredentialProvider } from './base';
import type { 
  CloudFile, 
  FileContent, 
  ListFilesResponse, 
  CloudStorageResponse,
  CredentialAuth,
} from '@shared/cloudStorage';

export class SFTPProvider extends CredentialProvider {
  readonly providerId = 'sftp';
  readonly displayName = 'SFTP / SSH';
  
  private proxyUrl: string;
  
  constructor(proxyUrl = '/.netlify/functions/sftp-proxy') {
    super();
    this.proxyUrl = proxyUrl;
  }
  
  async connectWithCredentials(credentials: CredentialAuth): Promise<CloudStorageResponse<boolean>> {
    this.setCredentials(credentials);
    
    // Test connection
    const testResult = await this.testConnection();
    if (testResult.success) {
      this.connected = true;
    }
    
    return testResult;
  }
  
  async testConnection(): Promise<CloudStorageResponse<boolean>> {
    if (!this.credentials) {
      return { success: false, error: 'No credentials set' };
    }
    
    try {
      const response = await this.makeRequest('test');
      return response;
    } catch (error) {
      return { success: false, error: `Connection test error: ${error}` };
    }
  }
  
  async listFiles(path: string, _cursor?: string): Promise<CloudStorageResponse<ListFilesResponse>> {
    try {
      const response = await this.makeRequest('list', { path });
      
      if (!response.success) {
        return { success: false, error: response.error };
      }
      
      return {
        success: true,
        data: {
          files: response.data.files.map((f: any) => this.mapToCloudFile(f, path)),
          hasMore: false,
          cursor: undefined,
        },
      };
    } catch (error) {
      return { success: false, error: `List error: ${error}` };
    }
  }
  
  async getFile(fileId: string): Promise<CloudStorageResponse<CloudFile>> {
    return this.getFileByPath(fileId);
  }
  
  async getFileByPath(path: string): Promise<CloudStorageResponse<CloudFile>> {
    try {
      const response = await this.makeRequest('stat', { path });
      
      if (!response.success) {
        return { success: false, error: response.error };
      }
      
      return { success: true, data: this.mapToCloudFile(response.data, path) };
    } catch (error) {
      return { success: false, error: `Get file error: ${error}` };
    }
  }
  
  async readFile(fileId: string): Promise<CloudStorageResponse<FileContent>> {
    try {
      const response = await this.makeRequest('read', { path: fileId });
      
      if (!response.success) {
        return { success: false, error: response.error };
      }
      
      const mimeType = this.getMimeType(fileId);
      
      return {
        success: true,
        data: {
          data: response.data.content,
          encoding: response.data.encoding || 'utf-8',
          mimeType,
        },
      };
    } catch (error) {
      return { success: false, error: `Read error: ${error}` };
    }
  }
  
  async writeFile(path: string, content: FileContent, _overwrite = true): Promise<CloudStorageResponse<CloudFile>> {
    try {
      // Ensure parent directory exists
      const parentPath = path.substring(0, path.lastIndexOf('/'));
      if (parentPath) {
        await this.createFolder(parentPath);
      }
      
      const response = await this.makeRequest('write', {
        path,
        content: content.data,
        encoding: content.encoding,
      });
      
      if (!response.success) {
        return { success: false, error: response.error };
      }
      
      return this.getFileByPath(path);
    } catch (error) {
      return { success: false, error: `Write error: ${error}` };
    }
  }
  
  async deleteFile(fileId: string): Promise<CloudStorageResponse<boolean>> {
    try {
      const response = await this.makeRequest('delete', { path: fileId });
      
      if (!response.success) {
        return { success: false, error: response.error };
      }
      
      return { success: true, data: true };
    } catch (error) {
      return { success: false, error: `Delete error: ${error}` };
    }
  }
  
  async moveFile(fileId: string, newPath: string): Promise<CloudStorageResponse<CloudFile>> {
    try {
      const response = await this.makeRequest('rename', {
        oldPath: fileId,
        newPath,
      });
      
      if (!response.success) {
        return { success: false, error: response.error };
      }
      
      return this.getFileByPath(newPath);
    } catch (error) {
      return { success: false, error: `Move error: ${error}` };
    }
  }
  
  async copyFile(fileId: string, newPath: string): Promise<CloudStorageResponse<CloudFile>> {
    try {
      // SFTP doesn't have native copy, so read + write
      const readResult = await this.readFile(fileId);
      if (!readResult.success || !readResult.data) {
        return { success: false, error: 'Failed to read source file' };
      }
      
      return this.writeFile(newPath, readResult.data);
    } catch (error) {
      return { success: false, error: `Copy error: ${error}` };
    }
  }
  
  async createFolder(path: string): Promise<CloudStorageResponse<CloudFile>> {
    try {
      const response = await this.makeRequest('mkdir', { path });
      
      if (!response.success && !response.error?.includes('already exists')) {
        return { success: false, error: response.error };
      }
      
      return this.getFileByPath(path);
    } catch (error) {
      return { success: false, error: `Create folder error: ${error}` };
    }
  }
  
  /**
   * Make a request through the SFTP proxy
   */
  private async makeRequest(
    action: string, 
    params?: Record<string, any>
  ): Promise<CloudStorageResponse<any>> {
    if (!this.credentials) {
      return { success: false, error: 'No credentials set' };
    }
    
    try {
      const response = await fetch(this.proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          host: new URL(this.credentials.serverUrl).hostname,
          port: this.credentials.port || 22,
          username: this.credentials.username,
          password: this.credentials.password,
          privateKey: this.credentials.privateKey,
          basePath: this.credentials.basePath,
          ...params,
        }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        return { success: false, error };
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      return { success: false, error: `Request error: ${error}` };
    }
  }
  
  private mapToCloudFile(stat: any, basePath: string): CloudFile {
    const name = stat.filename || basePath.split('/').pop() || '';
    const path = stat.filename ? `${basePath}/${stat.filename}` : basePath;
    
    return {
      id: path,
      name,
      path,
      mimeType: stat.isDirectory ? 'folder' : this.getMimeType(name),
      size: stat.size || 0,
      modifiedAt: stat.mtime ? stat.mtime * 1000 : Date.now(),
      isFolder: stat.isDirectory || false,
    };
  }
  
  private getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      'md': 'text/markdown',
      'txt': 'text/plain',
      'json': 'application/json',
      'xml': 'application/xml',
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
