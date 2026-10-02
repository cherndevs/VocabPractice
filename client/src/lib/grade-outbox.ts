import type { GradeInput } from "@shared/schema";

// A grade as queued on the device. gradedAt is an ISO string so it survives
// JSON round-trips through localStorage and goes straight onto the wire.
export type OutboxGrade = Omit<GradeInput, "gradedAt"> & { gradedAt: string };
export type NewGrade = Omit<OutboxGrade, "id" | "gradedAt">;

export interface OutboxStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface GradeOutboxDeps {
  storage: OutboxStorage;
  /** Posts a batch. Must reject unless the server answered 2xx. */
  send(grades: OutboxGrade[]): Promise<void>;
  newId(): string;
  now(): Date;
  /** Runs `fn` after `ms`; returns a cancel function. */
  setTimer(fn: () => void, ms: number): () => void;
  /** Called after a batch is accepted, so the UI can refresh counts. */
  onSent?(): void;
}

const STORAGE_KEY = "gradeOutbox:v1";
const BATCH_SIZE = 50;
const BASE_DELAY_MS = 2_000;
const MAX_DELAY_MS = 60_000;

/**
 * Grades wait here until the server has saved them (ADR-0010). The UI never
 * waits on the network: `add` returns at once, and flushing happens in the
 * background, surviving Render's cold start and dropped connections. An entry
 * leaves the queue only after a 2xx; the server treats a replayed id as a
 * no-op, so re-sending after an ambiguous failure is safe.
 */
export function createGradeOutbox(deps: GradeOutboxDeps) {
  let flushing = false;
  let failures = 0;
  let cancelRetry: (() => void) | null = null;

  const load = (): OutboxGrade[] => {
    try {
      const parsed = JSON.parse(deps.storage.getItem(STORAGE_KEY) ?? "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };
  const save = (queue: OutboxGrade[]) => {
    try {
      deps.storage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch {
      // Storage full or blocked: the grades in memory still go out this visit.
    }
  };

  async function flush(): Promise<void> {
    if (flushing) return;
    flushing = true;
    cancelRetry?.();
    cancelRetry = null;
    try {
      for (let batch = load().slice(0, BATCH_SIZE); batch.length > 0; batch = load().slice(0, BATCH_SIZE)) {
        try {
          await deps.send(batch);
        } catch {
          const delay = Math.min(BASE_DELAY_MS * 2 ** failures, MAX_DELAY_MS);
          failures += 1;
          cancelRetry = deps.setTimer(() => void flush(), delay);
          return;
        }
        failures = 0;
        // Re-read: grades added while the request was in flight must stay queued.
        const sent = new Set(batch.map((g) => g.id));
        save(load().filter((g) => !sent.has(g.id)));
        deps.onSent?.();
      }
    } finally {
      flushing = false;
    }
  }

  return {
    /** Queues a grade (oldest first) and starts sending it. */
    add(grade: NewGrade): OutboxGrade {
      const entry: OutboxGrade = { ...grade, id: deps.newId(), gradedAt: deps.now().toISOString() };
      save([...load(), entry]);
      void flush();
      return entry;
    },
    flush,
    /** Entries not yet accepted by the server. */
    pending: () => load().length,
  };
}
