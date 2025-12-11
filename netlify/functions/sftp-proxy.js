/**
 * SFTP Proxy - Netlify Function
 * 
 * Proxies SFTP operations using ssh2 library.
 * Note: This requires the ssh2 package to be installed.
 * 
 * For Netlify Functions, you may need to use a different approach
 * or consider using an external SFTP service API.
 * 
 * This is a simplified implementation - for production, consider:
 * 1. Using a dedicated SFTP microservice
 * 2. Using a third-party SFTP gateway service
 * 3. Running this on a traditional server instead of serverless
 */

// Note: ssh2 is a Node.js library that may have issues in serverless environments
// You'll need to add it to package.json: npm install ssh2

let Client;
try {
  // Dynamic import to handle cases where ssh2 isn't available
  Client = require('ssh2').Client;
} catch (e) {
  console.warn('ssh2 not available - SFTP proxy will return errors');
}

export async function handler(event, context) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }
  
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' }),
    };
  }
  
  // Check if ssh2 is available
  if (!Client) {
    return {
      statusCode: 501,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: false, 
        error: 'SFTP not available in this environment. Consider using WebDAV or a dedicated SFTP service.',
      }),
    };
  }
  
  try {
    const {
      action,
      host,
      port = 22,
      username,
      password,
      privateKey,
      basePath,
      path,
      oldPath,
      newPath,
      content,
      encoding,
    } = JSON.parse(event.body);
    
    // Validate required fields
    if (!host || !username || (!password && !privateKey)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Missing required fields' }),
      };
    }
    
    // Build full path
    const fullPath = basePath 
      ? `${basePath.replace(/\/$/, '')}${path?.startsWith('/') ? path : `/${path || ''}`}`
      : path || '/';
    
    // Execute SFTP operation
    const result = await executeSFTP({
      action,
      host,
      port,
      username,
      password,
      privateKey,
      path: fullPath,
      oldPath: oldPath ? `${basePath || ''}${oldPath}` : undefined,
      newPath: newPath ? `${basePath || ''}${newPath}` : undefined,
      content,
      encoding,
    });
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(result),
    };
    
  } catch (error) {
    console.error('SFTP proxy error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: error.message || 'SFTP error',
      }),
    };
  }
}

/**
 * Execute an SFTP operation
 */
async function executeSFTP(options) {
  const {
    action,
    host,
    port,
    username,
    password,
    privateKey,
    path,
    oldPath,
    newPath,
    content,
    encoding,
  } = options;
  
  return new Promise((resolve, reject) => {
    const conn = new Client();
    
    // Set timeout
    const timeout = setTimeout(() => {
      conn.end();
      reject(new Error('Connection timeout'));
    }, 30000);
    
    conn.on('ready', () => {
      conn.sftp((err, sftp) => {
        if (err) {
          clearTimeout(timeout);
          conn.end();
          return resolve({ success: false, error: err.message });
        }
        
        executeAction(sftp, action, { path, oldPath, newPath, content, encoding })
          .then(result => {
            clearTimeout(timeout);
            conn.end();
            resolve(result);
          })
          .catch(error => {
            clearTimeout(timeout);
            conn.end();
            resolve({ success: false, error: error.message });
          });
      });
    });
    
    conn.on('error', (err) => {
      clearTimeout(timeout);
      resolve({ success: false, error: err.message });
    });
    
    // Connect
    const connectConfig = {
      host,
      port,
      username,
    };
    
    if (privateKey) {
      connectConfig.privateKey = privateKey;
    } else {
      connectConfig.password = password;
    }
    
    conn.connect(connectConfig);
  });
}

/**
 * Execute a specific SFTP action
 */
async function executeAction(sftp, action, options) {
  const { path, oldPath, newPath, content, encoding } = options;
  
  switch (action) {
    case 'test':
      return new Promise((resolve) => {
        sftp.readdir('/', (err, list) => {
          if (err) {
            resolve({ success: false, error: err.message });
          } else {
            resolve({ success: true, data: true });
          }
        });
      });
      
    case 'list':
      return new Promise((resolve) => {
        sftp.readdir(path, (err, list) => {
          if (err) {
            resolve({ success: false, error: err.message });
          } else {
            const files = list.map(item => ({
              filename: item.filename,
              size: item.attrs.size,
              mtime: item.attrs.mtime,
              isDirectory: item.attrs.isDirectory(),
            }));
            resolve({ success: true, data: { files } });
          }
        });
      });
      
    case 'stat':
      return new Promise((resolve) => {
        sftp.stat(path, (err, stats) => {
          if (err) {
            resolve({ success: false, error: err.message });
          } else {
            resolve({
              success: true,
              data: {
                size: stats.size,
                mtime: stats.mtime,
                isDirectory: stats.isDirectory(),
              },
            });
          }
        });
      });
      
    case 'read':
      return new Promise((resolve) => {
        const chunks = [];
        const readStream = sftp.createReadStream(path);
        
        readStream.on('data', (chunk) => chunks.push(chunk));
        readStream.on('end', () => {
          const buffer = Buffer.concat(chunks);
          // Try to detect if it's text
          const isText = isTextBuffer(buffer);
          
          resolve({
            success: true,
            data: {
              content: isText ? buffer.toString('utf-8') : buffer.toString('base64'),
              encoding: isText ? 'utf-8' : 'base64',
            },
          });
        });
        readStream.on('error', (err) => {
          resolve({ success: false, error: err.message });
        });
      });
      
    case 'write':
      return new Promise((resolve) => {
        let buffer;
        if (encoding === 'base64') {
          buffer = Buffer.from(content, 'base64');
        } else {
          buffer = Buffer.from(content, 'utf-8');
        }
        
        const writeStream = sftp.createWriteStream(path);
        
        writeStream.on('close', () => {
          resolve({ success: true, data: true });
        });
        writeStream.on('error', (err) => {
          resolve({ success: false, error: err.message });
        });
        
        writeStream.end(buffer);
      });
      
    case 'delete':
      return new Promise((resolve) => {
        sftp.unlink(path, (err) => {
          if (err) {
            // Try rmdir in case it's a directory
            sftp.rmdir(path, (err2) => {
              if (err2) {
                resolve({ success: false, error: err.message });
              } else {
                resolve({ success: true, data: true });
              }
            });
          } else {
            resolve({ success: true, data: true });
          }
        });
      });
      
    case 'rename':
      return new Promise((resolve) => {
        sftp.rename(oldPath, newPath, (err) => {
          if (err) {
            resolve({ success: false, error: err.message });
          } else {
            resolve({ success: true, data: true });
          }
        });
      });
      
    case 'mkdir':
      return new Promise((resolve) => {
        sftp.mkdir(path, (err) => {
          if (err && !err.message.includes('already exists')) {
            resolve({ success: false, error: err.message });
          } else {
            resolve({ success: true, data: true });
          }
        });
      });
      
    default:
      return { success: false, error: `Unknown action: ${action}` };
  }
}

/**
 * Check if a buffer appears to be text
 */
function isTextBuffer(buffer) {
  // Check first 8KB for non-text characters
  const checkLength = Math.min(buffer.length, 8192);
  for (let i = 0; i < checkLength; i++) {
    const byte = buffer[i];
    // Check for common binary indicators
    if (byte === 0) return false;
    if (byte < 7) return false;
    if (byte > 14 && byte < 32 && byte !== 27) return false;
  }
  return true;
}
