/**
 * Cloud Storage Configuration
 * 
 * Central configuration for cloud storage providers.
 * Integrates with monetization for premium features.
 */

import type { CloudStorageConfig, CloudProvider } from '@shared/cloudStorage';
import { DEFAULT_CLOUD_STORAGE_CONFIG } from '@shared/cloudStorage';

// ============================================================================
// FEATURE FLAGS - Toggle for testing vs production
// ============================================================================

export const CLOUD_STORAGE_FLAGS = {
  // Master enable switch
  enabled: true,
  
  // Premium requirement - set to false for testing, true for production
  requirePremium: false,
  
  // Individual provider flags - disable any you don't want to support
  providers: {
    dropbox: true,
    google_drive: true,
    onedrive: true,
    box: true,
    webdav: true,
    sftp: true,
  } as Record<CloudProvider, boolean>,
  
  // Debug mode - extra logging
  debugMode: true,
};

// ============================================================================
// OAUTH REDIRECT CONFIGURATION
// ============================================================================

/**
 * Get the OAuth redirect URI for a provider
 * This should match what's configured in each provider's developer console
 */
export function getOAuthRedirectUri(provider: CloudProvider): string {
  const baseUrl = typeof window !== 'undefined' 
    ? window.location.origin 
    : 'http://localhost:5000';
  
  return `${baseUrl}/.netlify/functions/oauth-callback?provider=${provider}`;
}

/**
 * Get the OAuth state for security
 * Includes provider info and a random token for CSRF protection
 */
export function generateOAuthState(provider: CloudProvider, userId: string): string {
  const state = {
    provider,
    userId,
    nonce: Math.random().toString(36).substring(2),
    timestamp: Date.now(),
  };
  
  return btoa(JSON.stringify(state));
}

/**
 * Parse and validate OAuth state
 */
export function parseOAuthState(stateString: string): {
  provider: CloudProvider;
  userId: string;
  nonce: string;
  timestamp: number;
} | null {
  try {
    const state = JSON.parse(atob(stateString));
    
    // Validate timestamp (state valid for 10 minutes)
    if (Date.now() - state.timestamp > 10 * 60 * 1000) {
      console.error('OAuth state expired');
      return null;
    }
    
    return state;
  } catch {
    console.error('Invalid OAuth state');
    return null;
  }
}

// ============================================================================
// RUNTIME CONFIGURATION
// ============================================================================

let runtimeConfig: CloudStorageConfig = { ...DEFAULT_CLOUD_STORAGE_CONFIG };

/**
 * Get current cloud storage configuration
 */
export function getCloudStorageConfig(): CloudStorageConfig {
  return {
    ...runtimeConfig,
    enabled: CLOUD_STORAGE_FLAGS.enabled,
    requirePremium: CLOUD_STORAGE_FLAGS.requirePremium,
  };
}

/**
 * Update cloud storage configuration at runtime
 * Useful for A/B testing or dynamic feature toggling
 */
export function updateCloudStorageConfig(updates: Partial<CloudStorageConfig>): void {
  runtimeConfig = {
    ...runtimeConfig,
    ...updates,
  };
  
  if (CLOUD_STORAGE_FLAGS.debugMode) {
    console.log('[CloudStorage] Config updated:', runtimeConfig);
  }
}

/**
 * Check if cloud storage is available for the current user
 */
export function isCloudStorageAvailable(isPremiumUser: boolean): boolean {
  if (!CLOUD_STORAGE_FLAGS.enabled) {
    return false;
  }
  
  if (CLOUD_STORAGE_FLAGS.requirePremium && !isPremiumUser) {
    return false;
  }
  
  return true;
}

/**
 * Get list of enabled providers
 */
export function getEnabledProviders(): CloudProvider[] {
  return (Object.entries(CLOUD_STORAGE_FLAGS.providers) as [CloudProvider, boolean][])
    .filter(([_, enabled]) => enabled)
    .map(([provider]) => provider);
}

// ============================================================================
// LOCAL STORAGE KEYS
// ============================================================================

export const STORAGE_KEYS = {
  // Connection data
  CONNECTIONS: 'create_cloud_connections',
  
  // Active connection ID
  ACTIVE_CONNECTION: 'create_cloud_active_connection',
  
  // Sync queue for offline support
  SYNC_QUEUE: 'create_cloud_sync_queue',
  
  // Last sync timestamp per connection
  LAST_SYNC_PREFIX: 'create_cloud_last_sync_',
  
  // OAuth state for callback validation
  OAUTH_STATE: 'create_cloud_oauth_state',
};

// ============================================================================
// FILE PATH HELPERS
// ============================================================================

/**
 * Get the app folder path in cloud storage
 */
export function getAppFolderPath(): string {
  return `/${runtimeConfig.appFolderName}`;
}

/**
 * Get the full cloud path for a local file
 */
export function getCloudPath(localId: string, fileType: 'journal' | 'project' | 'todo' | 'graphic'): string {
  const appFolder = getAppFolderPath();
  return `${appFolder}/${fileType}s/${localId}.json`;
}

/**
 * Generate a conflict copy filename
 */
export function getConflictCopyPath(originalPath: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const ext = originalPath.split('.').pop();
  const basePath = originalPath.replace(`.${ext}`, '');
  return `${basePath}_conflict_${timestamp}.${ext}`;
}
