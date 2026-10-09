import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startTestApi, type TestApi } from "./test-harness";

let api: TestApi;
beforeEach(async () => {
  api = await startTestApi();
});
afterEach(async () => {
  await api.close();
});

const chineseSession = (words: string[], overrides: Record<string, unknown> = {}) => ({
  title: "Unit 1",
  words,
  wordCount: words.length,
  subject: "chinese",
  sessionType: "reading",
  ...overrides,
});

const meanings = async (subject: string, words: string[]) => {
  const params = new URLSearchParams({ subject });
  for (const word of words) params.append("word", word);
  return (await api.request("GET", `/api/meanings?${params}`)).body;
};

describe("generating Meanings when a list is saved", () => {
  it("gives every item in a new Chinese list a meaning, in one call", async () => {
    const res = await api.request("POST", "/api/sessions", chineseSession(["长城", "我爱吃苹果。"]));
    expect(res.status).toBe(200);
    await api.settle();
    expect(api.meaningCalls).toHaveLength(1);
    expect(await meanings("chinese", ["长城", "我爱吃苹果。"])).toEqual({
      长城: "meaning of 长城",
      "我爱吃苹果。": "meaning of 我爱吃苹果。",
    });
  });

  it("sends the whole list as context but asks only for words without a meaning", async () => {
    await api.request("POST", "/api/sessions", chineseSession(["长城"]));
    await api.settle();
    await api.request("POST", "/api/sessions", chineseSession(["长城", "大海"]));
    await api.settle();
    expect(api.meaningCalls[1]).toEqual({ items: ["长城", "大海"], missing: ["大海"], topic: null });
  });

  it("makes no call when every word already has a meaning", async () => {
    await api.request("POST", "/api/sessions", chineseSession(["长城"]));
    await api.settle();
    await api.request("POST", "/api/sessions", chineseSession([" 长城 "]));
    await api.settle();
    expect(api.meaningCalls).toHaveLength(1);
  });

  it("glosses words added when a list is edited", async () => {
    const created = await api.request("POST", "/api/sessions", chineseSession(["长城"]));
    await api.settle();
    await api.request("PUT", `/api/sessions/${created.body.id}`, { words: ["长城", "大海"], wordCount: 2 });
    await api.settle();
    expect(api.meaningCalls.map((c) => c.missing)).toEqual([["长城"], ["大海"]]);
  });

  it("leaves English lists alone", async () => {
    await api.request("POST", "/api/sessions", chineseSession(["apple"], { subject: "english" }));
    await api.settle();
    expect(api.meaningCalls).toEqual([]);
    expect(await meanings("english", ["apple"])).toEqual({});
  });

  it("still saves the list when the AI call fails, leaving the words without meanings", async () => {
    api.setGenerateMeanings(async () => {
      throw new Error("provider down");
    });
    const res = await api.request("POST", "/api/sessions", chineseSession(["长城"]));
    expect(res.status).toBe(200);
    await api.settle();
    expect(await meanings("chinese", ["长城"])).toEqual({});
  });

  it("ignores meanings the AI returns for items it was not asked about", async () => {
    api.setGenerateMeanings(async () => ({ 长城: "Great Wall", 别的: "something else" }));
    await api.request("POST", "/api/sessions", chineseSession(["长城"]));
    await api.settle();
    expect(await meanings("chinese", ["长城", "别的"])).toEqual({ 长城: "Great Wall" });
  });
});

it("finds the meaning of a sentence that contains a comma", async () => {
  await api.request("POST", "/api/sessions", chineseSession(["你好, 老师。"]));
  await api.settle();
  expect(await meanings("chinese", ["你好, 老师。"])).toEqual({ "你好, 老师。": "meaning of 你好, 老师。" });
});

describe("editing a Meaning", () => {
  it("replaces the meaning, and a later save never regenerates it", async () => {
    await api.request("POST", "/api/sessions", chineseSession(["行"]));
    await api.settle();
    const res = await api.request("PUT", "/api/meanings", { subject: "chinese", word: "行", meaning: "OK; to walk" });
    expect(res.status).toBe(200);
    await api.request("POST", "/api/sessions", chineseSession(["行"]));
    await api.settle();
    expect(api.meaningCalls).toHaveLength(1);
    expect(await meanings("chinese", ["行"])).toEqual({ 行: "OK; to walk" });
  });

  it("can give a meaning to a word the AI never reached", async () => {
    const res = await api.request("PUT", "/api/meanings", { subject: "chinese", word: " 大海 ", meaning: " the sea " });
    expect(res.status).toBe(200);
    expect(await meanings("chinese", ["大海"])).toEqual({ 大海: "the sea" });
  });

  it("clearing a meaning keeps it cleared rather than regenerating it", async () => {
    await api.request("PUT", "/api/meanings", { subject: "chinese", word: "大海", meaning: "  " });
    await api.request("POST", "/api/sessions", chineseSession(["大海"]));
    await api.settle();
    expect(api.meaningCalls).toEqual([]);
    expect(await meanings("chinese", ["大海"])).toEqual({});
  });

  it("rejects an edit without a valid subject or word", async () => {
    expect((await api.request("PUT", "/api/meanings", { subject: "maths", word: "x", meaning: "y" })).status).toBe(400);
    expect((await api.request("PUT", "/api/meanings", { subject: "chinese", word: " ", meaning: "y" })).status).toBe(400);
  });
});

describe("filling a list's missing Meanings", () => {
  it("retries only that list's words without a meaning", async () => {
    api.setGenerateMeanings(async () => {
      throw new Error("provider down");
    });
    const first = await api.request("POST", "/api/sessions", chineseSession(["长城", "大海"]));
    await api.request("POST", "/api/sessions", chineseSession(["高山"]));
    await api.settle();

    const calls: string[][] = [];
    api.setGenerateMeanings(async ({ missing }) => {
      calls.push(missing);
      return Object.fromEntries(missing.map((m) => [m, `meaning of ${m}`]));
    });
    const res = await api.request("POST", `/api/sessions/${first.body.id}/meanings/fill`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ filled: 2 });
    expect(calls).toEqual([["长城", "大海"]]);
    expect(await meanings("chinese", ["长城", "大海", "高山"])).toEqual({
      长城: "meaning of 长城",
      大海: "meaning of 大海",
    });
  });

  it("reports a failed retry so the user can try again", async () => {
    api.setGenerateMeanings(async () => {
      throw new Error("provider down");
    });
    const created = await api.request("POST", "/api/sessions", chineseSession(["长城"]));
    await api.settle();
    expect((await api.request("POST", `/api/sessions/${created.body.id}/meanings/fill`)).status).toBe(502);
  });

  it("404s for an unknown list", async () => {
    expect((await api.request("POST", "/api/sessions/nope/meanings/fill")).status).toBe(404);
  });
});
