import { describe, expect, it } from "vitest";
import { currentWord, gotIt, isFinished, next, notYet, progress, startLearnFlow, type LearnFlow } from "./learn-flow";

// Glance → Cover → Check, then the child's own verdict.
const check = (flow: LearnFlow) => next(next(flow));
const got = (flow: LearnFlow) => gotIt(check(flow));
const miss = (flow: LearnFlow) => notYet(check(flow));

describe("learn flow", () => {
  it("steps each word through glance, cover and check", () => {
    let flow = startLearnFlow(["a", "b"]);
    expect([currentWord(flow), flow.step]).toEqual(["a", "glance"]);
    flow = next(flow);
    expect(flow.step).toBe("cover");
    flow = next(flow);
    expect(flow.step).toBe("check");
  });

  it("finishes a word only after two Got its, with other words between", () => {
    let flow = got(startLearnFlow(["a", "b", "c", "d", "e"]));
    expect(progress(flow)).toEqual({ done: 0, total: 5 });
    expect(currentWord(flow)).toBe("b");
    expect(flow.queue.indexOf("a")).toBeGreaterThan(0);
    while (currentWord(flow) !== "a") flow = got(flow);
    flow = got(flow);
    expect(progress(flow).done).toBe(1);
    expect(flow.queue).not.toContain("a");
  });

  it("brings a Not yet word back a few places later, not immediately", () => {
    const flow = miss(startLearnFlow(["a", "b", "c", "d", "e"]));
    expect(currentWord(flow)).toBe("b");
    expect(flow.queue.indexOf("a")).toBeGreaterThanOrEqual(2);
    expect(flow.step).toBe("glance");
  });

  it("puts a Not yet word straight after the only other word left", () => {
    expect(miss(startLearnFlow(["a", "b"])).queue).toEqual(["b", "a"]);
  });

  it("shows the last word again at once when it is the only one left", () => {
    expect(currentWord(miss(startLearnFlow(["a"])))).toBe("a");
  });

  it("has no cap on Not yet", () => {
    let flow = startLearnFlow(["a"]);
    for (let i = 0; i < 20; i++) flow = miss(flow);
    expect(currentWord(flow)).toBe("a");
    expect(isFinished(flow)).toBe(false);
  });

  it("counts finished words and reports finished when all are done", () => {
    let flow = startLearnFlow(["a", "b"]);
    for (let i = 0; i < 3; i++) flow = got(flow);
    expect(progress(flow)).toEqual({ done: 1, total: 2 });
    expect(isFinished(flow)).toBe(false);
    flow = got(flow);
    expect(progress(flow)).toEqual({ done: 2, total: 2 });
    expect(isFinished(flow)).toBe(true);
    expect(currentWord(flow)).toBeNull();
  });

  it("ignores verdicts before the check step", () => {
    const flow = startLearnFlow(["a", "b"]);
    expect(gotIt(flow)).toBe(flow);
    expect(notYet(next(flow))).toEqual(next(flow));
  });
});
