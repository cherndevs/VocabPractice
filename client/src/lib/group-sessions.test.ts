import { describe, expect, it } from "vitest";
import type { SessionWithLesson } from "@shared/schema";
import { groupLibrary } from "./group-sessions";

const lesson = (name: string, year: string | null, created = "2026-01-01") => ({
  id: `${year}/${name}`,
  name,
  year,
  createdAt: new Date(created),
});

const session = (title: string, l: ReturnType<typeof lesson> | null, extra: Partial<SessionWithLesson> = {}) =>
  ({
    id: title,
    title,
    lesson: l,
    pinnedAt: null,
    createdAt: new Date("2026-01-01"),
    ...extra,
  }) as SessionWithLesson;

const layout = (sessions: SessionWithLesson[]) => {
  const { pinned, years } = groupLibrary(sessions);
  return {
    pinned: pinned.map((s) => s.title),
    years: years.map((y) => [y.year, y.lessons.map((g) => [g.lesson?.name ?? null, g.sessions.map((s) => s.title)])]),
  };
};

describe("groupLibrary", () => {
  it("groups Lessons under their Year in Year order, with Other last", () => {
    const p1 = lesson("第一课", "P1");
    const p2 = lesson("第一课", "P2");
    const p10 = lesson("Unit 1", "P10");
    const noYear = lesson("Loose lesson", null);
    expect(
      layout([
        session("untagged", null),
        session("p10", p10),
        session("p2", p2),
        session("no-year", noYear),
        session("p1", p1),
      ]).years,
    ).toEqual([
      ["P1", [["第一课", ["p1"]]]],
      ["P2", [["第一课", ["p2"]]]],
      ["P10", [["Unit 1", ["p10"]]]],
      [null, [["Loose lesson", ["no-year"]], [null, ["untagged"]]]],
    ]);
  });

  it("orders Lessons within a Year by creation, and sessions newest first", () => {
    const second = lesson("第二课", "P1", "2026-01-02");
    const first = lesson("第一课", "P1", "2026-01-01");
    expect(
      layout([
        session("2a", second),
        session("1-old", first, { createdAt: new Date("2026-01-01") }),
        session("1-new", first, { createdAt: new Date("2026-02-01") }),
      ]).years,
    ).toEqual([["P1", [["第一课", ["1-new", "1-old"]], ["第二课", ["2a"]]]]]);
  });

  it("lists pinned sessions first, latest pinned first, and only there", () => {
    const p1 = lesson("第一课", "P1");
    expect(
      layout([
        session("a", p1, { pinnedAt: new Date("2026-03-01") }),
        session("b", null, { pinnedAt: new Date("2026-03-02") }),
        session("c", p1),
      ]),
    ).toEqual({ pinned: ["b", "a"], years: [["P1", [["第一课", ["c"]]]]] });
  });

  it("omits empty groups", () => {
    expect(groupLibrary([])).toEqual({ pinned: [], years: [] });
    expect(layout([session("x", lesson("A", "P1"))]).years).toEqual([["P1", [["A", ["x"]]]]]);
  });
});
