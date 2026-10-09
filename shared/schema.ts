import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, date, jsonb, boolean, doublePrecision, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";
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
// The Subjects whose words get a Meaning (CONTEXT.md, ADR-0011).
export const MEANING_SUBJECTS: readonly Subject[] = ["chinese"];

// A Session Type says what a session is for, and so which skill it practises
// (ADR-0008). Fixed at creation; the in-session Write/Read/Peek view is a
// separate, freely-switched display choice.
export const SESSION_TYPES = ["spelling", "reading"] as const;
export type SessionType = (typeof SESSION_TYPES)[number];
export const sessionTypeSchema = z.enum(SESSION_TYPES);

// The skill a grade or review state is about (ADR-0010). A session's skill
// comes from its Session Type.
export const SKILLS = SESSION_TYPES;
export type Skill = SessionType;
export const skillSchema = sessionTypeSchema;

// The FSRS rating scale behind review scheduling. Spelling's Offline Grading
// only ever sends "again" (Oops) or "good" (I've got this).
export const GRADES = ["again", "hard", "good", "easy"] as const;
export type Grade = (typeof GRADES)[number];
export const gradeSchema = z.enum(GRADES);

// A Lesson is the school unit a session can be tagged with (CONTEXT.md). It is
// created implicitly the first time a name is used; there is no management
// screen. `topic` is reserved for a later description and has no UI yet.
export const lessons = pgTable(
  "lessons",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    subject: text("subject").notNull().$type<Subject>(),
    name: text("name").notNull(), // trimmed
    topic: text("topic"),
  },
  (t) => [uniqueIndex("lessons_subject_name_unique").on(t.subject, t.name)],
);

// A Due date is a calendar day (YYYY-MM-DD): no time, no time zone, so it
// reads back as the exact day it was set. Kept as a string end to end.
export const dueDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "Not a real calendar date")
  .nullable();

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
  lessonId: varchar("lesson_id").references(() => lessons.id),
  dueDate: date("due_date", { mode: "string" }),
  pinnedAt: timestamp("pinned_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// What the app knows about how well one word is remembered in one skill, and
// when it next needs practice: the FSRS card fields. Scheduled on the server.
export const reviewStates = pgTable(
  "review_states",
  {
    subject: text("subject").notNull().$type<Subject>(),
    word: text("word").notNull(), // trimmed
    skill: text("skill").notNull().$type<Skill>(),
    due: timestamp("due").notNull(),
    stability: doublePrecision("stability").notNull(),
    difficulty: doublePrecision("difficulty").notNull(),
    elapsedDays: integer("elapsed_days").notNull(),
    scheduledDays: integer("scheduled_days").notNull(),
    learningSteps: integer("learning_steps").notNull(),
    reps: integer("reps").notNull(),
    lapses: integer("lapses").notNull(),
    state: integer("state").notNull(), // ts-fsrs State enum
    lastReview: timestamp("last_review"),
  },
  (t) => [primaryKey({ columns: [t.subject, t.word, t.skill] })],
);

// One row per word, keyed like review_states (ADR-0011). Holds the word's
// Meaning: generated once, never regenerated after a parent edits it.
export const words = pgTable(
  "words",
  {
    subject: text("subject").notNull().$type<Subject>(),
    word: text("word").notNull(), // trimmed
    meaning: text("meaning"),
    edited: boolean("edited").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.subject, t.word] })],
);

// Append-only record of every grade, kept raw so FSRS weights can be fitted
// later. The client generates the id, which makes a replayed POST a no-op.
// There is deliberately no source column: an Offline Grading grade is stored
// indistinguishably from any future recognition-derived one.
export const gradeLog = pgTable("grade_log", {
  id: varchar("id").primaryKey(),
  subject: text("subject").notNull().$type<Subject>(),
  word: text("word").notNull(),
  skill: text("skill").notNull().$type<Skill>(),
  grade: text("grade").notNull().$type<Grade>(),
  gradedAt: timestamp("graded_at").notNull(),
  sessionId: text("session_id"),
});

export const DEFAULT_REFRESHER_SIZE = 20;

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
  // How many words one Refresher holds at most (CONTEXT.md: Refresher).
  refresherSize: integer("refresher_size").notNull().default(DEFAULT_REFRESHER_SIZE),
});

export const insertSessionSchema = createInsertSchema(sessions, {
  subject: subjectSchema,
  sessionType: sessionTypeSchema,
  dueDate: dueDateSchema.optional(),
}).omit({
  id: true,
  lessonId: true,
  createdAt: true,
  updatedAt: true,
});

// Sent alongside a session on create and update: a name to tag with (new to
// the Subject creates the Lesson), or null to clear the tag.
export const lessonNameSchema = z.string().nullable();

export const insertSettingsSchema = createInsertSchema(settings, {
  activeSubject: subjectSchema.optional(),
  refresherSize: z.number().int().min(1).optional(),
}).omit({
  id: true,
});

export const gradeInputSchema = z.object({
  id: z.string().min(1).max(100),
  subject: subjectSchema,
  word: z.string().trim().min(1),
  skill: skillSchema,
  grade: gradeSchema,
  gradedAt: z.coerce.date().refine((d) => !Number.isNaN(d.getTime()), "Invalid date"),
  sessionId: z.string().nullish().transform((v) => v ?? null),
});
export const gradeBatchSchema = z.object({
  grades: z.array(gradeInputSchema).max(500),
});
export type GradeInput = z.infer<typeof gradeInputSchema>;
export type ReviewState = typeof reviewStates.$inferSelect;
export type WordRow = typeof words.$inferSelect;

// A Meaning sent with a list being saved: from the preview (edited false) or
// typed by a parent (edited true, never regenerated; blank clears it).
export const meaningEntrySchema = z.object({ word: z.string(), meaning: z.string(), edited: z.boolean() });
export type MeaningEntry = z.infer<typeof meaningEntrySchema>;
export const meaningEntriesSchema = z.array(meaningEntrySchema);

export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
/** A session as the API returns it: the Lesson it is tagged with, if any. */
export type SessionWithLesson = Session & { lesson: Pick<Lesson, "id" | "name"> | null };
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});
