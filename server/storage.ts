import { type User, type InsertUser, type Session, type InsertSession, type Settings, type InsertSettings } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Sessions
  getSessions(): Promise<Session[]>;
  getSession(id: string): Promise<Session | undefined>;
  createSession(session: InsertSession): Promise<Session>;
  updateSession(id: string, updates: Partial<Session>): Promise<Session | undefined>;
  deleteSession(id: string): Promise<boolean>;
  
  // Settings
  getSettings(): Promise<Settings | undefined>;
  updateSettings(settings: Partial<Settings>): Promise<Settings>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private sessions: Map<string, Session>;
  private settings: Settings | undefined;

  constructor() {
    this.users = new Map();
    this.sessions = new Map();
    this.settings = {
      id: randomUUID(),
      wordRepetitions: 2,
      pauseBetweenWords: 1500,
      notifications: true,
      darkMode: false,
      dataSync: false,
      enablePauseButton: true,
    };
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getSessions(): Promise<Session[]> {
    return Array.from(this.sessions.values()).sort((a, b) => 
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  }

  async getSession(id: string): Promise<Session | undefined> {
    return this.sessions.get(id);
  }

  async createSession(insertSession: InsertSession): Promise<Session> {
    const id = randomUUID();
    const now = new Date();
    const session: Session = {
      id,
      title: insertSession.title,
      words: insertSession.words as string[],
      status: insertSession.status || "new",
      wordCount: insertSession.wordCount,
      progress: insertSession.progress || 0,
      timeSpent: insertSession.timeSpent || 0,
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(id, session);
    return session;
  }

  async updateSession(id: string, updates: Partial<Session>): Promise<Session | undefined> {
    const session = this.sessions.get(id);
    if (!session) return undefined;

    const updatedSession: Session = {
      ...session,
      ...updates,
      updatedAt: new Date(),
    };
    this.sessions.set(id, updatedSession);
    return updatedSession;
  }

  async deleteSession(id: string): Promise<boolean> {
    return this.sessions.delete(id);
  }

  async getSettings(): Promise<Settings | undefined> {
    return this.settings;
  }

  async updateSettings(updates: Partial<Settings>): Promise<Settings> {
    this.settings = {
      ...this.settings!,
      ...updates,
    };
    return this.settings;
  }
}

import { TursoStorage } from "./turso-storage";

// Environment-based storage selection
function createStorage(): IStorage {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const hasDatabaseUrl = !!process.env.DATABASE_URL;
  const useTurso = process.env.USE_TURSO === 'true';
  
  console.log('Storage selection debug:', {
    NODE_ENV: process.env.NODE_ENV,
    isDevelopment,
    DATABASE_URL: process.env.DATABASE_URL,
    hasDatabaseUrl,
    useTurso
  });
  
  // Priority:
  // 1. If USE_TURSO=true is explicitly set, use Turso
  // 2. If DATABASE_URL is set, use Turso (cloud database)
  // 3. Default: use Turso with local SQLite file
  // 4. Only use MemStorage if explicitly disabled with USE_TURSO=false
  
  const disableTurso = process.env.USE_TURSO === 'false';
  
  if (!disableTurso) {
    console.log(`Using Turso storage with ${hasDatabaseUrl ? 'cloud database' : 'local SQLite'}`);
    const tursoStorage = new TursoStorage();
    console.log('TursoStorage instance created');
    return tursoStorage;
  }
  
  console.log('Using in-memory storage (data will not persist) - explicitly disabled Turso');
  return new MemStorage();
}

export const storage = createStorage();
