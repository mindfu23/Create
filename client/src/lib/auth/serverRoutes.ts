/**
 * Reusable Server-Side Auth Routes
 * 
 * Express routes for authentication. Copy this to your server and configure
 * with your own storage implementation.
 * 
 * Required dependencies:
 * - bcryptjs
 * - cookie-parser (must be added to express app)
 * 
 * Usage:
 * ```
 * import { createAuthRoutes } from './authRoutes';
 * 
 * const authRoutes = createAuthRoutes({
 *   storage: myStorageImplementation,
 *   sessionDays: 30,
 *   cookieSecure: process.env.NODE_ENV === 'production',
 * });
 * 
 * app.use('/api/auth', authRoutes);
 * ```
 */

import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  password: string;
  createdAt: Date | string;
}

export interface AuthStorage {
  /** Get user by ID */
  getUser(id: string): Promise<AuthUser | null>;
  /** Get user by email */
  getUserByEmail(email: string): Promise<AuthUser | null>;
  /** Create a new user */
  createUser(data: {
    email: string;
    username: string;
    password: string;
    displayName: string;
  }): Promise<AuthUser>;
}

export interface AuthRoutesConfig {
  /** Storage implementation for user operations */
  storage: AuthStorage;
  /** Session duration in days (default: 30) */
  sessionDays?: number;
  /** Whether to use secure cookies (default: false, set true in production) */
  cookieSecure?: boolean;
  /** Cookie same-site setting (default: 'lax') */
  cookieSameSite?: 'strict' | 'lax' | 'none';
  /** Password hash rounds (default: 12) */
  bcryptRounds?: number;
  /** Minimum password length (default: 8) */
  minPasswordLength?: number;
}

// Simple in-memory session store
// In production, replace with Redis, database, or other persistent store
const sessions = new Map<string, { userId: string; expiresAt: Date }>();

export function createAuthRoutes(config: AuthRoutesConfig): Router {
  const router = Router();
  
  const {
    storage,
    sessionDays = 30,
    cookieSecure = false,
    cookieSameSite = 'lax',
    bcryptRounds = 12,
    minPasswordLength = 8,
  } = config;

  // Helper: Get session from request
  function getSession(req: Request): { userId: string } | null {
    const sessionId = req.cookies?.session_id;
    if (!sessionId) return null;
    
    const session = sessions.get(sessionId);
    if (!session) return null;
    
    if (session.expiresAt < new Date()) {
      sessions.delete(sessionId);
      return null;
    }
    
    return { userId: session.userId };
  }

  // Helper: Create session
  function createSession(res: Response, userId: string): void {
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000);
    
    sessions.set(sessionId, { userId, expiresAt });
    
    res.cookie('session_id', sessionId, {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: cookieSameSite,
      expires: expiresAt,
    });
  }

  // Helper: Clear session
  function clearSession(req: Request, res: Response): void {
    const sessionId = req.cookies?.session_id;
    if (sessionId) {
      sessions.delete(sessionId);
    }
    res.clearCookie('session_id');
  }

  // Helper: Sanitize user for response (remove password)
  function sanitizeUser(user: AuthUser) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      createdAt: user.createdAt,
    };
  }

  // GET /me - Get current authenticated user
  router.get('/me', async (req: Request, res: Response) => {
    try {
      const session = getSession(req);
      if (!session) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const user = await storage.getUser(session.userId);
      if (!user) {
        clearSession(req, res);
        return res.status(401).json({ error: 'User not found' });
      }
      
      res.json({ user: sanitizeUser(user) });
    } catch (error) {
      console.error('Auth check error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // POST /signup - Create new account
  router.post('/signup', async (req: Request, res: Response) => {
    try {
      const { email, password, displayName } = req.body;
      
      // Validation
      if (!email || !password || !displayName) {
        return res.status(400).json({ error: 'Email, password, and name are required' });
      }
      
      if (password.length < minPasswordLength) {
        return res.status(400).json({ error: `Password must be at least ${minPasswordLength} characters` });
      }
      
      // Check if user exists
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ error: 'An account with this email already exists' });
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, bcryptRounds);
      
      // Create user
      const user = await storage.createUser({
        email,
        username: email, // Use email as username by default
        password: hashedPassword,
        displayName,
      });
      
      // Create session
      createSession(res, user.id);
      
      res.status(201).json({ user: sanitizeUser(user) });
    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // POST /login - Authenticate user
  router.post('/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }
      
      // Find user
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      
      // Check password
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      
      // Create session
      createSession(res, user.id);
      
      res.json({ user: sanitizeUser(user) });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // POST /logout - End session
  router.post('/logout', (req: Request, res: Response) => {
    clearSession(req, res);
    res.json({ success: true });
  });

  return router;
}

/**
 * Express middleware to require authentication
 * Usage: app.get('/protected', requireAuth, handler)
 */
export function createRequireAuth(getSession: (req: Request) => { userId: string } | null) {
  return (req: Request, res: Response, next: () => void) => {
    const session = getSession(req);
    if (!session) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    (req as any).userId = session.userId;
    next();
  };
}
