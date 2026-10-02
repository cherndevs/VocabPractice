-- CHE-29: every Session belongs to exactly one Subject (ADR-0005, ADR-0006).
-- Add nullable, backfill by dominant word language, then enforce NOT NULL.
ALTER TABLE "sessions" ADD COLUMN "subject" text;--> statement-breakpoint
-- A word counts as Chinese if it contains a CJK character (the same rule the
-- client applies per word). The session is Chinese only when strictly more of
-- its words are Chinese than not; ties and empty lists fall back to English.
UPDATE "sessions" SET "subject" = CASE
  WHEN (
    SELECT count(*) FROM jsonb_array_elements_text("words") AS w WHERE w ~ '[一-鿿]'
  ) > (
    SELECT count(*) FROM jsonb_array_elements_text("words") AS w WHERE w !~ '[一-鿿]'
  ) THEN 'chinese'
  ELSE 'english'
END;--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "subject" SET NOT NULL;--> statement-breakpoint
-- Already applied to production by the unjournaled 0002_add_pin_column.sql;
-- drizzle's snapshot just didn't know about it, so it re-emits the column here.
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "pin" varchar DEFAULT '111111';--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "active_subject" text;
