import { describe, expect, it } from "vitest";
import { sanitizeExtractedCandidates } from "./extraction-candidates";

const DEFAULT_TITLE = "Spelling Session 1/1/2026";

describe("sanitizeExtractedCandidates", () => {
  it("passes a single clean candidate through with title and words intact", () => {
    const result = sanitizeExtractedCandidates(
      { candidates: [{ title: "Week 1", words: ["cat", "dog"] }] },
      DEFAULT_TITLE,
    );
    expect(result.candidates).toEqual([{ title: "Week 1", words: ["cat", "dog"] }]);
    expect(result.isEmpty).toBe(false);
  });

  it("passes several clean candidates through, in order", () => {
    const result = sanitizeExtractedCandidates(
      {
        candidates: [
          { title: "Week 1", words: ["cat"] },
          { title: "Week 2", words: ["dog"] },
        ],
      },
      DEFAULT_TITLE,
    );
    expect(result.candidates.map((c) => c.title)).toEqual(["Week 1", "Week 2"]);
  });

  it("keeps the non-blank entries of a candidate that has some blank entries", () => {
    const result = sanitizeExtractedCandidates(
      { candidates: [{ title: "Week 1", words: ["cat", "  ", "", "dog"] }] },
      DEFAULT_TITLE,
    );
    expect(result.candidates).toEqual([{ title: "Week 1", words: ["cat", "dog"] }]);
  });

  it("drops a candidate whose entries are all blank", () => {
    const result = sanitizeExtractedCandidates(
      {
        candidates: [
          { title: "Empty", words: ["", "   "] },
          { title: "Good", words: ["cat"] },
        ],
      },
      DEFAULT_TITLE,
    );
    expect(result.candidates).toEqual([{ title: "Good", words: ["cat"] }]);
  });

  it("reports isEmpty when there are no candidates at all", () => {
    const result = sanitizeExtractedCandidates({ candidates: [] }, DEFAULT_TITLE);
    expect(result.isEmpty).toBe(true);
    expect(result.candidates).toEqual([]);
  });

  it("reports isEmpty when every candidate is dropped", () => {
    const result = sanitizeExtractedCandidates(
      { candidates: [{ title: "Empty", words: [] }, { title: "Also empty", words: ["  "] }] },
      DEFAULT_TITLE,
    );
    expect(result.isEmpty).toBe(true);
  });

  it("does not report isEmpty when some candidates survive", () => {
    const result = sanitizeExtractedCandidates(
      { candidates: [{ title: "Empty", words: [] }, { title: "Good", words: ["cat"] }] },
      DEFAULT_TITLE,
    );
    expect(result.isEmpty).toBe(false);
  });

  it("falls back to the default title when a candidate's title is blank", () => {
    const result = sanitizeExtractedCandidates(
      { candidates: [{ title: "   ", words: ["cat"] }] },
      DEFAULT_TITLE,
    );
    expect(result.candidates[0].title).toBe(DEFAULT_TITLE);
  });

  it("numbers distinguishable fallback titles when two candidates in a batch are both untitled", () => {
    const result = sanitizeExtractedCandidates(
      {
        candidates: [
          { title: "", words: ["cat"] },
          { title: "", words: ["dog"] },
        ],
      },
      DEFAULT_TITLE,
    );
    expect(result.candidates.map((c) => c.title)).toEqual([
      `${DEFAULT_TITLE} (1)`,
      `${DEFAULT_TITLE} (2)`,
    ]);
  });

  it("leaves a real title supplied by the model alone even if it collides with another candidate's title", () => {
    const result = sanitizeExtractedCandidates(
      {
        candidates: [
          { title: "Week 1", words: ["cat"] },
          { title: "Week 1", words: ["dog"] },
        ],
      },
      DEFAULT_TITLE,
    );
    expect(result.candidates.map((c) => c.title)).toEqual(["Week 1", "Week 1"]);
  });

  it("passes multi-word phrases and full sentences through unchanged", () => {
    const result = sanitizeExtractedCandidates(
      { candidates: [{ title: "Dictation", words: ["The quick brown fox.", "He said hello."] }] },
      DEFAULT_TITLE,
    );
    expect(result.candidates[0].words).toEqual(["The quick brown fox.", "He said hello."]);
  });

  it("passes Chinese entries through unchanged", () => {
    const result = sanitizeExtractedCandidates(
      { candidates: [{ title: "听写", words: ["考一考", "苹果"] }] },
      DEFAULT_TITLE,
    );
    expect(result.candidates[0]).toEqual({ title: "听写", words: ["考一考", "苹果"] });
  });

  it("drops non-string values in the entries array without throwing", () => {
    const result = sanitizeExtractedCandidates(
      { candidates: [{ title: "Week 1", words: ["cat", 42, null, {}, ["nested"], "dog"] }] },
      DEFAULT_TITLE,
    );
    expect(result.candidates[0].words).toEqual(["cat", "dog"]);
  });

  it("handles missing or null fields anywhere in the response without throwing", () => {
    expect(() => sanitizeExtractedCandidates(null, DEFAULT_TITLE)).not.toThrow();
    expect(() => sanitizeExtractedCandidates(undefined, DEFAULT_TITLE)).not.toThrow();
    expect(() => sanitizeExtractedCandidates({}, DEFAULT_TITLE)).not.toThrow();
    expect(() => sanitizeExtractedCandidates({ candidates: null }, DEFAULT_TITLE)).not.toThrow();
    expect(() => sanitizeExtractedCandidates({ candidates: "oops" }, DEFAULT_TITLE)).not.toThrow();
    expect(() =>
      sanitizeExtractedCandidates({ candidates: [null, undefined, "oops", 5, {}] }, DEFAULT_TITLE),
    ).not.toThrow();
    expect(() =>
      sanitizeExtractedCandidates({ candidates: [{ title: null, words: null }] }, DEFAULT_TITLE),
    ).not.toThrow();

    const result = sanitizeExtractedCandidates(null, DEFAULT_TITLE);
    expect(result).toEqual({ candidates: [], isEmpty: true });
  });
});
