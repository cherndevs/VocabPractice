import { describe, expect, it } from "vitest";
import { currentShowing, enabledGrades, gradeWord, peek, startReadFlow, type ReadFlow } from "./read-flow";

const words = (...w: string[]) => w;
const order = (flow: ReadFlow) => flow.queue.map((s) => s.word);

describe("enabled grades", () => {
  it("offers all four when Read Aloud is unavailable", () => {
    const flow = startReadFlow(words("a", "b"));
    expect(flow.wordState).toEqual({ kind: "unavailable" });
    expect(enabledGrades(flow.wordState)).toEqual(["again", "hard", "good", "easy"]);
  });

  it("leaves only Oops once the word has been peeked", () => {
    const flow = peek(startReadFlow(words("a", "b")));
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
    let flow = peek(startReadFlow(words("a", "b")));
    ({ flow } = gradeWord(flow, "again"));
    expect(currentShowing(flow).word).toBe("b");
    expect(enabledGrades(flow.wordState)).toEqual(["again", "hard", "good", "easy"]);
    ({ flow } = gradeWord(flow, "good"));
    expect(currentShowing(flow).word).toBe("a");
    expect(enabledGrades(flow.wordState)).toEqual(["again", "hard", "good", "easy"]);
  });

  it("refuses a positive grade on a peeked word", () => {
    const flow = peek(startReadFlow(words("a")));
    const result = gradeWord(flow, "easy");
    expect(result.emitted).toBeNull();
    expect(result.flow).toBe(flow);
  });
});

describe("same-session repeats", () => {
  it("re-inserts an Oops word after the next 3 cards", () => {
    const { flow, emitted } = gradeWord(startReadFlow(words("a", "b", "c", "d", "e")), "again");
    expect(emitted).toEqual({ word: "a", grade: "again" });
    expect(order(flow)).toEqual(["b", "c", "d", "a", "e"]);
    expect(flow.queue[3].tryOnceMore).toBe(true);
  });

  it("re-inserts at the end when fewer than 3 cards remain", () => {
    const { flow } = gradeWord(startReadFlow(words("a", "b", "c")), "again");
    expect(order(flow)).toEqual(["b", "c", "a"]);
    const solo = gradeWord(startReadFlow(words("a")), "again").flow;
    expect(order(solo)).toEqual(["a"]);
  });

  it("labels only returning showings Try once more", () => {
    const flow = startReadFlow(words("a", "b"));
    expect(currentShowing(flow).tryOnceMore).toBe(false);
    const next = gradeWord(gradeWord(flow, "again").flow, "good").flow;
    expect(currentShowing(next)).toEqual({ word: "a", tryOnceMore: true });
  });

  it("needs two right answers before a new word stops returning", () => {
    let flow = startReadFlow(words("a"));
    for (const grade of ["hard", "good"] as const) {
      ({ flow } = gradeWord(flow, grade));
      if (grade === "hard") expect(order(flow)).toEqual(["a"]);
    }
    expect(flow.queue).toEqual([]);
  });

  it("doesn't count an Oops towards the two right answers", () => {
    let flow = startReadFlow(words("a"));
    for (const grade of ["again", "easy"] as const) ({ flow } = gradeWord(flow, grade));
    expect(order(flow)).toEqual(["a"]);
    ({ flow } = gradeWord(flow, "good"));
    expect(flow.queue).toEqual([]);
  });
});

describe("progress", () => {
  it("grows its total with each re-insertion", () => {
    let flow = startReadFlow(words("a", "b"));
    expect(flow.total).toBe(2);
    expect(flow.done).toBe(0);
    ({ flow } = gradeWord(flow, "again"));
    expect(flow).toMatchObject({ total: 3, done: 1 });
    ({ flow } = gradeWord(flow, "good")); // b is new: returns once
    expect(flow).toMatchObject({ total: 4, done: 2 });
  });
});
