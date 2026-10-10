import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startTestApi, type TestApi } from "./test-harness";

let api: TestApi;
beforeEach(async () => {
  api = await startTestApi();
});
afterEach(async () => {
  await api.close();
});

const newSession = (overrides: Record<string, unknown> = {}) => ({
  title: "Unit 1",
  words: ["apple", "pear"],
  wordCount: 2,
  subject: "english",
  sessionType: "spelling",
  ...overrides,
});

const lessons = async (subject: string) => (await api.request("GET", `/api/lessons?subject=${subject}`)).body;

describe("tagging a session with a Lesson", () => {
  it("creates a Lesson implicitly from a new name", async () => {
    const res = await api.request("POST", "/api/sessions", newSession({ lessonName: "Unit 3" }));
    expect(res.status).toBe(200);
    expect(res.body.lesson).toEqual({ id: expect.any(String), name: "Unit 3", year: null, createdAt: expect.any(String) });
    expect((await lessons("english")).map((l: any) => l.name)).toEqual(["Unit 3"]);
  });

  it("leaves a session untagged when no lesson is given", async () => {
    const none = await api.request("POST", "/api/sessions", newSession());
    expect(none.body.lesson).toBeNull();
    const nulled = await api.request("POST", "/api/sessions", newSession({ lessonName: null }));
    expect(nulled.body.lesson).toBeNull();
    expect(await lessons("english")).toEqual([]);
  });

  it("reuses an existing Lesson after trimming the name", async () => {
    const first = await api.request("POST", "/api/sessions", newSession({ lessonName: "Unit 3" }));
    const second = await api.request("POST", "/api/sessions", newSession({ lessonName: "  Unit 3  " }));
    expect(second.body.lesson).toEqual(first.body.lesson);
    expect(await lessons("english")).toHaveLength(1);
  });

  it("gives the same name in two Subjects two Lessons", async () => {
    const en = await api.request("POST", "/api/sessions", newSession({ lessonName: "Unit 1" }));
    const zh = await api.request(
      "POST",
      "/api/sessions",
      newSession({ subject: "chinese", words: ["长城"], wordCount: 1, lessonName: "Unit 1" }),
    );
    expect(en.body.lesson.id).not.toBe(zh.body.lesson.id);
    expect(await lessons("english")).toHaveLength(1);
    expect(await lessons("chinese")).toHaveLength(1);
  });

  it("rejects a lesson name that is not a string or null", async () => {
    const res = await api.request("POST", "/api/sessions", newSession({ lessonName: 5 }));
    expect(res.status).toBe(400);
  });

  it("tags, retags and clears on update", async () => {
    const created = await api.request("POST", "/api/sessions", newSession());
    const id = created.body.id;

    const tagged = await api.request("PUT", `/api/sessions/${id}`, { lessonName: "Unit 2" });
    expect(tagged.status).toBe(200);
    expect(tagged.body.lesson.name).toBe("Unit 2");

    const retagged = await api.request("PUT", `/api/sessions/${id}`, { lessonName: "Unit 4" });
    expect(retagged.body.lesson.name).toBe("Unit 4");

    const cleared = await api.request("PUT", `/api/sessions/${id}`, { lessonName: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.lesson).toBeNull();
    expect((await api.request("GET", `/api/sessions/${id}`)).body.lesson).toBeNull();
  });

  it("keeps the tag when an update does not mention it", async () => {
    const created = await api.request("POST", "/api/sessions", newSession({ lessonName: "Unit 2" }));
    const res = await api.request("PUT", `/api/sessions/${created.body.id}`, { title: "Renamed" });
    expect(res.body.lesson.name).toBe("Unit 2");
  });

  it("keeps a Lesson listed after its last session is untagged", async () => {
    const created = await api.request("POST", "/api/sessions", newSession({ lessonName: "Unit 2" }));
    await api.request("PUT", `/api/sessions/${created.body.id}`, { lessonName: null });
    expect((await lessons("english")).map((l: any) => l.name)).toEqual(["Unit 2"]);
  });

  it("includes the lesson in the sessions list", async () => {
    await api.request("POST", "/api/sessions", newSession({ title: "A", lessonName: "Unit 2" }));
    await api.request("POST", "/api/sessions", newSession({ title: "B" }));
    const list = (await api.request("GET", "/api/sessions?subject=english")).body;
    const byTitle = Object.fromEntries(list.map((s: any) => [s.title, s.lesson?.name ?? null]));
    expect(byTitle).toEqual({ A: "Unit 2", B: null });
  });
});

describe("listing Lessons", () => {
  it("sorts by name and never returns another Subject's", async () => {
    await api.request("POST", "/api/sessions", newSession({ lessonName: "Unit 10" }));
    await api.request("POST", "/api/sessions", newSession({ lessonName: "Animals" }));
    await api.request(
      "POST",
      "/api/sessions",
      newSession({ subject: "chinese", words: ["长城"], wordCount: 1, lessonName: "第一课" }),
    );

    const english = await api.request("GET", "/api/lessons?subject=english");
    expect(english.status).toBe(200);
    expect(english.body.map((l: any) => l.name)).toEqual(["Animals", "Unit 10"]);
    expect((await lessons("chinese")).map((l: any) => l.name)).toEqual(["第一课"]);
  });

  it("requires a valid subject", async () => {
    expect((await api.request("GET", "/api/lessons")).status).toBe(400);
    expect((await api.request("GET", "/api/lessons?subject=maths")).status).toBe(400);
  });
});

describe("a Lesson's Year", () => {
  const chinese = (overrides: Record<string, unknown> = {}) =>
    newSession({ subject: "chinese", sessionType: "reading", words: ["衣"], wordCount: 1, ...overrides });

  it("is set when a new Lesson is created, trimmed, and blank means none", async () => {
    const p1 = await api.request("POST", "/api/sessions", chinese({ lessonName: "第一课", lessonYear: " P1 " }));
    expect(p1.body.lesson).toMatchObject({ name: "第一课", year: "P1" });
    const blank = await api.request("POST", "/api/sessions", chinese({ lessonName: "第二课", lessonYear: "  " }));
    expect(blank.body.lesson.year).toBeNull();
  });

  it("tells apart the same name in two Years, and reuses one within a Year", async () => {
    const p1 = await api.request("POST", "/api/sessions", chinese({ lessonName: "第一课", lessonYear: "P1" }));
    const p2 = await api.request("POST", "/api/sessions", chinese({ lessonName: "第一课", lessonYear: "P2" }));
    const none = await api.request("POST", "/api/sessions", chinese({ lessonName: "第一课" }));
    const p1Again = await api.request("POST", "/api/sessions", chinese({ lessonName: "第一课", lessonYear: "P1" }));
    const noneAgain = await api.request("POST", "/api/sessions", chinese({ lessonName: "第一课", lessonYear: null }));
    expect(new Set([p1.body.lesson.id, p2.body.lesson.id, none.body.lesson.id]).size).toBe(3);
    expect(p1Again.body.lesson.id).toBe(p1.body.lesson.id);
    expect(noneAgain.body.lesson.id).toBe(none.body.lesson.id);
    expect(await lessons("chinese")).toHaveLength(3);
  });

  it("goes with the Lesson when a session is retagged on update", async () => {
    const created = await api.request("POST", "/api/sessions", chinese());
    const res = await api.request("PUT", `/api/sessions/${created.body.id}`, { lessonName: "第三课", lessonYear: "P3" });
    expect(res.body.lesson).toMatchObject({ name: "第三课", year: "P3" });
  });

  it("rejects a Year that is not a string or null", async () => {
    expect((await api.request("POST", "/api/sessions", chinese({ lessonName: "第一课", lessonYear: 1 }))).status).toBe(400);
    const created = await api.request("POST", "/api/sessions", chinese());
    expect((await api.request("PUT", `/api/sessions/${created.body.id}`, { lessonName: "x", lessonYear: 1 })).status).toBe(400);
  });

  it("can be changed for the whole Lesson", async () => {
    const a = await api.request("POST", "/api/sessions", chinese({ title: "A", lessonName: "第一课", lessonYear: "P1" }));
    await api.request("POST", "/api/sessions", chinese({ title: "B", lessonName: "第一课", lessonYear: "P1" }));
    const moved = await api.request("PUT", `/api/lessons/${a.body.lesson.id}`, { year: " P2 " });
    expect(moved.status).toBe(200);
    expect(moved.body.year).toBe("P2");
    const list = (await api.request("GET", "/api/sessions?subject=chinese")).body;
    expect(list.map((s: any) => s.lesson.year)).toEqual(["P2", "P2"]);

    const cleared = await api.request("PUT", `/api/lessons/${a.body.lesson.id}`, { year: "" });
    expect(cleared.body.year).toBeNull();
  });

  it("refuses a change that would clash with that Year's Lesson of the same name", async () => {
    const p1 = await api.request("POST", "/api/sessions", chinese({ lessonName: "第一课", lessonYear: "P1" }));
    await api.request("POST", "/api/sessions", chinese({ lessonName: "第一课", lessonYear: "P2" }));
    const res = await api.request("PUT", `/api/lessons/${p1.body.lesson.id}`, { year: "P2" });
    expect(res.status).toBe(409);
  });

  it("404s an unknown Lesson and 400s a bad Year", async () => {
    expect((await api.request("PUT", "/api/lessons/nope", { year: "P1" })).status).toBe(404);
    const p1 = await api.request("POST", "/api/sessions", chinese({ lessonName: "第一课", lessonYear: "P1" }));
    expect((await api.request("PUT", `/api/lessons/${p1.body.lesson.id}`, { year: 3 })).status).toBe(400);
  });
});
