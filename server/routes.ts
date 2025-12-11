import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { randomUUID } from "crypto";
import * as bcrypt from "bcryptjs";

// Simple in-memory session store (in production, use Redis or similar)
const sessions = new Map<string, { userId: string; expiresAt: Date }>();

// Session middleware
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

function createSession(res: Response, userId: string): void {
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  
  sessions.set(sessionId, { userId, expiresAt });
  
  res.cookie('session_id', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
  });
}

function clearSession(req: Request, res: Response): void {
  const sessionId = req.cookies?.session_id;
  if (sessionId) {
    sessions.delete(sessionId);
  }
  res.clearCookie('session_id');
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth routes
  
  // Get current user
  app.get('/api/auth/me', async (req: Request, res: Response) => {
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
      
      res.json({
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          createdAt: user.createdAt,
        },
      });
    } catch (error) {
      console.error('Auth check error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });
  
  // Sign up
  app.post('/api/auth/signup', async (req: Request, res: Response) => {
    try {
      const { email, password, displayName } = req.body;
      
      if (!email || !password || !displayName) {
        return res.status(400).json({ error: 'Email, password, and name are required' });
      }
      
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }
      
      // Check if user exists
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ error: 'An account with this email already exists' });
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);
      
      // Create user
      const user = await storage.createUser({
        email,
        username: email, // Use email as username for now
        password: hashedPassword,
        displayName,
      });
      
      // Create session
      createSession(res, user.id);
      
      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          createdAt: user.createdAt,
        },
      });
    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });
  
  // Login
  app.post('/api/auth/login', async (req: Request, res: Response) => {
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
      
      res.json({
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          createdAt: user.createdAt,
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });
  
  // Logout
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    clearSession(req, res);
    res.json({ success: true });
  });

  const httpServer = createServer(app);

  return httpServer;
}
