import { describe, expect, it } from "vitest";
import { matchesReadAloud, readAloudLang } from "./read-aloud";

describe("readAloudLang", () => {
  it("is zh-CN for words with CJK characters and en-US otherwise", () => {
    expect(readAloudLang("长城")).toBe("zh-CN");
    expect(readAloudLang("apple")).toBe("en-US");
  });
});

describe("matchesReadAloud (Chinese)", () => {
  it("passes when the heard characters are the target's", () => {
    expect(matchesReadAloud("长城", ["长城"])).toBe(true);
  });

  it("ignores spaces and punctuation in the same-characters rule", () => {
    expect(matchesReadAloud("长城", ["长 城。"])).toBe(true);
  });

  it("passes a homophone", () => {
    expect(matchesReadAloud("弯曲", ["湾区"])).toBe(true);
  });

  it("fails right syllables with a wrong tone", () => {
    expect(matchesReadAloud("你好", ["尼好"])).toBe(false);
  });

  it("resolves the target's reading as a whole word", () => {
    expect(matchesReadAloud("长大", ["长大"])).toBe(true);
    expect(matchesReadAloud("长大", ["常大"])).toBe(false);
  });

  it("passes when only a later alternative matches", () => {
    expect(matchesReadAloud("弯曲", ["完全", "万", "湾区"])).toBe(true);
  });

  it("accepts any reading of a heard polyphonic character", () => {
    // 长 can be cháng or zhǎng; 增长 needs zhǎng
    expect(matchesReadAloud("增长", ["曾长"])).toBe(true);
  });

  it("fails when a heard character is not Chinese", () => {
    expect(matchesReadAloud("长城", ["长c"])).toBe(false);
  });

  it("fails on different length", () => {
    expect(matchesReadAloud("长城", ["长城墙"])).toBe(false);
    expect(matchesReadAloud("长城", ["长"])).toBe(false);
  });

  it("fails with no alternatives", () => {
    expect(matchesReadAloud("长城", [])).toBe(false);
  });
});

describe("matchesReadAloud (English)", () => {
  it("ignores case, whitespace and punctuation", () => {
    expect(matchesReadAloud("apple", [" Apple. "])).toBe(true);
  });

  it("passes when a later alternative matches", () => {
    expect(matchesReadAloud("two", ["too", "two"])).toBe(true);
  });

  it("fails when no alternative matches", () => {
    expect(matchesReadAloud("two", ["too"])).toBe(false);
    expect(matchesReadAloud("apple", ["apples"])).toBe(false);
  });

  it("keeps internal whitespace and apostrophes significant", () => {
    expect(matchesReadAloud("ice cream", ["icecream"])).toBe(false);
    expect(matchesReadAloud("don't", ["dont"])).toBe(false);
    expect(matchesReadAloud("ice cream", [" Ice cream! "])).toBe(true);
  });

  it("fails with no alternatives", () => {
    expect(matchesReadAloud("apple", [])).toBe(false);
  });
});
