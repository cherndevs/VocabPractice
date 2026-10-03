import { describe, expect, it } from "vitest";
import type { SessionWithLesson } from "@shared/schema";
import { groupSessionsByLesson } from "./group-sessions";

const session = (title: string, lesson: string | null, extra: Partial<SessionWithLesson> = {}) =>
  ({
    id: title,
    title,
    lesson: lesson ? { id: lesson, name: lesson } : null,
    pinnedAt: null,
    createdAt: new Date("2026-01-01"),
    ...extra,
  }) as SessionWithLesson;

const titles = (groups: ReturnType<typeof groupSessionsByLesson>) =>
  groups.map((g) => [g.lesson?.name ?? null, g.sessions.map((s) => s.title)]);

describe("groupSessionsByLesson", () => {
  it("lists Lessons by name, then untagged sessions", () => {
    const groups = groupSessionsByLesson([
      session("loose", null),
      session("b1", "Unit B"),
      session("a1", "Unit A"),
      session("b2", "Unit B"),
    ]);
    expect(titles(groups)).toEqual([
      ["Unit A", ["a1"]],
      ["Unit B", expect.arrayContaining(["b1", "b2"])],
      [null, ["loose"]],
    ]);
  });

  it("keeps pinned first, then newest, within each group", () => {
    const groups = groupSessionsByLesson([
      session("old", "A", { createdAt: new Date("2026-01-01") }),
      session("new", "A", { createdAt: new Date("2026-02-01") }),
      session("pinned", "A", { pinnedAt: new Date("2026-03-01") }),
      session("loose-old", null, { createdAt: new Date("2026-01-01") }),
      session("loose-pinned", null, { pinnedAt: new Date("2026-01-02") }),
    ]);
    expect(titles(groups)).toEqual([
      ["A", ["pinned", "new", "old"]],
      [null, ["loose-pinned", "loose-old"]],
    ]);
  });

  it("has no untagged group when every session is tagged, and no groups when empty", () => {
    expect(titles(groupSessionsByLesson([session("x", "A")]))).toEqual([["A", ["x"]]]);
    expect(groupSessionsByLesson([])).toEqual([]);
  });
});
