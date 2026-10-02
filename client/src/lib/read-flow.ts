import type { Grade } from "@shared/schema";
import { matchesTarget } from "./read-aloud-matcher";

// Read Mode's word flow (ADR-0009): per-word state plus the session queue,
// with no framework in it. The page renders this and dispatches to it.

/** Where the current showing stands. */
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

/** What the speech recogniser adapter reports for one attempt. */
export type RecogniserEvent =
  | { kind: "heard"; alternatives: string[] }
  | { kind: "silence" }
  /** Listening didn't start in time; the attempt was cancelled. */
  | { kind: "hang" }
  | { kind: "error"; error: string };

/** Errors that mean recognition can't run here at all (ADR-0009). */
const UNAVAILABLE_ERRORS = ["unsupported", "not-allowed", "service-not-allowed", "network", "language-not-supported"];

export function isUnavailableError(error: string): boolean {
  return UNAVAILABLE_ERRORS.includes(error);
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
  /** Misses left on the current showing. */
  triesLeft: number;
  /** Start hangs in a row. */
  hangs: number;
  /** Read Aloud can't run (or was declined): the rest of the session self-reports. */
  readAloudOff: boolean;
  /** A short line about the last attempt, e.g. when nothing was heard. */
  note: string | null;
}

const ALL_GRADES: Grade[] = ["again", "hard", "good", "easy"];
const RIGHT_ANSWERS_TO_STOP_RETURNING = 2;
const CARDS_BEFORE_RETURN = 3;
const TRIES = 3;
const HANGS_BEFORE_UNAVAILABLE = 2;
const SILENCE_NOTE = "Didn't hear anything. Tap to try again.";

function stateOfNewShowing(readAloudOff: boolean): WordState {
  return readAloudOff ? { kind: "unavailable" } : { kind: "idle" };
}

/** `readAloud: false` starts the session in self-report, e.g. where the browser has no recogniser. */
export function startReadFlow(words: string[], options: { readAloud?: boolean } = {}): ReadFlow {
  const readAloudOff = options.readAloud === false;
  return {
    queue: words.map((word) => ({ word, tryOnceMore: false })),
    wordState: stateOfNewShowing(readAloudOff),
    rightCount: {},
    done: 0,
    total: words.length,
    triesLeft: TRIES,
    hangs: 0,
    readAloudOff,
    note: null,
  };
}

export function currentShowing(flow: ReadFlow): Showing {
  return flow.queue[0];
}

/** Oops is always open; the positive grades need Read Aloud passed or unavailable. */
export function enabledGrades(state: WordState): Grade[] {
  return state.kind === "passed" || state.kind === "unavailable" ? ALL_GRADES : ["again"];
}

export function isGradeEnabled(flow: ReadFlow, grade: Grade): boolean {
  return enabledGrades(flow.wordState).includes(grade);
}

export function isPeeked(flow: ReadFlow): boolean {
  return flow.wordState.kind === "peeked";
}

export function isFinished(flow: ReadFlow): boolean {
  return flow.queue.length === 0;
}

/** Position and size for "3/7 words" and the progress bar; repeats count. */
export function progress(flow: ReadFlow): { position: number; total: number; percent: number } {
  const { done, total } = flow;
  return {
    position: Math.min(done + 1, total),
    total,
    percent: total > 0 ? Math.floor((done / total) * 100) : 0,
  };
}

/** Where an attempt that didn't count leaves the word: idle until a try has been used. */
function resting(triesLeft: number): WordState {
  return triesLeft >= TRIES ? { kind: "idle" } : { kind: "missed", triesLeft };
}

function selfReport(flow: ReadFlow): ReadFlow {
  return { ...flow, readAloudOff: true, wordState: { kind: "unavailable" }, note: null };
}

/** An attempt is under way: the recogniser may be on. */
export function isAttemptRunning(flow: ReadFlow): boolean {
  return flow.wordState.kind === "listening" || flow.wordState.kind === "checking";
}

