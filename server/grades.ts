import type { GradeInput, ReviewState } from "@shared/schema";
import type { IStorage } from "./storage";
import { needsReview, scheduleGrade } from "./scheduling";

export type GradedState = ReviewState & { needsReview: boolean };

export function withNeedsReview(state: ReviewState, now: Date): GradedState {
  return { ...state, needsReview: needsReview(state, now) };
}

/**
 * Logs each grade and moves its word's review state, oldest first. A grade
 * whose id is already logged is a replay and changes nothing. A grade older
 * than the state's last review is logged but leaves the state alone, so a
 * late-arriving outbox batch can't rewind the schedule. Returns the current
 * state of every (word, skill) the batch touched.
 */
export async function applyGrades(storage: IStorage, grades: GradeInput[], now: Date): Promise<GradedState[]> {
  const ordered = [...grades].sort(
    (a, b) => a.gradedAt.getTime() - b.gradedAt.getTime() || a.id.localeCompare(b.id),
  );
  const touched = new Map<string, ReviewState>();

  for (const grade of ordered) {
    const { subject, word, skill } = grade;
    const key = JSON.stringify([subject, word, skill]);
    let current = touched.get(key) ?? (await storage.getReviewState(subject, word, skill));

    if (await storage.logGrade(grade)) {
      // A phone clock running ahead mustn't push a word's last review into the future.
      const at = grade.gradedAt.getTime() > now.getTime() ? now : grade.gradedAt;
      if (!current || !current.lastReview || at.getTime() > current.lastReview.getTime()) {
        current = { subject, word, skill, ...scheduleGrade(skill, current ?? null, grade.grade, at) };
        await storage.saveReviewState(current);
      }
    }
    if (current) touched.set(key, current);
  }

  return Array.from(touched.values(), (state) => withNeedsReview(state, now));
}
