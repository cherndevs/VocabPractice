CREATE TABLE "sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"words" jsonb NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"word_count" integer NOT NULL,
	"progress" integer DEFAULT 0,
	"time_spent" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"word_repetitions" integer DEFAULT 2,
	"pause_between_words" integer DEFAULT 1500,
	"notifications" boolean DEFAULT true,
	"dark_mode" boolean DEFAULT false,
	"data_sync" boolean DEFAULT false,
	"enable_pause_button" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
