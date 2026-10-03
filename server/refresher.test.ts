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
const grade = (word: string, g: string, at: Date, skill = "spelling", subject = "english") =>
  api.request("POST", "/api/grades", {
    grades: [{ id: `g${++nextId}`, subject, word, skill, grade: g, gradedAt: at.toISOString() }],
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
const refresher = (skill = "spelling", subject = "english") =>
  api.request("GET", `/api/refresher?subject=${subject}&skill=${skill}`);
const practice = () => api.request("GET", "/api/practice?subject=english&today=2026-01-05");

describe("GET /api/refresher", () => {
  it("requires a valid subject and skill", async () => {
    expect((await api.request("GET", "/api/refresher?skill=spelling")).status).toBe(400);
    expect((await api.request("GET", "/api/refresher?subject=english")).status).toBe(400);
    expect((await api.request("GET", "/api/refresher?subject=english&skill=bogus")).status).toBe(400);
  });

  it("is empty with no sessions", async () => {
    expect((await refresher()).body).toEqual({ words: [], count: 0 });
  });

  it("gathers words across sessions, most overdue first, then new", async () => {
    await make(["a", "b"]);
    await make(["c", "d"]);
    await grade("c", "again", T0);
    await grade("b", "again", days(-0.5));
    api.setNow(days(1));
    const { body } = await refresher();
    expect(body.words.slice(0, 2)).toEqual(["b", "c"]);
    expect(body.words.slice(2).sort()).toEqual(["a", "d"]);
    expect(body.count).toBe(4);
  });

  it("keeps the skills apart", async () => {
    await make(["spell"], { sessionType: "spelling" });
    await make(["read"], { sessionType: "reading" });
    expect((await refresher("spelling")).body.words).toEqual(["spell"]);
    expect((await refresher("reading")).body.words).toEqual(["read"]);
  });

  it("is scoped to the Subject", async () => {
    await make(["apple"]);
    await make(["你好"], { subject: "chinese" });
    expect((await refresher("spelling", "english")).body.words).toEqual(["apple"]);
    expect((await refresher("spelling", "chinese")).body.words).toEqual(["你好"]);
  });

  it("lists a word held by two sessions once", async () => {
    await make(["apple", "pear"]);
    await make([" apple ", "fig"]);
    const { body } = await refresher();
    expect(body.words.sort()).toEqual(["apple", "fig", "pear"]);
    expect(body.count).toBe(3);
  });

  it("drops a graded word until it is due again", async () => {
    await make(["apple", "pear"]);
    await grade("apple", "good", T0);
    expect((await refresher()).body).toEqual({ words: ["pear"], count: 1 });
    api.setNow(days(365));
    expect((await refresher()).body.count).toBe(2);
  });

  it("caps words at the Refresher size while count ignores the cap", async () => {
    await make(["a", "b", "c", "d", "e"]);
    expect((await api.request("PUT", "/api/settings", { refresherSize: 2 })).status).toBe(200);
    expect((await refresher()).body).toEqual({ words: ["a", "b"], count: 5 });
    await api.request("PUT", "/api/settings", { refresherSize: 3 });
    expect((await refresher()).body.words).toHaveLength(3);
  });

  it("defaults the cap to 20", async () => {
    await make(Array.from({ length: 25 }, (_, i) => `w${i}`));
    const { body } = await refresher();
    expect(body.words).toHaveLength(20);
    expect(body.count).toBe(25);
  });
});

describe("Refresher size setting", () => {
  it("defaults to 20 and round-trips", async () => {
    expect((await api.request("GET", "/api/settings")).body.refresherSize).toBe(20);
    const put = await api.request("PUT", "/api/settings", { refresherSize: 7 });
    expect(put.body.refresherSize).toBe(7);
    expect((await api.request("GET", "/api/settings")).body.refresherSize).toBe(7);
  });

  it.each([0, -1, 2.5, "5", null])("rejects %j with 400", async (value) => {
    expect((await api.request("PUT", "/api/settings", { refresherSize: value })).status).toBe(400);
  });
});

describe("GET /api/practice refresher counts", () => {
  it("reports words needing review per skill", async () => {
    await make(["a", "b"]);
    await make(["r"], { sessionType: "reading" });
    await grade("a", "good", T0);
    expect((await practice()).body.refreshers).toEqual({ spelling: 1, reading: 1 });
  });

  it("reports the uncapped count", async () => {
    await make(Array.from({ length: 25 }, (_, i) => `w${i}`));
    expect((await practice()).body.refreshers).toEqual({ spelling: 25, reading: 0 });
  });
});
