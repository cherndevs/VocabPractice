import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import type { IStorage } from "./storage";
import {
  DEFAULT_REFRESHER_SIZE,
  DEFAULT_SUBJECT,
  SKILLS,
  gradeBatchSchema,
  insertSessionSchema,
  insertSettingsSchema,
  lessonNameSchema,
  meaningEntriesSchema,
  dueDateSchema,
  skillSchema,
  subjectSchema,
  type Session,
  type Skill,
  type Subject,
} from "@shared/schema";
import { applyGrades } from "./grades";
import { needsReview, sessionRetrievability } from "./scheduling";
import { drillWords, learnWords } from "./drill";
import {
  extractSpellingLists,
  ExtractionServiceError,
  SUPPORTED_MEDIA_TYPES,
  type SupportedMediaType,
} from "./spelling-extraction";
import { generateMeaningsWithOpenRouter, normalizeWords, previewMeanings, saveMeanings, type GenerateMeanings } from "./meanings";

// Storage is injected rather than imported so tests can mount these routes on
// in-memory storage (CHE-29: the HTTP API is the testing seam).
// activeSubject is stored null until the user first chooses a workspace; the
// API reports the first-run default so clients never see null.
function withActiveSubject<T extends { activeSubject: string | null }>(settings: T) {
  return { ...settings, activeSubject: settings.activeSubject ?? DEFAULT_SUBJECT };
}

export interface RouteOptions {
  /** The server's clock; tests inject their own to move past due dates. */
  now?: () => Date;
  /** The AI call behind Meanings; tests inject a fake. */
  generateMeanings?: GenerateMeanings;
}

