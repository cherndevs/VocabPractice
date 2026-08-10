import { describe, expect, it } from "vitest";
import { getPinyinAnnotation } from "./pinyin";

describe("getPinyinAnnotation", () => {
  it("returns null for words with no Chinese characters", () => {
    expect(getPinyinAnnotation("hello")).toBeNull();
    expect(getPinyinAnnotation("123")).toBeNull();
    expect(getPinyinAnnotation("")).toBeNull();
  });

  it("returns diacritic pinyin for a simple Chinese word", () => {
    expect(getPinyinAnnotation("你好")).toBe("nǐ hǎo");
  });

  it("uses word-boundary-aware segmentation for contextual readings", () => {
    // 银行 (bank) reads "yín háng", not the isolated per-character "yín xíng"
    expect(getPinyinAnnotation("银行")).toBe("yín háng");
    // 校长 (headmaster) reads "xiào zhǎng", not the isolated per-character "xiào cháng"
    expect(getPinyinAnnotation("校长")).toBe("xiào zhǎng");
  });

  it("passes non-Chinese characters through untouched, not letter-spaced", () => {
    expect(getPinyinAnnotation("你好 hello")).toBe("nǐ hǎo hello");
    expect(getPinyinAnnotation("你好hello")).toBe("nǐ hǎo hello");
  });

  it("passes through digits and punctuation adjacent to Chinese text", () => {
    expect(getPinyinAnnotation("你好！")).toBe("nǐ hǎo ！");
  });

  it("marks characters the dictionary can't resolve with a placeholder", () => {
    // U+9FA6 (龦) is outside pinyin-pro's dictionary and comes back identical
    // to the input character; that's our unresolved signal.
    expect(getPinyinAnnotation("龦")).toBe("?");
    expect(getPinyinAnnotation("你龦好")).toBe("nǐ ? hǎo");
  });
});
