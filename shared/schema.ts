import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, blob } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$default(() => crypto.randomUUID()),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey().$default(() => crypto.randomUUID()),
  title: text("title").notNull(),
  words: text("words").notNull(), // JSON string of string array
  status: text("status").notNull().default("new"), // new, in-progress, completed
  wordCount: integer("word_count").notNull(),
  progress: integer("progress").default(0), // number of words completed
  timeSpent: integer("time_spent").default(0), // in seconds
  createdAt: integer("created_at", { mode: 'timestamp' }).$default(() => new Date()),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).$default(() => new Date()),
});

export const settings = sqliteTable("settings", {
  id: text("id").primaryKey().$default(() => crypto.randomUUID()),
  wordRepetitions: integer("word_repetitions").default(2),
  pauseBetweenWords: integer("pause_between_words").default(1500), // milliseconds
  notifications: integer("notifications", { mode: 'boolean' }).default(true),
  darkMode: integer("dark_mode", { mode: 'boolean' }).default(false),
  dataSync: integer("data_sync", { mode: 'boolean' }).default(false),
  enablePauseButton: integer("enable_pause_button", { mode: 'boolean' }).default(true),
});

export const insertSessionSchema = createInsertSchema(sessions)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    // Override words field to accept string array (frontend sends this)
    words: z.array(z.string()),
  });

export const insertSettingsSchema = createInsertSchema(settings).omit({
  id: true,
});

export type InsertSession = z.infer<typeof insertSessionSchema>;
// Override the auto-generated Session type to have words as string[] (not string)
export type Session = Omit<typeof sessions.$inferSelect, 'words'> & {
  words: string[];
};
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});
