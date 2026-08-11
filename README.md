## Deployment and Neon configuration

Set `DATABASE_URL` to your Neon pooled connection string (PgBouncer), which typically ends with `?sslmode=require`.

### Required env vars

- `DATABASE_URL`: Neon Postgres pooled URL
- `ANTHROPIC_API_KEY`: Anthropic API key, used by the spelling-list extraction endpoint to read worksheet photos. Server-side only — it must never be exposed to the browser (see [ADR-0002](docs/adr/0002-server-proxy-for-image-extraction-no-persistence.md)). Without it, `POST /api/extract-spelling-lists` returns 503 and the rest of the app is unaffected.
- `NODE_ENV`: `production` on deploy
- `PORT`: optional, default 5000

### Migrations

Generate migrations from `shared/schema.ts`:

```bash
npm run db:generate
```

Apply migrations to the database pointed by `DATABASE_URL`:

```bash
npm run db:migrate
```

Inspect data with Drizzle Studio:

```bash
npm run db:studio
```

### Local vs Production

The server uses in-memory storage locally. In production with `DATABASE_URL` set, it uses Postgres (Neon).

