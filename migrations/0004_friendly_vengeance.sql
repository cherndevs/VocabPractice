CREATE TABLE "grade_log" (
	"id" varchar PRIMARY KEY NOT NULL,
	"subject" text NOT NULL,
	"word" text NOT NULL,
	"skill" text NOT NULL,
	"grade" text NOT NULL,
	"graded_at" timestamp NOT NULL,
	"session_id" text
);
--> statement-breakpoint
CREATE TABLE "review_states" (
	"subject" text NOT NULL,
	"word" text NOT NULL,
	"skill" text NOT NULL,
	"due" timestamp NOT NULL,
	"stability" double precision NOT NULL,
	"difficulty" double precision NOT NULL,
	"elapsed_days" integer NOT NULL,
	"scheduled_days" integer NOT NULL,
	"learning_steps" integer NOT NULL,
	"reps" integer NOT NULL,
	"lapses" integer NOT NULL,
	"state" integer NOT NULL,
	"last_review" timestamp,
	CONSTRAINT "review_states_subject_word_skill_pk" PRIMARY KEY("subject","word","skill")
);
