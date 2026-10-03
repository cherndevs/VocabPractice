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

describe("session due date", () => {
  it("is null when none is given", async () => {
    const res = await api.request("POST", "/api/sessions", newSession());
    expect(res.status).toBe(200);
    expect(res.body.dueDate).toBeNull();
  });

  it("is set on create and returned as the same string", async () => {
    const res = await api.request("POST", "/api/sessions", newSession({ dueDate: "2026-10-08" }));
    expect(res.status).toBe(200);
    expect(res.body.dueDate).toBe("2026-10-08");
    const got = await api.request("GET", `/api/sessions/${res.body.id}`);
    expect(got.body.dueDate).toBe("2026-10-08");
    const list = await api.request("GET", "/api/sessions?subject=english");
    expect(list.body[0].dueDate).toBe("2026-10-08");
  });

  it("can be changed and cleared on update", async () => {
    const { body } = await api.request("POST", "/api/sessions", newSession({ dueDate: "2026-10-08" }));
    const moved = await api.request("PUT", `/api/sessions/${body.id}`, { dueDate: "2026-10-15" });
    expect(moved.status).toBe(200);
    expect(moved.body.dueDate).toBe("2026-10-15");
    const cleared = await api.request("PUT", `/api/sessions/${body.id}`, { dueDate: null });
    expect(cleared.body.dueDate).toBeNull();
    expect((await api.request("GET", `/api/sessions/${body.id}`)).body.dueDate).toBeNull();
  });

  it("is left alone by an update that does not mention it", async () => {
    const { body } = await api.request("POST", "/api/sessions", newSession({ dueDate: "2026-10-08" }));
    const res = await api.request("PUT", `/api/sessions/${body.id}`, { title: "Renamed" });
    expect(res.body.dueDate).toBe("2026-10-08");
  });

  it.each(["2026-10-08T00:00:00Z", "8 Oct 2026", "2026-13-01", "2026-02-30", "2026-1-5", "", 20261008, true])(
    "rejects %j with 400",
    async (bad) => {
      const created = await api.request("POST", "/api/sessions", newSession({ dueDate: bad }));
      expect(created.status).toBe(400);
      const { body } = await api.request("POST", "/api/sessions", newSession());
      const updated = await api.request("PUT", `/api/sessions/${body.id}`, { dueDate: bad });
      expect(updated.status).toBe(400);
      expect((await api.request("GET", `/api/sessions/${body.id}`)).body.dueDate).toBeNull();
    },
  );

  it("keeps the exact calendar date at year and month edges", async () => {
    for (const day of ["2026-01-01", "2026-12-31", "2028-02-29"]) {
      const { body } = await api.request("POST", "/api/sessions", newSession({ dueDate: day }));
      expect(body.dueDate).toBe(day);
    }
  });

  it("does not change review state", async () => {
    const { body } = await api.request("POST", "/api/sessions", newSession({ dueDate: "2026-10-08" }));
    const grade = { id: "g1", subject: "english", word: "apple", skill: "spelling", grade: "good", gradedAt: "2026-01-05T09:00:00Z" };
    expect((await api.request("POST", "/api/grades", { grades: [grade] })).status).toBe(200);
    const states = () => api.request("GET", "/api/review-states?subject=english&skill=spelling&words=apple,pear");
    const before = (await states()).body;
    expect(before[0].state).not.toBeNull();

    await api.request("PUT", `/api/sessions/${body.id}`, { dueDate: "2026-10-20" });
    await api.request("PUT", `/api/sessions/${body.id}`, { dueDate: null });
    expect((await states()).body).toEqual(before);
  });
});
