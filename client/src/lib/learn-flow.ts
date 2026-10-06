// Learn's word flow ("look, cover, write, check"), with no framework in it.
// The page renders this and dispatches to it. Nothing here is recorded.

export type LearnStep = "glance" | "cover" | "check";

export interface LearnFlow {
  /** Words still to go; the first is the current one. */
  queue: string[];
  step: LearnStep;
  /** "Got it"s per word so far. */
  gotCount: Record<string, number>;
  done: number;
  total: number;
}

/** "Got it"s a word needs to be learned. */
const GOT_ITS_TO_LEARN = 2;
/** How many other words come before a word shows again. */
const RETURN_GAP = 3;

export function startLearnFlow(words: string[]): LearnFlow {
  const queue = Array.from(new Set(words));
  return { queue, step: "glance", gotCount: {}, done: 0, total: queue.length };
}

export function currentWord(flow: LearnFlow): string | null {
  return flow.queue[0] ?? null;
}

export function progress(flow: LearnFlow): { done: number; total: number } {
  return { done: flow.done, total: flow.total };
}

export function isFinished(flow: LearnFlow): boolean {
  return flow.queue.length === 0;
}

/** Glance → Cover → Check. */
export function next(flow: LearnFlow): LearnFlow {
  if (flow.step === "glance") return { ...flow, step: "cover" };
  if (flow.step === "cover") return { ...flow, step: "check" };
  return flow;
}

export function gotIt(flow: LearnFlow): LearnFlow {
  const word = currentWord(flow);
  if (word === null || flow.step !== "check") return flow;
  const count = (flow.gotCount[word] ?? 0) + 1;
  const gotCount = { ...flow.gotCount, [word]: count };
  if (count >= GOT_ITS_TO_LEARN) {
    return { ...flow, queue: flow.queue.slice(1), step: "glance", gotCount, done: flow.done + 1 };
  }
  return { ...comeBackLater(flow, word), gotCount };
}

export function notYet(flow: LearnFlow): LearnFlow {
  const word = currentWord(flow);
  if (word === null || flow.step !== "check") return flow;
  return comeBackLater(flow, word);
}

function comeBackLater(flow: LearnFlow, word: string): LearnFlow {
  const rest = flow.queue.slice(1);
  const at = Math.min(RETURN_GAP, rest.length);
  return { ...flow, queue: [...rest.slice(0, at), word, ...rest.slice(at)], step: "glance" };
}