export async function registerRoutes(
  app: Express,
  storage: IStorage,
  { now = () => new Date(), generateMeanings = generateMeaningsWithOpenRouter }: RouteOptions = {},
): Promise<Server> {
  // Spelling list extraction — relays a worksheet photo to Claude and returns
  // the sessions it reads off the page. Takes the image as raw bytes rather
  // than JSON so the global express.json() limit stays small for every other
  // route; nothing is persisted (ADR-0002).
  app.post(
    "/api/extract-spelling-lists",
    express.raw({ type: SUPPORTED_MEDIA_TYPES as unknown as string[], limit: "10mb" }),
    async (req, res) => {
      const mediaType = req.get("content-type")?.split(";")[0]?.trim();

      if (!mediaType || !SUPPORTED_MEDIA_TYPES.includes(mediaType as SupportedMediaType)) {
        return res.status(415).json({
          message: `Unsupported image type. Send one of: ${SUPPORTED_MEDIA_TYPES.join(", ")}.`,
        });
      }

      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ message: "No image provided." });
      }

      try {
        const candidates = await extractSpellingLists(
          req.body,
          mediaType as SupportedMediaType,
          now().toISOString().slice(0, 10),
        );
        res.json({ candidates });
      } catch (error) {
        if (error instanceof ExtractionServiceError) {
          return res.status(error.status).json({ message: error.message });
        }
        console.error("[extract] Unexpected failure", error);
        res.status(500).json({ message: "Failed to extract spelling lists." });
      }
    },
  );

  // The Lesson a session is tagged with, as the API reports it.
  const withLesson = async <T extends Session>(session: T): Promise<T & { lesson: { id: string; name: string } | null }> => {
    const lesson = session.lessonId ? await storage.getLesson(session.lessonId) : undefined;
    return { ...session, lesson: lesson ? { id: lesson.id, name: lesson.name } : null };
  };

  // How well the session's words are retained (null until one is graded), for the card ring.
  const withRetrievability = async <T extends Session>(session: T): Promise<T & { retrievability: number | null }> => {
    const words = session.words.map((w) => w.trim());
    const states = await storage.getReviewStates(session.subject, session.sessionType, words);
    return { ...session, retrievability: sessionRetrievability(session.sessionType, words, states, now()) };
  };

  // Resolves a lessonName to a lessonId: null (or blank) clears the tag, a
  // name new to the Subject creates its Lesson, otherwise the existing one is reused.
  const resolveLessonId = async (subject: Subject, lessonName: string | null) => {
    const name = lessonName?.trim();
    return name ? (await storage.findOrCreateLesson(subject, name)).id : null;
  };

  // Sessions routes
  app.get("/api/sessions", async (req, res) => {
    const subject = subjectSchema.safeParse(req.query.subject);
    if (!subject.success) {
      return res.status(400).json({ message: "A valid subject is required" });
    }
    try {
      const sessions = await storage.getSessions(subject.data);
      // testedCount: words ever graded in the session's skill (any grade
      // creates a review state), shared by every session holding that word.
      const withTested = await Promise.all(
        sessions.map(async (session) => {
          const words = session.words.map((w) => w.trim());
          const tested = await storage.getReviewStates(session.subject, session.sessionType, words);
          return {
            ...(await withLesson(session)),
            testedCount: new Set(tested.map((s) => s.word)).size,
            needsReviewCount: drillWords(session.words, tested, "due", now()).length,
            retrievability: sessionRetrievability(session.sessionType, words, tested, now()),
          };
        }),
      );
      res.json(withTested);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sessions" });
    }
  });

  // Every word in the Subject's sessions of this skill that needs review,
  // each listed once, most overdue first then never-graded (CONTEXT.md: Refresher).
  const dueWords = async (subject: Subject, skill: Skill) => {
    const words = (await storage.getSessions(subject)).filter((s) => s.sessionType === skill).flatMap((s) => s.words);
    const states = await storage.getReviewStates(subject, skill, words.map((w) => w.trim()));
    return drillWords(words, states, "due", now());
  };

  // The Practice screen: This week (the nearest due date that is today or
  // later) and the Pinned sessions. The client passes its own local date, so
  // "today" is the user's, not the server's. A session never appears twice.
  app.get("/api/practice", async (req, res) => {
    const subject = subjectSchema.safeParse(req.query.subject);
    if (!subject.success) {
      return res.status(400).json({ message: "A valid subject is required" });
    }
    const today = dueDateSchema.safeParse(req.query.today);
    if (!today.success || !today.data) {
      return res.status(400).json({ message: "today must be a YYYY-MM-DD date" });
    }
    try {
      const sessions = await storage.getSessions(subject.data);
      const time = (value: unknown) => (value ? new Date(value as string).getTime() : 0);
      // YYYY-MM-DD strings sort chronologically; ties go to the older session.
      const thisWeek =
        sessions
          .filter((s) => s.dueDate && s.dueDate >= today.data!)
          .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : a.dueDate! > b.dueDate! ? 1 : time(a.createdAt) - time(b.createdAt)))[0] ?? null;
      const pinned = sessions
        .filter((s) => s.pinnedAt && s.id !== thisWeek?.id)
        .sort((a, b) => time(b.pinnedAt) - time(a.pinnedAt));
      res.json({
        refreshers: Object.fromEntries(
          await Promise.all(SKILLS.map(async (skill) => [skill, (await dueWords(subject.data, skill)).length] as const)),
        ),
        thisWeek: thisWeek ? await withRetrievability(await withLesson(thisWeek)) : null,
        pinned: await Promise.all(pinned.map(async (s) => withRetrievability(await withLesson(s)))),
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch practice" });
    }
  });

  // A Refresher: the words needing review in one skill across the Subject,
  // capped at the Refresher size. count is the total before the cap.
  app.get("/api/refresher", async (req, res) => {
    const subject = subjectSchema.safeParse(req.query.subject);
    const skill = skillSchema.safeParse(req.query.skill);
    if (!subject.success || !skill.success) {
      return res.status(400).json({ message: "subject and skill are required" });
    }
    try {
      const due = await dueWords(subject.data, skill.data);
      const size = (await storage.getSettings())?.refresherSize ?? DEFAULT_REFRESHER_SIZE;
      res.json({ words: due.slice(0, size), count: due.length });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch refresher" });
    }
  });

  app.get("/api/lessons", async (req, res) => {
    const subject = subjectSchema.safeParse(req.query.subject);
    if (!subject.success) {
      return res.status(400).json({ message: "A valid subject is required" });
    }
    try {
      res.json(await storage.getLessons(subject.data));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch lessons" });
    }
  });

  app.get("/api/sessions/:id", async (req, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      res.json(await withLesson(session));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch session" });
    }
  });

  // The words to drill: those needing review in the session's skill, most
  // overdue first then never-graded; scope=all appends the rest in list order.
  // scope=learn gives Learn's new and missed words instead. scope=test is the
  // test a session opens with: all while the session has never been tested,
  // then due.
  app.get("/api/sessions/:id/drill", async (req, res) => {
    const scope = req.query.scope ?? "due";
    if (scope !== "due" && scope !== "all" && scope !== "learn" && scope !== "test") {
      return res.status(400).json({ message: "scope must be due, all, learn or test" });
    }
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      const words = session.words.map((w) => w.trim());
      const states = await storage.getReviewStates(session.subject, session.sessionType, words);
      if (scope === "learn") {
        const latest = await storage.getLatestGrades(session.subject, session.sessionType, words);
        return res.json({ words: learnWords(session.words, states, latest) });
      }
      const drillScope = scope === "test" ? ((await storage.hasSessionGrades(session.id)) ? "due" : "all") : scope;
      res.json({ words: drillWords(session.words, states, drillScope, now()), scope: drillScope });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch drill" });
    }
  });

  app.post("/api/sessions", async (req, res) => {
    try {
      const sessionData = insertSessionSchema.parse(req.body);
      const lessonName = lessonNameSchema.nullish().parse(req.body.lessonName) ?? null;
      const meanings = meaningEntriesSchema.optional().parse(req.body.meanings) ?? [];
      const lessonId = await resolveLessonId(sessionData.subject, lessonName);
      const session = await storage.createSession({ ...sessionData, lessonId });
      await saveMeanings(storage, session.subject, session.words, meanings);
      res.json(await withLesson(session));
    } catch (error) {
      res.status(400).json({ message: "Invalid session data" });
    }
  });

  app.put("/api/sessions/:id", async (req, res) => {
    try {
      // Normalize pinnedAt if provided (ensure Date or null for DB driver)
      const { lessonName, meanings: rawMeanings, ...updates } = req.body as any;
      if (lessonName !== undefined && !lessonNameSchema.safeParse(lessonName).success) {
        return res.status(400).json({ message: "lessonName must be a string or null" });
      }
      const meanings = meaningEntriesSchema.optional().safeParse(rawMeanings);
      if (!meanings.success) {
        return res.status(400).json({ message: "meanings must be a list of {word, meaning, edited}" });
      }
      if (updates.dueDate !== undefined && !dueDateSchema.safeParse(updates.dueDate).success) {
        return res.status(400).json({ message: "dueDate must be a YYYY-MM-DD date or null" });
      }
      // A client can't set the foreign key directly; the tag goes by name.
      delete updates.lessonId;
      delete updates.lesson;

      // A session's Subject (ADR-0005) and Session Type (ADR-0008) are fixed
      // at creation. Repeating the current value is harmless.
      for (const [field, label] of [["subject", "subject"], ["sessionType", "session type"]] as const) {
        if (!Object.prototype.hasOwnProperty.call(updates, field)) continue;
        const existing = await storage.getSession(req.params.id);
        if (!existing) {
          return res.status(404).json({ message: "Session not found" });
        }
        if (updates[field] !== existing[field]) {
          return res.status(400).json({ message: `A session's ${label} cannot be changed` });
        }
        delete updates[field];
      }

      if (Object.prototype.hasOwnProperty.call(updates, "pinnedAt")) {
        updates.pinnedAt = updates.pinnedAt ? new Date(updates.pinnedAt) : null;
      }

      if (lessonName !== undefined) {
        const existing = await storage.getSession(req.params.id);
        if (!existing) {
          return res.status(404).json({ message: "Session not found" });
        }
        updates.lessonId = await resolveLessonId(existing.subject, lessonName);
      }

      const session = await storage.updateSession(req.params.id, updates);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      await saveMeanings(storage, session.subject, session.words, meanings.data ?? []);
      res.json(await withLesson(session));
    } catch (error) {
      console.error("Failed to update session", error);
      res.status(500).json({ message: "Failed to update session" });
    }
  });

  app.delete("/api/sessions/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteSession(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Session not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete session" });
    }
  });

  // Grades: each is appended to the grade log and moves its word's review
  // state through FSRS (ADR-0010). Safe to replay; the client's outbox relies on that.
  app.post("/api/grades", async (req, res) => {
    const parsed = gradeBatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid grades" });
    }
    try {
      const states = await applyGrades(storage, parsed.data.grades, now());
      res.json({ states });
    } catch (error) {
      console.error("Failed to save grades", error);
      res.status(500).json({ message: "Failed to save grades" });
    }
  });

  // Review state for the given words (comma-separated). A never-graded word
  // comes back with state null and needsReview true.
  app.get("/api/review-states", async (req, res) => {
    const subject = subjectSchema.safeParse(req.query.subject);
    const skill = skillSchema.safeParse(req.query.skill);
    if (!subject.success || !skill.success || typeof req.query.words !== "string") {
      return res.status(400).json({ message: "subject, skill and words are required" });
    }
    try {
      const words = Array.from(new Set(req.query.words.split(",").map((w) => w.trim()).filter(Boolean)));
      const found = new Map(
        (await storage.getReviewStates(subject.data, skill.data, words)).map((s) => [s.word, s]),
      );
      const at = now();
      res.json(
        words.map((word) => {
          const state = found.get(word);
          return { word, skill: skill.data, state: state ?? null, needsReview: needsReview(state ?? null, at) };
        }),
      );
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch review states" });
    }
  });

  // Meanings (ADR-0011). GET returns {word: meaning} for the given words that
  // have one. Words come as repeated ?word= params, not comma-separated: a
  // sentence can contain a comma.
  app.get("/api/meanings", async (req, res) => {
    const subject = subjectSchema.safeParse(req.query.subject);
    const raw = req.query.word;
    const words = typeof raw === "string" ? [raw] : Array.isArray(raw) ? raw.filter((w): w is string => typeof w === "string") : null;
    if (!subject.success || !words) {
      return res.status(400).json({ message: "subject and word are required" });
    }
    try {
      const rows = await storage.getWords(subject.data, normalizeWords(words));
      res.json(Object.fromEntries(rows.filter((r) => r.meaning).map((r) => [r.word, r.meaning])));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch meanings" });
    }
  });

  // The Meanings for a list under review, before it is saved: stored ones
  // plus one AI call for the rest. Nothing is stored until the list is saved.
  app.post("/api/meanings/preview", async (req, res) => {
    const subject = subjectSchema.safeParse(req.body?.subject);
    const words = z.array(z.string()).safeParse(req.body?.words);
    const missing = z.array(z.string()).optional().safeParse(req.body?.missing);
    const lessonName = lessonNameSchema.nullish().safeParse(req.body?.lessonName);
    if (!subject.success || !words.success || !missing.success || !lessonName.success) {
      return res.status(400).json({ message: "subject and words are required" });
    }
    try {
      // The topic of an existing Lesson, if the list is tagged with one; never creates it.
      const name = lessonName.data?.trim();
      const topic = name ? ((await storage.getLessons(subject.data)).find((l) => l.name === name)?.topic ?? null) : null;
      res.json(await previewMeanings(storage, generateMeanings, subject.data, words.data, topic, missing.data));
    } catch (error) {
      console.error("[meanings] Preview failed", error);
      res.status(502).json({ message: "Couldn't get meanings. Try again later." });
    }
  });

  // Settings routes
  app.get("/api/settings", async (_req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings && withActiveSubject(settings));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.put("/api/settings", async (req, res) => {
    try {
      const settingsData = insertSettingsSchema.partial().parse(req.body);
      const settings = await storage.updateSettings(settingsData);
      res.json(withActiveSubject(settings));
    } catch (error) {
      res.status(400).json({ message: "Invalid settings data" });
    }
  });

  // Verify PIN endpoint
  app.post("/api/verify-pin", async (req, res) => {
    try {
      const { pin } = req.body;
      if (!pin || typeof pin !== "string") {
        return res.status(400).json({ success: false, message: "PIN required" });
      }
      const settings = await storage.getSettings();
      if (settings && settings.pin === pin) {
        return res.json({ success: true });
      }
      res.status(401).json({ success: false, message: "Invalid PIN" });
    } catch (error) {
      // Log the error server-side to aid debugging (do not expose details to clients)
      console.error('[PIN VERIFY] error while verifying PIN:', error);
      res.status(500).json({ success: false, message: "PIN verification failed" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
