# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Project overview
- TypeScript full-stack app with a React (Vite) client and an Express server.
- Shared database schema and request validation live in shared/schema.ts (Drizzle ORM + Zod) and are used by both server and migrations.
- In development, the Express server runs Vite in middleware mode for client HMR; in production, static assets are served from dist/public.

Common commands
- Install dependencies
  - npm install (`npm ci` fails until the lockfile is fixed: CHE-51)
- Run in development (Express + Vite middleware)
  - npm run dev
- Type-check
  - npm run check
- Build (client to dist/public, server bundled to dist)
  - npm run build
- Start in production (serves API and built client)
  - npm start

Database (Drizzle + Postgres)
- Required environment variable for DB operations
  - export DATABASE_URL={{DATABASE_URL}}
- Generate migrations from shared/schema.ts
  - npm run db:generate
- Apply migrations to DATABASE_URL
  - npm run db:migrate
- Inspect data
  - npm run db:studio
- Push schema (optional alternative flow)
  - npm run db:push

Environment and runtime
- Server picks storage based on env:
  - Development (default): in-memory storage (no external DB required)
  - Production (NODE_ENV=production and DATABASE_URL present): Postgres via Drizzle
- Port/host
  - PORT defaults to 5000; in production host binds to 0.0.0.0
- Required env for deployment (from README.md)
  - DATABASE_URL (pooled connection, e.g., Neon)
  - NODE_ENV=production on deploy
  - PORT optional (default 5000)

Code architecture (high-level)
- Client (client/)
  - React 18 + Vite + TypeScript; routing with wouter; server state via TanStack Query
  - Tailwind CSS with shadcn/ui-style components under client/src/components/ui
  - PWA assets under client/public (manifest.json, sw.js)
  - Entry: client/index.html -> client/src/main.tsx -> client/src/App.tsx
- Server (server/)
  - Entrypoint server/index.ts initializes Express, JSON middleware, API logging, error handler, and HTTP server
  - Development: setupVite (server/vite.ts) attaches Vite middlewares; serves transformed index.html with cache-busted main.tsx
  - Production: serveStatic (server/vite.ts) serves dist/public with an SPA fallback to index.html
  - Routes (server/routes.ts): `registerRoutes(app, storage)` takes the storage instance, so tests mount the real routes over `MemStorage` (see server/test-harness.ts)
    - Sessions: GET /api/sessions?subject= (subject required), GET /api/sessions/:id, POST /api/sessions (subject and sessionType required), PUT /api/sessions/:id (subject and sessionType immutable), DELETE /api/sessions/:id
    - Grades: POST /api/grades `{grades:[…]}` logs each grade (client id = primary key, replays are no-ops) and moves the word's review state through FSRS (server/scheduling.ts wraps `ts-fsrs`; server/grades.ts applies a batch oldest-first). GET /api/review-states?subject=&skill=&words= reports state and `needsReview`. GET /api/sessions adds `testedCount`. `registerRoutes` takes an injectable clock (`{now}`); the test harness has `setNow`.
    - Lessons: POST/PUT /api/sessions accept `lessonName` (string tags, creating the Lesson if new to the Subject; null clears); sessions come back with `lesson: {id, name} | null`. GET /api/lessons?subject= lists a Subject's Lessons by name. No management screen.
    - Due date: POST/PUT /api/sessions accept `dueDate` (`YYYY-MM-DD` string or null; else 400); a date-only `date` column returned as the same string. It never affects review scheduling.
    - Settings: GET /api/settings, PUT /api/settings (`activeSubject` reads as "english" until chosen)
  - Storage (server/storage.ts): IStorage interface with MemStorage (dev) and PgStorage (prod)
    - PgStorage uses drizzle-orm/postgres-js; schema and zod types from shared/schema.ts
- Client Read Mode flow (client/src/lib/read-flow.ts): pure reducer-style module owning per-word state (Read Aloud tries, Peek lock, which grades are enabled, fallback to self-report) and the Reading session queue with "Try once more" repeats; the practice page renders it and feeds it recogniser events.
- Read Aloud (ADR-0009): client/src/lib/read-aloud-matcher.ts decides pass/fail from the heard alternatives; client/src/lib/speech-recogniser.ts is the only code touching SpeechRecognition (start-hang and stop timeouts, releases the mic); client/src/lib/read-aloud-notice.ts remembers the first-use notice per device.
- Client grade outbox (client/src/lib/grade-outbox.ts, wired in grade-sync.ts): grades queue in localStorage and post in the background with backoff; the UI never waits on them.
- Shared (shared/)
  - Database schema (users, sessions, lessons, settings, review_states, grade_log) with Drizzle; Zod insert schemas for request validation
  - Used by server and drizzle-kit migrations

Build and tooling
- Vite config (vite.config.ts)
  - root: client/, build outDir: dist/public
  - Path aliases: "@" -> client/src, "@shared" -> shared, "@assets" -> attached_assets
- TypeScript paths (tsconfig.json)
  - "@/*" -> ./client/src/*, "@shared/*" -> ./shared/*
- Tailwind/PostCSS configured via tailwind.config.ts and postcss.config.js

Testing and linting
- Tests: `npm test` (vitest; files sit next to the code as `*.test.ts`). Server tests drive the HTTP API via `startTestApi()` in server/test-harness.ts. No linter is configured.
