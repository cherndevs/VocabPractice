import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startTestApi, type TestApi } from "./test-harness";

let api: TestApi;
beforeEach(async () => {
  api = await startTestApi();
  // Well after every grade time used below, so none is clamped as "in the future".
  api.setNow(days(365));
});
afterEach(async () => {
  await api.close();
});

const T0 = new Date("2026-01-05T09:00:00Z");
const days = (n: number, from = T0) => new Date(from.getTime() + n * 86_400_000);

let nextId = 0;
const grade = (word: string, g: string, gradedAt: Date, overrides: Record<string, unknown> = {}) => ({
  id: `g${++nextId}`,
  subject: "english",
  word,
  skill: "spelling",
  grade: g,
  gradedAt: gradedAt.toISOString(),
  ...overrides,
});

const post = (...grades: object[]) => api.request("POST", "/api/grades", { grades });
const reviewState = async (words: string, skill = "spelling") =>
  (await api.request("GET", `/api/review-states?subject=english&skill=${skill}&words=${words}`)).body;

describe("grades and review state", () => {
  it("takes a word from needing review, to not needing it, to needing it again once due", async () => {
    api.setNow(T0);
    expect((await reviewState("apple"))[0]).toMatchObject({ state: null, needsReview: true });

    const res = await post(grade("apple", "good", T0));
    expect(res.status).toBe(200);
    expect(res.body.states[0]).toMatchObject({ word: "apple", skill: "spelling", needsReview: false });
    expect((await reviewState("apple"))[0].needsReview).toBe(false);

    api.setNow(days(60));
    expect((await reviewState("apple"))[0].needsReview).toBe(true);
  });

  it("schedules spelling in whole days from the first grade", async () => {
    for (const g of ["good", "again", "good"]) {
      // each grade lands exactly when the previous one fell due, then again an hour later
      const before = (await reviewState("apple"))[0].state;
      const at = before ? new Date(before.due) : T0;
      const { body } = await post(grade("apple", g, at));
      const state = body.states[0];
      const gap = new Date(state.due).getTime() - at.getTime();
      expect(gap).toBeGreaterThanOrEqual(86_400_000);
      expect(gap % 86_400_000).toBe(0);
      expect(state.scheduledDays).toBe(gap / 86_400_000);
    }
  });

  it("brings an 'Oops' word back sooner than a 'good' one", async () => {
    await post(grade("again-word", "again", T0), grade("good-word", "good", T0));
    const [again, good] = (await reviewState("again-word,good-word")).map((r: any) => new Date(r.state.due));
    expect(again.getTime()).toBeLessThan(good.getTime());
  });

  it("treats a replayed grade id as a no-op", async () => {
    const first = grade("apple", "good", T0);
    const a = await post(first);
    const b = await post(first);
    expect(b.status).toBe(200);
    expect(b.body.states[0]).toEqual(a.body.states[0]);
    expect(b.body.states[0].reps).toBe(1);
  });

  it("logs a grade older than the last review without changing state", async () => {
    const later = await post(grade("apple", "good", days(3)));
    const stale = await post(grade("apple", "again", days(1)));
    expect(stale.status).toBe(200);
    expect(stale.body.states[0]).toEqual(later.body.states[0]);

    // it was logged: replaying it is still a no-op, not a second chance to apply
    const replay = grade("apple", "again", days(1));
    await post(replay);
    expect((await post(replay)).body.states[0].reps).toBe(1);
  });

  it("applies a batch in gradedAt order, whatever order it arrives in", async () => {
    const early = grade("apple", "again", T0);
    const late = grade("apple", "good", days(2));
    const inOrder = (await post(early, late)).body.states[0];

    await api.close();
    api = await startTestApi();
    api.setNow(days(365));
    const reversed = (await post(late, early)).body.states[0];
    expect(reversed).toEqual(inOrder);
    expect(reversed.reps).toBe(2);
  });

  it("shares one state for a word across sessions, and keeps skills apart", async () => {
    const s1 = (await api.request("POST", "/api/sessions", { title: "A", words: ["apple "], wordCount: 1, subject: "english", sessionType: "spelling" })).body;
    const s2 = (await api.request("POST", "/api/sessions", { title: "B", words: ["apple"], wordCount: 1, subject: "english", sessionType: "spelling" })).body;

    await post(grade("apple", "good", T0, { sessionId: s1.id }));
    const second = await post(grade("apple", "good", days(4), { sessionId: s2.id }));
    expect(second.body.states).toHaveLength(1);
    expect(second.body.states[0].reps).toBe(2);

    expect((await reviewState("apple", "reading"))[0]).toMatchObject({ state: null, needsReview: true });
  });

  it("trims words so ' apple' and 'apple' are one word", async () => {
    await post(grade(" apple ", "good", T0));
    const { body } = await post(grade("apple", "good", days(4)));
    expect(body.states[0]).toMatchObject({ word: "apple", reps: 2 });
  });

  it("rejects invalid grades, saving none of the batch", async () => {
    const ok = grade("apple", "good", T0);
    for (const bad of [
      grade("pear", "perfect", T0),
      grade("pear", "good", T0, { skill: "writing" }),
      grade("pear", "good", T0, { word: "  " }),
      grade("pear", "good", T0, { gradedAt: "yesterday" }),
      grade("pear", "good", T0, { subject: "latin" }),
      { ...grade("pear", "good", T0), id: undefined },
    ]) {
      expect((await post(ok, bad)).status).toBe(400);
    }
    expect((await api.request("POST", "/api/grades", {})).status).toBe(400);
    expect((await reviewState("apple"))[0].state).toBeNull();
  });

  it("doesn't let a phone clock in the future push a review into the future", async () => {
    api.setNow(T0);
    await post(grade("apple", "good", days(30)));
    const state = (await reviewState("apple"))[0].state;
    expect(new Date(state.lastReview).getTime()).toBeLessThanOrEqual(T0.getTime());
  });
});

