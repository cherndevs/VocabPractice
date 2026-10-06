import type { Grade, ReviewState } from "@shared/schema";
import { needsReview } from "./scheduling";

/**
 * A session's words in drill order: those needing review first (most overdue
 * first, then never-graded words in list order), then, for scope "all", the
 * rest in list order. Words are trimmed and listed once.
 */
export function drillWords(
  sessionWords: string[],
  states: Pick<ReviewState, "word" | "due">[],
  scope: "due" | "all",
  now: Date,
): string[] {
  const byWord = new Map(states.map((s) => [s.word, s]));
  const words = Array.from(new Set(sessionWords.map((w) => w.trim()).filter(Boolean)));
  const due = words.filter((w) => needsReview(byWord.get(w) ?? null, now));
  const overdue = due
    .filter((w) => byWord.has(w))
    .sort((a, b) => byWord.get(a)!.due.getTime() - byWord.get(b)!.due.getTime());
  const fresh = due.filter((w) => !byWord.has(w));
  const ordered = [...overdue, ...fresh];
  return scope === "all" ? [...ordered, ...words.filter((w) => !ordered.includes(w))] : ordered;
}

/**
 * The words Learn offers by default, in list order: new (no review state in
 * the skill) and missed (latest grade Oops). Words are trimmed and listed once.
 */
export function learnWords(
  sessionWords: string[],
  states: Pick<ReviewState, "word">[],
  latestGrades: Map<string, Grade>,
): string[] {
  const graded = new Set(states.map((s) => s.word));
  return Array.from(new Set(sessionWords.map((w) => w.trim()).filter(Boolean))).filter(
    (w) => !graded.has(w) || latestGrades.get(w) === "again",
  );
}
