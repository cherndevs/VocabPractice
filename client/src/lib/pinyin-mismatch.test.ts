import { describe, expect, it, vi } from "vitest";

// pinyin-pro's `type: "array"` output is expected to have one syllable per
// character in the run. If that ever isn't true, annotateChineseRun must not
// mis-zip syllables to the wrong characters — it should mark the whole run
// unresolved instead.
vi.mock("pinyin-pro", () => ({
  pinyin: () => ["only-one-syllable"],
}));

describe("getPinyinAnnotation with a mismatched syllable count", () => {
  it("falls back to placeholders for every character in the run", async () => {
    const { getPinyinAnnotation } = await import("./pinyin");
    expect(getPinyinAnnotation("你好")).toBe("? ?");
  });
});
