import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

// A Subject is what the user is learning in a Workspace (ADR-0005, ADR-0006).
// Stored as a key rather than an ISO language code so future subjects (e.g.
// maths) can join without rework.
export const SUBJECTS = ["chinese", "english"] as const;
export type Subject = (typeof SUBJECTS)[number];
export const DEFAULT_SUBJECT: Subject = "english";
export const subjectSchema = z.enum(SUBJECTS);

// A Session Type says what a session is for, and so which skill it practises
// (ADR-0008). Fixed at creation; the in-session Write/Read/Peek view is a
// separate, freely-switched display choice.
export const SESSION_TYPES = ["spelling", "reading"] as const;
export type SessionType = (typeof SESSION_TYPES)[number];
export const sessionTypeSchema = z.enum(SESSION_TYPES);

export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  subject: text("subject").notNull().$type<Subject>(),
  sessionType: text("session_type").notNull().$type<SessionType>(),
  words: jsonb("words").notNull().$type<string[]>(),
  status: text("status").notNull().default("new"), // new, in-progress, completed
  wordCount: integer("word_count").notNull(),
  progress: integer("progress").default(0), // number of words completed
  timeSpent: integer("time_spent").default(0), // in seconds
  pinnedAt: timestamp("pinned_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pin: varchar("pin").default("111111"), // 6-digit PIN
  wordRepetitions: integer("word_repetitions").default(2),
  pauseBetweenWords: integer("pause_between_words").default(1500), // milliseconds
  notifications: boolean("notifications").default(true),
  darkMode: boolean("dark_mode").default(false),
  dataSync: boolean("data_sync").default(false),
  enablePauseButton: boolean("enable_pause_button").default(true),
  // null means "never chosen"; the API reports DEFAULT_SUBJECT in that case.
  activeSubject: text("active_subject").$type<Subject>(),
});

export const insertSessionSchema = createInsertSchema(sessions, {
  subject: subjectSchema,
  sessionType: sessionTypeSchema,
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSettingsSchema = createInsertSchema(settings, {
  activeSubject: subjectSchema.optional(),
}).omit({
  id: true,
});

export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});
