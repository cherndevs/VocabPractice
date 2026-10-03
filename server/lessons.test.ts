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
    expect(res.body.lesson).toEqual({ id: expect.any(String), name: "Unit 3" });
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
