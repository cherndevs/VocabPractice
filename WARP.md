# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Project overview
- TypeScript full-stack app with a React (Vite) client and an Express server.
- Shared database schema and request validation live in shared/schema.ts (Drizzle ORM + Zod) and are used by both server and migrations.
- In development, the Express server runs Vite in middleware mode for client HMR; in production, static assets are served from dist/public.

Common commands
- Install dependencies
  - npm ci
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
  - Routes (server/routes.ts): REST endpoints under /api
    - Sessions: GET /api/sessions, GET /api/sessions/:id, POST /api/sessions, PUT /api/sessions/:id, DELETE /api/sessions/:id
    - Settings: GET /api/settings, PUT /api/settings
  - Storage (server/storage.ts): IStorage interface with MemStorage (dev) and PgStorage (prod)
    - PgStorage uses drizzle-orm/postgres-js; schema and zod types from shared/schema.ts
- Shared (shared/)
  - Database schema (users, sessions, settings) with Drizzle; Zod insert schemas for request validation
  - Used by server and drizzle-kit migrations

Build and tooling
- Vite config (vite.config.ts)
  - root: client/, build outDir: dist/public
  - Path aliases: "@" -> client/src, "@shared" -> shared, "@assets" -> attached_assets
- TypeScript paths (tsconfig.json)
  - "@/*" -> ./client/src/*, "@shared/*" -> ./shared/*
- Tailwind/PostCSS configured via tailwind.config.ts and postcss.config.js

Testing and linting
- No test runner or linting configuration is present in this repo at the moment.
