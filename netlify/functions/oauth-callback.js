/**
 * OAuth Callback Handler - Netlify Function
 * 
 * Handles OAuth callbacks from cloud providers.
 * This function receives the authorization code and exchanges it for tokens.
 */

import { neon } from '@neondatabase/serverless';

// Provider configurations
const PROVIDERS = {
  dropbox: {
    tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
  },
  google_drive: {
    tokenUrl: 'https://oauth2.googleapis.com/token',
  },
  onedrive: {
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  },
  box: {
    tokenUrl: 'https://api.box.com/oauth2/token',
  },
};

export async function handler(event, context) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
      body: '',
    };
  }

  const { code, state, error, error_description } = event.queryStringParameters || {};
  
  // Handle OAuth errors
  if (error) {
    console.error('OAuth error:', error, error_description);
    return redirectWithError(error_description || error);
  }
  
  if (!code || !state) {
    return redirectWithError('Missing authorization code or state');
  }
  
  // Parse state
  let stateData;
  try {
    stateData = JSON.parse(Buffer.from(state, 'base64').toString());
  } catch (e) {
    return redirectWithError('Invalid state parameter');
  }
  
  const { provider, userId, timestamp } = stateData;
  
  // Validate state timestamp (10 minute expiry)
  if (Date.now() - timestamp > 10 * 60 * 1000) {
    return redirectWithError('Authorization session expired');
  }
  
  // Validate provider
  if (!PROVIDERS[provider]) {
    return redirectWithError('Unknown provider');
  }
  
  // Get provider credentials from environment
  const clientId = process.env[`${provider.toUpperCase()}_CLIENT_ID`] || 
                   process.env[`${provider.toUpperCase().replace('_', '')}_CLIENT_ID`];
  const clientSecret = process.env[`${provider.toUpperCase()}_CLIENT_SECRET`] ||
                       process.env[`${provider.toUpperCase().replace('_', '')}_CLIENT_SECRET`];
  
  if (!clientId || !clientSecret) {
    console.error(`Missing credentials for provider: ${provider}`);
    return redirectWithError('Provider not configured');
  }
  
  // Build redirect URI
  const baseUrl = process.env.URL || `https://${event.headers.host}`;
  const redirectUri = `${baseUrl}/.netlify/functions/oauth-callback?provider=${provider}`;
  
  try {
    // Exchange code for tokens
    const tokenResponse = await fetch(PROVIDERS[provider].tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return redirectWithError('Failed to complete authorization');
    }
    
    const tokens = await tokenResponse.json();
    
    // Store tokens temporarily (will be picked up by client)
    // In production, you might want to store these more securely
    const tokenData = {
      provider,
      userId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expires_in ? Date.now() + (tokens.expires_in * 1000) : null,
      tokenType: tokens.token_type,
      scope: tokens.scope,
      timestamp: Date.now(),
    };
    
    // Encode token data for client pickup
    const encodedTokens = Buffer.from(JSON.stringify(tokenData)).toString('base64');
    
    // Redirect back to app with success
    return {
      statusCode: 302,
      headers: {
        'Location': `${baseUrl}/settings/cloud-storage?success=true&tokens=${encodedTokens}`,
        'Cache-Control': 'no-store',
      },
      body: '',
    };
    
  } catch (error) {
    console.error('OAuth callback error:', error);
    return redirectWithError('Authorization failed');
  }
}

function redirectWithError(message) {
  const baseUrl = process.env.URL || 'http://localhost:5000';
  const encodedMessage = encodeURIComponent(message);
  
  return {
    statusCode: 302,
    headers: {
      'Location': `${baseUrl}/settings/cloud-storage?error=${encodedMessage}`,
      'Cache-Control': 'no-store',
    },
    body: '',
  };
}
