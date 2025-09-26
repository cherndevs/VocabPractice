import { type User, type InsertUser, type Session, type InsertSession, type Settings, type InsertSettings, users, sessions, settings } from "@shared/schema";
import { randomUUID } from "crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, desc, eq } from "drizzle-orm";

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

class PgStorage implements IStorage {
  private client;
  private db;

  constructor(connectionString: string) {
    this.client = postgres(connectionString, { ssl: "require" });
    this.db = drizzle(this.client);
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await this.db.insert(users).values(insertUser).returning();
    return result[0]!;
  }

  async getSessions(): Promise<Session[]> {
    const result = await this.db.select().from(sessions).orderBy(desc(sessions.createdAt));
    return result;
  }

  async getSession(id: string): Promise<Session | undefined> {
    const result = await this.db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
    return result[0];
  }

  async createSession(insertSession: InsertSession): Promise<Session> {
    const now = new Date();
    const result = await this.db
      .insert(sessions)
      .values({
        title: insertSession.title,
        words: insertSession.words as unknown as string[],
        status: insertSession.status ?? "new",
        wordCount: insertSession.wordCount,
        progress: insertSession.progress ?? 0,
        timeSpent: insertSession.timeSpent ?? 0,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return result[0]!;
  }

  async updateSession(id: string, updates: Partial<Session>): Promise<Session | undefined> {
    const result = await this.db
      .update(sessions)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, id))
      .returning();
    return result[0];
  }

  async deleteSession(id: string): Promise<boolean> {
    const result = await this.db.delete(sessions).where(eq(sessions.id, id)).returning({ id: sessions.id });
    return result.length > 0;
  }

  async getSettings(): Promise<Settings | undefined> {
    const result = await this.db.select().from(settings).limit(1);
    return result[0];
  }

  async updateSettings(updates: Partial<Settings>): Promise<Settings> {
    const existing = await this.getSettings();
    if (!existing) {
      const inserted = await this.db.insert(settings).values({ ...updates }).returning();
      return inserted[0]!;
    }
    const result = await this.db
      .update(settings)
      .set({ ...updates })
      .where(eq(settings.id, existing.id))
      .returning();
    return result[0]!;
  }
}

const shouldUsePg = process.env.NODE_ENV === "production" && !!process.env.DATABASE_URL;
export const storage: IStorage = shouldUsePg
  ? new PgStorage(process.env.DATABASE_URL as string)
  : new MemStorage();
