/**
 * WebDAV Proxy - Netlify Function
 * 
 * Proxies WebDAV requests to avoid CORS issues.
 * The client sends requests to this function, which forwards them to the WebDAV server.
 */

export async function handler(event, context) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
  
  try {
    const {
      method,
      path,
      serverUrl,
      username,
      password,
      basePath,
      headers: customHeaders,
      body: requestBody,
    } = JSON.parse(event.body);
    
    // Validate required fields
    if (!serverUrl || !username) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Missing required fields' }),
      };
    }
    
    // Build full URL
    const baseUrl = serverUrl.replace(/\/$/, '');
    const fullBasePath = basePath?.replace(/\/$/, '') || '';
    const fullPath = path?.startsWith('/') ? path : `/${path || ''}`;
    const url = `${baseUrl}${fullBasePath}${fullPath}`;
    
    // Build headers
    const headers = {
      'Authorization': 'Basic ' + Buffer.from(`${username}:${password || ''}`).toString('base64'),
      ...customHeaders,
    };
    
    // For PROPFIND, add required headers
    if (method === 'PROPFIND') {
      headers['Content-Type'] = 'application/xml';
      headers['Depth'] = customHeaders?.Depth || '1';
    }
    
    // Build request options
    const fetchOptions = {
      method: method || 'GET',
      headers,
    };
    
    // Add body for methods that support it
    if (['PUT', 'POST', 'PROPFIND', 'PROPPATCH'].includes(method) && requestBody) {
      if (typeof requestBody === 'string') {
        fetchOptions.body = requestBody;
      } else {
        fetchOptions.body = JSON.stringify(requestBody);
      }
    }
    
    // Make request
    const response = await fetch(url, fetchOptions);
    
    // Get response body
    let responseBody;
    const contentType = response.headers.get('Content-Type') || '';
    
    if (contentType.includes('xml') || method === 'PROPFIND') {
      responseBody = await response.text();
    } else if (contentType.includes('json')) {
      responseBody = await response.json();
    } else if (method === 'GET') {
      // For file downloads, return as base64
      const buffer = await response.arrayBuffer();
      responseBody = Buffer.from(buffer).toString('base64');
    } else {
      responseBody = await response.text();
    }
    
    // Check for success
    const success = response.ok || 
                   response.status === 201 || // Created
                   response.status === 204 || // No Content
                   response.status === 207;   // Multi-Status (WebDAV)
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success,
        statusCode: response.status,
        data: responseBody,
        error: success ? undefined : `HTTP ${response.status}`,
      }),
    };
    
  } catch (error) {
    console.error('WebDAV proxy error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Proxy error',
      }),
    };
  }
}
