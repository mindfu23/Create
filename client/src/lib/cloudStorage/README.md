# Reusable Cloud Storage Module

A complete, configurable cloud storage integration for React applications with Express backends. Supports OAuth providers (Dropbox, Google Drive, OneDrive, Box) and credential-based providers (WebDAV, SFTP).

## Features

- ☁️ Multiple cloud provider support
- 🔐 OAuth and credential-based authentication
- 🔄 Automatic sync with conflict resolution
- 💾 Local queue for offline support
- 🎨 Configurable UI components
- 📦 Easy to copy and reuse

## Quick Start

### 1. Copy the Files

Copy these folders/files to your project:
- `client/src/lib/cloudStorage/` - Client-side module
- `shared/cloudStorage.ts` - Shared types
- `client/src/components/CloudStorageSettings.tsx` - UI component (optional)

### 2. Install Dependencies

```bash
npm install react-icons
```

### 3. Set Up Environment Variables

Create a `.env` file with your OAuth credentials:

```env
# Dropbox
VITE_DROPBOX_CLIENT_ID=your_dropbox_client_id
VITE_DROPBOX_CLIENT_SECRET=your_dropbox_client_secret

# Google Drive
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_GOOGLE_CLIENT_SECRET=your_google_client_secret

# OneDrive
VITE_ONEDRIVE_CLIENT_ID=your_onedrive_client_id
VITE_ONEDRIVE_CLIENT_SECRET=your_onedrive_client_secret

# Box
VITE_BOX_CLIENT_ID=your_box_client_id
VITE_BOX_CLIENT_SECRET=your_box_client_secret
```

### 4. Configure OAuth Redirect URIs

In each provider's developer console, add the redirect URI:
```
https://your-domain.com/.netlify/functions/oauth-callback?provider={provider}
```

For local development:
```
http://localhost:5000/.netlify/functions/oauth-callback?provider={provider}
```

### 5. Use in Your App

```tsx
import { useCloudStorage, useCloudProviders } from '@/lib/cloudStorage';
import { CloudStorageSettings } from '@/components/CloudStorageSettings';

function SettingsPage() {
  const { user } = useAuth();
  
  return (
    <CloudStorageSettings 
      userId={user.id}
      isPremiumUser={user.isPremium}
    />
  );
}
```

## Configuration

### Feature Flags

Edit `config.ts` to customize:

```typescript
export const CLOUD_STORAGE_FLAGS = {
  // Master enable switch
  enabled: true,
  
  // Premium requirement - set to false for testing
  requirePremium: false,
  
  // Individual provider flags
  providers: {
    dropbox: true,
    google_drive: true,
    onedrive: true,
    box: true,
    webdav: true,
    sftp: true,
  },
  
  // Debug mode
  debugMode: false,
};
```

### App-Specific Configuration

The module uses these storage keys (configurable in `config.ts`):

```typescript
export const STORAGE_KEYS = {
  connections: 'cloud_storage_connections',
  config: 'cloud_storage_config',
  queue: 'cloud_storage_queue',
};
```

## API Reference

### useCloudStorage Hook

```typescript
const {
  // Feature availability
  isAvailable,
  enabledProviders,
  
  // Connections
  connections,
  activeConnection,
  isLoading,
  
  // Sync status
  syncStatus,      // 'synced' | 'syncing' | 'error' | 'offline'
  pendingCount,
  errorCount,
  
  // Actions
  connectProvider,          // Start OAuth flow
  connectWithCredentials,   // Connect WebDAV/SFTP
  disconnect,
  deleteConnection,
  setDefaultConnection,
  testConnection,
  
  // Sync operations
  syncNow,
  queueSync,
  
  // File operations
  listFiles,
  uploadFile,
  downloadFile,
  
  // Refresh
  refresh,
} = useCloudStorage({ userId, isPremiumUser, autoSync: true });
```

### useCloudProviders Hook

```typescript
const providers = useCloudProviders();
// Returns: ProviderInfo[] - All available cloud providers
```

## Supported Providers

| Provider | Auth Method | Status |
|----------|-------------|--------|
| Dropbox | OAuth 2.0 | ✅ Ready |
| Google Drive | OAuth 2.0 | ✅ Ready |
| OneDrive | OAuth 2.0 | ✅ Ready |
| Box | OAuth 2.0 | ✅ Ready |
| WebDAV | Credentials | ✅ Ready |
| SFTP | Credentials | ✅ Ready |

## File Structure

```
client/src/lib/cloudStorage/
├── index.ts              # Main exports
├── config.ts             # Configuration & feature flags
├── connectionManager.ts  # Connection state management
├── syncService.ts        # Sync queue & conflict resolution
├── useCloudStorage.ts    # React hooks
└── providers/
    ├── index.ts          # Provider factory
    ├── base.ts           # Base provider interface
    ├── dropbox.ts        # Dropbox implementation
    ├── googleDrive.ts    # Google Drive implementation
    ├── onedrive.ts       # OneDrive implementation
    ├── box.ts            # Box implementation
    ├── webdav.ts         # WebDAV implementation
    └── sftp.ts           # SFTP implementation

shared/
└── cloudStorage.ts       # Shared types & schemas
```

## Server-Side Setup (Netlify Functions)

For OAuth callbacks, create a Netlify function:

```typescript
// netlify/functions/oauth-callback.ts
export async function handler(event: APIGatewayEvent) {
  const { provider, code, state } = event.queryStringParameters || {};
  
  // Exchange code for tokens
  // Store tokens securely
  // Redirect back to app
}
```

## Premium Gating

To make cloud storage a premium feature:

```typescript
// config.ts
export const CLOUD_STORAGE_FLAGS = {
  requirePremium: true,  // Enable premium requirement
};

// In your component
<CloudStorageSettings 
  userId={user.id}
  isPremiumUser={user.hasPremiumSubscription}
/>
```

## Customizing the UI

The `CloudStorageSettings` component accepts these props:

```typescript
interface CloudStorageSettingsProps {
  userId: string;
  isPremiumUser?: boolean;
  // Add more customization props as needed
}
```

To customize colors and styling, modify the component or create a wrapper that passes custom styles.

## Production Notes

1. **OAuth Secrets**: Never expose client secrets in frontend code. Use server-side token exchange.

2. **Token Storage**: Store OAuth tokens securely (encrypted in database, not localStorage).

3. **Rate Limiting**: Implement rate limiting for sync operations.

4. **Error Handling**: The module includes retry logic, but add monitoring for production.

5. **CORS**: Configure CORS appropriately for your OAuth callbacks.
