import type { SessionWithLesson } from "@shared/schema";

export interface SessionGroup<T> {
  /** The Lesson heading, or null for the sessions with no Lesson. */
  lesson: { id: string; name: string } | null;
  sessions: T[];
}

// Pinned first (latest pinned first), then newest created first.
function byPinnedThenNewest(a: SessionWithLesson, b: SessionWithLesson): number {
  const time = (value: unknown, fallback: number) => (value ? new Date(value as string).getTime() : fallback);
  const aPinned = time(a.pinnedAt, -Infinity);
  const bPinned = time(b.pinnedAt, -Infinity);
  if (aPinned !== bPinned) return bPinned - aPinned;
  return time(b.createdAt, 0) - time(a.createdAt, 0);
}

/** Lesson groups by name, then the untagged sessions last. Empty groups are omitted. */
export function groupSessionsByLesson<T extends SessionWithLesson>(sessions: T[]): SessionGroup<T>[] {
  const byLesson = new Map<string, SessionGroup<T>>();
  const untagged: T[] = [];
  for (const session of sessions) {
    if (!session.lesson) {
      untagged.push(session);
      continue;
    }
    const group = byLesson.get(session.lesson.id) ?? { lesson: session.lesson, sessions: [] };
    group.sessions.push(session);
    byLesson.set(session.lesson.id, group);
  }
  const groups = Array.from(byLesson.values()).sort((a, b) => a.lesson!.name.localeCompare(b.lesson!.name));
  for (const group of groups) group.sessions.sort(byPinnedThenNewest);
  if (untagged.length > 0) groups.push({ lesson: null, sessions: untagged.sort(byPinnedThenNewest) });
  return groups;
}
