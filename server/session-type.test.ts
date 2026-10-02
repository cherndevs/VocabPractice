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

describe("session type", () => {
  it.each(["spelling", "reading"])("creates a %s session", async (sessionType) => {
    const created = await api.request("POST", "/api/sessions", newSession({ sessionType }));
    expect(created.status).toBe(200);
    expect(created.body.sessionType).toBe(sessionType);

    const fetched = await api.request("GET", `/api/sessions/${created.body.id}`);
    expect(fetched.body.sessionType).toBe(sessionType);

    const list = await api.request("GET", "/api/sessions?subject=english");
    expect(list.body[0].sessionType).toBe(sessionType);
  });

  it("rejects a missing or invalid type", async () => {
    const { sessionType: _omit, ...withoutType } = newSession();
    expect((await api.request("POST", "/api/sessions", withoutType)).status).toBe(400);
    expect((await api.request("POST", "/api/sessions", newSession({ sessionType: "speaking" }))).status).toBe(400);
    expect((await api.request("POST", "/api/sessions", newSession({ sessionType: null }))).status).toBe(400);
  });

  it("never lets the type change", async () => {
    const created = await api.request("POST", "/api/sessions", newSession());
    const res = await api.request("PUT", `/api/sessions/${created.body.id}`, { sessionType: "reading" });
    expect(res.status).toBe(400);

    const after = await api.request("GET", `/api/sessions/${created.body.id}`);
    expect(after.body.sessionType).toBe("spelling");
  });

  it("allows a PUT that repeats the session's own type", async () => {
    const created = await api.request("POST", "/api/sessions", newSession({ sessionType: "reading" }));
    const res = await api.request("PUT", `/api/sessions/${created.body.id}`, {
      sessionType: "reading",
      title: "Renamed",
    });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Renamed");
    expect(res.body.sessionType).toBe("reading");
  });

  it("returns 404 rather than 400 when updating an unknown session's type", async () => {
    const res = await api.request("PUT", "/api/sessions/nope", { sessionType: "reading" });
    expect(res.status).toBe(404);
  });
});
