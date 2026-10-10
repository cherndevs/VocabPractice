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
export function groupLibrary<T extends SessionWithLesson>(sessions: T[]): Library<T> {
  const pinned = sessions.filter((s) => s.pinnedAt).sort((a, b) => time(b.pinnedAt, 0) - time(a.pinnedAt, 0));

  const byLesson = new Map<string, SessionGroup<T>>();
  const untagged: T[] = [];
  for (const session of sessions) {
    if (session.pinnedAt) continue;
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
