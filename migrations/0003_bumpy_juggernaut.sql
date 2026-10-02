-- CHE-41: every Session has a Session Type (ADR-0008). Legacy sessions were all
-- spelling lists, so add nullable, backfill 'spelling', then enforce NOT NULL.
ALTER TABLE "sessions" ADD COLUMN "session_type" text;--> statement-breakpoint
UPDATE "sessions" SET "session_type" = 'spelling';--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "session_type" SET NOT NULL;
