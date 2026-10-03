import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card,
  type FSRS,
  type Grade as FsrsRating,
} from "ts-fsrs";
import type { Grade, ReviewState, Skill } from "@shared/schema";

// Server-only wrapper around ts-fsrs (ADR-0010). FSRS-6 default weights and a
// 0.95 retention target for both skills. Fuzz is off so a schedule is a pure
// function of the grade history.
const REQUEST_RETENTION = 0.95;

const schedulers: Record<Skill, FSRS> = {
  // Spelling grades arrive in the marking pass after dictation, so there is no
  // same-session repeat: no (re)learning steps, intervals in whole days.
  spelling: fsrs(
    generatorParameters({
      request_retention: REQUEST_RETENTION,
      enable_fuzz: false,
      enable_short_term: false,
      learning_steps: [],
      relearning_steps: [],
    }),
  ),
  // Reading keeps the library's default same-session steps (1m, 10m). Used by
  // the Read Mode grading ticket; configured here so there is one place.
  reading: fsrs(
    generatorParameters({
      request_retention: REQUEST_RETENTION,
      enable_fuzz: false,
    }),
  ),
};

const RATINGS: Record<Grade, FsrsRating> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

export type ReviewCard = Omit<ReviewState, "subject" | "word" | "skill">;

function toCard(state: ReviewCard): Card {
  return {
    due: state.due,
    stability: state.stability,
    difficulty: state.difficulty,
    elapsed_days: state.elapsedDays,
    scheduled_days: state.scheduledDays,
    learning_steps: state.learningSteps,
    reps: state.reps,
    lapses: state.lapses,
    state: state.state as State,
    last_review: state.lastReview ?? undefined,
  };
}

function fromCard(card: Card): ReviewCard {
  return {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReview: card.last_review ?? null,
  };
}

/** The review state after `grade` is given at `gradedAt`; `previous` is null for a word's first grade. */
export function scheduleGrade(
  skill: Skill,
  previous: ReviewCard | null,
  grade: Grade,
  gradedAt: Date,
): ReviewCard {
  const card = previous ? toCard(previous) : createEmptyCard(gradedAt);
  return fromCard(schedulers[skill].next(card, gradedAt, RATINGS[grade]).card);
}

/** A word with no state has never been graded in this skill, so it needs review. */
export function needsReview(state: Pick<ReviewCard, "due"> | null, now: Date): boolean {
  return !state || state.due.getTime() <= now.getTime();
}

/** Chance (0–1) the learner still recalls a word, from its FSRS state at `now`. */
export function retrievability(skill: Skill, state: ReviewCard, now: Date): number {
  return schedulers[skill].get_retrievability(toCard(state), now, false);
}

/**
 * How well a session's words are retained: the mean retrievability over its
 * distinct words, counting a never-graded word as 0. null when none has been
 * graded yet (the "new" ring), so a fresh session isn't shown as forgotten.
 */
export function sessionRetrievability(
  skill: Skill,
  words: string[],
  states: (ReviewCard & { word: string })[],
  now: Date,
): number | null {
  const byWord = new Map(states.map((s) => [s.word, s]));
  const distinct = Array.from(new Set(words.map((w) => w.trim())));
  const tested = distinct.filter((w) => byWord.has(w));
  if (tested.length === 0) return null;
  const sum = tested.reduce((acc, w) => acc + retrievability(skill, byWord.get(w)!, now), 0);
  return sum / distinct.length;
}
