import { describe, expect, it } from "vitest";
import {
  captionFor,
  currentShowing,
  declineReadAloud,
  enabledGrades,
  gradeWord,
  isPinyinRevealed,
  peek,
  receive,
  startListening,
  startReadFlow,
  stopListening,
  type ReadFlow,
} from "./read-flow";

const words = (...w: string[]) => w;
// Read Aloud switched off: the self-report fallback, where all four grades are open.
const OFF = { readAloud: false };
const order = (flow: ReadFlow) => flow.queue.map((s) => s.word);

describe("enabled grades", () => {
  it("offers all four when Read Aloud is unavailable", () => {
    const flow = startReadFlow(words("a", "b"), OFF);
    expect(flow.wordState).toEqual({ kind: "unavailable" });
    expect(enabledGrades(flow.wordState)).toEqual(["again", "hard", "good", "easy"]);
  });

  it("leaves only Oops once the word has been peeked", () => {
    const flow = peek(startReadFlow(words("a", "b"), OFF));
    expect(flow.wordState).toEqual({ kind: "peeked" });
    expect(enabledGrades(flow.wordState)).toEqual(["again"]);
  });

  it("locks positives in the states that precede a Read Aloud pass", () => {
    for (const kind of ["idle", "listening", "checking", "failed"] as const) {
      expect(enabledGrades({ kind })).toEqual(["again"]);
    }
    expect(enabledGrades({ kind: "missed", triesLeft: 2 })).toEqual(["again"]);
    expect(enabledGrades({ kind: "passed" })).toEqual(["again", "hard", "good", "easy"]);
  });
});

describe("Peek lock", () => {
  it("applies to that showing only, so a re-inserted showing starts fresh", () => {
    let flow = peek(startReadFlow(words("a", "b"), OFF));
    ({ flow } = gradeWord(flow, "again"));
    expect(currentShowing(flow).word).toBe("b");
    expect(enabledGrades(flow.wordState)).toEqual(["again", "hard", "good", "easy"]);
    ({ flow } = gradeWord(flow, "good"));
    expect(currentShowing(flow).word).toBe("a");
    expect(enabledGrades(flow.wordState)).toEqual(["again", "hard", "good", "easy"]);
  });

  it("refuses a positive grade on a peeked word", () => {
    const flow = peek(startReadFlow(words("a"), OFF));
    const result = gradeWord(flow, "easy");
    expect(result.emitted).toBeNull();
    expect(result.flow).toBe(flow);
  });
});

describe("same-session repeats", () => {
  it("re-inserts an Oops word after the next 3 cards", () => {
    const { flow, emitted } = gradeWord(startReadFlow(words("a", "b", "c", "d", "e"), OFF), "again");
    expect(emitted).toEqual({ word: "a", grade: "again" });
    expect(order(flow)).toEqual(["b", "c", "d", "a", "e"]);
    expect(flow.queue[3].tryOnceMore).toBe(true);
  });

  it("re-inserts at the end when fewer than 3 cards remain", () => {
    const { flow } = gradeWord(startReadFlow(words("a", "b", "c"), OFF), "again");
    expect(order(flow)).toEqual(["b", "c", "a"]);
    const solo = gradeWord(startReadFlow(words("a"), OFF), "again").flow;
    expect(order(solo)).toEqual(["a"]);
  });

  it("labels only returning showings Try once more", () => {
    const flow = startReadFlow(words("a", "b"), OFF);
    expect(currentShowing(flow).tryOnceMore).toBe(false);
    const next = gradeWord(gradeWord(flow, "again").flow, "good").flow;
    expect(currentShowing(next)).toEqual({ word: "a", tryOnceMore: true });
  });

  it("needs two right answers before a new word stops returning", () => {
    let flow = startReadFlow(words("a"), OFF);
    for (const grade of ["hard", "good"] as const) {
      ({ flow } = gradeWord(flow, grade));
      if (grade === "hard") expect(order(flow)).toEqual(["a"]);
    }
    expect(flow.queue).toEqual([]);
  });

  it("doesn't count an Oops towards the two right answers", () => {
    let flow = startReadFlow(words("a"), OFF);
    for (const grade of ["again", "easy"] as const) ({ flow } = gradeWord(flow, grade));
    expect(order(flow)).toEqual(["a"]);
    ({ flow } = gradeWord(flow, "good"));
    expect(flow.queue).toEqual([]);
  });
});