describe("reading schedule", () => {
  const readingGrade = (word: string, g: string, at: Date) => grade(word, g, at, { skill: "reading" });

  it("takes an always-Good word through the short-term steps, then roughly 3 → 6 → 15 days (ADR-0010)", async () => {
    const intervals: number[] = [];
    let at = T0;
    for (let i = 0; i < 5; i++) {
      const { body } = await post(readingGrade("apple", "good", at));
      const due = new Date(body.states[0].due);
      intervals.push((due.getTime() - at.getTime()) / 86_400_000);
      at = due; // always graded exactly when due
    }
    // Short-term steps first (minutes, then the one-day graduating interval).
    expect(intervals[0]).toBeLessThan(1);
    const [graduating, ...spaced] = intervals.slice(1);
    expect(graduating).toBe(1);
    // Then ADR-0010's 3 → 6 → 15. The steps add some stability, so reading runs
    // a little longer than the no-steps simulation (3 → 8 → 19 today); the
    // tolerance catches a changed retention target or weights, not that drift.
    const expected = [3, 6, 15];
    expected.forEach((target, i) => {
      expect(spaced[i]).toBeGreaterThanOrEqual(target * 0.8);
      expect(spaced[i]).toBeLessThanOrEqual(target * 1.4);
    });
  });

  it("moves a word's reading and spelling states independently", async () => {
    await post(readingGrade("apple", "again", T0));
    expect((await reviewState("apple", "reading"))[0].state).toMatchObject({ reps: 1 });
    expect((await reviewState("apple", "spelling"))[0]).toMatchObject({ state: null, needsReview: true });

    await post(grade("apple", "good", days(1)));
    expect((await reviewState("apple", "spelling"))[0].state).toMatchObject({ reps: 1 });
    expect((await reviewState("apple", "reading"))[0].state).toMatchObject({ reps: 1 });
  });
});

describe("testedCount", () => {
  const create = async (title: string, words: string[], sessionType: string) =>
    (await api.request("POST", "/api/sessions", { title, words, wordCount: words.length, subject: "english", sessionType })).body;
  const testedCount = async (id: string) =>
    (await api.request("GET", "/api/sessions?subject=english")).body.find((s: any) => s.id === id).testedCount;

  it("counts the session's words graded at least once in its skill", async () => {
    const spelling = await create("Spelling", ["apple", "pear", "plum"], "spelling");
    const reading = await create("Reading", ["apple", "pear"], "reading");
    expect(await testedCount(spelling.id)).toBe(0);

    await post(grade("apple", "again", T0), grade("pear", "good", T0), grade("other", "good", T0));
    expect(await testedCount(spelling.id)).toBe(2);
    expect(await testedCount(reading.id)).toBe(0);

    await post(grade("apple", "good", days(2)));
    expect(await testedCount(spelling.id)).toBe(2);
  });
});
