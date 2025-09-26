import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { users, sessions, settings, type User, type InsertUser, type Session, type InsertSession, type Settings, type InsertSettings } from "@shared/schema";
import type { IStorage } from "./storage";

export class TursoStorage implements IStorage {
  private db;

  constructor() {
    // Environment-based configuration
    const url = process.env.DATABASE_URL || "file:local.db";
    const authToken = process.env.TURSO_AUTH_TOKEN;

    console.log("TursoStorage initializing with:", { url, hasAuthToken: !!authToken });

    const client = createClient({
      url,
      authToken: authToken || undefined,
    });

    this.db = drizzle(client);
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
    return result[0];
  }

  async getSessions(): Promise<Session[]> {
    const results = await this.db.select().from(sessions).orderBy(sessions.createdAt);
    // Convert JSON strings back to arrays
    return results.map(session => ({
      ...session,
      words: typeof session.words === 'string' ? JSON.parse(session.words) : session.words
    }));
  }

  async getSession(id: string): Promise<Session | undefined> {
    const result = await this.db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
    if (!result[0]) return undefined;
    
    // Convert JSON string back to array
    return {
      ...result[0],
      words: typeof result[0].words === 'string' ? JSON.parse(result[0].words) : result[0].words
    };
  }

  async createSession(insertSession: InsertSession): Promise<Session> {
    console.log("TursoStorage.createSession called with:", insertSession);
    
    // Convert words array to JSON string for SQLite storage
    const sessionData = {
      ...insertSession,
      words: JSON.stringify(insertSession.words)
    };
    
    console.log("About to insert session data:", sessionData);
    
    const result = await this.db.insert(sessions).values(sessionData).returning();
    
    console.log("Insert result:", result);
    
    // Convert back to array for return value
    const returnData = {
      ...result[0],
      words: JSON.parse(result[0].words)
    };
    
    console.log("Returning session:", returnData);
    return returnData;
  }

  async updateSession(id: string, updates: Partial<Session>): Promise<Session | undefined> {
    // Convert words array to JSON string if present
    const updateData = {
      ...updates,
      ...(updates.words && { words: JSON.stringify(updates.words) }),
      updatedAt: new Date(),
    };
    
    const result = await this.db
      .update(sessions)
      .set(updateData)
      .where(eq(sessions.id, id))
      .returning();
      
    if (!result[0]) return undefined;
    
    // Convert JSON string back to array
    return {
      ...result[0],
      words: typeof result[0].words === 'string' ? JSON.parse(result[0].words) : result[0].words
    };
  }

  async deleteSession(id: string): Promise<boolean> {
    const result = await this.db.delete(sessions).where(eq(sessions.id, id));
    return result.changes > 0;
  }

  async getSettings(): Promise<Settings | undefined> {
    const result = await this.db.select().from(settings).limit(1);
    if (result.length === 0) {
      // Create default settings if none exist
      const defaultSettings: Partial<Settings> = {
        wordRepetitions: 2,
        pauseBetweenWords: 1500,
        notifications: true,
        darkMode: false,
        dataSync: false,
        enablePauseButton: true,
      };
      return await this.updateSettings(defaultSettings);
    }
    return result[0];
  }

  async updateSettings(updates: Partial<Settings>): Promise<Settings> {
    // Try to update existing settings first
    const existing = await this.db.select().from(settings).limit(1);
    
    if (existing.length > 0) {
      const result = await this.db
        .update(settings)
        .set(updates)
        .where(eq(settings.id, existing[0].id))
        .returning();
      return result[0];
    } else {
      // Create new settings if none exist
      const result = await this.db.insert(settings).values(updates).returning();
      return result[0];
    }
  }
}
