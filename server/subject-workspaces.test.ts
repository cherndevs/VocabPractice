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

describe("creating a session", () => {
  it("records the subject it was created in", async () => {
    const chinese = await api.request("POST", "/api/sessions", newSession({ subject: "chinese" }));
    expect(chinese.status).toBe(200);
    expect(chinese.body.subject).toBe("chinese");

    const english = await api.request("POST", "/api/sessions", newSession());
    expect(english.body.subject).toBe("english");
  });

  it("rejects a missing or unknown subject", async () => {
    const { subject: _omit, ...withoutSubject } = newSession();
    expect((await api.request("POST", "/api/sessions", withoutSubject)).status).toBe(400);
    expect((await api.request("POST", "/api/sessions", newSession({ subject: "maths" }))).status).toBe(400);
  });
});

describe("listing sessions", () => {
  it("returns only the requested subject's sessions", async () => {
    await api.request("POST", "/api/sessions", newSession({ title: "Fruit" }));
    await api.request("POST", "/api/sessions", newSession({ title: "长城", subject: "chinese", words: ["长城"], wordCount: 1 }));

    const english = await api.request("GET", "/api/sessions?subject=english");
    expect(english.status).toBe(200);
    expect(english.body.map((s: any) => s.title)).toEqual(["Fruit"]);

    const chinese = await api.request("GET", "/api/sessions?subject=chinese");
    expect(chinese.body.map((s: any) => s.title)).toEqual(["长城"]);
  });

  it("shows an empty list for a workspace with no sessions", async () => {
    await api.request("POST", "/api/sessions", newSession());
    const chinese = await api.request("GET", "/api/sessions?subject=chinese");
    expect(chinese.status).toBe(200);
    expect(chinese.body).toEqual([]);
  });

  it("rejects a missing or unknown subject", async () => {
    expect((await api.request("GET", "/api/sessions")).status).toBe(400);
    expect((await api.request("GET", "/api/sessions?subject=maths")).status).toBe(400);
  });

  it("keeps pinned sessions first within a workspace", async () => {
    const first = await api.request("POST", "/api/sessions", newSession({ title: "First" }));
    await api.request("POST", "/api/sessions", newSession({ title: "Second" }));
    await api.request("PUT", `/api/sessions/${first.body.id}`, { pinnedAt: new Date().toISOString() });

    const list = await api.request("GET", "/api/sessions?subject=english");
    expect(list.body.map((s: any) => s.title)).toEqual(["First", "Second"]);
  });
});

describe("updating a session", () => {
  it("never lets the subject change", async () => {
    const created = await api.request("POST", "/api/sessions", newSession());
    const res = await api.request("PUT", `/api/sessions/${created.body.id}`, { subject: "chinese" });
    expect(res.status).toBe(400);

    const after = await api.request("GET", `/api/sessions/${created.body.id}`);
    expect(after.body.subject).toBe("english");
  });

  it("accepts a body that repeats the session's own subject", async () => {
    const created = await api.request("POST", "/api/sessions", newSession());
    const res = await api.request("PUT", `/api/sessions/${created.body.id}`, { subject: "english", title: "Same" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: "Same", subject: "english" });
  });

  it("still allows ordinary edits", async () => {
    const created = await api.request("POST", "/api/sessions", newSession());
    const res = await api.request("PUT", `/api/sessions/${created.body.id}`, { title: "Renamed" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: "Renamed", subject: "english" });
  });

  it("404s for an unknown session even when the body names a subject", async () => {
    const res = await api.request("PUT", "/api/sessions/nope", { subject: "chinese" });
    expect(res.status).toBe(404);
  });
});

describe("settings", () => {
  it("reports english as the active subject until one is chosen", async () => {
    const res = await api.request("GET", "/api/settings");
    expect(res.status).toBe(200);
    expect(res.body.activeSubject).toBe("english");
  });

  it("persists a switch", async () => {
    const put = await api.request("PUT", "/api/settings", { activeSubject: "chinese" });
    expect(put.status).toBe(200);
    expect(put.body.activeSubject).toBe("chinese");

    const get = await api.request("GET", "/api/settings");
    expect(get.body.activeSubject).toBe("chinese");
  });

  it("rejects an unknown subject", async () => {
    const res = await api.request("PUT", "/api/settings", { activeSubject: "maths" });
    expect(res.status).toBe(400);
  });

  it("does not let a switch be cleared back to unchosen", async () => {
    await api.request("PUT", "/api/settings", { activeSubject: "chinese" });
    const res = await api.request("PUT", "/api/settings", { activeSubject: null });
    expect(res.status).toBe(400);
    const get = await api.request("GET", "/api/settings");
    expect(get.body.activeSubject).toBe("chinese");
  });

  it("leaves other settings untouched when switching workspace", async () => {
    await api.request("PUT", "/api/settings", { darkMode: true });
    await api.request("PUT", "/api/settings", { activeSubject: "chinese" });
    const get = await api.request("GET", "/api/settings");
    expect(get.body).toMatchObject({ darkMode: true, activeSubject: "chinese" });
  });
});
