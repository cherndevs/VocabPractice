import { DEFAULT_REFRESHER_SIZE, type User, type InsertUser, type Session, type InsertSession, type Lesson, type Settings, type InsertSettings, type Subject, type Skill, type ReviewState, type GradeInput, type Grade, type WordRow, users, sessions, lessons, settings, reviewStates, gradeLog, words } from "@shared/schema";
import { randomUUID } from "crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Sessions
  getSessions(subject: Subject): Promise<Session[]>;
  getSession(id: string): Promise<Session | undefined>;
  createSession(session: InsertSession & { lessonId?: string | null }): Promise<Session>;
  updateSession(id: string, updates: Partial<Session>): Promise<Session | undefined>;
  deleteSession(id: string): Promise<boolean>;

  // Lessons. A name is trimmed by the caller; (subject, name) is unique.
  getLessons(subject: Subject): Promise<Lesson[]>;
  getLesson(id: string): Promise<Lesson | undefined>;
  /** The Subject's Lesson with this name, created if it does not exist yet. */
  findOrCreateLesson(subject: Subject, name: string): Promise<Lesson>;

  // Grades and review state. The scheduling rules live in server/grades.ts;
  // storage only keeps what it is told.
  /** Appends to the grade log. False if the id was already logged. */
  logGrade(grade: GradeInput): Promise<boolean>;
  getReviewState(subject: Subject, word: string, skill: Skill): Promise<ReviewState | undefined>;
  getReviewStates(subject: Subject, skill: Skill, words: string[]): Promise<ReviewState[]>;
  saveReviewState(state: ReviewState): Promise<void>;
  /** Each word's most recent logged grade in this skill; words never graded are absent. */
  getLatestGrades(subject: Subject, skill: Skill, words: string[]): Promise<Map<string, Grade>>;
  /** Whether any grade has been logged as part of this session. */
  hasSessionGrades(sessionId: string): Promise<boolean>;

  // Words and their Meanings (ADR-0011). Words are trimmed by the caller.
  /** The rows that exist for these words. */
  getWords(subject: Subject, words: string[]): Promise<WordRow[]>;
  /** Adds generated meanings for words with no row yet; never touches an existing row. */
  addGeneratedMeanings(subject: Subject, meanings: Record<string, string>): Promise<void>;
  /** A parent's edit: creates or replaces the row and marks it edited. */
  setEditedMeaning(subject: Subject, word: string, meaning: string | null): Promise<WordRow>;

  // Settings
  getSettings(): Promise<Settings | undefined>;
  updateSettings(settings: Partial<Settings>): Promise<Settings>;
}

