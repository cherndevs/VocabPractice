import type { LessonSummary, SessionWithLesson } from "@shared/schema";

export interface SessionGroup<T> {
  /** The Lesson heading, or null for the sessions with no Lesson. */
  lesson: LessonSummary | null;
  sessions: T[];
}

export interface YearGroup<T> {
  /** The Year heading, or null for "Other": Lessons with no Year, then untagged sessions. */
  year: string | null;
  lessons: SessionGroup<T>[];
}

export interface Library<T> {
  /** Pinned sessions, latest pinned first. They are not repeated under their Year. */
  pinned: T[];
  years: YearGroup<T>[];
}

const time = (value: unknown, fallback: number) => (value ? new Date(value as string).getTime() : fallback);

const newestFirst = (a: SessionWithLesson, b: SessionWithLesson) => time(b.createdAt, 0) - time(a.createdAt, 0);

// Creation order matches a textbook's order when its Lessons are entered in turn.
const lessonOrder = (a: LessonSummary, b: LessonSummary) =>
  time(a.createdAt, 0) - time(b.createdAt, 0) || a.name.localeCompare(b.name);

// "P2" before "P10".
const yearOrder = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

/**
 * The Library's layout: pinned sessions, then one group per Year (in Year
 * order), each holding its Lessons in creation order, newest session first.
 * "Other" comes last. Empty groups are omitted.
 */
export function groupLibrary<T extends SessionWithLesson>(sessions: T[], { pinnedFirst = true } = {}): Library<T> {
  const pinned = pinnedFirst ? sessions.filter((s) => s.pinnedAt).sort((a, b) => time(b.pinnedAt, 0) - time(a.pinnedAt, 0)) : [];

  const byLesson = new Map<string, SessionGroup<T>>();
  const untagged: T[] = [];
  for (const session of sessions) {
    if (pinnedFirst && session.pinnedAt) continue;
    if (!session.lesson) {
      untagged.push(session);
      continue;
    }
    const group = byLesson.get(session.lesson.id) ?? { lesson: session.lesson, sessions: [] };
    group.sessions.push(session);
    byLesson.set(session.lesson.id, group);
  }

  const byYear = new Map<string | null, SessionGroup<T>[]>();
  for (const group of Array.from(byLesson.values())) {
    group.sessions.sort(newestFirst);
    const year = group.lesson!.year;
    byYear.set(year, [...(byYear.get(year) ?? []), group]);
  }
  for (const groups of Array.from(byYear.values())) groups.sort((a, b) => lessonOrder(a.lesson!, b.lesson!));

  const years: YearGroup<T>[] = Array.from(byYear.keys())
    .filter((year): year is string => year !== null)
    .sort(yearOrder)
    .map((year) => ({ year, lessons: byYear.get(year)! }));

  const other = [...(byYear.get(null) ?? [])];
  if (untagged.length > 0) other.push({ lesson: null, sessions: untagged.sort(newestFirst) });
  if (other.length > 0) years.push({ year: null, lessons: other });

  return { pinned, years };
}

/** A Year filter chip: a Year, "other" (no Year), or "all". */
export type YearFilter = { key: string; label: string; count: number };
export const ALL_YEARS = "all";
export const OTHER_YEAR = "other";

const yearKey = (s: SessionWithLesson) => s.lesson?.year ?? OTHER_YEAR;

/**
 * The Library's Year chips: All, each Year in order, then Other, with session
 * counts. Empty when no session has a Year, since there is nothing to choose.
 */
export function yearFilters(sessions: SessionWithLesson[]): YearFilter[] {
  const counts = new Map<string, number>();
  for (const s of sessions) counts.set(yearKey(s), (counts.get(yearKey(s)) ?? 0) + 1);
  const years = Array.from(counts.keys()).filter((k) => k !== OTHER_YEAR).sort(yearOrder);
  if (years.length === 0) return [];
  const chips = [{ key: ALL_YEARS, label: "All", count: sessions.length }, ...years.map((y) => ({ key: y, label: y, count: counts.get(y)! }))];
  if (counts.has(OTHER_YEAR)) chips.push({ key: OTHER_YEAR, label: "Other", count: counts.get(OTHER_YEAR)! });
  return chips;
}

/**
 * The Library for one chip. "all" is the full layout; a single Year (or
 * Other) lists only its sessions, pinned ones staying in their Lesson.
 */
export function libraryFor<T extends SessionWithLesson>(sessions: T[], filter: string): Library<T> {
  if (filter === ALL_YEARS) return groupLibrary(sessions);
  return groupLibrary(
    sessions.filter((s) => yearKey(s) === filter),
    { pinnedFirst: false },
  );
}
