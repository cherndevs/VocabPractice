ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "pinned_at" timestamp NULL;

-- Optional index to help ordering/filtering by pinned_at then created_at
-- CREATE INDEX IF NOT EXISTS sessions_pinned_at_created_at_idx ON "sessions" (pinned_at DESC, created_at DESC);

