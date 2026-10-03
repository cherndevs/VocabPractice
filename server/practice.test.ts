import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startTestApi, type TestApi } from "./test-harness";

let api: TestApi;
beforeEach(async () => {
  api = await startTestApi();
});
afterEach(async () => {
  await api.close();
});

const make = async (overrides: Record<string, unknown> = {}) => {
  const res = await api.request("POST", "/api/sessions", {
    title: "Unit",
    words: ["apple"],
    wordCount: 1,
    subject: "english",
    sessionType: "spelling",
    ...overrides,
  });
  expect(res.status).toBe(200);
  return res.body;
};
const practice = (query = "subject=english&today=2026-10-03") => api.request("GET", `/api/practice?${query}`);

describe("GET /api/practice", () => {
  it("is empty when there are no sessions", async () => {
    const res = await practice();
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ thisWeek: null, pinned: [] });
  });

  it("counts a session due today", async () => {
    const s = await make({ dueDate: "2026-10-03" });
    expect((await practice()).body.thisWeek.id).toBe(s.id);
  });

  it("excludes past due dates and sessions with no due date", async () => {
    await make({ dueDate: "2026-10-02" });
    await make({});
    expect((await practice()).body.thisWeek).toBeNull();
  });

  it("picks the nearest due date", async () => {
    await make({ dueDate: "2026-10-20" });
    const near = await make({ dueDate: "2026-10-05" });
    await make({ dueDate: "2026-10-01" });
    expect((await practice()).body.thisWeek.id).toBe(near.id);
  });

  it("lists pinned sessions, with the lesson attached", async () => {
    const s = await make({ lessonName: "Unit 3" });
    await api.request("PUT", `/api/sessions/${s.id}`, { pinnedAt: new Date().toISOString() });
    await make({});
    const { body } = await practice();
    expect(body.pinned.map((p: any) => p.id)).toEqual([s.id]);
    expect(body.pinned[0].lesson.name).toBe("Unit 3");
  });

  it("shows a session that is pinned and nearest-due once, under thisWeek", async () => {
    const s = await make({ dueDate: "2026-10-05" });
    await api.request("PUT", `/api/sessions/${s.id}`, { pinnedAt: new Date().toISOString() });
    const { body } = await practice();
    expect(body.thisWeek.id).toBe(s.id);
    expect(body.pinned).toEqual([]);
  });

  it("is scoped to the Subject", async () => {
    const zh = await make({ subject: "chinese", dueDate: "2026-10-05" });
    await api.request("PUT", `/api/sessions/${zh.id}`, { pinnedAt: new Date().toISOString() });
    expect((await practice()).body).toMatchObject({ thisWeek: null, pinned: [] });
    const res = await practice("subject=chinese&today=2026-10-03");
    expect(res.body.thisWeek.id).toBe(zh.id);
  });

  it.each(["", "today=2026-13-01", "today=10/03/2026"])("rejects a bad today (%j) with 400", async (q) => {
    expect((await practice(`subject=english&${q}`)).status).toBe(400);
  });

  it("requires a valid subject", async () => {
    expect((await practice("today=2026-10-03")).status).toBe(400);
  });
});

describe("session retrievability (card ring)", () => {
  const T0 = new Date("2026-01-05T09:00:00Z");
  const gradeWord = (word: string, g: string, at: Date) =>
    api.request("POST", "/api/grades", {
      grades: [{ id: `${word}-${g}-${at.getTime()}`, subject: "english", word, skill: "spelling", grade: g, gradedAt: at.toISOString() }],
    });
  const sessionOf = async (id: string) =>
    (await api.request("GET", "/api/sessions?subject=english")).body.find((s: any) => s.id === id);

  it("is null until a word in the session has been graded", async () => {
    const s = await make({ words: ["apple", "pear"], wordCount: 2, dueDate: "2026-10-03" });
    expect((await sessionOf(s.id)).retrievability).toBeNull();
    expect((await practice()).body.thisWeek.retrievability).toBeNull();
  });

  it("is near 1 just after grading every word, and counts ungraded words as 0", async () => {
    const s = await make({ words: ["apple", "pear"], wordCount: 2, dueDate: "2026-10-03" });
    api.setNow(T0);
    await gradeWord("apple", "good", T0);
    const half = (await sessionOf(s.id)).retrievability;
    expect(half).toBeGreaterThan(0.45);
    expect(half).toBeLessThanOrEqual(0.5);
    await gradeWord("pear", "good", T0);
    expect((await sessionOf(s.id)).retrievability).toBeGreaterThan(0.95);
    expect((await practice()).body.thisWeek.retrievability).toBeGreaterThan(0.95);
  });

  it("decays as time passes", async () => {
    const s = await make({ words: ["apple"], wordCount: 1 });
    api.setNow(T0);
    await gradeWord("apple", "good", T0);
    const fresh = (await sessionOf(s.id)).retrievability;
    api.setNow(new Date(T0.getTime() + 60 * 86_400_000));
    expect((await sessionOf(s.id)).retrievability).toBeLessThan(fresh);
  });
});
