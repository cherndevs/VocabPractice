CREATE TABLE "lessons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject" text NOT NULL,
	"name" text NOT NULL,
	"topic" text
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "lesson_id" varchar;--> statement-breakpoint
CREATE UNIQUE INDEX "lessons_subject_name_unique" ON "lessons" USING btree ("subject","name");--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE no action ON UPDATE no action;