function latestByWord(rows: { word: string; grade: Grade; gradedAt: Date | string }[]): Map<string, Grade> {
  const latest = new Map<string, { grade: Grade; at: number }>();
  for (const r of rows) {
    const at = new Date(r.gradedAt).getTime();
    const seen = latest.get(r.word);
    if (!seen || at >= seen.at) latest.set(r.word, { grade: r.grade, at });
  }
  return new Map(Array.from(latest, ([word, { grade }]) => [word, grade]));
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private sessions: Map<string, Session>;
  private lessons = new Map<string, Lesson>();
  private settings: Settings | undefined;
  private grades = new Map<string, GradeInput>();
  private reviewStates = new Map<string, ReviewState>();
  private wordRows = new Map<string, WordRow>();

  constructor() {
    this.users = new Map();
    this.sessions = new Map();
    this.settings = {
      id: randomUUID(),
      pin: "111111",
      wordRepetitions: 2,
      pauseBetweenWords: 1500,
      notifications: true,
      darkMode: false,
      dataSync: false,
      enablePauseButton: true,
      activeSubject: null,
      refresherSize: DEFAULT_REFRESHER_SIZE,
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

  async getSessions(subject: Subject): Promise<Session[]> {
    return Array.from(this.sessions.values())
      .filter((session) => session.subject === subject)
      .sort((a, b) => {
        const aPinnedTime = a.pinnedAt ? new Date(a.pinnedAt).getTime() : -Infinity;
        const bPinnedTime = b.pinnedAt ? new Date(b.pinnedAt).getTime() : -Infinity;

        if (aPinnedTime !== bPinnedTime) {
          return bPinnedTime - aPinnedTime; // pinned first, newest pinned first
        }

        const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bCreated - aCreated; // newest created first
      });
  }

  async getSession(id: string): Promise<Session | undefined> {
    return this.sessions.get(id);
  }

  async createSession(insertSession: InsertSession & { lessonId?: string | null }): Promise<Session> {
    const id = randomUUID();
    const now = new Date();
    const session: Session = {
      id,
      title: insertSession.title,
      subject: insertSession.subject,
      sessionType: insertSession.sessionType,
      words: insertSession.words as string[],
      status: insertSession.status || "new",
      wordCount: insertSession.wordCount,
      progress: insertSession.progress || 0,
      timeSpent: insertSession.timeSpent || 0,
      lessonId: insertSession.lessonId ?? null,
      dueDate: insertSession.dueDate ?? null,
      pinnedAt: null,
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

  async getLessons(subject: Subject): Promise<Lesson[]> {
    return Array.from(this.lessons.values())
      .filter((lesson) => lesson.subject === subject)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getLesson(id: string): Promise<Lesson | undefined> {
    return this.lessons.get(id);
  }

  async findOrCreateLesson(subject: Subject, name: string): Promise<Lesson> {
    const existing = Array.from(this.lessons.values()).find((l) => l.subject === subject && l.name === name);
    if (existing) return existing;
    const lesson: Lesson = { id: randomUUID(), subject, name, topic: null };
    this.lessons.set(lesson.id, lesson);
    return lesson;
  }

  async logGrade(grade: GradeInput): Promise<boolean> {
    if (this.grades.has(grade.id)) return false;
    this.grades.set(grade.id, grade);
    return true;
  }

  async getLatestGrades(subject: Subject, skill: Skill, words: string[]): Promise<Map<string, Grade>> {
    const wanted = new Set(words);
    return latestByWord(
      Array.from(this.grades.values()).filter((g) => g.subject === subject && g.skill === skill && wanted.has(g.word)),
    );
  }

  async hasSessionGrades(sessionId: string): Promise<boolean> {
    return Array.from(this.grades.values()).some((g) => g.sessionId === sessionId);
  }

  private reviewKey(subject: Subject, word: string, skill: Skill) {
    return JSON.stringify([subject, word, skill]);
  }

  async getReviewState(subject: Subject, word: string, skill: Skill): Promise<ReviewState | undefined> {
    return this.reviewStates.get(this.reviewKey(subject, word, skill));
  }

  async getReviewStates(subject: Subject, skill: Skill, words: string[]): Promise<ReviewState[]> {
    const found: ReviewState[] = [];
    for (const word of Array.from(new Set(words))) {
      const state = this.reviewStates.get(this.reviewKey(subject, word, skill));
      if (state) found.push(state);
    }
    return found;
  }

  async saveReviewState(state: ReviewState): Promise<void> {
    this.reviewStates.set(this.reviewKey(state.subject, state.word, state.skill), state);
  }

  private wordKey(subject: Subject, word: string) {
    return JSON.stringify([subject, word]);
  }

  async getWords(subject: Subject, words: string[]): Promise<WordRow[]> {
    return Array.from(new Set(words)).flatMap((word) => this.wordRows.get(this.wordKey(subject, word)) ?? []);
  }

  async addGeneratedMeanings(subject: Subject, meanings: Record<string, string>): Promise<void> {
    for (const [word, meaning] of Object.entries(meanings)) {
      const key = this.wordKey(subject, word);
      if (!this.wordRows.has(key)) this.wordRows.set(key, { subject, word, meaning, edited: false });
    }
  }

  async setEditedMeaning(subject: Subject, word: string, meaning: string | null): Promise<WordRow> {
    const row: WordRow = { subject, word, meaning, edited: true };
    this.wordRows.set(this.wordKey(subject, word), row);
    return row;
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

  async getSessions(subject: Subject): Promise<Session[]> {
    const result = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.subject, subject))
      .orderBy(desc(sessions.pinnedAt), desc(sessions.createdAt));
    return result;
  }

  async getSession(id: string): Promise<Session | undefined> {
    const result = await this.db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
    return result[0];
  }

  async createSession(insertSession: InsertSession & { lessonId?: string | null }): Promise<Session> {
    const now = new Date();
    const result = await this.db
      .insert(sessions)
      .values({
        title: insertSession.title,
        subject: insertSession.subject,
        sessionType: insertSession.sessionType,
        words: insertSession.words as unknown as string[],
        status: insertSession.status ?? "new",
        wordCount: insertSession.wordCount,
        progress: insertSession.progress ?? 0,
        timeSpent: insertSession.timeSpent ?? 0,
        lessonId: insertSession.lessonId ?? null,
        dueDate: insertSession.dueDate ?? null,
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

  async getLessons(subject: Subject): Promise<Lesson[]> {
    return this.db.select().from(lessons).where(eq(lessons.subject, subject)).orderBy(asc(lessons.name));
  }

  async getLesson(id: string): Promise<Lesson | undefined> {
    const result = await this.db.select().from(lessons).where(eq(lessons.id, id)).limit(1);
    return result[0];
  }

  async findOrCreateLesson(subject: Subject, name: string): Promise<Lesson> {
    // The unique index makes concurrent creators converge on one row.
    await this.db.insert(lessons).values({ subject, name }).onConflictDoNothing();
    const result = await this.db
      .select()
      .from(lessons)
      .where(and(eq(lessons.subject, subject), eq(lessons.name, name)))
      .limit(1);
    return result[0]!;
  }

  async logGrade(grade: GradeInput): Promise<boolean> {
    const inserted = await this.db
      .insert(gradeLog)
      .values(grade)
      .onConflictDoNothing()
      .returning({ id: gradeLog.id });
    return inserted.length > 0;
  }

  async getReviewState(subject: Subject, word: string, skill: Skill): Promise<ReviewState | undefined> {
    const result = await this.db
      .select()
      .from(reviewStates)
      .where(and(eq(reviewStates.subject, subject), eq(reviewStates.word, word), eq(reviewStates.skill, skill)))
      .limit(1);
    return result[0];
  }

  async getReviewStates(subject: Subject, skill: Skill, words: string[]): Promise<ReviewState[]> {
    if (words.length === 0) return [];
    return this.db
      .select()
      .from(reviewStates)
      .where(and(eq(reviewStates.subject, subject), eq(reviewStates.skill, skill), inArray(reviewStates.word, words)));
  }

  async saveReviewState(state: ReviewState): Promise<void> {
    await this.db
      .insert(reviewStates)
      .values(state)
      .onConflictDoUpdate({ target: [reviewStates.subject, reviewStates.word, reviewStates.skill], set: state });
  }

  async getLatestGrades(subject: Subject, skill: Skill, words: string[]): Promise<Map<string, Grade>> {
    if (words.length === 0) return new Map();
    const rows = await this.db
      .select({ word: gradeLog.word, grade: gradeLog.grade, gradedAt: gradeLog.gradedAt })
      .from(gradeLog)
      .where(and(eq(gradeLog.subject, subject), eq(gradeLog.skill, skill), inArray(gradeLog.word, words)));
    return latestByWord(rows);
  }

  async hasSessionGrades(sessionId: string): Promise<boolean> {
    const rows = await this.db.select({ id: gradeLog.id }).from(gradeLog).where(eq(gradeLog.sessionId, sessionId)).limit(1);
    return rows.length > 0;
  }

  async getWords(subject: Subject, wanted: string[]): Promise<WordRow[]> {
    if (wanted.length === 0) return [];
    return this.db.select().from(words).where(and(eq(words.subject, subject), inArray(words.word, wanted)));
  }

  async addGeneratedMeanings(subject: Subject, meanings: Record<string, string>): Promise<void> {
    const rows = Object.entries(meanings).map(([word, meaning]) => ({ subject, word, meaning, edited: false }));
    if (rows.length === 0) return;
    await this.db.insert(words).values(rows).onConflictDoNothing();
  }

  async setEditedMeaning(subject: Subject, word: string, meaning: string | null): Promise<WordRow> {
    const row = { subject, word, meaning, edited: true };
    const result = await this.db
      .insert(words)
      .values(row)
      .onConflictDoUpdate({ target: [words.subject, words.word], set: { meaning, edited: true } })
      .returning();
    return result[0]!;
  }

  async getSettings(): Promise<Settings | undefined> {
    try {
      const result = await this.db.select().from(settings).limit(1);
      if (result[0]) return result[0];

      // Create a default settings row if none exists (mirrors defaults in schema)
      const inserted = await this.db
        .insert(settings)
        .values({})
        .returning();
      return inserted[0];
    } catch (err) {
      // Defensive fallback: if the database is unreachable or an error occurs,
      // log the error and return an in-memory default settings object so API
      // endpoints like /api/verify-pin don't return 500s for transient DB issues.
      console.error('[SETTINGS] error fetching settings from DB, returning defaults:', err);
      return {
        id: 'local-default',
        pin: '111111',
        wordRepetitions: 2,
        pauseBetweenWords: 1500,
        notifications: true,
        darkMode: false,
        dataSync: false,
        enablePauseButton: true,
        activeSubject: null,
        refresherSize: DEFAULT_REFRESHER_SIZE,
      } as Settings;
    }
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

const shouldUsePg = !!process.env.DATABASE_URL;
export const storage: IStorage = shouldUsePg
  ? new PgStorage(process.env.DATABASE_URL as string)
  : new MemStorage();