/** The mic can be tapped to start an attempt. */
export function canListen(flow: ReadFlow): boolean {
  return flow.queue.length > 0 && (flow.wordState.kind === "idle" || flow.wordState.kind === "missed");
}

/** The mic button, caption and Peek link are on show: Read Aloud is running and the answer isn't out. */
export function showsReadAloud(flow: ReadFlow): boolean {
  return flow.wordState.kind !== "unavailable" && flow.wordState.kind !== "peeked";
}

/** The mic can be tapped to start an attempt (from idle, or after a miss). */
export function startListening(flow: ReadFlow): ReadFlow {
  if (!canListen(flow)) return flow;
  return { ...flow, wordState: { kind: "listening" }, note: null };
}

/** The child tapped "done": the recogniser is wrapping up and the app is checking. */
export function stopListening(flow: ReadFlow): ReadFlow {
  if (flow.wordState.kind !== "listening") return flow;
  return { ...flow, wordState: { kind: "checking" } };
}

/**
 * Takes what the recogniser reported. Silence, a start hang and recoverable
 * errors don't use a try; the third miss reveals the pinyin and leaves only Oops.
 */
export function receive(flow: ReadFlow, event: RecogniserEvent): ReadFlow {
  if (flow.queue.length === 0 || !isAttemptRunning(flow)) return flow;
  if (event.kind === "heard") {
    if (matchesTarget(currentShowing(flow).word, event.alternatives)) {
      return { ...flow, wordState: { kind: "passed" }, hangs: 0, note: null };
    }
    const triesLeft = flow.triesLeft - 1;
    return triesLeft <= 0
      ? { ...flow, triesLeft: 0, wordState: { kind: "failed" }, hangs: 0, note: null }
      : { ...flow, triesLeft, wordState: { kind: "missed", triesLeft }, hangs: 0, note: null };
  }
  if (event.kind === "error" && isUnavailableError(event.error)) return selfReport(flow);
  if (event.kind === "hang") {
    const hangs = flow.hangs + 1;
    if (hangs >= HANGS_BEFORE_UNAVAILABLE) return selfReport({ ...flow, hangs });
    // A hang is cancelled quietly: back to where the word was, no note, no try used.
    return { ...flow, hangs, wordState: resting(flow.triesLeft), note: null };
  }
  return { ...flow, hangs: 0, wordState: resting(flow.triesLeft), note: SILENCE_NOTE };
}

/** "Not now" on the first-use notice: self-report for the rest of this session. */
export function declineReadAloud(flow: ReadFlow): ReadFlow {
  return selfReport(flow);
}

/** The Pinyin Annotation shows after the third miss, as it does under Peek. */
export function isPinyinRevealed(flow: ReadFlow): boolean {
  return flow.wordState.kind === "failed";
}

/** The line under the mic button. */
export function captionFor(flow: ReadFlow): string {
  const state = flow.wordState;
  switch (state.kind) {
    case "listening":
      return "Listening… tap when done";
    case "checking":
      return "Checking…";
    case "passed":
      return "Read correctly";
    case "missed":
      return `Not quite. ${state.triesLeft} ${state.triesLeft === 1 ? "try" : "tries"} left.`;
    case "failed":
      return "Three tries used. Here's how it's read.";
    case "unavailable":
      return "Read Aloud isn't available here, so grade it yourself.";
    case "peeked":
      return "Answer shown, so only Oops is left.";
    default:
      return flow.note ?? "Tap and read it aloud";
  }
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
  const returns = grade === "again" || rights < RIGHT_ANSWERS_TO_STOP_RETURNING;
  const queue = [...rest];
  if (returns) {
    queue.splice(Math.min(CARDS_BEFORE_RETURN, queue.length), 0, { word: current.word, tryOnceMore: true });
  }
  return {
    flow: {
      ...flow,
      queue,
      wordState: stateOfNewShowing(flow.readAloudOff),
      triesLeft: TRIES,
      note: null,
      rightCount: { ...flow.rightCount, [current.word]: rights },
      done: flow.done + 1,
      total: flow.total + (returns ? 1 : 0),
    },
    emitted: { word: current.word, grade },
  };
}
