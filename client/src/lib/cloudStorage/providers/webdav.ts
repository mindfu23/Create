/**
 * WebDAV Provider
 * 
 * Implements cloud storage interface for WebDAV servers.
 * Supports basic and digest authentication.
 * 
 * Note: WebDAV calls must go through server proxy due to CORS restrictions.
 * This provider formats requests for the webdav-proxy Netlify function.
 */

import { CredentialProvider } from './base';
import type { 
  CloudFile, 
  FileContent, 
  ListFilesResponse, 
  CloudStorageResponse,
  CredentialAuth,
} from '@shared/cloudStorage';

export class WebDAVProvider extends CredentialProvider {
  readonly providerId = 'webdav';
  readonly displayName = 'WebDAV';
  
  private proxyUrl: string;
  
  constructor(proxyUrl = '/.netlify/functions/webdav-proxy') {
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
      const response = await this.makeRequest('PROPFIND', '/', {
        headers: { 'Depth': '0' },
      });
      
      if (response.success) {
        return { success: true, data: true };
      }
      
      return { success: false, error: response.error || 'Connection test failed' };
    } catch (error) {
      return { success: false, error: `Connection test error: ${error}` };
    }
  }
  
  async listFiles(path: string, _cursor?: string): Promise<CloudStorageResponse<ListFilesResponse>> {
    try {
      const response = await this.makeRequest('PROPFIND', path, {
        headers: { 'Depth': '1' },
      });
      
      if (!response.success) {
        return { success: false, error: response.error };
      }
      
      // Parse WebDAV XML response
      const files = this.parseMultiStatus(response.data, path);
      
      // Remove the directory itself from listing
      const filteredFiles = files.filter(f => f.path !== path && f.path !== path + '/');
      
      return {
        success: true,
        data: {
          files: filteredFiles,
          hasMore: false, // WebDAV doesn't paginate
          cursor: undefined,
        },
      };
    } catch (error) {
      return { success: false, error: `List error: ${error}` };
    }
  }
  
  async getFile(fileId: string): Promise<CloudStorageResponse<CloudFile>> {
    // For WebDAV, fileId is the path
    return this.getFileByPath(fileId);
  }
  
  async getFileByPath(path: string): Promise<CloudStorageResponse<CloudFile>> {
    try {
      const response = await this.makeRequest('PROPFIND', path, {
        headers: { 'Depth': '0' },
      });
      
      if (!response.success) {
        return { success: false, error: response.error };
      }
      
      const files = this.parseMultiStatus(response.data, path);
      
      if (files.length === 0) {
        return { success: false, error: 'File not found' };
      }
      
      return { success: true, data: files[0] };
    } catch (error) {
      return { success: false, error: `Get file error: ${error}` };
    }
  }
  
  async readFile(fileId: string): Promise<CloudStorageResponse<FileContent>> {
    try {
      const response = await this.makeRequest('GET', fileId);
      
      if (!response.success) {
        return { success: false, error: response.error };
      }
      
      const mimeType = this.getMimeType(fileId);
      const isText = mimeType.startsWith('text/') || 
                     mimeType.includes('json') || 
                     mimeType.includes('xml');
      
      return {
        success: true,
        data: {
          data: response.data,
          encoding: isText ? 'utf-8' : 'base64',
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
      
      const response = await this.makeRequest('PUT', path, {
        body: content.data,
        headers: {
          'Content-Type': content.mimeType,
        },
      });
      
      if (!response.success) {
        return { success: false, error: response.error };
      }
      
      // Return file info
      return this.getFileByPath(path);
    } catch (error) {
      return { success: false, error: `Write error: ${error}` };
    }
  }
  
  async deleteFile(fileId: string): Promise<CloudStorageResponse<boolean>> {
    try {
      const response = await this.makeRequest('DELETE', fileId);
      
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
      const response = await this.makeRequest('MOVE', fileId, {
        headers: {
          'Destination': this.getFullUrl(newPath),
          'Overwrite': 'T',
        },
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
      const response = await this.makeRequest('COPY', fileId, {
        headers: {
          'Destination': this.getFullUrl(newPath),
          'Overwrite': 'T',
        },
      });
      
      if (!response.success) {
        return { success: false, error: response.error };
      }
      
      return this.getFileByPath(newPath);
    } catch (error) {
      return { success: false, error: `Copy error: ${error}` };
    }
  }
  
  async createFolder(path: string): Promise<CloudStorageResponse<CloudFile>> {
    try {
      // Create each folder in path
      const parts = path.split('/').filter(p => p);
      let currentPath = '';
      
      for (const part of parts) {
        currentPath = currentPath ? `${currentPath}/${part}` : `/${part}`;
        
        // Check if exists
        const exists = await this.getFileByPath(currentPath);
        if (exists.success) continue;
        
        // Create folder
        const response = await this.makeRequest('MKCOL', currentPath);
        
        if (!response.success && !response.error?.includes('405')) {
          // 405 means it already exists, which is fine
          return { success: false, error: response.error };
        }
      }
      
      return this.getFileByPath(path);
    } catch (error) {
      return { success: false, error: `Create folder error: ${error}` };
    }
  }
  
  /**
   * Make a request through the proxy
   */
  private async makeRequest(
    method: string, 
    path: string, 
    options?: { headers?: Record<string, string>; body?: any }
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
          method,
          path,
          serverUrl: this.credentials.serverUrl,
          username: this.credentials.username,
          password: this.credentials.password,
          basePath: this.credentials.basePath,
          headers: options?.headers,
          body: options?.body,
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
  
  private getFullUrl(path: string): string {
    if (!this.credentials) return path;
    
    const baseUrl = this.credentials.serverUrl.replace(/\/$/, '');
    const basePath = this.credentials.basePath?.replace(/\/$/, '') || '';
    const fullPath = path.startsWith('/') ? path : `/${path}`;
    
    return `${baseUrl}${basePath}${fullPath}`;
  }
  
  /**
   * Parse WebDAV multi-status XML response
   */
  private parseMultiStatus(xmlString: string, basePath: string): CloudFile[] {
    const files: CloudFile[] = [];
    
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlString, 'text/xml');
      const responses = doc.getElementsByTagNameNS('DAV:', 'response');
      
      for (let i = 0; i < responses.length; i++) {
        const response = responses[i];
        
        // Get href
        const hrefEl = response.getElementsByTagNameNS('DAV:', 'href')[0];
        const href = hrefEl?.textContent || '';
        
        // Get properties
        const propstat = response.getElementsByTagNameNS('DAV:', 'propstat')[0];
        const prop = propstat?.getElementsByTagNameNS('DAV:', 'prop')[0];
        
        if (!prop) continue;
        
        // Check if folder
        const resourceType = prop.getElementsByTagNameNS('DAV:', 'resourcetype')[0];
        const isFolder = resourceType?.getElementsByTagNameNS('DAV:', 'collection').length > 0;
        
        // Get size
        const contentLength = prop.getElementsByTagNameNS('DAV:', 'getcontentlength')[0];
        const size = parseInt(contentLength?.textContent || '0', 10);
        
        // Get modified date
        const lastModified = prop.getElementsByTagNameNS('DAV:', 'getlastmodified')[0];
        const modifiedAt = lastModified?.textContent 
          ? new Date(lastModified.textContent).getTime() 
          : Date.now();
        
        // Get etag
        const etag = prop.getElementsByTagNameNS('DAV:', 'getetag')[0];
        
        // Parse path and name
        const decodedHref = decodeURIComponent(href);
        const path = decodedHref.replace(/\/$/, '');
        const name = path.split('/').pop() || '';
        
        files.push({
          id: path,
          name,
          path,
          mimeType: isFolder ? 'folder' : this.getMimeType(name),
          size,
          checksum: etag?.textContent?.replace(/"/g, ''),
          modifiedAt,
          isFolder,
        });
      }
    } catch (error) {
      console.error('Error parsing WebDAV response:', error);
    }
    
    return files;
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