describe("progress", () => {
  it("grows its total with each re-insertion", () => {
    let flow = startReadFlow(words("a", "b"), OFF);
    expect(flow.total).toBe(2);
    expect(flow.done).toBe(0);
    ({ flow } = gradeWord(flow, "again"));
    expect(flow).toMatchObject({ total: 3, done: 1 });
    ({ flow } = gradeWord(flow, "good")); // b is new: returns once
    expect(flow).toMatchObject({ total: 4, done: 2 });
  });
});

// A fake recogniser: it replays what the child "says" as recogniser events.
type Say = Parameters<typeof receive>[1];
function listenTo(flow: ReadFlow, say: Say): ReadFlow {
  return receive(stopListening(startListening(flow)), say);
}
const heard = (...alternatives: string[]): Say => ({ kind: "heard", alternatives });
const silence: Say = { kind: "silence" };
const hang: Say = { kind: "hang" };

describe("Read Aloud word flow", () => {
  it("starts each showing idle, with only Oops open", () => {
    const flow = startReadFlow(words("长城"));
    expect(flow.wordState).toEqual({ kind: "idle" });
    expect(enabledGrades(flow.wordState)).toEqual(["again"]);
  });

  it("moves idle -> listening -> checking -> passed", () => {
    let flow = startListening(startReadFlow(words("长城")));
    expect(flow.wordState).toEqual({ kind: "listening" });
    flow = stopListening(flow);
    expect(flow.wordState).toEqual({ kind: "checking" });
    flow = receive(flow, heard("长城"));
    expect(flow.wordState).toEqual({ kind: "passed" });
    expect(enabledGrades(flow.wordState)).toEqual(["again", "hard", "good", "easy"]);
  });

  it("accepts a result that arrives while still listening", () => {
    const flow = receive(startListening(startReadFlow(words("apple"))), heard("Apple."));
    expect(flow.wordState).toEqual({ kind: "passed" });
  });

  it("passes on the first try", () => {
    expect(listenTo(startReadFlow(words("apple")), heard("apple")).wordState).toEqual({ kind: "passed" });
  });

  it("passes on the third try", () => {
    let flow = startReadFlow(words("apple"));
    flow = listenTo(flow, heard("able"));
    expect(flow.wordState).toEqual({ kind: "missed", triesLeft: 2 });
    flow = listenTo(flow, heard("ample"));
    expect(flow.wordState).toEqual({ kind: "missed", triesLeft: 1 });
    flow = listenTo(flow, heard("apple", "grape"));
    expect(flow.wordState).toEqual({ kind: "passed" });
  });

  it("judges only the top guess: the target further down the alternatives is a miss", () => {
    const flow = listenTo(startReadFlow(words("apple")), heard("able", "apple"));
    expect(flow.wordState).toEqual({ kind: "missed", triesLeft: 2 });
  });

  it("keeps what was heard on the flow, with the verdict, for debugging", () => {
    const missed = listenTo(startReadFlow(words("apple")), heard("able", "apple"));
    expect(missed.lastAttempt).toEqual({ alternatives: ["able", "apple"], confidences: undefined, passed: false, how: null });
    const passed = listenTo(missed, heard("apple"));
    expect(passed.lastAttempt).toEqual({ alternatives: ["apple"], confidences: undefined, passed: true, how: "same-text" });
    expect(startListening(missed).lastAttempt).toBeNull();
  });

  it("records how a Chinese reading passed: same pinyin, not the same characters", () => {
    const flow = listenTo(startReadFlow(words("弯曲")), heard("湾区"));
    expect(flow.wordState).toEqual({ kind: "passed" });
    expect(flow.lastAttempt?.how).toBe("same-pinyin");
  });

  it("keeps the recogniser's confidences for debugging", () => {
    const flow = listenTo(startReadFlow(words("apple")), { kind: "heard", alternatives: ["apple"], confidences: [0.4] });
    expect(flow.lastAttempt?.confidences).toEqual([0.4]);
  });

  it("fails after three misses, revealing the answer with only Oops open", () => {
    let flow = startReadFlow(words("apple"));
    for (const wrong of ["able", "ample", "maple"]) flow = listenTo(flow, heard(wrong));
    expect(flow.wordState).toEqual({ kind: "failed" });
    expect(isPinyinRevealed(flow)).toBe(true);
    expect(enabledGrades(flow.wordState)).toEqual(["again"]);
    expect(startListening(flow)).toBe(flow);
  });

  it("doesn't use a try for silence", () => {
    let flow = startReadFlow(words("apple"));
    flow = listenTo(flow, silence);
    expect(flow.wordState).toEqual({ kind: "idle" });
    expect(flow.note).toMatch(/didn't hear/i);
    for (const wrong of ["able", "ample"]) flow = listenTo(flow, heard(wrong));
    flow = listenTo(flow, silence);
    expect(flow.wordState).toEqual({ kind: "missed", triesLeft: 1 });
    expect(listenTo(flow, heard("apple")).wordState).toEqual({ kind: "passed" });
  });

  it("reveals the pinyin after a pass only through Peek", () => {
    const flow = listenTo(startReadFlow(words("长城")), heard("长城"));
    expect(isPinyinRevealed(flow)).toBe(false);
    const peeked = peek(flow);
    expect(enabledGrades(peeked.wordState)).toEqual(["again"]);
    expect(gradeWord(peeked, "good").emitted).toBeNull();
  });

  it("falls back to self-report for the rest of the session on each unavailable error", () => {
    for (const error of ["unsupported", "not-allowed", "service-not-allowed", "network", "language-not-supported"]) {
      let flow = listenTo(startReadFlow(words("a", "b")), { kind: "error", error });
      expect(flow.wordState).toEqual({ kind: "unavailable" });
      expect(enabledGrades(flow.wordState)).toEqual(["again", "hard", "good", "easy"]);
      ({ flow } = gradeWord(flow, "good"));
      expect(currentShowing(flow).word).toBe("b");
      expect(flow.wordState).toEqual({ kind: "unavailable" });
    }
  });

  it("treats any other error as silence", () => {
    const flow = listenTo(startReadFlow(words("a")), { kind: "error", error: "audio-capture" });
    expect(flow.wordState).toEqual({ kind: "idle" });
  });

  it("returns to idle on a start hang without using a try", () => {
    let flow = listenTo(startReadFlow(words("apple")), heard("able"));
    flow = listenTo(flow, hang);
    expect(flow.wordState).toEqual({ kind: "missed", triesLeft: 2 });
    expect(flow.note).toBeNull();
  });

  it("goes unavailable after two hangs in a row, not after two apart", () => {
    let flow = listenTo(startReadFlow(words("apple")), hang);
    expect(flow.wordState).toEqual({ kind: "idle" });
    flow = listenTo(flow, hang);
    expect(flow.wordState).toEqual({ kind: "unavailable" });

    let apart = listenTo(startReadFlow(words("apple")), hang);
    apart = listenTo(apart, silence);
    apart = listenTo(apart, hang);
    expect(apart.wordState).toEqual({ kind: "idle" });
  });

  it("makes the session unavailable when the child taps Not now", () => {
    let flow = declineReadAloud(startReadFlow(words("a", "b")));
    expect(flow.wordState).toEqual({ kind: "unavailable" });
    ({ flow } = gradeWord(flow, "easy"));
    expect(flow.wordState).toEqual({ kind: "unavailable" });
  });

  it("ignores recogniser events when nothing is being listened for", () => {
    const flow = startReadFlow(words("apple"));
    expect(receive(flow, heard("apple"))).toBe(flow);
    const passed = listenTo(flow, heard("apple"));
    expect(receive(passed, heard("able"))).toBe(passed);
  });

  it("starts the next showing fresh: idle, three tries", () => {
    let flow = listenTo(startReadFlow(words("apple", "pear")), heard("able"));
    ({ flow } = gradeWord(flow, "again"));
    expect(flow.wordState).toEqual({ kind: "idle" });
    flow = listenTo(flow, heard("pear"));
    ({ flow } = gradeWord(flow, "good"));
    for (const wrong of ["able", "ample"]) flow = listenTo(flow, heard(wrong));
    expect(flow.wordState).toEqual({ kind: "missed", triesLeft: 1 });
  });

  it("lets Peek interrupt listening", () => {
    const flow = peek(startListening(startReadFlow(words("apple"))));
    expect(flow.wordState).toEqual({ kind: "peeked" });
  });

  it("describes where the word stands", () => {
    const flow = startReadFlow(words("apple"));
    expect(captionFor(flow)).toBe("Tap and read it aloud");
    expect(captionFor(startListening(flow))).toBe("Listening… tap when done");
    expect(captionFor(stopListening(startListening(flow)))).toBe("Checking…");
    expect(captionFor(listenTo(flow, heard("able")))).toBe("Not quite. 2 tries left.");
    expect(captionFor(listenTo(listenTo(flow, heard("able")), heard("ample")))).toBe("Not quite. 1 try left.");
    expect(captionFor(listenTo(flow, heard("apple")))).toBe("Read correctly");
    expect(captionFor(declineReadAloud(flow))).toMatch(/isn't available here, so grade it yourself/);
  });
});
