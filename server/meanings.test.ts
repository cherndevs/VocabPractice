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

const preview = (words: string[], extra: Record<string, unknown> = {}) =>
  api.request("POST", "/api/meanings/preview", { subject: "chinese", words, ...extra });

describe("previewing Meanings before a list is saved", () => {
  it("generates every item's meaning in one call, without storing anything", async () => {
    const res = await preview(["长城", "我爱吃苹果。"]);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ 长城: "meaning of 长城", "我爱吃苹果。": "meaning of 我爱吃苹果。" });
    expect(api.meaningCalls).toEqual([{ items: ["长城", "我爱吃苹果。"], missing: ["长城", "我爱吃苹果。"], topic: null }]);
    expect(await meanings("chinese", ["长城"])).toEqual({});
  });

  it("reuses stored meanings and asks only for the rest, with the whole list as context", async () => {
    await api.request("POST", "/api/sessions", chineseSession(["长城"], { meanings: [{ word: "长城", meaning: "the Great Wall", edited: false }] }));
    const res = await preview(["长城", " 大海 "]);
    expect(res.body).toEqual({ 长城: "the Great Wall", 大海: "meaning of 大海" });
    expect(api.meaningCalls).toEqual([{ items: ["长城", "大海"], missing: ["大海"], topic: null }]);
  });

  it("generates only the words the client still needs, keeping the rest as context", async () => {
    const res = await preview(["长城", "大海", "高山"], { missing: ["高山"] });
    expect(res.body).toEqual({ 高山: "meaning of 高山" });
    expect(api.meaningCalls).toEqual([{ items: ["长城", "大海", "高山"], missing: ["高山"], topic: null }]);
  });

  it("makes no call when every word already has a meaning", async () => {
    await api.request("POST", "/api/sessions", chineseSession(["长城"], { meanings: [{ word: "长城", meaning: "the Great Wall", edited: false }] }));
    expect((await preview(["长城"])).body).toEqual({ 长城: "the Great Wall" });
    expect(api.meaningCalls).toEqual([]);
  });

  it("never regenerates a meaning a parent cleared", async () => {
    await api.request("POST", "/api/sessions", chineseSession(["大海"], { meanings: [{ word: "大海", meaning: "", edited: true }] }));
    expect((await preview(["大海"])).body).toEqual({});
    expect(api.meaningCalls).toEqual([]);
  });

  it("drops meanings the AI returns for items it was not asked about", async () => {
    api.setGenerateMeanings(async () => ({ 长城: "Great Wall", 别的: "something else" }));
    expect((await preview(["长城"])).body).toEqual({ 长城: "Great Wall" });
  });

  it("returns nothing for a Subject without Meanings", async () => {
    const res = await preview(["apple"], { subject: "english" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({});
    expect(api.meaningCalls).toEqual([]);
  });

  it("reports a failed AI call so the user can try again", async () => {
    api.setGenerateMeanings(async () => {
      throw new Error("provider down");
    });
    expect((await preview(["长城"])).status).toBe(502);
  });

  it("rejects a request without a valid subject or words", async () => {
    expect((await api.request("POST", "/api/meanings/preview", { subject: "maths", words: ["x"] })).status).toBe(400);
    expect((await api.request("POST", "/api/meanings/preview", { subject: "chinese" })).status).toBe(400);
  });
});

describe("saving Meanings with a list", () => {
  it("stores the meanings sent with a new list and calls no AI", async () => {
    const res = await api.request(
      "POST",
      "/api/sessions",
      chineseSession(["长城", "行"], {
        meanings: [
          { word: "长城", meaning: "the Great Wall", edited: false },
          { word: "行", meaning: "OK", edited: true },
        ],
      }),
    );
    expect(res.status).toBe(200);
    expect(api.meaningCalls).toEqual([]);
    expect(await meanings("chinese", ["长城", "行"])).toEqual({ 长城: "the Great Wall", 行: "OK" });
  });

  it("saves a list sent without meanings, leaving its words blank", async () => {
    const res = await api.request("POST", "/api/sessions", chineseSession(["长城"]));
    expect(res.status).toBe(200);
    expect(api.meaningCalls).toEqual([]);
    expect(await meanings("chinese", ["长城"])).toEqual({});
  });

  it("ignores meanings for words not in the list", async () => {
    await api.request("POST", "/api/sessions", chineseSession(["长城"], { meanings: [{ word: "大海", meaning: "the sea", edited: true }] }));
    expect(await meanings("chinese", ["大海"])).toEqual({});
  });

  it("an unedited meaning never replaces a stored one; an edit always does", async () => {
    await api.request("POST", "/api/sessions", chineseSession(["行"], { meanings: [{ word: "行", meaning: "to walk", edited: false }] }));
    await api.request("POST", "/api/sessions", chineseSession(["行"], { meanings: [{ word: "行", meaning: "a row", edited: false }] }));
    expect(await meanings("chinese", ["行"])).toEqual({ 行: "to walk" });
    await api.request("POST", "/api/sessions", chineseSession(["行"], { meanings: [{ word: "行", meaning: "OK", edited: true }] }));
    expect(await meanings("chinese", ["行"])).toEqual({ 行: "OK" });
  });

  it("stores meanings sent when a list is edited", async () => {
    const created = await api.request("POST", "/api/sessions", chineseSession(["长城"]));
    const res = await api.request("PUT", `/api/sessions/${created.body.id}`, {
      words: ["长城", "大海"],
      wordCount: 2,
      meanings: [
        { word: "长城", meaning: "the Great Wall", edited: true },
        { word: "大海", meaning: "the sea", edited: false },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.meanings).toBeUndefined();
    expect(await meanings("chinese", ["长城", "大海"])).toEqual({ 长城: "the Great Wall", 大海: "the sea" });
  });

  it("rejects malformed meanings", async () => {
    const res = await api.request("POST", "/api/sessions", chineseSession(["长城"], { meanings: [{ word: "长城" }] }));
    expect(res.status).toBe(400);
  });

  it("finds the meaning of a sentence that contains a comma", async () => {
    await api.request("POST", "/api/sessions", chineseSession(["你好, 老师。"], { meanings: [{ word: "你好, 老师。", meaning: "Hello, teacher.", edited: false }] }));
    expect(await meanings("chinese", ["你好, 老师。"])).toEqual({ "你好, 老师。": "Hello, teacher." });
  });
});
