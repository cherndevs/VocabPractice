import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startTestApi, type TestApi } from "./test-harness";

let api: TestApi;
const T0 = new Date("2026-01-05T09:00:00Z");
const days = (n: number) => new Date(T0.getTime() + n * 86_400_000);

beforeEach(async () => {
  api = await startTestApi();
  api.setNow(T0);
});
afterEach(async () => {
  await api.close();
});

let nextId = 0;
const grade = (word: string, g: string, at: Date, skill = "spelling") =>
  api.request("POST", "/api/grades", {
    grades: [{ id: `g${++nextId}`, subject: "english", word, skill, grade: g, gradedAt: at.toISOString() }],
  });

const make = async (words: string[], overrides: Record<string, unknown> = {}) => {
  const res = await api.request("POST", "/api/sessions", {
    title: "Unit",
    words,
    wordCount: words.length,
    subject: "english",
    sessionType: "spelling",
    ...overrides,
  });
  expect(res.status).toBe(200);
  return res.body;
};
const drill = async (id: string, scope?: string) =>
  api.request("GET", `/api/sessions/${id}/drill${scope ? `?scope=${scope}` : ""}`);
const needsReviewCount = async (id: string) =>
  (await api.request("GET", "/api/sessions?subject=english")).body.find((s: any) => s.id === id).needsReviewCount;

describe("GET /api/sessions/:id/drill", () => {
  it("is 404 for an unknown session and 400 for a bad scope", async () => {
    expect((await drill("nope")).status).toBe(404);
    const s = await make(["apple"]);
    expect((await drill(s.id, "bogus")).status).toBe(400);
  });

  it("defaults to due, and a never-graded session drills every word", async () => {
    const s = await make(["apple", "pear"]);
    expect((await drill(s.id)).body).toEqual({ words: ["apple", "pear"] });
  });

  it("excludes a word graded Good until the clock passes its due time; all always has every word", async () => {
    const s = await make(["apple", "pear"]);
    await grade("apple", "good", T0);
    expect((await drill(s.id, "due")).body.words).toEqual(["pear"]);
    expect((await drill(s.id, "all")).body.words).toEqual(["pear", "apple"]);

    api.setNow(days(365));
    expect((await drill(s.id, "due")).body.words).toEqual(["apple", "pear"]);
  });

  it("orders overdue words most overdue first, then new words, then the rest in list order", async () => {
    const s = await make(["a", "b", "c", "d", "e"]);
    await grade("c", "again", T0); // due soon
    await grade("b", "again", days(-0.5)); // graded earlier, so due earlier
    await grade("e", "good", T0); // not due for a while
    api.setNow(days(1));
    expect((await drill(s.id, "due")).body.words).toEqual(["b", "c", "a", "d"]);
    expect((await drill(s.id, "all")).body.words).toEqual(["b", "c", "a", "d", "e"]);
  });

  it("is per skill", async () => {
    const s = await make(["apple"], { sessionType: "reading" });
    await grade("apple", "good", T0, "spelling");
    expect((await drill(s.id)).body.words).toEqual(["apple"]);
    await grade("apple", "good", T0, "reading");
    expect((await drill(s.id)).body.words).toEqual([]);
  });

  it("is unaffected by the session's due date", async () => {
    const s = await make(["apple", "pear"], { dueDate: "2026-01-06" });
    await grade("apple", "good", T0);
    const before = (await drill(s.id, "all")).body.words;
    const countBefore = await needsReviewCount(s.id);
    await api.request("PUT", `/api/sessions/${s.id}`, { dueDate: "2026-03-01" });
    expect((await drill(s.id, "due")).body.words).toEqual(["pear"]);
    expect((await drill(s.id, "all")).body.words).toEqual(before);
    expect(await needsReviewCount(s.id)).toBe(countBefore);
    expect(countBefore).toBe(1);
  });
});

describe("GET /api/sessions needsReviewCount", () => {
  it("counts words needing review in the session's skill", async () => {
    const s = await make(["apple", "pear", "fig"]);
    expect(await needsReviewCount(s.id)).toBe(3);
    await grade("apple", "good", T0);
    expect(await needsReviewCount(s.id)).toBe(2);
    api.setNow(days(365));
    expect(await needsReviewCount(s.id)).toBe(3);
  });
});

describe("GET /api/sessions/:id/drill?scope=learn", () => {
  it("offers never-graded and last-graded-Oops words, not ones last graded right", async () => {
    const s = await make(["new", "missed", "known", "recovered"]);
    await grade("missed", "good", T0);
    await grade("missed", "again", days(1));
    await grade("known", "good", T0);
    await grade("recovered", "again", T0);
    await grade("recovered", "good", days(1));
    expect((await drill(s.id, "learn")).body.words).toEqual(["new", "missed"]);
  });

  it("ignores reading grades", async () => {
    const s = await make(["apple", "pear"]);
    await grade("apple", "again", T0, "reading");
    await grade("pear", "good", T0, "reading");
    await grade("apple", "good", days(1));
    expect((await drill(s.id, "learn")).body.words).toEqual(["pear"]);
  });

  it("leaves scope all returning every word", async () => {
    const s = await make(["apple", "pear"]);
    await grade("apple", "good", T0);
    expect((await drill(s.id, "all")).body.words).toEqual(["pear", "apple"]);
  });
});
