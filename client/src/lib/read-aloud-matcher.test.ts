import { describe, expect, it } from "vitest";
import { matchesTarget, recognitionLang } from "./read-aloud-matcher";

describe("recognitionLang", () => {
  it("picks zh-CN for words with CJK characters and en-US otherwise", () => {
    expect(recognitionLang("长城")).toBe("zh-CN");
    expect(recognitionLang("apple")).toBe("en-US");
  });
});

describe("matchesTarget (Chinese)", () => {
  it("passes when the heard characters are the target's", () => {
    expect(matchesTarget("长城", ["长城"])).toBe(true);
  });

  it("ignores spaces and punctuation when comparing characters", () => {
    expect(matchesTarget("长城", [" 长城。"])).toBe(true);
  });

  it("passes a homophone (弯曲 heard as 湾区)", () => {
    expect(matchesTarget("弯曲", ["湾区"])).toBe(true);
  });

  it("fails right syllables with a wrong tone", () => {
    expect(matchesTarget("弯曲", ["完全"])).toBe(false); // wán quán
  });

  it("resolves the target reading as a whole word", () => {
    expect(matchesTarget("长大", ["长大"])).toBe(true);
    // 常 is only cháng, but the target reads zhǎng dà
    expect(matchesTarget("长大", ["常大"])).toBe(false);
  });

  it("passes when only a later alternative matches", () => {
    expect(matchesTarget("弯曲", ["完全", "万", "湾区"])).toBe(true);
  });

  it("fails when the length differs", () => {
    expect(matchesTarget("长城", ["长城墙"])).toBe(false);
    expect(matchesTarget("长城", ["长"])).toBe(false);
  });

  it("fails on empty alternatives", () => {
    expect(matchesTarget("长城", [])).toBe(false);
    expect(matchesTarget("长城", [""])).toBe(false);
  });
});

describe("matchesTarget (English)", () => {
  it("ignores case, surrounding whitespace and punctuation", () => {
    expect(matchesTarget("apple", ["Apple."])).toBe(true);
    expect(matchesTarget("apple", ["  apple  "])).toBe(true);
  });

  it("keeps internal spaces and hyphens significant", () => {
    expect(matchesTarget("ok", ["o k"])).toBe(false);
    expect(matchesTarget("apple pie", ["apple-pie"])).toBe(false);
  });

  it("passes when a later alternative matches", () => {
    expect(matchesTarget("two", ["too", "two"])).toBe(true);
  });

  it("fails when no alternative matches", () => {
    expect(matchesTarget("two", ["too"])).toBe(false);
    expect(matchesTarget("apple", ["apples"])).toBe(false);
  });

  it("fails on empty alternatives", () => {
    expect(matchesTarget("apple", [])).toBe(false);
  });
});
