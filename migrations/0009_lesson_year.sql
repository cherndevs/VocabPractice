DROP INDEX "lessons_subject_name_unique";--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "year" text;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_subject_year_name_unique" UNIQUE NULLS NOT DISTINCT("subject","year","name");