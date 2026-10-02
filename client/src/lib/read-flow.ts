import type { Grade } from "@shared/schema";

// Read Mode's word flow (ADR-0009): per-word state plus the session queue,
// with no framework in it. The page renders this and dispatches to it.

/**
 * Where the current showing stands. Only `unavailable` (Read Aloud can't run)
 * and `peeked` are reachable until Read Aloud ships; the rest are for it.
 */
export type WordState =
  | { kind: "idle" }
  | { kind: "listening" }
  | { kind: "checking" }
  | { kind: "passed" }
  | { kind: "missed"; triesLeft: number }
  | { kind: "failed" }
  | { kind: "peeked" }
  | { kind: "unavailable" };

export interface Showing {
  word: string;
  /** A word coming back this session, labelled "Try once more". */
  tryOnceMore: boolean;
}

export interface ReadFlow {
  /** Showings still to go; the first is the current one. */
  queue: Showing[];
  wordState: WordState;
  /** Positive grades given per word this session. */
  rightCount: Record<string, number>;
  /** Showings finished, and showings in all so far (grows as words return). */
  done: number;
  total: number;
}

const ALL_GRADES: Grade[] = ["again", "hard", "good", "easy"];
const RIGHT_TWICE = 2;
const CARDS_BEFORE_RETURN = 3;
const FRESH_SHOWING: WordState = { kind: "unavailable" };

export function startReadFlow(words: string[]): ReadFlow {
  return {
    queue: words.map((word) => ({ word, tryOnceMore: false })),
    wordState: FRESH_SHOWING,
    rightCount: {},
    done: 0,
    total: words.length,
  };
}

export function currentShowing(flow: ReadFlow): Showing {
  return flow.queue[0];
}

/** Oops is always open; the positive grades need Read Aloud passed or unavailable. */
export function enabledGrades(state: WordState): Grade[] {
  return state.kind === "passed" || state.kind === "unavailable" ? ALL_GRADES : ["again"];
}

/** Opening Peek locks the positive grades for this showing. */
export function peek(flow: ReadFlow): ReadFlow {
  if (flow.queue.length === 0) return flow;
  return { ...flow, wordState: { kind: "peeked" } };
}

/**
 * Grades the current showing. `emitted` is what to save (null if the grade
 * isn't allowed right now). Oops, or a positive grade on a word not yet right
 * twice this session, sends the word back up to 3 cards later.
 */
export function gradeWord(
  flow: ReadFlow,
  grade: Grade,
): { flow: ReadFlow; emitted: { word: string; grade: Grade } | null } {
  if (flow.queue.length === 0 || !enabledGrades(flow.wordState).includes(grade)) {
    return { flow, emitted: null };
  }
  const [current, ...rest] = flow.queue;
  const rights = (flow.rightCount[current.word] ?? 0) + (grade === "again" ? 0 : 1);
  const returns = grade === "again" || rights < RIGHT_TWICE;
  const queue = [...rest];
  if (returns) {
    queue.splice(Math.min(CARDS_BEFORE_RETURN, queue.length), 0, { word: current.word, tryOnceMore: true });
  }
  return {
    flow: {
      queue,
      wordState: FRESH_SHOWING,
      rightCount: { ...flow.rightCount, [current.word]: rights },
      done: flow.done + 1,
      total: flow.total + (returns ? 1 : 0),
    },
    emitted: { word: current.word, grade },
  };
}
