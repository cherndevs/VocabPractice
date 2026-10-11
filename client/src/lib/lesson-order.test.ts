import { describe, expect, it } from "vitest";
import { lessonNumber, lessonsMatchingTitle, sortLessonNames } from "./lesson-order";

describe("lessonNumber", () => {
  it("reads Chinese and Arabic lesson numbers", () => {
    expect(lessonNumber("第一课·我上学了")).toBe(1);
    expect(lessonNumber("第十课·小侦探")).toBe(10);
    expect(lessonNumber("第十七课·好孩子")).toBe(17);
    expect(lessonNumber("第二十三课")).toBe(23);
    expect(lessonNumber("Unit 3")).toBe(3);
    expect(lessonNumber("Animals")).toBeNull();
  });
});

describe("sortLessonNames", () => {
  it("orders by lesson number, then name, with unnumbered last", () => {
    expect(sortLessonNames(["第十课·b", "Animals", "第二课·a", "Unit 12", "第二课·0", "Unit 3"])).toEqual([
      "第二课·0",
      "第二课·a",
      "Unit 3",
      "第十课·b",
      "Unit 12",
      "Animals",
    ]);
  });
});

describe("lessonsMatchingTitle", () => {
  it("ignores punctuation when matching", () => {
    const names = ["第十七课·好孩子", "第十七课·庆祝节日", "第七课·留张便条"];
    expect(lessonsMatchingTitle("第十七课《好孩子》", names)).toEqual(["第十七课·好孩子"]);
    expect(lessonsMatchingTitle("Week 2 words", names)).toEqual([]);
    expect(lessonsMatchingTitle("", names)).toEqual([]);
  });
});
