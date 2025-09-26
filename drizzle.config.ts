import { defineConfig } from "drizzle-kit";

// For local development, use local SQLite file
// For production, use Turso cloud database
const databaseUrl = process.env.DATABASE_URL || "file:local.db";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: databaseUrl,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});
