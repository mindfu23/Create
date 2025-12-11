# Reusable Authentication Module

A complete, configurable authentication solution for React applications with Express backends.

## Features

- 🔐 Email/password authentication
- 🔄 Session management with cookies
- 💾 Local storage caching for offline support
- 🎨 Configurable UI (colors, text, password requirements)
- 📦 Easy to copy and reuse in other projects

## Quick Start

### 1. Copy the Files

Copy the entire `auth` folder to your project's `src/lib/` directory.

### 2. Install Dependencies

```bash
# Server-side
npm install bcryptjs cookie-parser
npm install -D @types/bcryptjs @types/cookie-parser
```

### 3. Set Up the Client

```tsx
// App.tsx
import { AuthProvider, AuthModal } from '@/lib/auth';

function App() {
  return (
    <AuthProvider config={{
      apiBaseUrl: '/api/auth',
      storageKey: 'myapp_auth',
    }}>
      <AuthModal config={{
        primaryColor: '#3b82f6',
        loginTitle: 'Welcome to MyApp',
      }} />
      <YourApp />
    </AuthProvider>
  );
}
```

### 4. Set Up the Server

```typescript
// server/index.ts
import express from 'express';
import cookieParser from 'cookie-parser';
import { createAuthRoutes } from './authRoutes';
import { myStorage } from './storage';

const app = express();
app.use(cookieParser());
app.use(express.json());

const authRoutes = createAuthRoutes({
  storage: myStorage,
  cookieSecure: process.env.NODE_ENV === 'production',
});

app.use('/api/auth', authRoutes);
```

### 5. Implement Storage Interface

Your storage must implement the `AuthStorage` interface:

```typescript
interface AuthStorage {
  getUser(id: string): Promise<AuthUser | null>;
  getUserByEmail(email: string): Promise<AuthUser | null>;
  createUser(data: {
    email: string;
    username: string;
    password: string;
    displayName: string;
  }): Promise<AuthUser>;
}
```

## Usage in Components

```tsx
import { useAuth } from '@/lib/auth';

function SaveButton() {
  const { isAuthenticated, requireAuth } = useAuth();

  const handleSave = () => {
    // This will show login modal if not authenticated
    if (!requireAuth()) return;
    
    // User is authenticated, proceed with save
    saveData();
  };

  return <button onClick={handleSave}>Save</button>;
}
```

## Configuration Options

### AuthProvider Config

| Option | Default | Description |
|--------|---------|-------------|
| `apiBaseUrl` | `/api/auth` | Base URL for auth API endpoints |
| `storageKey` | `app_auth` | LocalStorage key for caching auth state |
| `sessionDays` | `30` | Session duration in days |

### AuthModal Config

| Option | Default | Description |
|--------|---------|-------------|
| `loginTitle` | `Welcome Back!` | Title for login mode |
| `signupTitle` | `Create Account` | Title for signup mode |
| `loginDescription` | `Sign in to save...` | Description for login |
| `signupDescription` | `Sign up to save...` | Description for signup |
| `primaryColor` | `#f3c053` | Primary button color |
| `primaryHoverColor` | `#e5b347` | Primary button hover color |
| `primaryTextColor` | `black` | Primary button text color |
| `minPasswordLength` | `8` | Minimum password length |

### Server Routes Config

| Option | Default | Description |
|--------|---------|-------------|
| `storage` | required | Storage implementation |
| `sessionDays` | `30` | Session duration in days |
| `cookieSecure` | `false` | Use secure cookies (set true in production) |
| `cookieSameSite` | `lax` | Cookie SameSite attribute |
| `bcryptRounds` | `12` | Password hash rounds |
| `minPasswordLength` | `8` | Minimum password length |

## API Endpoints

The auth routes create the following endpoints:

- `GET /api/auth/me` - Get current user
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Sign in
- `POST /api/auth/logout` - Sign out

## Production Notes

1. **Session Storage**: The default implementation uses in-memory sessions. For production, replace with Redis or database storage.

2. **Secure Cookies**: Always set `cookieSecure: true` in production.

3. **HTTPS**: Auth requires HTTPS in production for secure cookies.

4. **Environment Variables**: Store secrets in environment variables, not in code.
