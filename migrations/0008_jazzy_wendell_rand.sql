CREATE TABLE "words" (
	"subject" text NOT NULL,
	"word" text NOT NULL,
	"meaning" text,
	"edited" boolean DEFAULT false NOT NULL,
	CONSTRAINT "words_subject_word_pk" PRIMARY KEY("subject","word")
);
